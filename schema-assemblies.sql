-- =========================================================
-- Assembled items: parts lists, and picking lists built from them
-- ---------------------------------------------------------
-- Paste this whole file into the Supabase SQL editor and run it once.
-- It only ADDS tables and columns. Nothing existing is changed or
-- removed, and running it a second time does no harm.
--
-- 1. product_parts   - what an item is made of: "a dining chair takes
--                      1 seat pad, 4 leg glides, 6 bolts ..."
-- 2. pick_list_kits  - an assembled item on a picking list: "12 dining
--                      chairs for order ORD-10452". Its parts are the
--                      ordinary pick_list_items lines, tied back to it.
-- 3. new columns     - each line remembers how many go into one unit
--                      (per_unit) and gets a Received tick; lists get
--                      Picked by / Received by for their single items.
-- =========================================================

create table if not exists public.product_parts (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,  -- the finished item
  part_id     uuid not null references public.products(id) on delete cascade,  -- one of its parts
  qty         numeric not null default 1 check (qty > 0),                      -- how many per finished item
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (product_id, part_id),
  check (product_id <> part_id)
);
create index if not exists product_parts_product_idx on public.product_parts (product_id);

create table if not exists public.pick_list_kits (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.pick_lists(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  qty          numeric not null default 1,      -- how many complete items to make
  order_ref    text,
  client_name  text,
  picked_by    text,
  received_by  text,
  sort         integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists pick_list_kits_list_idx on public.pick_list_kits (list_id);

alter table public.pick_list_items add column if not exists kit_id   uuid references public.pick_list_kits(id) on delete cascade;
alter table public.pick_list_items add column if not exists per_unit numeric;
alter table public.pick_list_items add column if not exists received boolean not null default false;
alter table public.pick_lists      add column if not exists picked_by   text;
alter table public.pick_lists      add column if not exists received_by text;

-- Staff only, the same as the picking lists themselves.
alter table public.product_parts  enable row level security;
alter table public.pick_list_kits enable row level security;

drop policy if exists product_parts_staff  on public.product_parts;
drop policy if exists pick_list_kits_staff on public.pick_list_kits;
create policy product_parts_staff  on public.product_parts  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy pick_list_kits_staff on public.pick_list_kits for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

grant all on public.product_parts, public.pick_list_kits to authenticated;

-- Make the new tables visible to the app straight away.
notify pgrst, 'reload schema';
