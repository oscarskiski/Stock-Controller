-- =========================================================
-- Yard Stock — move City Paint from client to supplier
-- ---------------------------------------------------------
-- City Paint was set up as a client, which says the stock on the racks
-- belongs to them. It does not: Varnish, Thinner and Catalyst are OUR
-- stock, bought from them. They get a login so they can watch how fast
-- it moves and send more before it runs out.
--
-- This moves three things:
--   1. the account itself, from client to supplier
--   2. its three products, from client_id (whose stock) to supplier_id
--      (who supplies it)
--   3. the arthur login, from the client role to the supplier role
--
-- Run schema-suppliers.sql FIRST — this needs the kind, supplier_id and
-- supplier role it adds.
--
-- This one changes data, not just structure. Take a backup first
-- (double-click backup.bat). Every statement names City Paint
-- explicitly, so nothing else can be touched.
--
-- Run it once. Running it twice does nothing the second time.
-- =========================================================

-- Have a look before changing anything. Expect: 1 account, 3 products,
-- 1 login. If the numbers differ, stop and find out why.
select
  (select count(*) from public.clients  where name = 'City Paint')                      as accounts,
  (select count(*) from public.products where client_id =
     (select id from public.clients where name = 'City Paint'))                         as products_as_client,
  (select count(*) from public.profiles where client_id =
     (select id from public.clients where name = 'City Paint'))                         as logins;

-- 1. The account is a supplier.
update public.clients
   set kind = 'supplier'
 where name = 'City Paint';

-- 2. Their products are our stock, supplied by them. Moving the link
--    rather than copying it: left on client_id as well, the item form
--    would still say the paint belongs to City Paint.
update public.products
   set supplier_id = client_id,
       client_id   = null,
       updated_at  = now()
 where client_id = (select id from public.clients where name = 'City Paint');

-- 3. The login reads the supplier view, not the client one.
update public.profiles
   set role = 'supplier'
 where role = 'client'
   and client_id = (select id from public.clients where name = 'City Paint');

-- Check it landed. Expect: kind supplier, 3 products on supplier_id,
-- 0 left on client_id, 1 login with role supplier.
select
  (select kind from public.clients where name = 'City Paint')                           as account_kind,
  (select count(*) from public.products where supplier_id =
     (select id from public.clients where name = 'City Paint'))                         as products_as_supplier,
  (select count(*) from public.products where client_id =
     (select id from public.clients where name = 'City Paint'))                         as products_left_as_client,
  (select count(*) from public.profiles where role = 'supplier')                        as supplier_logins;
