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

/* Everything worth knowing goes on the run's summary page as well as into
   the log. The log is three clicks down and easy to miss; the summary is
   the first thing on screen when a run is opened. */
const summary = [];
function say(line) {
  console.log(line);
  summary.push(line);
}
async function writeSummary() {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  const { appendFile } = await import('node:fs/promises');
  await appendFile(path, summary.join('\n') + '\n');
}

const missing = Object.entries({
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
}).filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
  /* Exit 0, not 1. Nothing has broken — it simply has not been set up yet,
     and a non-zero exit makes GitHub email the owner on every scheduled
     run, which drowns the real message in failure notices. */
  say('## Not set up yet');
  say('');
  say(`These secrets are missing: **${missing.join(', ')}**`);
  say('');
  say('Settings -> Secrets and variables -> Actions. The names must match');
  say('exactly, capitals and underscores included. Secrets that exist under');
  say('a slightly different name are invisible to this job.');
  await writeSummary();
  process.exit(0);
}

/* Which role a Supabase key carries, read straight out of the JWT's middle
   section. Not verified — there is nothing to verify against here, and the
   point is only to tell the two keys apart before a confusing 403.

   The anon key and the service_role key sit side by side in the dashboard
   and look identical at a glance. Picking the wrong one gets "permission
   denied" on every table, which reads like the lock-down is broken rather
   than like the wrong key was copied. */
function keyRole(key) {
  try {
    const mid = String(key).split('.')[1];
    if (!mid) return null;   // newer sb_secret_… keys are not JWTs
    const pad = '='.repeat((4 - mid.length % 4) % 4);
    const json = JSON.parse(
      Buffer.from(mid.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8'));
    return json.role || null;
  } catch (e) {
    return null;
  }
}

const role = keyRole(SUPABASE_SERVICE_ROLE_KEY);
if (role && role !== 'service_role') {
  say('## Wrong Supabase key');
  say('');
  say(`SUPABASE_SERVICE_ROLE_KEY holds the **${role}** key, not the service_role one.`);
  say('');
  say('The anon key had its access taken away by the access cutover, which is');
  say('why every table answers "permission denied". This job reads across every');
  say('supplier and everybody\'s subscriptions, so it needs the service_role key.');
  say('');
  say('Supabase -> Project Settings -> API Keys -> the row marked **service_role**');
  say('(it says *secret*, and is hidden until you reveal it). Replace the secret');
  say('in GitHub with that value.');
  await writeSummary();
  process.exit(0);
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
  if (!res.ok) {
    const body = await res.text();
    // 42501 is "permission denied", which for this job means the key is not
    // the service_role one — worth saying rather than leaving a raw 403.
    if (body.includes('42501')) {
      throw new Error(
        `Permission denied reading ${path.split('?')[0]}. ` +
        'That is what a key without service_role rights gets since the access ' +
        'cutover. Check SUPABASE_SERVICE_ROLE_KEY really holds the service_role ' +
        'key from Project Settings -> API Keys, not the anon one.');
    }
    throw new Error(`${path} -> ${res.status} ${body}`);
  }
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
    say('## Nothing to send');
    say('');
    say('No product is at or below its reorder level, out of those that have');
    say('a supplier attached and have not already been warned about.');
    return;
  }
  say('## ' + low.length + ' item(s) at or below their reorder level');
  say('');

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
    say(`- **${p.name}** — ${p.qty}${unit} left, reorder at ${p.min_qty}${unit}, ${phones.length} phone(s) subscribed`);

    if (!phones.length) {
      // Deliberately not stamped: nobody was told, so this must stay
      // pending and fire the moment somebody subscribes.
      say('  - nobody subscribed, so nothing sent. Left pending, and it will fire as soon as somebody does.');
      continue;
    }
    if (DRY_RUN) { say('  - dry run, nothing sent'); continue; }

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
      say(`  - sent to ${ok} phone(s)`);
    } else {
      say('  - nothing got through. Left pending to try again next run.');
    }
  }
  say('');
  say(`**${sentAny} notification(s) sent.**`);
}

main()
  .then(writeSummary)
  .catch(async err => {
    // A genuine fault, as opposed to "not configured" — worth failing on,
    // but say what it was somewhere findable first.
    say('## It did not run');
    say('');
    say('```');
    say(String(err && err.message ? err.message : err));
    say('```');
    await writeSummary().catch(() => {});
    console.error(err);
    process.exit(1);
  });
