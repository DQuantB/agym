import { describe, expect, it } from 'vitest';
import { loadRemoteMcpConfiguration, protectedResourceMetadataUrl, remoteMcpMetadata } from './remote-auth';

const env = {
  AGYM_REMOTE_SUPABASE_URL: 'https://example.supabase.co/',
  AGYM_REMOTE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  AGYM_REMOTE_OAUTH_ISSUER: 'https://example.supabase.co/auth/v1/',
  AGYM_REMOTE_MCP_RESOURCE: 'https://agym.example.com/api/mcp/',
  AGYM_REMOTE_ALLOWED_ORIGINS: 'https://agym.example.com, https://inspector.example.com ',
};

describe('remote MCP configuration', () => {
  it('loads Supabase OAuth configuration and binds dynamic clients to the fixed remote MCP product identity', () => {
    const configuration = loadRemoteMcpConfiguration(env);
    expect(configuration.supabaseUrl).toBe('https://example.supabase.co');
    expect(configuration.issuer).toBe('https://example.supabase.co/auth/v1');
    expect(configuration.resource).toBe('https://agym.example.com/api/mcp');
    expect(configuration.agentIdentifier).toBe('remote-mcp');
    expect(configuration.allowedOrigins).toEqual(['https://agym.example.com', 'https://inspector.example.com']);
    expect(remoteMcpMetadata(configuration)).toEqual({
      resource: 'https://agym.example.com/api/mcp',
      authorization_servers: ['https://example.supabase.co/auth/v1'],
      scopes_supported: ['openid'],
    });
  });

  it('does not require a static OAuth client allowlist for dynamic client registration', () => {
    expect(() => loadRemoteMcpConfiguration(env)).not.toThrow();
    const withoutResource: Partial<typeof env> = { ...env };
    delete withoutResource.AGYM_REMOTE_MCP_RESOURCE;
    expect(() => loadRemoteMcpConfiguration(withoutResource)).toThrow(/AGYM_REMOTE_MCP_RESOURCE/);
  });

  it('builds protected-resource metadata from the configured canonical resource, never request headers', () => {
    const configuration = loadRemoteMcpConfiguration(env);
    const attackerControlledRequest = new Request('https://attacker.example/api/mcp');
    expect(protectedResourceMetadataUrl(configuration)).toBe(
      'https://agym.example.com/.well-known/oauth-protected-resource/api/mcp',
    );
    expect(protectedResourceMetadataUrl(configuration)).not.toContain(new URL(attackerControlledRequest.url).host);
  });
});
