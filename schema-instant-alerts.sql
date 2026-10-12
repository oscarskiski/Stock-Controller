-- =========================================================
-- Yard Stock — tell GitHub the moment stock crosses the line
-- ---------------------------------------------------------
-- The hourly job is a clock asking "has anything happened yet". This is
-- the database saying "something just happened" — so a notification goes
-- out in seconds rather than whenever GitHub next feels like running.
--
-- The hourly job stays. It is the safety net: if a poke is ever lost,
-- the next sweep catches it, and the "told once" flag means nothing is
-- sent twice either way.
--
-- Run after schema-push.sql. Then put your GitHub token in, at the
-- bottom of this file.
-- =========================================================

-- pg_net lets Postgres make an HTTP call. It is queued and sent in the
-- background, so a slow or unreachable GitHub cannot hold up a booking.
create extension if not exists pg_net;

-- ---------------------------------------------------------
-- Somewhere private for the token
-- ---------------------------------------------------------
-- No policies are created for this table, which with row-level security on
-- means nobody signing into the app can read it — not staff, not the
-- owner. Only the trigger below, which runs as the table's owner, and
-- anything holding the service role key.
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- ---------------------------------------------------------
-- The poke itself
-- ---------------------------------------------------------
create or replace function public.ping_low_stock_alert() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  tok text;
  url text;
begin
  -- Only an item somebody is watching, with a reorder level set.
  if new.supplier_id is null then return new; end if;
  if new.min_qty is null or new.min_qty <= 0 then return new; end if;
  if new.qty > new.min_qty then return new; end if;
  if new.low_alert_sent_at is not null then return new; end if;

  -- The crossing, not the sitting. Something already low and still waiting
  -- to be sent needs no second poke; booking out another two of it would
  -- otherwise fire again every time.
  if old.qty <= old.min_qty and old.low_alert_sent_at is null then
    return new;
  end if;

  select value into tok from public.app_settings where key = 'github_token';
  select value into url from public.app_settings where key = 'github_dispatch_url';
  -- Not configured yet is not an error: the hourly job still covers it.
  if tok is null or url is null then return new; end if;

  perform net.http_post(
    url := url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || tok,
      'Accept',        'application/vnd.github+json',
      'Content-Type',  'application/json',
      'User-Agent',    'yard-stock'
    ),
    body := jsonb_build_object('event_type', 'low-stock')
  );
  return new;
end $$;

-- After, not before: the row has to be its new self before this looks at
-- it. Only when qty moves — the alert job stamping low_alert_sent_at is an
-- update too, and must not set this off.
drop trigger if exists products_ping_low_stock on public.products;
create trigger products_ping_low_stock
  after update of qty on public.products
  for each row execute function public.ping_low_stock_alert();

-- ---------------------------------------------------------
-- Your token goes here
-- ---------------------------------------------------------
-- Replace PUT_YOUR_TOKEN_HERE below and run this part on its own.
-- Make the token at github.com/settings/personal-access-tokens:
--   Fine-grained, Only select repositories -> Stock-Controller,
--   Repository permissions -> Contents -> Read and write.
--
-- insert into public.app_settings (key, value) values
--   ('github_token', 'PUT_YOUR_TOKEN_HERE'),
--   ('github_dispatch_url', 'https://api.github.com/repos/oscarskiski/Stock-Controller/dispatches')
-- on conflict (key) do update set value = excluded.value, updated_at = now();
