import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ValidationUtils } from './validation';
import { NovuApiUtils } from './api';
import type { ServerRegion, ApiResponse, TriggerWorkflowRequest } from '../types';

interface ToolConfig<T extends z.ZodSchema> {
	name: string;
	description: string;
	schema: T;
	handler: (
		input: z.infer<T>, 
		context: { apiKey: string; serverRegion: ServerRegion }
	) => Promise<ApiResponse>;
}

interface ApiRequestConfig {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	endpoint: string;
	body?: any;
	successMessage: string;
	identifier?: string;
	customHeaders?: Record<string, string>;
}

export class ToolFactory {
	/**
	 * Create a standardized MCP tool with common error handling and validation
	 */
	static createTool<T extends z.ZodSchema>(
		server: McpServer,
		getApiKey: () => string | null,
		getServerRegion: () => ServerRegion,
		config: ToolConfig<T>
	) {
		// Extract the shape from the schema if it's a ZodObject, otherwise use the schema itself
		const schema = 'shape' in config.schema ? (config.schema as any).shape : config.schema;
		
		server.tool(
			config.name,
			config.description,
			schema,
			async (input: z.infer<T>) => {
				// Validate API key first
				const apiKeyError = ValidationUtils.validateApiKey(getApiKey());
				if (apiKeyError) {
					return apiKeyError;
				}

				try {
					return await config.handler(input, {
						apiKey: getApiKey()!,
						serverRegion: getServerRegion()
					});
				} catch (error) {
					console.error(`Error in ${config.name}:`, error);
					return {
						content: [{ 
							type: "text" as const, 
							text: `Error: Failed to execute ${config.name}. ${error instanceof Error ? error.message : 'Unknown error'}` 
						}],
					};
				}
			}
		);
	}

	/**
	 * Create a simple API request handler with standardized error handling
	 */
	static async makeApiRequest(
		context: { apiKey: string; serverRegion: ServerRegion },
		requestConfig: ApiRequestConfig,
		idempotencyKey?: string
	): Promise<ApiResponse> {
		const url = `${NovuApiUtils.getBaseUrl(context.serverRegion)}${requestConfig.endpoint}`;
		
		console.log(`Making ${requestConfig.method} request to ${requestConfig.endpoint}${requestConfig.identifier ? ` for ${requestConfig.identifier}` : ''}`);

		const headers = {
			...NovuApiUtils.prepareHeaders(context.apiKey, idempotencyKey),
			...requestConfig.customHeaders
		};

		const response = await fetch(url, {
			method: requestConfig.method,
			headers,
			...(requestConfig.body && { body: JSON.stringify(requestConfig.body) })
		});

		// Handle special case for DELETE operations that return 204
		if (requestConfig.method === 'DELETE' && response.status === 204) {
			const message = requestConfig.identifier 
				? `Successfully ${requestConfig.successMessage} ${requestConfig.identifier}`
				: `Successfully ${requestConfig.successMessage}`;
			
			console.log(message);
			return {
				content: [{ 
					type: "text" as const, 
					text: message
				}],
			};
		}

		return await NovuApiUtils.handleApiResponse(
			response, 
			requestConfig.successMessage, 
			requestConfig.identifier
		);
	}

	/**
	 * Create a simple GET tool
	 */
	static createGetTool(
		server: McpServer,
		getApiKey: () => string | null,
		getServerRegion: () => ServerRegion,
		name: string,
		description: string,
		endpoint: string,
		successMessage: string,
		schema?: z.ZodSchema
	) {
		this.createTool(server, getApiKey, getServerRegion, {
			name,
			description,
			schema: schema || z.object({
				idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
			}),
			handler: async (input, context) => {
				return this.makeApiRequest(context, {
					method: 'GET',
					endpoint,
					successMessage
				}, input.idempotencyKey);
			}
		});
	}

	/**
	 * Create a tool for getting a specific resource by ID
	 */
	static createGetByIdTool(
		server: McpServer,
		getApiKey: () => string | null,
		getServerRegion: () => ServerRegion,
		name: string,
		description: string,
		endpointTemplate: string, // e.g., "/v2/workflows/{id}"
		successMessage: string,
		idParamName: string = "id",
		idDescription: string = "The ID to retrieve"
	) {
		this.createTool(server, getApiKey, getServerRegion, {
			name,
			description,
			schema: z.object({
				[idParamName]: z.string().describe(idDescription),
				idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
			}),
			handler: async (input, context) => {
				const idValue = (input as any)[idParamName] as string;
				const endpoint = endpointTemplate.replace('{id}', idValue);
				return this.makeApiRequest(context, {
					method: 'GET',
					endpoint,
					successMessage,
					identifier: idValue
				}, (input as any).idempotencyKey);
			}
		});
	}

	/**
	 * Create a DELETE tool
	 */
	static createDeleteTool(
		server: McpServer,
		getApiKey: () => string | null,
		getServerRegion: () => ServerRegion,
		name: string,
		description: string,
		endpointTemplate: string, // e.g., "/v2/workflows/{id}"
		successMessage: string,
		idParamName: string = "id",
		idDescription: string = "The ID to delete"
	) {
		this.createTool(server, getApiKey, getServerRegion, {
			name,
			description,
			schema: z.object({
				[idParamName]: z.string().describe(idDescription),
				idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
			}),
			handler: async (input, context) => {
				const idValue = (input as any)[idParamName] as string;
				const endpoint = endpointTemplate.replace('{id}', idValue);
				return this.makeApiRequest(context, {
					method: 'DELETE',
					endpoint,
					successMessage,
					identifier: idValue
				}, (input as any).idempotencyKey);
			}
		});
	}

	/**
	 * Special handler for trigger workflow which has custom logic
	 */
	static async handleTriggerWorkflow(
		input: { workflowName: string; subscriberId: string; payload: Record<string, any>; idempotencyKey?: string },
		context: { apiKey: string; serverRegion: ServerRegion }
	): Promise<ApiResponse> {
		console.log(`Triggering workflow "${input.workflowName}" for subscriber "${input.subscriberId}"`);
		
		// Build request body
		const requestBody: TriggerWorkflowRequest = {
			name: input.workflowName,
			to: [{ subscriberId: input.subscriberId }],
			payload: input.payload
		};

		const response = await fetch(`${NovuApiUtils.getBaseUrl(context.serverRegion)}/v1/events/trigger`, {
			method: "POST",
			headers: {
				...NovuApiUtils.prepareHeaders(context.apiKey, input.idempotencyKey),
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
					text: `Error: Failed to trigger workflow "${input.workflowName}". Status: ${response.status}, Message: ${errorText}` 
				}],
			};
		}

		const data = await response.json();
		console.log(`Successfully triggered workflow "${input.workflowName}" for subscriber "${input.subscriberId}"`);
		
		return {
			content: [{ 
				type: "text" as const, 
				text: `Successfully triggered workflow "${input.workflowName}" for subscriber "${input.subscriberId}":\n\n${JSON.stringify(data, null, 2)}` 
			}],
		};
	}
} 