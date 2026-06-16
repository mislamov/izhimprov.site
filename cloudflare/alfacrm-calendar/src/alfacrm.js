import { addDays, formatDateInTimeZone } from "./time.js";

const AUTH_CACHE_KEY = "calendar:alfacrm:auth";
const LOOKUP_CACHE_PREFIX = "calendar:lookup:";
const DEFAULT_HTTP_TIMEOUT_MS = 10000;
const DEFAULT_TOKEN_TTL_SECONDS = 3300;

function requiredEnv(env, key) {
  const value = env[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value.trim();
}

function parseNumber(value, fallback) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readFirstString(container, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], container);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function readFirstNumber(container, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], container);
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    const parsed = Number.parseInt(`${value ?? ""}`, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function findArrayCandidate(node, seen = new Set()) {
  if (!node || typeof node !== "object" || seen.has(node)) {
    return null;
  }
  seen.add(node);

  if (Array.isArray(node)) {
    return node;
  }

  const preferredKeys = ["items", "data", "model", "models", "rows", "list", "result"];
  for (const key of preferredKeys) {
    const value = node[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const key of preferredKeys) {
    const nested = findArrayCandidate(node[key], seen);
    if (nested) {
      return nested;
    }
  }

  for (const value of Object.values(node)) {
    const nested = findArrayCandidate(value, seen);
    if (nested) {
      return nested;
    }
  }

  return null;
}

export function extractLessonItems(payload) {
  return findArrayCandidate(payload) ?? [];
}

export function extractTotalCount(payload) {
  return (
    readFirstNumber(payload, [
      "total",
      "count",
      "pagination.total",
      "meta.total",
      "data.total",
      "result.total"
    ]) ?? null
  );
}

function parseExpiry(rawValue) {
  if (!rawValue) {
    return null;
  }

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    if (rawValue > 2_000_000_000) {
      return rawValue;
    }
    return Date.now() + rawValue * 1000;
  }

  if (typeof rawValue === "string") {
    const numeric = Number.parseInt(rawValue, 10);
    if (Number.isFinite(numeric)) {
      return parseExpiry(numeric);
    }

    const parsed = Date.parse(rawValue);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildBaseUrl(env) {
  return requiredEnv(env, "ALFACRM_BASE_URL").replace(/\/+$/, "");
}

function getBranchId(env) {
  return requiredEnv(env, "ALFACRM_BRANCH_ID");
}

export async function login(env) {
  const email = requiredEnv(env, "ALFACRM_EMAIL");
  const apiKey = requiredEnv(env, "ALFACRM_API_KEY");
  const response = await fetchWithTimeout(`${buildBaseUrl(env)}/v2api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      email,
      api_key: apiKey
    })
  });

  if (!response.ok) {
    throw new Error(`AlfaCRM login failed with status ${response.status}`);
  }

  const payload = await response.json();
  const token = readFirstString(payload, [
    "token",
    "data.token",
    "model.token",
    "response.token",
    "access_token"
  ]);

  if (!token) {
    throw new Error("AlfaCRM login response did not include a token");
  }

  const expiresAt =
    parseExpiry(
      payload.expires_at ??
        payload.expired_at ??
        payload.token_expired_at ??
        payload.ttl ??
        payload.expires ??
        payload.data?.expires_at ??
        payload.model?.expires_at
    ) ??
    Date.now() + DEFAULT_TOKEN_TTL_SECONDS * 1000;

  return {
    token,
    expiresAt
  };
}

export async function getCachedToken(env, options = {}) {
  const forceRefresh = options.forceRefresh === true;

  if (!forceRefresh) {
    const cached = await env.CALENDAR_CACHE.get(AUTH_CACHE_KEY, "json");
    if (cached?.token && cached?.expiresAt && cached.expiresAt > Date.now() + 60_000) {
      return cached.token;
    }
  }

  const session = await login(env);
  const ttlSeconds = Math.max(60, Math.floor((session.expiresAt - Date.now()) / 1000));

  await env.CALENDAR_CACHE.put(
    AUTH_CACHE_KEY,
    JSON.stringify(session),
    { expirationTtl: ttlSeconds }
  );

  return session.token;
}

async function postAlfa(env, path, body, options = {}) {
  const token = await getCachedToken(env, { forceRefresh: options.forceRefresh === true });
  const response = await fetchWithTimeout(`${buildBaseUrl(env)}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-ALFACRM-TOKEN": token
    },
    body: JSON.stringify(body)
  });

  if (response.status === 401 && options.allowRetry !== false) {
    const freshToken = await getCachedToken(env, { forceRefresh: true });
    const retryResponse = await fetchWithTimeout(`${buildBaseUrl(env)}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-ALFACRM-TOKEN": freshToken
      },
      body: JSON.stringify(body)
    });

    if (!retryResponse.ok) {
      throw new Error(`AlfaCRM request failed with status ${retryResponse.status}`);
    }

    return retryResponse.json();
  }

  if (!response.ok) {
    throw new Error(`AlfaCRM request failed with status ${response.status}`);
  }

  return response.json();
}

async function fetchIndexItems(env, resourcePath, body = { page: 0 }) {
  const payload = await postAlfa(env, resourcePath, body);
  return extractLessonItems(payload);
}

async function getLookupCache(env, cacheKey) {
  return (await env.CALENDAR_CACHE.get(cacheKey, "json")) || {};
}

async function putLookupCache(env, cacheKey, value) {
  await env.CALENDAR_CACHE.put(cacheKey, JSON.stringify(value));
}

function cacheKeyForLookup(name) {
  return `${LOOKUP_CACHE_PREFIX}${name}`;
}

function minimalLookupEntry(kind, item) {
  if (kind === "teacher") {
    return {
      id: item.id,
      name: item.name
    };
  }

  if (kind === "group") {
    return {
      id: item.id,
      name: item.name,
      teachers: Array.isArray(item.teachers)
        ? item.teachers.map((teacher) => ({
            id: teacher.id,
            name: teacher.name
          }))
        : []
    };
  }

  if (kind === "room") {
    return {
      id: item.id,
      name: item.name,
      note: item.note ?? ""
    };
  }

  return item;
}

function collectLookupIds(lessons) {
  const teacherIds = new Set();
  const groupIds = new Set();
  const roomIds = new Set();

  for (const lesson of lessons) {
    for (const id of lesson.teacher_ids ?? []) {
      if (id !== null && id !== undefined && `${id}` !== "") {
        teacherIds.add(Number(id));
      }
    }

    for (const id of lesson.group_ids ?? []) {
      if (id !== null && id !== undefined && `${id}` !== "") {
        groupIds.add(Number(id));
      }
    }

    if (lesson.room_id !== null && lesson.room_id !== undefined && `${lesson.room_id}` !== "") {
      roomIds.add(Number(lesson.room_id));
    }
  }

  return {
    teacherIds,
    groupIds,
    roomIds
  };
}

async function ensureLookupEntries(env, kind, resourcePath, requiredIds) {
  const cacheKey = cacheKeyForLookup(kind);
  const cache = await getLookupCache(env, cacheKey);
  const missingIds = [...requiredIds].filter((id) => !cache[String(id)]);

  if (!missingIds.length) {
    return cache;
  }

  const items = await fetchIndexItems(env, resourcePath);
  const nextCache = { ...cache };
  for (const item of items) {
    if (item?.id !== undefined && item?.id !== null) {
      nextCache[String(item.id)] = minimalLookupEntry(kind, item);
    }
  }

  await putLookupCache(env, cacheKey, nextCache);
  return nextCache;
}

function indexById(items) {
  const map = new Map();
  for (const item of items) {
    if (item?.id !== undefined && item?.id !== null) {
      map.set(Number(item.id), item);
    }
  }
  return map;
}

function cloneLesson(lesson) {
  return JSON.parse(JSON.stringify(lesson));
}

export async function enrichLessons(env, lessons) {
  const branchId = getBranchId(env);
  const { teacherIds, groupIds, roomIds } = collectLookupIds(lessons);

  const [teacherCache, groupCache, roomCache] = await Promise.all([
    ensureLookupEntries(env, "teacher", `/v2api/${branchId}/teacher/index`, teacherIds),
    ensureLookupEntries(env, "group", `/v2api/${branchId}/group/index`, groupIds),
    ensureLookupEntries(env, "room", `/v2api/${branchId}/room/index`, roomIds)
  ]);

  const teacherById = indexById(Object.values(teacherCache));
  const groupById = indexById(Object.values(groupCache));
  const roomById = indexById(Object.values(roomCache));

  return lessons.map((sourceLesson) => {
    const lesson = cloneLesson(sourceLesson);
    const primaryGroup = Array.isArray(lesson.group_ids) ? groupById.get(Number(lesson.group_ids[0])) : null;
    const primaryRoom = roomById.get(Number(lesson.room_id));
    const teacherItems = (lesson.teacher_ids ?? [])
      .map((id) => teacherById.get(Number(id)))
      .filter(Boolean);

    if (primaryGroup) {
      lesson.group = primaryGroup;
      lesson.group_name = lesson.group_name || primaryGroup.name;
      if (!teacherItems.length && Array.isArray(primaryGroup.teachers)) {
        teacherItems.push(...primaryGroup.teachers);
      }
    }

    if (primaryRoom) {
      lesson.room = primaryRoom;
      lesson.room_name = lesson.room_name || primaryRoom.name;
      lesson.location_name = lesson.location_name || primaryRoom.note || "";
    }

    if (teacherItems.length) {
      lesson.teachers = teacherItems;
      lesson.teacher_name = lesson.teacher_name || teacherItems.map((item) => item.name).join(", ");
    }

    return lesson;
  });
}

export function getCalendarWindow(env, now = new Date()) {
  const timeZone = requiredEnv(env, "CALENDAR_TIMEZONE");
  const today = formatDateInTimeZone(now, timeZone);
  const daysForward = parseNumber(env.CALENDAR_DAYS_FORWARD, 180);
  return {
    dateFrom: today,
    dateTo: addDays(today, daysForward)
  };
}

export async function fetchScheduledLessons(env, now = new Date()) {
  const branchId = getBranchId(env);
  const { dateFrom, dateTo } = getCalendarWindow(env, now);

  const lessons = [];
  const totals = [];

  for (let page = 0; page < 10_000; page += 1) {
    const payload = await postAlfa(env, `/v2api/${branchId}/lesson/index`, {
      status: 1,
      date_from: dateFrom,
      date_to: dateTo,
      page
    });

    const items = extractLessonItems(payload);
    const total = extractTotalCount(payload);
    if (total !== null) {
      totals.push(total);
    }

    if (!items.length) {
      break;
    }

    lessons.push(...items);

    if (total !== null && lessons.length >= total) {
      break;
    }
  }

  return {
    lessons: await enrichLessons(env, lessons),
    dateFrom,
    dateTo,
    total: totals[totals.length - 1] ?? lessons.length
  };
}
