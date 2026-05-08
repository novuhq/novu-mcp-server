import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ValidationUtils } from '../utils/validation';
import { NovuApiUtils } from '../utils/api';
import type { ServerRegion } from '../types/index';
import { describe } from "node:test";

export function registerEnvironmentTools(
	server: McpServer, 
	getApiKey: () => string | null, 
	getServerRegion: () => ServerRegion
) {
	// Get all environments from Novu API
	server.tool(
		"get_environments",
		"Get all environments from your Novu application with their details and API keys",
		{
			idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
		},
		async ({ idempotencyKey }) => {
			// Validate API key first
			const apiKeyError = ValidationUtils.validateApiKey(getApiKey());
			if (apiKeyError) {
				return apiKeyError;
			}

			try {
				console.log("Fetching environments from Novu API...");
				
				const response = await fetch(`${NovuApiUtils.getBaseUrl(getServerRegion())}/v1/environments`, {
					method: "GET",
					headers: NovuApiUtils.prepareHeaders(getApiKey()!, idempotencyKey)
				});

				return await NovuApiUtils.handleApiResponse(response, "fetched environments");

			} catch (error) {
				console.error("Error fetching environments:", error);
				return {
					content: [{ 
						type: "text" as const, 
						text: `Error: Failed to fetch environments. ${error instanceof Error ? error.message : 'Unknown error'}` 
					}],
				};
			}
		}
	);
} 