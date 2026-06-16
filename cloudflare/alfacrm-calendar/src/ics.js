import ical, { ICalCalendarMethod } from "ical-generator";
import { parseApiDateTime, zonedDateTimeToUtc } from "./time.js";

function compact(values) {
  return values.filter((value) => value !== null && value !== undefined && value !== "");
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return "";
}

function readNestedString(container, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], container);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizeList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeList(item));
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  if (typeof value === "number") {
    return [String(value)];
  }

  if (typeof value === "object") {
    const directName = firstNonEmpty(
      value.name,
      value.title,
      value.full_name,
      value.short_name,
      value.fio,
      value.label
    );
    if (directName) {
      return [directName];
    }

    return compact(
      [
        value.first_name,
        value.middle_name,
        value.last_name
      ].map((item) => (typeof item === "string" ? item.trim() : ""))
    )
      .join(" ")
      .trim()
      ? [
          compact([
            value.first_name?.trim?.(),
            value.middle_name?.trim?.(),
            value.last_name?.trim?.()
          ]).join(" ")
        ]
      : [];
  }

  return [];
}

function uniqueJoined(values) {
  return [...new Set(values.flatMap((value) => normalizeList(value)).filter(Boolean))];
}

function extractStartAndEnd(lesson, timeZone) {
  const directStart = parseApiDateTime(
    firstNonEmpty(lesson.start_at, lesson.datetime_from, lesson.date_start, lesson.starts_at),
    timeZone
  );
  const directEnd = parseApiDateTime(
    firstNonEmpty(lesson.end_at, lesson.datetime_to, lesson.date_end, lesson.ends_at),
    timeZone
  );

  if (directStart && directEnd) {
    return { start: directStart, end: directEnd };
  }

  const date = firstNonEmpty(lesson.date, lesson.lesson_date, lesson.day);
  const timeFrom = firstNonEmpty(
    lesson.time_from,
    lesson.time_start,
    lesson.start_time,
    lesson.begin_time
  );
  const timeTo = firstNonEmpty(
    lesson.time_to,
    lesson.time_end,
    lesson.end_time,
    lesson.finish_time
  );

  if (!date || !timeFrom || !timeTo) {
    throw new Error(`Lesson ${lesson.id ?? "unknown"} has no usable date/time fields`);
  }

  return {
    start: zonedDateTimeToUtc(date, `${timeFrom}:00`.slice(0, 8), timeZone),
    end: zonedDateTimeToUtc(date, `${timeTo}:00`.slice(0, 8), timeZone)
  };
}

function buildSummary(lesson) {
  const base = firstNonEmpty(
    lesson.name,
    lesson.title,
    lesson.lesson_name,
    lesson.subject_name,
    lesson.subject,
    lesson.service_name
  ) || `Lesson #${lesson.id ?? "unknown"}`;
  const topic = firstNonEmpty(lesson.topic, lesson.theme, lesson.subject_topic);

  if (topic && topic.toLowerCase() !== base.toLowerCase()) {
    return `${base} - ${topic}`;
  }

  return base;
}

function buildDescription(lesson) {
  const teachers = uniqueJoined([
    lesson.teacher,
    lesson.teachers,
    lesson.employee,
    lesson.employees,
    lesson.staff
  ]);
  const clients = uniqueJoined([
    lesson.client,
    lesson.clients,
    lesson.students,
    lesson.members,
    lesson.attendees
  ]);

  const lines = compact([
    lesson.id ? `Lesson ID: ${lesson.id}` : "",
    firstNonEmpty(lesson.topic, lesson.theme, lesson.subject_topic)
      ? `Topic: ${firstNonEmpty(lesson.topic, lesson.theme, lesson.subject_topic)}`
      : "",
    readNestedString(lesson, ["group.name", "group.title"]) || firstNonEmpty(lesson.group_name, lesson.group_title)
      ? `Group: ${
          readNestedString(lesson, ["group.name", "group.title"]) ||
          firstNonEmpty(lesson.group_name, lesson.group_title)
        }`
      : "",
    teachers.length ? `Teachers: ${teachers.join(", ")}` : "",
    clients.length ? `Clients: ${clients.join(", ")}` : "",
    firstNonEmpty(lesson.note, lesson.comment, lesson.description)
      ? `Comment: ${firstNonEmpty(lesson.note, lesson.comment, lesson.description)}`
      : ""
  ]);

  return lines.join("\n");
}

function buildLocation(lesson) {
  return firstNonEmpty(
    lesson.room_name,
    lesson.location_name,
    lesson.classroom_name,
    lesson.cabinet_name,
    readNestedString(lesson, ["room.name", "location.name", "classroom.name"])
  );
}

function buildLastModified(lesson) {
  return (
    parseApiDateTime(
      firstNonEmpty(lesson.updated_at, lesson.modified_at, lesson.date_update),
      "UTC"
    ) || new Date()
  );
}

export function normalizeLesson(lesson, timeZone) {
  const id = firstNonEmpty(lesson.id, lesson.lesson_id);
  if (!id) {
    throw new Error("Lesson has no id");
  }

  const { start, end } = extractStartAndEnd(lesson, timeZone);
  return {
    id,
    uid: `alfacrm-lesson-${id}@improizh.s20.online`,
    summary: buildSummary(lesson),
    description: buildDescription(lesson),
    location: buildLocation(lesson),
    start,
    end,
    lastModified: buildLastModified(lesson)
  };
}

export function buildCalendarIcs(lessons, generatedAt, timeZone) {
  const calendar = ical({
    name: "IzhImprov AlfaCRM Calendar",
    prodId: {
      company: "IzhImprov",
      product: "AlfaCRM Calendar",
      language: "RU"
    }
  });

  calendar.method(ICalCalendarMethod.PUBLISH);
  calendar.scale("GREGORIAN");

  const normalizedLessons = lessons
    .map((lesson) => normalizeLesson(lesson, timeZone))
    .sort((left, right) => left.start.getTime() - right.start.getTime());

  for (const lesson of normalizedLessons) {
    calendar.createEvent({
      id: lesson.uid,
      uid: lesson.uid,
      start: lesson.start,
      end: lesson.end,
      summary: lesson.summary,
      description: lesson.description || undefined,
      location: lesson.location || undefined,
      stamp: generatedAt,
      lastModified: lesson.lastModified
    });
  }

  return calendar.toString();
}
