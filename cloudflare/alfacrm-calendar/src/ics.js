import ical, { ICalCalendarMethod } from "ical-generator";
import { isValidDate, parseApiDateTime, zonedDateTimeToUtc } from "./time.js";

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

function extractTeacherNames(lesson) {
  return uniqueJoined([
    lesson.teacher,
    lesson.teachers,
    lesson.employee,
    lesson.employees,
    lesson.staff,
    lesson.teacher_name,
    lesson.group?.teachers,
    lesson.group?.teacher
  ]);
}

function extractGroupName(lesson) {
  return (
    readNestedString(lesson, ["group.name", "group.title"]) ||
    firstNonEmpty(lesson.group_name, lesson.group_title)
  );
}

function extractLessonType(lesson) {
  return firstNonEmpty(lesson.lesson_type_name, lesson.lesson_type, lesson.type_name);
}

function extractTopic(lesson) {
  return firstNonEmpty(lesson.topic, lesson.theme, lesson.subject_topic);
}

function extractStartAndEnd(lesson, timeZone) {
  const lessonId = firstNonEmpty(lesson.id, lesson.lesson_id, "unknown");
  const directStart = parseApiDateTime(
    firstNonEmpty(lesson.start_at, lesson.datetime_from, lesson.date_start, lesson.starts_at),
    timeZone
  );
  const directEnd = parseApiDateTime(
    firstNonEmpty(lesson.end_at, lesson.datetime_to, lesson.date_end, lesson.ends_at),
    timeZone
  );

  if (directStart && directEnd) {
    if (!isValidDate(directStart) || !isValidDate(directEnd)) {
      throw new Error(`Lesson ${lessonId} has invalid direct datetime values`);
    }
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
    throw new Error(`Lesson ${lessonId} has no usable date/time fields`);
  }

  const embeddedStart = parseEmbeddedDateTime(timeFrom, timeZone);
  const embeddedEnd = parseEmbeddedDateTime(timeTo, timeZone);

  const start = embeddedStart ?? zonedDateTimeToUtc(date, normalizeClockTime(timeFrom), timeZone);
  const end = embeddedEnd ?? zonedDateTimeToUtc(date, normalizeClockTime(timeTo), timeZone);

  if (!isValidDate(start) || !isValidDate(end)) {
    throw new Error(
      `Lesson ${lessonId} has invalid local date/time values: date=${date}, from=${timeFrom}, to=${timeTo}`
    );
  }

  return { start, end };
}

function normalizeClockTime(value) {
  const raw = `${value ?? ""}`.trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return raw;
  }

  return `${match[1].padStart(2, "0")}:${match[2]}:${match[3] ?? "00"}`;
}

function parseEmbeddedDateTime(value, timeZone) {
  const raw = `${value ?? ""}`.trim();
  if (!raw) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(raw)) {
    return null;
  }

  return parseApiDateTime(raw, timeZone);
}

function buildSummary(lesson) {
  const topic = extractTopic(lesson);
  if (topic) {
    return topic;
  }

  const lessonType = extractLessonType(lesson);
  const teacherNames = extractTeacherNames(lesson);
  const shortTeacher = teacherNames[0]
    ? teacherNames[0]
        .split(/\s+/)
        .slice(0, 2)
        .join(" ")
    : "";

  if (lessonType && shortTeacher) {
    return `${lessonType} • ${shortTeacher}`;
  }

  if (lessonType) {
    return lessonType;
  }

  return teacherNames[0] || "Lesson";
}

function buildDescription(lesson) {
  const teachers = extractTeacherNames(lesson);
  const clients = uniqueJoined([
    lesson.client,
    lesson.clients,
    lesson.students,
    lesson.members,
    lesson.attendees
  ]);

  const groupName = extractGroupName(lesson);
  const lessonType = extractLessonType(lesson);

  const lines = compact([
    teachers.length ? `Преподаватель: ${teachers.join(", ")}` : "",
    groupName ? `Группа: ${groupName}` : "",
    clients.length ? `Участники: ${clients.join(", ")}` : "",
    lessonType ? `Тип занятия: ${lessonType}` : ""
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
  const parsed = parseApiDateTime(
    firstNonEmpty(lesson.updated_at, lesson.modified_at, lesson.date_update),
    "UTC"
  );
  return isValidDate(parsed) ? parsed : new Date();
}

export function normalizeLesson(lesson, timeZone) {
  const id = firstNonEmpty(lesson.id, lesson.lesson_id);
  if (!id) {
    throw new Error("Lesson has no id");
  }

  const { start, end } = extractStartAndEnd(lesson, timeZone);
  if (end.getTime() <= start.getTime()) {
    throw new Error(`Lesson ${id} has non-positive duration`);
  }

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
