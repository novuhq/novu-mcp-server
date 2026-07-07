import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GetNotificationsParams } from "../types/index";
import { NovuApiUtils } from "../utils/api";
import { environmentIdSchema } from "../utils/tool-factory";
import { ValidationUtils } from "../utils/validation";

export function registerNotificationTools(
	server: McpServer,
	getToken: () => string | null,
	getApiUrl: () => string,
) {
	// Get notifications/events with filtering from Novu API
	server.tool(
		"get_notifications",
		"Get notifications/events from Novu with advanced filtering options by channels, templates, emails, subscribers, dates, and more",
		{
			after: z.string().optional().describe("Date filter for records after this timestamp"),
			before: z.string().optional().describe("Date filter for records before this timestamp"),
			channels: z
				.array(z.string())
				.optional()
				.describe("Array of channel types (e.g., ['in_app', 'email'])"),
			emails: z
				.array(z.string())
				.optional()
				.describe("Array of email addresses or a single email address"),
			environmentId: environmentIdSchema,
			idempotencyKey: z
				.string()
				.optional()
				.describe("Optional idempotency key for the request"),
			limit: z
				.number()
				.min(1)
				.max(50)
				.optional()
				.describe("Limit for pagination (default: 10, max: 50)"),
			page: z.number().min(0).optional().describe("Page number for pagination (default: 0)"),
			subscriberIds: z
				.array(z.string())
				.optional()
				.describe("Array of subscriber IDs or a single subscriber ID"),
			templates: z
				.array(z.string())
				.optional()
				.describe(
					"Array of template IDs or a single template ID, templateId is workflowId from get_workflows",
				),
			topicKey: z
				.string()
				.optional()
				.describe("Topic Key for filtering notifications by topic"),
			transactionId: z.string().optional().describe("Transaction ID for filtering"),
		},
		async ({
			channels,
			templates,
			emails,
			subscriberIds,
			page,
			limit,
			transactionId,
			topicKey,
			after,
			before,
			idempotencyKey,
			environmentId,
		}) => {
			// Validate API key first
			const authError = ValidationUtils.validateToken(getToken());
			if (authError) {
				return authError;
			}

			// Validate pagination parameters
			const paginationError = ValidationUtils.validatePagination(page, limit);
			if (paginationError) {
				return paginationError;
			}

			try {
				// Build query string with only provided parameters
				const params: GetNotificationsParams = {
					after,
					before,
					channels,
					emails,
					limit,
					page,
					subscriberIds,
					templates,
					topicKey,
					transactionId,
				};

				const queryParams = NovuApiUtils.buildQueryParams(params);
				const queryString = queryParams.toString();
				const url = `${getApiUrl()}/v1/notifications${queryString ? `?${queryString}` : ""}`;

				console.log(`Fetching notifications with query: ${queryString || "no filters"}`);

				const response = await fetch(url, {
					headers: NovuApiUtils.prepareHeaders(getToken()!, {
						environmentId,
						idempotencyKey,
					}),
					method: "GET",
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Novu API Error:", response.status, errorText);
					return {
						content: [
							{
								text: `Error: Failed to fetch notifications. Status: ${response.status}, Message: ${errorText}`,
								type: "text" as const,
							},
						],
					};
				}

				const data = await response.json();
				console.log("Successfully fetched notifications from Novu API");

				const filterSummary = [];
				if (channels) filterSummary.push(`channels: ${channels.join(", ")}`);
				if (templates) filterSummary.push(`templates: ${templates.join(", ")}`);
				if (emails) filterSummary.push(`emails: ${emails.join(", ")}`);
				if (subscriberIds) filterSummary.push(`subscriberIds: ${subscriberIds.join(", ")}`);
				if (page !== undefined) filterSummary.push(`page: ${page}`);
				if (limit !== undefined) filterSummary.push(`limit: ${limit}`);
				if (transactionId) filterSummary.push(`transactionId: ${transactionId}`);
				if (topicKey) filterSummary.push(`topicKey: ${topicKey}`);
				if (after) filterSummary.push(`after: ${after}`);
				if (before) filterSummary.push(`before: ${before}`);

				const filterText =
					filterSummary.length > 0 ? ` with filters (${filterSummary.join(", ")})` : "";

				return {
					content: [
						{
							text: `Successfully fetched notifications${filterText}:\n\n${JSON.stringify(data, null, 2)}`,
							type: "text" as const,
						},
					],
				};
			} catch (error) {
				console.error("Error fetching notifications:", error);
				return {
					content: [
						{
							text: `Error: Failed to fetch notifications. ${error instanceof Error ? error.message : "Unknown error"}`,
							type: "text" as const,
						},
					],
				};
			}
		},
	);

	// Get a specific notification/event by ID from Novu API
	server.tool(
		"get_notification",
		"Get a specific notification by ID with detailed execution logs, status, and delivery information",
		{
			environmentId: environmentIdSchema,
			idempotencyKey: z
				.string()
				.optional()
				.describe("Optional idempotency key for the request"),
			notificationId: z
				.string()
				.describe(
					"The notification ID (MongoDB ID) to retrieve (obtained from get_notifications)",
				),
		},
		async ({ notificationId, idempotencyKey, environmentId }) => {
			// Validate API key first
			const authError = ValidationUtils.validateToken(getToken());
			if (authError) {
				return authError;
			}

			try {
				console.log(`Fetching notification ${notificationId} from Novu API...`);

				const response = await fetch(`${getApiUrl()}/v1/notifications/${notificationId}`, {
					headers: NovuApiUtils.prepareHeaders(getToken()!, {
						environmentId,
						idempotencyKey,
					}),
					method: "GET",
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Novu API Error:", response.status, errorText);
					return {
						content: [
							{
								text: `Error: Failed to fetch notification ${notificationId}. Status: ${response.status}, Message: ${errorText}`,
								type: "text" as const,
							},
						],
					};
				}

				const data = await response.json();
				console.log(`Successfully fetched notification ${notificationId} from Novu API`);

				return {
					content: [
						{
							text: `Successfully fetched notification ${notificationId} with execution logs and status:\n\n${JSON.stringify(data, null, 2)}`,
							type: "text" as const,
						},
					],
				};
			} catch (error) {
				console.error("Error fetching notification:", error);
				return {
					content: [
						{
							text: `Error: Failed to fetch notification ${notificationId}. ${error instanceof Error ? error.message : "Unknown error"}`,
							type: "text" as const,
						},
					],
				};
			}
		},
	);
}
