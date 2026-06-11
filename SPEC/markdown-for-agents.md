# Markdown for Agents

## Current state

As of 2026-06-11, `https://izhimpro.ru/` is served by GitHub Pages behind Cloudflare.

Requests with `Accept: text/markdown` on the same public URL now return:

- `Content-Type: text/markdown; charset=utf-8`
- `Vary: Accept`
- `x-markdown-tokens` on `GET` responses

This means the site now supports HTTP content negotiation for Markdown at the edge.

## Constraint

GitHub Pages does not allow per-request response negotiation or custom response headers for this use case.

Because of that, the negotiation is implemented in Cloudflare Worker code instead of the GitHub Pages origin.

## What is implemented here

- `scripts/generate_markdown.py` generates `*.md` sidecar files from the public HTML pages.
- `cloudflare-agent-ready-worker.js` proxies the public site through Cloudflare and:
  - maps human URLs such as `/faq/` to repo files such as `/faq/index.html`
  - maps Markdown negotiation to sidecars such as `/faq/index.md`
  - adds `Vary: Accept`
  - returns `x-markdown-tokens` on Markdown `GET`
- `scripts/deploy-agent-ready-worker.ps1` deploys the Worker through the Cloudflare API and attaches it to `izhimpro.ru/*`.
- `scripts/check-markdown-negotiation.ps1` verifies:
  - the live response to `Accept: text/markdown`
  - the default HTML response
  - the published sidecar Markdown URL such as `/faq/index.md`

## Notes

- The current Worker origin is `https://cdn.jsdelivr.net/gh/mislamov/izhimprov.site@main`.
- This keeps the solution within Cloudflare Free plan constraints.
- DNS `DS` publication for `_agents.izhimpro.ru` remains a separate task and does not affect Markdown negotiation.
