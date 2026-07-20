import { loadRemoteMcpConfiguration, remoteMcpMetadata } from '../../../mcp/remote-auth.js';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET', 'cache-control': 'no-store' } });
  try {
    return Response.json(remoteMcpMetadata(loadRemoteMcpConfiguration()), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('AGym remote MCP metadata configuration error:', error instanceof Error ? error.message : 'unknown');
    return new Response('Remote MCP is not configured', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
