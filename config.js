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
  SITE_NAME: 'Off-site store'
};
