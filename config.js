/* =========================================================
   Yard Stock — configuration
   ---------------------------------------------------------
   LEAVE THESE BLANK to run in LOCAL MODE (data stays on this
   one device — fine for trying the app out, useless for real
   shared stock control).

   Fill them in to switch every phone onto the same live data.
   See README.md → "Connecting Supabase" for where to find them.
   The anon key is designed to be public/embedded in the page.
   ========================================================= */
window.CONFIG = {
  SUPABASE_URL: 'https://ecqyoppqpqxdlhfsugzm.supabase.co',   // your "stock controller" project
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjcXlvcHBxcHF4ZGxoZnN1Z3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTIyNTQsImV4cCI6MjEwMzMyODI1NH0.v1xaoBOkVOnlUhafFf6ej3RzpqEWz9PWd6OW4CrFkug',

  // Storage bucket that holds product photos (created by schema.sql)
  PHOTO_BUCKET: 'product-photos',

  // Longest side (px) that captured photos are resized to before upload.
  PHOTO_MAX_PX: 1400,
  PHOTO_QUALITY: 0.82,

  // Company name shown under the title
  SITE_NAME: 'Off-site store',

  // Sign-ins use a company + username + password, but Supabase Auth insists
  // on an email address, so the app builds one out of sight from the client
  // and the username. Nothing is ever sent to it and nobody ever sees it —
  // this only has to be a domain-shaped string. Changing it after accounts
  // exist would orphan every one of them.
  LOGIN_DOMAIN: 'clients.yardstock.app',

  // The app opens on a sign-in page and shows nothing until somebody signs
  // in. There is no lock-out risk in this being true: a database with no
  // accounts in it puts the app into first-run setup instead, which makes
  // the owner account.
  //
  // This is the app refusing, not the database. Until
  // schema-clients-cutover.sql is run, the anon key below still reads every
  // row, so the restriction holds for anyone using the app and not for
  // someone querying the API directly. Run the cutover to close that.
  REQUIRE_LOGIN: true,

  // Shown next to Cost / Price fields in the item form, e.g. 'R', '£', '$'.
  // Leave blank to show plain numbers with no currency symbol.
  CURRENCY_SYMBOL: 'R'
};
