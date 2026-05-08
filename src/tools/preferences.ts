import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ValidationUtils } from '../utils/validation';
import { NovuApiUtils } from '../utils/api';
import type { ServerRegion, ChannelPreferences, UpdatePreferencesRequest } from '../types/index';

export function registerPreferenceTools(
	server: McpServer, 
	getApiKey: () => string | null, 
	getServerRegion: () => ServerRegion
) {
	// Get subscriber preferences from Novu API
	server.tool(
		"get_subscriber_preferences",
		"Get subscriber notification preferences for all channels (email, SMS, in-app, push, chat) across all workflows and global settings",
		{
			subscriberId: z.string().describe("The subscriber ID to retrieve preferences for (obtained from find_subscribers)"),
			idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
		},
		async ({ subscriberId, idempotencyKey }) => {
			// Validate API key first
			const apiKeyError = ValidationUtils.validateApiKey(getApiKey());
			if (apiKeyError) {
				return apiKeyError;
			}

			try {
				console.log(`Fetching subscriber preferences for ${subscriberId} from Novu API...`);
				
				const response = await fetch(`${NovuApiUtils.getBaseUrl(getServerRegion())}/v2/subscribers/${subscriberId}/preferences`, {
					method: "GET",
					headers: NovuApiUtils.prepareHeaders(getApiKey()!, idempotencyKey)
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Novu API Error:", response.status, errorText);
					return {
						content: [{ 
							type: "text" as const, 
							text: `Error: Failed to fetch subscriber preferences for ${subscriberId}. Status: ${response.status}, Message: ${errorText}` 
						}],
					};
				}

				const data = await response.json();
				console.log(`Successfully fetched subscriber preferences for ${subscriberId} from Novu API`);
				
				return {
					content: [{ 
						type: "text" as const, 
						text: `Successfully fetched subscriber preferences for ${subscriberId} (includes all five channels preferences for all workflows and global preferences):\n\n${JSON.stringify(data, null, 2)}` 
					}],
				};

			} catch (error) {
				console.error("Error fetching subscriber preferences:", error);
				return {
					content: [{ 
						type: "text" as const, 
						text: `Error: Failed to fetch subscriber preferences for ${subscriberId}. ${error instanceof Error ? error.message : 'Unknown error'}` 
					}],
				};
			}
		}
	);

	// Update subscriber preferences in Novu API
	server.tool(
		"update_subscriber_preferences",
		"Update subscriber notification preferences for specific channels (email, SMS, in-app, push, chat) either globally or for a specific workflow",
		{
			subscriberId: z.string().describe("The subscriber ID to update preferences for (obtained from find_subscribers)"),
			channels: z.object({
				email: z.boolean().describe("Enable/disable email notifications"),
				sms: z.boolean().describe("Enable/disable SMS notifications"),
				in_app: z.boolean().describe("Enable/disable in-app notifications"),
				push: z.boolean().describe("Enable/disable push notifications"),
				chat: z.boolean().describe("Enable/disable chat notifications")
			}).describe("Channel preferences object with boolean values for each channel type"),
			workflowId: z.string().optional().describe("Optional workflow ID - if provided, updates that workflow preference; otherwise updates global preferences"),
			idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
		},
		async ({ subscriberId, channels, workflowId, idempotencyKey }) => {
			// Validate API key first
			const apiKeyError = ValidationUtils.validateApiKey(getApiKey());
			if (apiKeyError) {
				return apiKeyError;
			}

			try {
				console.log(`Updating subscriber preferences for ${subscriberId} ${workflowId ? `for workflow ${workflowId}` : 'globally'} via Novu API...`);
				
				// Build request body
				const requestBody: UpdatePreferencesRequest = {
					channels: channels as ChannelPreferences
				};

				if (workflowId) {
					requestBody.workflowId = workflowId;
				}

				const response = await fetch(`${NovuApiUtils.getBaseUrl(getServerRegion())}/v2/subscribers/${subscriberId}/preferences`, {
					method: "PATCH",
					headers: {
						...NovuApiUtils.prepareHeaders(getApiKey()!, idempotencyKey),
						"Content-Type": "application/json"
					},
					body: JSON.stringify(requestBody)
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Novu API Error:", response.status, errorText);
					return {
						content: [{ 
							type: "text" as const, 
							text: `Error: Failed to update subscriber preferences for ${subscriberId}. Status: ${response.status}, Message: ${errorText}` 
						}],
					};
				}

				const data = await response.json();
				console.log(`Successfully updated subscriber preferences for ${subscriberId} ${workflowId ? `for workflow ${workflowId}` : 'globally'} via Novu API`);
				
				const scopeText = workflowId ? `for workflow ${workflowId}` : 'globally';
				const channelsList = Object.entries(channels).map(([channel, enabled]) => `${channel}: ${enabled}`).join(', ');
				
				return {
					content: [{ 
						type: "text" as const, 
						text: `Successfully updated subscriber preferences for ${subscriberId} ${scopeText}.\nUpdated channels: ${channelsList}\n\nResponse:\n${JSON.stringify(data, null, 2)}` 
					}],
				};

			} catch (error) {
				console.error("Error updating subscriber preferences:", error);
				return {
					content: [{ 
						type: "text" as const, 
						text: `Error: Failed to update subscriber preferences for ${subscriberId}. ${error instanceof Error ? error.message : 'Unknown error'}` 
					}],
				};
			}
		}
	);
} 