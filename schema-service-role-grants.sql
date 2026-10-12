-- =========================================================
-- Yard Stock — give service_role its access
-- ---------------------------------------------------------
-- schema.sql granted its tables to anon and authenticated, and never to
-- service_role. That went unnoticed for as long as the anon key could
-- read everything: nothing needed service_role, so nothing missed it.
--
-- The access cutover then took anon's rights away, which left the
-- scheduled alert job holding a perfectly good service_role key that is
-- refused by every table — "permission denied" for the one key that is
-- supposed to work everywhere.
--
-- service_role is the key that never reaches a browser. It is meant to
-- see everything; that is its whole purpose, and it is why it must only
-- ever live in a server-side secret.
--
-- Additive. Grants only, no data touched, nothing taken away from anybody.
-- =========================================================

grant usage on schema public to service_role;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Tables added later should not need this run again.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- Check it took. Expect a row per table with has_table_privilege true.
select c.relname as table_name,
       has_table_privilege('service_role', c.oid, 'SELECT') as can_read,
       has_table_privilege('service_role', c.oid, 'UPDATE') as can_write
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'v')
  and c.relname in ('products', 'profiles', 'push_subscriptions', 'supply_orders')
order by c.relname;
