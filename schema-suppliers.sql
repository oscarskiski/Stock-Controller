-- =========================================================
-- Yard Stock — supplier accounts
-- ---------------------------------------------------------
-- A supplier is not a client. A client's stock sits on our racks and
-- belongs to them; a supplier's products are OUR stock, bought from
-- them. Using client_id for a supplier would say City Paint owns the
-- paint, which is wrong and would show on the item form as "whose
-- stock is this".
--
-- So: the clients table grows a kind, products grow a separate
-- supplier_id, and a supplier signs in to watch how fast their lines
-- move and to say what they have sent.
--
-- Everything here is ADDITIVE. It adds columns and tables, changes no
-- existing data, and is safe to run on a live database. It does NOT
-- change who can see what — schema-clients-cutover.sql does that, and
-- must be run before any supplier is given a login.
--
-- Run once, in the Supabase SQL editor.
-- =========================================================

-- ---------------------------------------------------------
-- What kind of outside account this is
-- ---------------------------------------------------------
-- The table is still called clients because that is what it was; it is
-- really "outside accounts". Existing rows are clients, which is what
-- they have always been.
alter table public.clients add column if not exists kind text not null default 'client';
alter table public.clients drop constraint if exists clients_kind_check;
alter table public.clients add constraint clients_kind_check
  check (kind in ('client', 'supplier'));

-- ---------------------------------------------------------
-- Which supplier account may see a product
-- ---------------------------------------------------------
-- Deliberately not products.pref_supplier: that is free text a typo can
-- change, and it must never be a typo that decides who can read a row.
-- Null means no supplier sees it, which is the default for everything.
alter table public.products add column if not exists supplier_id uuid
  references public.clients(id) on delete set null;
create index if not exists products_supplier_idx on public.products (supplier_id);

-- ---------------------------------------------------------
-- The supplier role
-- ---------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'staff', 'client', 'supplier'));

-- Mirrors my_client_id. Separate function and separate column, so a
-- supplier login can never be mistaken for owning anything.
create or replace function public.my_supplier_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid() and role = 'supplier'
$$;

-- ---------------------------------------------------------
-- What the supplier has sent, and when it lands
-- ---------------------------------------------------------
-- Written by the supplier, read by everyone who works here: "20 litres
-- of white went out on Tuesday, with you Friday". Deliberately not a
-- movement — nothing has reached the racks yet, and booking it in early
-- would make the count a lie.
create table if not exists public.supply_orders (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.clients(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  qty          numeric,
  ordered_on   date,
  eta          date,
  note         text,
  status       text not null default 'coming',
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.supply_orders drop constraint if exists supply_orders_status_check;
alter table public.supply_orders add constraint supply_orders_status_check
  check (status in ('coming', 'arrived', 'cancelled'));

create index if not exists supply_orders_supplier_idx on public.supply_orders (supplier_id);
create index if not exists supply_orders_product_idx  on public.supply_orders (product_id);

alter table public.supply_orders enable row level security;

-- Stage 1, matching the rest of schema.sql: the shop floor keeps working
-- on the anon key exactly as before. schema-clients-cutover.sql replaces
-- this with the real rules.
drop policy if exists supply_orders_all on public.supply_orders;
create policy supply_orders_all on public.supply_orders
  for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant all on public.supply_orders to anon, authenticated;
