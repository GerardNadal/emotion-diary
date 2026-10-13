-- No prompts or recommendations persisted. One bounded technical row per owner.
create table journal_private.ai_usage (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  requests timestamptz[] not null default '{}',
  lease_token uuid,
  lease_until timestamptz,
  check (cardinality(requests)<=10)
);
create table journal_private.wellbeing_completions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  activity text not null check (activity in ('pause','screen','planning','movement','reflection','communication','disconnect')),
  primary key(user_id,day,activity)
);
alter table journal_private.activity_days drop constraint activity_days_kind_check;
alter table journal_private.activity_days add constraint activity_days_kind_check
  check (kind in ('entry_created','reflection_completed','wellbeing_completed'));

do $$ declare t text; begin
  foreach t in array array['ai_usage','wellbeing_completions'] loop
    execute format('alter table journal_private.%I enable row level security',t);
    execute format('alter table journal_private.%I force row level security',t);
    execute format('revoke all on journal_private.%I from public,anon,authenticated,service_role',t);
    execute format('grant select,insert,update,delete on journal_private.%I to emotion_journal_executor',t);
    execute format('create policy owner_only on journal_private.%I for all to emotion_journal_executor using (user_id=(select app_private.journal_uid()) and (select app_private.current_role()) is not null) with check (user_id=(select app_private.journal_uid()) and (select app_private.current_role()) is not null)',t);
  end loop;
end $$;

create function app_private.ai_reserve(p_entry_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=app_private.journal_uid(); r journal_private.ai_usage; recent timestamptz[]; n timestamptz:=clock_timestamp(); token uuid;
begin
  if u is null or app_private.current_role() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  -- RLS enforces ownership independently of the application.
  if not exists(select 1 from journal_private.entries where id=p_entry_id and user_id=u) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  insert into journal_private.ai_usage(user_id) values(u) on conflict do nothing;
  select * into r from journal_private.ai_usage where user_id=u for update;
  -- Refresh time after acquiring the row lock, so long waits cannot shorten a lease.
  n:=clock_timestamp();
  if r.lease_until>n then return jsonb_build_object('allowed',false,'reason','busy'); end if;
  select coalesce(array_agg(t order by t),'{}'::timestamptz[]) into recent
    from unnest(r.requests) t where t>n-interval '24 hours';
  -- Rolling limits: ten/day, three/hour, one/minute. Errors consume a slot.
  if cardinality(recent)>=10 or (select count(*) from unnest(recent) t where t>n-interval '1 hour')>=3
    or exists(select 1 from unnest(recent) t where t>n-interval '1 minute') then
    return jsonb_build_object('allowed',false,'reason','limit');
  end if;
  token:=gen_random_uuid();
  update journal_private.ai_usage set requests=array_append(recent,n),lease_token=token,lease_until=n+interval '90 seconds' where user_id=u;
  return jsonb_build_object('allowed',true,'token',token);
end $$;

create function app_private.ai_release(p_token uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if app_private.journal_uid() is null or app_private.current_role() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  update journal_private.ai_usage set lease_token=null,lease_until=null
    where user_id=app_private.journal_uid() and lease_token=p_token;
end $$;

create function app_private.wellbeing_complete(p_activity text) returns boolean
language plpgsql security definer set search_path='' as $$
declare tz text; inserted integer;
begin
  if app_private.journal_uid() is null or app_private.current_role() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_activity is null or p_activity not in ('pause','screen','planning','movement','reflection','communication','disconnect') then
    raise exception 'Invalid activity' using errcode='22023';
  end if;
  insert into journal_private.preferences(user_id,timezone) values(app_private.journal_uid(),'UTC') on conflict do nothing;
  select timezone into tz from journal_private.preferences where user_id=app_private.journal_uid() for update;
  -- Bounded completion deduplication: old activity content never stored.
  delete from journal_private.wellbeing_completions where user_id=app_private.journal_uid() and day<(clock_timestamp() at time zone tz)::date-1;
  insert into journal_private.wellbeing_completions(user_id,day,activity)
    values(app_private.journal_uid(),(clock_timestamp() at time zone tz)::date,p_activity) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 then perform app_private.record_journal_activity('wellbeing_completed'); end if;
  return inserted=1;
end $$;

grant create on schema app_private to emotion_journal_executor;
alter function app_private.ai_reserve(uuid) owner to emotion_journal_executor;
alter function app_private.ai_release(uuid) owner to emotion_journal_executor;
alter function app_private.wellbeing_complete(text) owner to emotion_journal_executor;
revoke create on schema app_private from emotion_journal_executor;
revoke all on function app_private.ai_reserve(uuid),app_private.ai_release(uuid),app_private.wellbeing_complete(text) from public,anon,authenticated,service_role;
grant execute on function app_private.ai_reserve(uuid),app_private.ai_release(uuid),app_private.wellbeing_complete(text) to authenticated;
create function public.ai_reserve(p_entry_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.ai_reserve(p_entry_id) $$;
create function public.ai_release(p_token uuid) returns void language sql security invoker set search_path='' as $$ select app_private.ai_release(p_token) $$;
create function public.wellbeing_complete(p_activity text) returns boolean language sql security invoker set search_path='' as $$ select app_private.wellbeing_complete(p_activity) $$;
revoke all on function public.ai_reserve(uuid),public.ai_release(uuid),public.wellbeing_complete(text) from public,anon,authenticated,service_role;
grant execute on function public.ai_reserve(uuid),public.ai_release(uuid),public.wellbeing_complete(text) to authenticated;
notify pgrst,'reload schema';
