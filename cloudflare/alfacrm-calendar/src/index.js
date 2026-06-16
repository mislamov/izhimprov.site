import { fetchScheduledLessons } from "./alfacrm.js";
import { buildCalendarIcs } from "./ics.js";

const ICS_KEY = "calendar:alfacrm:ics";
const META_KEY = "calendar:alfacrm:meta";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function safeSecretEquals(provided, expected) {
  if (!provided || !expected) {
    return false;
  }

  const [left, right] = await Promise.all([sha256(provided), sha256(expected)]);
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}

function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/[A-Za-z0-9_-]{20,}/g, "[redacted-secret]");
}

async function syncCalendar(env, now = new Date()) {
  const generatedAt = new Date();
  const timeZone = env.CALENDAR_TIMEZONE || "Europe/Samara";
  const { lessons, dateFrom, dateTo, total } = await fetchScheduledLessons(env, now);
  const ics = buildCalendarIcs(lessons, generatedAt, timeZone);

  const meta = {
    status: "ok",
    generated_at: generatedAt.toISOString(),
    date_from: dateFrom,
    date_to: dateTo,
    lesson_count: lessons.length,
    total_hint: total,
    last_error: null
  };

  await env.CALENDAR_CACHE.put(ICS_KEY, ics);
  await env.CALENDAR_CACHE.put(META_KEY, JSON.stringify(meta));
  return meta;
}

async function recordSyncFailure(env, error) {
  const previous = (await env.CALENDAR_CACHE.get(META_KEY, "json")) || {};
  const next = {
    ...previous,
    status: "error",
    last_error: sanitizeError(error),
    last_attempt_at: new Date().toISOString()
  };
  await env.CALENDAR_CACHE.put(META_KEY, JSON.stringify(next));
}

async function handleHealth(env) {
  const meta = (await env.CALENDAR_CACHE.get(META_KEY, "json")) || {};
  const hasCalendar = Boolean(await env.CALENDAR_CACHE.get(ICS_KEY));

  return jsonResponse({
    ok: true,
    calendar_ready: hasCalendar,
    sync_status: meta.status || "never-run",
    generated_at: meta.generated_at || null,
    last_attempt_at: meta.last_attempt_at || meta.generated_at || null,
    lesson_count: meta.lesson_count ?? null,
    last_error: meta.last_error || null
  });
}

async function handleCalendar(request, env) {
  const url = new URL(request.url);
  const providedToken = url.searchParams.get("token");
  const expectedToken = env.CALENDAR_SECRET;

  if (!(await safeSecretEquals(providedToken, expectedToken))) {
    return new Response("Forbidden", {
      status: 403,
      headers: {
        "Cache-Control": "no-cache"
      }
    });
  }

  const [ics, meta] = await Promise.all([
    env.CALENDAR_CACHE.get(ICS_KEY),
    env.CALENDAR_CACHE.get(META_KEY, "json")
  ]);

  if (!ics) {
    return jsonResponse(
      {
        ok: false,
        error: "Calendar is not ready yet"
      },
      503
    );
  }

  const headers = new Headers({
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": "no-cache, max-age=300"
  });

  if (meta?.generated_at) {
    headers.set("X-Calendar-Generated-At", meta.generated_at);
  }
  if (meta?.status === "error") {
    headers.set("X-Calendar-Stale", "1");
  }

  return new Response(ics, {
    status: 200,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return handleHealth(env);
    }

    if (request.method === "GET" && url.pathname === "/calendar/alfacrm.ics") {
      return handleCalendar(request, env);
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller, env) {
    try {
      await syncCalendar(env);
    } catch (error) {
      console.error("Calendar sync failed:", sanitizeError(error));
      await recordSyncFailure(env, error);
      throw error;
    }
  }
};

export { handleCalendar, handleHealth, recordSyncFailure, sanitizeError, syncCalendar };
