-- Runs against Supabase with `supabase db query --linked --file supabase/tests/journal.sql`.
-- All fixtures and changes are rolled back. Also runs in PGlite (real PostgreSQL).
begin;
create function pg_temp.assert_true(ok boolean, description text) returns void
language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %', description; end if; end $$;
create function pg_temp.expect_error(statement text, expected text default '42501') returns void
language plpgsql as $$ begin
  begin execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise exception 'Unexpected SQLSTATE %, wanted %: %', sqlstate, expected, sqlerrm;
  end;
  raise exception 'Expected denial: %', statement;
end $$;
insert into auth.users(id,email) values
('f3100000-0000-4000-8000-000000000001','phase3-company@example.test'),
('f3100000-0000-4000-8000-000000000002','phase3-manager@example.test'),
('f3100000-0000-4000-8000-000000000003','phase3-a@example.test'),
('f3100000-0000-4000-8000-000000000004','phase3-b@example.test'),
('f3100000-0000-4000-8000-000000000005','phase3-inactive@example.test'),
('f3100000-0000-4000-8000-000000000006','phase3-orphan@example.test');
insert into public.teams(id,name) values ('f3100000-0000-4000-8000-000000000010','Phase 3 isolated test team');
insert into public.profiles(id,email,full_name,role,team_id,active)
select id,email,'Phase 3 Test',
  case right(id::text,1) when '1' then 'company_admin'::public.app_role when '2' then 'team_admin'::public.app_role else 'employee'::public.app_role end,
  case when right(id::text,1) in ('1','2') then null else 'f3100000-0000-4000-8000-000000000010'::uuid end,
  right(id::text,1) <> '5'
from auth.users where id::text like 'f3100000-%' and right(id::text,1) <> '6';
insert into public.team_managers(team_id,profile_id) values ('f3100000-0000-4000-8000-000000000010','f3100000-0000-4000-8000-000000000002');

select set_config('request.jwt.claim.sub','f3100000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"f3100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.journal_save('f3200000-0000-4000-8000-000000000001',
'{"mood":"good","emotion":"joy","intensity":4,"reflection":"Private test","category":"work","reason":"achievement","custom_reason":"","activity":"Walk","reaction":"Smile","support":"Yes","occurred_at":"2026-03-28T23:30:00Z"}',true);
select public.journal_save('f3200000-0000-4000-8000-000000000002',
'{"mood":"neutral","emotion":"peace","intensity":2,"category":"health","reason":"sleep","occurred_at":"2026-03-29T21:30:00Z"}',true);
select pg_temp.assert_true((public.journal_list('{"timezone":"Europe/Madrid","from":"2026-03-29","to":"2026-03-29"}')->>'total')::int = 2,'multiple entries on one local DST day');
select pg_temp.assert_true((public.journal_list('{"timezone":"UTC","from":"2026-03-29","to":"2026-03-29"}')->>'total')::int = 1,'UTC day boundary');
select pg_temp.assert_true(public.journal_days('{"timezone":"Europe/Madrid","from":"2026-03-01","to":"2026-03-31"}') @> '[{"day":"2026-03-29","count":2,"mood":"neutral","emotion":"peace"}]'::jsonb,'calendar counts every entry and shows latest mood');
select pg_temp.assert_true((public.journal_list('{"timezone":"UTC","emotion":"joy","intensity":4,"category":"work"}')->>'total')::int = 1,'combined database filters');
select pg_temp.assert_true(public.journal_get('f3200000-0000-4000-8000-000000000001')->>'activity' = 'Walk','read every optional field');
select pg_temp.assert_true(not (public.journal_get('f3200000-0000-4000-8000-000000000001') ? 'user_id'),'API does not serialize owner identifiers');
select public.journal_save('f3200000-0000-4000-8000-000000000001',
'{"mood":"good","emotion":"calm","intensity":3,"reflection":"Updated","occurred_at":"2026-03-28T23:30:00Z"}',false);
select pg_temp.assert_true(public.journal_get('f3200000-0000-4000-8000-000000000001')->>'reflection' = 'Updated','update persists');
select public.journal_save('f3200000-0000-4000-8000-000000000001',
'{"mood":"good","emotion":"joy","intensity":3,"occurred_at":"2026-03-28T23:30:00Z"}',true);
select pg_temp.assert_true(public.journal_get('f3200000-0000-4000-8000-000000000001')->>'reflection' = 'Updated','create retry is idempotent and cannot overwrite');
select pg_temp.expect_error($q$select public.journal_save('f3200000-0000-4000-8000-000000000003','{"mood":"good","emotion":"joy","intensity":3,"occurred_at":"2026-03-29T00:00:00Z","user_id":"f3100000-0000-4000-8000-000000000004"}',true)$q$,'22023');
select pg_temp.expect_error($q$select public.journal_save('f3200000-0000-4000-8000-000000000003','{"mood":"good","emotion":"joy","intensity":6,"occurred_at":"2026-03-29T00:00:00Z"}',true)$q$,'23514');
select pg_temp.expect_error($q$select public.journal_save('f3200000-0000-4000-8000-000000000003','{"mood":"good","emotion":"joy","intensity":3,"category":"work","reason":"sleep","occurred_at":"2026-03-29T00:00:00Z"}',true)$q$,'23503');
select pg_temp.expect_error($q$select public.journal_days('{"timezone":"UTC","from":"2026-01-01","to":"2026-12-31"}')$q$,'22023');
select pg_temp.expect_error($q$select public.journal_list('{"timezone":"UTC","page":0}')$q$,'22023');

