import { z } from "zod";
import { mailyBodySchema } from "./maily-schemas";
import { createSkipConditionSchema } from "./skip-schemas";

/**
 * Workflow step schemas — one discriminated union member per Novu step type.
 *
 * Step-related enums live here (not in workflow-schemas.ts) so that
 * workflow-schemas.ts can import `workflowStepSchema` from this file
 * without creating a circular dependency.
 *
 * Each control-value sub-schema is built via a `createXSchema()` factory so
 * shared sub-schemas (e.g. skip conditions) are emitted as inline Zod
 * objects rather than shared `$ref`s — important for MCP clients that
 * struggle with deep `$defs` chains.
 */

// --- Step-related enums --------------------------------------------------

export const stepTypeSchema = z.enum([
	"in_app",
	"email",
	"sms",
	"chat",
	"push",
	"digest",
	"trigger",
	"delay",
	"throttle",
	"custom",
	"http_request",
]);
export type StepType = z.infer<typeof stepTypeSchema>;

export const timeUnitSchema = z.enum([
	"seconds",
	"minutes",
	"hours",
	"days",
	"weeks",
	"months",
]);
export type TimeUnit = z.infer<typeof timeUnitSchema>;

export const delayTypeSchema = z.enum(["regular", "timed"]);
export type DelayType = z.infer<typeof delayTypeSchema>;

export const digestTypeSchema = z.enum(["regular", "timed"]);
export type DigestType = z.infer<typeof digestTypeSchema>;

export const throttleTypeSchema = z.enum(["fixed", "dynamic"]);
export type ThrottleType = z.infer<typeof throttleTypeSchema>;

export const editorTypeSchema = z.enum(["block", "html"]);
export type EditorType = z.infer<typeof editorTypeSchema>;

export const httpMethodSchema = z.enum([
	"GET",
	"POST",
	"PUT",
	"DELETE",
	"PATCH",
	"HEAD",
	"OPTIONS",
]);
export type HttpMethod = z.infer<typeof httpMethodSchema>;

export const redirectTargetSchema = z.enum([
	"_self",
	"_blank",
	"_parent",
	"_top",
	"_unfencedTop",
]);
export type RedirectTarget = z.infer<typeof redirectTargetSchema>;

// --- Action / redirect helpers --------------------------------------------

function createRedirectSchema() {
	return z.object({
		url: z
			.string()
			.describe(
				'Redirect URL accepts absolute "https://" or "/" relative paths. Dynamic values MUST be wrapped in double curly braces, e.g. "{{ payload.url }}". Must not start with "mailto:".',
			),
		target: redirectTargetSchema
			.optional()
			.describe('Redirect target. Use "_self" for same window (default).'),
	});
}

function createActionSchema() {
	return z.object({
		label: z
			.string()
			.describe(
				"Label for the action button.",
			),
		redirect: createRedirectSchema()
			.optional()
			.describe("Redirect configuration for the action."),
	});
}

// --- Per-channel control schemas (factories) ------------------------------

function createInAppControlSchema() {
	return z.object({
		subject: z
			.string()
			.describe(
				"In-app notification title.",
			),
		body: z
			.string()
			.describe(
				"In-app notification body.",
			),
		avatar: z
			.string()
			.optional()
			.describe(
				"Avatar image URL for the in-app notification. Must be an absolute https:// URL or a /relative path.",
			),
		primaryAction: createActionSchema()
			.optional()
			.describe("Primary action button for the in-app notification."),
		secondaryAction: createActionSchema()
			.optional()
			.describe("Secondary action button for the in-app notification."),
		redirect: createRedirectSchema()
			.optional()
			.describe(
				"Redirect configuration applied for the in-app notification action when the in-app notification is clicked.",
			),
		disableOutputSanitization: z
			.boolean()
			.optional()
			.describe("Disable sanitization of the in-app output."),
		skip: createSkipConditionSchema(),
	});
}

function createSmsControlSchema() {
	return z.object({
		body: z
			.string()
			.describe(
				"SMS message body (non-empty). Keep messages under 160 characters to avoid splitting.",
			),
		skip: createSkipConditionSchema(),
	});
}

function createPushControlSchema() {
	return z.object({
		subject: z
			.string()
			.describe(
				"Push notification title (non-empty). Title (subject) should be under 50 characters (gets truncated on most devices).",
			),
		body: z
			.string()
			.describe(
				"Push notification body (non-empty). Body should be under 150 characters for full visibility.",
			),
		skip: createSkipConditionSchema(),
	});
}

function createChatControlSchema() {
	return z.object({
		body: z
			.string()
			.describe(
				"Chat message body (non-empty). Be specific about what the user should do.",
			),
		skip: createSkipConditionSchema(),
	});
}

