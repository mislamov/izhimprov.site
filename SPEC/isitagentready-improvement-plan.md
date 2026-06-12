# isitagentready Improvement Plan

Date: 2026-06-12

## Goal

Increase the `isitagentready.com` score while preserving reliable public site loading in the current network conditions.

The site must stay usable for normal visitors. No score improvement is acceptable if it brings back intermittent `net::ERR_CONNECTION_CLOSED`, long browser loads, or static asset body download timeouts.

## Baseline

Observed on 2026-06-12:

- Score: `71/100`
- Level: `2` (`Bot-Aware`)
- Discoverability: `3/4`
- Content: `0/1`
- Bot Access Control: `2/2`
- API, Auth, MCP & Skill Discovery: `5/7`
- Commerce: not checked

## Realistic Ceiling Without Proxying

Conservative score expectation while keeping the apex site DNS-only:

- Phase 1 may recover one API/Auth point if `/auth.md` is accepted.
- Phases 2, 3, and 5 are expected to add `0` direct scanner points, though they can improve real-agent usability and metadata quality.
- Phase 7 may recover one WebMCP point if implemented inline and detected.
- The Content `0/1` Markdown Negotiation point is not realistically reachable on the apex site without an edge or hosting layer that can vary the homepage by `Accept: text/markdown`.

Expected practical range:

- Conservative static-only work: about `73-75`.
- With successful inline WebMCP: about `76-78`.
- Higher scores likely require routing or response-header capabilities that are currently rejected by the stability constraints.

Production routing baseline:

- `izhimpro.ru` apex is DNS-only in Cloudflare.
- Apex `A` records point directly to GitHub Pages.
- Normal website responses should come from `Server: GitHub.com`.
- Broad Worker route `izhimpro.ru/*` must remain a no-script bypass.

## Global Guardrails

Do not use these approaches without a separate rollback-ready experiment:

- Re-enable Cloudflare proxy on the apex site.
- Attach Worker logic to `izhimpro.ru/*`.
- Proxy normal pages or assets through `cdn.jsdelivr.net`, GitHub raw URLs, Workers, or another intermediate CDN.
- Rewrite homepage HTML at the edge for all visitors.

Allowed by default:

- Static repository files served by GitHub Pages.
- Static `.well-known` discovery documents.
- Small HTML changes committed to the site.
- DNS-AID records that do not alter web traffic routing.
- Cloudflare Free plan DNS-only features.

## Performance Gate

Run this gate before and after every phase:

1. DNS must resolve `izhimpro.ru` to GitHub Pages IPs, not Cloudflare proxy IPs:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
2. `GET https://izhimpro.ru/` must return `200` and `Server: GitHub.com`.
3. Homepage HTML must not include `X-Agent-Ready-Proxy`.
4. Browser navigation to `https://izhimpro.ru/?perf-check=<commit>` must complete without timeout.
5. No console errors for site-owned static assets.
6. These static assets must return `200` without body download timeout:
   - `/assets/css/styles.css`
   - `/assets/js/mobile-nav.js`
   - `/assets/js/analytics.js`
   - `/assets/img/logo_tr.png`
   - `/assets/img/home-format-try.jpg`
   - `/assets/img/home-format-course.jpg`
   - `/assets/img/home-format-corporate.jpg`
   - `/assets/img/polina.jpg`
   - `/assets/img/marat.jpg`
7. If any gate fails, revert the phase before continuing.

## Phase 1: Recover `auth.md`

Expected score impact:

- API, Auth, MCP & Skill Discovery should improve from `5/7` to `6/7`.

Change:

- Publish a tracked root `auth.md` file as a normal static GitHub Pages file.
- Keep the content aligned with `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`.
- Do not rely on Worker routes for `/auth.md`.

Verification:

- `GET https://izhimpro.ru/auth.md` returns `200`.
- Record the exact `Content-Type`. GitHub Pages may serve `.md` as `text/plain` rather than `text/markdown`.
- If the scanner requires `Content-Type: text/markdown`, do not add a proxy just for this point; document the failed check and leave the static file in place only if it is useful for real agents.
- Run the performance gate.
- Rescan `https://isitagentready.com/izhimpro.ru`.

Rollback:

- Revert the `auth.md` addition if it causes unexpected routing or content issues.

Risk:

- Low. This is a static file only.

## Phase 2: Improve API Catalog Content Type Without Proxying

Expected score impact:

- May improve scanner quality signals, although the current scanner already counts API Catalog as passing.

Current issue:

- `/.well-known/api-catalog` returns valid JSON but `Content-Type: application/octet-stream` from GitHub Pages.

Preferred change:

- Add `/.well-known/api-catalog.json` with the same content and `application/json` GitHub Pages content type.
- If compatible with the scanner and specs, update discovery references to prefer the `.json` file.
- Keep the existing `/.well-known/api-catalog` for backward compatibility.

Verification:

- `GET /.well-known/api-catalog.json` returns `200 application/json`.
- Existing `GET /.well-known/api-catalog` still returns valid JSON.
- Run the performance gate.
- Rescan.

Rollback:

- Revert only the new JSON alias and references.

Risk:

- Low. Static `.well-known` files only.

