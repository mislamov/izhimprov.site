# Markdown for Agents

## Current state

As of 2026-06-11, `https://izhimpro.ru/` is served by GitHub Pages/Fastly.

Requests with `Accept: text/markdown` still return:

- `Content-Type: text/html; charset=utf-8`
- no `x-markdown-tokens`

This means the site does not currently support HTTP content negotiation for Markdown.

## Constraint

GitHub Pages does not allow per-request response negotiation or custom response headers for this use case.

Because of that, this repository can prepare Markdown sidecar documents, but it cannot make the same URL return Markdown based on `Accept: text/markdown` while it is hosted on GitHub Pages.

## What is implemented here

- `scripts/generate_markdown.py` generates `*.md` sidecar files from the public HTML pages.
- `scripts/check-markdown-negotiation.ps1` verifies:
  - the live response to `Accept: text/markdown`
  - the default HTML response
  - the published sidecar Markdown URL such as `/faq/index.md`

## Full compliance path

To fully satisfy Markdown negotiation, move the site behind a host or proxy that can inspect `Accept` and return:

- `Content-Type: text/markdown`
- `Vary: Accept`
- `x-markdown-tokens` when available

Cloudflare `Markdown for Agents` is the shortest path once the zone is proxied through Cloudflare.
