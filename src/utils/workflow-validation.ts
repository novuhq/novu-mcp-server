import type { ApiResponse } from '../types';
import type { z } from 'zod';
import type { workflowStepSchema } from './workflow-schemas';

type WorkflowStep = z.infer<typeof workflowStepSchema>;

export class WorkflowValidationUtils {
	/**
	 * Validate workflow steps based on their types and required fields
	 */
	static validateWorkflowSteps(steps: WorkflowStep[]): ApiResponse | null {
		for (const step of steps) {
			const stepError = this.validateSingleStep(step);
			if (stepError) {
				return stepError;
			}
		}
		return null;
	}

	/**
	 * Validate a single workflow step
	 */
	private static validateSingleStep(step: WorkflowStep): ApiResponse | null {
		switch (step.type) {
			case 'email':
				return this.validateEmailStep(step);
			case 'sms':
				return this.validateSMSStep(step);
			case 'in_app':
				return this.validateInAppStep(step);
			case 'push':
				return this.validatePushStep(step);
			case 'delay':
				return this.validateDelayStep(step);
			case 'chat':
			case 'digest':
			case 'trigger':
			case 'custom':
				// These step types don't have strict validation requirements in the current implementation
				return null;
			default:
				return {
					content: [{ 
						type: "text" as const, 
						text: `Error: Unknown step type "${step.type}" for step "${step.name}"` 
					}],
				};
		}
	}

	/**
	 * Validate email step requirements
	 */
	private static validateEmailStep(step: WorkflowStep): ApiResponse | null {
		if (!step.controlValues?.subject || !step.controlValues?.body) {
			return {
				content: [{ 
					type: "text" as const, 
					text: `Error: Email step "${step.name}" requires both subject and body in controlValues. Remember to use {{payload.variableName}} syntax for dynamic variables.` 
				}],
			};
		}
		return null;
	}

	/**
	 * Validate SMS step requirements
	 */
	private static validateSMSStep(step: WorkflowStep): ApiResponse | null {
		if (!step.controlValues?.message) {
			return {
				content: [{ 
					type: "text" as const, 
					text: `Error: SMS step "${step.name}" requires message in controlValues. Remember to use {{payload.variableName}} syntax for dynamic variables.` 
				}],
			};
		}
		return null;
	}

	/**
	 * Validate in-app step requirements
	 */
	private static validateInAppStep(step: WorkflowStep): ApiResponse | null {
		if (!step.controlValues?.subject || !step.controlValues?.body) {
			return {
				content: [{ 
					type: "text" as const, 
					text: `Error: In-app step "${step.name}" requires both subject and body in controlValues. Remember to use {{payload.variableName}} syntax for dynamic variables.` 
				}],
			};
		}
		return null;
	}

	/**
	 * Validate push step requirements
	 */
	private static validatePushStep(step: WorkflowStep): ApiResponse | null {
		if (!step.controlValues?.subject || !step.controlValues?.body) {
			return {
				content: [{ 
					type: "text" as const, 
					text: `Error: Push step "${step.name}" requires both subject and body in controlValues. Remember to use {{payload.variableName}} syntax for dynamic variables.` 
				}],
			};
		}
		return null;
	}

	/**
	 * Validate delay step requirements
	 */
	private static validateDelayStep(step: WorkflowStep): ApiResponse | null {
		if (!step.controlValues?.amount || !step.controlValues?.unit) {
			return {
				content: [{ 
					type: "text" as const, 
					text: `Error: Delay step "${step.name}" requires both amount and unit in controlValues` 
				}],
			};
		}
		return null;
	}
} 