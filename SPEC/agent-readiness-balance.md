# Agent Readiness vs Site Stability

Date: 2026-06-12

## Goal

Keep the public website reliably usable for people first, while preserving as much `isitagentready.com` compatibility as possible without reintroducing unstable static delivery.

The site must not regain agent-readiness points by putting the whole apex website behind a Cloudflare Worker or another proxy chain that makes ordinary HTML, CSS, JavaScript, or image delivery less reliable in regional or corporate networks.

## Current Production Routing

- `izhimpro.ru` uses Cloudflare as authoritative DNS.
- Apex `A` records are DNS-only and point directly to GitHub Pages:
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- Normal website requests should answer from `Server: GitHub.com`.
- The broad Cloudflare Worker route `izhimpro.ru/*` must remain a no-script bypass unless a separate stability test proves the new route does not cause connection closures or long browser loads.

## Current `isitagentready.com` Result

Checked URL: `https://isitagentready.com/izhimpro.ru`

Observed on 2026-06-12:

- Overall score: `71/100`
- Level: `2` (`Bot-Aware`)
- Discoverability: `3/4`
- Content: `0/1`
- Bot Access Control: `2/2`
- API, Auth, MCP & Skill Discovery: `5/7`
- Commerce: not checked

## Passing Factors

- `robots.txt` exists and is valid.
- `sitemap.xml` exists and is valid.
- DNS-AID is found at `_index._agents.izhimpro.ru` and DNSSEC validation passes in the scanner.
- `/.well-known/api-catalog` exists and contains a valid JSON linkset.
- `/.well-known/oauth-authorization-server` exists and is valid.
- `/.well-known/oauth-protected-resource` exists and is valid.
- `/.well-known/mcp/server-card.json` exists and is valid.
- `/.well-known/agent-skills/index.json` exists and is valid.
- `robots.txt` includes `Content-Signal`.

## Lost Factors After DNS-only Routing

These checks dropped because the apex website no longer runs through the Cloudflare Worker:

- Homepage `Link` headers: failed because GitHub Pages does not emit custom `Link` response headers.
- Markdown negotiation: failed because `Accept: text/markdown` now returns normal `text/html` from GitHub Pages.
- `auth.md`: failed because `/auth.md` is not published as a tracked static root file.
- WebMCP: failed because Worker-side HTML injection is no longer applied to the homepage.

The scanner still passes static `.well-known` discovery files because GitHub Pages can serve them directly from the repository.

## Stability Constraint

Do not restore the previous broad Worker setup just to regain score. The previous model routed ordinary site traffic through:

`browser -> Cloudflare -> Worker -> cdn.jsdelivr.net/GitHub`

That route caused intermittent `net::ERR_CONNECTION_CLOSED`, long browser loads, and timeouts on static resources in the observed environment.

Any future score-improvement change must pass these checks before deployment:

- `https://izhimpro.ru/` opens in a browser without navigation timeout.
- Key static files return `200` without connection closures:
  - `/assets/css/styles.css`
  - `/assets/js/mobile-nav.js`
  - `/assets/js/analytics.js`
  - `/assets/img/logo_tr.png`
  - `/assets/img/home-format-try.jpg`
  - `/assets/img/home-format-course.jpg`
  - `/assets/img/home-format-corporate.jpg`
- A repeated GET check for representative images completes without body download timeouts.
- The homepage response for normal browser requests does not include `X-Agent-Ready-Proxy`.

## Safe Score Improvements

Allowed without changing the production routing:

- Publish a tracked root `/auth.md` static file if agent registration documentation is still desired.
- Add or correct static `.well-known` JSON files where GitHub Pages can serve the required content type well enough for the scanner.
- Keep image assets small enough for unstable networks; homepage card images should stay near the current `35-46 KB` JPEG range unless there is a strong visual reason.

Risky unless separately justified and tested:

- Re-enabling Cloudflare proxy on apex.
- Re-attaching Worker logic to `izhimpro.ru/*`.
- Fetching normal site content through `cdn.jsdelivr.net` or any third-party CDN inside a Worker.
- Injecting WebMCP by rewriting all homepage HTML at the edge.

## Operating Target

The preferred operating point in the current network conditions is:

- working public site first;
- direct GitHub Pages delivery for ordinary pages and static assets;
- static discovery documents where possible;
- no broad HTML or asset proxying;
- accept Level 2 / score around 70 if the alternative is unstable site loading.

