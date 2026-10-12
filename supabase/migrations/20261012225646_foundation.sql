-- Single-company directory. Emotional content deliberately does not exist yet.
create schema if not exists app_private;
create schema if not exists journal_private;
create schema if not exists reporting;
revoke all on schema app_private, journal_private, reporting from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;
alter default privileges in schema app_private revoke execute on functions from public;
alter default privileges in schema journal_private revoke all on tables from anon, authenticated, service_role;
alter default privileges in schema reporting revoke all on tables from anon, authenticated;

create type public.app_role as enum ('company_admin', 'team_admin', 'employee');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index teams_name_unique on public.teams (lower(btrim(name)));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  email text not null check (length(email) between 3 and 254),
  full_name text not null check (length(btrim(full_name)) between 2 and 100),
  role public.app_role not null,
  team_id uuid references public.teams(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_exactly_one_team check (
    (role = 'employee' and team_id is not null) or
    (role <> 'employee' and team_id is null)
  )
);
create unique index profiles_email_unique on public.profiles (lower(email));
create index profiles_team_id_idx on public.profiles(team_id);

create table public.team_managers (
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);
create index team_managers_profile_id_idx on public.team_managers(profile_id);

-- Only directory changes, never passwords, tokens, or future emotional content.
create table app_private.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  operation text not null,
  target_id uuid not null,
  created_at timestamptz not null default now()
);
alter table app_private.admin_audit enable row level security;

create function app_private.current_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active
$$;

create function app_private.can_manage_team(p_team_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app_private.current_role() = 'company_admin' or
    (app_private.current_role() = 'team_admin' and exists (
      select 1 from public.team_managers m
      where m.profile_id = auth.uid() and m.team_id = p_team_id
    )), false)
$$;

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.team_managers enable row level security;
revoke all on public.teams, public.profiles, public.team_managers from anon, authenticated;
grant select on public.teams, public.profiles, public.team_managers to authenticated;
grant all on public.teams, public.profiles, public.team_managers to service_role;

create policy profiles_read on public.profiles for select to authenticated using (
  (select app_private.current_role()) is not null and (
    id = (select auth.uid()) or
    (select app_private.current_role()) = 'company_admin' or
    (role = 'employee' and app_private.can_manage_team(team_id))
  )
);
create policy teams_read on public.teams for select to authenticated using (
  app_private.can_manage_team(id) or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.team_id = teams.id
  )
);
create policy managers_read on public.team_managers for select to authenticated using (
  (select app_private.current_role()) = 'company_admin' or (
    (select app_private.current_role()) = 'team_admin' and profile_id = (select auth.uid())
  )
);

