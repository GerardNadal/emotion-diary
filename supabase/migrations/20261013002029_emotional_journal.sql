-- Isolated storage; application roles have no schema or table access.
-- Narrow RPC bridge owned by a NOLOGIN/NOBYPASSRLS role, so RLS also applies inside it.
create role emotion_journal_executor nologin noinherit nobypassrls;
grant emotion_journal_executor to postgres;
grant usage on schema journal_private, app_private, auth, public to emotion_journal_executor;
grant execute on function auth.uid(), app_private.current_role() to emotion_journal_executor;

create table journal_private.reason_catalog (
  category text not null, reason text not null, primary key(category, reason)
);
insert into journal_private.reason_catalog(category, reason) values
('work', 'workload'),
('work', 'deadlines'),
('work', 'achievement'),
('work', 'changes'),
('work-relationships', 'teamwork'),
('work-relationships', 'conflict'),
('work-relationships', 'recognition'),
('work-relationships', 'leadership'),
('career', 'learning'),
('career', 'growth'),
('career', 'uncertainty'),
('balance', 'schedule'),
('balance', 'disconnecting'),
('balance', 'planning'),
('relationships', 'family'),
('relationships', 'friends'),
('relationships', 'partner'),
('health', 'sleep'),
('health', 'physical-health'),
('health', 'mental-health'),
('health', 'exercise'),
('personal', 'leisure'),
('personal', 'finances'),
('personal', 'life-events'),
('other', 'unspecified');

create table journal_private.entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  mood text not null check (mood in ('very-low','low','neutral','good','very-good')),
  emotion text not null check (emotion in ('joy','sadness','anger','calm','excitement','loved','celebration','anxiety','peace')),
  intensity smallint not null check (intensity between 1 and 5),
  reflection text not null default '' check (length(reflection) <= 2000),
  category text check (category in ('work','work-relationships','career','balance','relationships','health','personal','other')),
  reason text,
  custom_reason text not null default '' check (length(custom_reason) <= 250),
  activity text not null default '' check (length(activity) <= 250),
  reaction text not null default '' check (length(reaction) <= 1000),
  support text not null default '' check (length(support) <= 1000),
  occurred_at timestamptz not null check (isfinite(occurred_at) and occurred_at >= '1900-01-01' and occurred_at < '2200-01-01'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category, reason) references journal_private.reason_catalog(category, reason),
  check (reason is null or category is not null),
  check (custom_reason = '' or category is not null)
);
create index journal_entries_owner_time on journal_private.entries(user_id, occurred_at desc, id desc);
create index journal_entries_emotion_time on journal_private.entries(user_id, emotion, occurred_at desc, id desc);
create index journal_entries_category_time on journal_private.entries(user_id, category, occurred_at desc, id desc);
create index journal_entries_intensity_time on journal_private.entries(user_id, intensity, occurred_at desc, id desc);
alter table journal_private.entries enable row level security;
alter table journal_private.entries force row level security;
alter table journal_private.reason_catalog enable row level security;
revoke all on journal_private.entries, journal_private.reason_catalog from public, anon, authenticated, service_role;
grant select on journal_private.reason_catalog to emotion_journal_executor;
create policy catalog_read on journal_private.reason_catalog for select to emotion_journal_executor using (true);
grant select, insert, update, delete on journal_private.entries to emotion_journal_executor;
create policy entries_owner on journal_private.entries for all to emotion_journal_executor
  using (user_id = (select auth.uid()) and (select app_private.current_role()) is not null)
  with check (user_id = (select auth.uid()) and (select app_private.current_role()) is not null);

