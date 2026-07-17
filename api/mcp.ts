import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { registerAgymTools } from '../mcp/agym-server.js';
import {
  RemoteAuthenticationError,
  authenticateRemoteMcpRequest,
  createRemoteMcpSupabaseClient,
  loadRemoteMcpConfiguration,
  protectedResourceMetadataUrl,
} from '../mcp/remote-auth.js';

const MAX_BODY_BYTES = 1_000_000;

function response(body: string | null, status: number, headers: HeadersInit = {}) {
  return new Response(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

function unauthorized(configuration: ReturnType<typeof loadRemoteMcpConfiguration>, message: string) {
  return response(JSON.stringify({ error: 'invalid_token', error_description: message }), 401, {
    'content-type': 'application/json',
    'www-authenticate': `Bearer resource_metadata="${protectedResourceMetadataUrl(configuration)}"`,
  });
}

function isJsonContentType(request: Request) {
  const contentType = request.headers.get('content-type');
  return contentType !== null && contentType.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return response('Method Not Allowed', 405, { allow: 'POST' });
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isFinite(contentLength) || contentLength > MAX_BODY_BYTES) return response('Request body too large', 413);

  let configuration;
  try {
    configuration = loadRemoteMcpConfiguration();
  } catch (error) {
    console.error('AGym remote MCP configuration error:', error instanceof Error ? error.message : 'unknown');
    return response('Remote MCP is not configured', 503);
  }

  const origin = request.headers.get('origin');
  if (origin && !configuration.allowedOrigins.includes(origin)) return response('Origin is not allowed', 403);
  if (!isJsonContentType(request)) return response('Content-Type must be application/json', 415);

  try {
    const identity = await authenticateRemoteMcpRequest(request, configuration);
    const client = createRemoteMcpSupabaseClient(configuration, identity.authInfo.token);
    const server = new McpServer({ name: 'agym', version: '0.2.0' });
    registerAgymTools(server, client, {
      userId: identity.userId,
      agentIdentifier: identity.agentIdentifier,
      planRpcName: 'create_remote_mcp_proposed_plan',
    });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    const result = await transport.handleRequest(request, { authInfo: identity.authInfo });
    const headers = new Headers(result.headers);
    headers.set('cache-control', 'no-store');
    return new Response(result.body, { status: result.status, headers });
  } catch (error) {
    if (error instanceof RemoteAuthenticationError) return unauthorized(configuration, error.message);
    console.error('AGym remote MCP request failed:', error instanceof Error ? error.message : 'unknown');
    return response('Remote MCP request failed', 500);
  }
}