-- Serialized administrative mutations make live permission checks and self-protection
-- atomic, including concurrent deactivation/assignment. Adequate for this small demo.
create function app_private.save_profile(
  p_id uuid, p_full_name text, p_role public.app_role, p_team_id uuid, p_active boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor_role public.app_role;
  previous public.profiles;
  target_email text;
begin
  perform pg_advisory_xact_lock(72419001);
  actor_role := app_private.current_role();
  if actor_role is null or actor_role = 'employee' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_id is null or p_full_name is null or p_role is null or p_active is null then
    raise exception 'Invalid profile' using errcode = '22023';
  end if;
  select * into previous from public.profiles where id = p_id for update;
  if actor_role = 'team_admin' then
    if p_role <> 'employee' or not app_private.can_manage_team(p_team_id) or
       (previous.id is not null and (previous.role <> 'employee' or
        not app_private.can_manage_team(previous.team_id))) then
      raise exception 'Not authorized' using errcode = '42501';
    end if;
  end if;
  if p_id = auth.uid() and (not p_active or p_role <> actor_role) then
    raise exception 'Cannot deactivate or change your own role' using errcode = '42501';
  end if;
  if previous.id is null then
    select email into target_email from auth.users where id = p_id;
    if target_email is null then
      raise exception 'Auth user required' using errcode = '22023';
    end if;
    insert into public.profiles(id, email, full_name, role, team_id, active)
    values (p_id, lower(target_email), btrim(p_full_name), p_role, p_team_id, p_active);
  else
    if previous.role <> p_role or not p_active then
      delete from public.team_managers where profile_id = p_id;
    end if;
    update public.profiles set full_name = btrim(p_full_name), role = p_role,
      team_id = p_team_id, active = p_active, updated_at = now() where id = p_id;
  end if;
  insert into app_private.admin_audit(actor_id, operation, target_id)
  values (auth.uid(), case when previous.id is null then 'profile.create' else 'profile.update' end, p_id);
  return p_id;
end
$$;

create function app_private.save_team(p_id uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  perform pg_advisory_xact_lock(72419001);
  if app_private.current_role() is distinct from 'company_admin' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_id is null then
    insert into public.teams(name) values(btrim(p_name)) returning id into target_id;
  else
    update public.teams set name = btrim(p_name), updated_at = now()
    where id = p_id returning id into target_id;
    if target_id is null then raise exception 'Team not found' using errcode = '22023'; end if;
  end if;
  insert into app_private.admin_audit(actor_id, operation, target_id)
  values(auth.uid(), 'team.save', target_id);
  return target_id;
end
$$;

create function app_private.set_team_manager(p_team_id uuid, p_profile_id uuid, p_assigned boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(72419001);
  if app_private.current_role() is distinct from 'company_admin' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_assigned is null then raise exception 'Invalid assignment' using errcode = '22023'; end if;
  if p_assigned then
    if not exists(select 1 from public.profiles where id = p_profile_id and active and role = 'team_admin') then
      raise exception 'An active team administrator is required' using errcode = '22023';
    end if;
    insert into public.team_managers(team_id, profile_id) values(p_team_id, p_profile_id)
    on conflict do nothing;
  else
    delete from public.team_managers where team_id = p_team_id and profile_id = p_profile_id;
  end if;
  insert into app_private.admin_audit(actor_id, operation, target_id)
  values(auth.uid(), 'manager.assignment', p_team_id);
end
$$;

-- Public endpoints are invokers. Privileged implementations are unexposed and
-- validate the authenticated actor themselves, even when called directly in SQL.
create function public.save_profile(p_id uuid, p_full_name text, p_role public.app_role, p_team_id uuid, p_active boolean)
returns uuid language sql security invoker set search_path = '' as $$
  select app_private.save_profile(p_id, p_full_name, p_role, p_team_id, p_active)
$$;
create function public.save_team(p_id uuid, p_name text)
returns uuid language sql security invoker set search_path = '' as $$
  select app_private.save_team(p_id, p_name)
$$;
create function public.set_team_manager(p_team_id uuid, p_profile_id uuid, p_assigned boolean)
returns void language sql security invoker set search_path = '' as $$
  select app_private.set_team_manager(p_team_id, p_profile_id, p_assigned)
$$;

create function app_private.bootstrap_admin(p_id uuid, p_full_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target_email text;
begin
  perform pg_advisory_xact_lock(72419001);
  if exists(select 1 from public.profiles where role = 'company_admin') then
    raise exception 'Administrator already initialized' using errcode = '42501';
  end if;
  select email into target_email from auth.users where id = p_id;
  insert into public.profiles(id, email, full_name, role)
  values(p_id, lower(target_email), btrim(p_full_name), 'company_admin');
  insert into app_private.admin_audit(actor_id, operation, target_id)
  values(null, 'admin.bootstrap', p_id);
  return p_id;
end
$$;
create function public.bootstrap_admin(p_id uuid, p_full_name text) returns uuid
language sql security invoker set search_path = '' as $$
  select app_private.bootstrap_admin(p_id, p_full_name)
$$;

revoke execute on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.current_role(), app_private.can_manage_team(uuid) to authenticated;
grant execute on function app_private.save_profile(uuid,text,public.app_role,uuid,boolean),
  app_private.save_team(uuid,text), app_private.set_team_manager(uuid,uuid,boolean) to authenticated;
grant execute on function app_private.bootstrap_admin(uuid,text) to service_role;
revoke execute on function public.save_profile(uuid,text,public.app_role,uuid,boolean),
  public.save_team(uuid,text), public.set_team_manager(uuid,uuid,boolean),
  public.bootstrap_admin(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.save_profile(uuid,text,public.app_role,uuid,boolean),
  public.save_team(uuid,text), public.set_team_manager(uuid,uuid,boolean) to authenticated;
grant execute on function public.bootstrap_admin(uuid,text) to service_role;

comment on schema journal_private is 'Reserved for future private emotional records. No API grants or tables in phase 1.';
comment on schema reporting is 'Reserved for future authorized anonymized aggregates; never expose individual records.';
