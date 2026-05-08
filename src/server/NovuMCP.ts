import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerRegion } from '../types';

// Import all tool registration functions
import { registerApiKeyTools } from '../tools/api-key';
import { registerWorkflowTools } from '../tools/workflows';
import { registerEnvironmentTools } from '../tools/environments';
import { registerSubscriberTools } from '../tools/subscribers';
import { registerNotificationTools } from '../tools/notifications';
import { registerPreferenceTools } from '../tools/preferences';
import { registerIntegrationTools } from '../tools/integrations';

// Store the current request URL for parameter access
let currentRequestUrl: string | null = null;

export class NovuMCP extends McpAgent {
	server = new McpServer({
		name: "Novu MCP Server",
		version: "1.0.0",
	});

	async init() {
		console.log("Novu MCP Server initializing...");
		this.registerAllTools();
		console.log("All Novu tools registered successfully");
	}

	// Override fetch to capture the current request URL for parameter access
	async fetch(request: Request) {
		currentRequestUrl = request.url;
		return super.fetch(request);
	}

	// Getter functions for tools - use URL parameters
	private getApiKey = (): string | null => {
		if (currentRequestUrl) {
			const url = new URL(currentRequestUrl);
			return url.searchParams.get('novu_api_key');
		}
		return null;
	};

	private getServerRegion = (): ServerRegion => {
		if (currentRequestUrl) {
			const url = new URL(currentRequestUrl);
			const urlRegion = url.searchParams.get('novu_region');
			if (urlRegion === 'eu' || urlRegion === 'us' || urlRegion === 'local') {
				return urlRegion;
			}
		}
		return 'us'; // Default fallback
	};

	private registerAllTools() {
		// Register all tools with getter functions
		registerApiKeyTools(this.server, this.getApiKey, this.getServerRegion);
		registerWorkflowTools(this.server, this.getApiKey, this.getServerRegion);
		registerEnvironmentTools(this.server, this.getApiKey, this.getServerRegion);
		registerSubscriberTools(this.server, this.getApiKey, this.getServerRegion);
		registerNotificationTools(this.server, this.getApiKey, this.getServerRegion);
		registerPreferenceTools(this.server, this.getApiKey, this.getServerRegion);
		registerIntegrationTools(this.server, this.getApiKey, this.getServerRegion);
	}
} 