-- Enough records to prove real offset/limit, stable ordering and last-page behavior.
select public.journal_save(('f3300000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
jsonb_build_object('mood','good','emotion','joy','intensity',3,'occurred_at','2026-04-01T12:00:00Z'),true) from generate_series(1,25) n;
select pg_temp.assert_true(jsonb_array_length(public.journal_list('{"timezone":"UTC","from":"2026-04-01","page":1,"order":"asc"}')->'entries')=12,'first page limit');
select pg_temp.assert_true(public.journal_list('{"timezone":"UTC","from":"2026-04-01","page":2,"order":"asc"}')->'entries'->0->>'id'='f3300000-0000-4000-8000-000000000013','second page offset with tied timestamps');
select pg_temp.assert_true(jsonb_array_length(public.journal_list('{"timezone":"UTC","from":"2026-04-01","page":3}')->'entries')=1,'last page');
select pg_temp.assert_true(jsonb_array_length(public.journal_list('{"timezone":"UTC","from":"2026-04-01","page":4}')->'entries')=0,'out of range page');
select pg_temp.assert_true(public.journal_list('{"timezone":"UTC","from":"2026-04-01","order":"desc"}')->'entries'->0->>'id'='f3300000-0000-4000-8000-000000000025','reverse order');

-- Both administrators actually manage/see the employee in the directory, but
-- have exactly the same private journal restrictions as another employee.
reset role;
do $$ declare actor uuid; n integer; begin
  foreach actor in array array['f3100000-0000-4000-8000-000000000001'::uuid,'f3100000-0000-4000-8000-000000000002'::uuid,'f3100000-0000-4000-8000-000000000004'::uuid] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    set local role authenticated;
    perform pg_temp.assert_true(public.journal_get('f3200000-0000-4000-8000-000000000001') is null,'foreign detail hidden');
    perform pg_temp.assert_true((public.journal_list('{"timezone":"UTC"}')->>'total')::int=0,'foreign list hidden');
    perform pg_temp.assert_true(public.journal_days('{"timezone":"UTC","from":"2026-03-01","to":"2026-03-31"}')='[]'::jsonb,'calendar does not leak employee presence');
    perform pg_temp.expect_error($q$select public.journal_save('f3200000-0000-4000-8000-000000000001','{"mood":"low","emotion":"sadness","intensity":1,"occurred_at":"2026-04-01T00:00:00Z"}',false)$q$);
    perform pg_temp.expect_error($q$select public.journal_save('f3200000-0000-4000-8000-000000000001','{"mood":"low","emotion":"sadness","intensity":1,"occurred_at":"2026-04-01T00:00:00Z"}',true)$q$);
    perform pg_temp.expect_error($q$select public.journal_delete(array['f3200000-0000-4000-8000-000000000001'::uuid])$q$);
    perform pg_temp.expect_error('select * from journal_private.entries');
    perform pg_temp.assert_true(not pg_has_role('authenticated','emotion_journal_executor','MEMBER'),'application role cannot assume executor');
    if right(actor::text,1) in ('1','2') then
      select count(*) into n from public.profiles where id='f3100000-0000-4000-8000-000000000003';
      perform pg_temp.assert_true(n=1,'administrator directory access confirmed');
    end if;
    perform public.journal_save(actor,jsonb_build_object('mood','good','emotion','joy','intensity',3,'occurred_at','2026-04-02T12:00:00Z'),true);
    perform pg_temp.assert_true(public.journal_get(actor) is not null,'every role can use its own diary');
    -- All-or-nothing deletion must roll back even the owned entry when mixed.
    perform pg_temp.expect_error(format('select public.journal_delete(array[%L::uuid,%L::uuid])',actor,'f3200000-0000-4000-8000-000000000001'));
    perform pg_temp.assert_true(public.journal_get(actor) is not null,'mixed batch rolled back');
    perform public.journal_delete(array[actor]);
    reset role;
  end loop;
end $$;
-- RLS is effective inside the bridge: its owner has no BYPASSRLS and is not
-- table owner. Even a direct SQL connection as that role cannot see other owners.
select set_config('request.jwt.claim.sub','f3100000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"f3100000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role emotion_journal_executor;
select pg_temp.assert_true((select count(*)=0 from journal_private.entries),'database RLS, independently of RPC predicates');
reset role;
select pg_temp.assert_true((select not rolbypassrls and not rolcanlogin from pg_roles where rolname='emotion_journal_executor'),'restricted executor');
select pg_temp.assert_true((select count(*)=0 from pg_views where schemaname in ('public','reporting') and definition like '%journal_private%'),'no indirect views');
set local role service_role;
select pg_temp.expect_error('select * from journal_private.entries');
select pg_temp.expect_error($q$select public.journal_list('{"timezone":"UTC"}')$q$);
reset role;
do $$ declare actor uuid; begin
  foreach actor in array array['f3100000-0000-4000-8000-000000000005'::uuid,'f3100000-0000-4000-8000-000000000006'::uuid] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    set local role authenticated;
    perform pg_temp.assert_true((public.journal_list('{"timezone":"UTC"}')->>'total')::int=0,'inactive and orphan read denied');
    perform pg_temp.expect_error(format('select public.journal_save(%L::uuid,%L::jsonb,true)',actor,'{"mood":"good","emotion":"joy","intensity":3,"occurred_at":"2026-04-02T12:00:00Z"}'));
    reset role;
  end loop;
end $$;
-- Revocation of an existing session takes effect immediately.
update public.profiles set active=false where id='f3100000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','f3100000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"f3100000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_true(public.journal_get('f3200000-0000-4000-8000-000000000001') is null,'deactivated owner loses read');
select pg_temp.expect_error($q$select public.journal_delete(array['f3200000-0000-4000-8000-000000000001'::uuid])$q$);
reset role;
update public.profiles set active=true where id='f3100000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.assert_true(public.journal_delete(array['f3200000-0000-4000-8000-000000000001'::uuid,'f3200000-0000-4000-8000-000000000002'::uuid])=2,'bulk deletion');
select pg_temp.assert_true(public.journal_get('f3200000-0000-4000-8000-000000000001') is null,'deleted detail unavailable');
reset role;
set local role anon;
select pg_temp.expect_error($q$select public.journal_list('{"timezone":"UTC"}')$q$);
select pg_temp.expect_error($q$select app_private.journal_list('{"timezone":"UTC"}')$q$);
select pg_temp.expect_error('select * from journal_private.entries');
reset role;
select 'PASS: journal CRUD, RLS, administrator isolation, filters, pagination and timezones' as result;
rollback;
