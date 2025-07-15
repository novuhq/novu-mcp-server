import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ValidationUtils } from '../utils/validation';
import { NovuApiUtils } from '../utils/api';
import type { ServerRegion, FindSubscribersParams } from '../types/index';

export function registerSubscriberTools(
	server: McpServer, 
	getApiKey: () => string | null, 
	getServerRegion: () => ServerRegion
) {
	// Find subscribers using query parameters from Novu API
	server.tool(
		"find_subscribers",
		"Search for subscribers using various query parameters like email, name, phone number, or subscriber ID",
		{
			email: z.string().optional().describe("Email address to search for"),
			name: z.string().optional().describe("Name to search for"),
			phone: z.string().optional().describe("Phone number to search for"),
			subscriberId: z.string().optional().describe("Subscriber ID to search for"),
			idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
		},
		async ({ email, name, phone, subscriberId, idempotencyKey }) => {
			// Validate API key first
			const apiKeyError = ValidationUtils.validateApiKey(getApiKey());
			if (apiKeyError) {
				return apiKeyError;
			}

			// Check that at least one query parameter is provided
			const params: FindSubscribersParams = { email, name, phone, subscriberId };
			const validationError = ValidationUtils.validateAtLeastOneParam(
				params, 
				['email', 'name', 'phone', 'subscriberId']
			);
			if (validationError) {
				return validationError;
			}

			try {
				// Build query string with only provided parameters
				const queryParams = NovuApiUtils.buildQueryParams(params);
				const queryString = queryParams.toString();
				const url = `${NovuApiUtils.getBaseUrl(getServerRegion())}/v2/subscribers?${queryString}`;

				console.log(`Searching for subscribers with query: ${queryString}`);
				
				const response = await fetch(url, {
					method: "GET",
					headers: NovuApiUtils.prepareHeaders(getApiKey()!, idempotencyKey)
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Novu API Error:", response.status, errorText);
					return {
						content: [{ 
							type: "text" as const, 
							text: `Error: Failed to search subscribers. Status: ${response.status}, Message: ${errorText}` 
						}],
					};
				}

				const data = await response.json();
				console.log("Successfully searched subscribers from Novu API");
				
				return {
					content: [{ 
						type: "text" as const, 
						text: `Successfully found subscribers with query (${queryString}):\n\n${JSON.stringify(data, null, 2)}` 
					}],
				};

			} catch (error) {
				console.error("Error searching subscribers:", error);
				return {
					content: [{ 
						type: "text" as const, 
						text: `Error: Failed to search subscribers. ${error instanceof Error ? error.message : 'Unknown error'}` 
					}],
				};
			}
		}
	);
} 