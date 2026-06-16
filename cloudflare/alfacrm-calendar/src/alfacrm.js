import { addDays, formatDateInTimeZone } from "./time.js";

const AUTH_CACHE_KEY = "calendar:alfacrm:auth";
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
    lessons,
    dateFrom,
    dateTo,
    total: totals[totals.length - 1] ?? lessons.length
  };
}
