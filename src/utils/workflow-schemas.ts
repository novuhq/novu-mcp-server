import { z } from "zod";
import { workflowStepSchema } from "./step-schemas";

/**
 * Workflow input schemas for Novu MCP tools.
 *
 * Conventions (MCP-idiomatic):
 * - Use `.optional()` for genuinely optional fields (Novu API treats them as such).
 * - Use `.nullable()` only when the API accepts `null` as a meaningful value
 *   (e.g. `layoutId: null` → "no layout").
 * - Wrap discriminated unions inside a parent `z.object()`. The MCP TS SDK's
 *   `normalizeObjectSchema` silently drops top-level discriminated unions
 *   (modelcontextprotocol/typescript-sdk#1643), so callers must always
 *   register a `z.object` whose properties may contain unions.
 * - Use factory functions (`createXSchema`) when the same sub-schema is
 *   referenced from multiple union members. Reusing a single instance causes
 *   `zod-to-json-schema` to emit deeply-nested `$defs` chains that some MCP
 *   clients reject.
 * - Pack constraint hints into `.describe()` strings as well as `.min/.max`
 *   so the LLM sees them when reading the schema.
 *
 * File organisation:
 * - Skip-condition factories live in `./skip-schemas.ts`.
 * - Step-level schemas (per-channel control values, `workflowStepSchema`)
 *   live in `./step-schemas.ts`.
 * - Maily TipTap email body lives in `./maily-schemas.ts`.
 *
 * This file is the public entry point for workflow tooling and re-exports
 * the symbols above so existing imports of `./workflow-schemas` keep working.
 */

// --- Re-exports (backward compatibility) ---------------------------------

export { createSkipConditionSchema } from "./skip-schemas";
export {
	delayTypeSchema,
	digestTypeSchema,
	editorTypeSchema,
	httpMethodSchema,
	redirectTargetSchema,
	stepTypeSchema,
	throttleTypeSchema,
	timeUnitSchema,
	workflowStepSchema,
} from "./step-schemas";
export type {
	DelayType,
	DigestType,
	EditorType,
	HttpMethod,
	RedirectTarget,
	StepType,
	ThrottleType,
	TimeUnit,
	WorkflowStep,
} from "./step-schemas";

// --- Constants ------------------------------------------------------------

export const MAX_TAG_ELEMENTS = 16;
export const MAX_TAG_LENGTH = 64;
export const MAX_NAME_LENGTH = 128;
export const MAX_DESCRIPTION_LENGTH = 256;

// --- Workflow-level enums (not step-related) -----------------------------

export const severitySchema = z.enum(["none", "low", "medium", "high"]);
export type Severity = z.infer<typeof severitySchema>;

export const workflowSourceSchema = z.enum([
	"template_store",
	"editor",
	"notification_directory",
	"onboarding_digest_demo",
	"onboarding_in_app",
	"empty_state",
	"dropdown",
	"onboarding_get_started",
	"bridge",
	"dashboard",
]);

export const workflowOriginSchema = z.enum([
	"novu-cloud",
	"novu-cloud-v1",
	"external",
]);

// --- Preferences ----------------------------------------------------------

export const channelPreferencesSchema = z.object({
	email: z.boolean().optional().describe("Email channel preference."),
	sms: z.boolean().optional().describe("SMS channel preference."),
	in_app: z.boolean().optional().describe("In-app channel preference."),
	push: z.boolean().optional().describe("Push channel preference."),
	chat: z.boolean().optional().describe("Chat channel preference."),
});

export const preferencesObjectSchema = z.object({
	enabled: z.boolean().optional().describe("Whether preferences are enabled."),
	channels: channelPreferencesSchema
		.optional()
		.describe("Channel preferences."),
});

export const workflowPreferencesSchema = z.object({
	user: preferencesObjectSchema
		.optional()
		.describe("User workflow preferences."),
	workflow: preferencesObjectSchema
		.optional()
		.describe("Workflow-specific preferences."),
});

// --- Payload schema (flat-descriptor alternative) -------------------------

function createPayloadPropertyBaseSchema() {
	return z.object({
		name: z
			.string()
			.describe(
				'Property name. Use dot notation for nested paths, e.g. "order.total".',
			),
		isRequired: z
			.boolean()
			.optional()
			.describe(
				"Whether the property is required in the payload (default: true).",
			),
	});
}

