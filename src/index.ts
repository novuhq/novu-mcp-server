import {
	gateInitializeWithOAuthProbe,
	handleDiscovery,
	MCP_CORS_HEADERS,
	resolveOAuthContext,
	unauthorizedResponse,
} from "./oauth";
import type { NovuProps } from "./server/NovuMCP";
import { NovuMCP } from "./server/NovuMCP";

export { NovuMCP };

// Each deployment is pinned to a single region via NOVU_REGION. The legacy
// `?region=` param is only honored when it matches; a request for a different
// region is pointed at that region's dedicated host.
const REGION_HOSTS: Record<string, string> = {
	eu: "https://eu.mcp.novu.co/",
	us: "https://mcp.novu.co/",
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const oauth = resolveOAuthContext(env, request);
		const region = env.NOVU_REGION?.trim() || "us";

		const requestedRegion = new URL(request.url).searchParams.get("region");
		if (requestedRegion && requestedRegion !== region) {
			const host = REGION_HOSTS[requestedRegion];
			const description = host
				? `This deployment serves the "${region}" region. To use "${requestedRegion}", connect to ${host} instead.`
				: `This deployment serves the "${region}" region and does not support region="${requestedRegion}".`;
			return new Response(
				JSON.stringify({ error: "invalid_region", error_description: description }),
				{
					headers: { "Content-Type": "application/json", ...MCP_CORS_HEADERS },
					status: 400,
				},
			);
		}

		const discovery = await handleDiscovery(request, oauth);
		if (discovery) {
			return discovery;
		}

		const authHeader = request.headers.get("authorization");
		const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

		const props: NovuProps = { apiUrl: env.NOVU_API_URL, region, token };
		// `ExecutionContext.props` is typed readonly in newer workerd types, but
		// assigning it is the supported channel for handing per-session props to
		// the McpAgent Durable Object.
		(ctx as unknown as { props: NovuProps }).props = props;

		const url = new URL(request.url);
		if (url.pathname === "/") {
			if (request.method === "OPTIONS") {
				return new Response(null, { headers: MCP_CORS_HEADERS, status: 204 });
			}

			if (!token) {
				return unauthorizedResponse(oauth);
			}

			const gate = await gateInitializeWithOAuthProbe(
				request,
				token,
				env.NOVU_API_URL,
				oauth,
			);
			if ("reject" in gate) {
				return gate.reject;
			}
			const forwardRequest =
				gate.forwardBody === null
					? request
					: new Request(request.url, {
							body: gate.forwardBody,
							headers: request.headers,
							method: request.method,
						});

			return NovuMCP.serve("/").fetch(forwardRequest, env, ctx);
		}

		return Response.redirect("https://docs.novu.co/platform/additional-resources/mcp", 302);
	},
};
