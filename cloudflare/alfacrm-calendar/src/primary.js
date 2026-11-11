import { addDays, formatDateInTimeZone } from './time.js';

export async function fetchScheduledLessons(env, now = new Date()) {
  const base = new URL(env.PRIMARY_CRM_URL);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost', 'crm'].includes(base.hostname))) {
    throw new Error('Private CRM HTTPS URL required');
  }
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Invalid private CRM URL');
  }
  if (!env.PRIMARY_CRM_CALENDAR_TOKEN || env.PRIMARY_CRM_CALENDAR_TOKEN.length < 32) {
    throw new Error('Private calendar credential required');
  }
  const days = Number(env.CALENDAR_DAYS_FORWARD || 180);
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('Invalid calendar window');
  const dateFrom = formatDateInTimeZone(now, 'Europe/Samara');
  const dateTo = addDays(dateFrom, days);
  const response = await fetch(new URL('/api/ext/integration/calendar.events', base), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${env.PRIMARY_CRM_CALENDAR_TOKEN}`, 'X-CRM-UI': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ date_from: dateFrom, date_to: dateTo })
  });
  if (!response.ok) throw new Error(`Private CRM HTTP ${response.status}`);
  const { result } = await response.json();
  if (!result || result.incomplete || !Array.isArray(result.items) || result.total !== result.items.length) {
    throw new Error('Incomplete private calendar');
  }
  // Defense in depth: never pass contacts, participant IDs or notes to ICS/debug.
  const fields = ['id', 'calendar_uid', 'date', 'time_from', 'time_to', 'status', 'version', 'updated_at', 'lesson_type_name'];
  const lessons = result.items.map(row => {
    if (typeof row.calendar_uid !== 'string' || !/^(alfacrm|crm)-lesson-[a-zA-Z0-9_-]+@(?:improizh\.s20\.online|crm\.izhimpro\.ru)$/.test(row.calendar_uid)) {
      throw new Error('Invalid stable calendar UID');
    }
    return Object.fromEntries(fields.filter(key => row[key] !== undefined).map(key => [key, row[key]]));
  });
  return { lessons, dateFrom, dateTo, total: result.total };
}