create function app_private.journal_save(p_id uuid, p_entry jsonb, p_create boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or app_private.current_role() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_id is null or p_entry is null or p_create is null or jsonb_typeof(p_entry) <> 'object'
    or p_entry ?| array['user_id','id','created_at','updated_at'] then
    raise exception 'Invalid entry' using errcode = '22023';
  end if;
  if p_create then
    insert into journal_private.entries(id, mood, emotion, intensity, reflection, category, reason, custom_reason, activity, reaction, support, occurred_at)
    values (p_id, p_entry->>'mood', p_entry->>'emotion', (p_entry->>'intensity')::smallint, coalesce(p_entry->>'reflection', ''), nullif(p_entry->>'category', ''), nullif(p_entry->>'reason', ''), coalesce(p_entry->>'custom_reason', ''), coalesce(p_entry->>'activity', ''), coalesce(p_entry->>'reaction', ''), coalesce(p_entry->>'support', ''), (p_entry->>'occurred_at')::timestamptz)
    on conflict (id) do nothing;
  else
    update journal_private.entries set mood = p_entry->>'mood', emotion = p_entry->>'emotion', intensity = (p_entry->>'intensity')::smallint, reflection = coalesce(p_entry->>'reflection', ''), category = nullif(p_entry->>'category', ''), reason = nullif(p_entry->>'reason', ''), custom_reason = coalesce(p_entry->>'custom_reason', ''), activity = coalesce(p_entry->>'activity', ''), reaction = coalesce(p_entry->>'reaction', ''), support = coalesce(p_entry->>'support', ''), occurred_at = (p_entry->>'occurred_at')::timestamptz, updated_at = clock_timestamp()
    where id = p_id and user_id = auth.uid();
  end if;
  select to_jsonb(e) - 'user_id' into result from journal_private.entries e where id = p_id and user_id = auth.uid();
  if result is null then raise exception 'Entry unavailable' using errcode = '42501'; end if;
  return result;
end
$$;

create function app_private.journal_get(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(e) - 'user_id' from journal_private.entries e
  where e.id = p_id and e.user_id = (select auth.uid())
$$;

create function app_private.journal_list(p_query jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare page_number integer := coalesce((p_query->>'page')::integer,1); result jsonb;
begin
  if page_number not between 1 and 100000 or
    not exists(select 1 from pg_catalog.pg_timezone_names where name = p_query->>'timezone') or
    coalesce(p_query->>'order','desc') not in ('asc','desc') then
    raise exception 'Invalid query' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'total', (select count(*) from journal_private.entries e where e.user_id = (select auth.uid())
      and (select app_private.current_role()) is not null
      and (nullif(p_query->>'from','') is null or e.occurred_at >= ((p_query->>'from')::date::timestamp at time zone (p_query->>'timezone')))
      and (nullif(p_query->>'to','') is null or e.occurred_at < (((p_query->>'to')::date + 1)::timestamp at time zone (p_query->>'timezone')))
      and (nullif(p_query->>'emotion','') is null or e.emotion = p_query->>'emotion')
      and (nullif(p_query->>'category','') is null or e.category = p_query->>'category')
      and (nullif(p_query->>'intensity','') is null or e.intensity = (p_query->>'intensity')::integer)),
    'page', page_number, 'page_size', 12,
    'entries', coalesce((select jsonb_agg(to_jsonb(page_entries) - 'user_id') from (
      select e.* from journal_private.entries e where e.user_id = (select auth.uid())
      and (select app_private.current_role()) is not null
      and (nullif(p_query->>'from','') is null or e.occurred_at >= ((p_query->>'from')::date::timestamp at time zone (p_query->>'timezone')))
      and (nullif(p_query->>'to','') is null or e.occurred_at < (((p_query->>'to')::date + 1)::timestamp at time zone (p_query->>'timezone')))
      and (nullif(p_query->>'emotion','') is null or e.emotion = p_query->>'emotion')
      and (nullif(p_query->>'category','') is null or e.category = p_query->>'category')
      and (nullif(p_query->>'intensity','') is null or e.intensity = (p_query->>'intensity')::integer)
      order by
        case when p_query->>'order' = 'asc' then e.occurred_at end asc,
        case when p_query->>'order' = 'asc' then e.id end asc,
        case when coalesce(p_query->>'order','desc') = 'desc' then e.occurred_at end desc,
        case when coalesce(p_query->>'order','desc') = 'desc' then e.id end desc
      limit 12 offset ((page_number - 1) * 12)
    ) page_entries), '[]'::jsonb)
  ) into result;
  return result;
end
$$;

create function app_private.journal_days(p_query jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = p_query->>'timezone')
    or nullif(p_query->>'from','') is null or nullif(p_query->>'to','') is null
    or (p_query->>'to')::date - (p_query->>'from')::date not between 0 and 41 then
    raise exception 'Invalid calendar range' using errcode = '22023';
  end if;
  with matched as (
    select (e.occurred_at at time zone (p_query->>'timezone'))::date as day,
      e.mood, e.emotion, e.occurred_at, e.id
    from journal_private.entries e where e.user_id = (select auth.uid())
      and (select app_private.current_role()) is not null
      and (nullif(p_query->>'from','') is null or e.occurred_at >= ((p_query->>'from')::date::timestamp at time zone (p_query->>'timezone')))
      and (nullif(p_query->>'to','') is null or e.occurred_at < (((p_query->>'to')::date + 1)::timestamp at time zone (p_query->>'timezone')))
      and (nullif(p_query->>'emotion','') is null or e.emotion = p_query->>'emotion')
      and (nullif(p_query->>'category','') is null or e.category = p_query->>'category')
      and (nullif(p_query->>'intensity','') is null or e.intensity = (p_query->>'intensity')::integer)
  ), daily as (
    select distinct on (day) day, count(*) over (partition by day) as count, mood, emotion
    from matched order by day, occurred_at desc, id desc
  )
  select coalesce(jsonb_agg(to_jsonb(daily) order by day),'[]'::jsonb) into result from daily;
  return result;
end
$$;

create function app_private.journal_delete(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare affected integer; expected integer;
begin
  if auth.uid() is null or app_private.current_role() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  expected := cardinality(p_ids);
  if expected is null or expected not between 1 and 12 or
    expected <> (select count(distinct id) from unnest(p_ids) id) then
    raise exception 'Invalid selection' using errcode = '22023';
  end if;
  delete from journal_private.entries where id = any(p_ids) and user_id = auth.uid();
  get diagnostics affected = row_count;
  if affected <> expected then raise exception 'Selection unavailable' using errcode = '42501'; end if;
  return affected;
end
$$;

-- Transfer only these narrowly scoped functions to a role that cannot bypass RLS.
grant create on schema app_private to emotion_journal_executor;
alter function app_private.journal_save(uuid,jsonb,boolean) owner to emotion_journal_executor;
revoke execute on function app_private.journal_save(uuid,jsonb,boolean) from public, anon, authenticated, service_role;
grant execute on function app_private.journal_save(uuid,jsonb,boolean) to authenticated;
create function public.journal_save(p_id uuid, p_entry jsonb, p_create boolean) returns jsonb
language sql security invoker set search_path = '' as $$
  select app_private.journal_save(p_id,p_entry,p_create)
$$;
revoke execute on function public.journal_save(uuid,jsonb,boolean) from public, anon, authenticated, service_role;
grant execute on function public.journal_save(uuid,jsonb,boolean) to authenticated;
alter function app_private.journal_get(uuid) owner to emotion_journal_executor;
revoke execute on function app_private.journal_get(uuid) from public, anon, authenticated, service_role;
grant execute on function app_private.journal_get(uuid) to authenticated;
create function public.journal_get(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select app_private.journal_get(p_id)
$$;
revoke execute on function public.journal_get(uuid) from public, anon, authenticated, service_role;
grant execute on function public.journal_get(uuid) to authenticated;
alter function app_private.journal_list(jsonb) owner to emotion_journal_executor;
revoke execute on function app_private.journal_list(jsonb) from public, anon, authenticated, service_role;
grant execute on function app_private.journal_list(jsonb) to authenticated;
create function public.journal_list(p_query jsonb) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select app_private.journal_list(p_query)
$$;
revoke execute on function public.journal_list(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.journal_list(jsonb) to authenticated;
alter function app_private.journal_days(jsonb) owner to emotion_journal_executor;
revoke execute on function app_private.journal_days(jsonb) from public, anon, authenticated, service_role;
grant execute on function app_private.journal_days(jsonb) to authenticated;
create function public.journal_days(p_query jsonb) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select app_private.journal_days(p_query)
$$;
revoke execute on function public.journal_days(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.journal_days(jsonb) to authenticated;
alter function app_private.journal_delete(uuid[]) owner to emotion_journal_executor;
revoke execute on function app_private.journal_delete(uuid[]) from public, anon, authenticated, service_role;
grant execute on function app_private.journal_delete(uuid[]) to authenticated;
create function public.journal_delete(p_ids uuid[]) returns integer
language sql security invoker set search_path = '' as $$
  select app_private.journal_delete(p_ids)
$$;
revoke execute on function public.journal_delete(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.journal_delete(uuid[]) to authenticated;
revoke create on schema app_private from emotion_journal_executor;
comment on schema journal_private is 'Private journal storage. Not exposed by Data API; no application role has schema usage.';
notify pgrst, 'reload schema';
