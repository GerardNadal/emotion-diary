-- Explicit synthetic provenance. No application role may attest a dataset.
-- The operator's deterministic seeder verifies the entire roster AND diary
-- against fixtures before inserting a certificate. Names alone are never proof.
create table reporting.demo_provenance (
  team_id uuid primary key references public.teams(id) on delete cascade,
  generation bigint not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  attested_at timestamptz not null default clock_timestamp(),
  check(valid_from<valid_until)
);
alter table reporting.demo_provenance enable row level security;
revoke all on reporting.demo_provenance from public,anon,authenticated,service_role;
grant select on reporting.demo_provenance to dentro_reporting_executor;
create policy executor_demo_read on reporting.demo_provenance for select to dentro_reporting_executor using(true);

-- Any journal write invalidates synthetic provenance for the whole team, even
-- if it affects another month. Never publish real additions as fictional data.
create function reporting.demo_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_team uuid; new_team uuid;
begin
  perform pg_advisory_xact_lock(72419005);
  if tg_table_schema='journal_private' then
    if tg_op<>'INSERT' then select team_id into old_team from public.profiles where id=old.user_id; end if;
    if tg_op<>'DELETE' then select team_id into new_team from public.profiles where id=new.user_id; end if;
  else
    if tg_op<>'INSERT' then old_team:=old.team_id; end if;
    if tg_op<>'DELETE' then new_team:=new.team_id; end if;
    if tg_op='UPDATE' and old.team_id is not distinct from new.team_id
      and old.active=new.active and old.role=new.role then return new; end if;
  end if;
  delete from reporting.demo_provenance where team_id=old_team or team_id=new_team;
  return coalesce(new,old);
end $$;
revoke execute on function reporting.demo_changed() from public,anon,authenticated,service_role;
create trigger reporting_demo_entry_changed after insert or update or delete on journal_private.entries for each row execute function reporting.demo_changed();
create trigger reporting_demo_membership_changed after insert or update or delete on public.profiles for each row execute function reporting.demo_changed();

-- Only certified synthetic datasets may use a known fixture baseline or publish
-- synthetic unanimous/rare categories. Real-data controls are unchanged.
create or replace function reporting.publish_month(p_team uuid,p_month date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  stored reporting.month_releases; state reporting.team_state; cfg reporting.policy;
  people uuid[]; n integer; roster integer; data jsonb; dimensions jsonb;
  lower_bound timestamptz; upper_bound timestamptz; is_demo boolean;
begin
  select * into cfg from reporting.policy;
  select * into state from reporting.team_state where team_id=p_team;
  lower_bound:=p_month::timestamp at time zone 'Europe/Madrid';
  upper_bound:=(p_month+interval '1 month')::timestamp at time zone 'Europe/Madrid';
  select exists(select 1 from reporting.demo_provenance d where d.team_id=p_team and d.generation=state.generation and lower_bound>=d.valid_from and upper_bound<=d.valid_until) into is_demo;
  if state.team_id is null or (not is_demo and lower_bound<greatest(cfg.baseline,state.stable_since))
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
    ) select jsonb_object_agg(kind,case when ok or is_demo then jsonb_build_object('status','published','values',bars)
      else '{"status":"insufficient_data"}'::jsonb end) into dimensions from safe;
    data:=jsonb_build_object('status','published','source',case when is_demo then 'demo' else 'live' end,'dimensions',dimensions,'participation',
      case when is_demo or roster-n>=cfg.min_participants then jsonb_build_object('status','published','percent',round(n::numeric/roster*10)*10)
      else '{"status":"insufficient_data"}'::jsonb end);
  end if;
  insert into reporting.month_releases(team_id,month,generation,participants,payload) values(p_team,p_month,state.generation,people,data);
  return data;
end $$;


create or replace function reporting.combine(p_items jsonb) returns jsonb
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
    then '{"status":"insufficient_data"}'::jsonb else jsonb_build_object('status','published','source',case when exists(select 1 from items where item->>'source' in ('demo','mixed')) then case when exists(select 1 from items where coalesce(item->>'source','live') in ('live','mixed')) then 'mixed' else 'demo' end else 'live' end,'dimensions',(
      select jsonb_object_agg(k.kind,case when exists(select 1 from items i where i.item->'dimensions'->k.kind->>'status' is distinct from 'published')
        then '{"status":"insufficient_data"}'::jsonb else jsonb_build_object('status','published','values',b.vals) end)
      from kinds k left join bars b using(kind)), 'participation',case when exists(select 1 from items where item->'participation'->>'status' is distinct from 'published')
        then '{"status":"insufficient_data"}'::jsonb else (select jsonb_build_object('status','published','percent',round(avg((item->'participation'->>'percent')::numeric)/10)*10) from items) end) end
$$;

notify pgrst,'reload schema';
