# AlfaCRM Calendar Worker

This Worker publishes a private, read-only ICS feed for Google Calendar subscriptions.

It does two things:

- runs hourly on Cloudflare Cron Triggers;
- reads scheduled lessons from AlfaCRM REST API v2 and stores a ready `.ics` file in Cloudflare KV.

The public endpoint only serves the last successful ICS snapshot from KV. It does not write anything back to AlfaCRM and does not use Google Calendar API.

## Why it is read-only

The Worker performs only two AlfaCRM API operations:

- `POST /v2api/auth/login`
- `POST /v2api/{branch}/lesson/index`

There are no create, update, delete, or side-effect calls. Google Calendar is connected only through `Add calendar by URL`, so Google reads the feed and the Worker never pushes events into Google through API.

## Endpoints

- `GET /health`
- `GET /calendar/alfacrm.ics?token=<secret>`

If `token` is missing or invalid, the Worker returns `403`.

## Required configuration

Worker vars in `wrangler.toml`:

- `ALFACRM_BASE_URL=https://improizh.s20.online`
- `ALFACRM_BRANCH_ID=1`
- `CALENDAR_DAYS_FORWARD=180`
- `CALENDAR_TIMEZONE=Europe/Samara`

Worker secrets:

- `ALFACRM_EMAIL`
- `ALFACRM_API_KEY`
- `CALENDAR_SECRET`

KV namespace binding:

- `CALENDAR_CACHE`

## Local development

1. Copy `wrangler.toml.example` to `wrangler.toml`.
2. Create `.dev.vars` from `.dev.vars.example`.
3. Install dependencies:

```bash
npm install
```

4. Start local Worker:

```bash
npm run dev
```

Local healthcheck:

```bash
curl http://127.0.0.1:8787/health
```

Local calendar request:

```bash
curl "http://127.0.0.1:8787/calendar/alfacrm.ics?token=your-secret"
```

The calendar endpoint returns `503` until the first successful sync populates KV. In local dev you can trigger the cron handler from Wrangler dev tools.

## Deploy to Cloudflare

1. Create a KV namespace:

```bash
wrangler kv namespace create CALENDAR_CACHE
wrangler kv namespace create CALENDAR_CACHE --preview
```

2. Put the returned IDs into `wrangler.toml`.
3. Set secrets:

```bash
wrangler secret put ALFACRM_EMAIL
wrangler secret put ALFACRM_API_KEY
wrangler secret put CALENDAR_SECRET
```

4. Deploy:

```bash
npm run deploy
```

5. In Cloudflare DNS / Workers routes, attach the Worker to `calendar.izhimpro.ru/*`.

This design keeps the main website on GitHub Pages untouched. Do not attach this Worker to `izhimpro.ru/*`.

## Google Calendar setup

Google Calendar path:

`Google Calendar -> Other calendars -> + -> From URL`

Paste:

```text
https://calendar.izhimpro.ru/calendar/alfacrm.ics?token=<your-secret>
```

Google Calendar refreshes subscribed ICS feeds on its own schedule. Updates are not immediate and may appear after several minutes or after multiple hours.

## Secret rotation

Rotate `CALENDAR_SECRET` in Cloudflare secrets and replace the URL in Google Calendar with the new one.

## ICS behavior

- Calendar headers:
  - `VERSION:2.0`
  - `PRODID:-//IzhImprov//AlfaCRM Calendar//RU`
  - `CALSCALE:GREGORIAN`
  - `METHOD:PUBLISH`
- UID format:
  - `alfacrm-lesson-{id}@improizh.s20.online`
- Events are sorted by start time.
- UID stays stable between syncs, so Google Calendar should update existing events instead of duplicating them.

## Time handling

The Worker assumes AlfaCRM lesson `date`, `time_from`, and `time_to` are local times in `CALENDAR_TIMEZONE`.

Current default:

- `CALENDAR_TIMEZONE=Europe/Samara`

If AlfaCRM returns ISO timestamps with explicit UTC offset or `Z`, the Worker uses that timestamp directly.

## Cancelled lessons

Current behavior is conservative: the Worker publishes only scheduled lessons with `status=1`.

It does not fetch `status=2` and does not emit `STATUS:CANCELLED` yet. This avoids relying on Google Calendar's less predictable handling of cancellations in subscribed ICS feeds. A cancelled lesson disappears from the feed once it is no longer returned as scheduled by AlfaCRM.

## Error handling

- AlfaCRM requests use HTTP timeouts.
- On sync failure, the Worker keeps the last successful ICS snapshot in KV.
- `/health` exposes sync status and the last sanitized error.
- Secrets, API keys, email, and URL token must not be logged.

## ICS validation

You can validate the generated file with:

- Apple Calendar / Google Calendar subscription import behavior
- generic iCalendar validators
- a direct fetch plus visual inspection:

```bash
curl -i "https://calendar.izhimpro.ru/calendar/alfacrm.ics?token=<secret>"
```