function createEmailBlockControlSchema() {
	return z.object({
		editorType: z
			.literal("block")
			.describe(
				'Block editor mode. Use "block" when building simple emails layouts.',
			),
		subject: z
			.string()
			.describe(
				"Email subject line.",
			),
		body: mailyBodySchema.describe("Email body in Maily TipTap JSON format."),
		layoutId: z
			.string()
			.nullable()
			.optional()
			.describe(
				"Layout ID to use for the email. Pass null explicitly for no layout.",
			),
		disableOutputSanitization: z
			.boolean()
			.optional()
			.describe("Disable sanitization of the email output."),
		skip: createSkipConditionSchema(),
	});
}

function createEmailHtmlControlSchema() {
	return z.object({
		editorType: z
			.literal("html")
			.describe(
				'HTML editor mode. Use "html" when building complex emails layouts.',
			),
		subject: z
			.string()
			.describe(
				"Email subject line.",
			),
		body: z
			.string()
			.describe(
				"Email body in HTML format (non-empty). Use semantic HTML with inline styles. Structure with headings, paragraphs, and styled buttons.",
			),
		layoutId: z
			.string()
			.nullable()
			.optional()
			.describe(
				"Layout ID to use for the email. Pass null explicitly for no layout.",
			),
		disableOutputSanitization: z
			.boolean()
			.optional()
			.describe("Disable sanitization of the email output."),
		skip: createSkipConditionSchema(),
	});
}

function createEmailControlSchema() {
	return z.discriminatedUnion("editorType", [
		createEmailBlockControlSchema(),
		createEmailHtmlControlSchema(),
	]);
}

function createDelayRegularControlSchema() {
	return z.object({
		type: z
			.literal("regular")
			.describe('Regular delay type ("wait for amount + unit").'),
		amount: z
			.number()
			.min(1)
			.describe("Amount of time to delay (must be >= 1)."),
		unit: timeUnitSchema.describe("Time unit for the delay."),
		skip: createSkipConditionSchema(),
	});
}

function createDelayTimedControlSchema() {
	return z.object({
		type: z
			.literal("timed")
			.describe('Timed delay type ("wait until cron schedule").'),
		cron: z
			.string()
			.describe("Cron expression for the timed delay (non-empty)."),
		skip: createSkipConditionSchema(),
	});
}

function createDelayControlSchema() {
	return z.discriminatedUnion("type", [
		createDelayRegularControlSchema(),
		createDelayTimedControlSchema(),
	]);
}

function createDigestRegularControlSchema() {
	return z.object({
		type: z
			.literal("regular")
			.describe(
				"Regular digest. Groups events within the configured time window starting from the first event.",
			),
		amount: z
			.number()
			.min(1)
			.describe("Amount of time for the digest window (must be >= 1)."),
		unit: timeUnitSchema.describe("Time unit for the digest window."),
		digestKey: z
			.string()
			.optional()
			.describe(
				"Variable path to group notifications by, e.g. 'payload.orderId'. Omit to group across all events for the subscriber.",
			),
		lookBackWindow: z
			.object({
				amount: z
					.number()
					.min(1)
					.describe("Amount of time for the look-back window (must be >= 1)."),
				unit: timeUnitSchema.describe("Time unit for the look-back window."),
				extendToSchedule: z
					.boolean()
					.optional()
					.describe("Extend the look-back window to the schedule."),
			})
			.optional()
			.describe("Look-back window configuration for the digest."),
		extendToSchedule: z
			.boolean()
			.optional()
			.describe("Extend the digest window to the schedule."),
		skip: createSkipConditionSchema(),
	});
}

function createDigestTimedControlSchema() {
	return z.object({
		type: z
			.literal("timed")
			.describe(
				"Timed digest. Collects events until a specific scheduled time (UTC), then continues with all collected events.",
			),
		cron: z
			.string()
			.describe("Cron expression for the timed digest (non-empty)."),
		digestKey: z
			.string()
			.optional()
			.describe("Variable path to group notifications by."),
		extendToSchedule: z
			.boolean()
			.optional()
			.describe("Extend the digest window to the schedule."),
		skip: createSkipConditionSchema(),
	});
}

function createDigestControlSchema() {
	return z.discriminatedUnion("type", [
		createDigestRegularControlSchema(),
		createDigestTimedControlSchema(),
	]);
}

function createThrottleFixedControlSchema() {
	return z.object({
		type: z
			.literal("fixed")
			.describe(
				"Fixed throttle. Allows up to `threshold` notifications per fixed window of `amount` + `unit`.",
			),
		amount: z
			.number()
			.min(1)
			.describe("Amount of time for the throttle window (must be >= 1)."),
		unit: timeUnitSchema.describe("Time unit for the throttle window."),
		threshold: z
			.number()
			.min(1)
			.describe(
				"Maximum number of notifications allowed in the window (must be >= 1).",
			),
		throttleKey: z
			.string()
			.optional()
			.describe(
				"Variable path to group throttle rules by, e.g. 'payload.userId'.",
			),
		skip: createSkipConditionSchema(),
	});
}

