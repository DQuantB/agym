-- The local MCP server uses a server-only service-role credential. Restrict its
-- database privileges to the minimum read/audit surface required for raw-context
-- retrieval; browser clients remain constrained by the authenticated-role grants
-- and RLS policies in the initial migration.

grant select on public.agent_authorizations, public.canonical_events, public.raw_logs to service_role;
grant insert on public.agent_audit_log to service_role;
