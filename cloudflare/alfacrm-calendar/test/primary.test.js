import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchScheduledLessons } from '../src/primary.js';
import { buildCalendarIcs, normalizeLesson } from '../src/ics.js';
import { syncCalendar, handleCalendar } from '../src/index.js';

const env = { PRIMARY_CRM_URL:'https://crm.example.test', PRIMARY_CRM_CALENDAR_TOKEN:'synthetic-token'.padEnd(40,'x') };
const row = { id:77, calendar_uid:'alfacrm-lesson-77@improizh.s20.online', date:'2026-11-04',
  time_from:'19:00',time_to:'21:00',status:1,version:1,lesson_type_name:'Гостевое событие',
  updated_at:'2026-11-01T00:00:00Z',customer_ids:[123],note:'SECRET_NOTE',clients:['SECRET_CLIENT'],phone:'SECRET_PHONE' };

test('private primary fetch strips private fields and uses the calendar credential only', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(String(url), 'https://crm.example.test/api/ext/integration/calendar.events');
    assert.equal(options.headers.Authorization,'Bearer '+env.PRIMARY_CRM_CALENDAR_TOKEN);
    assert.equal(options.redirect,'error');
    assert.deepEqual(JSON.parse(options.body),{date_from:'2026-11-04',date_to:'2027-05-03'});
    return Response.json({result:{items:[row],total:1,incomplete:false}});
  });
  const {lessons} = await fetchScheduledLessons(env,new Date('2026-11-03T22:00:00Z'));
  assert.equal(lessons.length,1);
  const ics = buildCalendarIcs(lessons,new Date(),'Europe/Samara');
  assert.doesNotMatch(JSON.stringify(lessons)+ics,/SECRET_|customer_ids|phone/);
  assert.match(ics,/UID:alfacrm-lesson-77@improizh.s20.online/);
  assert.match(ics,/20261104T150000Z/);
});

test('moves and cancellations keep UID, local clients have distinct namespace', () => {
  const first = normalizeLesson(row,'Europe/Samara');
  const moved = {...row,date:'2026-11-05',status:2,version:2};
  const second = normalizeLesson(moved,'Europe/Samara');
  assert.equal(first.uid,second.uid);
  assert.equal(second.start.toISOString(),'2026-11-05T15:00:00.000Z');
  const ics = buildCalendarIcs([moved],new Date(),'Europe/Samara');
  assert.match(ics,/STATUS:CANCELLED/);
  assert.doesNotMatch(ics,/SECRET_/);
  assert.equal(normalizeLesson({...row,calendar_uid:'crm-lesson-2000001@crm.izhimpro.ru'},'Europe/Samara').uid,
    'crm-lesson-2000001@crm.izhimpro.ru');
});

test('incomplete data and redirects never replace a known good cache', async t => {
  const writes = [];
  t.mock.method(globalThis,'fetch',async () => Response.json({result:{items:[],total:null,incomplete:true}}));
  const runtime = {...env,CALENDAR_CACHE:{put:(...args)=>writes.push(args)}};
  await assert.rejects(syncCalendar(runtime),/Incomplete/);
  assert.deepEqual(writes,[]);
});

test('new primary cache cannot publish an old private Alfa calendar', async () => {
  const runtime = {CALENDAR_SECRET:'synthetic-feed-token',CALENDAR_CACHE:{get:async key => key==='calendar:alfacrm:ics'?'SECRET_CLIENT':null}};
  const response = await handleCalendar(new Request('https://calendar.example.test/calendar/crm.ics?token=synthetic-feed-token'),runtime);
  assert.equal(response.status,503);
  assert.doesNotMatch(await response.text(),/SECRET_CLIENT/);
});
