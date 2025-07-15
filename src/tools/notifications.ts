import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ValidationUtils } from '../utils/validation';
import { NovuApiUtils } from '../utils/api';
import type { ServerRegion, GetNotificationsParams } from '../types/index';

export function registerNotificationTools(
	server: McpServer, 
	getApiKey: () => string | null, 
	getServerRegion: () => ServerRegion
) {
	// Get notifications/events with filtering from Novu API
	server.tool(
		"get_notifications",
		"Get notifications/events from Novu with advanced filtering options by channels, templates, emails, subscribers, dates, and more",
		{
			channels: z.array(z.string()).optional().describe("Array of channel types (e.g., ['in_app', 'email'])"),
			templates: z.array(z.string()).optional().describe("Array of template IDs or a single template ID, templateId is workflowId from get_workflows"),
			emails: z.array(z.string()).optional().describe("Array of email addresses or a single email address"),
			subscriberIds: z.array(z.string()).optional().describe("Array of subscriber IDs or a single subscriber ID"),
			page: z.number().min(0).optional().describe("Page number for pagination (default: 0)"),
			limit: z.number().min(1).max(50).optional().describe("Limit for pagination (default: 10, max: 50)"),
			transactionId: z.string().optional().describe("Transaction ID for filtering"),
			topicKey: z.string().optional().describe("Topic Key for filtering notifications by topic"),
			after: z.string().optional().describe("Date filter for records after this timestamp"),
			before: z.string().optional().describe("Date filter for records before this timestamp"),
			idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
		},
		async ({ channels, templates, emails, subscriberIds, page, limit, transactionId, topicKey, after, before, idempotencyKey }) => {
			// Validate API key first
			const apiKeyError = ValidationUtils.validateApiKey(getApiKey());
			if (apiKeyError) {
				return apiKeyError;
			}

			// Validate pagination parameters
			const paginationError = ValidationUtils.validatePagination(page, limit);
			if (paginationError) {
				return paginationError;
			}

			try {
				// Build query string with only provided parameters
				const params: GetNotificationsParams = {
					channels,
					templates,
					emails,
					subscriberIds,
					page,
					limit,
					transactionId,
					topicKey,
					after,
					before
				};
				
				const queryParams = NovuApiUtils.buildQueryParams(params);
				const queryString = queryParams.toString();
				const url = `${NovuApiUtils.getBaseUrl(getServerRegion())}/v1/notifications${queryString ? `?${queryString}` : ''}`;

				console.log(`Fetching notifications with query: ${queryString || 'no filters'}`);
				
				const response = await fetch(url, {
					method: "GET",
					headers: NovuApiUtils.prepareHeaders(getApiKey()!, idempotencyKey)
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Novu API Error:", response.status, errorText);
					return {
						content: [{ 
							type: "text" as const, 
							text: `Error: Failed to fetch notifications. Status: ${response.status}, Message: ${errorText}` 
						}],
					};
				}

				const data = await response.json();
				console.log("Successfully fetched notifications from Novu API");
				
				const filterSummary = [];
				if (channels) filterSummary.push(`channels: ${channels.join(', ')}`);
				if (templates) filterSummary.push(`templates: ${templates.join(', ')}`);
				if (emails) filterSummary.push(`emails: ${emails.join(', ')}`);
				if (subscriberIds) filterSummary.push(`subscriberIds: ${subscriberIds.join(', ')}`);
				if (page !== undefined) filterSummary.push(`page: ${page}`);
				if (limit !== undefined) filterSummary.push(`limit: ${limit}`);
				if (transactionId) filterSummary.push(`transactionId: ${transactionId}`);
				if (topicKey) filterSummary.push(`topicKey: ${topicKey}`);
				if (after) filterSummary.push(`after: ${after}`);
				if (before) filterSummary.push(`before: ${before}`);

				const filterText = filterSummary.length > 0 ? ` with filters (${filterSummary.join(', ')})` : '';
				
				return {
					content: [{ 
						type: "text" as const, 
						text: `Successfully fetched notifications${filterText}:\n\n${JSON.stringify(data, null, 2)}` 
					}],
				};

			} catch (error) {
				console.error("Error fetching notifications:", error);
				return {
					content: [{ 
						type: "text" as const, 
						text: `Error: Failed to fetch notifications. ${error instanceof Error ? error.message : 'Unknown error'}` 
					}],
				};
			}
		}
	);

	// Get a specific notification/event by ID from Novu API
	server.tool(
		"get_notification",
		"Get a specific notification by ID with detailed execution logs, status, and delivery information",
		{
			notificationId: z.string().describe("The notification ID (MongoDB ID) to retrieve (obtained from get_notifications)"),
			idempotencyKey: z.string().optional().describe("Optional idempotency key for the request")
		},
		async ({ notificationId, idempotencyKey }) => {
			// Validate API key first
			const apiKeyError = ValidationUtils.validateApiKey(getApiKey());
			if (apiKeyError) {
				return apiKeyError;
			}

			try {
				console.log(`Fetching notification ${notificationId} from Novu API...`);
				
				const response = await fetch(`${NovuApiUtils.getBaseUrl(getServerRegion())}/v1/notifications/${notificationId}`, {
					method: "GET",
					headers: NovuApiUtils.prepareHeaders(getApiKey()!, idempotencyKey)
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Novu API Error:", response.status, errorText);
					return {
						content: [{ 
							type: "text" as const, 
							text: `Error: Failed to fetch notification ${notificationId}. Status: ${response.status}, Message: ${errorText}` 
						}],
					};
				}

				const data = await response.json();
				console.log(`Successfully fetched notification ${notificationId} from Novu API`);
				
				return {
					content: [{ 
						type: "text" as const, 
						text: `Successfully fetched notification ${notificationId} with execution logs and status:\n\n${JSON.stringify(data, null, 2)}` 
					}],
				};

			} catch (error) {
				console.error("Error fetching notification:", error);
				return {
					content: [{ 
						type: "text" as const, 
						text: `Error: Failed to fetch notification ${notificationId}. ${error instanceof Error ? error.message : 'Unknown error'}` 
					}],
				};
			}
		}
	);
} 