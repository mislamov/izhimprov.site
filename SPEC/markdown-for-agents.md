# Markdown for Agents

## Current state

As of 2026-06-12, `https://izhimpro.ru/` is served directly by GitHub Pages. Cloudflare remains authoritative DNS, but the apex A records are DNS-only.

Requests with `Accept: text/markdown` on the same public URL currently return normal GitHub Pages HTML. Markdown negotiation on the apex site is intentionally disabled because the broad Worker route that provided it made static delivery unstable in some networks.

## Constraint

GitHub Pages does not allow per-request response negotiation or custom response headers for this use case.

The Cloudflare Worker implementation is retained for dedicated agent endpoints, but it no longer fronts the regular website because that made static delivery unstable in some networks.

## What is implemented here

- `scripts/generate_markdown.py` generates `*.md` sidecar files from the public HTML pages.
- Pages with `<meta name="markdown-generation" content="manual">` retain their hand-written Markdown sidecar. The generator requires that file to exist and never replaces it. Use this for concise agent instructions that differ from the rendered HTML.
- Refresh a brand kit's local `assets.json` after changing its files with `python scripts/generate_brand_assets.py <kit-directory> <public-kit-url>`. This catalogs direct files and CSS tokens without adding the kit to public navigation or agent discovery. Text-file checksums and sizes use the LF bytes published by Git. The script requires Pillow for raster dimensions.
- `cloudflare-agent-ready-worker.js` handles dedicated agent endpoints and can proxy repository files when invoked on a Worker route:
  - maps human URLs such as `/faq/` to repo files such as `/faq/index.html`
  - maps Markdown negotiation to sidecars such as `/faq/index.md`
  - adds `Vary: Accept`
  - returns `x-markdown-tokens` on Markdown `GET`
- `scripts/deploy-agent-ready-worker.ps1` deploys the Worker through the Cloudflare API, attaches it only to dedicated agent paths, and keeps `izhimpro.ru/*` as a no-script bypass.
- `scripts/check-markdown-negotiation.ps1` is historical for the broad Worker implementation. Do not use it as a deployment gate while the apex site is DNS-only.

## Notes

- The Worker origin remains `https://cdn.jsdelivr.net/gh/mislamov/izhimprov.site@main` for Worker-handled requests only.
- This keeps the solution within Cloudflare Free plan constraints.
- DNS `DS` publication for `_agents.izhimpro.ru` remains a separate task and does not affect Markdown negotiation.
- See `SPEC/agent-readiness-balance.md` for the current operating balance between scanner score and public site stability.
