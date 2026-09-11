/* =========================================================
   Yard Stock — data layer
   ---------------------------------------------------------
   Two interchangeable back ends behind one API:

     • 'supabase' — live shared data over the PostgREST API.
                    No SDK, no CDN: plain fetch calls.
     • 'local'    — IndexedDB on this device only. Used
                    automatically when config.js has no keys,
                    so the app is usable before you sign up.

   Every read is mirrored into IndexedDB, so if the phone drops
   off the network the app still shows the last known stock
   (read-only) instead of an empty screen.
   ========================================================= */
(function () {
  'use strict';

  const CFG = window.CONFIG || {};
  const HAS_SUPABASE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  /* ---------------- IndexedDB key/value store ---------------- */
  const IDB_NAME = 'yardstock';
  const IDB_STORE = 'kv';
  const IDB_TIMEOUT = 4000;
  let idbPromise = null;
  let memFallback = null;   // used if IndexedDB is unavailable or wedged

  /* Some browsers (notably Safari in private mode) can leave an IndexedDB
     request pending forever instead of erroring. Never let that hang the app:
     every call races a timeout and falls back to an in-memory map, so the
     worst case is "this session does not remember", not a frozen spinner. */
  function timeboxed(promise, ms, fallback) {
    return Promise.race([
      promise,
      new Promise(resolve => setTimeout(() => resolve(fallback), ms))
    ]);
  }
  function memory() {
    if (!memFallback) memFallback = new Map();
    return memFallback;
  }

  function idb() {
    if (idbPromise) return idbPromise;
    idbPromise = timeboxed(new Promise((resolve, reject) => {
      if (!self.indexedDB) { reject(new Error('no indexedDB')); return; }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('indexedDB blocked'));
    }), IDB_TIMEOUT, null).catch(() => null);
    return idbPromise;
  }

  async function kvGet(key) {
    try {
      const db = await idb();
      if (!db) return memory().get(key);
      return await timeboxed(new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }), IDB_TIMEOUT, undefined);
    } catch (e) { return memory().get(key); }
  }

  async function kvSet(key, value) {
    try {
      const db = await idb();
      if (!db) { memory().set(key, value); return false; }
      return await timeboxed(new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      }), IDB_TIMEOUT, false);
    } catch (e) { memory().set(key, value); return false; }
  }

  /** true when persistence is genuinely working */
  async function storageOk() { return !!(await idb()); }

  /* ---------------- shared helpers ---------------- */
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function nowIso() { return new Date().toISOString(); }
  let localSeq = 0;

  class OfflineError extends Error {
    constructor(msg) { super(msg || 'No connection'); this.name = 'OfflineError'; this.offline = true; }
  }

  /* =========================================================
     LOCAL ADAPTER
     ========================================================= */
  const Local = {
    mode: 'local',
    cache: { products: [], movements: [], people: [], reorder_cards: [] },
    ready: null,

    /* Load all four keys, then assign in one go. Reading them one await at a
       time left a window where a write could land between assignments and then
       be overwritten by the next stale read. Every method below waits on this,
       so nothing can touch the cache before it is filled. */
    init() {
      if (!this.ready) {
        this.ready = (async () => {
          const [products, movements, people, cards] = await Promise.all([
            kvGet('local:products'), kvGet('local:movements'), kvGet('local:people'), kvGet('local:reorder_cards')
          ]);
          this.cache.products      = products  || [];
          this.cache.movements     = movements || [];
          this.cache.people        = people    || [];
          this.cache.reorder_cards = cards     || [];
        })();
      }
      return this.ready;
    },
    async persist(what) { await kvSet('local:' + what, this.cache[what]); },

    async listProducts() { await this.init(); return this.cache.products.filter(p => !p.archived); },
    async listMovements(limit) {
      await this.init();
      return this.cache.movements
        .slice()
        // seq breaks ties: two movements can land in the same millisecond and
        // the log must still read newest-first.
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || (b.seq || 0) - (a.seq || 0))
        .slice(0, limit || 300);
    },
    async listPeople() { await this.init(); return this.cache.people.filter(p => p.active !== false); },

    async createProduct(p) {
      await this.init();
      const row = Object.assign({
        id: uuid(), qty: 0, min_qty: 0, archived: false,
        created_at: nowIso(), updated_at: nowIso()
      }, p);
      this.cache.products.push(row);
      await this.persist('products');
      if (Number(row.qty) !== 0) {
        await this.applyMovement({
          productId: row.id, delta: Number(row.qty), reason: 'in',
          person: p.__person || '', note: 'Opening count', _skipQty: true
        });
      }
      return row;
    },
    async updateProduct(id, patch) {
      await this.init();
      const row = this.cache.products.find(p => p.id === id);
      if (!row) throw new Error('Product not found');
      Object.assign(row, patch, { updated_at: nowIso() });
      await this.persist('products');
      return row;
    },
    async deleteProduct(id) {
      await this.init();
      this.cache.products = this.cache.products.filter(p => p.id !== id);
      this.cache.movements = this.cache.movements.filter(m => m.product_id !== id);
      await this.persist('products');
      await this.persist('movements');
      return true;
    },
    async applyMovement({ productId, delta, reason, person, note, _skipQty }) {
      await this.init();
      const row = this.cache.products.find(p => p.id === productId);
      if (!row) throw new Error('Product not found');
      if (!_skipQty) row.qty = Number(row.qty) + Number(delta);
      row.updated_at = nowIso();
      this.cache.movements.push({
        id: uuid(), product_id: productId, delta: Number(delta), qty_after: Number(row.qty),
        reason: reason || 'out', person: person || '', note: note || '',
        product_name: row.name, created_at: nowIso(), seq: ++localSeq
      });
      await this.persist('products');
      await this.persist('movements');
      return row;
    },
    async addPerson(name) {
      await this.init();
      const row = { id: uuid(), name, active: true, created_at: nowIso() };
      this.cache.people.push(row);
      await this.persist('people');
      return row;
    },
    async removePerson(id) {
      await this.init();
      this.cache.people = this.cache.people.filter(p => p.id !== id);
      await this.persist('people');
      return true;
    },
    async uploadPhoto(blob) {
      // Local mode keeps the image inline as a data URL.
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
      });
    },

    async listReorderCards() { await this.init(); return this.cache.reorder_cards; },
    async createReorderCard(c) {
      await this.init();
      if (this.cache.reorder_cards.some(x => x.product_id === c.product_id && x.status !== 'received')) {
        throw new Error('That item is already on the reorder board');
      }
      const row = Object.assign({ id: uuid(), status: 'to_order', qty: 0, created_at: nowIso() }, c);
      this.cache.reorder_cards.push(row);
      await this.persist('reorder_cards');
      return row;
    },
    async updateReorderCard(id, patch) {
      await this.init();
      const row = this.cache.reorder_cards.find(x => x.id === id);
      if (!row) throw new Error('Card not found');
      Object.assign(row, patch);
      await this.persist('reorder_cards');
      return row;
    },
    async deleteReorderCard(id) {
      await this.init();
      this.cache.reorder_cards = this.cache.reorder_cards.filter(x => x.id !== id);
      await this.persist('reorder_cards');
      return true;
    }
  };

  /* ---------------------------------------------------------
     Session. Until the access cutover runs, everything works on the
     public anon key exactly as it always has and a session is simply
     absent; afterwards every request needs one. Stored in localStorage
     so a phone signs in once and stays signed in, refreshing the token
     as it expires.
     --------------------------------------------------------- */
  const SESSION_KEY = 'ys_session';
  const Session = {
    data: (() => {
      try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
      catch (e) { return null; }
    })(),
    save(d) {
      this.data = d;
      if (d) localStorage.setItem(SESSION_KEY, JSON.stringify(d));
      else localStorage.removeItem(SESSION_KEY);
    },
    get token() { return this.data && this.data.access_token; },
    get userId() { return this.data && this.data.user && this.data.user.id; },
    get email() { return this.data && this.data.user && this.data.user.email; }
  };

  async function authFetch(path, body, extraHeaders) {
    const base = String(CFG.SUPABASE_URL || '').replace(/\/+$/, '');
    let res;
    try {
      res = await fetch(base + '/auth/v1/' + path, {
        method: 'POST',
        headers: Object.assign({
          'apikey': CFG.SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json'
        }, extraHeaders || {}),
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new OfflineError('Could not reach the server');
    }
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = (json && (json.error_description || json.msg || json.message || json.error)) || '';
      throw new Error(msg || ('Sign-in failed (' + res.status + ')'));
    }
    return json;
  }

  async function refreshSession() {
    if (!Session.data || !Session.data.refresh_token) return false;
    try {
      const out = await authFetch('token?grant_type=refresh_token', { refresh_token: Session.data.refresh_token });
      Session.save(out);
      return true;
    } catch (e) {
      // A refresh token the server no longer honours means the session is
      // finished; drop it so the app asks for a sign-in rather than looping.
      if (!(e instanceof OfflineError)) Session.save(null);
      return false;
    }
  }

  /* =========================================================
     SUPABASE ADAPTER (PostgREST + Storage over fetch)
     ========================================================= */
  const Supa = {
    mode: 'supabase',
    base: String(CFG.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: CFG.SUPABASE_ANON_KEY || '',

    /** The session's token when signed in, the public anon key otherwise.
        Before the access cutover both work; after it, only the former does. */
    headers(extra) {
      return Object.assign({
        'apikey': this.key,
        'Authorization': 'Bearer ' + (Session.token || this.key),
        'Content-Type': 'application/json'
      }, extra || {});
    },
    async rest(path, opts) {
      opts = opts || {};
      let res;
      try {
        res = await fetch(this.base + '/rest/v1/' + path, {
          method: opts.method || 'GET',
          headers: this.headers(opts.headers),
          body: opts.body ? JSON.stringify(opts.body) : undefined
        });
      } catch (e) {
        throw new OfflineError('Could not reach the server');
      }
      // An expired access token reads as 401. Refresh once and retry, so a
      // phone left alone overnight does not greet its owner with an error.
      // Deliberately outside the try above: a failure from the retry must not
      // be relabelled as "offline".
      if (res.status === 401 && Session.data && !opts.__retried && await refreshSession()) {
        return await this.rest(path, Object.assign({}, opts, { __retried: true }));
      }
      if (!res.ok) {
        let detail = '';
        try { const j = await res.json(); detail = j.message || j.hint || j.error || ''; } catch (e) { /* ignore */ }
        throw new Error(detail || ('Server error ' + res.status));
      }
      if (res.status === 204) return null;
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    },

    async init() { /* nothing to warm up */ },

    async listProducts() {
      return await this.rest('products?select=*&archived=eq.false&order=name.asc');
    },
    async listMovements(limit) {
      return await this.rest('movements?select=*,products(name,unit)&order=created_at.desc&limit=' + (limit || 300));
    },
    async listPeople() {
      return await this.rest('people?select=*&active=eq.true&order=name.asc');
    },
    async createProduct(p) {
      const person = p.__person || '';
      const opening = Number(p.qty) || 0;
      const body = Object.assign({}, p);
      delete body.__person;
      body.qty = 0;
      const rows = await this.rest('products', {
        method: 'POST', body: body, headers: { 'Prefer': 'return=representation' }
      });
      const row = rows[0];
      if (opening !== 0) {
        return await this.applyMovement({
          productId: row.id, delta: opening, reason: 'in', person, note: 'Opening count'
        });
      }
      return row;
    },
    async updateProduct(id, patch) {
      const rows = await this.rest('products?id=eq.' + id, {
        method: 'PATCH', body: Object.assign({}, patch, { updated_at: nowIso() }),
        headers: { 'Prefer': 'return=representation' }
      });
      return rows && rows[0];
    },
    async deleteProduct(id) {
      // Soft delete keeps the movement history intact.
      await this.rest('products?id=eq.' + id, {
        method: 'PATCH', body: { archived: true, updated_at: nowIso() }
      });
      return true;
    },
    async applyMovement({ productId, delta, reason, person, note }) {
      // Single atomic call: adjusts qty AND writes the log line.
      return await this.rest('rpc/apply_movement', {
        method: 'POST',
        body: {
          p_product: productId, p_delta: Number(delta),
          p_reason: reason || 'out', p_person: person || '', p_note: note || ''
        }
      });
    },
    async addPerson(name) {
      const rows = await this.rest('people', {
        method: 'POST', body: { name: name }, headers: { 'Prefer': 'return=representation' }
      });
      return rows[0];
    },
    async removePerson(id) {
      await this.rest('people?id=eq.' + id, { method: 'PATCH', body: { active: false } });
      return true;
    },
    async uploadPhoto(blob, productId) {
      const bucket = CFG.PHOTO_BUCKET || 'product-photos';
      const path = (productId || uuid()) + '/' + Date.now() + '.jpg';
      let res;
      try {
        res = await fetch(this.base + '/storage/v1/object/' + bucket + '/' + path, {
          method: 'POST',
          headers: {
            'apikey': this.key,
            'Authorization': 'Bearer ' + this.key,
            'Content-Type': 'image/jpeg',
            'x-upsert': 'true'
          },
          body: blob
        });
      } catch (e) {
        throw new OfflineError('Could not upload the photo');
      }
      if (!res.ok) {
        let detail = '';
        try { const j = await res.json(); detail = j.message || j.error || ''; } catch (e) { /* ignore */ }
        throw new Error(detail || 'Photo upload failed (' + res.status + ')');
      }
      return this.base + '/storage/v1/object/public/' + bucket + '/' + path;
    },

    async listReorderCards() {
      return await this.rest('reorder_cards?select=*,products(name,unit,location,photo_url)&order=created_at.desc');
    },
    async createReorderCard(c) {
      try {
        const rows = await this.rest('reorder_cards', {
          method: 'POST', body: c, headers: { 'Prefer': 'return=representation' }
        });
        return rows[0];
      } catch (e) {
        // the partial unique index rejects a second open card for the same product
        if (/duplicate key|unique/i.test(e.message || '')) throw new Error('That item is already on the reorder board');
        throw e;
      }
    },
    async updateReorderCard(id, patch) {
      const rows = await this.rest('reorder_cards?id=eq.' + id, {
        method: 'PATCH', body: patch, headers: { 'Prefer': 'return=representation' }
      });
      return rows && rows[0];
    },
    async deleteReorderCard(id) {
      await this.rest('reorder_cards?id=eq.' + id, { method: 'DELETE' });
      return true;
    }
  };

  /* =========================================================
     PUBLIC FACADE — caching + offline fallback
     ========================================================= */
  const impl = HAS_SUPABASE ? Supa : Local;

  const DB = {
    mode: impl.mode,
    online: true,
    lastSync: null,
    /** true when the last read came from the offline cache */
    stale: false,

    OfflineError,
    uuid,
    /** false when this browser refused to give us persistent storage */
    persistent: true,

    /* ---- Accounts ------------------------------------------------------
       Only meaningful against Supabase; in local mode there is nobody to
       sign in to, so these report "signed out" and refuse politely. */
    get session() { return Session.data; },
    get signedIn() { return !!Session.token; },

    async signIn(email, password) {
      if (impl.mode !== 'supabase') throw new Error('Accounts need Supabase configured');
      const out = await authFetch('token?grant_type=password', {
        email: String(email || '').trim(), password: String(password || '')
      });
      Session.save(out);
      return out;
    },

    signOut() {
      Session.save(null);
      this.lastSync = null;
    },

    /** The signed-in user's profile row, or null when signed out. Says
        whether they are staff or a client, and which client they are. */
    async myProfile() {
      if (!Session.token) return null;
      const rows = await impl.rest('profiles?select=*,clients(name)&id=eq.' + Session.userId + '&limit=1');
      return (rows && rows[0]) || null;
    },

    async listClients() {
      if (impl.mode !== 'supabase') return [];
      return await impl.rest('clients?select=*&order=name.asc');
    },
    async createClient(name) {
      const rows = await impl.rest('clients', {
        method: 'POST', body: { name: name }, headers: { 'Prefer': 'return=representation' }
      });
      return rows[0];
    },
    async removeClient(id) {
      await impl.rest('clients?id=eq.' + id, { method: 'DELETE' });
    },

    /** Client logins attached to a client, newest first. */
    async listClientLogins(clientId) {
      if (impl.mode !== 'supabase') return [];
      return await impl.rest('profiles?select=*&role=eq.client&client_id=eq.' + clientId + '&order=created_at.desc');
    },

    /** Create a client login. Uses the ordinary sign-up endpoint rather than
        the admin API, because the admin API needs the service key and that
        must never be shipped in a page. A self-signed-up account with no
        profiles row can read nothing, so leaving sign-up open is safe. */
    async createClientLogin(clientId, email, password, label) {
      if (impl.mode !== 'supabase') throw new Error('Accounts need Supabase configured');
      const out = await authFetch('signup', {
        email: String(email || '').trim(), password: String(password || '')
      });
      const userId = (out && out.user && out.user.id) || (out && out.id);
      if (!userId) throw new Error('Supabase did not return the new account — is "Confirm email" still on?');
      await impl.rest('profiles', {
        method: 'POST',
        body: { id: userId, role: 'client', client_id: clientId, label: label || email },
        headers: { 'Prefer': 'resolution=merge-duplicates' }
      });
      return userId;
    },

    async removeClientLogin(userId) {
      // Removing the profile is what removes access; the auth user itself can
      // only be deleted with the service key, from the Supabase dashboard.
      await impl.rest('profiles?id=eq.' + userId, { method: 'DELETE' });
    },

    async init() {
      this.persistent = await storageOk();
      await impl.init();
    },

    async _read(name, fn) {
      try {
        const rows = await fn();
        this.online = true; this.stale = false; this.lastSync = Date.now();
        if (impl.mode === 'supabase') await kvSet('cache:' + name, rows);
        return rows || [];
      } catch (e) {
        if (impl.mode === 'supabase') {
          const cached = await kvGet('cache:' + name);
          if (cached) { this.online = false; this.stale = true; return cached; }
        }
        this.online = false;
        throw e;
      }
    },

    listProducts()      { return this._read('products',  () => impl.listProducts()); },
    listMovements(n)    { return this._read('movements', () => impl.listMovements(n)); },
    listPeople()        { return this._read('people',    () => impl.listPeople()); },
    listReorderCards()  { return this._read('reorder_cards', () => impl.listReorderCards()); },

    async _write(fn) {
      try {
        const out = await fn();
        this.online = true;
        return out;
      } catch (e) {
        if (e && e.offline) this.online = false;
        throw e;
      }
    },

    createProduct(p)        { return this._write(() => impl.createProduct(p)); },
    updateProduct(id, patch){ return this._write(() => impl.updateProduct(id, patch)); },
    deleteProduct(id)       { return this._write(() => impl.deleteProduct(id)); },
    applyMovement(m)        { return this._write(() => impl.applyMovement(m)); },
    addPerson(name)         { return this._write(() => impl.addPerson(name)); },
    removePerson(id)        { return this._write(() => impl.removePerson(id)); },
    uploadPhoto(blob, pid)  { return this._write(() => impl.uploadPhoto(blob, pid)); },
    createReorderCard(c)       { return this._write(() => impl.createReorderCard(c)); },
    updateReorderCard(id, p)   { return this._write(() => impl.updateReorderCard(id, p)); },
    deleteReorderCard(id)      { return this._write(() => impl.deleteReorderCard(id)); }
  };

  window.DB = DB;
})();
