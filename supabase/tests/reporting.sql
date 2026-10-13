-- Same assertions on embedded PostgreSQL and hosted Supabase. All rolled back.
begin;
-- Bulk fixture loading is privileged SQL; personal activity is verified in
-- evolution.sql and the live authenticated RPC tests, not invented here.
alter table journal_private.entries disable trigger journal_meaningful_activity;
create function pg_temp.assert_true(ok boolean, description text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',description; end if; end $$;
create function pg_temp.expect_error(statement text, expected text default '42501') returns void language plpgsql as $$
begin
  begin execute statement; exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Unexpected SQLSTATE %: %',sqlstate,sqlerrm;
  end; raise exception 'Expected denial: %',statement;
end $$;
create function pg_temp.person(n integer) returns uuid language sql immutable as $$
select ('f5100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
create function pg_temp.team(n integer) returns uuid language sql immutable as $$
select ('f5200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid $$;
insert into auth.users(id,email) select pg_temp.person(n),'phase5-'||n||'@example.test' from generate_series(1,34) n;
insert into public.teams(id,name) select pg_temp.team(n),'Phase 5 isolated team '||n from generate_series(1,5) n;
insert into public.profiles(id,email,full_name,role,team_id,active)
select pg_temp.person(n),'phase5-'||n||'@example.test','Phase 5 test',
  case when n=31 then 'company_admin'::public.app_role when n=32 then 'team_admin'::public.app_role else 'employee'::public.app_role end,
  case when n in (31,32) then null else pg_temp.team(case when n<=9 or n>=30 then 1 when n<=11 then 2 when n<=23 then 3 else 4 end) end,n<>33
from generate_series(1,33) n;
insert into public.team_managers(team_id,profile_id) values(pg_temp.team(1),pg_temp.person(32)),(pg_temp.team(3),pg_temp.person(32));
-- Test-only historical provenance, never enabled by an application RPC.
update reporting.policy set baseline='2025-01-01',min_participants=3;
update reporting.team_state set stable_since='2025-01-01' where team_id in(select pg_temp.team(n) from generate_series(1,5) n);
-- A: 6 participants, two balanced categories, three months. Repeated records do
-- not increase one user's period weight. No private text reaches output.
insert into journal_private.entries(id,user_id,mood,emotion,intensity,category,reason,reflection,custom_reason,occurred_at)
select gen_random_uuid(),pg_temp.person(n),case when n<=3 then 'good' else 'low' end,
case when n<=3 then 'calm' else 'anxiety' end,case when n<=3 then 2 else 4 end,
case when n<=3 then 'work' else 'balance' end,case when n<=3 then 'workload' else 'schedule' end,
'SECRET REFLECTION','SECRET CUSTOM',date '2026-04-10'+make_interval(months=>m)
from generate_series(1,6) n cross join generate_series(0,2) m;
insert into journal_private.entries(id,user_id,mood,emotion,intensity,category,reason,occurred_at)
select gen_random_uuid(),pg_temp.person(1),'good','calm',2,'work','workload','2026-04-10T12:00:00Z' from generate_series(1,6000);
-- Small team B, excluded from every company statistic.
insert into journal_private.entries(id,user_id,mood,emotion,intensity,occurred_at)
select gen_random_uuid(),pg_temp.person(n),'very-low','sadness',5,'2026-04-10T12:00:00Z' from generate_series(10,11) n;
-- C: 9 participants, three balanced categories; one extra active day below.
insert into journal_private.entries(id,user_id,mood,emotion,intensity,category,reason,occurred_at)
select gen_random_uuid(),pg_temp.person(n),case when n<=14 then 'good' when n<=17 then 'low' else 'neutral' end,
case when n<=14 then 'joy' when n<=17 then 'anxiety' else 'calm' end,case when n<=14 then 1 when n<=17 then 3 else 5 end,
case when n<=14 then 'work' when n<=17 then 'balance' else 'career' end,case when n<=14 then 'workload' when n<=17 then 'schedule' else 'learning' end,
'2026-04-10T12:00:00Z' from generate_series(12,20) n;
insert into journal_private.entries(id,user_id,mood,emotion,intensity,category,reason,occurred_at)
select gen_random_uuid(),pg_temp.person(12),'good','joy',1,'work','workload','2026-04-10T12:00:00Z' from generate_series(1,100);
insert into journal_private.entries(id,user_id,mood,emotion,intensity,category,reason,occurred_at)
values(gen_random_uuid(),pg_temp.person(12),'low','anxiety',3,'balance','schedule','2026-04-11T12:00:00Z');
-- D: rare category => complete dimension suppression, no residual total.
insert into journal_private.entries(id,user_id,mood,emotion,intensity,occurred_at)
select gen_random_uuid(),pg_temp.person(n),case when n=29 then 'low' else 'good' end,
case when n<=26 then 'joy' else 'calm' end,case when n<=26 then 1 else 3 end,'2026-04-10T12:00:00Z' from generate_series(24,29) n;

select set_config('request.jwt.claim.sub',pg_temp.person(1)::text,true);
set local role authenticated;
select pg_temp.expect_error($q$select public.collective_statistics(pg_temp.team(1),'2026-04-01','month')$q$);
reset role;
select set_config('request.jwt.claim.sub',pg_temp.person(32)::text,true);
set local role authenticated;
select pg_temp.expect_error($q$select public.collective_statistics(pg_temp.team(2),'2026-04-01','month')$q$);
select pg_temp.expect_error($q$select public.collective_statistics(null,'2026-04-01','month')$q$);
select pg_temp.expect_error($q$select reporting.publish_month(pg_temp.team(1),'2026-04-01')$q$);
select pg_temp.expect_error($q$select * from reporting.month_releases$q$);
select pg_temp.expect_error($q$select * from journal_private.entries$q$);
select pg_temp.expect_error($q$select public.collective_statistics(pg_temp.team(1),'2026-04-02','month')$q$,'22023');
select pg_temp.expect_error($q$select public.collective_statistics(pg_temp.team(1),'2026-04-01','day')$q$,'22023');
select pg_temp.expect_error($q$select public.collective_statistics(pg_temp.team(1),'2026-05-01','quarter')$q$,'22023');
select pg_temp.expect_error($q$select public.collective_statistics(pg_temp.team(1),null,'month')$q$,'22023');
select pg_temp.expect_error($q$select public.collective_statistics(pg_temp.team(1),date_trunc('month',now())::date,'month')$q$,'22023');
select pg_temp.assert_true(public.journal_get((select id from public.profiles limit 1)) is null,'admin cannot read another diary');
do $$ declare result jsonb; again jsonb; q jsonb; begin
  result:=public.collective_statistics(pg_temp.team(1),'2026-04-01','month');
  again:=public.collective_statistics(pg_temp.team(1),'2026-04-01','month');
  perform pg_temp.assert_true(result=again,'identical repeated publication');
  perform pg_temp.assert_true(result->'current'->>'status'='published','manager gets authorized team');
  perform pg_temp.assert_true(result->'current'->'dimensions'->'mood'->'values' @> '[{"value":"good","percent":50},{"value":"low","percent":50}]','6000 extra entries do not overweight employee');
  perform pg_temp.assert_true(result->'current'->'participation'->>'percent'='60','participation uses actual participants and active stable roster');
  perform pg_temp.assert_true(result::text not like '%SECRET%' and result::text not like '%f5100000%' and result::text not like '%user_id%' and result::text not like '%entries%' and result::text not like '%reflection%','no identifying content or exact counts');
  q:=public.collective_statistics(pg_temp.team(1),'2026-04-01','quarter');
  perform pg_temp.assert_true(q->'current'=result->'current','quarter is postprocessing of monthly releases');
  perform pg_temp.assert_true(public.collective_statistics(pg_temp.team(3),'2026-04-01','month')->'current'->'dimensions'->'mood'->'values' @> '[{"value":"good","percent":30},{"value":"low","percent":40}]','days and participants equally weighted');
end $$;
reset role;
select set_config('request.jwt.claim.sub',pg_temp.person(31)::text,true);
set local role authenticated;
do $$ declare a jsonb; b jsonb; begin
  a:=public.collective_statistics(pg_temp.team(2),'2026-04-01','month');
  perform pg_temp.assert_true(a->'current'='{"status":"insufficient_data"}','two real participants withheld');
  perform pg_temp.assert_true(public.collective_statistics(pg_temp.team(5),'2026-04-01','month')->'current'='{"status":"insufficient_data"}','empty team withheld');
  b:=public.collective_statistics(pg_temp.team(4),'2026-04-01','month');
  perform pg_temp.assert_true(b->'current'->'dimensions'->'mood'='{"status":"insufficient_data"}','rare and complementary category protected');
  perform pg_temp.assert_true(b->'current'->'participation'='{"status":"insufficient_data"}','unanimous participation protected');
  a:=public.collective_statistics(null,'2026-04-01','month');
  perform pg_temp.assert_true(a->>'coverage'='publishable_teams','company explicitly excludes withheld teams');
  perform pg_temp.assert_true(a->'current'->'dimensions'->'mood'='{"status":"insufficient_data"}','company cannot unmask suppressed team dimension');
end $$;
reset role;
-- Company outputs invariant under mutations in the small excluded team.
create temporary table before_company as select public.collective_statistics(null,'2026-04-01','month') value;
update journal_private.entries set mood='very-good' where user_id=pg_temp.person(10);
select pg_temp.assert_true((select value from before_company)=public.collective_statistics(null,'2026-04-01','month'),'company difference excludes small team entirely');

-- Exactly one departing participant would make sequential subtraction unsafe.
insert into journal_private.entries(id,user_id,mood,emotion,intensity,occurred_at)
select gen_random_uuid(),pg_temp.person(n),'good','joy',3,'2026-07-10T12:00:00Z' from generate_series(1,5) n;
select pg_temp.assert_true(public.collective_statistics(pg_temp.team(1),'2026-07-01','month')->'current'='{"status":"insufficient_data"}','small change in participant sets withheld');
-- Edit withdraws forever, preserving old participant sets for future checks.
update journal_private.entries set mood='neutral' where user_id=pg_temp.person(1) and occurred_at='2026-04-10T12:00:00Z';
select pg_temp.assert_true(public.collective_statistics(pg_temp.team(1),'2026-04-01','month')->'current'='{"status":"insufficient_data"}','historical edit withdraws rather than revealing delta');
select pg_temp.assert_true(public.collective_statistics(pg_temp.team(1),'2026-04-01','quarter')->'current'='{"status":"insufficient_data"}','quarter cannot recover withdrawn month');
delete from journal_private.entries where user_id=pg_temp.person(12);
select pg_temp.assert_true(public.collective_statistics(pg_temp.team(3),'2026-04-01','month')->'current'='{"status":"insufficient_data"}','historical deletion withdraws publication');
insert into journal_private.entries(id,user_id,mood,emotion,intensity,occurred_at) values(gen_random_uuid(),pg_temp.person(29),'neutral','joy',1,'2026-04-12T12:00:00Z');
select pg_temp.assert_true(public.collective_statistics(pg_temp.team(4),'2026-04-01','month')->'current'='{"status":"insufficient_data"}','backdated insert cannot produce second version');
update public.profiles set team_id=pg_temp.team(3) where id=pg_temp.person(1);
select pg_temp.assert_true(public.collective_statistics(pg_temp.team(1),'2026-05-01','month')->'current'='{"status":"insufficient_data"}','transfer protects old team history');
select pg_temp.assert_true(public.collective_statistics(pg_temp.team(3),'2026-05-01','month')->'current'='{"status":"insufficient_data"}','transfer never reattributes old entries to new team');
update public.profiles set active=false where id=pg_temp.person(2);
select pg_temp.assert_true(public.collective_statistics(pg_temp.team(1),'2026-06-01','month')->'current'='{"status":"insufficient_data"}','deactivation protects former cohort');
update public.team_managers set team_id=pg_temp.team(2) where team_id=pg_temp.team(1);
select set_config('request.jwt.claim.sub',pg_temp.person(32)::text,true);
set local role authenticated;
select pg_temp.expect_error($q$select public.collective_statistics(pg_temp.team(1),'2026-04-01','month')$q$);
reset role;
update public.profiles set active=false where id=pg_temp.person(32);
set local role authenticated;
select pg_temp.expect_error($q$select public.collective_statistics(pg_temp.team(3),'2026-04-01','month')$q$);
reset role;
select set_config('request.jwt.claim.sub',pg_temp.person(34)::text,true);
set local role authenticated;
select pg_temp.expect_error($q$select public.collective_statistics(pg_temp.team(3),'2026-04-01','month')$q$);
reset role;
set local role anon;
select pg_temp.expect_error($q$select public.collective_statistics(pg_temp.team(3),'2026-04-01','month')$q$);
reset role;
select pg_temp.assert_true(not has_function_privilege('service_role','public.collective_statistics(uuid,date,text)','execute'),'no service role shortcut');
select pg_temp.assert_true(not has_column_privilege('dentro_reporting_executor','journal_private.entries','reflection','select'),'executor cannot even select reflections');
select pg_temp.assert_true(not has_column_privilege('dentro_reporting_executor','public.profiles','email','select'),'executor cannot read employee emails');
select pg_temp.assert_true(not has_column_privilege('dentro_reporting_executor','public.profiles','full_name','select'),'executor cannot read employee names');
rollback;
