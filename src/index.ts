import { NovuMCP } from './server/NovuMCP';

// Export the Durable Object class for Wrangler
export { NovuMCP };

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Extract API key from Authorization header
		const authHeader = request.headers.get('authorization');
		const apiKey = authHeader && authHeader.startsWith('Bearer ') 
			? authHeader.substring(7) 
			: null;

		// Extract server region from URL parameters (default to US)
		const serverRegion = url.searchParams.get('region') || 'us';

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			// Add API key and region to URL parameters
			if (apiKey) {
				url.searchParams.set('novu_api_key', apiKey);
			}
			url.searchParams.set('novu_region', serverRegion);

			// Create new request with updated URL
			const newRequest = new Request(url.toString(), {
				method: request.method,
				headers: request.headers,
				body: request.body
			});

			return NovuMCP.serveSSE("/sse").fetch(newRequest, env, ctx);
		}

		if (url.pathname === "/mcp") {
			// Add API key and region to URL parameters
			if (apiKey) {
				url.searchParams.set('novu_api_key', apiKey);
			}
			url.searchParams.set('novu_region', serverRegion);

			// Create new request with updated URL
			const newRequest = new Request(url.toString(), {
				method: request.method,
				headers: request.headers,
				body: request.body
			});

			return NovuMCP.serve("/mcp").fetch(newRequest, env, ctx);
		}

		// Redirect all other paths to docs
		return Response.redirect("https://docs.novu.co/", 302);
	},
};
