import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FindSubscribersParams } from "../types/index";
import { NovuApiUtils } from "../utils/api";
import { environmentIdSchema, ToolFactory } from "../utils/tool-factory";
import { ValidationUtils } from "../utils/validation";

const createSubscriberSchema = z.object({
	avatar: z.string().optional().describe("Avatar URL or identifier"),
	data: z
		.record(z.any())
		.optional()
		.describe("Additional custom data associated with the subscriber"),
	email: z.string().optional().describe("Email address of the subscriber"),
	failIfExists: z
		.boolean()
		.optional()
		.describe(
			"If true, the request will fail if a subscriber with the same subscriberId already exists. Otherwise it will update the existing subscriber.",
		),
	firstName: z.string().optional().describe("First name of the subscriber"),
	idempotencyKey: z.string().optional().describe("Optional idempotency key for the request"),
	lastName: z.string().optional().describe("Last name of the subscriber"),
	locale: z.string().optional().describe("Locale of the subscriber (e.g. 'en-US')"),
	phone: z.string().optional().describe("Phone number of the subscriber"),
	subscriberId: z
		.string()
		.describe("Unique identifier for the subscriber, typically the user ID in your system"),
	timezone: z
		.string()
		.optional()
		.describe("Timezone of the subscriber (e.g. 'America/New_York')"),
});

export function registerSubscriberTools(
	server: McpServer,
	getToken: () => string | null,
	getApiUrl: () => string,
) {
	ToolFactory.createTool(server, getToken, getApiUrl, {
		description:
			"Create a new subscriber with attributes like name, email, phone, and custom data. If the subscriber already exists, it will be updated (unless failIfExists is true).",
		handler: async (input, context) => {
			const { idempotencyKey, failIfExists, ...body } = input;
			const queryString = failIfExists ? "?failIfExists=true" : "";
			return ToolFactory.makeApiRequest(
				context,
				{
					body,
					endpoint: `/v2/subscribers${queryString}`,
					identifier: input.subscriberId,
					method: "POST",
					successMessage: "created subscriber",
				},
				idempotencyKey,
			);
		},
		name: "create_subscriber",
		schema: createSubscriberSchema,
	});

	ToolFactory.createGetByIdTool(
		server,
		getToken,
		getApiUrl,
		"get_subscriber",
		"Retrieve a single subscriber by their subscriberId with full profile details including channels, preferences, and custom data",
		"/v2/subscribers/{id}",
		"fetched subscriber",
		"subscriberId",
		"The subscriberId of the subscriber to retrieve",
	);

	ToolFactory.createTool(server, getToken, getApiUrl, {
		description:
			"Update an existing subscriber's attributes like name, email, phone, avatar, locale, timezone, or custom data",
		handler: async (input, context) => {
			const { subscriberId, idempotencyKey, ...body } = input;
			return ToolFactory.makeApiRequest(
				context,
				{
					body,
					endpoint: `/v2/subscribers/${subscriberId}`,
					identifier: subscriberId,
					method: "PATCH",
					successMessage: "updated subscriber",
				},
				idempotencyKey,
			);
		},
		name: "update_subscriber",
		schema: z.object({
			avatar: z.string().optional().describe("Updated avatar URL"),
			data: z.record(z.any()).optional().describe("Updated custom data"),
			email: z.string().optional().describe("Updated email address"),
			firstName: z.string().optional().describe("Updated first name"),
			idempotencyKey: z
				.string()
				.optional()
				.describe("Optional idempotency key for the request"),
			lastName: z.string().optional().describe("Updated last name"),
			locale: z.string().optional().describe("Updated locale (e.g. 'en-US')"),
			phone: z.string().optional().describe("Updated phone number"),
			subscriberId: z.string().describe("The subscriberId of the subscriber to update"),
			timezone: z.string().optional().describe("Updated timezone (e.g. 'America/New_York')"),
		}),
	});

	ToolFactory.createDeleteTool(
		server,
		getToken,
		getApiUrl,
		"delete_subscriber",
		"Delete a subscriber by their subscriberId. This action is irreversible.",
		"/v2/subscribers/{id}",
		"deleted subscriber",
		"subscriberId",
		"The subscriberId of the subscriber to delete",
	);

	server.tool(
		"find_subscribers",
		"Search for subscribers using various query parameters like email, name, phone number, or subscriber ID",
		{
			email: z.string().optional().describe("Email address to search for"),
			environmentId: environmentIdSchema,
			idempotencyKey: z
				.string()
				.optional()
				.describe("Optional idempotency key for the request"),
			name: z.string().optional().describe("Name to search for"),
			phone: z.string().optional().describe("Phone number to search for"),
			subscriberId: z.string().optional().describe("Subscriber ID to search for"),
		},
		async ({ email, name, phone, subscriberId, idempotencyKey, environmentId }) => {
			// Validate API key first
			const authError = ValidationUtils.validateToken(getToken());
			if (authError) {
				return authError;
			}

			// Check that at least one query parameter is provided
			const params: FindSubscribersParams = { email, name, phone, subscriberId };
			const validationError = ValidationUtils.validateAtLeastOneParam(params, [
				"email",
				"name",
				"phone",
				"subscriberId",
			]);
			if (validationError) {
				return validationError;
			}

			try {
				// Build query string with only provided parameters
				const queryParams = NovuApiUtils.buildQueryParams(params);
				const queryString = queryParams.toString();
				const url = `${getApiUrl()}/v2/subscribers?${queryString}`;

				console.log(`Searching for subscribers with query: ${queryString}`);

				const response = await fetch(url, {
					headers: NovuApiUtils.prepareHeaders(getToken()!, {
						environmentId,
						idempotencyKey,
					}),
					method: "GET",
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Novu API Error:", response.status, errorText);
					return {
						content: [
							{
								text: `Error: Failed to search subscribers. Status: ${response.status}, Message: ${errorText}`,
								type: "text" as const,
							},
						],
					};
				}

				const data = await response.json();
				console.log("Successfully searched subscribers from Novu API");

				return {
					content: [
						{
							text: `Successfully found subscribers with query (${queryString}):\n\n${JSON.stringify(data, null, 2)}`,
							type: "text" as const,
						},
					],
				};
			} catch (error) {
				console.error("Error searching subscribers:", error);
				return {
					content: [
						{
							text: `Error: Failed to search subscribers. ${error instanceof Error ? error.message : "Unknown error"}`,
							type: "text" as const,
						},
					],
				};
			}
		},
	);
}