export const payloadPropertySchema = z.union([
	createPayloadPropertyBaseSchema().extend({ type: z.literal("string") }),
	createPayloadPropertyBaseSchema().extend({ type: z.literal("number") }),
	createPayloadPropertyBaseSchema().extend({ type: z.literal("integer") }),
	createPayloadPropertyBaseSchema().extend({ type: z.literal("boolean") }),
	createPayloadPropertyBaseSchema().extend({
		type: z.literal("enum"),
		enumValues: z
			.array(z.string())
			.min(1)
			.describe(
				"The complete set of allowed values. Only use enum when the user explicitly defines a fixed list.",
			),
	}),
	createPayloadPropertyBaseSchema().extend({
		type: z.literal("array"),
		arrayItemsType: z
			.enum(["string", "number", "integer", "boolean", "object"])
			.describe("Type of each array element."),
		arrayItemProperties: z
			.array(
				z.object({
					name: z
						.string()
						.describe(
							'Property name. Use dot notation for nested paths (e.g. "address.city").',
						),
					type: z.enum(["string", "number", "integer", "boolean"]),
				}),
			)
			.optional()
			.describe(
				'Properties of each object in the array. Required when arrayItemsType is "object", omit for scalar arrays.',
			),
	}),
	createPayloadPropertyBaseSchema().extend({ type: z.literal("object") }),
]);

// --- Workflow input schemas ----------------------------------------------

export const baseWorkflowInputSchema = z.object({
	name: z
		.string()
		.max(MAX_NAME_LENGTH)
		.describe(
			`Name of the workflow (non-empty, max ${MAX_NAME_LENGTH} characters).`,
		),
	description: z
		.string()
		.max(MAX_DESCRIPTION_LENGTH)
		.optional()
		.describe(
			`Description of the workflow (max ${MAX_DESCRIPTION_LENGTH} characters).`,
		),
	tags: z
		.array(
			z
				.string()
				.max(MAX_TAG_LENGTH)
				.describe(`Tag value (max ${MAX_TAG_LENGTH} characters).`),
		)
		.max(MAX_TAG_ELEMENTS)
		.optional()
		.describe(
			`Tags associated with the workflow (max ${MAX_TAG_ELEMENTS} tags).`,
		),
	severity: severitySchema
		.optional()
		.describe(
			"Workflow severity: 'high' for critical alerts, 'medium' for important, 'low' for informational, 'none' for unspecified.",
		),
	critical: z
		.boolean()
		.optional()
		.describe(
			"When true, deliver messages regardless of user preferences. Use for security or account-blocking notifications.",
		),
	active: z.boolean().optional().describe("Whether the workflow is active."),
	validatePayload: z
		.boolean()
		.optional()
		.describe("Enable or disable payload schema validation."),
	payloadSchema: z
		.object({})
		.passthrough()
		.optional()
		.describe(
			"Raw JSON Schema for the workflow payload. Use this OR `payloadProperties` (flat descriptor list) — not both.",
		),
	payloadProperties: z
		.array(payloadPropertySchema)
		.optional()
		.describe(
			"Flat list of payload property descriptors. LLM-friendly alternative to `payloadSchema`. Tooling converts these to JSON Schema before sending to Novu.",
		),
	isTranslationEnabled: z
		.boolean()
		.optional()
		.describe("Enable or disable translations for this workflow."),
	steps: z
		.array(workflowStepSchema)
		.min(1)
		.describe(
			"Steps of the workflow — at least one step required. Each step is discriminated by `type`. Always use {{payload.variableName}} for dynamic content (e.g. {{payload.userName}}, {{payload.orderId}}).",
		),
	preferences: workflowPreferencesSchema
		.optional()
		.describe("Workflow preferences configuration."),
	idempotencyKey: z
		.string()
		.optional()
		.describe("Optional idempotency key for the request."),
});

// Create workflow specific schema
export const createWorkflowInputSchema = baseWorkflowInputSchema.extend({
	workflowId: z.string().describe("Unique identifier for the workflow."),
	__source: workflowSourceSchema
		.optional()
		.describe("Source of workflow creation."),
});

// Update workflow specific schema
export const updateWorkflowInputSchema = baseWorkflowInputSchema.extend({
	workflowId: z
		.string()
		.describe("The unique identifier of the workflow to update."),
	origin: workflowOriginSchema.describe("Origin of the workflow."),
});

// --- Trigger / cancel / delete -------------------------------------------

export const idempotencyKeySchema = z.object({
	idempotencyKey: z
		.string()
		.optional()
		.describe("Optional idempotency key for the request."),
});

