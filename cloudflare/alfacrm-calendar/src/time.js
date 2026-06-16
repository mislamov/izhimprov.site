const DATE_PARTS_FORMATTER_CACHE = new Map();

export function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function getFormatter(timeZone) {
  if (!DATE_PARTS_FORMATTER_CACHE.has(timeZone)) {
    DATE_PARTS_FORMATTER_CACHE.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      })
    );
  }

  return DATE_PARTS_FORMATTER_CACHE.get(timeZone);
}

function partsToObject(parts) {
  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }
  return values;
}

export function formatDateInTimeZone(date, timeZone) {
  const values = partsToObject(getFormatter(timeZone).formatToParts(date));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getOffsetMilliseconds(instant, timeZone) {
  const values = partsToObject(getFormatter(timeZone).formatToParts(instant));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return asUtc - instant.getTime();
}

export function zonedDateTimeToUtc(dateString, timeString, timeZone) {
  const normalizedTime = `${timeString ?? "00:00:00"}`.trim();
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes, seconds = "00"] = normalizedTime.split(":");

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(Number(hours)) ||
    !Number.isFinite(Number(minutes)) ||
    !Number.isFinite(Number(seconds))
  ) {
    return new Date(Number.NaN);
  }

  let guess = Date.UTC(
    year,
    month - 1,
    day,
    Number(hours),
    Number(minutes),
    Number(seconds)
  );

  for (let index = 0; index < 3; index += 1) {
    const offset = getOffsetMilliseconds(new Date(guess), timeZone);
    const nextGuess =
      Date.UTC(
        year,
        month - 1,
        day,
        Number(hours),
        Number(minutes),
        Number(seconds)
      ) - offset;

    if (nextGuess === guess) {
      break;
    }

    guess = nextGuess;
  }

  return new Date(guess);
}

export function parseApiDateTime(value, fallbackTimeZone) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    return isValidDate(date) ? date : null;
  }

  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?$/
  );
  if (match) {
    return zonedDateTimeToUtc(
      match[1],
      `${match[2]}:${match[3] ?? "00"}`,
      fallbackTimeZone
    );
  }

  const parsed = new Date(trimmed);
  return isValidDate(parsed) ? parsed : null;
}
