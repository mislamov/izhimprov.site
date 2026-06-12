const ORIGIN_BASE = "https://cdn.jsdelivr.net/gh/mislamov/izhimprov.site@main";
const AUTH_MD = [
  "# auth.md",
  "",
  "## Agent access overview",
  "",
  "This site exposes public, unauthenticated website content and a public lead submission API for trial lessons, courses, and corporate workshop requests.",
  "",
  "## Audience",
  "",
  "AI agents that need to:",
  "",
  "- read public information about improvisation classes in Izhevsk",
  "- discover legal and contact information",
  "- submit a lead request on behalf of a user with the user's consent",
  "",
  "## Public resources",
  "",
  "- Site description: https://izhimpro.ru/.well-known/site-description.json",
  "- Agents index: https://izhimpro.ru/.well-known/agents-index.json",
  "- API catalog: https://izhimpro.ru/.well-known/api-catalog",
  "- Lead form service description: https://izhimpro.ru/.well-known/service-desc.json",
  "- MCP server card: https://izhimpro.ru/.well-known/mcp/server-card.json",
  "- A2A agent card: https://izhimpro.ru/.well-known/agent-card.json",
  "- Agent skills index: https://izhimpro.ru/.well-known/agent-skills/index.json",
  "",
  "## Authentication model",
  "",
  "Public website content is readable without authentication.",
  "",
  "Lead form submission is currently available as a public endpoint intended for user-authorized contact requests. Agents must only submit requests that reflect a real user's intent and contact details.",
  "",
  "There is no self-service OAuth client onboarding at this time. For protected or higher-trust integrations, request access manually through:",
  "",
  "- https://izhimpro.ru/contacts/",
  "- mailto:info@izhimpro.ru",
  "",
  "## Allowed agent actions",
  "",
  "1. Read public pages and Markdown sidecars.",
  "2. Read legal, contact, and schedule information.",
  "3. Submit a lead request for a user via the published lead form API.",
  "",
  "## Registration and provisioning",
  "",
  "Manual review is required for any future protected integration, delegated access, or non-public automation.",
  "",
  "## Agent registration",
  "",
  "- registration method: manual review",
  "- register_uri: https://izhimpro.ru/contacts/",
  "- identity_types_supported: anonymous",
  "- credential_types_supported: none",
  "- claim_uri: https://izhimpro.ru/contacts/",
  "- agent_auth metadata: https://izhimpro.ru/.well-known/oauth-authorization-server",
  "",
  "Include in your request:",
  "",
  "- organization or agent name",
  "- intended use case",
  "- operator contact",
  "- requested scopes or actions",
  "- expected traffic pattern",
  "",
  "## Credential use",
  "",
  "Do not invent user consent. Do not submit synthetic leads. Do not use the public form endpoint for bulk traffic or automated spam.",
  ""
].join("\n");
const BROWSE_PUBLIC_SITE_SKILL = [
  "# Browse Public Site",
  "",
  "Use this skill to read the public IzhImpro website.",
  "",
  "## What it covers",
  "",
  "- homepage and marketing pages",
  "- Markdown sidecars for public pages",
  "- site discovery documents in `/.well-known/`",
  "- contacts, FAQ, and course information",
  "",
  "## Useful starting points",
  "",
  "- https://izhimpro.ru/",
  "- https://izhimpro.ru/index.md",
  "- https://izhimpro.ru/.well-known/site-description.json",
  "- https://izhimpro.ru/.well-known/agents-index.json",
  "",
  "## Constraints",
  "",
  "- public read-only access only",
  "- do not infer unpublished schedules or prices",
  "- use the published legal pages for legal references",
  ""
].join("\n");
const SUBMIT_LEAD_FORM_SKILL = [
  "# Submit Lead Form",
  "",
  "Use this skill to submit a user-authorized contact request to IzhImpro.",
  "",
  "## Preconditions",
  "",
  "- the user has expressed real intent to contact IzhImpro",
  "- the user has supplied their own contact details",
  "- the request is not bulk, synthetic, or spam traffic",
  "",
  "## API discovery",
  "",
  "- API catalog: https://izhimpro.ru/.well-known/api-catalog",
  "- Service description: https://izhimpro.ru/.well-known/service-desc.json",
  "",
  "## Request shape",
  "",
  "Submit JSON with:",
  "",
  "- `fio`",
  "- `tel`",
  "- `comment`",
  "",
  "## Constraints",
  "",
  "- do not fabricate leads",
  "- do not submit without user consent",
  "- do not use the endpoint for load testing or scraping",
  ""
].join("\n");
const RETRIEVE_LEGAL_INFO_SKILL = [
  "# Retrieve Legal Information",
  "",
  "Use this skill to fetch the public legal documents of IzhImpro.",
  "",
  "## Documents",
  "",
  "- offer: https://izhimpro.ru/legal/offer/",
  "- privacy: https://izhimpro.ru/legal/privacy/",
  "- payment: https://izhimpro.ru/legal/payment/",
  "- archive index: https://izhimpro.ru/legal/offer-archive/",
  "",
  "## Constraints",
  "",
  "- treat archived offers as historical versions",
  "- prefer the current offer URL for the active text",
  "- do not summarize archived versions unless requested",
  ""
].join("\n");
const STATIC_DOCUMENTS = {
  "/auth.md": {
    contentType: "text/markdown; charset=utf-8",
    body: AUTH_MD
  },
  "/.well-known/oauth-protected-resource": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      resource: "https://izhimpro.ru/",
      authorization_servers: [
        "https://izhimpro.ru"
      ],
      scopes_supported: [
        "public-site:read",
        "lead-form:submit"
      ],
      bearer_methods_supported: [
        "header"
      ]
    }, null, 2)
  },
  "/.well-known/oauth-authorization-server": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      issuer: "https://izhimpro.ru",
      service_documentation: "https://izhimpro.ru/auth.md",
      scopes_supported: [
        "public-site:read",
        "lead-form:submit"
      ],
      agent_auth: {
        skill: "https://izhimpro.ru/auth.md",
        register_uri: "https://izhimpro.ru/contacts/",
        claim_uri: "https://izhimpro.ru/contacts/",
        identity_types_supported: [
          "anonymous"
        ],
        anonymous: {
          credential_types_supported: [
            "none"
          ],
          claim_uri: "https://izhimpro.ru/contacts/"
        }
      }
    }, null, 2)
  },
  "/.well-known/mcp/server-card.json": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      serverInfo: {
        name: "IzhImpro Public Site MCP",
        version: "2026-06-11"
      },
      endpoint: "https://izhimpro.ru/mcp",
      capabilities: {
        tools: true,
        resources: true,
        prompts: false
      }
    }, null, 2)
  },
  "/.well-known/agent-card.json": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      name: "IzhImpro Public Agent",
      version: "2026-06-11",
      description: "Agent-facing discovery card for the IzhImpro public website and lead submission workflow.",
      supportedInterfaces: [
        {
          url: "https://izhimpro.ru/a2a",
          transportProtocol: "https"
        }
      ],
      capabilities: [
        "public-site-navigation",
        "course-information",
        "contact-information",
        "legal-information",
        "lead-submission-discovery"
      ],
      skills: [
        {
          id: "browse-public-site",
          name: "Browse public site",
          description: "Read public pages, Markdown sidecars, and discovery documents."
        },
        {
          id: "submit-lead-form",
          name: "Submit lead form",
          description: "Discover and use the public lead form API for user-authorized contact requests."
        },
        {
          id: "retrieve-legal-info",
          name: "Retrieve legal information",
          description: "Read offer, privacy, and payment documents from the public site."
        }
      ]
    }, null, 2)
  },
  "/.well-known/agent-skills/index.json": {
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
      skills: [
        {
          name: "browse-public-site",
          type: "skill-md",
          description: "Read public pages, Markdown sidecars, and discovery documents from the IzhImpro website.",
          url: "https://izhimpro.ru/.well-known/agent-skills/browse-public-site/SKILL.md",
          digest: "sha256:07187be68613956051cba957f77dfe17cef244b369f70b39aeabce03037f4bc4"
        },
        {
          name: "submit-lead-form",
          type: "skill-md",
          description: "Discover and use the public lead form API for user-authorized contact requests.",
          url: "https://izhimpro.ru/.well-known/agent-skills/submit-lead-form/SKILL.md",
          digest: "sha256:37f794863e7b8c7d3594026053be0c171d9880ba4483add6ae442485b52a85a3"
        },
        {
          name: "retrieve-legal-info",
          type: "skill-md",
          description: "Read current and archived public legal documents published on the IzhImpro website.",
          url: "https://izhimpro.ru/.well-known/agent-skills/retrieve-legal-info/SKILL.md",
          digest: "sha256:c10497f3398b3b49ceeb6bbbebe15c0b363693445f5637250a3ac55cd5edb5a4"
        }
      ]
    }, null, 2)
  },
  "/.well-known/agent-skills/browse-public-site/SKILL.md": {
    contentType: "text/markdown; charset=utf-8",
    body: BROWSE_PUBLIC_SITE_SKILL
  },
  "/.well-known/agent-skills/submit-lead-form/SKILL.md": {
    contentType: "text/markdown; charset=utf-8",
    body: SUBMIT_LEAD_FORM_SKILL
  },
  "/.well-known/agent-skills/retrieve-legal-info/SKILL.md": {
    contentType: "text/markdown; charset=utf-8",
    body: RETRIEVE_LEGAL_INFO_SKILL
  }
};
const DISCOVERY_LINKS = [
  '<https://izhimpro.ru/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '<https://izhimpro.ru/.well-known/agents-index.json>; rel="alternate"; type="application/json"; title="DNS-AID organization index"',
  '<https://izhimpro.ru/.well-known/site-description.json>; rel="describedby"; type="application/json"',
  '<https://izhimpro.ru/.well-known/service-desc.json>; rel="service-desc"; type="application/openapi+json"',
  '<https://izhimpro.ru/.well-known/mcp/server-card.json>; rel="alternate"; type="application/json"; title="MCP Server Card"',
  '<https://izhimpro.ru/.well-known/agent-card.json>; rel="alternate"; type="application/json"; title="A2A Agent Card"',
  '<https://izhimpro.ru/.well-known/agent-skills/index.json>; rel="alternate"; type="application/json"; title="Agent Skills Index"',
  '<https://izhimpro.ru/auth.md>; rel="alternate"; type="text/markdown"; title="Auth.md"',
  '<https://izhimpro.ru/faq/>; rel="service-doc"; type="text/html"'
];
const WEB_MCP_SCRIPT = `<script>
(() => {
  const contexts = [document.modelContext, navigator.modelContext]
    .filter((context, index, items) => context && items.indexOf(context) === index);
  if (!contexts.length) {
    return;
  }

  const register = (tool) => {
    for (const context of contexts) {
      if (typeof context.registerTool !== "function") {
        continue;
      }

      try {
        const result = context.registerTool(tool);
        if (result && typeof result.catch === "function") {
          result.catch(() => {});
        }
      } catch {}
    }
  };

  const registerContext = (context) => {
    if (typeof context.provideContext !== "function") {
      return;
    }

    try {
      const result = context.provideContext({
        tools: [
          {
            name: "get_site_overview",
            description: "Return the main public sections of the IzhImpro website for quick navigation.",
            inputSchema: {
              type: "object",
              additionalProperties: false,
              properties: {}
            },
            execute: async () => ({
              organization: "IzhImpro",
              city: "Izhevsk",
              audience: "Adults with or without stage experience",
              sections: [
                { name: "Trial lesson", url: "https://izhimpro.ru/try/" },
                { name: "Course level 1", url: "https://izhimpro.ru/course/level-1/" },
                { name: "Corporate workshops", url: "https://izhimpro.ru/corporate/" },
                { name: "Coaches", url: "https://izhimpro.ru/coaches/" },
                { name: "FAQ", url: "https://izhimpro.ru/faq/" },
                { name: "Contacts", url: "https://izhimpro.ru/contacts/" }
              ]
            })
          },
          {
            name: "get_legal_links",
            description: "Return current public legal document URLs for the IzhImpro website.",
            inputSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                document: {
                  type: "string",
                  enum: ["offer", "privacy", "payment", "rules", "all"]
                }
              }
            },
            execute: async (args = {}) => {
              const links = {
                offer: "https://izhimpro.ru/legal/offer/",
                privacy: "https://izhimpro.ru/legal/privacy/",
                payment: "https://izhimpro.ru/legal/payment/",
                rules: "https://izhimpro.ru/rules/"
              };
              const selected = args.document || "all";
              return selected === "all"
                ? links
                : { document: selected, url: links[selected] || null };
            }
          },
          {
            name: "get_contact_path",
            description: "Return the public contact channel for a real user request to IzhImpro.",
            inputSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                purpose: {
                  type: "string",
                  enum: ["trial", "course", "corporate", "general"]
                }
              }
            },
            execute: async (args = {}) => ({
              purpose: args.purpose || "general",
              contactsPage: "https://izhimpro.ru/contacts/",
              trialPage: "https://izhimpro.ru/try/",
              email: "info@izhimpro.ru"
            })
          }
        ]
      });
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    } catch {}
  };

  for (const context of contexts) {
    registerContext(context);
  }

  register({
    name: "get_site_overview",
    description: "Return the main public sections of the IzhImpro website for quick navigation.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    },
    execute: async () => ({
      organization: "IzhImpro",
      city: "Izhevsk",
      audience: "Adults with or without stage experience",
      sections: [
        { name: "Trial lesson", url: "https://izhimpro.ru/try/" },
        { name: "Course level 1", url: "https://izhimpro.ru/course/level-1/" },
        { name: "Corporate workshops", url: "https://izhimpro.ru/corporate/" },
        { name: "Coaches", url: "https://izhimpro.ru/coaches/" },
        { name: "FAQ", url: "https://izhimpro.ru/faq/" },
        { name: "Contacts", url: "https://izhimpro.ru/contacts/" }
      ]
    })
  });

  register({
    name: "get_legal_links",
    description: "Return current public legal document URLs for the IzhImpro website.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        document: {
          type: "string",
          enum: ["offer", "privacy", "payment", "rules", "all"]
        }
      }
    },
    execute: async (args = {}) => {
      const links = {
        offer: "https://izhimpro.ru/legal/offer/",
        privacy: "https://izhimpro.ru/legal/privacy/",
        payment: "https://izhimpro.ru/legal/payment/",
        rules: "https://izhimpro.ru/rules/"
      };
      const selected = args.document || "all";
      return selected === "all"
        ? links
        : { document: selected, url: links[selected] || null };
    }
  });

  register({
    name: "get_contact_path",
    description: "Return the public contact channel for a real user request to IzhImpro.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        purpose: {
          type: "string",
          enum: ["trial", "course", "corporate", "general"]
        }
      }
    },
    execute: async (args = {}) => ({
      purpose: args.purpose || "general",
      contactsPage: "https://izhimpro.ru/contacts/",
      trialPage: "https://izhimpro.ru/try/",
      email: "info@izhimpro.ru"
    })
  });
})();
</script>`;

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (STATIC_DOCUMENTS[url.pathname]) {
    return staticDocumentResponse(url.pathname, method);
  }

  if (url.pathname === "/mcp") {
    return handleMcpRequest(request, method);
  }

  if (url.pathname === "/a2a") {
    return handleA2aRequest(method);
  }

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
  return decorateResponse(originResponse, originPath, method);
}

