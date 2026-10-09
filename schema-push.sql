-- =========================================================
-- Yard Stock — push notifications
-- ---------------------------------------------------------
-- Where a phone's push subscription is kept, and the flag that stops the
-- same warning being sent over and over while stock sits low.
--
-- Additive and safe on a live database: new table, one new column, no
-- existing data touched.
--
-- Run after schema-suppliers.sql and the access cutover.
-- =========================================================

-- ---------------------------------------------------------
-- One row per phone that has agreed to be told
-- ---------------------------------------------------------
-- A browser hands over an endpoint URL and two keys; anyone holding those
-- can push to that phone, so they are nobody's business but the owner's
-- and the sender's. The endpoint is unique: re-subscribing on the same
-- phone must replace the row, not add another, or every warning arrives
-- twice.
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists push_subs_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subs_own   on public.push_subscriptions;
drop policy if exists push_subs_admin on public.push_subscriptions;

-- Your own phones, and nobody else's. Not even staff: a subscription is a
-- key to somebody's lock screen.
create policy push_subs_own on public.push_subscriptions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ---------------------------------------------------------
-- Told once, not every time
-- ---------------------------------------------------------
-- Without this a warning would go out on every booking while stock sat
-- below its reorder point. Set when the warning is sent, cleared when
-- stock climbs back above the line, so the next crossing warns again.
alter table public.products add column if not exists low_alert_sent_at timestamptz;

-- Any booking that lifts an item back above its reorder level clears the
-- flag, so this is armed again for the next time it drops. In the trigger
-- rather than the app: stock moves through apply_movement from several
-- places, and every one of them has to arm it.
create or replace function public.clear_low_alert() returns trigger
  language plpgsql as $$
begin
  if new.min_qty is not null and new.min_qty > 0
     and new.qty > new.min_qty
     and new.low_alert_sent_at is not null then
    new.low_alert_sent_at := null;
  end if;
  return new;
end $$;

drop trigger if exists products_clear_low_alert on public.products;
create trigger products_clear_low_alert
  before update of qty on public.products
  for each row execute function public.clear_low_alert();
