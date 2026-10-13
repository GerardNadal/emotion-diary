-- Supabase may install an event-trigger helper in public. It is infrastructure,
-- not an application endpoint; leave the event trigger itself in place.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role;
  end if;
end $$;
notify pgrst, 'reload schema';
