import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerRegion } from '../types/index';

export function registerApiKeyTools(
	server: McpServer, 
	getApiKey: () => string | null, 
	getServerRegion: () => ServerRegion
) {
	// Add a tool to check current API key status (for debugging)
	server.tool(
		"get_api_key_status",
		"Check the current API key status and server region configuration",
		{},
		async () => {
			const apiKey = getApiKey();
			const serverRegion = getServerRegion();
			const hasApiKey = apiKey !== null;
			const serverInfo = `Server: ${serverRegion === 'eu' ? 'EU (eu.api.novu.co)' : 'US (api.novu.co)'}`;
			const message = hasApiKey 
				? `API Key is loaded successfully. Length: ${apiKey!.length} characters\n${serverInfo}`
				: `No API Key is loaded. Provide your Novu API key in the Authorization header:\nAuthorization: Bearer your-key\n${serverInfo}`;
			
			console.log("API Key Status Check:", message);
			return {
				content: [{ type: "text" as const, text: message }],
			};
		}
	);
} 