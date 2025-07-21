# Novu MCP Server

A Model Context Protocol (MCP) server for [Novu](https://novu.co) - the open-source notification infrastructure platform. This server allows AI assistants to interact with your Novu workspace to manage notifications, subscribers, workflows, and preferences.

## Features

This MCP server provides the following tools for Novu:

- **Notifications**: Get and filter notification events with detailed execution logs
- **Subscribers**: Find and manage notification subscribers  
- **Workflows**: List, inspect, and trigger notification workflows
- **Preferences**: Get and update subscriber notification preferences for all channels
- **Environments**: Manage and view Novu environments
- **API Key Management**: Check API key status and server region configuration

## Configuration

### Novu API Key

You'll need a Novu API Key to use this MCP server. Get one from your [Novu Dashboard](https://web.novu.co/settings).

**Authentication**: Provide your API key using the Authorization header:
```
Authorization: Bearer your-novu-api-key
```

### Server Region

The server supports both US and EU regions. Use the region parameter to specify your preferred region:

**US Region** (default if no parameter specified):
```
# Streamable HTTPS/MCP
https://mcp.novu.co/?region=us

# SSE (Deprecated)  
https://mcp.novu.co/sse?region=us
```

**EU Region:**
```
# Streamable HTTPS/MCP
https://mcp.novu.co/?region=eu

# SSE (Deprecated)
https://mcp.novu.co/sse?region=eu
```

**Note**: If no region parameter is provided, the server defaults to the US region (`api.novu.co`). For EU region, it connects to `eu.api.novu.co`.

Remember to include the Authorization header with your Bearer token.

## Connection Methods

This MCP server supports two connection methods:

### 🚀 **Streamable HTTPS/MCP (Recommended)**
The modern, efficient connection method using direct MCP protocol over HTTPS.

### ⚠️ **SSE (Server-Sent Events) - Deprecated**
The legacy connection method using Server-Sent Events. This method is deprecated and may be removed in future versions.

## Usage

### Connect to Claude Desktop

#### Method 1: Streamable HTTPS/MCP (Recommended)

Install the [mcp-remote proxy](https://www.npmjs.com/package/mcp-remote) and update your Claude Desktop configuration:

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

For local development:
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

#### Method 2: SSE (Deprecated)

```json
{
  "mcpServers": {
    "novu": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.novu.co/sse",
        "--header",
        "Authorization:Bearer your-novu-api-key"
      ]
    }
  }
}
```

Restart Claude Desktop and the Novu tools will be available.

### Connect to Other MCP Clients

For other MCP clients that support remote servers:

#### Streamable HTTPS/MCP (Recommended)
- **US Region**: `https://mcp.novu.co/` or `https://mcp.novu.co/?region=us`
- **EU Region**: `https://mcp.novu.co/?region=eu`
- **Authorization Header**: `Authorization: Bearer your-novu-api-key`

#### SSE (Deprecated)
- **US Region**: `https://mcp.novu.co/sse` or `https://mcp.novu.co/sse?region=us`
- **EU Region**: `https://mcp.novu.co/sse?region=eu`
- **Authorization Header**: `Authorization: Bearer your-novu-api-key`

## Available Tools

- `get_api_key_status` - Check the current API key status and server region configuration
- `get_environments` - Get all environments from your Novu application with their details and API keys
- `get_notifications` - Get notifications/events from Novu with advanced filtering options by channels, templates, emails, subscribers, dates, and more
- `get_notification` - Get a specific notification by ID with detailed execution logs, status, and delivery information
- `find_subscribers` - Search for subscribers using various query parameters like email, name, phone number, or subscriber ID
- `get_subscriber_preferences` - Get subscriber notification preferences for all channels (email, SMS, in-app, push, chat) across all workflows and global settings
- `update_subscriber_preferences` - Update subscriber notification preferences for specific channels (email, SMS, in-app, push, chat) either globally or for a specific workflow
- `get_workflows` - Get all available workflows from your Novu application with their basic information and identifiers
- `get_workflow` - Get detailed information about a specific workflow including its steps, channels, payload structure, and configuration
- `trigger_workflow` - Trigger a workflow to send notifications to a subscriber with custom payload data

## Development

### Local Development

1. Clone this repository
2. Install dependencies: `pnpm install`
3. Start the development server: `pnpm start`
4. The server will be available at `http://localhost:8787`

### Customization

To customize the MCP server:
- Modify tools in `src/tools/` directories
- Update server initialization in `src/index.ts`
- Add new API endpoints or modify existing ones in `src/server/NovuMCP.ts`

## Security Notes

- Keep your Novu API key secure and never commit it to version control
- The server validates API keys before making requests to Novu
- All requests include proper error handling and validation
- Consider implementing rate limiting for production deployments 
