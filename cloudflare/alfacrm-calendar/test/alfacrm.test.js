import test from "node:test";
import assert from "node:assert/strict";
import { enrichLessons, extractLessonItems, extractTotalCount } from "../src/alfacrm.js";

test("extractLessonItems handles direct items array", () => {
  const payload = { items: [{ id: 1 }, { id: 2 }], total: 2 };
  assert.equal(extractLessonItems(payload).length, 2);
  assert.equal(extractTotalCount(payload), 2);
});

test("extractLessonItems handles nested data.model array", () => {
  const payload = {
    data: {
      model: [{ id: 1 }],
      total: "1"
    }
  };

  assert.deepEqual(extractLessonItems(payload), [{ id: 1 }]);
  assert.equal(extractTotalCount(payload), 1);
});

test("enrichLessons uses KV cache and fetches lookups only for missing ids", async () => {
  const cache = new Map([
    [
      "calendar:alfacrm:auth",
      JSON.stringify({
        token: "cached-token",
        expiresAt: Date.now() + 60 * 60 * 1000
      })
    ],
    [
      "calendar:lookup:teacher",
      JSON.stringify({
        "2": { id: 2, name: "Исламов Марат Шамилевич" }
      })
    ],
    [
      "calendar:lookup:group",
      JSON.stringify({
        "1": {
          id: 1,
          name: "Эластичный Перепеч",
          teachers: [{ id: 2, name: "Исламов Марат Шамилевич" }]
        }
      })
    ],
    [
      "calendar:lookup:room",
      JSON.stringify({})
    ]
  ]);

  const fetchCalls = [];
  globalThis.fetch = async (url) => {
    fetchCalls.push(String(url));
    return new Response(
      JSON.stringify({
        items: [{ id: 2, name: "Советская", note: "" }]
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  };

  const env = {
    ALFACRM_BASE_URL: "https://improizh.s20.online",
    ALFACRM_BRANCH_ID: "1",
    CALENDAR_CACHE: {
      async get(key, type) {
        const value = cache.get(key) ?? null;
        return type === "json" && value ? JSON.parse(value) : value;
      },
      async put(key, value) {
        cache.set(key, value);
      }
    }
  };

  const [lesson] = await enrichLessons(env, [
    {
      id: 80,
      group_ids: [1],
      teacher_ids: [2],
      room_id: 2
    }
  ]);

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0], /\/v2api\/1\/room\/index$/);
  assert.equal(lesson.group_name, "Эластичный Перепеч");
  assert.equal(lesson.teacher_name, "Исламов Марат Шамилевич");
  assert.equal(lesson.room_name, "Советская");
  assert.equal(lesson.clients, undefined);
});
