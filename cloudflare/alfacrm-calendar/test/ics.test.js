import test from "node:test";
import assert from "node:assert/strict";
import { buildCalendarIcs, normalizeLesson } from "../src/ics.js";
import { zonedDateTimeToUtc } from "../src/time.js";

test("zonedDateTimeToUtc converts Europe/Samara local time to UTC", () => {
  const result = zonedDateTimeToUtc("2026-06-16", "18:30:00", "Europe/Samara");
  assert.equal(result.toISOString(), "2026-06-16T14:30:00.000Z");
});

test("normalizeLesson builds stable UID and times", () => {
  const lesson = normalizeLesson(
    {
      id: 77,
      name: "Improvisation",
      topic: "Scene work",
      date: "2026-06-18",
      time_from: "19:00",
      time_to: "21:00",
      updated_at: "2026-06-10T11:15:00+04:00",
      teacher: { name: "Marat Islamov" },
      room_name: "Hall A"
    },
    "Europe/Samara"
  );

  assert.equal(lesson.uid, "alfacrm-lesson-77@improizh.s20.online");
  assert.equal(lesson.summary, "Improvisation - Scene work");
  assert.equal(lesson.start.toISOString(), "2026-06-18T15:00:00.000Z");
  assert.equal(lesson.end.toISOString(), "2026-06-18T17:00:00.000Z");
});

test("buildCalendarIcs emits required calendar properties", () => {
  const ics = buildCalendarIcs(
    [
      {
        id: 2,
        name: "B lesson",
        date: "2026-06-20",
        time_from: "12:00",
        time_to: "13:00"
      },
      {
        id: 1,
        name: "A lesson",
        date: "2026-06-19",
        time_from: "09:00",
        time_to: "10:30"
      }
    ],
    new Date("2026-06-16T08:00:00.000Z"),
    "Europe/Samara"
  );

  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /VERSION:2.0/);
  assert.match(ics, /METHOD:PUBLISH/);
  assert.match(ics, /CALSCALE:GREGORIAN/);
  assert.match(ics, /PRODID:-\/\/IzhImprov\/\/AlfaCRM Calendar\/\/RU/);

  const indexA = ics.indexOf("UID:alfacrm-lesson-1@improizh.s20.online");
  const indexB = ics.indexOf("UID:alfacrm-lesson-2@improizh.s20.online");
  assert.ok(indexA > -1 && indexB > -1 && indexA < indexB);
});
