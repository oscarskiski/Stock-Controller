-- =========================================================
-- Yard Stock — access cutover
-- ---------------------------------------------------------
-- RUN THIS LAST, and only once ALL of the following are true:
--
--   1. schema.sql has been re-run, so clients, profiles, client_id and
--      the is_staff / is_admin helpers all exist.
--   2. You have opened the app, created the owner account on the first-run
--      setup screen, and signed in with it.
--   3. Your team's logins exist and at least one has been tested.
--
-- Until this file is run, the app asks everyone to sign in but the database
-- does not: the public anon key in config.js can still read every row, so a
-- client querying the API directly would see everything. This file is what
-- makes the restriction real.
--
-- After it runs, the anon key can do nothing at all. Every device must be
-- signed in — yours, your team's and your clients'.
--
-- To undo it, re-run schema.sql: its policies are permissive and replace
-- the ones created here.
--
-- Before running, turn OFF Authentication -> Providers -> Email -> "Confirm
-- email", or accounts created in the app cannot sign in.
-- =========================================================

-- ---------------------------------------------------------
-- Before anything else: refuse to run if it would lock everyone out
-- ---------------------------------------------------------
-- Every policy below hangs off is_staff(). With no profile holding a role
-- it recognises, this file would hand the building its own keys and throw
-- them in the river. First statement in the file, so it stops before a
-- single policy has changed.
do $$
begin
  if not exists (select 1 from public.profiles where role in ('admin', 'staff')) then
    raise exception 'Refusing to run: no admin or staff profile exists, so this would lock everybody out.';
  end if;
end $$;

-- is_staff is defined twice in schema.sql — the earlier one matches 'staff'
-- alone, the later one also matches 'admin'. Which of them a database ended
-- up with depends on how much of schema.sql was last run, and getting the
-- earlier one means every admin loses the stock the instant this file runs.
-- Settle it here rather than hope: create or replace is safe either way.
create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff'))
$$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

grant execute on function public.is_staff(), public.is_admin(),
                         public.my_client_id(), public.my_supplier_id() to authenticated;

-- ---------------------------------------------------------
-- Stock: everyone who works here sees all of it. A client reads the rows
-- allocated to their own company, and only reads them.
-- ---------------------------------------------------------
drop policy if exists products_all    on public.products;
drop policy if exists products_staff  on public.products;
drop policy if exists products_client on public.products;

create policy products_staff on public.products for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy products_client on public.products for select to authenticated
  using (client_id is not null and client_id = public.my_client_id());

-- ---------------------------------------------------------
-- The team list, the movement log and the reorder board are the factory's
-- business. Booking stock in and out is the whole job, so staff get full
-- access to all three.
-- ---------------------------------------------------------
drop policy if exists pick_lists_all      on public.pick_lists;
drop policy if exists pick_list_items_all on public.pick_list_items;
create policy pick_lists_staff      on public.pick_lists      for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy pick_list_items_staff on public.pick_list_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists people_all         on public.people;
drop policy if exists movements_all      on public.movements;
drop policy if exists reorder_cards_all  on public.reorder_cards;
drop policy if exists clients_all        on public.clients;
drop policy if exists profiles_all       on public.profiles;
drop policy if exists clients_read       on public.clients;
drop policy if exists clients_admin      on public.clients;
drop policy if exists clients_own        on public.clients;
drop policy if exists clients_staff      on public.clients;
drop policy if exists profiles_own       on public.profiles;
drop policy if exists profiles_read      on public.profiles;
drop policy if exists profiles_admin     on public.profiles;
drop policy if exists profiles_staff     on public.profiles;

create policy people_staff        on public.people        for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy movements_staff     on public.movements     for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy reorder_cards_staff on public.reorder_cards for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------
-- Clients: staff read the list so an item can show whose stock it is, and a
-- client reads the one row that is their own company. Only the owner adds
-- or removes a client.
-- ---------------------------------------------------------
create policy clients_read  on public.clients for select to authenticated
  using (public.is_staff() or id = public.my_client_id() or id = public.my_supplier_id());
