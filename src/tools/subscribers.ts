import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ValidationUtils } from '../utils/validation';
import { NovuApiUtils } from '../utils/api';
import { ToolFactory } from '../utils/tool-factory';
import type { ServerRegion, FindSubscribersParams } from '../types/index';

const createSubscriberSchema = z.object({
	subscriberId: z.string().describe("Unique identifier for the subscriber, typically the user ID in your system"),
	firstName: z.string().optional().describe("First name of the subscriber"),
	lastName: z.string().optional().describe("Last name of the subscriber"),
	email: z.string().optional().describe("Email address of the subscriber"),
	phone: z.string().optional().describe("Phone number of the subscriber"),
	avatar: z.string().optional().describe("Avatar URL or identifier"),
	locale: z.string().optional().describe("Locale of the subscriber (e.g. 'en-US')"),
	timezone: z.string().optional().describe("Timezone of the subscriber (e.g. 'America/New_York')"),
	data: z.record(z.any()).optional().describe("Additional custom data associated with the subscriber"),
	failIfExists: z.boolean().optional().describe("If true, the request will fail if a subscriber with the same subscriberId already exists. Otherwise it will update the existing subscriber."),
	idempotencyKey: z.string().optional().describe("Optional idempotency key for the request"),
});

export function registerSubscriberTools(
	server: McpServer, 
	getApiKey: () => string | null, 
	getServerRegion: () => ServerRegion
) {
	ToolFactory.createTool(server, getApiKey, getServerRegion, {
		name: "create_subscriber",
		description: "Create a new subscriber with attributes like name, email, phone, and custom data. If the subscriber already exists, it will be updated (unless failIfExists is true).",
		schema: createSubscriberSchema,
		handler: async (input, context) => {
			const { idempotencyKey, failIfExists, ...body } = input;
			const queryString = failIfExists ? '?failIfExists=true' : '';
			return ToolFactory.makeApiRequest(context, {
				method: 'POST',
				endpoint: `/v2/subscribers${queryString}`,
				body,
				successMessage: 'created subscriber',
				identifier: input.subscriberId,
			}, idempotencyKey);
		}
	});

	ToolFactory.createGetByIdTool(
		server,
		getApiKey,
		getServerRegion,
		"get_subscriber",
		"Retrieve a single subscriber by their subscriberId with full profile details including channels, preferences, and custom data",
		"/v2/subscribers/{id}",
		"fetched subscriber",
		"subscriberId",
		"The subscriberId of the subscriber to retrieve"
	);

	ToolFactory.createTool(server, getApiKey, getServerRegion, {
		name: "update_subscriber",
		description: "Update an existing subscriber's attributes like name, email, phone, avatar, locale, timezone, or custom data",
		schema: z.object({
			subscriberId: z.string().describe("The subscriberId of the subscriber to update"),
			firstName: z.string().optional().describe("Updated first name"),
			lastName: z.string().optional().describe("Updated last name"),
			email: z.string().optional().describe("Updated email address"),
			phone: z.string().optional().describe("Updated phone number"),
			avatar: z.string().optional().describe("Updated avatar URL"),
			locale: z.string().optional().describe("Updated locale (e.g. 'en-US')"),
			timezone: z.string().optional().describe("Updated timezone (e.g. 'America/New_York')"),
			data: z.record(z.any()).optional().describe("Updated custom data"),
			idempotencyKey: z.string().optional().describe("Optional idempotency key for the request"),
		}),
		handler: async (input, context) => {
			const { subscriberId, idempotencyKey, ...body } = input;
			return ToolFactory.makeApiRequest(context, {
				method: 'PATCH',
				endpoint: `/v2/subscribers/${subscriberId}`,
				body,
				successMessage: 'updated subscriber',
				identifier: subscriberId,
			}, idempotencyKey);
		}
	});

	ToolFactory.createDeleteTool(
		server,
		getApiKey,
		getServerRegion,
		"delete_subscriber",
		"Delete a subscriber by their subscriberId. This action is irreversible.",
		"/v2/subscribers/{id}",
		"deleted subscriber",
		"subscriberId",
		"The subscriberId of the subscriber to delete"
	);

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