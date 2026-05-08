import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServerRegion } from "../types";
import { ToolFactory } from "../utils/tool-factory";
import {
	createWorkflowInputSchema,
	payloadPropertiesToJsonSchema,
	triggerWorkflowInputSchema,
	updateWorkflowInputSchema,
} from "../utils/workflow-schemas";
import { WorkflowValidationUtils } from "../utils/workflow-validation";

const STEP_TYPE_GUIDE = [
	"Supported step types (set via `type` discriminator on each step):",
	"- in_app: subject + body",
	"- email: discriminated by editorType — 'block' (body = Maily TipTap JSON) or 'html' (body = HTML string)",
	"- sms: body (keep under 160 chars)",
	"- push: subject + body",
	"- chat: body",
	"- delay: discriminated by type — 'regular' (amount + unit) or 'timed' (cron)",
	"- digest: discriminated by type — 'regular' (amount + unit + optional digestKey) or 'timed' (cron + optional digestKey)",
	"- throttle: discriminated by type — 'fixed' (amount + unit + threshold) or 'dynamic' (dynamicKey + threshold)",
	"- http_request: method + url + optional headers/body key-value pairs",
	"- trigger / custom: passthrough",
	"Always use {{payload.variableName}} syntax (NOT {{variableName}}) for dynamic content.",
	'Skip conditions are JSONLogic objects on `controlValues.skip`, e.g. { "==": [{ "var": "subscriber.isOnline" }, true] }.',
].join("\n");

