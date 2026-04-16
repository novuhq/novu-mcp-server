import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WorkflowValidationUtils } from '../utils/workflow-validation';
import { ToolFactory } from '../utils/tool-factory';
import type { ServerRegion } from '../types';
import {
	triggerWorkflowInputSchema,
	createWorkflowInputSchema,
	updateWorkflowInputSchema
} from '../utils/workflow-schemas';

export function registerWorkflowTools(
	server: McpServer, 
	getApiKey: () => string | null, 
	getServerRegion: () => ServerRegion
) {
	// Get all workflows - simple GET endpoint
	ToolFactory.createGetTool(
		server,
		getApiKey,
		getServerRegion,
		"get_workflows",
		"Get all available workflows from your Novu application with their basic information and identifiers",
		"/v2/workflows",
		"fetched workflows"
	);

	// Get specific workflow by ID - simple GET by ID
	ToolFactory.createGetByIdTool(
		server,
		getApiKey,
		getServerRegion,
		"get_workflow",
		"Get detailed information about a specific workflow including its steps, channels, payload structure, and configuration",
		"/v2/workflows/{id}",
		"fetched workflow",
		"workflowId",
		"The workflow ID to retrieve (obtained from get_workflows)"
	);

	// Trigger workflow - custom logic using the factory
	ToolFactory.createTool(server, getApiKey, getServerRegion, {
		name: "trigger_workflow",
		description: "Trigger a workflow to send notifications to a subscriber with custom payload data",
		schema: triggerWorkflowInputSchema,
		handler: ToolFactory.handleTriggerWorkflow
	});

	// Create workflow - complex validation and POST
	ToolFactory.createTool(server, getApiKey, getServerRegion, {
		name: "create_workflow",
		description: "Create a new workflow in Novu with comprehensive configuration including steps, preferences, and validation. IMPORTANT: When using dynamic variables in message content, always use {{payload.variableName}} syntax, NOT {{variableName}}. For example: use '{{payload.userName}}' not '{{userName}}'. NOTE: Email, in-app, and push steps all use 'subject' and 'body' properties. SMS steps use 'message' property.",
		schema: createWorkflowInputSchema,
		handler: async (input, context) => {
			console.log(`Creating workflow "${input.name}" with ID "${input.workflowId}"`);
			
			// Validate step configurations
			const stepValidationError = WorkflowValidationUtils.validateWorkflowSteps(input.steps);
			if (stepValidationError) {
				return stepValidationError;
			}
			
			// Build request body, filtering out undefined values
			const requestBody: any = {
				name: input.name,
				workflowId: input.workflowId,
				steps: input.steps,
				active: input.active ?? false,
				isTranslationEnabled: input.isTranslationEnabled ?? false,
				__source: input.__source ?? "editor"
			};

			// Add optional fields only if they exist
			if (input.description) requestBody.description = input.description;
			if (input.tags) requestBody.tags = input.tags;
			if (input.validatePayload !== undefined) requestBody.validatePayload = input.validatePayload;
			if (input.payloadSchema) requestBody.payloadSchema = input.payloadSchema;
			if (input.preferences) requestBody.preferences = input.preferences;

			return ToolFactory.makeApiRequest(context, {
				method: 'POST',
				endpoint: '/v2/workflows',
				body: requestBody,
				successMessage: 'created workflow',
				identifier: input.workflowId,
				customHeaders: { "Content-Type": "application/json" }
			}, input.idempotencyKey);
		}
	});

	// Update workflow - complex validation and PUT
	ToolFactory.createTool(server, getApiKey, getServerRegion, {
		name: "update_workflow",
		description: "Update an existing workflow in Novu with comprehensive configuration including steps, preferences, and validation. IMPORTANT: When using dynamic variables in message content, always use {{payload.variableName}} syntax, NOT {{variableName}}. For example: use '{{payload.userName}}' not '{{userName}}'. NOTE: Email, in-app, and push steps all use 'subject' and 'body' properties. SMS steps use 'message' property.",
		schema: updateWorkflowInputSchema,
		handler: async (input, context) => {
			console.log(`Updating workflow "${input.workflowId}" with name "${input.name}"`);
			
			// Validate step configurations
			const stepValidationError = WorkflowValidationUtils.validateWorkflowSteps(input.steps);
			if (stepValidationError) {
				return stepValidationError;
			}
			
			// Build request body, always including required fields
			const requestBody: any = {
				name: input.name,
				steps: input.steps,
				preferences: input.preferences,
				origin: input.origin,
				active: input.active ?? false,
				isTranslationEnabled: input.isTranslationEnabled ?? false
			};

			// Add optional fields only if they exist
			if (input.description) requestBody.description = input.description;
			if (input.tags) requestBody.tags = input.tags;
			if (input.validatePayload !== undefined) requestBody.validatePayload = input.validatePayload;
			if (input.payloadSchema) requestBody.payloadSchema = input.payloadSchema;

			return ToolFactory.makeApiRequest(context, {
				method: 'PUT',
				endpoint: `/v2/workflows/${input.workflowId}`,
				body: requestBody,
				successMessage: 'updated workflow',
				identifier: input.workflowId,
				customHeaders: { "Content-Type": "application/json" }
			}, input.idempotencyKey);
		}
	});

	// Cancel a triggered event by transactionId
	ToolFactory.createDeleteTool(
		server,
		getApiKey,
		getServerRegion,
		"cancel_triggered_event",
		"Cancel a pending triggered event (e.g. a delayed or digest notification that hasn't been sent yet) using its transactionId. The transactionId is returned when you trigger a workflow.",
		"/v1/events/trigger/{id}",
		"cancelled triggered event",
		"transactionId",
		"The transactionId of the triggered event to cancel (returned from trigger_workflow)"
	);

	// Bulk trigger workflows
	ToolFactory.createTool(server, getApiKey, getServerRegion, {
		name: "bulk_trigger_workflow",
		description: "Trigger multiple workflows in a single API call. Each event in the array specifies a workflow name, subscriber, and payload. Useful for batch notification operations.",
		schema: z.object({
			events: z.array(z.object({
				name: z.string().describe("The workflow name/identifier to trigger"),
				to: z.union([
					z.string().describe("A single subscriberId"),
					z.object({ subscriberId: z.string() }).describe("A subscriber object with subscriberId"),
				]).describe("The subscriber to send to"),
				payload: z.record(z.any()).describe("The payload data for this workflow trigger"),
				overrides: z.object({
					email: z.object({ integrationIdentifier: z.string() }).optional(),
					sms: z.object({ integrationIdentifier: z.string() }).optional(),
					push: z.object({ integrationIdentifier: z.string() }).optional(),
					chat: z.object({ integrationIdentifier: z.string() }).optional(),
					in_app: z.object({ integrationIdentifier: z.string() }).optional(),
				}).optional().describe("Channel-specific integration overrides"),
			})).min(1).describe("Array of workflow trigger events"),
			idempotencyKey: z.string().optional().describe("Optional idempotency key for the request"),
		}),
		handler: async (input, context) => {
			const events = input.events.map(event => ({
				name: event.name,
				to: typeof event.to === 'string' ? { subscriberId: event.to } : event.to,
				payload: event.payload,
				...(event.overrides && { overrides: event.overrides }),
			}));
			return ToolFactory.makeApiRequest(context, {
				method: 'POST',
				endpoint: '/v1/events/trigger/bulk',
				body: { events },
				successMessage: `bulk triggered ${events.length} workflow(s)`,
			}, input.idempotencyKey);
		}
	});

	// Delete workflow - simple DELETE by ID
	ToolFactory.createDeleteTool(
		server,
		getApiKey,
		getServerRegion,
		"delete_workflow",
		"Delete an existing workflow from Novu by its unique identifier. This action is irreversible.",
		"/v2/workflows/{id}",
		"deleted workflow",
		"workflowId",
		"The unique identifier of the workflow to delete"
	);
}   