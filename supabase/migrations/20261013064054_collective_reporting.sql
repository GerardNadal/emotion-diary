-- Canonical, once-only releases. Reporting never serializes an individual row.
create role dentro_reporting_executor nologin noinherit nobypassrls;
grant dentro_reporting_executor to postgres;
grant usage on schema public, app_private, journal_private, reporting to dentro_reporting_executor;
grant execute on function app_private.journal_uid(), app_private.current_role(), app_private.can_manage_team(uuid) to dentro_reporting_executor;
grant select on public.profiles, public.teams, public.team_managers to dentro_reporting_executor;
create policy reporting_profiles on public.profiles for select to dentro_reporting_executor using (true);
create policy reporting_teams on public.teams for select to dentro_reporting_executor using (true);
create policy reporting_managers on public.team_managers for select to dentro_reporting_executor using (true);
grant select (user_id,mood,emotion,intensity,category,reason,occurred_at) on journal_private.entries to dentro_reporting_executor;
create policy reporting_entries on journal_private.entries for select to dentro_reporting_executor using (true);

create table reporting.policy (
  singleton boolean primary key default true check(singleton),
  min_participants integer not null default 3 check(min_participants between 3 and 100),
  baseline timestamptz not null default clock_timestamp()
);
insert into reporting.policy(singleton) values(true);
create table reporting.team_state (
  team_id uuid primary key references public.teams(id) on delete cascade,
  stable_since timestamptz not null default clock_timestamp(),
  generation bigint not null default 1
);
insert into reporting.team_state(team_id) select id from public.teams;
create table reporting.month_releases (
  team_id uuid not null references public.teams(id) on delete cascade,
  month date not null,
  generation bigint not null,
  participants uuid[] not null default '{}', -- internal only, never a response
  payload jsonb not null,
  revoked boolean not null default false,
  primary key(team_id,month)
);
alter table reporting.policy enable row level security;
alter table reporting.team_state enable row level security;
alter table reporting.month_releases enable row level security;
revoke all on all tables in schema reporting from public,anon,authenticated,service_role;
grant select on reporting.policy, reporting.team_state to dentro_reporting_executor;
grant select,insert on reporting.month_releases to dentro_reporting_executor;
create policy executor_policy on reporting.policy for select to dentro_reporting_executor using(true);
create policy executor_state on reporting.team_state for select to dentro_reporting_executor using(true);
create policy executor_releases_read on reporting.month_releases for select to dentro_reporting_executor using(true);
create policy executor_releases_insert on reporting.month_releases for insert to dentro_reporting_executor with check(true);
create index reporting_entries_time on journal_private.entries(occurred_at,user_id);

-- Directory membership is authoritative only from this migration forward.
-- Transfers, activation, deletion and role changes start a new stable cohort.
create function reporting.directory_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare old_team uuid; new_team uuid;
begin
  perform pg_advisory_xact_lock(72419005);
  if tg_table_name = 'teams' then
    insert into reporting.team_state(team_id) values(new.id) on conflict do nothing;
    return new;
  end if;
  if tg_op <> 'INSERT' then old_team := old.team_id; end if;
  if tg_op <> 'DELETE' then new_team := new.team_id; end if;
  if tg_op = 'UPDATE' and old.team_id is not distinct from new.team_id
    and old.active = new.active and old.role = new.role then return new; end if;
  update reporting.team_state set stable_since=clock_timestamp(),generation=generation+1
    where team_id=old_team or team_id=new_team;
  update reporting.month_releases set revoked=true,payload='{"status":"insufficient_data"}'
    where team_id=old_team or team_id=new_team;
  return coalesce(new,old);
end $$;
create trigger reporting_team_created after insert on public.teams for each row execute function reporting.directory_changed();
create trigger reporting_membership_changed after insert or update or delete on public.profiles for each row execute function reporting.directory_changed();

-- No second numeric version after a historical mutation: withdraw permanently.
create function reporting.entry_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare old_month date; new_month date; target uuid;
begin
  perform pg_advisory_xact_lock(72419005);
  if tg_op <> 'INSERT' then old_month := date_trunc('month',old.occurred_at at time zone 'Europe/Madrid')::date; target:=old.user_id; end if;
  if tg_op <> 'DELETE' then new_month := date_trunc('month',new.occurred_at at time zone 'Europe/Madrid')::date; target:=new.user_id; end if;
  update reporting.month_releases r set revoked=true,payload='{"status":"insufficient_data"}'
  where (r.month=old_month or r.month=new_month) and (
    target=any(r.participants) or r.team_id=(select p.team_id from public.profiles p where p.id=target));
  return coalesce(new,old);
end $$;
create trigger reporting_entry_changed after insert or update or delete on journal_private.entries for each row execute function reporting.entry_changed();
create function reporting.policy_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(72419005);
  update reporting.month_releases set revoked=true,payload='{"status":"insufficient_data"}';
  return new;
end $$;
create trigger reporting_policy_changed after update on reporting.policy for each row execute function reporting.policy_changed();

