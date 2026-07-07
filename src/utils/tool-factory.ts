import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ApiResponse, TriggerWorkflowRequest } from "../types";
import { NovuApiUtils } from "./api";
import { ValidationUtils } from "./validation";

export interface ToolContext {
	token: string;
	apiUrl: string;
	environmentId?: string;
}

interface ToolConfig<T extends z.ZodSchema> {
	name: string;
	description: string;
	schema: T;
	handler: (input: z.infer<T>, context: ToolContext) => Promise<ApiResponse>;
}

interface ApiRequestConfig {
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	endpoint: string;
	body?: any;
	successMessage: string;
	identifier?: string;
	customHeaders?: Record<string, string>;
}

/**
 * Optional environment selector exposed on every tool. Forwarded to the Novu
 * API as the `Novu-Environment-Id` header for OAuth sessions only — they are
 * organization-bound and default to the Development environment. Legacy API
 * keys are already bound to a single environment, so the header is never sent
 * for them (see `NovuApiUtils.prepareHeaders`).
 */
export const environmentIdSchema = z
	.string()
	.optional()
	.describe(
		"Optional Novu environment ID (_id from get_environments) to run this request against. Only applies to OAuth sessions, which default to the Development environment — pass a different environment ID to target it (e.g. Production). Ignored for environment-bound API keys.",
	);

export class ToolFactory {
	/**
	 * Create a standardized MCP tool with common error handling and validation
	 */
	static createTool<T extends z.ZodSchema>(
		server: McpServer,
		getToken: () => string | null,
		getApiUrl: () => string,
		config: ToolConfig<T>,
	) {
		// Extract the shape from the schema if it's a ZodObject, otherwise use the schema itself
		const schema = "shape" in config.schema ? (config.schema as any).shape : config.schema;

		// Every factory tool accepts an optional environment selector; it is
		// lifted out of the input into the request context (never sent in bodies).
		const schemaWithEnvironment = { ...schema, environmentId: environmentIdSchema };

		server.tool(
			config.name,
			config.description,
			schemaWithEnvironment,
			async (rawInput: z.infer<T> & { environmentId?: string }) => {
				// Validate API key first
				const authError = ValidationUtils.validateToken(getToken());
				if (authError) {
					return authError;
				}

				const { environmentId, ...input } = rawInput as Record<string, any>;

				try {
					return await config.handler(input as z.infer<T>, {
						apiUrl: getApiUrl(),
						environmentId,
						token: getToken()!,
					});
				} catch (error) {
					console.error(`Error in ${config.name}:`, error);
					return {
						content: [
							{
								text: `Error: Failed to execute ${config.name}. ${error instanceof Error ? error.message : "Unknown error"}`,
								type: "text" as const,
							},
						],
					};
				}
			},
		);
	}

	/**
	 * Create a simple API request handler with standardized error handling
	 */
	static async makeApiRequest(
		context: ToolContext,
		requestConfig: ApiRequestConfig,
		idempotencyKey?: string,
	): Promise<ApiResponse> {
		const url = `${context.apiUrl}${requestConfig.endpoint}`;

		console.log(
			`Making ${requestConfig.method} request to ${requestConfig.endpoint}${requestConfig.identifier ? ` for ${requestConfig.identifier}` : ""}`,
		);

		const headers = {
			...NovuApiUtils.prepareHeaders(context.token, {
				environmentId: context.environmentId,
				idempotencyKey,
			}),
			...requestConfig.customHeaders,
		};

		const response = await fetch(url, {
			headers,
			method: requestConfig.method,
			...(requestConfig.body && { body: JSON.stringify(requestConfig.body) }),
		});

		// Handle special case for DELETE operations that return 204
		if (requestConfig.method === "DELETE" && response.status === 204) {
			const message = requestConfig.identifier
				? `Successfully ${requestConfig.successMessage} ${requestConfig.identifier}`
				: `Successfully ${requestConfig.successMessage}`;

			console.log(message);
			return {
				content: [
					{
						text: message,
						type: "text" as const,
					},
				],
			};
		}

		return await NovuApiUtils.handleApiResponse(
			response,
			requestConfig.successMessage,
			requestConfig.identifier,
		);
	}

