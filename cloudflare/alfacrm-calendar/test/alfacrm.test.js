import test from "node:test";
import assert from "node:assert/strict";
import { extractLessonItems, extractTotalCount } from "../src/alfacrm.js";

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
