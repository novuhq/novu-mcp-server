import { isOAuthToken, NovuApiUtils } from "./utils/api";

const PRM_PATH = "/.well-known/oauth-protected-resource";
const DCR_PATH = "/oauth/register";
const AS_METADATA_PATHS = [
	"/.well-known/oauth-authorization-server",
	"/.well-known/openid-configuration",
] as const;

// Clerk DCR grants exactly the scopes registered — the authorize request
// must not ask for scopes outside that set or Clerk returns invalid_scope.
// user:org:read first so clients that truncate scope lists still pick it up.
const OAUTH_SCOPES = ["user:org:read", "email", "profile", "offline_access"];
const OAUTH_SCOPE_PARAM = OAUTH_SCOPES.join(" ");

const DISCOVERY_CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Headers": "Authorization, Content-Type, mcp-protocol-version",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Max-Age": "86400",
};

export const MCP_CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Headers":
		"Authorization, Content-Type, mcp-session-id, mcp-protocol-version",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Expose-Headers": "mcp-session-id",
	"Access-Control-Max-Age": "86400",
};

/**
 * Per-request OAuth context. `issuer` is the Clerk authorization server this
 * deployment proxies to, sourced from the `CLERK_OAUTH_ISSUER` secret. When it
 * is `null` the deployment has no OAuth configured (self-hosted mode): the
 * discovery endpoints 404 and 401 challenges omit the OAuth metadata so clients
 * fall back to API-key auth. `origin`/`resource`/`prmUrl` are derived from the
 * request URL (each deployment is pinned to a single host).
 */
export type OAuthContext = {
	origin: string;
	resource: string;
	prmUrl: string;
	issuer: string | null;
};

function resolveIssuer(env: Env): string | null {
	const issuer = env.CLERK_OAUTH_ISSUER?.trim();
	return issuer ? issuer.replace(/\/+$/, "") : null;
}

export function resolveOrigin(request: Request): string {
	return new URL(request.url).origin.replace(/\/+$/, "");
}

export function resolveOAuthContext(env: Env, request: Request): OAuthContext {
	const origin = resolveOrigin(request);
	return {
		issuer: resolveIssuer(env),
		// RFC 9728: PRM `resource` must exactly match the MCP endpoint URL.
		origin,
		prmUrl: `${origin}${PRM_PATH}`,
		resource: origin,
	};
}

/**
 * 401 challenge. OAuth discovery metadata is only advertised when this
 * deployment has an issuer configured AND the caller isn't already using an API
 * key (`oauth` option). API-key callers get a plain `Bearer` challenge so
 * OAuth-capable clients don't launch a sign-in flow for a deliberately
 * configured key.
 */
export function unauthorizedResponse(ctx: OAuthContext, options?: { oauth?: boolean }): Response {
	const offerOAuth = options?.oauth !== false && ctx.issuer !== null;
	const wwwAuthenticate = offerOAuth
		? `Bearer scope="${OAUTH_SCOPE_PARAM}", resource_metadata="${ctx.prmUrl}"`
		: "Bearer";

	return new Response(
		JSON.stringify({
			error: "unauthorized",
			error_description: "Authorization required",
		}),
		{
			headers: {
				"Content-Type": "application/json",
				"WWW-Authenticate": wwwAuthenticate,
				...MCP_CORS_HEADERS,
			},
			status: 401,
		},
	);
}

function oauthDisabledResponse(): Response {
	return new Response(
		JSON.stringify({
			error: "not_found",
			error_description: "OAuth is not enabled on this deployment",
		}),
		{
			headers: { "Content-Type": "application/json", ...DISCOVERY_CORS_HEADERS },
			status: 404,
		},
	);
}

function mergeOAuthScopes(scope: unknown): string {
	const scopes = new Set(typeof scope === "string" ? scope.split(/\s+/).filter(Boolean) : []);
	for (const value of OAUTH_SCOPES) {
		scopes.add(value);
	}
	return [...scopes].join(" ");
}

/** Cursor DCR often omits user:org:read; inject it before forwarding to Clerk. */
export async function proxyDynamicClientRegistration(
	request: Request,
	ctx: OAuthContext,
): Promise<Response | null> {
	const url = new URL(request.url);
	if (url.pathname !== DCR_PATH) {
		return null;
	}

	if (request.method === "OPTIONS") {
		return new Response(null, { headers: DISCOVERY_CORS_HEADERS, status: 204 });
	}

	if (ctx.issuer === null) {
		return oauthDisabledResponse();
	}

	if (request.method !== "POST") {
		return new Response(JSON.stringify({ error: "method_not_allowed" }), {
			headers: { "Content-Type": "application/json", ...DISCOVERY_CORS_HEADERS },
			status: 405,
		});
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return new Response(JSON.stringify({ error: "invalid_request" }), {
			headers: { "Content-Type": "application/json", ...DISCOVERY_CORS_HEADERS },
			status: 400,
		});
	}

	body.scope = mergeOAuthScopes(body.scope);

	try {
		const upstream = await fetch(`${ctx.issuer}${DCR_PATH}`, {
			body: JSON.stringify(body),
			headers: {
				"Content-Type": "application/json",
				accept: "application/json",
			},
			method: "POST",
		});
		const responseBody = await upstream.text();
		return new Response(responseBody, {
			headers: { "Content-Type": "application/json", ...DISCOVERY_CORS_HEADERS },
			status: upstream.status,
		});
	} catch {
		return new Response(
			JSON.stringify({
				error: "server_error",
				error_description: "Failed to forward client registration to Clerk",
			}),
			{
				headers: { "Content-Type": "application/json", ...DISCOVERY_CORS_HEADERS },
				status: 502,
			},
		);
	}
}

