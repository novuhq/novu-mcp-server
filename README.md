<div align="center">
  <a href="https://novu.co?utm_source=github" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/2233092/213641039-220ac15f-f367-4d13-9eaf-56e79433b8c1.png">
    <img alt="Novu Logo" src="https://user-images.githubusercontent.com/2233092/213641043-3bbb3f21-3c53-4e67-afe5-755aeb222159.png" width="280"/>
  </picture>
  </a>
</div>

<br/>

<p align="center">
  <a href="https://www.producthunt.com/products/novu">
    <img src="https://img.shields.io/badge/Product%20Hunt-Golden%20Kitty%20Award%202023-yellow" alt="Product Hunt">
  </a>
  <a href="https://news.ycombinator.com/item?id=38419513"><img src="https://img.shields.io/badge/Hacker%20News-%231-%23FF6600" alt="Hacker News"></a>
  <a href="https://www.npmjs.com/package/@novu/js">
    <img src="https://img.shields.io/npm/dm/@novu/js" alt="npm downloads">
  </a>
</p>

<h1 align="center">Novu MCP Server</h1>

<div align="center">
The Model Context Protocol (MCP) server for Novu — bring AI assistants directly into your notification workflows. Manage subscribers, trigger workflows, inspect events, and tune preferences from any MCP-compatible client.
</div>

<p align="center">
  <br />
  <a href="https://github.novu.co?utm_campaign=gh_org_profile&utm_source=github" rel="dofollow"><strong>Visit our main GitHub Repository »</strong></a>
  <br />
</p>

# Novu MCP Server

## ✨ Features

A single MCP server that unlocks your entire Novu workspace for AI agents:

- **Notifications** — fetch and filter events with full execution logs and delivery status
- **Subscribers** — search and manage recipients by email, phone, name, or ID
- **Workflows** — list, inspect, create, update, and trigger notification workflows
- **Preferences** — read and update subscriber channel preferences (email, SMS, in-app, push, chat)
- **Environments** — view environments and their configuration
- **Integrations** — manage provider integrations across channels
- **API Key Management** — verify API key status and active region

## 🚀 Quick Start

You don't need to host anything — the server is fully managed at `mcp.novu.co`.

**Prerequisites:** A Novu account and API key from your [Novu Dashboard](https://web.novu.co/settings).

```bash
# Ready to go — just point your MCP client at:
https://mcp.novu.co/
```

Authenticate with a standard bearer token:

The server supports US, EU, and a Local region for pointing at a self-hosted Novu API. Use the region parameter to specify your preferred region:

**US Region** (default if no parameter specified):
```
Authorization: Bearer <your-novu-api-key>
```

## 🌍 Regions

The server supports both Novu Cloud regions. Pass the region as a query parameter:

| Region | Endpoint                        |
| ------ | ------------------------------- |
| US (default) | `https://mcp.novu.co/?region=us` |
| EU     | `https://mcp.novu.co/?region=eu` |

**Local Region** (points the MCP server at a local Novu API running on `http://localhost:3000`):
```
# Streamable HTTPS/MCP
http://localhost:8787/?region=local

# SSE (Deprecated)
http://localhost:8787/sse?region=local
```

**Note**: If no region parameter is provided, the server defaults to the US region (`api.novu.co`). For EU region, it connects to `eu.api.novu.co`. The `local` region targets `http://localhost:3000` and is intended for development against a self-hosted Novu API — it only works when this MCP server is run locally via `pnpm start` (Wrangler's default local mode), since Cloudflare's edge runtime cannot reach your machine's localhost.

If no `region` is provided, the server defaults to US (`api.novu.co`). The EU region proxies to `eu.api.novu.co`.

## 🛠️ Usage

The server speaks the Streamable HTTP MCP transport at `https://mcp.novu.co/`.

### Claude Desktop

Install the [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) proxy and add the following to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "novu": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.novu.co/",
        "--header",
        "Authorization:Bearer your-novu-api-key"
      ]
    }
  }
}
```

For the EU region, swap the URL for `https://mcp.novu.co/?region=eu`.

Restart Claude Desktop — the Novu tools will appear automatically.

