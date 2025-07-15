# Novu MCP Server on Cloudflare Workers

A remote Model Context Protocol (MCP) server for [Novu](https://novu.co) - the open-source notification infrastructure platform. This server allows AI assistants to interact with your Novu workspace to manage notifications, subscribers, workflows, and preferences.

## Features

This MCP server provides the following tools for Novu:

- **Notifications**: Get and filter notification events
- **Subscribers**: Find and manage notification subscribers  
- **Workflows**: List and trigger notification workflows
- **Preferences**: Get and update subscriber notification preferences
- **Environments**: Manage Novu environments
- **API Key Management**: Check API key status and configuration


## Configuration

### Novu API Key

You'll need a Novu API Key to use this MCP server. Get one from your [Novu Dashboard](https://web.novu.co/settings).

**Authentication**: Provide your API key using the Authorization header:
```
Authorization: Bearer your-novu-api-key
```

### Server Region

By default, the server connects to the US region (`api.novu.co`). For EU region, add the region parameter:
```
https://novu-mcp-server.<your-account>.workers.dev/sse?NOVU_SERVER_REGION=eu
```
Remember to include the Authorization header with your Bearer token.

## Usage

### Connect to Cloudflare AI Playground

1. Go to https://playground.ai.cloudflare.com/
2. Enter your MCP server URL: `novu-mcp-server.<your-account>.workers.dev/sse`
3. Add the Authorization header: `Authorization: Bearer your-key`
4. Start using Novu tools to manage your notifications!

### Connect to Claude Desktop

Install the [mcp-remote proxy](https://www.npmjs.com/package/mcp-remote) and update your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "novu": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://novu-mcp-server.your-account.workers.dev/sse",
        "--header",
        "Authorization:Bearer your-novu-api-key"
      ]
    }
  }
}
```

For local development:
```json
{
  "mcpServers": {
    "novu": {
      "command": "npx", 
      "args": [
        "mcp-remote",
        "http://localhost:8787/sse",
        "--header",
        "Authorization:Bearer your-novu-api-key"
      ]
    }
  }
}
```

Restart Claude Desktop and the Novu tools will be available.

## Available Tools

- `get_notifications` - Retrieve notifications with filtering by channels, templates, emails, or subscribers
- `find_subscribers` - Search for subscribers by email, name, phone, or subscriber ID
- `get_workflows` - List all notification workflows in your Novu workspace
- `trigger_workflow` - Trigger a workflow with subscriber data and payload
- `get_subscriber_preferences` - Get notification preferences for a subscriber
- `update_subscriber_preferences` - Update notification preferences for a subscriber
- `get_environments` - List all environments in your Novu workspace
- `get_api_key_status` - Check API key configuration and server region

## Development

To customize the MCP server, modify the tools in `src/tools/` and update the server initialization in `src/index.ts`.

## Security Note

This server runs without authentication beyond the Novu API key. Ensure you:
- Keep your Novu API key secure
- Only deploy to trusted environments
- Consider adding additional authentication if needed for production use 
