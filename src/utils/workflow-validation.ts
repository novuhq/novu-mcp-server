import type { ApiResponse } from "../types";
import type { WorkflowStep } from "./workflow-schemas";

/**
 * Cross-cutting workflow validations Zod can't express.
 *
 * Per-step type/shape validation now lives in `workflowStepSchema`
 * (discriminated union) and runs at parse time. This file only handles:
 *   - Maily document non-emptiness (empty `doc.content` produces an empty
 *     email even though it's structurally valid).
 *   - HTTP request method ↔ body coherence.
 *   - Digest/throttle group key references existing in the payload schema
 *     (best-effort, only when `payloadSchema` is provided).
 */

interface ValidationContext {
	payloadSchema?: Record<string, unknown>;
}

export class WorkflowValidationUtils {
	static validateWorkflowSteps(
		steps: WorkflowStep[],
		context: ValidationContext = {},
	): ApiResponse | null {
		for (const step of steps) {
			const stepError = WorkflowValidationUtils.validateSingleStep(
				step,
				context,
			);
			if (stepError) return stepError;
		}

		return null;
	}

	private static validateSingleStep(
		step: WorkflowStep,
		context: ValidationContext,
	): ApiResponse | null {
		switch (step.type) {
			case "email":
				return WorkflowValidationUtils.validateEmailStep(step);
			case "http_request":
				return WorkflowValidationUtils.validateHttpRequestStep(step);
			case "digest":
				return WorkflowValidationUtils.validateDigestStep(step, context);
			case "throttle":
				return WorkflowValidationUtils.validateThrottleStep(step, context);
			default:
				return null;
		}
	}

	private static validateEmailStep(
		step: Extract<WorkflowStep, { type: "email" }>,
	): ApiResponse | null {
		if (step.controlValues.editorType !== "block") return null;

		const body = step.controlValues.body;
		if (!body || !Array.isArray(body.content) || body.content.length === 0) {
			return errorResponse(
				`Email step "${step.name}" has an empty Maily document. Add at least one content node (paragraph, heading, button, etc.).`,
			);
		}

		return null;
	}

	private static validateHttpRequestStep(
		step: Extract<WorkflowStep, { type: "http_request" }>,
	): ApiResponse | null {
		const { method, body } = step.controlValues;
		const hasBody = Array.isArray(body) && body.length > 0;
		const bodyMethods = new Set(["POST", "PUT", "PATCH"]);

		if (hasBody && !bodyMethods.has(method)) {
			return errorResponse(
				`HTTP request step "${step.name}" includes a body but uses method ${method}. Body is only sent for POST, PUT, or PATCH requests.`,
			);
		}

		return null;
	}

	private static validateDigestStep(
		step: Extract<WorkflowStep, { type: "digest" }>,
		context: ValidationContext,
	): ApiResponse | null {
		const digestKey = step.controlValues.digestKey;
		if (!digestKey) return null;

		return WorkflowValidationUtils.validateVariableReference({
			stepName: step.name,
			fieldLabel: "digestKey",
			variablePath: digestKey,
			payloadSchema: context.payloadSchema,
		});
	}

	private static validateThrottleStep(
		step: Extract<WorkflowStep, { type: "throttle" }>,
		context: ValidationContext,
	): ApiResponse | null {
		const cv = step.controlValues;
		const throttleKey = cv.throttleKey;
		const dynamicKey = cv.type === "dynamic" ? cv.dynamicKey : undefined;

		const throttleKeyError = throttleKey
			? WorkflowValidationUtils.validateVariableReference({
					stepName: step.name,
					fieldLabel: "throttleKey",
					variablePath: throttleKey,
					payloadSchema: context.payloadSchema,
				})
			: null;

		if (throttleKeyError) return throttleKeyError;

		if (dynamicKey) {
			return WorkflowValidationUtils.validateVariableReference({
				stepName: step.name,
				fieldLabel: "dynamicKey",
				variablePath: dynamicKey,
				payloadSchema: context.payloadSchema,
			});
		}

		return null;
	}

	private static validateVariableReference(args: {
		stepName: string;
		fieldLabel: string;
		variablePath: string;
		payloadSchema?: Record<string, unknown>;
	}): ApiResponse | null {
		const { stepName, fieldLabel, variablePath, payloadSchema } = args;

		if (!payloadSchema) return null;
		if (!variablePath.startsWith("payload.")) return null;

		const path = variablePath.slice("payload.".length).split(".");
		if (path.length === 0 || !path[0]) return null;

		if (!schemaHasPath(payloadSchema, path)) {
			return errorResponse(
				`Step "${stepName}" references unknown payload variable "${variablePath}" via ${fieldLabel}. Add the property to the workflow's payloadSchema or remove the reference.`,
			);
		}

		return null;
	}
}

function schemaHasPath(
	schema: Record<string, unknown>,
	path: string[],
): boolean {
	let cursor: Record<string, unknown> | undefined = schema;
	for (const segment of path) {
		const props = cursor?.properties as Record<string, unknown> | undefined;
		if (!props || typeof props !== "object" || !(segment in props))
			return false;
		cursor = props[segment] as Record<string, unknown> | undefined;
	}

	return true;
}

function errorResponse(text: string): ApiResponse {
	return {
		content: [{ type: "text" as const, text: `Error: ${text}` }],
	};
}
