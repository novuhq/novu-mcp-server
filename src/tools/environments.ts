import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NovuApiUtils } from "../utils/api";
import { ValidationUtils } from "../utils/validation";

export function registerEnvironmentTools(
	server: McpServer,
	getToken: () => string | null,
	getApiUrl: () => string,
) {
	// Get all environments from Novu API
	server.tool(
		"get_environments",
		"Get all environments from your Novu application with their details and API keys. Use an environment's _id as the environmentId parameter on other tools to run them against that environment (e.g. Production instead of the default Development).",
		{
			idempotencyKey: z
				.string()
				.optional()
				.describe("Optional idempotency key for the request"),
		},
		async ({ idempotencyKey }) => {
			// Validate API key first
			const authError = ValidationUtils.validateToken(getToken());
			if (authError) {
				return authError;
			}

			try {
				console.log("Fetching environments from Novu API...");

				const response = await fetch(`${getApiUrl()}/v1/environments`, {
					headers: NovuApiUtils.prepareHeaders(getToken()!, { idempotencyKey }),
					method: "GET",
				});

				return await NovuApiUtils.handleApiResponse(response, "fetched environments");
			} catch (error) {
				console.error("Error fetching environments:", error);
				return {
					content: [
						{
							text: `Error: Failed to fetch environments. ${error instanceof Error ? error.message : "Unknown error"}`,
							type: "text" as const,
						},
					],
				};
			}
		},
	);
}