async function handleMcpRequest(request, method) {
  if (method === "HEAD") {
    return jsonResponse(null, 200);
  }

  if (method === "GET") {
    return jsonResponse({
      name: "IzhImpro Public Site MCP",
      status: "ok",
      serverCard: "https://izhimpro.ru/.well-known/mcp/server-card.json"
    }, 200);
  }

  if (method !== "POST") {
    return jsonResponse({
      error: "Method not allowed"
    }, 405);
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  const id = payload.id ?? null;
  const rpcMethod = payload.method;

  if (rpcMethod === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: {},
        resources: {}
      },
      serverInfo: {
        name: "IzhImpro Public Site MCP",
        version: "2026-06-11"
      }
    });
  }

  if (rpcMethod === "tools/list") {
    return jsonRpcResult(id, {
      tools: []
    });
  }

  if (rpcMethod === "resources/list") {
    return jsonRpcResult(id, {
      resources: [
        {
          uri: "https://izhimpro.ru/.well-known/site-description.json",
          name: "Site description",
          mimeType: "application/json"
        },
        {
          uri: "https://izhimpro.ru/.well-known/api-catalog",
          name: "API catalog",
          mimeType: "application/linkset+json"
        },
        {
          uri: "https://izhimpro.ru/.well-known/service-desc.json",
          name: "Lead form service description",
          mimeType: "application/openapi+json"
        }
      ]
    });
  }

  if (rpcMethod === "resources/read") {
    const requestedUri = payload.params?.uri;
    const allowedUris = new Set([
      "https://izhimpro.ru/.well-known/site-description.json",
      "https://izhimpro.ru/.well-known/api-catalog",
      "https://izhimpro.ru/.well-known/service-desc.json"
    ]);

    if (!allowedUris.has(requestedUri)) {
      return jsonRpcError(id, -32001, "Resource not found");
    }

    const upstream = await fetch(requestedUri);
    const text = await upstream.text();
    return jsonRpcResult(id, {
      contents: [
        {
          uri: requestedUri,
          mimeType: upstream.headers.get("Content-Type") || "text/plain; charset=utf-8",
          text
        }
      ]
    });
  }

  return jsonRpcError(id, -32601, "Method not found");
}

