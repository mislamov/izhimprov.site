const ORIGIN_BASE = "https://cdn.jsdelivr.net/gh/mislamov/izhimprov.site@main";
const DISCOVERY_LINKS = [
  '<https://izhimpro.ru/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '<https://izhimpro.ru/.well-known/agents-index.json>; rel="alternate"; type="application/json"; title="DNS-AID organization index"',
  '<https://izhimpro.ru/.well-known/site-description.json>; rel="describedby"; type="application/json"',
  '<https://izhimpro.ru/.well-known/service-desc.json>; rel="service-desc"; type="application/openapi+json"',
  '<https://izhimpro.ru/faq/>; rel="service-doc"; type="text/html"'
];

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const wantsMarkdown = method === "GET" || method === "HEAD"
    ? acceptsMarkdown(request.headers.get("Accept"))
    : false;

  if (wantsMarkdown) {
    const markdownPath = toMarkdownPath(url.pathname);
    if (markdownPath) {
      const markdownResponse = await fetchOrigin(request, markdownPath, url.search);
      if (markdownResponse.ok) {
        return toMarkdownResponse(markdownResponse, method);
      }
    }
  }

  const originPath = toOriginPath(url.pathname);
  const originResponse = await fetchOrigin(request, originPath, url.search);
  return decorateResponse(originResponse, originPath);
}

function acceptsMarkdown(acceptHeader) {
  if (!acceptHeader) {
    return false;
  }

  return acceptHeader
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .some((value) => value.startsWith("text/markdown"));
}

function toMarkdownPath(pathname) {
  if (pathname.endsWith(".md")) {
    return pathname;
  }

  if (pathname === "/") {
    return "/index.md";
  }

  if (pathname.endsWith("/")) {
    return `${pathname}index.md`;
  }

  if (pathname.endsWith(".html")) {
    return pathname.slice(0, -5) + ".md";
  }

  if (!pathname.includes(".")) {
    return `${pathname}/index.md`;
  }

  return null;
}

async function fetchOrigin(request, pathname, search) {
  const targetUrl = `${ORIGIN_BASE}${pathname}${search}`;
  const proxiedRequest = new Request(targetUrl, request);
  return fetch(proxiedRequest, {
    cf: {
      cacheEverything: false
    }
  });
}

function toOriginPath(pathname) {
  if (pathname === "/") {
    return "/index.html";
  }

  if (pathname.endsWith("/")) {
    return `${pathname}index.html`;
  }

  if (pathname.startsWith("/.well-known/")) {
    return pathname;
  }

  if (!pathname.includes(".")) {
    return `${pathname}/index.html`;
  }

  return pathname;
}

async function toMarkdownResponse(originResponse, method) {
  const headers = new Headers(originResponse.headers);
  const markdownHeaders = decorateHeaders(headers);
  markdownHeaders.set("Content-Type", "text/markdown; charset=utf-8");
  markdownHeaders.delete("Content-Length");

  if (method === "HEAD") {
    return new Response(null, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: markdownHeaders
    });
  }

  const markdownText = await originResponse.text();
  markdownHeaders.set("x-markdown-tokens", String(estimateTokens(markdownText)));

  return new Response(markdownText, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: markdownHeaders
  });
}

function decorateResponse(originResponse, originPath) {
  return new Response(originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: decorateHeaders(originResponse.headers, originPath)
  });
}

function decorateHeaders(sourceHeaders, originPath) {
  const headers = new Headers(sourceHeaders);
  mergeVary(headers, "Accept");
  normalizeContentType(headers, originPath);

  const existingLinks = splitLinkHeader(headers.get("Link"));
  const combinedLinks = [...existingLinks];
  for (const linkValue of DISCOVERY_LINKS) {
    if (!combinedLinks.includes(linkValue)) {
      combinedLinks.push(linkValue);
    }
  }
  headers.set("Link", combinedLinks.join(", "));

  headers.set("X-Agent-Ready-Proxy", "izhimpro-edge-v1");
  return headers;
}

function mergeVary(headers, token) {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", token);
    return;
  }

  const values = current
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!values.some((value) => value.toLowerCase() === token.toLowerCase())) {
    values.push(token);
    headers.set("Vary", values.join(", "));
  }
}

function estimateTokens(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return 0;
  }

  return normalized.split(" ").length;
}

function normalizeContentType(headers, originPath) {
  if (!originPath) {
    return;
  }

  if (originPath.endsWith(".html")) {
    headers.set("Content-Type", "text/html; charset=utf-8");
    return;
  }

  if (originPath === "/.well-known/api-catalog") {
    headers.set("Content-Type", 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"; charset=utf-8');
    return;
  }

  if (originPath.endsWith(".json")) {
    if (originPath.endsWith("form-service-status.json")) {
      headers.set("Content-Type", "application/health+json; charset=utf-8");
      return;
    }

    headers.set("Content-Type", "application/json; charset=utf-8");
    return;
  }

  if (originPath.endsWith(".xml")) {
    headers.set("Content-Type", "application/xml; charset=utf-8");
    return;
  }

  if (originPath.endsWith(".txt")) {
    headers.set("Content-Type", "text/plain; charset=utf-8");
  }
}

function splitLinkHeader(linkHeader) {
  if (!linkHeader) {
    return [];
  }

  return linkHeader
    .split(/,\s*(?=<)/)
    .map((value) => value.trim())
    .filter(Boolean);
}