create policy clients_admin on public.clients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------
-- Accounts. This is the line that stops your team handing out logins:
-- creating, changing and deleting a profile is the owner's alone. Everyone
-- may read their own row, which is how the app knows what they are.
-- ---------------------------------------------------------
create policy profiles_own   on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_read  on public.profiles for select to authenticated
  using (public.is_staff());
create policy profiles_admin on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------
-- A supplier watches how fast their own lines move so they know when to
-- send more. They are outside the business, so they get less than a
-- client does — and crucially, less of each ROW.
--
-- Row-level security cannot do that. A policy decides which rows come
-- back, never which columns, so a supplier allowed to read their product
-- rows would read cost, both suppliers and every price with them. Views
-- are the only way to hand over some columns and not others.
--
-- These views are security definer (the default), so they see past the
-- policies above; their WHERE clause is the gate. my_supplier_id()
-- returns null for anyone who is not a supplier, and "= null" matches no
-- row, so to everybody else they are simply empty.
drop view if exists public.supplier_stock;
create view public.supplier_stock as
  select p.id, p.name, p.code, p.unit, p.qty, p.min_qty, p.photo_url,
         p.supplier_id, p.updated_at
  from public.products p
  where p.archived = false
    and p.supplier_id is not null
    and p.supplier_id = public.my_supplier_id();

-- The booking-out log for their lines. No person and no note: who moved
-- it and why is the factory's business, and a note can carry anything.
drop view if exists public.supplier_movements;
create view public.supplier_movements as
  select m.id, m.product_id, p.name as product_name, p.unit,
         m.delta, m.qty_after, m.reason, m.created_at
  from public.movements m
  join public.products p on p.id = m.product_id
  where p.supplier_id is not null
    and p.supplier_id = public.my_supplier_id();

revoke all on public.supplier_stock, public.supplier_movements from anon;
grant select on public.supplier_stock, public.supplier_movements to authenticated;

-- What the supplier says they have sent. Theirs to write and to correct,
-- ours to read — every column on these rows is already their own, so a
-- policy is enough here and no view is needed.
drop policy if exists supply_orders_all      on public.supply_orders;
drop policy if exists supply_orders_staff    on public.supply_orders;
drop policy if exists supply_orders_supplier on public.supply_orders;

create policy supply_orders_staff on public.supply_orders for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy supply_orders_supplier on public.supply_orders for all to authenticated
  using (supplier_id is not null and supplier_id = public.my_supplier_id())
  with check (supplier_id is not null and supplier_id = public.my_supplier_id());

-- ---------------------------------------------------------
-- Take the public key's access away. Everything above is academic until
-- this runs: the anon key is in config.js, served to every visitor.
-- ---------------------------------------------------------
revoke all on public.people, public.products, public.movements,
              public.reorder_cards, public.clients, public.profiles,
              public.pick_lists, public.pick_list_items,
              public.supply_orders from anon;
revoke execute on function public.apply_movement(uuid, numeric, text, text, text) from anon;

-- Photos stay world-readable: they are shown in <img> tags, which cannot
-- send an Authorization header, and the URLs are unguessable. Writing one
-- still requires a signed-in user.
drop policy if exists photos_write  on storage.objects;
drop policy if exists photos_update on storage.objects;
create policy photos_write  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos');
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'product-photos') with check (bucket_id = 'product-photos');

-- ---------------------------------------------------------
-- One thing this does NOT close
-- ---------------------------------------------------------
-- Creating an account uses Supabase's ordinary sign-up endpoint, which the
-- anon key can reach — the admin API needs the service key, and that must
-- never ship inside a web page. So a stranger could still register an
-- account against your project. It buys them nothing: with no profiles row
-- they match no policy above and every table returns empty. To close it
-- anyway, turn off Authentication -> Providers -> Email -> "Allow new users
-- to sign up" once your own accounts exist, and create any later ones from
-- the Supabase dashboard instead of the app.
