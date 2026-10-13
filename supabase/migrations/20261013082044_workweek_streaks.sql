-- Optional weekend use remains recorded. Only Monday-Friday days participate
-- in streaks, activity targets and reward thresholds, in the saved local zone.
create function app_private.journal_workday_streaks(p_today date) returns jsonb
language sql stable security invoker set search_path='' as $$
  with numbered as (
    select day,
      (day-date '2000-01-03') - 2*floor((day-date '2000-01-03')::numeric/7)
        - row_number() over(order by day) as island
    from journal_private.activity_days
    where user_id=(select app_private.journal_uid())
      and (select app_private.current_role()) is not null
      and day<=p_today and extract(isodow from day)<=5
  ), runs as (
    select max(day) as last,count(*)::integer as length from numbered group by island
  )
  select jsonb_build_object(
    'current',coalesce((select length from runs where last>=p_today -
      case extract(isodow from p_today) when 1 then 3 when 6 then 1 when 7 then 2 else 1 end
      order by last desc limit 1),0),
    'best',coalesce((select max(length) from runs),0),
    'active_days',(select count(*) from numbered)
  );
$$;
grant create on schema app_private to emotion_journal_executor;
alter function app_private.journal_workday_streaks(date) owner to emotion_journal_executor;
revoke all on function app_private.journal_workday_streaks(date) from public,anon,authenticated,service_role;
revoke create on schema app_private from emotion_journal_executor;

create or replace function app_private.record_journal_activity(p_kind text) returns void
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
  best:=(app_private.journal_workday_streaks(d)->>'best')::integer;
  insert into journal_private.rewards(user_id,milestone,earned_on)
  select app_private.journal_uid(),m,d from unnest(array[1,5,10,30]) m where m<=best
  on conflict(user_id,milestone) do nothing;
end $$;

create or replace function app_private.journal_progress(p_month date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare tz text; today date; month_start date; result jsonb;
begin
  if app_private.journal_uid() is null or app_private.current_role() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  select timezone into tz from journal_private.preferences where user_id=app_private.journal_uid();
  tz:=coalesce(tz,'UTC'); today:=(statement_timestamp() at time zone tz)::date;
  month_start:=date_trunc('month',coalesce(p_month,today))::date;
  if not isfinite(month_start) or month_start<'1900-01-01' or month_start>='2200-01-01' then raise exception 'Invalid month' using errcode='22023'; end if;
  select app_private.journal_workday_streaks(today) || jsonb_build_object(
    'timezone',tz,'today',today,'month',to_char(month_start,'YYYY-MM'),
    'days',coalesce((select jsonb_agg(day order by day) from journal_private.activity_days
      where user_id=(select app_private.journal_uid()) and day>=month_start and day<(month_start+interval '1 month')::date),'[]'::jsonb),
    'week',coalesce((select jsonb_agg(day order by day) from journal_private.activity_days
      where user_id=(select app_private.journal_uid()) and day>=date_trunc('week',today)::date
        and day<=today and extract(isodow from day)<=5),'[]'::jsonb),
    'rewards',coalesce((select jsonb_agg(jsonb_build_object('milestone',milestone,'earned_on',earned_on) order by milestone)
      from journal_private.rewards where user_id=(select app_private.journal_uid())),'[]'::jsonb)
  ) into result;
  return result;
end $$;

-- CREATE OR REPLACE preserves the existing owners and restricted RPC grants.
notify pgrst, 'reload schema';
