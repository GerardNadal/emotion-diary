begin;
create or replace function pg_temp.assert_true(ok boolean, description text) returns void
language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %', description; end if; end $$;
create or replace function pg_temp.expect_error(statement text, expected text default '42501') returns void
language plpgsql as $$ begin
  begin execute statement;
  exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Unexpected SQLSTATE %, wanted %: %',sqlstate,expected,sqlerrm;
  end;
  raise exception 'Expected denial';
end $$;
insert into auth.users(id,email) values
('a6100000-0000-4000-8000-000000000001','ai-company@example.test'),
('a6100000-0000-4000-8000-000000000002','ai-manager@example.test'),
('a6100000-0000-4000-8000-000000000003','ai-owner@example.test'),
('a6100000-0000-4000-8000-000000000004','ai-other@example.test');
insert into public.teams(id,name) values ('a6100000-0000-4000-8000-000000000010','AI isolated team');
insert into public.profiles(id,email,full_name,role,team_id)
select id,email,'AI test',case right(id::text,1) when '1' then 'company_admin'::public.app_role when '2' then 'team_admin'::public.app_role else 'employee'::public.app_role end,
case when right(id::text,1) in ('3','4') then 'a6100000-0000-4000-8000-000000000010'::uuid else null end
from auth.users where id::text like 'a6100000-%';
select set_config('request.jwt.claim.sub','a6100000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"a6100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.journal_preferences('Europe/Madrid');
select public.journal_save('a6200000-0000-4000-8000-000000000001','{"mood":"low","emotion":"anxiety","intensity":4,"occurred_at":"2026-10-13T10:00:00Z"}',true);
reset role;
delete from journal_private.activity_days where user_id='a6100000-0000-4000-8000-000000000003';
delete from journal_private.rewards where user_id='a6100000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.assert_true(public.ai_reserve('a6200000-0000-4000-8000-000000000001')->>'allowed'='true','owner reserves');
select pg_temp.assert_true(public.ai_reserve('a6200000-0000-4000-8000-000000000001')->>'reason'='busy','active lease blocks duplicates');
select public.ai_release('ffffffff-ffff-4fff-8fff-ffffffffffff');
select pg_temp.assert_true(public.ai_reserve('a6200000-0000-4000-8000-000000000001')->>'reason'='busy','forged release cannot clear lease');
select pg_temp.assert_true(public.journal_progress()->>'active_days'='0','request/view is not activity');
select pg_temp.assert_true(public.wellbeing_complete('pause'),'voluntary activity completes');
select pg_temp.assert_true(not public.wellbeing_complete('pause'),'same activity is idempotent');
select pg_temp.assert_true(public.wellbeing_complete('planning'),'another voluntary activity');
select pg_temp.assert_true((public.journal_progress()->>'active_days')::integer=(extract(isodow from (public.journal_progress()->>'today')::date)<=5)::integer,'one meaningful weekday only');
select pg_temp.assert_true(public.journal_progress()->>'current'='1','completion starts streak');
select pg_temp.assert_true(jsonb_array_length(public.journal_progress()->'rewards')=1,'completion awards recognition');
select pg_temp.expect_error($q$select public.wellbeing_complete('invented')$q$,'22023');
select pg_temp.expect_error($q$select public.wellbeing_complete(null)$q$,'22023');
select pg_temp.expect_error($q$select public.ai_reserve(null)$q$);
select pg_temp.expect_error($q$select * from journal_private.ai_usage$q$);
select pg_temp.expect_error($q$select * from journal_private.wellbeing_completions$q$);

reset role;
-- Test-only clock fixtures, never accessible through RPCs.
update journal_private.ai_usage set lease_until=clock_timestamp()-interval '1 second' where user_id='a6100000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.assert_true(public.ai_reserve('a6200000-0000-4000-8000-000000000001')->>'reason'='limit','cooldown survives expired lease');
reset role;
update journal_private.ai_usage set requests=array[clock_timestamp()-interval '2 minutes',clock_timestamp()-interval '4 minutes',clock_timestamp()-interval '6 minutes'] where user_id='a6100000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.assert_true(public.ai_reserve('a6200000-0000-4000-8000-000000000001')->>'reason'='limit','rolling hourly cap');
reset role;
update journal_private.ai_usage set requests=(select array_agg(clock_timestamp()-n*interval '2 hours') from generate_series(1,10) n) where user_id='a6100000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.assert_true(public.ai_reserve('a6200000-0000-4000-8000-000000000001')->>'reason'='limit','rolling daily cap');
reset role;
update journal_private.ai_usage set requests=array[clock_timestamp()-interval '25 hours'] where user_id='a6100000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.assert_true(public.ai_reserve('a6200000-0000-4000-8000-000000000001')->>'allowed'='true','expired window recovers');
reset role;
select pg_temp.assert_true((select cardinality(requests)=1 from journal_private.ai_usage where user_id='a6100000-0000-4000-8000-000000000003'),'old timestamps pruned');
select pg_temp.assert_true(not exists(select 1 from information_schema.columns where table_schema='journal_private' and table_name='ai_usage' and column_name in ('prompt','response','reflection')),'no emotional content in quota store');
do $$ declare u uuid; begin
  foreach u in array array['a6100000-0000-4000-8000-000000000001'::uuid,'a6100000-0000-4000-8000-000000000002'::uuid,'a6100000-0000-4000-8000-000000000004'::uuid] loop
    perform set_config('request.jwt.claim.sub',u::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
    set local role authenticated;
    perform pg_temp.expect_error($q$select public.ai_reserve('a6200000-0000-4000-8000-000000000001')$q$);
    perform pg_temp.expect_error($q$select * from journal_private.ai_usage$q$);
    perform pg_temp.expect_error($q$select * from journal_private.wellbeing_completions$q$);
    perform pg_temp.assert_true(public.journal_progress()->>'active_days'='0','other roles cannot see personal activity');
    perform pg_temp.assert_true(public.wellbeing_complete('screen'),'all roles may complete own activity');
    perform pg_temp.assert_true((public.journal_progress()->>'active_days')::integer=(extract(isodow from (public.journal_progress()->>'today')::date)<=5)::integer,'own weekday activity only');
    reset role;
  end loop;
end $$;
update public.profiles set active=false where id='a6100000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','a6100000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"a6100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.ai_reserve('a6200000-0000-4000-8000-000000000001')$q$);
select pg_temp.expect_error($q$select public.wellbeing_complete('pause')$q$);
reset role;
set local role anon;
select pg_temp.expect_error($q$select public.ai_reserve('a6200000-0000-4000-8000-000000000001')$q$);
select pg_temp.expect_error($q$select public.wellbeing_complete('pause')$q$);
rollback;
