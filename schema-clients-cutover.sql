-- =========================================================
-- Yard Stock — access cutover
-- ---------------------------------------------------------
-- RUN THIS LAST, and only once ALL of the following are true:
--
--   1. schema.sql has been re-run (clients, profiles, client_id exist).
--   2. A staff account exists in Supabase Auth and has a profiles row
--      with role = 'staff'.  See "Creating the staff login" below.
--   3. You have signed into the app on one device with that account
--      and confirmed the stock still loads.
--
-- Until this file is run, the shop floor keeps working on the public
-- anon key exactly as it always has, and any client restriction is
-- cosmetic. After it is run, the anon key can do nothing at all: every
-- device must be signed in, staff included.
--
-- To undo it, re-run schema.sql — its stage-1 policies are permissive
-- and will replace the ones created here.
-- =========================================================

-- ---------------------------------------------------------
-- Creating the staff login (do this BEFORE the policies below)
-- ---------------------------------------------------------
-- Nobody signs in with an email address. The app asks for a company, a
-- username and a password, and builds an address out of sight in the form
--
--     <username>.<client-uuid-or-staff>@<LOGIN_DOMAIN>
--
-- where LOGIN_DOMAIN comes from config.js and defaults to
-- clients.yardstock.app. No mail is ever sent to it.
--
-- So for a staff login with the username "factory", create the user with
-- exactly this address:
--
--     factory.staff@clients.yardstock.app
--
-- In the Supabase dashboard: Authentication → Users → Add user. Paste that
-- address, set a password, and tick "Auto Confirm User". Then copy the new
-- user's UUID and run:
--
--   insert into public.profiles (id, role, username, label)
--   values ('PASTE-THE-UUID-HERE', 'staff', 'factory', 'Factory floor')
--   on conflict (id) do update set role = 'staff', username = 'factory';
--
-- Your team then signs in by picking "(staff)" from the company list and
-- entering factory + that password.
--
-- Also turn OFF Authentication → Providers → Email → "Confirm email", so
-- client logins created from the app's Settings screen work immediately
-- rather than waiting on a confirmation mail that will never arrive.

-- ---------------------------------------------------------
-- Products: staff see everything, a client sees only their own rows,
-- and only for reading. Nobody unauthenticated sees anything.
-- ---------------------------------------------------------
drop policy if exists products_all    on public.products;
drop policy if exists products_staff  on public.products;
drop policy if exists products_client on public.products;

create policy products_staff on public.products for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy products_client on public.products for select to authenticated
  using (client_id is not null and client_id = public.my_client_id());

-- ---------------------------------------------------------
-- Everything else is staff-only. A client has no business reading the
-- team list, the movement log, the reorder board or other clients.
-- ---------------------------------------------------------
drop policy if exists people_all         on public.people;
drop policy if exists movements_all      on public.movements;
drop policy if exists reorder_cards_all  on public.reorder_cards;
drop policy if exists clients_all        on public.clients;
drop policy if exists profiles_all       on public.profiles;

create policy people_staff        on public.people        for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy movements_staff     on public.movements     for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy reorder_cards_staff on public.reorder_cards for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy clients_staff       on public.clients       for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- A client may read the one clients row that is theirs, so the app can
-- show them their own name, and their own profile row so it knows which
-- client they are.
create policy clients_own  on public.clients  for select to authenticated
  using (id = public.my_client_id());
create policy profiles_own on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_staff on public.profiles for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- The sign-in screen's company picker reads this view before anyone has a
-- session, so it must stay readable by anon. It exposes client names and
-- nothing else. If you would rather your customer list were not public,
-- revoke it and have clients type their company name instead.
grant select on public.client_directory to anon, authenticated;

-- ---------------------------------------------------------
-- Take the anon key's access away. This is the line that makes the
-- client restriction real rather than decorative.
-- ---------------------------------------------------------
revoke all on public.people, public.products, public.movements,
              public.reorder_cards, public.clients, public.profiles from anon;
revoke execute on function public.apply_movement(uuid, numeric, text, text, text) from anon;

-- Photos stay world-readable: the URLs are unguessable and the app shows
-- them in <img> tags, which cannot send an Authorization header. Writing
-- them still requires a signed-in user.
drop policy if exists photos_write  on storage.objects;
drop policy if exists photos_update on storage.objects;
create policy photos_write  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos');
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'product-photos') with check (bucket_id = 'product-photos');
