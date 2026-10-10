/* =========================================================
   Yard Stock — tell a supplier when one of their lines runs low
   ---------------------------------------------------------
   A web page cannot push to a phone that is closed, so this runs away from
   the app, on a schedule, and does the sending.

   What it does, once per run:
     1. finds products at or below their reorder level that have a supplier
        and have not been warned about already
     2. finds the phones that supplier has subscribed
     3. pushes to each of them
     4. stamps low_alert_sent_at so the same warning is not sent again

   The stamp is only written when a notification actually went somewhere.
   Writing it after sending to nobody would mean an item that went low
   before the supplier ever subscribed stayed silent for good.

   It needs the service role key: it reads across every supplier's rows and
   every subscription, which is exactly what row-level security stops any
   ordinary login doing.
   ========================================================= */

import webpush from 'web-push';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = 'mailto:stock@example.com'
} = process.env;

for (const [name, v] of Object.entries({
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
})) {
  if (!v) {
    console.error(`Missing ${name}. Set it in the repository's Actions secrets.`);
    process.exit(1);
  }
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const DRY_RUN = process.env.DRY_RUN === 'true';

async function rest(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: opts.method || 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : await res.json();
}

/* PostgREST cannot compare two columns, so the qty <= min_qty half is done
   here. The rest narrows it enough that the difference does not matter. */
async function lowStock() {
  const rows = await rest(
    'products?select=id,name,unit,qty,min_qty,supplier_id' +
    '&archived=eq.false&supplier_id=not.is.null&min_qty=gt.0&low_alert_sent_at=is.null'
  );
  return rows.filter(p => Number(p.qty) <= Number(p.min_qty));
}

/* Which phones belong to a supplier account. Two hops: the supplier may
   have more than one login, and each login more than one phone. */
async function phonesFor(supplierId) {
  const profiles = await rest(
    `profiles?select=id&role=eq.supplier&client_id=eq.${supplierId}`
  );
  if (!profiles.length) return [];
  const ids = profiles.map(p => p.id).join(',');
  return await rest(
    `push_subscriptions?select=id,endpoint,p256dh,auth&profile_id=in.(${ids})`
  );
}

async function send(sub, payload) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return true;
  } catch (err) {
    // 404 and 410 mean the browser threw the subscription away — an app
    // deleted, permission revoked, a phone wiped. Keeping it would mean
    // pushing at a dead endpoint for ever.
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.log(`  subscription gone (${err.statusCode}), removing it`);
      await rest(`push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' })
        .catch(e => console.log(`  could not remove: ${e.message}`));
      return false;
    }
    console.log(`  push failed (${err.statusCode || '?'}): ${err.message}`);
    return false;
  }
}

async function main() {
  const low = await lowStock();
  if (!low.length) {
    console.log('Nothing has crossed its reorder level. Nothing to do.');
    return;
  }
  console.log(`${low.length} item(s) at or below their reorder level.`);

  // One lookup per supplier, not per product: several of a supplier's lines
  // commonly run low together.
  const phoneCache = new Map();
  let sentAny = 0;

  for (const p of low) {
    if (!phoneCache.has(p.supplier_id)) {
      phoneCache.set(p.supplier_id, await phonesFor(p.supplier_id));
    }
    const phones = phoneCache.get(p.supplier_id);
    const unit = p.unit || 'ea';
    console.log(`- ${p.name}: ${p.qty}${unit} left, reorder at ${p.min_qty}${unit}, ${phones.length} phone(s)`);

    if (!phones.length) {
      // Deliberately not stamped: nobody was told, so this must stay
      // pending and fire the moment somebody subscribes.
      console.log('  nobody subscribed — leaving it pending');
      continue;
    }
    if (DRY_RUN) { console.log('  dry run, not sending'); continue; }

    const payload = {
      title: `${p.name} is running low`,
      body: `${p.qty} ${unit} left — reorder level is ${p.min_qty} ${unit}.`,
      tag: `low-${p.id}`,
      url: `./?item=${p.id}`
    };
    const results = await Promise.all(phones.map(s => send(s, payload)));
    const ok = results.filter(Boolean).length;

    if (ok > 0) {
      await rest(`products?id=eq.${p.id}`, {
        method: 'PATCH',
        body: { low_alert_sent_at: new Date().toISOString() }
      });
      sentAny += ok;
      console.log(`  sent to ${ok} phone(s), marked as warned`);
    } else {
      console.log('  nothing got through — leaving it pending to try again');
    }
  }
  console.log(`Done. ${sentAny} notification(s) sent.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
