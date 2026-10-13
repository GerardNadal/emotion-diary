-- Personal aggregates and meaningful activity. Reuse the phase-3 NOBYPASSRLS
-- bridge; neither application clients nor administrators can access storage.
create table journal_private.preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  timezone text not null
);
create table journal_private.activity_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  timezone text not null,
  kind text not null check (kind in ('entry_created','reflection_completed')),
  recorded_at timestamptz not null default clock_timestamp(),
  primary key(user_id,day)
);
create table journal_private.reflection_completions (
  entry_id uuid primary key references journal_private.entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade
);
create index reflection_completions_owner on journal_private.reflection_completions(user_id);
create table journal_private.rewards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  milestone integer not null check (milestone in (1,5,10,30)),
  earned_on date not null,
  primary key(user_id,milestone)
);
do $$ declare t text; begin
  foreach t in array array['preferences','activity_days','reflection_completions','rewards'] loop
    execute format('alter table journal_private.%I enable row level security',t);
    execute format('alter table journal_private.%I force row level security',t);
    execute format('revoke all on journal_private.%I from public,anon,authenticated,service_role',t);
    execute format('grant select,insert,update on journal_private.%I to emotion_journal_executor',t);
    execute format('create policy owner_only on journal_private.%I for all to emotion_journal_executor using (user_id=(select app_private.journal_uid()) and (select app_private.current_role()) is not null) with check (user_id=(select app_private.journal_uid()) and (select app_private.current_role()) is not null)',t);
  end loop;
end $$;
-- Existing written reflections are already complete; editing/toggling them is
-- not a new completion. Do not invent historic activity without a known zone.
insert into journal_private.reflection_completions(entry_id,user_id)
select id,user_id from journal_private.entries where btrim(reflection,E' \t\n\r')<>'';

create function app_private.journal_preferences(p_timezone text, p_replace boolean default false) returns text
language plpgsql security definer set search_path='' as $$
declare tz text;
begin
  if app_private.journal_uid() is null or app_private.current_role() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_timezone is null or p_replace is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
    raise exception 'Invalid timezone' using errcode='22023';
  end if;
  insert into journal_private.preferences(user_id,timezone) values(app_private.journal_uid(),p_timezone)
  on conflict(user_id) do nothing;
  -- Serialize with activity recording. Changes affect future days only.
  select timezone into tz from journal_private.preferences where user_id=app_private.journal_uid() for update;
  if p_replace then
    update journal_private.preferences set timezone=p_timezone where user_id=app_private.journal_uid();
    tz:=p_timezone;
  end if;
  return tz;
end $$;

-- Internal extension point. Future real wellbeing actions may invoke this from
-- their validated DB mutation, after extending the kind CHECK. No public RPC.
create function app_private.record_journal_activity(p_kind text) returns void
language plpgsql security invoker set search_path='' as $$
declare tz text; d date; inserted integer; best integer;
begin
  if app_private.journal_uid() is null or app_private.current_role() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  insert into journal_private.preferences(user_id,timezone) values(app_private.journal_uid(),'UTC') on conflict do nothing;
  select timezone into tz from journal_private.preferences where user_id=app_private.journal_uid() for update;
  d:=(clock_timestamp() at time zone tz)::date;
  insert into journal_private.activity_days(user_id,day,timezone,kind) values(app_private.journal_uid(),d,tz,p_kind) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then return; end if;
  with numbered as (
    select day, day-(row_number() over(order by day))::integer as island
    from journal_private.activity_days where user_id=(select app_private.journal_uid())
  ), runs as (select count(*)::integer as length from numbered group by island)
  select max(length) into best from runs;
  insert into journal_private.rewards(user_id,milestone,earned_on)
  select app_private.journal_uid(),m,d from unnest(array[1,5,10,30]) m where m<=best
  on conflict(user_id,milestone) do nothing;
end $$;

create function app_private.journal_activity_trigger() returns trigger
language plpgsql security invoker set search_path='' as $$
declare inserted integer;
begin
  if tg_op='INSERT' then
    perform app_private.record_journal_activity('entry_created');
  end if;
  if btrim(new.reflection,E' \t\n\r')<>'' then
    insert into journal_private.reflection_completions(entry_id,user_id) values(new.id,new.user_id) on conflict do nothing;
    get diagnostics inserted=row_count;
    if tg_op='UPDATE' and btrim(old.reflection,E' \t\n\r')='' and inserted=1 then
      perform app_private.record_journal_activity('reflection_completed');
    end if;
  end if;
  return new;