## Phase 3: Static Link Discovery in HTML

Expected score impact:

- Expected direct `isitagentready` score impact: `0`.
- This phase is for real agents and crawlers that parse HTML. It should not be treated as a replacement for HTTP `Link:` response headers.

Change:

- Add conservative `<link>` elements in `<head>` for public discovery documents:
  - `/.well-known/api-catalog`
  - `/.well-known/agents-index.json`
  - `/.well-known/site-description.json`
  - `/.well-known/service-desc.json`
  - `/.well-known/mcp/server-card.json`
  - `/.well-known/agent-card.json`
  - `/.well-known/agent-skills/index.json`
  - `/auth.md`

Constraints:

- Do not add JavaScript.
- Do not inject via Worker.
- Do not add blocking external resources.

Verification:

- Homepage remains visually unchanged.
- Browser navigation remains stable.
- Run the performance gate.
- Rescan and record whether the `Link headers` score changes, but assume it will not. If it does not, keep the links only if they are useful for real agents and harmless.

Rollback:

- Remove the `<link>` additions if they cause scanner confusion or unwanted SEO behavior.

Risk:

- Low to medium. HTML-only, but scanner may not count it.

## Phase 4: DNS-AID Dedicated Protocol Records (Blocked Until Stable Targets Exist)

Expected score impact:

- Current direct score impact: `0`, because stable direct HTTP targets do not exist for `/a2a` and `/mcp`.
- Later, Discoverability may improve from `3/4` to `4/4` if the missing point is related to dedicated `_a2a` or `_mcp` records.

Current scanner detail:

- `_index._agents.izhimpro.ru` HTTPS exists and passes.
- `_a2a._agents.izhimpro.ru` returns NXDOMAIN.
- `_mcp._agents.izhimpro.ru` returns NXDOMAIN.

Change:

- Later: add DNS-AID HTTPS records for dedicated protocol entrypoints only if the corresponding HTTP endpoints are real and stable.
- Because the apex is DNS-only and `/a2a` and `/mcp` are currently Worker-only concepts, do not publish records pointing to broken `https://izhimpro.ru/a2a` or `https://izhimpro.ru/mcp`.

Safe prerequisite:

- First make static or direct GitHub Pages-compatible endpoint documents available, or choose stable `.well-known` URLs that already return `200`.

Verification:

- DNS-over-HTTPS returns expected HTTPS records with AD=true.
- Target HTTP URLs return `200` directly from GitHub Pages or another stable non-proxy route.
- Run the performance gate.
- Rescan.

Rollback:

- Remove the new DNS-AID records if targets do not pass.

Risk:

- Medium. DNS changes can outlive HTTP experiments and confuse scanners.

## Phase 5: Markdown Access Without Content Negotiation

Expected score impact:

- May not improve the `Content 0/1` check, because the scanner explicitly tests `Accept: text/markdown` on `/`.
- Still useful for real agents.

Change:

- Keep static Markdown sidecars such as `/index.md`, `/faq/index.md`, and page-level Markdown files.
- Advertise Markdown URLs from static discovery documents.
- Do not attempt response negotiation on the apex unless using a proven non-proxy hosting layer.

Verification:

- Markdown sidecars return `200`.
- Normal pages remain unchanged.
- Run the performance gate.

Risk:

- Low.

## Phase 6: Markdown Negotiation Experiment Only in a Test Hostname

Expected score impact:

- Could restore `Content 1/1`, but this is the same class of feature that previously required edge logic.

Change:

- Create a non-production test hostname, for example `agent-test.izhimpro.ru`.
- Put Worker-based Markdown negotiation only on that test hostname.
- Do not route `izhimpro.ru/*` through the Worker.
- Test from multiple networks before considering production.

Promotion criteria:

- Browser load is stable across repeated runs.
- Static files never show connection closures.
- No normal asset request goes through `cdn.jsdelivr.net` from Worker code.
- Rollback is one DNS or route change.

Production rule:

- Do not promote this to the apex site unless it passes the performance gate repeatedly and the implementation does not proxy normal assets.

Risk:

- High. Treat as an experiment, not a planned production step.

## Phase 7: WebMCP Without Edge Injection

Expected score impact:

- Could recover the WebMCP point if implemented directly in the static HTML.

Change:

- If WebMCP remains strategically useful, add the required browser-side registration directly to `index.html`.
- Keep the script inline or local.
- Do not use Worker-side injection.
- Do not load external WebMCP dependencies.

Verification:

- Browser console has no errors.
- `isitagentready` detects WebMCP.
- Run the performance gate.

Risk:

- Medium. It changes runtime JavaScript on the homepage.

## Recommended Order

1. Phase 1: publish static `auth.md`.
2. Phase 2: add JSON alias for API catalog if useful.
3. Phase 3: add static HTML discovery links if harmless.
4. Rescan and stop if the score is acceptable.
5. Phase 7 only if WebMCP is truly useful to users or agents.
6. Phase 4 only after stable direct targets exist.
7. Phase 6 only on a test hostname.

## Stop Condition

Stop improving the scanner score when the next available point requires broad proxying, edge HTML rewriting for all traffic, or any routing change that moves normal website delivery away from direct GitHub Pages.
