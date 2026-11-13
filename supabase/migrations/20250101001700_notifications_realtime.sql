-- Publish public.notifications over Supabase Realtime so the dashboard
-- notification bell updates live on a fresh `supabase db reset`.
-- Guarded: skips when the publication is missing (plain Postgres) or the
-- table is already a member, so re-running is a no-op.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
