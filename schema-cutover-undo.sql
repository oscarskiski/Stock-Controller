-- =========================================================
-- Yard Stock — undo the access cutover
-- ---------------------------------------------------------
-- The panic button. If running schema-clients-cutover.sql locks the shop
-- floor out — a login that turns out not to have a profiles row, a role
-- spelled wrong, anything — paste this and everything works again within
-- seconds, exactly as it did before.
--
-- It puts the permissive policies back and hands the anon key its access
-- again. That means the database stops enforcing who sees what, so it is
-- a way to keep working while something is fixed, not a place to stay.
--
-- No data is touched by this file or by the cutover. Only permissions.
-- =========================================================

-- The views the cutover adds for suppliers. Harmless, but they belong to
-- the cutover, so undoing it takes them with it.
drop view if exists public.supplier_stock;
drop view if exists public.supplier_movements;

-- ---------------------------------------------------------
-- Back to one permissive policy per table
-- ---------------------------------------------------------
drop policy if exists products_staff        on public.products;
drop policy if exists products_client       on public.products;
drop policy if exists people_staff          on public.people;
drop policy if exists movements_staff       on public.movements;
drop policy if exists reorder_cards_staff   on public.reorder_cards;
drop policy if exists pick_lists_staff      on public.pick_lists;
drop policy if exists pick_list_items_staff on public.pick_list_items;
drop policy if exists clients_read          on public.clients;
drop policy if exists clients_admin         on public.clients;
drop policy if exists profiles_own          on public.profiles;
drop policy if exists profiles_read         on public.profiles;
drop policy if exists profiles_admin        on public.profiles;
drop policy if exists supply_orders_staff    on public.supply_orders;
drop policy if exists supply_orders_supplier on public.supply_orders;

drop policy if exists products_all      on public.products;
drop policy if exists people_all        on public.people;
drop policy if exists movements_all     on public.movements;
drop policy if exists reorder_cards_all on public.reorder_cards;
drop policy if exists pick_lists_all    on public.pick_lists;
drop policy if exists pick_list_items_all on public.pick_list_items;
drop policy if exists clients_all       on public.clients;
drop policy if exists profiles_all      on public.profiles;
drop policy if exists supply_orders_all on public.supply_orders;

create policy products_all        on public.products        for all to anon, authenticated using (true) with check (true);
create policy people_all          on public.people          for all to anon, authenticated using (true) with check (true);
create policy movements_all       on public.movements       for all to anon, authenticated using (true) with check (true);
create policy reorder_cards_all   on public.reorder_cards   for all to anon, authenticated using (true) with check (true);
create policy pick_lists_all      on public.pick_lists      for all to anon, authenticated using (true) with check (true);
create policy pick_list_items_all on public.pick_list_items for all to anon, authenticated using (true) with check (true);
create policy clients_all         on public.clients         for all to anon, authenticated using (true) with check (true);
create policy profiles_all        on public.profiles        for all to anon, authenticated using (true) with check (true);
create policy supply_orders_all   on public.supply_orders   for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------
-- And give the public key its access back
-- ---------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant all on public.people, public.products, public.movements,
             public.reorder_cards, public.clients, public.profiles,
             public.pick_lists, public.pick_list_items,
             public.supply_orders to anon, authenticated;
grant execute on function public.apply_movement(uuid, numeric, text, text, text) to anon, authenticated;

-- Photos writable without signing in again, as before the cutover.
drop policy if exists photos_write  on storage.objects;
drop policy if exists photos_update on storage.objects;
create policy photos_write  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'product-photos');
create policy photos_update on storage.objects for update to anon, authenticated
  using (bucket_id = 'product-photos') with check (bucket_id = 'product-photos');
