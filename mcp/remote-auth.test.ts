import { describe, expect, it } from 'vitest';
import { loadRemoteMcpConfiguration, remoteMcpMetadata } from './remote-auth';

const env = {
  AGYM_REMOTE_SUPABASE_URL: 'https://example.supabase.co/',
  AGYM_REMOTE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  AGYM_REMOTE_OAUTH_ISSUER: 'https://example.supabase.co/auth/v1/',
  AGYM_REMOTE_MCP_RESOURCE: 'https://agym.example.com/api/mcp/',
  AGYM_REMOTE_CLIENTS_JSON: '{"client-123":"remote-mcp"}',
  AGYM_REMOTE_ALLOWED_ORIGINS: 'https://agym.example.com, https://inspector.example.com ',
};

describe('remote MCP configuration', () => {
  it('loads a server-only allowlist and canonicalizes URLs', () => {
    const configuration = loadRemoteMcpConfiguration(env);
    expect(configuration.supabaseUrl).toBe('https://example.supabase.co');
    expect(configuration.issuer).toBe('https://example.supabase.co/auth/v1');
    expect(configuration.resource).toBe('https://agym.example.com/api/mcp');
    expect(configuration.clients).toEqual({ 'client-123': 'remote-mcp' });
    expect(configuration.allowedOrigins).toEqual(['https://agym.example.com', 'https://inspector.example.com']);
    expect(remoteMcpMetadata(configuration)).toEqual({
      resource: 'https://agym.example.com/api/mcp',
      authorization_servers: ['https://example.supabase.co/auth/v1'],
      scopes_supported: ['openid'],
    });
  });

  it('rejects a missing or empty OAuth client allowlist', () => {
    expect(() => loadRemoteMcpConfiguration({ ...env, AGYM_REMOTE_CLIENTS_JSON: '{}' })).toThrow(/at least one/i);
    expect(() => loadRemoteMcpConfiguration({ ...env, AGYM_REMOTE_CLIENTS_JSON: 'not-json' })).toThrow(/JSON object/i);
    const withoutResource: Partial<typeof env> = { ...env };
    delete withoutResource.AGYM_REMOTE_MCP_RESOURCE;
    expect(() => loadRemoteMcpConfiguration(withoutResource)).toThrow(/AGYM_REMOTE_MCP_RESOURCE/);
  });
});
