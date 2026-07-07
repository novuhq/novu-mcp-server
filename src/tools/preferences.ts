import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ChannelPreferences, UpdatePreferencesRequest } from "../types/index";
import { NovuApiUtils } from "../utils/api";
import { environmentIdSchema } from "../utils/tool-factory";
import { ValidationUtils } from "../utils/validation";

export function registerPreferenceTools(
	server: McpServer,
	getToken: () => string | null,
	getApiUrl: () => string,
) {
	// Get subscriber preferences from Novu API
	server.tool(
		"get_subscriber_preferences",
		"Get subscriber notification preferences for all channels (email, SMS, in-app, push, chat) across all workflows and global settings",
		{
			environmentId: environmentIdSchema,
			idempotencyKey: z
				.string()
				.optional()
				.describe("Optional idempotency key for the request"),
			subscriberId: z
				.string()
				.describe(
					"The subscriber ID to retrieve preferences for (obtained from find_subscribers)",
				),
		},
		async ({ subscriberId, idempotencyKey, environmentId }) => {
			// Validate API key first
			const authError = ValidationUtils.validateToken(getToken());
			if (authError) {
				return authError;
			}

			try {
				console.log(`Fetching subscriber preferences for ${subscriberId} from Novu API...`);

				const response = await fetch(
					`${getApiUrl()}/v2/subscribers/${subscriberId}/preferences`,
					{
						headers: NovuApiUtils.prepareHeaders(getToken()!, {
							environmentId,
							idempotencyKey,
						}),
						method: "GET",
					},
				);

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Novu API Error:", response.status, errorText);
					return {
						content: [
							{
								text: `Error: Failed to fetch subscriber preferences for ${subscriberId}. Status: ${response.status}, Message: ${errorText}`,
								type: "text" as const,
							},
						],
					};
				}

				const data = await response.json();
				console.log(
					`Successfully fetched subscriber preferences for ${subscriberId} from Novu API`,
				);

				return {
					content: [
						{
							text: `Successfully fetched subscriber preferences for ${subscriberId} (includes all five channels preferences for all workflows and global preferences):\n\n${JSON.stringify(data, null, 2)}`,
							type: "text" as const,
						},
					],
				};
			} catch (error) {
				console.error("Error fetching subscriber preferences:", error);
				return {
					content: [
						{
							text: `Error: Failed to fetch subscriber preferences for ${subscriberId}. ${error instanceof Error ? error.message : "Unknown error"}`,
							type: "text" as const,
						},
					],
				};
			}
		},
	);

	// Update subscriber preferences in Novu API
	server.tool(
		"update_subscriber_preferences",
		"Update subscriber notification preferences for specific channels (email, SMS, in-app, push, chat) either globally or for a specific workflow",
		{
			channels: z
				.object({
					chat: z.boolean().describe("Enable/disable chat notifications"),
					email: z.boolean().describe("Enable/disable email notifications"),
					in_app: z.boolean().describe("Enable/disable in-app notifications"),
					push: z.boolean().describe("Enable/disable push notifications"),
					sms: z.boolean().describe("Enable/disable SMS notifications"),
				})
				.describe("Channel preferences object with boolean values for each channel type"),
			environmentId: environmentIdSchema,
			idempotencyKey: z
				.string()
				.optional()
				.describe("Optional idempotency key for the request"),
			subscriberId: z
				.string()
				.describe(
					"The subscriber ID to update preferences for (obtained from find_subscribers)",
				),
			workflowId: z
				.string()
				.optional()
				.describe(
					"Optional workflow ID - if provided, updates that workflow preference; otherwise updates global preferences",
				),
		},
		async ({ subscriberId, channels, workflowId, idempotencyKey, environmentId }) => {
			// Validate API key first
			const authError = ValidationUtils.validateToken(getToken());
			if (authError) {
				return authError;
			}

			try {
				console.log(
					`Updating subscriber preferences for ${subscriberId} ${workflowId ? `for workflow ${workflowId}` : "globally"} via Novu API...`,
				);

				// Build request body
				const requestBody: UpdatePreferencesRequest = {
					channels: channels as ChannelPreferences,
				};

				if (workflowId) {
					requestBody.workflowId = workflowId;
				}

				const response = await fetch(
					`${getApiUrl()}/v2/subscribers/${subscriberId}/preferences`,
					{
						body: JSON.stringify(requestBody),
						headers: {
							...NovuApiUtils.prepareHeaders(getToken()!, {
								environmentId,
								idempotencyKey,
							}),
							"Content-Type": "application/json",
						},
						method: "PATCH",
					},
				);

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Novu API Error:", response.status, errorText);
					return {
						content: [
							{
								text: `Error: Failed to update subscriber preferences for ${subscriberId}. Status: ${response.status}, Message: ${errorText}`,
								type: "text" as const,
							},
						],
					};
				}

				const data = await response.json();
				console.log(
					`Successfully updated subscriber preferences for ${subscriberId} ${workflowId ? `for workflow ${workflowId}` : "globally"} via Novu API`,
				);

				const scopeText = workflowId ? `for workflow ${workflowId}` : "globally";
				const channelsList = Object.entries(channels)
					.map(([channel, enabled]) => `${channel}: ${enabled}`)
					.join(", ");

				return {
					content: [
						{
							text: `Successfully updated subscriber preferences for ${subscriberId} ${scopeText}.\nUpdated channels: ${channelsList}\n\nResponse:\n${JSON.stringify(data, null, 2)}`,
							type: "text" as const,
						},
					],
				};
			} catch (error) {
				console.error("Error updating subscriber preferences:", error);
				return {
					content: [
						{
							text: `Error: Failed to update subscriber preferences for ${subscriberId}. ${error instanceof Error ? error.message : "Unknown error"}`,
							type: "text" as const,
						},
					],
				};
			}
		},
	);
}
