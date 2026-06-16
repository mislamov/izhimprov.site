# auth.md

## Agent access overview

This site exposes public, unauthenticated website content and a public lead submission API for trial lessons, courses, and corporate workshop requests.

## Audience

AI agents that need to:

- read public information about improvisation classes in Izhevsk
- discover legal and contact information
- submit a lead request on behalf of a user with the user's consent

## Public resources

- Site description: https://izhimpro.ru/.well-known/site-description.json
- Agents index: https://izhimpro.ru/.well-known/agents-index.json
- API catalog: https://izhimpro.ru/.well-known/api-catalog.json
- Legacy API catalog URL: https://izhimpro.ru/.well-known/api-catalog
- Lead form service description: https://izhimpro.ru/.well-known/service-desc.json
- MCP server card: https://izhimpro.ru/.well-known/mcp/server-card.json
- A2A agent card: https://izhimpro.ru/.well-known/agent-card.json
- Agent skills index: https://izhimpro.ru/.well-known/agent-skills/index.json

## Authentication model

Public website content is readable without authentication.

Lead form submission is currently available as a public endpoint intended for user-authorized contact requests. Agents must only submit requests that reflect a real user's intent and contact details.

There is no self-service OAuth client onboarding at this time. For protected or higher-trust integrations, request access manually through:

- https://izhimpro.ru/contacts/
- mailto:info@izhimpro.ru

## Allowed agent actions

1. Read public pages and Markdown sidecars.
2. Read legal, contact, and schedule information.
3. Submit a lead request for a user via the published lead form API.

## Registration and provisioning

Manual review is required for any future protected integration, delegated access, or non-public automation.

## Agent registration

- registration method: manual review
- register_uri: https://izhimpro.ru/contacts/
- identity_types_supported: anonymous
- credential_types_supported: none
- claim_uri: https://izhimpro.ru/contacts/
- agent_auth metadata: https://izhimpro.ru/.well-known/oauth-authorization-server

Include in your request:

- organization or agent name
- intended use case
- operator contact
- requested scopes or actions
- expected traffic pattern

## Credential use

Do not invent user consent. Do not submit synthetic leads. Do not use the public form endpoint for bulk traffic or automated spam.
