import { afterEach, describe, expect, it } from 'vitest';
import { handleMcpRequest } from './mcp';

const remoteEnv = {
  AGYM_REMOTE_SUPABASE_URL: 'https://example.supabase.co',
  AGYM_REMOTE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  AGYM_REMOTE_OAUTH_ISSUER: 'https://issuer.example.com',
  AGYM_REMOTE_MCP_RESOURCE: 'https://agym.example.com/api/mcp',
  AGYM_REMOTE_ALLOWED_ORIGINS: 'https://agym.example.com',
};

const previousEnv = { ...process.env };

function configureRemoteMcp() {
  Object.assign(process.env, remoteEnv);
}

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in previousEnv)) delete process.env[key];
  }
  Object.assign(process.env, previousEnv);
});

describe('remote MCP HTTP boundary', () => {
  it('rejects non-JSON requests before authentication', async () => {
    configureRemoteMcp();
    const response = await handleMcpRequest(new Request('https://attacker.example/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'not-json',
    }));

    expect(response.status).toBe(415);
    expect(await response.text()).toMatch(/application\/json/i);
  });

  it('uses configured canonical resource metadata in an authentication challenge', async () => {
    configureRemoteMcp();
    const response = await handleMcpRequest(new Request('https://attacker.example/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain(
      'https://agym.example.com/.well-known/oauth-protected-resource/api/mcp',
    );
    expect(response.headers.get('www-authenticate')).not.toContain('attacker.example');
  });
});
