import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NovuApiUtils } from "../utils/api";
import type { ToolAccessors } from "../utils/tool-accessors";
import { ToolFactory } from "../utils/tool-factory";

const workflowRunStatusSchema = z.enum(["processing", "completed", "error"]);
const deliveryLifecycleStatusSchema = z.enum([
	"pending",
	"sent",
	"errored",
	"skipped",
	"canceled",
	"merged",
	"delivered",
	"interacted",
]);
const deliveryLifecycleDetailSchema = z.enum([
	"step_condition",
	"preference",
	"missing_phone",
	"missing_email",
	"missing_push_token",
	"missing_webhook_url",
	"some_channels_missing_credentials",
	"workflow_missing_channel_step",
	"unknown_error",
	"execution_stopped",
	"execution_canceled_by_user",
]);

const workflowRunFiltersSchema = {
	channels: z
		.array(z.string())
		.optional()
		.describe("Filter by channel types, e.g. email, sms, in_app"),
	createdGte: z.string().optional().describe("ISO-8601 lower bound for createdAt"),
	createdLte: z.string().optional().describe("ISO-8601 upper bound for createdAt"),
	deliveryLifecycleDetail: z
		.array(deliveryLifecycleDetailSchema)
		.optional()
		.describe(
			"Filter by skip or failure reason (preference, missing_email, step_condition, ...)",
		),
	deliveryLifecycleStatus: z
		.array(deliveryLifecycleStatusSchema)
		.optional()
		.describe("Filter by delivery lifecycle status (skipped, errored, delivered, ...)"),
	statuses: z.array(workflowRunStatusSchema).optional().describe("Filter by run status"),
	subscriberIds: z.array(z.string()).optional().describe("Filter by subscriber identifiers"),
	topicKey: z.string().optional().describe("Filter by topic key"),
	transactionIds: z.array(z.string()).optional().describe("Filter by transaction identifiers"),
	workflowIds: z.array(z.string()).optional().describe("Filter by workflow identifiers"),
};

function buildWorkflowRunQuery(input: Record<string, unknown>): string {
	const queryString = NovuApiUtils.buildQueryParams(input).toString();

	return queryString ? `?${queryString}` : "";
}

export function registerActivityTools(server: McpServer, accessors: ToolAccessors) {
	ToolFactory.createQueryGetTool(
		server,
		accessors,
		"get_workflow_runs",
		"List workflow runs with optional filters and cursor pagination. Default 10 results, max 25. Use get_workflow_run for one run's step timeline. Narrow filters rather than paging through large result sets.",
		"fetched workflow runs",
		z.object({
			...workflowRunFiltersSchema,
			cursor: z
				.string()
				.optional()
				.describe("Cursor from a previous get_workflow_runs response"),
			limit: z.number().min(1).max(25).default(10).describe("Page size (default 10, max 25)"),
		}),
		{
			buildEndpoint: (input) => `/v1/activity/workflow-runs${buildWorkflowRunQuery(input)}`,
			formatSuccess: (data) => {
				const next =
					typeof data === "object" && data !== null && "next" in data ? data.next : undefined;
				const body = JSON.stringify(data, null, 2);
				if (next) {
					return `Successfully fetched workflow runs. More results exist — narrow the filters rather than paging through large result sets.\n\n${body}`;
				}

				return `Successfully fetched workflow runs:\n\n${body}`;
			},
		},
	);

	ToolFactory.createGetByIdTool(
		server,
		accessors,
		"get_workflow_run",
		"Retrieve one workflow run by ID, including step timeline and execution details. Use after get_workflow_runs to explain why a notification failed or was skipped.",
		"/v1/activity/workflow-runs/{id}",
		"fetched workflow run",
		"workflowRunId",
		"The workflow run ID from get_workflow_runs",
		(data, id) =>
			`Successfully fetched workflow run ${id}:\n\n${JSON.stringify(data, null, 2)}`,
	);
}
