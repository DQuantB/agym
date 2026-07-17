import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RemoteMcpConfiguration {
  supabaseUrl: string;
  publishableKey: string;
  issuer: string;
  resource: string;
  clients: Record<string, string>;
  allowedOrigins: string[];
}

export interface RemoteMcpIdentity {
  userId: string;
  agentIdentifier: string;
  authInfo: AuthInfo;
}

export class RemoteAuthenticationError extends Error {}

function required(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required remote MCP environment variable: ${name}`);
  return value;
}

export function loadRemoteMcpConfiguration(env: NodeJS.ProcessEnv = process.env): RemoteMcpConfiguration {
  const supabaseUrl = required(env, 'AGYM_REMOTE_SUPABASE_URL').replace(/\/$/, '');
  const issuer = required(env, 'AGYM_REMOTE_OAUTH_ISSUER').replace(/\/$/, '');
  const resource = required(env, 'AGYM_REMOTE_MCP_RESOURCE').replace(/\/$/, '');
  let clients: Record<string, string>;
  try {
    clients = JSON.parse(required(env, 'AGYM_REMOTE_CLIENTS_JSON')) as Record<string, string>;
  } catch {
    throw new Error('AGYM_REMOTE_CLIENTS_JSON must be a JSON object mapping OAuth client IDs to fixed AGym agent identifiers.');
  }
  if (
    typeof clients !== 'object'
    || clients === null
    || Array.isArray(clients)
    || Object.keys(clients).length === 0
    || Object.entries(clients).some(([clientId, agent]) => typeof clientId !== 'string' || !clientId.trim() || typeof agent !== 'string' || !agent.trim())
  ) {
    throw new Error('AGYM_REMOTE_CLIENTS_JSON must contain at least one nonblank client ID and agent identifier.');
  }
  return {
    supabaseUrl,
    publishableKey: required(env, 'AGYM_REMOTE_SUPABASE_PUBLISHABLE_KEY'),
    issuer,
    resource,
    clients,
    allowedOrigins: (env.AGYM_REMOTE_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  };
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer ([^\s]+)$/i);
  if (!match) throw new RemoteAuthenticationError('A bearer access token is required.');
  return match[1];
}

function stringClaim(payload: JWTPayload, claim: string) {
  const value = payload[claim];
  if (typeof value !== 'string' || !value.trim()) throw new RemoteAuthenticationError(`Access token is missing ${claim}.`);
  return value;
}

export async function authenticateRemoteMcpRequest(request: Request, configuration: RemoteMcpConfiguration): Promise<RemoteMcpIdentity> {
  const token = bearerToken(request);
  let payload: JWTPayload;
  try {
    const jwks = createRemoteJWKSet(new URL(`${configuration.issuer}/.well-known/jwks.json`));
    ({ payload } = await jwtVerify(token, jwks, { issuer: configuration.issuer, audience: configuration.resource }));
  } catch {
    throw new RemoteAuthenticationError('The bearer access token is invalid, expired, or not issued for this AGym MCP resource.');
  }

  const userId = stringClaim(payload, 'sub');
  if (!UUID.test(userId)) throw new RemoteAuthenticationError('Access token subject is not a valid AGym user identifier.');
  if (payload.role !== 'authenticated') throw new RemoteAuthenticationError('Only authenticated AGym users may access the remote MCP endpoint.');
  const clientId = stringClaim(payload, 'client_id');
  const agentIdentifier = configuration.clients[clientId];
  if (!agentIdentifier) throw new RemoteAuthenticationError('This OAuth client is not approved for AGym remote MCP access.');

  return {
    userId,
    agentIdentifier,
    authInfo: {
      token,
      clientId,
      scopes: Array.isArray(payload.scope) ? payload.scope.filter((scope): scope is string => typeof scope === 'string') : typeof payload.scope === 'string' ? payload.scope.split(' ').filter(Boolean) : [],
      expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
      resource: new URL(configuration.resource),
    },
  };
}

export function createRemoteMcpSupabaseClient(configuration: RemoteMcpConfiguration, bearerAccessToken: string): SupabaseClient {
  return createClient(configuration.supabaseUrl, configuration.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${bearerAccessToken}` } },
  });
}

export function remoteMcpMetadata(configuration: RemoteMcpConfiguration) {
  return {
    resource: configuration.resource,
    authorization_servers: [configuration.issuer],
    scopes_supported: ['openid'],
  };
}

export function protectedResourceMetadataUrl(configuration: RemoteMcpConfiguration) {
  return new URL('/.well-known/oauth-protected-resource/api/mcp', configuration.resource).toString();
}