export const workflowIdInputSchema = z.object({
	workflowId: z
		.string()
		.describe("The workflow ID to retrieve (obtained from get_workflows)."),
	idempotencyKey: z
		.string()
		.optional()
		.describe("Optional idempotency key for the request."),
});

export const triggerWorkflowInputSchema = z.object({
	workflowName: z
		.string()
		.describe(
			"The workflow name/identifier to trigger (obtained from get_workflows).",
		),
	subscriberId: z
		.string()
		.describe(
			"The subscriber ID to send the notification to (obtained from find_subscribers).",
		),
	payload: z
		.record(z.any())
		.describe(
			"The payload data for the workflow (structure obtained from get_workflow).",
		),
	overrides: z
		.object({
			email: z
				.object({ integrationIdentifier: z.string() })
				.optional()
				.describe("Override the email integration used for this trigger."),
			sms: z
				.object({ integrationIdentifier: z.string() })
				.optional()
				.describe("Override the SMS integration used for this trigger."),
			push: z
				.object({ integrationIdentifier: z.string() })
				.optional()
				.describe("Override the push integration used for this trigger."),
			chat: z
				.object({ integrationIdentifier: z.string() })
				.optional()
				.describe("Override the chat integration used for this trigger."),
			in_app: z
				.object({ integrationIdentifier: z.string() })
				.optional()
				.describe("Override the in-app integration used for this trigger."),
		})
		.optional()
		.describe(
			"Channel-specific overrides to select which integration to use. Use get_integrations to find available integration identifiers.",
		),
	idempotencyKey: z
		.string()
		.optional()
		.describe("Optional idempotency key for the request."),
});

export const deleteWorkflowInputSchema = z.object({
	workflowId: z
		.string()
		.describe("The unique identifier of the workflow to delete."),
	idempotencyKey: z
		.string()
		.optional()
		.describe("Optional idempotency key for the request."),
});

// --- Helpers -------------------------------------------------------------

interface JsonSchemaObjectNode {
	type: "object";
	properties: Record<string, JsonSchemaNode>;
	required: string[];
}

type JsonSchemaNode =
	| JsonSchemaObjectNode
	| {
			type: "string" | "number" | "integer" | "boolean";
			enum?: string[];
	  }
	| {
			type: "array";
			items: JsonSchemaNode;
	  };

/**
 * Convert a flat list of payload property descriptors into a JSON Schema
 * object suitable for Novu's `payloadSchema` field. Used by the create/update
 * workflow handlers when callers prefer the flat representation over raw JSON
 * Schema.
 */
export function payloadPropertiesToJsonSchema(
	properties: z.infer<typeof payloadPropertySchema>[],
): Record<string, unknown> {
	const root: JsonSchemaObjectNode = {
		type: "object",
		properties: {},
		required: [],
	};

	for (const prop of properties) {
		const isRequired = prop.isRequired !== false;
		const segments = prop.name.split(".");
		const leaf = segments[segments.length - 1];

		let cursor: JsonSchemaObjectNode = root;
		for (let i = 0; i < segments.length - 1; i++) {
			const segment = segments[i];
			const existing = cursor.properties[segment];
			const nextNode: JsonSchemaObjectNode =
				existing && existing.type === "object"
					? existing
					: { type: "object", properties: {}, required: [] };

			cursor.properties[segment] = nextNode;
			cursor = nextNode;
		}

		cursor.properties[leaf] = propertyDescriptorToJsonSchemaNode(prop);
		if (isRequired && !cursor.required.includes(leaf)) {
			cursor.required.push(leaf);
		}
	}

	return root as unknown as Record<string, unknown>;
}

function propertyDescriptorToJsonSchemaNode(
	prop: z.infer<typeof payloadPropertySchema>,
): JsonSchemaNode {
	switch (prop.type) {
		case "string":
		case "number":
		case "integer":
		case "boolean":
			return { type: prop.type };
		case "enum":
			return { type: "string", enum: prop.enumValues };
		case "object":
			return { type: "object", properties: {}, required: [] };
		case "array": {
			if (prop.arrayItemsType === "object") {
				const itemProperties: Record<string, JsonSchemaNode> = {};
				const required: string[] = [];
				for (const item of prop.arrayItemProperties ?? []) {
					itemProperties[item.name] = { type: item.type };
					required.push(item.name);
				}

				return {
					type: "array",
					items: { type: "object", properties: itemProperties, required },
				};
			}

			return { type: "array", items: { type: prop.arrayItemsType } };
		}
		default: {
			const exhaustive: never = prop;

			return exhaustive;
		}
	}
}
