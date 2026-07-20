import { loadRemoteMcpConfiguration, remoteMcpMetadata } from '../mcp/remote-auth.js';

type VercelRequest = { method?: string };
type VercelResponse = {
  status: (status: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

export async function handleProtectedResourceRequest(method = 'GET'): Promise<Response> {
  if (method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET', 'cache-control': 'no-store' } });
  try {
    return Response.json(remoteMcpMetadata(loadRemoteMcpConfiguration()), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('AGym remote MCP metadata configuration error:', error instanceof Error ? error.message : 'unknown');
    return new Response('Remote MCP is not configured', { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  const result = await handleProtectedResourceRequest(request.method);
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.status(result.status).end(await result.text());
}
