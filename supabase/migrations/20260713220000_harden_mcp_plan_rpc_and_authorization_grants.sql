-- Keep MCP plan creation server-only even though the RPC is SECURITY DEFINER.
-- PostgreSQL functions otherwise grant EXECUTE to PUBLIC by default.
revoke execute on function public.create_mcp_proposed_plan(uuid, uuid, text, text, jsonb) from public;
revoke execute on function public.create_mcp_proposed_plan(uuid, uuid, text, text, jsonb) from anon;
revoke execute on function public.create_mcp_proposed_plan(uuid, uuid, text, text, jsonb) from authenticated;
grant execute on function public.create_mcp_proposed_plan(uuid, uuid, text, text, jsonb) to service_role;

-- A scope has one current grant per user/agent/action. Historical revoked grants
-- remain intact, and a new grant can be created after revocation.
create unique index agent_authorizations_one_active_grant_idx
  on public.agent_authorizations (user_id, agent_identifier, action)
  where revoked_at is null;