export function registerWorkflowTools(
	server: McpServer,
	getApiKey: () => string | null,
	getServerRegion: () => ServerRegion,
) {
	// Get all workflows - simple GET endpoint
	ToolFactory.createGetTool(
		server,
		getApiKey,
		getServerRegion,
		"get_workflows",
		"Get all available workflows from your Novu application with their basic information and identifiers",
		"/v2/workflows",
		"fetched workflows",
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
		"The workflow ID to retrieve (obtained from get_workflows)",
	);

	// Trigger workflow - custom logic using the factory
	ToolFactory.createTool(server, getApiKey, getServerRegion, {
		name: "trigger_workflow",
		description:
			"Trigger a workflow to send notifications to a subscriber with custom payload data",
		schema: triggerWorkflowInputSchema,
		handler: ToolFactory.handleTriggerWorkflow,
	});

	// Create workflow - complex validation and POST
	ToolFactory.createTool(server, getApiKey, getServerRegion, {
		name: "create_workflow",
		description: `Create a new workflow in Novu with comprehensive configuration including steps, preferences, and validation.\n\n${STEP_TYPE_GUIDE}`,
		schema: createWorkflowInputSchema,
		handler: async (input, context) => {
			console.log(
				`Creating workflow "${input.name}" with ID "${input.workflowId}"`,
			);

			const resolvedPayloadSchema = resolvePayloadSchema(input);
			const stepValidationError = WorkflowValidationUtils.validateWorkflowSteps(
				input.steps,
				{ payloadSchema: resolvedPayloadSchema },
			);
			if (stepValidationError) return stepValidationError;

			const requestBody: Record<string, unknown> = {
				name: input.name,
				workflowId: input.workflowId,
				steps: input.steps,
				active: input.active ?? false,
				isTranslationEnabled: input.isTranslationEnabled ?? false,
				__source: input.__source ?? "editor",
			};

			assignOptional(requestBody, {
				description: input.description,
				tags: input.tags,
				severity: input.severity,
				critical: input.critical,
				validatePayload: input.validatePayload,
				payloadSchema: resolvedPayloadSchema,
				preferences: input.preferences,
			});

			return ToolFactory.makeApiRequest(
				context,
				{
					method: "POST",
					endpoint: "/v2/workflows",
					body: requestBody,
					successMessage: "created workflow",
					identifier: input.workflowId,
					customHeaders: { "Content-Type": "application/json" },
				},
				input.idempotencyKey,
			);
		},
	});

	// Update workflow - complex validation and PUT
	ToolFactory.createTool(server, getApiKey, getServerRegion, {
		name: "update_workflow",
		description: `Update an existing workflow in Novu with comprehensive configuration including steps, preferences, and validation.\n\n${STEP_TYPE_GUIDE}`,
		schema: updateWorkflowInputSchema,
		handler: async (input, context) => {
			console.log(
				`Updating workflow "${input.workflowId}" with name "${input.name}"`,
			);

			const resolvedPayloadSchema = resolvePayloadSchema(input);
			const stepValidationError = WorkflowValidationUtils.validateWorkflowSteps(
				input.steps,
				{ payloadSchema: resolvedPayloadSchema },
			);
			if (stepValidationError) return stepValidationError;

			const requestBody: Record<string, unknown> = {
				name: input.name,
				steps: input.steps,
				preferences: input.preferences,
				origin: input.origin,
				active: input.active ?? false,
				isTranslationEnabled: input.isTranslationEnabled ?? false,
			};

			assignOptional(requestBody, {
				description: input.description,
				tags: input.tags,
				severity: input.severity,
				critical: input.critical,
				validatePayload: input.validatePayload,
				payloadSchema: resolvedPayloadSchema,
			});

			return ToolFactory.makeApiRequest(
				context,
				{
					method: "PUT",
					endpoint: `/v2/workflows/${input.workflowId}`,
					body: requestBody,
					successMessage: "updated workflow",
					identifier: input.workflowId,
					customHeaders: { "Content-Type": "application/json" },
				},
				input.idempotencyKey,
			);
		},
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
		"The transactionId of the triggered event to cancel (returned from trigger_workflow)",
	);

	// Bulk trigger workflows
	ToolFactory.createTool(server, getApiKey, getServerRegion, {
		name: "bulk_trigger_workflow",
		description:
			"Trigger multiple workflows in a single API call. Each event in the array specifies a workflow name, subscriber, and payload. Useful for batch notification operations.",
		schema: z.object({
			events: z
				.array(
					z.object({
						name: z
							.string()
							.describe("The workflow name/identifier to trigger"),
						to: z
							.union([
								z.string().describe("A single subscriberId"),
								z
									.object({ subscriberId: z.string() })
									.describe("A subscriber object with subscriberId"),
							])
							.describe("The subscriber to send to"),
						payload: z
							.record(z.any())
							.describe("The payload data for this workflow trigger"),
						overrides: z
							.object({
								email: z
									.object({ integrationIdentifier: z.string() })
									.optional(),
								sms: z.object({ integrationIdentifier: z.string() }).optional(),
								push: z
									.object({ integrationIdentifier: z.string() })
									.optional(),
								chat: z
									.object({ integrationIdentifier: z.string() })
									.optional(),
								in_app: z
									.object({ integrationIdentifier: z.string() })
									.optional(),
							})
							.optional()
							.describe("Channel-specific integration overrides"),
					}),
				)
				.min(1)
				.describe("Array of workflow trigger events"),
			idempotencyKey: z
				.string()
				.optional()
				.describe("Optional idempotency key for the request"),
		}),
		handler: async (input, context) => {
			const events = input.events.map((event) => ({
				name: event.name,
				to:
					typeof event.to === "string" ? { subscriberId: event.to } : event.to,
				payload: event.payload,
				...(event.overrides && { overrides: event.overrides }),
			}));

			return ToolFactory.makeApiRequest(
				context,
				{
					method: "POST",
					endpoint: "/v1/events/trigger/bulk",
					body: { events },
					successMessage: `bulk triggered ${events.length} workflow(s)`,
				},
				input.idempotencyKey,
			);
		},
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
		"The unique identifier of the workflow to delete",
	);
}

interface PayloadInputs {
	payloadSchema?: Record<string, unknown>;
	payloadProperties?: z.infer<
		typeof createWorkflowInputSchema
	>["payloadProperties"];
}

function resolvePayloadSchema(
	input: PayloadInputs,
): Record<string, unknown> | undefined {
	if (input.payloadSchema) return input.payloadSchema;
	if (input.payloadProperties && input.payloadProperties.length > 0) {
		return payloadPropertiesToJsonSchema(input.payloadProperties);
	}

	return undefined;
}

function assignOptional(
	target: Record<string, unknown>,
	values: Record<string, unknown>,
): void {
	for (const [key, value] of Object.entries(values)) {
		if (value !== undefined) target[key] = value;
	}
}
