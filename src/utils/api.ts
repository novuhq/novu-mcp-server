import type { ServerRegion, NovuApiHeaders } from '../types';

export class NovuApiUtils {
	/**
	 * Get the base URL based on server region
	 */
	static getBaseUrl(serverRegion: ServerRegion): string {
		return serverRegion === 'eu' ? 'https://eu.api.novu.co' : 'https://api.novu.co';
	}

	/**
	 * Prepare headers for Novu API requests
	 */
	static prepareHeaders(apiKey: string, idempotencyKey?: string): Record<string, string> {
		const headers: Record<string, string> = {
			"Authorization": `ApiKey ${apiKey}`,
			"Content-Type": "application/json"
		};

		if (idempotencyKey) {
			headers["idempotency-key"] = idempotencyKey;
		}

		return headers;
	}

	/**
	 * Build query parameters from an object
	 */
	static buildQueryParams(params: Record<string, any>): URLSearchParams {
		const queryParams = new URLSearchParams();
		
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null) {
				if (Array.isArray(value)) {
					// Handle array parameters - add each item as separate parameter
					value.forEach(item => queryParams.append(key, item.toString()));
				} else {
					queryParams.append(key, value.toString());
				}
			}
		}

		return queryParams;
	}

	/**
	 * Handle API response and return formatted result
	 */
	static async handleApiResponse(response: Response, operation: string, identifier?: string) {
		if (!response.ok) {
			const errorText = await response.text();
			console.error("Novu API Error:", response.status, errorText);
			
			const errorMessage = identifier 
				? `Error: Failed to ${operation} ${identifier}. Status: ${response.status}, Message: ${errorText}`
				: `Error: Failed to ${operation}. Status: ${response.status}, Message: ${errorText}`;
			
			return {
				content: [{ 
					type: "text" as const, 
					text: errorMessage
				}],
			};
		}

		const data = await response.json();
		const successMessage = identifier 
			? `Successfully ${operation} ${identifier}`
			: `Successfully ${operation}`;
		
		console.log(successMessage);
		
		return {
			content: [{ 
				type: "text" as const, 
				text: `${successMessage}:\n\n${JSON.stringify(data, null, 2)}` 
			}],
		};
	}
} 