/** Cursor probes the resource-server origin for AS metadata — proxy Clerk and pin scopes. */
async function proxyAuthorizationServerMetadata(
	request: Request,
	ctx: OAuthContext,
): Promise<Response | null> {
	const url = new URL(request.url);
	if (!AS_METADATA_PATHS.includes(url.pathname as (typeof AS_METADATA_PATHS)[number])) {
		return null;
	}

	if (request.method === "OPTIONS") {
		return new Response(null, { headers: DISCOVERY_CORS_HEADERS, status: 204 });
	}

	if (ctx.issuer === null) {
		return oauthDisabledResponse();
	}

	try {
		const upstream = await fetch(`${ctx.issuer}${url.pathname}`, {
			headers: { accept: "application/json" },
		});
		if (!upstream.ok) {
			return new Response(await upstream.text(), {
				headers: { "Content-Type": "application/json", ...DISCOVERY_CORS_HEADERS },
				status: upstream.status,
			});
		}

		const metadata = (await upstream.json()) as Record<string, unknown>;
		metadata.scopes_supported = [...OAUTH_SCOPES];
		// Cursor reads this from the resource-server copy and DCRs without user:org:read.
		metadata.registration_endpoint = `${ctx.origin}${DCR_PATH}`;

		return new Response(JSON.stringify(metadata), {
			headers: { "Content-Type": "application/json", ...DISCOVERY_CORS_HEADERS },
			status: 200,
		});
	} catch {
		return new Response(
			JSON.stringify({
				error: "server_error",
				error_description: "Failed to fetch authorization server metadata",
			}),
			{
				headers: { "Content-Type": "application/json", ...DISCOVERY_CORS_HEADERS },
				status: 502,
			},
		);
	}
}

export async function handleDiscovery(
	request: Request,
	ctx: OAuthContext,
): Promise<Response | null> {
	const dcr = await proxyDynamicClientRegistration(request, ctx);
	if (dcr) {
		return dcr;
	}

	const asMetadata = await proxyAuthorizationServerMetadata(request, ctx);
	if (asMetadata) {
		return asMetadata;
	}

	const url = new URL(request.url);
	if (url.pathname !== PRM_PATH && !url.pathname.startsWith(`${PRM_PATH}/`)) {
		return null;
	}

	if (request.method === "OPTIONS") {
		return new Response(null, { headers: DISCOVERY_CORS_HEADERS, status: 204 });
	}

	if (ctx.issuer === null) {
		return oauthDisabledResponse();
	}

	return new Response(
		JSON.stringify({
			// Point AS discovery at this host so Cursor picks up our DCR proxy.
			authorization_servers: [ctx.origin],
			bearer_methods_supported: ["header"],
			resource: ctx.resource,
			scopes_supported: OAUTH_SCOPES,
		}),
		{
			headers: { "Content-Type": "application/json", ...DISCOVERY_CORS_HEADERS },
			status: 200,
		},
	);
}

function isInitializeRequest(bodyText: string): boolean {
	try {
		const parsed = JSON.parse(bodyText);
		const messages = Array.isArray(parsed) ? parsed : [parsed];
		return messages.some((m) => m && typeof m === "object" && m.method === "initialize");
	} catch {
		return false;
	}
}

/**
 * Validate the caller's credential against the live Novu API at initialize
 * time so a bad credential fails fast. Applies to both OAuth tokens and API
 * keys; a rejected credential yields a 401 whose OAuth-ness matches the token
 * (API keys never get the OAuth discovery challenge).
 */
export async function gateInitializeWithOAuthProbe(
	request: Request,
	token: string,
	apiUrl: string,
	ctx: OAuthContext,
): Promise<{ reject: Response } | { forwardBody: string | null }> {
	if (request.method !== "POST") {
		return { forwardBody: null };
	}

	const bodyText = await request.text();

	if (isInitializeRequest(bodyText)) {
		try {
			const response = await NovuApiUtils.fetchCurrentUser(token, apiUrl);
			if (response.status === 401) {
				return { reject: unauthorizedResponse(ctx, { oauth: isOAuthToken(token) }) };
			}
		} catch {
			// Network failure: fall through and let the request proceed.
		}
	}

	return { forwardBody: bodyText };
}
