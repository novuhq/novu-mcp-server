import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ToolFactory } from '../utils/tool-factory';
import type { ServerRegion } from '../types';

export function registerIntegrationTools(
	server: McpServer,
	getApiKey: () => string | null,
	getServerRegion: () => ServerRegion
) {
	ToolFactory.createGetTool(
		server,
		getApiKey,
		getServerRegion,
		"get_integrations",
		"List all channel integrations (email, SMS, push, chat, in-app) configured in your Novu organization. To create a new integration, visit the Integrations tab at https://dashboard.novu.co/integrations",
		"/v1/integrations",
		"fetched integrations"
	);

	ToolFactory.createGetTool(
		server,
		getApiKey,
		getServerRegion,
		"get_active_integrations",
		"List only the active integrations in your Novu organization",
		"/v1/integrations/active",
		"fetched active integrations"
	);

	ToolFactory.createDeleteTool(
		server,
		getApiKey,
		getServerRegion,
		"delete_integration",
		"Delete an integration by its integrationId. This action is irreversible.",
		"/v1/integrations/{id}",
		"deleted integration",
		"integrationId",
		"The ID of the integration to delete"
	);

	ToolFactory.createTool(server, getApiKey, getServerRegion, {
		name: "set_primary_integration",
		description: "Mark an integration as the primary integration for its channel. The primary integration is used as the default for sending notifications on that channel.",
		schema: z.object({
			integrationId: z.string().describe("The ID of the integration to set as primary"),
			idempotencyKey: z.string().optional().describe("Optional idempotency key for the request"),
		}),
		handler: async (input, context) => {
			return ToolFactory.makeApiRequest(context, {
				method: 'POST',
				endpoint: `/v1/integrations/${input.integrationId}/set-primary`,
				successMessage: 'set integration as primary',
				identifier: input.integrationId,
			}, input.idempotencyKey);
		}
	});
}
