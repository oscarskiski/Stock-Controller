# Yard Stock

Stock control for the off-site store: anyone walks up, finds the item by name or
rack code, and books it in or out. Photo on every product, a rack "GPS" like
`A3.1.1`, and a permanent log of who moved what.

Built as a phone-first web app in the same iOS-style dark UI as the planner —
no app store, no install, just a link you add to your home screen.

---

## Try it right now (local mode)

Open `index.html` in a browser. That's it.

With no Supabase keys in `config.js` the app runs in **local mode**: everything
is stored in that one browser, on that one device. Perfect for testing the flow,
useless for real stock control — a blue banner reminds you.

---

## Connecting Supabase (makes it real)

Once every phone needs to see the same live stock:

1. **Create a project** at [supabase.com](https://supabase.com) — free tier is
   plenty. Pick a region near you.
2. **Run the schema.** In the project, go to **SQL Editor → New query**, paste
   the whole of [`schema.sql`](schema.sql), press **Run**. It creates the
   tables, the photo bucket, and the `apply_movement` function.

   > If the last block errors with *"must be owner of table objects"*, your
   > project restricts policy changes on storage. Do that part in the UI
   > instead: **Storage → New bucket** named `product-photos`, tick **Public
   > bucket**, then in its **Policies** allow `SELECT` and `INSERT` for `anon`.
   > Everything above that block will already have run.
3. **Copy your keys.** **Project Settings → API**:
   - *Project URL* → `SUPABASE_URL`
   - *anon public* key → `SUPABASE_ANON_KEY`
4. **Paste them into [`config.js`](config.js)** and save.

Reload the app — the blue banner disappears and Settings shows
`Mode: Shared (Supabase)`.

---

## Putting it on the phones

The app is plain static files, so anywhere that serves a folder works. Two easy
routes:

**Netlify Drop** (fastest, free, HTTPS) — go to
[app.netlify.com/drop](https://app.netlify.com/drop) and drag this whole folder
onto the page. You get a URL in about ten seconds.

**Your own hosting / IIS on the NAS** — copy the folder to the web root.

Then on each phone, open the URL and:

- **iPhone** — Share button → *Add to Home Screen*
- **Android** — ⋮ menu → *Install app* / *Add to Home screen*

It then opens full-screen with no browser chrome, and the app shell is cached so
it launches instantly even on bad signal.

> HTTPS matters: the camera and the offline cache only work on `https://` (or
> `localhost`). A plain `http://` address on the NAS will load, but the camera
> button won't open the camera.

---

## How the app is meant to be used

**Rack codes.** `A3.1.1` = rack **A**, bay **3**, level **1**, position **1**.
The picker in the product sheet builds that for you, and the Racks tab groups
everything by it, so "where is it?" is one tap. You can use fewer parts —
`A3` or `A3.1` are both fine.

**Booking.** Three ways in, all landing on the same sheet:
- swipe a product row **right to book in**, **left to book out**
- tap a product → big green/orange buttons
- the **+** button → *Book in* / *Book out*, then search for the item

**Set count** is the third option on that sheet — for stock takes. It records
the correction in the log rather than silently editing a number.

**Names, not logins.** Add everyone in Settings → Team. Each phone remembers
who's using it, and every movement is stamped with that name. Nobody gets
locked out mid-job.

**Low stock.** Set *"Warn me below"* on a product and it turns orange, gets
counted on the Stock tab, and shows a badge on the tab bar.

---

## Files

| File | What it is |
|---|---|
| `index.html` | The shell — just the frame, header, tab bar |
| `styles.css` | All the styling and design tokens |
| `config.js` | **Your keys go here** |
| `db.js` | Data layer — Supabase and local modes behind one API |
| `app.js` | Screens, sheets, gestures, photo capture |
| `schema.sql` | Run once in Supabase |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Makes it installable |

---

## Things worth knowing

**Offline.** Browsing works offline — the last known stock is cached on the
phone and the app says plainly that it's offline. *Bookings need a connection.*
That's deliberate: two people booking the same rack out on separate phones with
no signal would produce a count nobody can trust. The count is always settled
server-side in one atomic call.

**Photos** are resized to 1400px and compressed before upload (about 150–300 KB
each), so a phone on factory wifi isn't pushing 4 MB per chair.

**Deleting a product** archives it — the movement history survives, so last
year's log still makes sense.

**Backups.** Settings → *Export a backup* downloads everything as JSON.

### Locking it down

Right now anyone with the URL can read and write, which is the correct trade-off
for a store room where speed matters. If that changes — say the link leaks
outside the company — the options, cheapest first:

1. Keep the URL private and unlisted (where you are now).
2. Add a shared site password in front of the app (Netlify supports this on
   paid plans; a simple gate in `index.html` also works).
3. Switch to Supabase Auth and tighten the RLS policies in `schema.sql` to
   `auth.uid() is not null`. That means real logins on the floor.

### Next things that would earn their keep

- **Barcode / QR labels** on the racks — print a label per location, scan it and
  the app jumps straight to what lives there. The browser can do this natively
  on Android; iOS needs a small library.
- **A "picking list"** — tick off several items for one job and book them all
  out in one go.
- **Weekly low-stock email** so the factory orders before it runs dry.
