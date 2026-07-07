import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
// Import all tool registration functions
import { registerAuthTools } from "../tools/auth";
import { registerEnvironmentTools } from "../tools/environments";
import { registerIntegrationTools } from "../tools/integrations";
import { registerNotificationTools } from "../tools/notifications";
import { registerPreferenceTools } from "../tools/preferences";
import { registerSubscriberTools } from "../tools/subscribers";
import { registerWorkflowTools } from "../tools/workflows";

/**
 * Per-session credentials handed off by the worker via `ctx.props` (the
 * McpAgent channel for exactly this — never URL params, which leak into logs).
 * The token may be a Clerk OAuth access token (oat_...) or a legacy Novu API key.
 * `apiUrl` is the Novu API base URL for this deployment's region; `region` is
 * the display label surfaced by `whoami`.
 */
export type NovuProps = {
	token: string | null;
	apiUrl: string;
	region: string;
};

export class NovuMCP extends McpAgent<Env, unknown, NovuProps> {
	server = new McpServer({
		name: "Novu MCP Server",
		version: "1.0.0",
	});

	async init() {
		console.log("Novu MCP Server initializing...");
		this.registerAllTools();
		console.log("All Novu tools registered successfully");
	}

	private getToken = (): string | null => {
		return this.props?.token ?? null;
	};

	private getApiUrl = (): string => {
		return this.props?.apiUrl ?? "https://api.novu.co";
	};

	private getRegion = (): string => {
		return this.props?.region ?? "us";
	};

	private registerAllTools() {
		// Register all tools with getter functions
		registerAuthTools(this.server, this.getToken, this.getApiUrl, this.getRegion);
		registerWorkflowTools(this.server, this.getToken, this.getApiUrl);
		registerEnvironmentTools(this.server, this.getToken, this.getApiUrl);
		registerSubscriberTools(this.server, this.getToken, this.getApiUrl);
		registerNotificationTools(this.server, this.getToken, this.getApiUrl);
		registerPreferenceTools(this.server, this.getToken, this.getApiUrl);
		registerIntegrationTools(this.server, this.getToken, this.getApiUrl);
	}
}
