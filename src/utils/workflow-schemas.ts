import { z } from "zod";

// Common schema components
export const workflowStepTypeSchema = z.enum([
	"in_app", "email", "sms", "chat", "push", "digest", "trigger", "delay", "custom"
]);

export const delayUnitSchema = z.enum(["seconds", "minutes", "hours", "days", "weeks", "months"]);

export const editorTypeSchema = z.enum(["block", "html"]);

export const digestIntervalTypeSchema = z.enum(["regular", "scheduled"]);

export const workflowSourceSchema = z.enum([
	"template_store", "editor", "notification_directory", "onboarding_digest_demo",
	"onboarding_in_app", "empty_state", "dropdown", "onboarding_get_started", "bridge", "dashboard"
]);

export const workflowOriginSchema = z.enum(["novu-cloud", "novu-cloud-v1", "external"]);

// Action schemas for in-app notifications
export const actionSchema = z.object({
	label: z.string().optional().describe("Label for the action button. Use {{payload.variableName}} syntax for variables"),
	url: z.string().optional().describe("URL for the action. Use {{payload.variableName}} syntax for variables")
});

// Control values schema for different step types
export const stepControlValuesSchema = z.object({
	// Common skip condition for all step types
	skip: z.object({}).passthrough().optional().describe("JSONLogic filter conditions for conditionally skipping step execution"),
	
	// Email, In-App, and Push step specific fields (all use subject/body)
	subject: z.string().optional().describe("Subject/title of the email, in-app, or push notification (required for email, in-app, and push steps). Use {{payload.variableName}} syntax for variables, e.g., 'Welcome {{payload.userName}}'"),
	body: z.string().optional().describe("Body content of the email, in-app, or push notification (required for email, in-app, and push steps). For email: either a valid Maily JSON object, or html string. For in-app and push: plain text content. Use {{payload.variableName}} syntax for variables, e.g., 'Hello {{payload.userName}}, your order {{payload.orderId}} is ready!'"),
	editorType: editorTypeSchema.optional().describe("Type of editor to use for the email body"),
	disableOutputSanitization: z.boolean().optional().describe("Disable sanitization of the email or in-app output"),
	layoutId: z.string().nullable().optional().describe("Layout ID to use for the email. Null means no layout"),
	
	// In-App step specific fields
	avatar: z.string().optional().describe("Avatar URL for the in-app notification. Can use {{payload.variableName}} syntax, e.g., '{{payload.avatarUrl}}'"),
	primaryAction: actionSchema.optional().describe("Primary action configuration for in-app notification"),
	secondaryAction: actionSchema.optional().describe("Secondary action configuration for in-app notification"),
	
	// SMS step specific fields
	message: z.string().optional().describe("SMS message content (required for SMS steps). Use {{payload.variableName}} syntax for variables, e.g., 'Hi {{payload.firstName}}, your verification code is {{payload.code}}'"),
	
	// Delay step specific fields
	amount: z.number().optional().describe("Amount of time to delay (required for delay steps)"),
	unit: delayUnitSchema.optional().describe("Unit of time for delay (required for delay steps)"),
	
	// Digest step specific fields
	digestKey: z.string().optional().describe("Key for digest grouping"),
	digestIntervalType: digestIntervalTypeSchema.optional().describe("Type of digest interval"),
	digestInterval: z.number().optional().describe("Digest interval amount"),
	digestIntervalUnit: delayUnitSchema.optional().describe("Digest interval unit"),
	
	// Custom step specific fields - flexible object
	customData: z.object({}).passthrough().optional().describe("Custom data for custom step types")
}).passthrough();

// Workflow step schema
export const workflowStepSchema = z.object({
	_id: z.string().optional().describe("Unique identifier of the step"),
	name: z.string().describe("Name of the step"),
	type: workflowStepTypeSchema.describe("Type of the step"),
	controlValues: stepControlValuesSchema.optional().describe("Control values for the step - structure depends on step type. IMPORTANT: Always use {{payload.variableName}} syntax for dynamic variables, NOT just {{variableName}}")
});

// Channel preferences schema
export const channelPreferencesSchema = z.object({
	email: z.boolean().optional().describe("Email channel preference"),
	sms: z.boolean().optional().describe("SMS channel preference"),
	in_app: z.boolean().optional().describe("In-app channel preference"),
	push: z.boolean().optional().describe("Push channel preference"),
	chat: z.boolean().optional().describe("Chat channel preference")
});

// User/workflow preferences schema
export const preferencesObjectSchema = z.object({
	enabled: z.boolean().optional().describe("Whether preferences are enabled"),
	channels: channelPreferencesSchema.optional().describe("Channel preferences")
});

// Full workflow preferences schema
export const workflowPreferencesSchema = z.object({
	user: preferencesObjectSchema.optional().describe("User workflow preferences"),
	workflow: preferencesObjectSchema.optional().describe("Workflow-specific preferences")
});

// Base workflow input schema (shared between create and update)
export const baseWorkflowInputSchema = z.object({
	name: z.string().describe("Name of the workflow"),
	description: z.string().optional().describe("Description of the workflow"),
	tags: z.array(z.string()).optional().describe("Tags associated with the workflow"),
	active: z.boolean().optional().default(false).describe("Whether the workflow is active"),
	validatePayload: z.boolean().optional().describe("Enable or disable payload schema validation"),
	payloadSchema: z.object({}).passthrough().optional().describe("The payload JSON Schema for the workflow"),
	isTranslationEnabled: z.boolean().optional().default(false).describe("Enable or disable translations for this workflow"),
	steps: z.array(workflowStepSchema).min(1).describe("Steps of the workflow - at least one step is required. Remember: use {{payload.variableName}} for dynamic content, e.g., {{payload.userName}}, {{payload.orderId}}, {{payload.amount}}"),
	preferences: workflowPreferencesSchema.optional().describe("Workflow preferences configuration"),
	idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
});

// Create workflow specific schema
export const createWorkflowInputSchema = baseWorkflowInputSchema.extend({
	workflowId: z.string().describe("Unique identifier for the workflow"),
	__source: workflowSourceSchema.optional().default("editor").describe("Source of workflow creation")
});

// Update workflow specific schema
export const updateWorkflowInputSchema = baseWorkflowInputSchema.extend({
	workflowId: z.string().describe("The unique identifier of the workflow to update"),
	origin: workflowOriginSchema.describe("Origin of the workflow")
});

// Simple tool input schemas
export const idempotencyKeySchema = z.object({
	idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
});

export const workflowIdInputSchema = z.object({
	workflowId: z.string().describe("The workflow ID to retrieve (obtained from get_workflows)"),
	idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
});

export const triggerWorkflowInputSchema = z.object({
	workflowName: z.string().describe("The workflow name/identifier to trigger (obtained from get_workflows)"),
	subscriberId: z.string().describe("The subscriber ID to send the notification to (obtained from find_subscribers)"),
	payload: z.record(z.any()).describe("The payload data for the workflow (structure obtained from get_workflow)"),
	idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
});

export const deleteWorkflowInputSchema = z.object({
	workflowId: z.string().describe("The unique identifier of the workflow to delete"),
	idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
}); 