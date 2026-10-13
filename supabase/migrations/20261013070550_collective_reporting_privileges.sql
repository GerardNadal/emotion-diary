-- Reporting needs directory membership, never personal directory attributes.
revoke all on public.profiles,public.teams,public.team_managers from dentro_reporting_executor;
grant select(id,role,team_id,active) on public.profiles to dentro_reporting_executor;
grant select(id,name) on public.teams to dentro_reporting_executor;
grant select(team_id,profile_id) on public.team_managers to dentro_reporting_executor;
-- Future additions fail closed unless a migration grants a specific gateway.
alter default privileges in schema reporting revoke execute on functions from public;
alter default privileges in schema reporting revoke all on tables from public,anon,authenticated,service_role;