### Cursor, Windsurf & other MCP clients

Any client that supports remote MCP servers can connect directly:

- **URL:** `https://mcp.novu.co/` (add `?region=eu` for EU)
- **Header:** `Authorization: Bearer your-novu-api-key`

For clients that only support stdio transports, use `mcp-remote` as shown in the Claude Desktop example above.

## 📦 Available Tools

| Tool | Description |
| ---- | ----------- |
| `get_api_key_status` | Check the current API key status and active region |
| `get_environments` | List all environments with their details and API keys |
| `get_notifications` | Fetch events with filtering by channel, template, subscriber, date, and more |
| `get_notification` | Get a specific notification with detailed execution logs |
| `find_subscribers` | Search subscribers by email, name, phone, or ID |
| `get_subscriber_preferences` | Get a subscriber's preferences across all channels and workflows |
| `update_subscriber_preferences` | Update a subscriber's channel preferences globally or per workflow |
| `get_workflows` | List all workflows with their basic information |
| `get_workflow` | Get a workflow's full definition, steps, and payload schema |
| `trigger_workflow` | Trigger a workflow for a subscriber with a custom payload |
| `get_integrations` | List configured provider integrations across channels |

## 💻 Local Development

**Prerequisites:** [Node.js](https://nodejs.org/) 20+ and [pnpm](https://pnpm.io/installation).

```bash
# Clone and install
git clone https://github.com/novuhq/novu-mcp-server.git
cd novu-mcp-server
pnpm install

# Start the local worker
pnpm dev
```

The server runs at [http://localhost:8787](http://localhost:8787). Point your MCP client at it the same way you would the hosted version:

```json
{
  "mcpServers": {
    "novu": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8787/",
        "--header",
        "Authorization:Bearer your-novu-api-key"
      ]
    }
  }
}
```

For local development against a **self-hosted Novu API** on `http://localhost:3000`, add `?region=local`:
```json
{
  "mcpServers": {
    "novu-local": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8787/?region=local",
        "--header",
        "Authorization:Bearer your-local-novu-api-key"
      ]
    }
  }
}
```

#### Method 2: SSE (Deprecated)

- `pnpm dev` — Run the worker locally via Wrangler
- `pnpm deploy` — Deploy to Cloudflare Workers
- `pnpm type-check` — Run TypeScript type checking
- `pnpm lint:fix` — Fix linter issues with Biome
- `pnpm format` — Format the codebase with Biome

### Project structure

```
src/
├── index.ts            # Worker entry — auth extraction and routing
├── server/NovuMCP.ts   # Durable Object hosting the MCP agent
├── tools/              # One file per tool group (workflows, subscribers, …)
├── utils/              # API client, validation, tool factory
└── types/              # Shared TypeScript types
```

Add new tools by creating a `register*Tools` function under `src/tools/` and wiring it in `src/server/NovuMCP.ts`.

## 🔒 Security

- Your API key is passed via the `Authorization` header on every request — it is never stored server-side.
- All outbound requests to the Novu API are authenticated with the caller's key; the server holds no ambient credentials.
- Never commit API keys. Use `.dev.vars` for local secrets (already gitignored).
- Treat your Novu API key like a password — rotate it from the dashboard if you suspect it has been exposed.

## 🤝 Contributing

1. **Make Changes**

   ```bash
   git checkout -b feat/your-change
   pnpm dev           # Test locally
   pnpm type-check    # Verify types
   git commit -m "feat: your change"
   git push origin feat/your-change
   ```

2. **Open a Pull Request**
   - Use a descriptive title with `feat:`, `fix:`, `docs:`, or `chore:` prefix
   - Include a short description of the change and, where relevant, a sample tool call

**Guidelines:**

- Keep tool descriptions concise — they are surfaced verbatim to LLMs
- Validate inputs with Zod schemas in `src/utils/`
- Prefer the `ToolFactory` helpers for standard CRUD endpoints
- Something missing? Open a [GitHub issue](https://github.com/novuhq/novu-mcp-server/issues)

**Need help?** Email us at support@novu.co or join the [Discord](https://discord.novu.co).

---

Thank you for contributing! 🙏
