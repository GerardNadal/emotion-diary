-- Supabase's managed auth schema cannot be granted by the postgres role.
-- Resolve only the JWT identity through a tiny lookup owned by postgres.
-- This function never touches diary data; every diary RPC remains owned by
-- emotion_journal_executor, which is subject to RLS.
create function app_private.journal_uid() returns uuid
language sql stable security definer set search_path = '' as $$
  select auth.uid()
$$;
revoke execute on function app_private.journal_uid() from public, anon, authenticated, service_role;
grant execute on function app_private.journal_uid() to emotion_journal_executor;
alter table journal_private.entries alter column user_id set default app_private.journal_uid();
alter policy entries_owner on journal_private.entries
  using (user_id = (select app_private.journal_uid()) and (select app_private.current_role()) is not null)
  with check (user_id = (select app_private.journal_uid()) and (select app_private.current_role()) is not null);
create or replace function app_private.journal_save(p_id uuid, p_entry jsonb, p_create boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if app_private.journal_uid() is null or app_private.current_role() is null then
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
    where id = p_id and user_id = app_private.journal_uid();
  end if;
  select to_jsonb(e) - 'user_id' into result from journal_private.entries e where id = p_id and user_id = app_private.journal_uid();
  if result is null then raise exception 'Entry unavailable' using errcode = '42501'; end if;
  return result;
end
$$;

create or replace function app_private.journal_get(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(e) - 'user_id' from journal_private.entries e
  where e.id = p_id and e.user_id = (select app_private.journal_uid())
$$;

create or replace function app_private.journal_list(p_query jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare page_number integer := coalesce((p_query->>'page')::integer,1); result jsonb;
begin
  if page_number not between 1 and 100000 or
    not exists(select 1 from pg_catalog.pg_timezone_names where name = p_query->>'timezone') or
    coalesce(p_query->>'order','desc') not in ('asc','desc') then
    raise exception 'Invalid query' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'total', (select count(*) from journal_private.entries e where e.user_id = (select app_private.journal_uid())
      and (select app_private.current_role()) is not null
      and (nullif(p_query->>'from','') is null or e.occurred_at >= ((p_query->>'from')::date::timestamp at time zone (p_query->>'timezone')))
      and (nullif(p_query->>'to','') is null or e.occurred_at < (((p_query->>'to')::date + 1)::timestamp at time zone (p_query->>'timezone')))
      and (nullif(p_query->>'emotion','') is null or e.emotion = p_query->>'emotion')
      and (nullif(p_query->>'category','') is null or e.category = p_query->>'category')
      and (nullif(p_query->>'intensity','') is null or e.intensity = (p_query->>'intensity')::integer)),
    'page', page_number, 'page_size', 12,
    'entries', coalesce((select jsonb_agg(to_jsonb(page_entries) - 'user_id') from (
      select e.* from journal_private.entries e where e.user_id = (select app_private.journal_uid())
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

create or replace function app_private.journal_days(p_query jsonb) returns jsonb
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
    from journal_private.entries e where e.user_id = (select app_private.journal_uid())
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

create or replace function app_private.journal_delete(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare affected integer; expected integer;
begin
  if app_private.journal_uid() is null or app_private.current_role() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  expected := cardinality(p_ids);
  if expected is null or expected not between 1 and 12 or
    expected <> (select count(distinct id) from unnest(p_ids) id) then
    raise exception 'Invalid selection' using errcode = '22023';
  end if;
  delete from journal_private.entries where id = any(p_ids) and user_id = app_private.journal_uid();
  get diagnostics affected = row_count;
  if affected <> expected then raise exception 'Selection unavailable' using errcode = '42501'; end if;
  return affected;
end
$$;


notify pgrst, 'reload schema';
