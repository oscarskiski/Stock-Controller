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
