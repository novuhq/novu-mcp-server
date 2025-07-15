import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ValidationUtils } from '../utils/validation';
import { NovuApiUtils } from '../utils/api';
import type { ServerRegion, TriggerWorkflowRequest } from '../types';

export function registerWorkflowTools(
	server: McpServer, 
	getApiKey: () => string | null, 
	getServerRegion: () => ServerRegion
) {
	// Get all workflows from Novu API
	server.tool(
		"get_workflows",
		"Get all available workflows from your Novu application with their basic information and identifiers",
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
				console.log("Fetching workflows from Novu API...");
				
				const response = await fetch(`${NovuApiUtils.getBaseUrl(getServerRegion())}/v2/workflows`, {
					method: "GET",
					headers: NovuApiUtils.prepareHeaders(getApiKey()!, idempotencyKey)
				});

				return await NovuApiUtils.handleApiResponse(response, "fetched workflows");

			} catch (error) {
				console.error("Error fetching workflows:", error);
				return {
					content: [{ 
						type: "text" as const, 
						text: `Error: Failed to fetch workflows. ${error instanceof Error ? error.message : 'Unknown error'}` 
					}],
				};
			}
		}
	);

	// Get a specific workflow by ID from Novu API
	server.tool(
		"get_workflow",
		"Get detailed information about a specific workflow including its steps, channels, payload structure, and configuration",
		{
			workflowId: z.string().describe("The workflow ID to retrieve (obtained from get_workflows)"),
			idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
		},
		async ({ workflowId, idempotencyKey }) => {
			// Validate API key first
			const apiKeyError = ValidationUtils.validateApiKey(getApiKey());
			if (apiKeyError) {
				return apiKeyError;
			}

			try {
				console.log(`Fetching workflow ${workflowId} from Novu API...`);
				
				const response = await fetch(`${NovuApiUtils.getBaseUrl(getServerRegion())}/v2/workflows/${workflowId}`, {
					method: "GET",
					headers: NovuApiUtils.prepareHeaders(getApiKey()!, idempotencyKey)
				});

				return await NovuApiUtils.handleApiResponse(response, "fetched workflow", workflowId);

			} catch (error) {
				console.error("Error fetching workflow:", error);
				return {
					content: [{ 
						type: "text" as const, 
						text: `Error: Failed to fetch workflow ${workflowId}. ${error instanceof Error ? error.message : 'Unknown error'}` 
					}],
				};
			}
		}
	);

	// Trigger a workflow from Novu API
	server.tool(
		"trigger_workflow",
		"Trigger a workflow to send notifications to a subscriber with custom payload data",
		{
			workflowName: z.string().describe("The workflow name/identifier to trigger (obtained from get_workflows)"),
			subscriberId: z.string().describe("The subscriber ID to send the notification to (obtained from find_subscribers)"),
			payload: z.record(z.any()).describe("The payload data for the workflow (structure obtained from get_workflow)"),
			idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
		},
		async ({ workflowName, subscriberId, payload, idempotencyKey }) => {
			// Validate API key first
			const apiKeyError = ValidationUtils.validateApiKey(getApiKey());
			if (apiKeyError) {
				return apiKeyError;
			}

			try {
				console.log(`Triggering workflow "${workflowName}" for subscriber "${subscriberId}"`);
				
				// Build request body
				const requestBody: TriggerWorkflowRequest = {
					name: workflowName,
					to: [{ subscriberId: subscriberId }],
					payload: payload
				};

				const response = await fetch(`${NovuApiUtils.getBaseUrl(getServerRegion())}/v1/events/trigger`, {
					method: "POST",
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
							text: `Error: Failed to trigger workflow "${workflowName}". Status: ${response.status}, Message: ${errorText}` 
						}],
					};
				}

				const data = await response.json();
				console.log(`Successfully triggered workflow "${workflowName}" for subscriber "${subscriberId}"`);
				
				return {
					content: [{ 
						type: "text" as const, 
						text: `Successfully triggered workflow "${workflowName}" for subscriber "${subscriberId}":\n\n${JSON.stringify(data, null, 2)}` 
					}],
				};

			} catch (error) {
				console.error("Error triggering workflow:", error);
				return {
					content: [{ 
						type: "text" as const, 
						text: `Error: Failed to trigger workflow "${workflowName}". ${error instanceof Error ? error.message : 'Unknown error'}` 
					}],
				};
			}
		}
	);
}   