function createThrottleDynamicControlSchema() {
	return z.object({
		type: z
			.literal("dynamic")
			.describe(
				"Dynamic throttle. Throttle window is derived at runtime from the `dynamicKey` variable.",
			),
		dynamicKey: z
			.string()
			.describe(
				"Variable path that resolves the dynamic throttle window at runtime, e.g. 'payload.windowMs'.",
			),
		threshold: z
			.number()
			.min(1)
			.describe(
				"Maximum number of notifications allowed in the window (must be >= 1).",
			),
		throttleKey: z
			.string()
			.optional()
			.describe("Variable path to group throttle rules by."),
		skip: createSkipConditionSchema(),
	});
}

function createThrottleControlSchema() {
	return z.discriminatedUnion("type", [
		createThrottleFixedControlSchema(),
		createThrottleDynamicControlSchema(),
	]);
}

function createHttpKeyValuePairSchema() {
	return z.object({
		key: z.string().min(1).describe("Header or body key (non-empty)."),
		value: z
			.string()
			.describe(
				"Header or body value. Use {{payload.variableName}} for dynamic values.",
			),
	});
}

function createHttpResponsePropertySchema() {
	return z.object({
		name: z.string().describe("Response property name."),
		type: z
			.enum(["string", "number", "boolean", "integer", "array", "object"])
			.describe("JSON Schema type for this property."),
	});
}

function createHttpRequestControlSchema() {
	return z.object({
		method: httpMethodSchema.describe(
			"HTTP method for the request (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS).",
		),
		url: z
			.string()
			.describe(
				"Absolute URL for the HTTP request. Supports template variables, e.g. 'https://api.example.com/notify' or '{{payload.webhookUrl}}'.",
			),
		headers: z
			.array(createHttpKeyValuePairSchema())
			.optional()
			.describe(
				"HTTP request headers as key-value pairs. Always include 'Content-Type: application/json' when sending a JSON body.",
			),
		body: z
			.array(createHttpKeyValuePairSchema())
			.optional()
			.describe(
				"Request body as key-value pairs (only for POST/PUT/PATCH). Use template variables for dynamic values.",
			),
		responseBodySchema: z
			.object({
				type: z
					.string()
					.optional()
					.describe('JSON Schema type keyword (always "object").'),
				properties: z
					.array(createHttpResponsePropertySchema())
					.optional()
					.describe("Response properties as name+type pairs."),
				required: z
					.array(z.string())
					.optional()
					.describe("JSON Schema required property names."),
			})
			.optional()
			.describe(
				"JSON Schema describing the expected HTTP response shape. Defines which properties are available as steps.<http-step-id>.<property> in subsequent steps.",
			),
		enforceSchemaValidation: z
			.boolean()
			.optional()
			.describe(
				"When true, validate the response body against responseBodySchema at runtime. Default: false.",
			),
		timeout: z
			.number()
			.min(100)
			.max(30000)
			.optional()
			.describe(
				"Timeout in milliseconds before the request is aborted (must be 100–30000). Default: 5000.",
			),
		continueOnFailure: z
			.boolean()
			.optional()
			.describe(
				"When true, the workflow continues even if this HTTP request step fails. Default: false.",
			),
		skip: createSkipConditionSchema(),
	});
}

function createCustomControlSchema() {
	return z
		.object({
			skip: createSkipConditionSchema(),
		})
		.passthrough();
}

// --- Step schemas (discriminated by `type`) -------------------------------

function createBaseStepFields() {
	return {
		_id: z
			.string()
			.optional()
			.describe("Unique identifier of the step (omit for new steps)."),
		name: z.string().describe("Human-readable name of the step."),
	};
}

export const workflowStepSchema = z.discriminatedUnion("type", [
	z.object({
		...createBaseStepFields(),
		type: z.literal("in_app"),
		controlValues: createInAppControlSchema(),
	}),
	z.object({
		...createBaseStepFields(),
		type: z.literal("email"),
		controlValues: createEmailControlSchema(),
	}),
	z.object({
		...createBaseStepFields(),
		type: z.literal("sms"),
		controlValues: createSmsControlSchema(),
	}),
	z.object({
		...createBaseStepFields(),
		type: z.literal("push"),
		controlValues: createPushControlSchema(),
	}),
	z.object({
		...createBaseStepFields(),
		type: z.literal("chat"),
		controlValues: createChatControlSchema(),
	}),
	z.object({
		...createBaseStepFields(),
		type: z.literal("delay"),
		controlValues: createDelayControlSchema(),
	}),
	z.object({
		...createBaseStepFields(),
		type: z.literal("digest"),
		controlValues: createDigestControlSchema(),
	}),
	z.object({
		...createBaseStepFields(),
		type: z.literal("throttle"),
		controlValues: createThrottleControlSchema(),
	}),
	z.object({
		...createBaseStepFields(),
		type: z.literal("http_request"),
		controlValues: createHttpRequestControlSchema(),
	}),
	z.object({
		...createBaseStepFields(),
		type: z.literal("trigger"),
		controlValues: createCustomControlSchema(),
	}),
	z.object({
		...createBaseStepFields(),
		type: z.literal("custom"),
		controlValues: createCustomControlSchema(),
	}),
]);

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