function handleA2aRequest(method) {
  if (method === "HEAD") {
    return jsonResponse(null, 200);
  }

  if (method === "GET") {
    return jsonResponse({
      card: "https://izhimpro.ru/.well-known/agent-card.json",
      status: "ok"
    }, 200);
  }

  return jsonResponse({
    error: "A2A actions are not implemented on this endpoint yet. Use the published agent card and discovery documents."
  }, 501);
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

async function decorateResponse(originResponse, originPath, method) {
  if (method === "GET" && shouldInjectWebMcp(originResponse, originPath)) {
    const headers = decorateHeaders(originResponse.headers, originPath);
    headers.delete("Content-Length");
    const html = await originResponse.text();
    return new Response(injectWebMcp(html), {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers
    });
  }

  return new Response(originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: decorateHeaders(originResponse.headers, originPath)
  });
}

function shouldInjectWebMcp(originResponse, originPath) {
  return Boolean(originResponse.ok && originPath && originPath.endsWith(".html"));
}

function injectWebMcp(html) {
  if (html.includes("get_site_overview") || html.includes("navigator.modelContext")) {
    return html;
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${WEB_MCP_SCRIPT}</body>`);
  }

  return `${html}${WEB_MCP_SCRIPT}`;
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

  headers.set("X-Agent-Ready-Proxy", "izhimpro-edge-v2");
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

  if (originPath === "/.well-known/oauth-protected-resource") {
    headers.set("Content-Type", "application/json; charset=utf-8");
    return;
  }

  if (originPath === "/.well-known/oauth-authorization-server") {
    headers.set("Content-Type", "application/json; charset=utf-8");
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

function jsonRpcResult(id, result) {
  return jsonResponse({
    jsonrpc: "2.0",
    id,
    result
  }, 200);
}

function jsonRpcError(id, code, message) {
  return jsonResponse({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  }, 200);
}

function jsonResponse(body, status) {
  const headers = decorateHeaders(new Headers(), null);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(body === null ? null : JSON.stringify(body, null, 2), {
    status,
    headers
  });
}

function staticDocumentResponse(pathname, method) {
  const document = STATIC_DOCUMENTS[pathname];
  const headers = decorateHeaders(new Headers(), pathname);
  headers.set("Content-Type", document.contentType);
  return new Response(method === "HEAD" ? null : document.body, {
    status: 200,
    headers
  });
}
