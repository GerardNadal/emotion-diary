-- Real PostgreSQL assertions, run identically in PGlite and linked Supabase.
-- Fixtures are rolled back, including activity and rewards.
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
  raise exception 'Expected denial: %',statement;
end $$;
insert into auth.users(id,email) values
('f4100000-0000-4000-8000-000000000001','phase4-company@example.test'),
('f4100000-0000-4000-8000-000000000002','phase4-manager@example.test'),
('f4100000-0000-4000-8000-000000000003','phase4-owner@example.test'),
('f4100000-0000-4000-8000-000000000004','phase4-other@example.test');
insert into public.teams(id,name) values ('f4100000-0000-4000-8000-000000000010','Phase 4 isolated team');
insert into public.profiles(id,email,full_name,role,team_id)
select id,email,'Evolution test',case right(id::text,1) when '1' then 'company_admin'::public.app_role when '2' then 'team_admin'::public.app_role else 'employee'::public.app_role end,
case when right(id::text,1) in ('3','4') then 'f4100000-0000-4000-8000-000000000010'::uuid else null end
from auth.users where id::text like 'f4100000-%';
insert into public.team_managers(team_id,profile_id) values ('f4100000-0000-4000-8000-000000000010','f4100000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','f4100000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"f4100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_true(public.journal_preferences('Europe/Madrid')='Europe/Madrid','persist timezone');
select pg_temp.assert_true(public.journal_preferences('Asia/Tokyo')='Europe/Madrid','another device does not silently change timezone');
select pg_temp.assert_true(public.journal_progress()->>'current'='0','empty user streak');
select pg_temp.assert_true(public.journal_statistics('2026-03-29','2026-03-31')->'current'->>'entries'='0','empty user metrics');
select pg_temp.assert_true(public.journal_statistics('2026-03-29','2026-03-31')->'current'->'mood_average'='null'::jsonb,'empty is null, not neutral');
select pg_temp.expect_error($q$select public.journal_statistics('2026-01-01','2027-12-31')$q$,'22023');
select pg_temp.expect_error($q$select public.journal_statistics('2026-02-02','2026-02-01')$q$,'22023');
select pg_temp.expect_error($q$select public.journal_preferences('Invalid/Zone')$q$,'22023');
select pg_temp.expect_error($q$select app_private.record_journal_activity('entry_created')$q$);
select public.journal_save('f4200000-0000-4000-8000-000000000001','{"mood":"very-low","emotion":"sadness","intensity":1,"category":"health","reason":"sleep","occurred_at":"2026-03-28T23:30:00Z"}',true);
select public.journal_save('f4200000-0000-4000-8000-000000000002','{"mood":"very-good","emotion":"joy","intensity":5,"category":"work","reason":"achievement","occurred_at":"2026-03-29T21:30:00Z"}',true);
select public.journal_save('f4200000-0000-4000-8000-000000000003','{"mood":"good","emotion":"calm","intensity":4,"occurred_at":"2026-03-30T10:00:00Z"}',true);
select public.journal_save('f4200000-0000-4000-8000-000000000004','{"mood":"neutral","emotion":"peace","intensity":2,"occurred_at":"2026-03-27T10:00:00Z"}',true);
select pg_temp.assert_true(public.journal_statistics('2026-03-29','2026-03-31')->'current'->>'entries'='3','all entries counted on DST day');
select pg_temp.assert_true(public.journal_statistics('2026-03-29','2026-03-31')->'current'->>'recorded_days'='2','distinct days differ from entries');
select pg_temp.assert_true((public.journal_statistics('2026-03-29','2026-03-31')->'current'->>'mood_average')::numeric=3.5,'days weighted equally (3 and 4)');
select pg_temp.assert_true((public.journal_statistics('2026-03-29','2026-03-31')->'current'->>'intensity_average')::numeric=3.5,'intensity independent of mood');
select pg_temp.assert_true(public.journal_statistics('2026-03-29','2026-03-31')->'days'->2->'mood_average'='null'::jsonb,'missing day stays null');
select pg_temp.assert_true(public.journal_statistics('2026-03-29','2026-03-31')->'previous'->>'entries'='1','adjacent equal-duration comparison');
select pg_temp.assert_true(public.journal_statistics('2026-03-29','2026-03-31')->'triggers' @> '[{"reason":"sleep","count":1}]'::jsonb,'trigger frequency');
select pg_temp.assert_true(public.journal_statistics('2026-03-29','2026-03-31')->>'without_trigger'='1','unattributed entries are explicit');
select pg_temp.assert_true(public.journal_days('{"timezone":"Europe/Madrid","from":"2026-03-29","to":"2026-03-29"}')->0->'moods' @> '["very-low","very-good"]'::jsonb,'calendar represents mixed moods');
select pg_temp.assert_true((public.journal_progress()->>'active_days')::integer=(extract(isodow from (public.journal_progress()->>'today')::date)<=5)::integer,'backdated entries count today once on weekdays');
select pg_temp.assert_true(public.journal_progress()->'days' @> jsonb_build_array((clock_timestamp() at time zone 'Europe/Madrid')::date),'activity uses actual action time');
select public.journal_save('f4200000-0000-4000-8000-000000000001','{"mood":"good","emotion":"calm","intensity":2,"occurred_at":"2026-03-29T12:00:00Z"}',false);
select pg_temp.assert_true(public.journal_statistics('2026-03-29','2026-03-31')->'distributions' @> '[{"kind":"emotion","value":"calm","count":2,"present":true}]'::jsonb,'edits reflected immediately');
select public.journal_delete(array['f4200000-0000-4000-8000-000000000002'::uuid]);
select pg_temp.assert_true(public.journal_statistics('2026-03-29','2026-03-31')->'current'->>'entries'='2','deletion updates metrics');
select pg_temp.assert_true((public.journal_progress()->>'active_days')::integer=(extract(isodow from (public.journal_progress()->>'today')::date)<=5)::integer,'deleting entry preserves action performed');
-- Repeated edits do not qualify. Removing today here is a test-only clock fixture.
reset role;
delete from journal_private.activity_days where user_id='f4100000-0000-4000-8000-000000000003';
set local role authenticated;
select public.journal_save('f4200000-0000-4000-8000-000000000001','{"mood":"good","emotion":"calm","intensity":2,"occurred_at":"2026-03-29T12:00:00Z"}',false);
select pg_temp.assert_true(public.journal_progress()->>'active_days'='0','unchanged edits do not qualify');
select public.journal_save('f4200000-0000-4000-8000-000000000001','{"mood":"low","emotion":"sadness","intensity":5,"occurred_at":"2026-03-29T12:00:00Z"}',false);
select pg_temp.assert_true(public.journal_progress()->>'active_days'='0','mood edit is not activity');
select public.journal_save('f4200000-0000-4000-8000-000000000001','{"mood":"good","emotion":"calm","intensity":2,"reflection":"   ","occurred_at":"2026-03-29T12:00:00Z"}',false);
select pg_temp.assert_true(public.journal_progress()->>'active_days'='0','whitespace reflection not completed');
select public.journal_save('f4200000-0000-4000-8000-000000000001','{"mood":"good","emotion":"calm","intensity":2,"reflection":"A personal reflection","occurred_at":"2026-03-29T12:00:00Z"}',false);
select pg_temp.assert_true((public.journal_progress()->>'active_days')::integer=(extract(isodow from (public.journal_progress()->>'today')::date)<=5)::integer,'first reflection completion qualifies on weekdays');
reset role;
delete from journal_private.activity_days where user_id='f4100000-0000-4000-8000-000000000003';
set local role authenticated;
select public.journal_save('f4200000-0000-4000-8000-000000000001','{"mood":"good","emotion":"calm","intensity":2,"reflection":"","occurred_at":"2026-03-29T12:00:00Z"}',false);
select public.journal_save('f4200000-0000-4000-8000-000000000001','{"mood":"good","emotion":"calm","intensity":2,"reflection":"Same reflection again","occurred_at":"2026-03-29T12:00:00Z"}',false);
select pg_temp.assert_true(public.journal_progress()->>'active_days'='0','reflection cannot be farmed by clearing it');

-- Consecutive historical activity fixture spans month/year and both DST changes.
reset role;
insert into journal_private.activity_days(user_id,day,timezone,kind)
select 'f4100000-0000-4000-8000-000000000003',d,'Europe/Madrid','entry_created'
from (select date '2025-12-28'+n as d from generate_series(0,9) n
union select date '2026-03-27'+n from generate_series(0,4) n
union select date '2026-10-23'+n from generate_series(0,4) n) days
where d<(clock_timestamp() at time zone 'Europe/Madrid')::date-40;
insert into journal_private.activity_days(user_id,day,timezone,kind)
select 'f4100000-0000-4000-8000-000000000003',(clock_timestamp() at time zone 'Europe/Madrid')::date-n,'Europe/Madrid','entry_created'
from (select n from generate_series(1,70) n
  where extract(isodow from (clock_timestamp() at time zone 'Europe/Madrid')::date-n)<=5 order by n limit 30) workdays
on conflict do nothing;
set local role authenticated;
select pg_temp.assert_true(public.journal_progress()->>'current'='30','yesterday keeps current streak alive');
select pg_temp.assert_true(public.journal_progress()->>'best'='30','historical best across month boundary');
select public.journal_save('f4200000-0000-4000-8000-000000000005','{"mood":"neutral","emotion":"peace","intensity":1,"occurred_at":"2025-01-01T00:00:00Z"}',true);
select pg_temp.assert_true((public.journal_progress()->>'current')::integer=30+(extract(isodow from (clock_timestamp() at time zone 'Europe/Madrid')::date)<=5)::integer,'weekday extends sequence; weekend stays optional');
select pg_temp.assert_true(jsonb_array_length(public.journal_progress()->'rewards')=4,'1,5,10,30 rewards granted once');
select public.journal_save('f4200000-0000-4000-8000-000000000005','{"mood":"neutral","emotion":"peace","intensity":1,"occurred_at":"2025-01-01T00:00:00Z"}',true);
select pg_temp.assert_true(jsonb_array_length(public.journal_progress()->'rewards')=4,'idempotent create does not duplicate rewards');
reset role;
delete from journal_private.activity_days where user_id='f4100000-0000-4000-8000-000000000003' and day=(
  select max(day) from journal_private.activity_days where user_id='f4100000-0000-4000-8000-000000000003'
    and day<(clock_timestamp() at time zone 'Europe/Madrid')::date and extract(isodow from day)<=5);
set local role authenticated;
select pg_temp.assert_true((public.journal_progress()->>'current')::integer=(extract(isodow from (clock_timestamp() at time zone 'Europe/Madrid')::date)<=5)::integer,'missing weekday breaks the streak even if optional weekends have activity');
select pg_temp.assert_true(public.journal_progress()->>'best'='29','longest historical island retained');
select pg_temp.assert_true(jsonb_array_length(public.journal_progress()->'rewards')=4,'earned recognition persists after a pause');
select pg_temp.assert_true(public.journal_progress('2026-01-01')->'days' @> '["2026-01-01"]'::jsonb,'year/month calendar navigation');
reset role;
delete from journal_private.activity_days where user_id='f4100000-0000-4000-8000-000000000003' and day=(clock_timestamp() at time zone 'Europe/Madrid')::date;
set local role authenticated;
select pg_temp.assert_true(public.journal_progress()->>'current'='0','no today or yesterday means expired streak');

-- Fall DST day has 25h, both occurrences of 02:30 belong to the same day.
select public.journal_save('f4200000-0000-4000-8000-000000000006','{"mood":"low","emotion":"anxiety","intensity":5,"occurred_at":"2026-10-25T00:30:00Z"}',true);
select public.journal_save('f4200000-0000-4000-8000-000000000007','{"mood":"good","emotion":"peace","intensity":1,"occurred_at":"2026-10-25T01:30:00Z"}',true);
select pg_temp.assert_true(public.journal_statistics('2026-10-25','2026-10-25')->'current'->>'entries'='2','autumn DST repeated hour');
select pg_temp.assert_true(public.journal_preferences('UTC',true)='UTC','explicit timezone change');
select pg_temp.assert_true(public.journal_statistics('2026-03-29','2026-03-29')->'current'->>'entries'='1','statistics regroup on zone change');
select pg_temp.assert_true(public.journal_progress()->>'best'='29','zone change does not rewrite activity days');
select pg_temp.assert_true(public.journal_preferences('Europe/Madrid',true)='Europe/Madrid','restore preferred zone');

-- Large history: response bounded by days and distribution, never entry count.
reset role;
insert into journal_private.entries(id,user_id,mood,emotion,intensity,occurred_at)
select ('f4300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f4100000-0000-4000-8000-000000000003','good',
(array['joy','sadness','anger','calm','excitement','loved','celebration','anxiety','peace'])[1+(n%9)],1+(n%5),'2026-02-15T12:00:00Z'
from generate_series(1,10000) n;
set local role authenticated;
select pg_temp.assert_true(public.journal_statistics('2026-02-01','2026-02-28')->'current'->>'entries'='10000','large history exact counts');
select pg_temp.assert_true(jsonb_array_length(public.journal_statistics('2026-02-01','2026-02-28')->'days')=28,'response bounded by calendar dates');
select pg_temp.assert_true((select count(*) from jsonb_array_elements(public.journal_statistics('2026-02-01','2026-02-28')->'distributions') d where d->>'kind'='emotion')=9,'all nine emotions aggregated');
select pg_temp.assert_true(not(public.journal_statistics('2026-02-01','2026-02-28') ? 'entries'),'no raw entry payload');

reset role;
-- Check every exact reward boundary and the day immediately before it.
do $$ declare length integer; expected integer; begin
  foreach length in array array[4,5,9,10,29,30] loop
    delete from journal_private.activity_days where user_id='f4100000-0000-4000-8000-000000000003';
    delete from journal_private.rewards where user_id='f4100000-0000-4000-8000-000000000003';
    insert into journal_private.activity_days(user_id,day,timezone,kind)
    select 'f4100000-0000-4000-8000-000000000003',(clock_timestamp() at time zone 'Europe/Madrid')::date-n,'Europe/Madrid','entry_created'
    from (select n from generate_series(1,length*3) n
      where extract(isodow from (clock_timestamp() at time zone 'Europe/Madrid')::date-n)<=5
      order by n limit length-(extract(isodow from (clock_timestamp() at time zone 'Europe/Madrid')::date)<=5)::integer) workdays;
    set local role emotion_journal_executor;
    perform app_private.record_journal_activity('entry_created');
    reset role;
    set local role authenticated;
    expected:=1+(case when length>=5 then 1 else 0 end)+(case when length>=10 then 1 else 0 end)+(case when length>=30 then 1 else 0 end);
    perform pg_temp.assert_true(jsonb_array_length(public.journal_progress()->'rewards')=expected,format('exact reward boundary %s',length));
    perform pg_temp.assert_true((public.journal_progress()->>'current')::integer=length,'exact consecutive-day count');
    reset role;
    set local role emotion_journal_executor;
    perform app_private.record_journal_activity('entry_created');
    reset role;
    set local role authenticated;
    perform pg_temp.assert_true(jsonb_array_length(public.journal_progress()->'rewards')=expected,'same-day action cannot duplicate a milestone');
    reset role;
  end loop;
end $$;
do $$ declare actor uuid; t text; begin
  foreach actor in array array['f4100000-0000-4000-8000-000000000001'::uuid,'f4100000-0000-4000-8000-000000000002'::uuid,'f4100000-0000-4000-8000-000000000004'::uuid] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    set local role authenticated;
    perform pg_temp.assert_true(public.journal_statistics('2026-01-01','2026-12-31')->'current'->>'entries'='0','other users and both admins see only their own aggregates');
    perform pg_temp.assert_true(public.journal_progress()->>'active_days'='0','other activity is private');
    perform pg_temp.assert_true(public.journal_progress()->'rewards'='[]'::jsonb,'other rewards private');
    perform pg_temp.expect_error($q$select public.journal_statistics('2026-01-01','2026-01-02','f4100000-0000-4000-8000-000000000003')$q$,'42883');
    perform pg_temp.expect_error('select * from journal_private.activity_days');
    reset role;
    set local role emotion_journal_executor;
    foreach t in array array['entries','preferences','activity_days','reflection_completions','rewards'] loop
      execute format('select pg_temp.assert_true(count(*)=0,%L) from journal_private.%I','RLS on '||t,t);
    end loop;
    reset role;
  end loop;
end $$;
select set_config('request.jwt.claim.sub','f4100000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"f4100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
update public.profiles set active=false where id='f4100000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.expect_error($q$select public.journal_statistics('2026-01-01','2026-12-31')$q$);
select pg_temp.expect_error('select public.journal_progress()');
reset role;
set local role anon;
select pg_temp.expect_error('select public.journal_progress()');
select pg_temp.expect_error($q$select public.journal_statistics('2026-01-01','2026-12-31')$q$);
reset role;
set local role service_role;
select pg_temp.expect_error('select public.journal_progress()');
select pg_temp.expect_error('select * from journal_private.activity_days');
reset role;
select 'PASS: evolution aggregates, timezones/DST, activity, rewards, extensive history and all-role privacy' as result;
rollback;