create function reporting.publish_month(p_team uuid,p_month date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  stored reporting.month_releases; state reporting.team_state; cfg reporting.policy;
  people uuid[]; n integer; roster integer; data jsonb; dimensions jsonb;
  lower_bound timestamptz; upper_bound timestamptz;
begin
  select * into cfg from reporting.policy;
  select * into state from reporting.team_state where team_id=p_team;
  lower_bound:=p_month::timestamp at time zone 'Europe/Madrid';
  upper_bound:=(p_month+interval '1 month')::timestamp at time zone 'Europe/Madrid';
  if state.team_id is null or lower_bound<greatest(cfg.baseline,state.stable_since)
    or upper_bound>clock_timestamp() then return '{"status":"insufficient_data"}'; end if;
  select * into stored from reporting.month_releases where team_id=p_team and month=p_month;
  if found then
    if stored.revoked or stored.generation<>state.generation then return '{"status":"insufficient_data"}'; end if;
    return stored.payload;
  end if;
  select coalesce(array_agg(distinct e.user_id order by e.user_id),'{}') into people
    from journal_private.entries e join public.profiles p on p.id=e.user_id
    where p.team_id=p_team and p.active and p.role='employee'
      and e.occurred_at>=lower_bound and e.occurred_at<upper_bound;
  n:=cardinality(people);
  select count(*) into roster from public.profiles where team_id=p_team and active and role='employee';
  data:='{"status":"insufficient_data"}';
  -- Query order cannot bypass the participant-set difference check. Retain sets
  -- even for revoked releases; never reuse a team/month with another population.
  if n>=cfg.min_participants and not exists (
    select 1 from reporting.month_releases r where r.team_id=p_team and r.generation=state.generation
      and cardinality(r.participants)>=cfg.min_participants and (
        (select count(*) from unnest(people) u where not u=any(r.participants)) between 1 and cfg.min_participants-1 or
        (select count(*) from unnest(r.participants) u where not u=any(people)) between 1 and cfg.min_participants-1)
  ) then
    -- First entries are averaged within each user-local_day. Then days within each
    -- participant. Finally participants equally; entry volume cannot add weight.
    with base as materialized (
      select e.user_id,(e.occurred_at at time zone 'Europe/Madrid')::date local_day,
        e.mood,e.emotion,e.intensity,e.category,e.reason
      from journal_private.entries e where e.user_id=any(people)
        and e.occurred_at>=lower_bound and e.occurred_at<upper_bound
    ), expanded as (
      select b.user_id,b.local_day,v.kind,v.value from base b cross join lateral (values
        ('mood',b.mood),('emotion',b.emotion),('intensity',b.intensity::text),
        ('factor',case when b.category in ('work','work-relationships','career','balance') then b.category else 'unreported' end),
        ('reason',case when b.category in ('work','work-relationships','career','balance') and b.reason is not null then b.reason else 'unreported' end)
      ) v(kind,value)
    ), daily as (
      select user_id,local_day,kind,value,count(*)::numeric / sum(count(*)) over(partition by user_id,local_day,kind) share
      from expanded group by user_id,local_day,kind,value
    ), days as (select user_id,count(distinct local_day) n from base group by user_id), per_user as (
      select d.user_id,d.kind,d.value,sum(d.share)/max(days.n) share from daily d join days using(user_id) group by d.user_id,d.kind,d.value
    ), cells as (
      select kind,value,count(*) supporters,round(sum(share)/n*10)*10 pct from per_user group by kind,value
    ), safe as (
      -- Whole-dimension suppression, including complementary suppression.
      -- Even unanimous categories are withheld: do not reveal everybody's state.
      select kind,bool_and(supporters>=cfg.min_participants and n-supporters>=cfg.min_participants) ok,
        jsonb_agg(jsonb_build_object('value',value,'percent',pct) order by value) bars
      from cells group by kind
    ) select jsonb_object_agg(kind,case when ok then jsonb_build_object('status','published','values',bars)
      else '{"status":"insufficient_data"}'::jsonb end) into dimensions from safe;
    data:=jsonb_build_object('status','published','dimensions',dimensions,'participation',
      case when roster-n>=cfg.min_participants then jsonb_build_object('status','published','percent',round(n::numeric/roster*10)*10)
      else '{"status":"insufficient_data"}'::jsonb end);
  end if;
  insert into reporting.month_releases(team_id,month,generation,participants,payload) values(p_team,p_month,state.generation,people,data);
  return data;
end $$;

-- Postprocessing only: no diaries, no fresh aggregate over excluded groups.
create function reporting.combine(p_items jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
  with items as (select value item from jsonb_array_elements(p_items)),
  kinds as (select unnest(array['mood','emotion','intensity','factor','reason']) kind),
  cells as (
    select k.kind,v->>'value' value,sum((v->>'percent')::numeric) total
    from items i cross join kinds k cross join lateral jsonb_array_elements(coalesce(i.item->'dimensions'->k.kind->'values','[]')) v
    group by k.kind,v->>'value'
  ), bars as (
    select kind,jsonb_agg(jsonb_build_object('value',value,'percent',round(total/(select count(*) from items)/10)*10) order by value) vals
    from cells group by kind
  ) select case when not exists(select 1 from items) or exists(select 1 from items where item->>'status'<>'published')
    then '{"status":"insufficient_data"}'::jsonb else jsonb_build_object('status','published','dimensions',(
      select jsonb_object_agg(k.kind,case when exists(select 1 from items i where i.item->'dimensions'->k.kind->>'status' is distinct from 'published')
        then '{"status":"insufficient_data"}'::jsonb else jsonb_build_object('status','published','values',b.vals) end)
      from kinds k left join bars b using(kind)), 'participation',case when exists(select 1 from items where item->'participation'->>'status' is distinct from 'published')
        then '{"status":"insufficient_data"}'::jsonb else (select jsonb_build_object('status','published','percent',round(avg((item->'participation'->>'percent')::numeric)/10)*10) from items) end) end
$$;
create function reporting.team_period(p_team uuid,p_month date,p_grain text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare parts jsonb:='[]'; i integer;
begin
  if p_grain='month' then return reporting.publish_month(p_team,p_month); end if;
  for i in 0..2 loop parts:=parts||jsonb_build_array(reporting.publish_month(p_team,(p_month+make_interval(months=>i))::date)); end loop;
  return reporting.combine(parts);
end $$;
create function reporting.scope_period(p_team uuid,p_month date,p_grain text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare parts jsonb:='[]'; t record; result jsonb;
begin
  if p_team is not null then return reporting.team_period(p_team,p_month,p_grain); end if;
  for t in select id from public.teams order by id loop
    result:=reporting.team_period(t.id,p_month,p_grain);
    if result->>'status'='published' then parts:=parts||jsonb_build_array(result); end if;
  end loop;
  return reporting.combine(parts);
end $$;

create function reporting.dashboard(p_team_id uuid,p_period date,p_grain text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor public.app_role; step integer; timeline jsonb:='[]'; comparisons jsonb:='[]'; d date; t record; result jsonb;
begin
  perform pg_advisory_xact_lock(72419005);
  actor:=app_private.current_role();
  if app_private.journal_uid() is null or actor is null or actor='employee' or
    (actor='team_admin' and (p_team_id is null or not app_private.can_manage_team(p_team_id))) or
    (p_team_id is not null and not exists(select 1 from public.teams where id=p_team_id)) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_grain is null or p_grain not in ('month','quarter') or p_period is null or not isfinite(p_period)
    or p_period<>date_trunc(p_grain,p_period::timestamp)::date
    or p_period<(date_trunc('month',clock_timestamp() at time zone 'Europe/Madrid')-interval '24 months')::date
    or (p_period+(case when p_grain='month' then interval '1 month' else interval '3 months' end))>
      (clock_timestamp() at time zone 'Europe/Madrid')::date then
    raise exception 'Only closed calendar months or quarters are allowed' using errcode='22023';
  end if;
  step:=case when p_grain='month' then 1 else 3 end;
  -- Always publish in chronological order; timeline is a fixed window, no filters.
  for i in reverse 5..0 loop
    d:=(p_period-make_interval(months=>i*step))::date;
    result:=reporting.scope_period(p_team_id,d,p_grain);
    timeline:=timeline||jsonb_build_array(jsonb_build_object('period',d,'data',result));
  end loop;
  if actor='company_admin' and p_team_id is null then
    for t in select id,name from public.teams order by name,id loop
      comparisons:=comparisons||jsonb_build_array(jsonb_build_object('name',t.name,'data',reporting.team_period(t.id,p_period,p_grain)));
    end loop;
  end if;
  return jsonb_build_object('period',p_period,'grain',p_grain,'current',timeline->5->'data','previous',timeline->4->'data',
    'timeline',timeline,'teams',comparisons,'coverage',case when p_team_id is null then 'publishable_teams' else 'selected_team' end);
end $$;

-- Only one authorized gateway can be invoked by application roles.
revoke execute on all functions in schema reporting from public,anon,authenticated,service_role;
grant execute on function reporting.publish_month(uuid,date),reporting.combine(jsonb),reporting.team_period(uuid,date,text),reporting.scope_period(uuid,date,text) to dentro_reporting_executor;
grant create on schema reporting to dentro_reporting_executor;
alter function reporting.dashboard(uuid,date,text) owner to dentro_reporting_executor;
revoke create on schema reporting from dentro_reporting_executor;
grant usage on schema reporting to authenticated;
grant execute on function reporting.dashboard(uuid,date,text) to authenticated;
create function public.collective_statistics(p_team_id uuid,p_period date,p_grain text default 'month') returns jsonb
language sql security invoker set search_path='' as $$ select reporting.dashboard(p_team_id,p_period,p_grain) $$;
revoke all on function public.collective_statistics(uuid,date,text) from public,anon,authenticated,service_role;
grant execute on function public.collective_statistics(uuid,date,text) to authenticated;
comment on schema reporting is 'Private once-only monthly publications; one authorized aggregate gateway. No raw diary APIs.';
notify pgrst,'reload schema';

