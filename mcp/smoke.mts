// Offline structural smoke check for the AGym MCP server.
// Verifies config validation and that all tools register, without a live DB.
import assert from 'node:assert';
import { createAgymMcpServer, loadConfiguration } from './agym-server';

// 1) Config validation rejects missing env.
let threw = false;
try {
  loadConfiguration({});
} catch {
  threw = true;
}
assert.equal(threw, true, 'loadConfiguration should throw with empty env');

// 2) Config loads with required vars; agent identifier defaults to hermes.
const cfg = loadConfiguration({
  AGYM_SUPABASE_URL: 'https://example.supabase.co',
  AGYM_SUPABASE_SERVICE_ROLE_KEY: 'x',
  AGYM_USER_ID: '00000000-0000-0000-0000-000000000000',
});
assert.equal(cfg.agentIdentifier, 'hermes', 'agent identifier should default to hermes');

// 3) Server constructs and registers exactly the expected tools.
const fakeClient = {} as unknown as Parameters<typeof createAgymMcpServer>[0];
const server = createAgymMcpServer(fakeClient, cfg);
const registered = Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools ?? {});
const expected = ['get_context', 'list_plans', 'create_proposed_plan'];
assert.deepEqual(registered.sort(), [...expected].sort(), `tools mismatch: got ${registered.join(',')}`);

console.log('MCP smoke OK: config validation + tools =', registered.sort().join(', '));
