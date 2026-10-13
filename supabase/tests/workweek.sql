-- Deterministic Friday/weekend/Monday and DST cases, without changing the clock.
begin;
create or replace function pg_temp.assert_true(ok boolean, description text) returns void
language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %', description; end if; end $$;
insert into auth.users(id,email) values ('b7100000-0000-4000-8000-000000000001','workweek-owner@example.test');
insert into public.teams(id,name) values ('b7100000-0000-4000-8000-000000000010','Workweek isolated team');
insert into public.profiles(id,email,full_name,role,team_id)
values ('b7100000-0000-4000-8000-000000000001','workweek-owner@example.test','Workweek test','employee','b7100000-0000-4000-8000-000000000010');
select set_config('request.jwt.claim.sub','b7100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"b7100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into journal_private.activity_days(user_id,day,timezone,kind)
select 'b7100000-0000-4000-8000-000000000001',d,'Europe/Madrid','entry_created'
from unnest(array[date '2026-03-26',date '2026-03-27']) d;
set local role emotion_journal_executor;
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-03-28')->>'current'='2','Saturday preserves Friday streak');
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-03-29')->>'current'='2','Sunday DST preserves Friday streak');
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-03-30')->>'current'='2','Monday can continue Friday streak');
reset role;
insert into journal_private.activity_days(user_id,day,timezone,kind)
select 'b7100000-0000-4000-8000-000000000001',d,'Europe/Madrid','entry_created'
from unnest(array[date '2026-03-28',date '2026-03-29',date '2026-03-30',date '2026-04-02']) d;
set local role emotion_journal_executor;
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-03-29')->>'current'='2','optional weekend use does not inflate streak or count future actions');
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-03-30')->>'current'='3','Friday to Monday are consecutive despite DST');
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-03-30')->>'active_days'='3','weekend days excluded from activity total');
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-03-31')->>'current'='3','Tuesday grace until a weekday is missed');
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-04-01')->>'current'='0','missed Tuesday expires streak');
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-04-02')->>'current'='1','missing weekdays split sequences');
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-04-02')->>'best'='3','best uses weekdays only');
reset role;
delete from journal_private.activity_days where user_id='b7100000-0000-4000-8000-000000000001';
insert into journal_private.activity_days(user_id,day,timezone,kind)
select 'b7100000-0000-4000-8000-000000000001',d,'Europe/Madrid','entry_created'
from unnest(array[date '2025-12-31',date '2026-01-01',date '2026-01-02',date '2026-01-05']) d;
set local role emotion_journal_executor;
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-01-05')->>'current'='4','year boundary and weekend remain consecutive');
reset role;
delete from journal_private.activity_days where user_id='b7100000-0000-4000-8000-000000000001';
insert into journal_private.activity_days(user_id,day,timezone,kind)
select 'b7100000-0000-4000-8000-000000000001',d,'Europe/Madrid','entry_created'
from unnest(array[date '2026-10-23',date '2026-10-26']) d;
set local role emotion_journal_executor;
select pg_temp.assert_true(app_private.journal_workday_streaks('2026-10-26')->>'current'='2','fall DST weekend is optional');
reset role;
-- Emotional metrics keep actual optional weekend entries, never fill empty days.
insert into journal_private.entries(id,user_id,mood,emotion,intensity,occurred_at)
values ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-000000000001','good','calm',2,'2026-03-27T12:00:00Z');
set local role authenticated;
select public.journal_preferences('Europe/Madrid');
select pg_temp.assert_true(public.journal_statistics('2026-03-27','2026-03-29')->'current'->>'mood_average'='4.00','empty weekend never lowers mood average');
select pg_temp.assert_true(public.journal_statistics('2026-03-27','2026-03-29')->'current'->>'recorded_days'='1','empty weekends are not recorded days');
reset role;
insert into journal_private.entries(id,user_id,mood,emotion,intensity,occurred_at)
values ('b7200000-0000-4000-8000-000000000002','b7100000-0000-4000-8000-000000000001','very-good','joy',4,'2026-03-28T12:00:00Z');
set local role authenticated;
select pg_temp.assert_true(public.journal_statistics('2026-03-27','2026-03-29')->'current'->>'entries'='2','optional Saturday entry remains in statistics');
select pg_temp.assert_true(public.journal_statistics('2026-03-27','2026-03-29')->'current'->>'mood_average'='4.50','only recorded days contribute to averages');
do $$ begin
  begin perform app_private.journal_workday_streaks('2026-03-30');
    raise exception 'internal streak calculator unexpectedly callable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: weekday streaks, optional weekends, missing weekdays, year boundaries, DST and real weekend statistics' as result;
rollback;