	/**
	 * Create a simple GET tool
	 */
	static createGetTool(
		server: McpServer,
		getToken: () => string | null,
		getApiUrl: () => string,
		name: string,
		description: string,
		endpoint: string,
		successMessage: string,
		schema?: z.ZodSchema,
	) {
		ToolFactory.createTool(server, getToken, getApiUrl, {
			description,
			handler: async (input, context) => {
				return ToolFactory.makeApiRequest(
					context,
					{
						endpoint,
						method: "GET",
						successMessage,
					},
					input.idempotencyKey,
				);
			},
			name,
			schema:
				schema ||
				z.object({
					idempotencyKey: z
						.string()
						.optional()
						.describe("Optional idempotency key for the request"),
				}),
		});
	}

	/**
	 * Create a tool for getting a specific resource by ID
	 */
	static createGetByIdTool(
		server: McpServer,
		getToken: () => string | null,
		getApiUrl: () => string,
		name: string,
		description: string,
		endpointTemplate: string, // e.g., "/v2/workflows/{id}"
		successMessage: string,
		idParamName = "id",
		idDescription = "The ID to retrieve",
	) {
		ToolFactory.createTool(server, getToken, getApiUrl, {
			description,
			handler: async (input, context) => {
				const idValue = (input as any)[idParamName] as string;
				const endpoint = endpointTemplate.replace("{id}", idValue);
				return ToolFactory.makeApiRequest(
					context,
					{
						endpoint,
						identifier: idValue,
						method: "GET",
						successMessage,
					},
					(input as any).idempotencyKey,
				);
			},
			name,
			schema: z.object({
				[idParamName]: z.string().describe(idDescription),
				idempotencyKey: z
					.string()
					.optional()
					.describe("Optional idempotency key for the request"),
			}),
		});
	}

	/**
	 * Create a DELETE tool
	 */
	static createDeleteTool(
		server: McpServer,
		getToken: () => string | null,
		getApiUrl: () => string,
		name: string,
		description: string,
		endpointTemplate: string, // e.g., "/v2/workflows/{id}"
		successMessage: string,
		idParamName = "id",
		idDescription = "The ID to delete",
	) {
		ToolFactory.createTool(server, getToken, getApiUrl, {
			description,
			handler: async (input, context) => {
				const idValue = (input as any)[idParamName] as string;
				const endpoint = endpointTemplate.replace("{id}", idValue);
				return ToolFactory.makeApiRequest(
					context,
					{
						endpoint,
						identifier: idValue,
						method: "DELETE",
						successMessage,
					},
					(input as any).idempotencyKey,
				);
			},
			name,
			schema: z.object({
				[idParamName]: z.string().describe(idDescription),
				idempotencyKey: z
					.string()
					.optional()
					.describe("Optional idempotency key for the request"),
			}),
		});
	}

	/**
	 * Special handler for trigger workflow which has custom logic
	 */
	static async handleTriggerWorkflow(
		input: {
			workflowName: string;
			subscriberId: string;
			payload: Record<string, any>;
			overrides?: Record<string, { integrationIdentifier: string }>;
			idempotencyKey?: string;
		},
		context: ToolContext,
	): Promise<ApiResponse> {
		console.log(
			`Triggering workflow "${input.workflowName}" for subscriber "${input.subscriberId}"`,
		);

		const requestBody: TriggerWorkflowRequest = {
			name: input.workflowName,
			payload: input.payload,
			to: [{ subscriberId: input.subscriberId }],
			...(input.overrides && { overrides: input.overrides }),
		};

		const response = await fetch(`${context.apiUrl}/v1/events/trigger`, {
			body: JSON.stringify(requestBody),
			headers: {
				...NovuApiUtils.prepareHeaders(context.token, {
					environmentId: context.environmentId,
					idempotencyKey: input.idempotencyKey,
				}),
				"Content-Type": "application/json",
			},
			method: "POST",
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Novu API Error:", response.status, errorText);
			return {
				content: [
					{
						text: `Error: Failed to trigger workflow "${input.workflowName}". Status: ${response.status}, Message: ${errorText}`,
						type: "text" as const,
					},
				],
			};
		}

		const data = await response.json();
		console.log(
			`Successfully triggered workflow "${input.workflowName}" for subscriber "${input.subscriberId}"`,
		);

		return {
			content: [
				{
					text: `Successfully triggered workflow "${input.workflowName}" for subscriber "${input.subscriberId}":\n\n${JSON.stringify(data, null, 2)}`,
					type: "text" as const,
				},
			],
		};
	}
}