end $$;
create trigger journal_meaningful_activity after insert or update of reflection on journal_private.entries
for each row execute function app_private.journal_activity_trigger();

create function app_private.journal_progress(p_month date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text; today date; month_start date; result jsonb;
begin
  if app_private.journal_uid() is null or app_private.current_role() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  select timezone into tz from journal_private.preferences where user_id=app_private.journal_uid();
  tz:=coalesce(tz,'UTC'); today:=(statement_timestamp() at time zone tz)::date;
  month_start:=date_trunc('month',coalesce(p_month,today))::date;
  if not isfinite(month_start) or month_start<'1900-01-01' or month_start>='2200-01-01' then raise exception 'Invalid month' using errcode='22023'; end if;
  with numbered as (
    select day,day-(row_number() over(order by day))::integer as island
    from journal_private.activity_days where user_id=(select app_private.journal_uid())
  ), runs as (select min(day) as first,max(day) as last,count(*)::integer as length from numbered group by island)
  select jsonb_build_object(
    'timezone',tz,'today',today,'month',to_char(month_start,'YYYY-MM'),
    'current',coalesce((select (least(last,today)-first+1) from runs where first<=today and last>=today-1 order by last desc limit 1),0),
    'best',coalesce((select max(length) from runs),0),
    'active_days',(select count(*) from numbered),
    'days',coalesce((select jsonb_agg(day order by day) from numbered where day>=month_start and day<(month_start+interval '1 month')::date),'[]'::jsonb),
    'week',coalesce((select jsonb_agg(day order by day) from numbered where day>=date_trunc('week',today)::date and day<=today),'[]'::jsonb),
    'rewards',coalesce((select jsonb_agg(jsonb_build_object('milestone',milestone,'earned_on',earned_on) order by milestone) from journal_private.rewards where user_id=(select app_private.journal_uid())),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create function app_private.journal_statistics(p_from date,p_to date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text; span integer; result jsonb;
begin
  if app_private.journal_uid() is null or app_private.current_role() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  span:=p_to-p_from+1;
  if span is null or span not between 1 and 366 or not isfinite(p_from) or not isfinite(p_to)
    or p_from<'1901-01-01' or p_to>='2200-01-01' then raise exception 'Invalid period (1..366 days)' using errcode='22023'; end if;
  select timezone into tz from journal_private.preferences where user_id=app_private.journal_uid(); tz:=coalesce(tz,'UTC');
  -- Sargable UTC bounds use the existing (user_id,occurred_at,id) index.
  -- Only metric columns enter the materialized CTE; no reflection text is read.
  with matched as materialized (
    select (occurred_at at time zone tz)::date as day,mood,emotion,intensity,category,reason,custom_reason,
      case mood when 'very-low' then 1 when 'low' then 2 when 'neutral' then 3 when 'good' then 4 else 5 end as mood_value,
      occurred_at >= (p_from::timestamp at time zone tz) as present
    from journal_private.entries where user_id=(select app_private.journal_uid())
      and occurred_at>=((p_from-span)::timestamp at time zone tz)
      and occurred_at<((p_to+1)::timestamp at time zone tz)
  ), daily as (
    select present,day,count(*)::integer as count,avg(mood_value) as mood_average,avg(intensity) as intensity_average
    from matched group by present,day
  ), periods as (
    select present,count(*)::integer as entries,count(distinct day)::integer as recorded_days from matched group by present
  ), distributions as (
    select present,'mood' as kind,mood as value,count(*)::integer as count from matched group by present,mood
    union all select present,'emotion',emotion,count(*)::integer from matched group by present,emotion
    union all select present,'intensity',intensity::text,count(*)::integer from matched group by present,intensity
  ), triggers as (
    select category,reason,nullif(btrim(custom_reason),'') as custom,count(*)::integer as count
    from matched where present and (category is not null or reason is not null or btrim(custom_reason)<>'')
    group by category,reason,nullif(btrim(custom_reason),'') order by count desc,category,reason,custom limit 8
  )
  select jsonb_build_object('from',p_from,'to',p_to,'previous_from',p_from-span,'previous_to',p_from-1,'timezone',tz,
    'current',jsonb_build_object(
      'entries',coalesce((select entries from periods where present),0),
      'recorded_days',coalesce((select recorded_days from periods where present),0),
      'mood_average',(select round(avg(mood_average),2) from daily where present),
      'intensity_average',(select round(avg(intensity_average),2) from daily where present)),
    'previous',jsonb_build_object(
      'entries',coalesce((select entries from periods where not present),0),
      'recorded_days',coalesce((select recorded_days from periods where not present),0),
      'mood_average',(select round(avg(mood_average),2) from daily where not present),
      'intensity_average',(select round(avg(intensity_average),2) from daily where not present)),
    'days',coalesce((select jsonb_agg(jsonb_build_object('day',d::date,'count',coalesce(daily.count,0),'mood_average',round(daily.mood_average,2),'intensity_average',round(daily.intensity_average,2)) order by d)
      from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d left join daily on daily.day=d::date and daily.present),'[]'::jsonb),
    'distributions',coalesce((select jsonb_agg(to_jsonb(distributions) order by kind,value,present) from distributions),'[]'::jsonb),
    'triggers',coalesce((select jsonb_agg(to_jsonb(triggers) order by count desc,category,reason,custom) from triggers),'[]'::jsonb),
    'without_trigger',(select count(*) from matched where present and category is null and reason is null and btrim(custom_reason)='')
  ) into result;
  return result;
end $$;

-- Extend the existing monthly aggregation with all distinct moods/emotions.
-- Keep latest mood and emotion for compatibility with the diary history.
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
    select day,count(*) as count,
      (array_agg(mood order by occurred_at desc,id desc))[1] as mood,
      (array_agg(emotion order by occurred_at desc,id desc))[1] as emotion,
      array_agg(distinct mood order by mood) as moods,
      array_agg(distinct emotion order by emotion) as emotions
    from matched group by day
  )
  select coalesce(jsonb_agg(to_jsonb(daily) order by day),'[]'::jsonb) into result from daily;
  return result;
end
$$;


grant create on schema app_private to emotion_journal_executor;
alter function app_private.journal_preferences(text,boolean) owner to emotion_journal_executor;
revoke all on function app_private.journal_preferences(text,boolean) from public,anon,authenticated,service_role;
grant execute on function app_private.journal_preferences(text,boolean) to authenticated;
create function public.journal_preferences(p_timezone text,p_replace boolean default false) returns text language sql security invoker set search_path='' as $$ select app_private.journal_preferences(p_timezone,p_replace) $$;
revoke all on function public.journal_preferences(text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.journal_preferences(text,boolean) to authenticated;
alter function app_private.journal_progress(date) owner to emotion_journal_executor;
revoke all on function app_private.journal_progress(date) from public,anon,authenticated,service_role;
grant execute on function app_private.journal_progress(date) to authenticated;
create function public.journal_progress(p_month date default null) returns jsonb language sql stable security invoker set search_path='' as $$ select app_private.journal_progress(p_month) $$;
revoke all on function public.journal_progress(date) from public,anon,authenticated,service_role;
grant execute on function public.journal_progress(date) to authenticated;
alter function app_private.journal_statistics(date,date) owner to emotion_journal_executor;
revoke all on function app_private.journal_statistics(date,date) from public,anon,authenticated,service_role;
grant execute on function app_private.journal_statistics(date,date) to authenticated;
create function public.journal_statistics(p_from date,p_to date) returns jsonb language sql stable security invoker set search_path='' as $$ select app_private.journal_statistics(p_from,p_to) $$;
revoke all on function public.journal_statistics(date,date) from public,anon,authenticated,service_role;
grant execute on function public.journal_statistics(date,date) to authenticated;
alter function app_private.record_journal_activity(text) owner to emotion_journal_executor;
revoke all on function app_private.record_journal_activity(text) from public,anon,authenticated,service_role;
alter function app_private.journal_activity_trigger() owner to emotion_journal_executor;
revoke all on function app_private.journal_activity_trigger() from public,anon,authenticated,service_role;
revoke create on schema app_private from emotion_journal_executor;
notify pgrst, 'reload schema';
