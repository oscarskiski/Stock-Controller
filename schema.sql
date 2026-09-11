-- =========================================================
-- Yard Stock — Supabase schema
-- Paste the whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- People who can book stock (no passwords — they tap a name)
-- ---------------------------------------------------------
create table if not exists public.people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Products / stock items
-- location is the yard "GPS", e.g. 'A3.1.1'
--   = rack A, bay 3, level 1, position 1
-- ---------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text,
  category    text not null default 'Parts',
  location    text,
  unit        text not null default 'ea',
  qty         numeric not null default 0,
  min_qty     numeric not null default 0,
  notes       text,
  photo_url   text,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists products_name_idx     on public.products (lower(name));
create index if not exists products_location_idx on public.products (location);
create index if not exists products_archived_idx on public.products (archived);

-- ---------------------------------------------------------
-- Catalogue detail — added for the full "Items" management screen.
-- All additive (add column if not exists), so re-running this file
-- on a project that already has data is safe and keeps everything.
-- SKU and description reuse the existing `code` / `notes` columns.
-- ---------------------------------------------------------
alter table public.products add column if not exists group_name      text;
alter table public.products add column if not exists bulk_location   text;
alter table public.products add column if not exists place_of_use    text;
alter table public.products add column if not exists cost            text;
alter table public.products add column if not exists pref_supplier   text;
alter table public.products add column if not exists pref_moq        text;
alter table public.products add column if not exists pref_lead_time  text;
alter table public.products add column if not exists pref_price      text;
alter table public.products add column if not exists sec_supplier    text;
alter table public.products add column if not exists sec_moq         text;
alter table public.products add column if not exists sec_lead_time   text;
alter table public.products add column if not exists sec_price       text;
alter table public.products add column if not exists pack_size       text;
alter table public.products add column if not exists pack_weight     text;
alter table public.products add column if not exists dormant         boolean not null default false;

-- ---------------------------------------------------------
-- Reorder board — a Kanban-style signal card per item that needs
-- ordering. Cards move to_order -> ordered -> received; at most one
-- OPEN (non-received) card per product, enforced below, so tapping
-- "Order" twice can't create duplicate cards for the same item.
-- ---------------------------------------------------------
create table if not exists public.reorder_cards (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  status       text not null default 'to_order',  -- 'to_order' | 'ordered' | 'received'
  qty          numeric not null default 0,
  supplier     text,
  note         text,
  created_at   timestamptz not null default now(),
  created_by   text,
  ordered_at   timestamptz,
  ordered_by   text,
  received_at  timestamptz,
  received_by  text
);

create index if not exists reorder_cards_status_idx  on public.reorder_cards (status);
create index if not exists reorder_cards_product_idx on public.reorder_cards (product_id);
create unique index if not exists reorder_cards_open_unique
  on public.reorder_cards (product_id) where status <> 'received';

alter table public.reorder_cards enable row level security;
drop policy if exists reorder_cards_all on public.reorder_cards;
create policy reorder_cards_all on public.reorder_cards for all to anon, authenticated using (true) with check (true);
grant all on public.reorder_cards to anon, authenticated;

-- ---------------------------------------------------------
-- Every book-in / book-out / stock-take, forever
-- ---------------------------------------------------------
create table if not exists public.movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  delta       numeric not null,          -- +in, -out
  qty_after   numeric not null,
  reason      text not null default 'out',  -- 'in' | 'out' | 'set'
  person      text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists movements_created_idx on public.movements (created_at desc);
create index if not exists movements_product_idx on public.movements (product_id, created_at desc);

