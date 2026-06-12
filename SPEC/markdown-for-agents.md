# Markdown for Agents

## Current state

As of 2026-06-12, `https://izhimpro.ru/` is served directly by GitHub Pages. Cloudflare remains authoritative DNS, but the apex A records are DNS-only.

Requests with `Accept: text/markdown` on the same public URL now return:

- `Content-Type: text/markdown; charset=utf-8`
- `Vary: Accept`
- `x-markdown-tokens` on `GET` responses

This means the site now supports HTTP content negotiation for Markdown at the edge.

## Constraint

GitHub Pages does not allow per-request response negotiation or custom response headers for this use case.

The Cloudflare Worker implementation is retained for dedicated agent endpoints, but it no longer fronts the regular website because that made static delivery unstable in some networks.

## What is implemented here

- `scripts/generate_markdown.py` generates `*.md` sidecar files from the public HTML pages.
- `cloudflare-agent-ready-worker.js` handles dedicated agent endpoints and can proxy repository files when invoked on a Worker route:
  - maps human URLs such as `/faq/` to repo files such as `/faq/index.html`
  - maps Markdown negotiation to sidecars such as `/faq/index.md`
  - adds `Vary: Accept`
  - returns `x-markdown-tokens` on Markdown `GET`
- `scripts/deploy-agent-ready-worker.ps1` deploys the Worker through the Cloudflare API, attaches it only to dedicated agent paths, and keeps `izhimpro.ru/*` as a no-script bypass.
- `scripts/check-markdown-negotiation.ps1` verifies:
  - the live response to `Accept: text/markdown`
  - the default HTML response
  - the published sidecar Markdown URL such as `/faq/index.md`

## Notes

- The Worker origin remains `https://cdn.jsdelivr.net/gh/mislamov/izhimprov.site@main` for Worker-handled requests only.
- This keeps the solution within Cloudflare Free plan constraints.
- DNS `DS` publication for `_agents.izhimpro.ru` remains a separate task and does not affect Markdown negotiation.
