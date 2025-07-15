import type { ApiResponse } from '../types';

export class ValidationUtils {
	/**
	 * Validate API key and return error if not set
	 */
	static validateApiKey(apiKey: string | null): ApiResponse | null {
		if (!apiKey) {
			return {
				content: [{ 
					type: "text" as const, 
					text: "Error: No API key is set. Please provide your Novu API key in the Authorization header:\nAuthorization: Bearer your-key" 
				}],
			};
		}
		return null;
	}

	/**
	 * Validate that at least one query parameter is provided
	 */
	static validateAtLeastOneParam(params: Record<string, any>, paramNames: string[]): ApiResponse | null {
		const hasAnyParam = paramNames.some(name => params[name] !== undefined && params[name] !== null);
		
		if (!hasAnyParam) {
			const paramList = paramNames.join(', ');
			return {
				content: [{ 
					type: "text" as const, 
					text: `Error: At least one query parameter is required (${paramList}).` 
				}],
			};
		}
		return null;
	}

	/**
	 * Validate pagination parameters
	 */
	static validatePagination(page?: number, limit?: number): ApiResponse | null {
		if (page !== undefined && page < 0) {
			return {
				content: [{ 
					type: "text" as const, 
					text: "Error: Page number must be 0 or greater." 
				}],
			};
		}

		if (limit !== undefined && (limit < 1 || limit > 50)) {
			return {
				content: [{ 
					type: "text" as const, 
					text: "Error: Limit must be between 1 and 50." 
				}],
			};
		}

		return null;
	}
} 