-- ---------------------------------------------------------
-- One atomic call: adjust the count AND write the log line.
-- Row is locked for the update, so two phones booking the
-- same item at the same moment cannot lose a movement.
-- ---------------------------------------------------------
create or replace function public.apply_movement(
  p_product uuid,
  p_delta   numeric,
  p_reason  text,
  p_person  text,
  p_note    text
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.products;
begin
  update public.products
     set qty = qty + p_delta,
         updated_at = now()
   where id = p_product
  returning * into r;

  if not found then
    raise exception 'Product % not found', p_product;
  end if;

  if r.qty < 0 then
    raise exception 'That would put the count below zero (currently %)', r.qty - p_delta;
  end if;

  insert into public.movements (product_id, delta, qty_after, reason, person, note)
  values (p_product, p_delta, r.qty, coalesce(p_reason, 'out'), nullif(p_person, ''), nullif(p_note, ''));

  return r;
end;
$$;

-- ---------------------------------------------------------
-- Access
-- ---------------------------------------------------------
-- This is an internal shop-floor tool: anyone holding the app
-- URL can read and write. That is deliberate — nobody wants a
-- login while carrying a chair frame. See README → "Locking it
-- down" if you later want that tightened.
alter table public.people    enable row level security;
alter table public.products  enable row level security;
alter table public.movements enable row level security;

drop policy if exists people_all    on public.people;
drop policy if exists products_all  on public.products;
drop policy if exists movements_all on public.movements;

create policy people_all    on public.people    for all to anon, authenticated using (true) with check (true);
create policy products_all  on public.products  for all to anon, authenticated using (true) with check (true);
create policy movements_all on public.movements for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant all on public.people, public.products, public.movements to anon, authenticated;
grant execute on function public.apply_movement(uuid, numeric, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------
-- Photo storage
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do update set public = true;

drop policy if exists photos_read   on storage.objects;
drop policy if exists photos_write  on storage.objects;
drop policy if exists photos_update on storage.objects;

create policy photos_read   on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-photos');
create policy photos_write  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'product-photos');
create policy photos_update on storage.objects for update to anon, authenticated
  using (bucket_id = 'product-photos') with check (bucket_id = 'product-photos');

-- ---------------------------------------------------------
-- Clients and accounts
-- ---------------------------------------------------------
-- Some of the stock on the racks belongs to customers rather than
-- to us. Each such item carries a client_id; items with a null
-- client_id are our own. A client signs in and sees only their own
-- rows, enforced below by RLS rather than by the app — the anon key
-- is public, so a UI filter would be decorative.
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table public.products add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists products_client_idx on public.products (client_id);

-- One row per signed-in user, saying what they are allowed to be.
-- 'staff' is the shop floor (one shared factory login per device);
-- 'client' is a customer, tied to exactly one clients row.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'client' check (role in ('staff', 'client')),
  client_id   uuid references public.clients(id) on delete cascade,
  label       text,
  created_at  timestamptz not null default now()
);

-- security definer so the policies below can read profiles without
-- recursing through profiles' own RLS.
create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'staff')
$$;

create or replace function public.my_client_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid() and role = 'client'
$$;

alter table public.clients  enable row level security;
alter table public.profiles enable row level security;

-- Stage 1 keeps the shop floor working on the anon key exactly as before.
-- schema-clients-cutover.sql is what closes that door; run it only once a
-- staff login exists and has been tested.
drop policy if exists clients_all  on public.clients;
drop policy if exists profiles_all on public.profiles;
create policy clients_all  on public.clients  for all to anon, authenticated using (true) with check (true);
create policy profiles_all on public.profiles for all to anon, authenticated using (true) with check (true);

grant all on public.clients, public.profiles to anon, authenticated;
grant execute on function public.is_staff(), public.my_client_id() to anon, authenticated;

-- ---------------------------------------------------------
-- Usernames instead of email addresses
-- ---------------------------------------------------------
-- Nobody on a shop floor wants to hand out email addresses to sign in
-- with, and these accounts never receive mail. Supabase Auth insists on an
-- email, so the app synthesises <username>@LOGIN_DOMAIN (see accountEmail
-- in db.js) and the person never sees it. Usernames are unique across
-- everyone, which is what lets the sign-in screen be two fields rather
-- than three: no company to pick, and no client list to publish.
alter table public.profiles add column if not exists username text;
drop index if exists public.profiles_username_idx;
create unique index if not exists profiles_username_idx on public.profiles (lower(username));

-- An earlier design needed the client names readable by anyone opening the
-- app, to fill a company picker. It does not any more.
drop view if exists public.client_directory;
