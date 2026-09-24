/* =========================================================
   Yard Stock — app
   ========================================================= */
(function () {
'use strict';

const CFG = window.CONFIG || {};

/* ===================== Motion (springs) ===================== */
class Spring {
  constructor(value, { dampingRatio = 1, response = 0.3 } = {}) {
    this.value = value; this.velocity = 0; this.target = value;
    this.dampingRatio = dampingRatio; this.response = response; this.active = false;
  }
  set(target, velocity) { this.target = target; if (velocity !== undefined) this.velocity = velocity; this.active = true; }
  snap(value) { this.value = value; this.target = value; this.velocity = 0; this.active = false; }
  step(dt) {
    const omega = 2 * Math.PI / this.response;
    const k = omega * omega, c = 2 * this.dampingRatio * omega;
    const accel = -k * (this.value - this.target) - c * this.velocity;
    this.velocity += accel * dt; this.value += this.velocity * dt;
    if (Math.abs(this.value - this.target) < 0.01 && Math.abs(this.velocity) < 0.01) {
      this.value = this.target; this.velocity = 0; this.active = false;
    }
    return this.value;
  }
}
const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function runSpring(spring, onUpdate, onDone) {
  if (REDUCE_MOTION) { spring.snap(spring.target); onUpdate(spring.value); if (onDone) onDone(); return; }
  // Take the baseline from the first frame rather than performance.now().
  // rAF hands back the frame's start time, which can be earlier than the clock
  // we just read — and a negative dt runs the integrator backwards, so the
  // spring diverges instead of settling. Staying inside rAF's own timebase
  // sidesteps that no matter how the browser numbers its frames.
  let last = null;
  function frame(now) {
    if (last === null) last = now;
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.032)); last = now;
    spring.step(dt); onUpdate(spring.value);
    if (spring.active) requestAnimationFrame(frame); else if (onDone) onDone();
  }
  requestAnimationFrame(frame);
}
function project(v, decel = 0.998) { return (v / 1000) * decel / (1 - decel); }
function rubberband(overshoot, dimension, constant = 0.55) {
  const sign = overshoot < 0 ? -1 : 1, o = Math.abs(overshoot);
  return sign * (o * dimension * constant) / (dimension + constant * o);
}
function haptic(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) {} } }

/* ===================== Icons ===================== */
const I = {
  pick: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><path d="M8 6H6.5A1.5 1.5 0 0 0 5 7.5v11A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 17.5 6H16"/><polyline points="9 12.5 10.8 14.3 15 10"/><path d="M9 17.5h6"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  box: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v8a2 2 0 0 1-1.1 1.8l-7 3.5a2 2 0 0 1-1.8 0l-7-3.5A2 2 0 0 1 3 16V8"/><path d="M3.3 7.1l8-4a1.6 1.6 0 0 1 1.4 0l8 4a1 1 0 0 1 0 1.8l-8 4a1.6 1.6 0 0 1-1.4 0l-8-4a1 1 0 0 1 0-1.8z"/><path d="M12 12.9V21"/></svg>',
  boxSmall: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v8a2 2 0 0 1-1.1 1.8l-7 3.5a2 2 0 0 1-1.8 0l-7-3.5A2 2 0 0 1 3 16V8"/><path d="M3.3 7.1l8-4a1.6 1.6 0 0 1 1.4 0l8 4a1 1 0 0 1 0 1.8l-8 4a1.6 1.6 0 0 1-1.4 0l-8-4a1 1 0 0 1 0-1.8z"/></svg>',
  rack: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
  activity: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-7 4 14L16 12h5"/></svg>',
  person: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
  camera: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.6-2.4A1 1 0 0 1 9.4 5h5.2a1 1 0 0 1 .8.6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/></svg>',
  arrowIn: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><polyline points="7 10 12 15 17 10"/><path d="M4 20h16"/></svg>',
  arrowOut: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V9"/><polyline points="7 14 12 9 17 14"/><path d="M4 4h16"/></svg>',
  offline: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2l20 20"/><path d="M5 12.5a10 10 0 0 1 4-2.4M2 8.8A15 15 0 0 1 7.5 5.6M16.5 10.2a10 10 0 0 1 2.5 2.3M22 8.8a15 15 0 0 0-6.2-3.4"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="0.6" fill="currentColor"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/><path d="M10 20v-6h4v6"/></svg>',
  items: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h9a2 2 0 0 1 2 2v13l-4-2-4 2-4-2V6a2 2 0 0 1 1-1.7"/><path d="M8 9h8M8 13h5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.6a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H4.4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10.5A1.7 1.7 0 0 0 11.5 4.4V4.3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.02a1.7 1.7 0 0 0 1.56 1.04h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13 2 3 14h7l-1 8 11-14h-8l1-6z"/></svg>',
  count: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="14" y2="17"/></svg>',
  target: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/></svg>',
  reorder: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="10" rx="1.5"/><rect x="16" y="4" width="5" height="13" rx="1.5"/></svg>',
  truck: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="7" width="13" height="10" rx="1"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="6" cy="19" r="1.6"/><circle cx="17.5" cy="19" r="1.6"/></svg>',
  scan: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8"/><path d="M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8"/><path d="M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16"/><path d="M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16"/><path d="M3 12h18"/></svg>',
  print: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1.5"/><path d="M6 14h12v7H6z"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3.5V9h-5.5"/></svg>'
};

/* ===================== Small utils ===================== */
const $ = (id) => document.getElementById(id);
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function num(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function fmtQty(v) {
  const n = num(v);
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0] || '').join('').toUpperCase() || '?';
}
function fmtWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + time;
}
function dayKey(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toDateString(); }
function dayLabel(iso) {
  const d = new Date(iso); if (isNaN(d)) return '';
  const now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
function orDash(v) { const s = (v == null ? '' : String(v)).trim(); return s ? escapeHtml(s) : '—'; }

/* ---- location helpers ----
   A location is a code like A1R1 or V2R3: a letter A–Z, a number, then R and
   the rack number. Some things span more than one, so products.location holds
   a comma-separated list — "A1R1, A1R2" — in the same text column as before.
   Anything that does not match (the old A3.1.1 style) is kept and shown as it
   is, never dropped, and collects under "?" on the Racks screen to be fixed. */
const LOC_RE = /^([A-Z])(\d{1,3})R(\d{1,3})$/;
function normLoc(s) { return String(s || '').toUpperCase().replace(/\s+/g, ''); }
/** Accepts the stored string or an array; always returns distinct codes. */
function locList(v) {
  const raw = Array.isArray(v) ? v.join(',') : String(v || '');
  return Array.from(new Set(raw.split(',').map(normLoc).filter(Boolean)));
}
function parseLoc(code) {
  const m = LOC_RE.exec(normLoc(code));
  return m ? { letter: m[1], num: Number(m[2]), rack: Number(m[3]) } : null;
}
function buildLoc(letter, n, rack) {
  const a = String(letter || '').toUpperCase(), b = parseInt(n, 10), c = parseInt(rack, 10);
  if (!/^[A-Z]$/.test(a) || !(b > 0) || !(c > 0)) return '';
  return a + b + 'R' + c;
}
/** Numeric, not alphabetical: A2R1 comes before A10R1. */
function locSortKey(code) {
  const p = parseLoc(code);
  if (!p) return 'zzz' + normLoc(code);
  return p.letter + String(p.num).padStart(4, '0') + String(p.rack).padStart(4, '0');
}
function sortLocs(v) { return locList(v).sort((a, b) => locSortKey(a).localeCompare(locSortKey(b))); }
/** For display and for saving: sorted, one comma-space between codes. */
function formatLocs(v) { return sortLocs(v).join(', '); }
/** The first location in walking order, which is what an item sorts by. */
function firstLoc(v) { return sortLocs(v)[0] || ''; }
function locGroup(code) { const p = parseLoc(code); return p ? p.letter : '?'; }
function locChipsHtml(v) {
  return sortLocs(v).map(c => '<span class="meta-chip loc">' + escapeHtml(c) + '</span>').join('');
}

const CATEGORIES = ['Parts', 'Assembled', 'Raw materials'];
const UNITS = ['ea', 'set', 'pair', 'box', 'pack', 'sheet', 'roll', 'm', 'm²', 'kg', 'litre'];
const LEAD_UNITS = ['days', 'wks', 'months'];
const WEIGHT_UNITS = ['kg', 'g', 'lb'];

/* ---- amount+unit fields (MOQ, lead time, cost/price): stored as one text
   column each ("500 ea", "3 wks", "£7.90") but edited as a proper numeric
   input plus a unit picker, not a single free-text box a user could type
   anything into. */
function parseAmountUnit(str, fallbackUnit) {
  const m = /^(-?\d+(?:\.\d+)?)\s*([A-Za-z%]*)$/.exec(String(str || '').trim());
  if (m) return { qty: m[1], unit: m[2] || fallbackUnit || '' };
  return { qty: '', unit: fallbackUnit || '' };
}
function formatAmountUnit(qty, unit) {
  const n = String(qty == null ? '' : qty).trim();
  if (!n) return null;
  return unit ? (n + ' ' + unit) : n;
}
function parseMoney(str) {
  const m = /-?\d+(?:\.\d+)?/.exec(String(str || ''));
  return m ? m[0] : '';
}
function formatMoney(qty) {
  const n = String(qty == null ? '' : qty).trim();
  if (!n) return null;
  const sym = (CFG.CURRENCY_SYMBOL || '').trim();
  return sym ? (sym + n) : n;
}

/* ===================== State ===================== */
const state = {
  screen: 'home',
  products: [],
  movements: [],
  people: [],
  reorderCards: [],
  pickLists: [],
  me: localStorage.getItem('ys_me') || '',
  q: '',
  cat: 'All',
  actFilter: 'All',
  openRacks: {},
  loading: true,
  error: '',
  /* The signed-in account's profile row, once fetched. null means nobody is
     signed in — which, before the access cutover, is the normal shop-floor
     state. role 'client' puts the app into the stripped-back client view. */
  profile: null,
  clients: [],
  authError: '',
  /* Set by the ?login link or the Settings row: shows the sign-in screen
     even before the cutover makes it compulsory. signInFrom says which, so
     only a staff member who opened it from Settings is offered a way back
     into the app — a client following the link is not. */
  forceSignIn: false,
  signInFrom: '',
  /* True only until the very first account exists. */
  needsSetup: false
};

function isClientView() { return !!(state.profile && state.profile.role === 'client'); }
/** The boss. The only one who can create or remove accounts; everyone else
    at the factory sees the same stock but cannot hand out logins. */
function isAdmin() { return !!(state.profile && state.profile.role === 'admin'); }
/** The signed-in client's own items. RLS returns only these once the cutover
    has run, but until then the server still hands over everything, so the
    filter has to exist here too — otherwise a client would briefly see the
    whole yard. */
function myClientProducts() {
  const mine = state.profile && state.profile.client_id;
  return state.products
    .filter(p => !p.archived && p.client_id && p.client_id === mine)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}
function clientNameOf(p) {
  const c = state.clients.find(c => c.id === p.client_id);
  return c ? c.name : '';
}

function setMe(name) {
  state.me = name || '';
  if (name) localStorage.setItem('ys_me', name); else localStorage.removeItem('ys_me');
}

/* ===================== Toast ===================== */
let toastTimer = null;
function toast(msg, kind) {
  const el = $('toast');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.innerHTML = (kind === 'good' ? I.check : '') + '<span>' + escapeHtml(msg) + '</span>';
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ===================== Data helpers ===================== */
function productById(id) { return state.products.find(p => p.id === id); }
function isLow(p) { return num(p.min_qty) > 0 && num(p.qty) <= num(p.min_qty); }
function isZero(p) { return num(p.qty) <= 0; }
function isDormant(p) { return !!p.dormant; }
function needsAttention(p) { return isLow(p) || isZero(p); }
function qtyClass(p) { return isZero(p) ? 'zero' : isLow(p) ? 'low' : ''; }
/** Products actually in day-to-day use — dormant catalogue lines sit out of Stock/Racks/Home so they don't clutter live booking, but stay fully visible and editable from Items. */
function activeProducts() { return state.products.filter(p => !isDormant(p)); }
function movementProductName(m) {
  if (m.product_name) return m.product_name;
  if (m.products && m.products.name) return m.products.name;
  const p = productById(m.product_id);
  return p ? p.name : 'Deleted item';
}

async function refresh(showSpinner) {
  if (showSpinner) { state.loading = true; render(); }
  try {
    if (isClientView()) {
      // A client may read their own products and nothing else — asking for the
      // team list or the movement log would simply come back empty or refused.
      state.products = (await DB.listProducts()) || [];
      state.movements = []; state.people = []; state.reorderCards = []; state.pickLists = [];
    } else {
      const [products, movements, people, cards, clients, picks] = await Promise.all([
        DB.listProducts(), DB.listMovements(300), DB.listPeople(), DB.listReorderCards(),
        DB.listClients().catch(() => []),
        DB.listPickLists().catch(() => [])
      ]);
      state.products = products || [];
      state.movements = movements || [];
      state.people = people || [];
      state.reorderCards = cards || [];
      state.clients = clients || [];
      state.pickLists = picks || [];
    }
    state.error = '';
  } catch (e) {
    state.error = e && e.message ? e.message : 'Could not load stock';
  }
  state.loading = false;
  render();
}

/* ---- reorder-card helpers ---- */
function cardProductName(c) {
  if (c.products && c.products.name) return c.products.name;
  const p = productById(c.product_id);
  return p ? p.name : 'Deleted item';
}
function openCardFor(productId) { return state.reorderCards.find(c => c.product_id === productId && c.status !== 'received'); }
/** Order enough to clear the shortfall, but never less than the supplier's MOQ. */
function suggestReorderQty(p) {
  const shortfall = Math.max(0, num(p.min_qty) - num(p.qty));
  const moq = num(parseAmountUnit(p.pref_moq, '').qty);
  return Math.max(shortfall || num(p.min_qty) || 1, moq);
}

/* ===================== Header & tabs ===================== */
const TABS = [
  { id: 'home', label: 'Home', icon: I.home },
  { id: 'stock', label: 'Stock', icon: I.box },
  { id: 'locations', label: 'Racks', icon: I.rack },
  { id: 'items', label: 'Items', icon: I.items },
  { id: 'picking', label: 'Picking', icon: I.pick },
  { id: 'reorder', label: 'Order', icon: I.reorder },
  { id: 'activity', label: 'Log', icon: I.activity }
];

function renderHeader() {
  const mode = appMode();
  const me = $('navMe');
  const scan = $('navScan'), gear = $('navGear');

  if (mode !== 'staff') {
    // A client gets their own name in the title and one button: their account.
    const clientName = (state.profile && state.profile.clients && state.profile.clients.name) || '';
    const heldCount = mode === 'client' ? myClientProducts().length : 0;
    $('navTitle').textContent = mode === 'client' ? (clientName || 'Your stock') : (CFG.SITE_NAME || 'Yard Stock');
    $('navSub').textContent = mode === 'client'
      ? heldCount + ' item' + (heldCount === 1 ? '' : 's') + ' held for you'
      : 'Sign in to continue';
    // The whole header is hidden on the sign-in and setup screens anyway; a
    // client keeps only the account button.
    scan.hidden = true;
    gear.hidden = true;
    me.hidden = mode !== 'client';
    if (mode === 'client') me.innerHTML = '<span class="avatar">' + escapeHtml(initials(clientName || '?')) + '</span><span class="mename">Account</span>';
    return;
  }
  scan.hidden = false; gear.hidden = false; me.hidden = false;

  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const rackLetters = Array.from(new Set(activeProducts().flatMap(p => locList(p.location).map(locGroup)).filter(r => r !== '?'))).sort();
  const titles = {
    home: ['Home', (state.me || 'Sign in') + ' · ' + (CFG.SITE_NAME || 'Off-site store') + ' · ' + dateStr],
    stock: ['Stock', state.products.length + ' line' + (state.products.length === 1 ? '' : 's')],
    locations: ['Racks', rackLetters.length ? rackLetters.join(', ') + ' · tap a letter to open it' : 'Browse by location'],
    items: ['Items', state.products.length + ' item' + (state.products.length === 1 ? '' : 's') + ' · manage catalogue'],
    picking: ['Picking', 'Lists of what to fetch off the racks'],
    reorder: ['Reorder', 'The signal board — what to buy, and where it is'],
    activity: ['Log', 'Every movement, permanently']
  };
  const [t, s] = titles[state.screen] || titles.home;
  $('navTitle').textContent = t;
  $('navSub').textContent = s;

  if (state.me) {
    me.innerHTML = '<span class="avatar">' + escapeHtml(initials(state.me)) + '</span>' +
                   '<span class="mename">' + escapeHtml(state.me.split(/\s+/)[0]) + '</span>';
  } else {
    me.innerHTML = '<span class="avatar">?</span><span class="mename">Who are you?</span>';
  }
}

function renderTabs() {
  // The tab bar belongs to the shop floor. A client has one screen, and
  // nobody signing in has any yet.
  if (appMode() !== 'staff') { $('tabbar').innerHTML = ''; return; }
  const lowCount = activeProducts().filter(needsAttention).length;
  const toOrderCount = state.reorderCards.filter(c => c.status === 'to_order').length;
  $('tabbar').innerHTML = TABS.map(tab => {
    let n = 0;
    if (tab.id === 'stock') n = lowCount;
    else if (tab.id === 'picking') n = state.pickLists.filter(l => l.status !== 'done').length;
    else if (tab.id === 'reorder') n = toOrderCount;
    const badge = n ? '<span class="tab-badge">' + (n > 99 ? '99+' : n) + '</span>' : '';
    return '<button class="tab-btn ' + (state.screen === tab.id ? 'active' : '') + '" data-tab="' + tab.id + '" type="button">' +
             tab.icon + badge + '<span class="tlabel">' + tab.label + '</span></button>';
  }).join('');
  $('tabbar').querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    const next = b.getAttribute('data-tab');
    if (next !== state.screen) state.q = '';   // each tab starts with a clean search
    state.screen = next;
    window.scrollTo(0, 0);
    render();
  }));
}

/* ===================== Render root ===================== */
/** Three shapes, not one: the sign-in form when the database demands a
    session and there is none, the client's read-only summary, and the full
    shop-floor app. The first two hide the tab bar and the add button. */
function appMode() {
  if (!DB.signedIn && state.needsSetup) return 'setup';
  // forceSignIn covers the case where REQUIRE_LOGIN is off and someone still
  // wants the sign-in screen — a client following their link, or the boss
  // checking a login from Settings.
  if (!DB.signedIn && (CFG.REQUIRE_LOGIN || state.forceSignIn)) return 'signin';
  if (isClientView()) return 'client';
  return 'staff';
}

/** The link to hand a client. Bookmarkable, and it opens straight on the
    sign-in screen however REQUIRE_LOGIN is set. */
function clientSignInUrl() {
  const url = new URL(location.href);
  url.search = ''; url.hash = '';
  url.searchParams.set('login', '1');
  return url.toString();
}

function render() {
  const mode = appMode();
  document.body.classList.toggle('chrome-off', mode !== 'staff');
  document.body.classList.toggle('auth-mode', mode === 'signin' || mode === 'setup');
  renderHeader();
  renderTabs();
  const el = $('screenContent');

  if (mode === 'setup') { el.innerHTML = setupScreenHtml(); wireSetup(el); return; }
  if (mode === 'signin') { el.innerHTML = signInScreenHtml(); wireSignIn(el); return; }
  if (state.loading) { el.innerHTML = '<div class="spinner"></div>'; return; }

  if (mode === 'client') {
    el.innerHTML = connectionBannerHtml() + clientScreenHtml();
    wireBanner(el);
    wireClient(el);
    return;
  }

  let html = connectionBannerHtml();
  if (state.screen === 'home') html += homeScreenHtml();
  else if (state.screen === 'stock') html += stockScreenHtml();
  else if (state.screen === 'locations') html += locationsScreenHtml();
  else if (state.screen === 'items') html += itemsScreenHtml();
  else if (state.screen === 'picking') html += pickingScreenHtml();
  else if (state.screen === 'reorder') html += reorderScreenHtml();
  else html += activityScreenHtml();
  el.innerHTML = html;

  wireBanner(el);
  if (state.screen === 'home') wireHome(el);
  else if (state.screen === 'stock') wireStock(el);
  else if (state.screen === 'locations') wireLocations(el);
  else if (state.screen === 'items') wireItems(el);
  else if (state.screen === 'picking') wirePicking(el);
  else if (state.screen === 'reorder') wireReorder(el);
  else wireActivity(el);
}

function connectionBannerHtml() {
  if (state.error && !state.products.length) {
    return '<div class="banner bad">' + I.offline + '<span>' + escapeHtml(state.error) +
           '</span><button class="banner-action" data-retry type="button">Retry</button></div>';
  }
  if (DB.stale || !DB.online) {
    return '<div class="banner warn">' + I.offline +
           '<span>Offline — showing the last known stock. Bookings need a connection.</span>' +
           '<button class="banner-action" data-retry type="button">Retry</button></div>';
  }
  if (!DB.persistent) {
    return '<div class="banner bad">' + I.info +
           '<span>This browser is refusing to store data' +
           (DB.mode === 'local' ? ' — anything you add will vanish when you close it. Try a normal (non-private) window.' : '. The app still works online, but nothing is cached for offline.') +
           '</span></div>';
  }
  if (DB.mode === 'local') {
    return '<div class="banner info">' + I.info +
           '<span>Local mode — this data lives on this phone only. Add your Supabase keys to share it.</span></div>';
  }
  return '';
}
function wireBanner(el) {
  el.querySelectorAll('[data-retry]').forEach(b => b.addEventListener('click', () => refresh(true)));
}

/* ===================== Sign-in & client view =====================
   Two screens that stand outside the normal tab structure: the sign-in
   form, and the read-only summary a client sees instead of the app. Both
   render straight into #screenContent with the tab bar hidden. */

/* First run only: no account exists yet, so there is nobody who could create
   one. This makes the first account, and it is an admin — the boss. Once any
   account exists this screen never appears again. */
function setupScreenHtml() {
  const site = CFG.SITE_NAME || 'Yard Stock';
  return '<div class="auth-screen">' +
    '<div class="auth-card">' +
      '<img class="auth-mark" src="icon-192.png" alt="">' +
      '<div class="auth-title">Set up ' + escapeHtml(site) + '</div>' +
      '<div class="auth-sub">Nobody who works here has a login yet. Make the owner account &mdash; the only one that can create logins for anyone else.</div>' +

      (state.authError ? '<div class="banner bad auth-banner">' + I.info + '<span>' + escapeHtml(state.authError) + '</span></div>' : '') +

      '<div class="form-card auth-form">' +
        '<label class="form-field"><div class="ff-label">Your name</div>' +
          '<input id="setupName" type="text" placeholder="e.g. Oscar Bekker"></label>' +
        '<label class="form-field"><div class="ff-label">Username</div>' +
          '<input id="setupUser" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="e.g. oscar"></label>' +
        '<label class="form-field"><div class="ff-label">Password</div>' +
          '<input id="setupPass" type="text" value="' + escapeHtml(suggestPassword()) + '"></label>' +
      '</div>' +

      '<button class="sheet-save auth-go" id="setupGo" type="button">Create the owner account</button>' +
      '<div class="status-line auth-foot">Write the password down before you tap this. You can change it later in Supabase, but not from here.</div>' +
    '</div>' +
  '</div>';
}

function wireSetup(el) {
  const go = el.querySelector('#setupGo');
  go.addEventListener('click', async () => {
    const name = (el.querySelector('#setupName').value || '').trim();
    const user = (el.querySelector('#setupUser').value || '').trim();
    const pass = el.querySelector('#setupPass').value || '';
    if (!name) { state.authError = 'Your name, please — it is what shows on the app and in the log.'; render(); return; }
    if (!user) { state.authError = 'Pick a username.'; render(); return; }
    if (pass.length < 8) { state.authError = 'The password needs at least 8 characters.'; render(); return; }
    go.disabled = true; go.textContent = 'Creating…';
    try {
      await DB.createLogin({ role: 'admin', username: user, password: pass, label: name || user });
      await DB.signIn(user, pass);
      state.needsSetup = false;
      state.authError = '';
      await loadProfile();
      applyProfileIdentity();
      await refresh();
      toast('Signed in as ' + user, 'good');
    } catch (e) {
      state.authError = e.message || 'Could not create that account';
      render();
    }
  });
}

function signInScreenHtml() {
  const site = CFG.SITE_NAME || 'Yard Stock';
  return '<div class="auth-screen">' +
    '<div class="auth-card">' +
      '<img class="auth-mark" src="icon-192.png" alt="">' +
      '<div class="auth-title">' + escapeHtml(site) + '</div>' +
      '<div class="auth-sub">Sign in to see your stock</div>' +

      (state.authError ? '<div class="banner bad auth-banner">' + I.info + '<span>' + escapeHtml(state.authError) + '</span></div>' : '') +

      '<div class="form-card auth-form">' +
        '<label class="form-field"><div class="ff-label">Username</div>' +
          '<input id="authUser" type="text" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="The username you were given"></label>' +
        '<label class="form-field"><div class="ff-label">Password</div>' +
          '<input id="authPass" type="password" autocomplete="current-password" placeholder="Your password"></label>' +
      '</div>' +

      '<button class="sheet-save auth-go" id="authGo" type="button">Sign in</button>' +

      (state.signInFrom === 'settings' && !CFG.REQUIRE_LOGIN
        ? '<button class="link-btn auth-back" id="authBack" type="button">Back to the app</button>'
        : '') +

      '<div class="status-line auth-foot">Your username and password come from ' + escapeHtml(site) + '.<br>' +
        'Sign in once and this device stays signed in.</div>' +
    '</div>' +
  '</div>';
}

function wireSignIn(el) {
  const go = el.querySelector('#authGo');

  const submit = async () => {
    const user = el.querySelector('#authUser').value;
    const pass = el.querySelector('#authPass').value;
    if (!user || !pass) { state.authError = 'Username and password, please.'; render(); return; }
    go.disabled = true; go.textContent = 'Signing in…';
    try {
      await DB.signIn(user, pass);
      state.authError = '';
      state.forceSignIn = false;
      state.signInFrom = '';
      await loadProfile();
      applyProfileIdentity();
      await refresh();
    } catch (e) {
      // GoTrue says "invalid login credentials" for a wrong username and a
      // wrong password alike, so the message has to cover both.
      state.authError = /invalid/i.test(e.message || '')
        ? 'That username and password did not work.'
        : (e.message || 'Could not sign in');
      render();
    }
  };

  go.addEventListener('click', submit);
  el.querySelector('#authUser').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') el.querySelector('#authPass').focus(); });
  el.querySelector('#authPass').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); });

  const back = el.querySelector('#authBack');
  if (back) back.addEventListener('click', () => {
    state.forceSignIn = false;
    state.authError = '';
    if (!state.products.length) refresh(true); else render();
  });
}

/** Once signed in, the account says who you are: bookings are logged under
    the name on it, and nobody is asked to tap a name off a list. The account
    wins over anything this device remembered from before. */
function applyProfileIdentity() {
  if (!state.profile || state.profile.role === 'client') return;
  const name = state.profile.label || state.profile.username || '';
  if (name && name !== state.me) setMe(name);
}

/** Read the signed-in account's profile, so the app knows whether it is
    looking at the shop floor or at a customer. */
async function loadProfile() {
  if (!DB.signedIn) { state.profile = null; return; }
  try {
    state.profile = await DB.myProfile();
  } catch (e) {
    state.profile = null;
  }
}

/* ---- The client's own screen: what it is, how much, and a picture ---- */
function clientScreenHtml() {
  const q = state.q.trim().toLowerCase();
  const mine = myClientProducts()
    .filter(p => !q || String(p.name || '').toLowerCase().includes(q));

  let html = searchRowHtml('Search your stock…');

  if (!mine.length) {
    html += '<div class="group"><div class="empty-note">' +
      (q ? 'Nothing matches that.' : 'No stock is allocated to you yet.') +
      '</div></div>';
    return html;
  }

  html += '<div class="client-grid">' + mine.map(p => {
    const low = needsAttention(p);
    return '<div class="client-card">' +
      (p.photo_url
        ? '<img class="client-photo" src="' + escapeHtml(p.photo_url) + '" alt="">'
        : '<div class="client-photo client-photo-ph">' + I.box + '</div>') +
      '<div class="client-body">' +
        '<div class="client-name">' + escapeHtml(p.name) + '</div>' +
        '<div class="client-qty ' + (low ? 'low' : '') + '">' + fmtQty(p.qty) +
          '<span class="client-unit">' + escapeHtml(p.unit || 'ea') + '</span></div>' +
      '</div>' +
    '</div>';
  }).join('') + '</div>';

  html += '<div class="status-line">Stock levels as at ' +
    (DB.lastSync ? escapeHtml(fmtWhen(new Date(DB.lastSync).toISOString())) : 'now') + '.</div>';
  return html;
}

function wireClient(el) {
  wireSearch(el);
}

function openClientAccountSheet() {
  const name = (state.profile && state.profile.clients && state.profile.clients.name) || '';
  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">' + escapeHtml(name || 'Your account') + '</div>' +
    '<div class="sheet-sub">Signed in as ' + escapeHtml((state.profile && state.profile.username) || 'you') + '</div>' +
    '<div class="field-group" style="margin-bottom:14px;">' +
      '<div class="field-row"><span class="fname">Stock shown</span><span class="field-val">' + myClientProducts().length + ' item' + (myClientProducts().length === 1 ? '' : 's') + '</span></div>' +
      '<div class="field-row" data-refreshnow style="cursor:pointer;"><span class="fname" style="color:var(--sys-blue);">Refresh now</span><span class="field-val">' +
        (DB.lastSync ? escapeHtml(fmtWhen(new Date(DB.lastSync).toISOString())) : '—') + '</span></div>' +
    '</div>' +
    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-close type="button">Close</button>' +
      '<button class="sheet-delete" data-signout type="button" style="flex:1;border-radius:var(--r-md);">Sign out</button>' +
    '</div>';
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  sheetEl.querySelector('[data-signout]').addEventListener('click', doSignOut);
  sheetEl.querySelector('[data-refreshnow]').addEventListener('click', async () => { closeSheet(); await refresh(true); });
  openSheet();
}

async function doSignOut() {
  DB.signOut();
  state.profile = null;
  state.products = []; state.movements = []; state.people = []; state.reorderCards = [];
  state.clients = []; state.pickLists = [];
  state.q = '';
  // Signing out returns to the sign-in screen, never to the app. Until the
  // cutover the anon key still reads everything, so dropping a signed-out
  // client back into the app would show them every client's stock.
  state.forceSignIn = true;
  state.signInFrom = 'link';
  state.authError = '';
  closeSheet();
  render();
}

/* ===================== HOME screen ===================== */
function homeScreenHtml() {
  const active = activeProducts();
  const healthy = active.filter(p => !needsAttention(p)).length;
  const lowOnly = active.filter(p => isLow(p) && !isZero(p)).length;
  const out = active.filter(isZero).length;
  const totalUnits = active.reduce((s, p) => s + num(p.qty), 0);
  const attention = active.filter(needsAttention)
    .sort((a, b) => (isZero(b) - isZero(a)) || ((num(b.min_qty) - num(b.qty)) - (num(a.min_qty) - num(a.qty))))
    .slice(0, 3);

  let html = '<div class="qtile-grid">' +
    '<button class="qtile in" data-qk="in" type="button"><span class="qtile-icon">' + I.arrowIn + '</span><span class="qtile-label">Book in</span><span class="qtile-sub">Delivery arrived</span></button>' +
    '<button class="qtile out" data-qk="out" type="button"><span class="qtile-icon">' + I.arrowOut + '</span><span class="qtile-label">Book out</span><span class="qtile-sub">Going to the factory</span></button>' +
    '<button class="qtile count" data-qk="set" type="button"><span class="qtile-icon">' + I.count + '</span><span class="qtile-label">Stock take</span><span class="qtile-sub">Count a rack</span></button>' +
    '<button class="qtile find" data-qk="find" type="button"><span class="qtile-icon">' + I.target + '</span><span class="qtile-label">Find an item</span><span class="qtile-sub">Where is it?</span></button>' +
  '</div>';

  html += '<div class="health-card">' +
    '<div class="health-top"><span class="health-title">Stock health</span><button class="link-btn" data-goreport type="button">Report</button></div>' +
    '<div class="health-bar"><span style="flex:' + Math.max(healthy, 0.0001) + ';background:var(--sys-green)"></span><span style="flex:' + Math.max(lowOnly, 0.0001) + ';background:var(--sys-orange)"></span><span style="flex:' + Math.max(out, 0.0001) + ';background:var(--sys-red)"></span></div>' +
    '<div class="health-legend">' +
      '<span><b style="color:var(--sys-green)">' + healthy + '</b> healthy</span>' +
      '<span><b style="color:var(--sys-orange)">' + lowOnly + '</b> low</span>' +
      '<span><b style="color:var(--sys-red)">' + out + '</b> out</span>' +
      '<span class="hl-units">' + fmtQty(totalUnits) + ' units</span>' +
    '</div></div>';

  html += '<div class="section-title">Order these<button class="link-btn" data-seeall type="button">See all</button></div>';
  html += '<div class="group">';
  if (!attention.length) {
    html += '<div class="empty-note">Nothing needs ordering right now.</div>';
  } else {
    html += attention.map(p => {
      const shortfall = isZero(p) ? 'Out of stock' : 'Short ' + fmtQty(num(p.min_qty) - num(p.qty)) + ' ' + (p.unit || 'ea');
      const card = openCardFor(p.id);
      const action = card
        ? '<span class="meta-chip' + (card.status === 'ordered' ? ' cat' : '') + '">' + (card.status === 'ordered' ? 'On order' : 'On board') + '</span>'
        : '<button class="order-btn" data-order="' + p.id + '" type="button">Order</button>';
      return '<div class="row"><div class="row-body" data-open="' + p.id + '">' +
        '<div class="row-title">' + escapeHtml(p.name) + '</div>' +
        '<div class="row-meta">' + locChipsHtml(p.location) + '<span>' + shortfall + '</span></div>' +
        '</div>' + action + '</div>';
    }).join('');
  }
  html += '</div>';
  return html;
}
function wireHome(el) {
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openProductDetail(b.getAttribute('data-open'))));
  el.querySelectorAll('[data-order]').forEach(b => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    const p = productById(b.getAttribute('data-order'));
    if (!p) return;
    b.disabled = true;
    try {
      await DB.createReorderCard({
        product_id: p.id, status: 'to_order', qty: suggestReorderQty(p),
        supplier: p.pref_supplier || null, created_by: state.me || null
      });
      await refresh();
      toast('Added to reorder board · ' + p.name, 'good');
    } catch (err) {
      b.disabled = false;
      toast(err.message || 'Could not add', 'bad');
    }
  }));
  const goReport = el.querySelector('[data-goreport]');
  if (goReport) goReport.addEventListener('click', () => { state.screen = 'stock'; state.cat = 'Low stock'; render(); });
  const seeAll = el.querySelector('[data-seeall]');
  if (seeAll) seeAll.addEventListener('click', () => { state.screen = 'stock'; state.cat = 'Low stock'; render(); });
  el.querySelectorAll('[data-qk]').forEach(b => b.addEventListener('click', () => {
    const k = b.getAttribute('data-qk');
    if (k === 'find') { state.screen = 'stock'; state.cat = 'All'; state.q = ''; render(); return; }
    if (!activeProducts().length) {
      toast('Add an item to the catalogue first');
      openItemForm(null);
      return;
    }
    openPickProduct(k);
  }));
}

/* ===================== STOCK screen ===================== */
function filteredProducts() {
  const q = state.q.trim().toLowerCase();
  return activeProducts().filter(p => {
    if (state.cat === 'Low stock') { if (!needsAttention(p)) return false; }
    else if (state.cat !== 'All' && (p.category || 'Parts') !== state.cat) return false;
    if (!q) return true;
    return [p.name, p.code, p.location, p.notes, p.category, p.group_name]
      .some(v => String(v || '').toLowerCase().includes(q));
  }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function stockScreenHtml() {
  const list = filteredProducts();

  let html = searchRowHtml('Search name, code or rack…');

  const chips = ['All'].concat(CATEGORIES).concat(['Low stock']);
  html += '<div class="chiprow">' + chips.map(c =>
    '<button class="chip ' + (state.cat === c ? 'active' : '') + '" data-cat="' + escapeHtml(c) + '" type="button">' + c + '</button>').join('') + '</div>';

  html += '<div class="group">';
  if (!activeProducts().length) {
    html += '<div class="empty-note">No products yet. Go to <strong>Items</strong> to add one — a name and rack code is all it takes.</div>';
  } else if (!list.length) {
    html += '<div class="empty-note">Nothing matches. Try a rack code like <strong>A3</strong>.</div>';
  } else {
    html += list.map(productRowHtml).join('');
  }
  html += '</div>';
  html += '<div class="status-line">Swipe a row right to book in, left to book out.</div>';
  return html;
}

function searchRowHtml(placeholder) {
  return '<div class="search-row">' +
    '<span class="search-icon">' + I.search + '</span>' +
    '<input type="search" id="searchInput" placeholder="' + escapeHtml(placeholder) + '" value="' + escapeHtml(state.q) + '" autocomplete="off" autocorrect="off" spellcheck="false">' +
    (state.q ? '<button class="search-clear" id="searchClear" type="button">' + I.x + '</button>' : '') +
    '</div>';
}

function productRowHtml(p) {
  const meta = [];
  if (p.location) meta.push(locChipsHtml(p.location));
  if (p.code) meta.push('<span class="meta-chip code">' + escapeHtml(p.code) + '</span>');
  if (p.category) meta.push('<span class="meta-chip cat">' + escapeHtml(p.category) + '</span>');
  const thumb = p.photo_url
    ? '<img class="thumb" src="' + escapeHtml(p.photo_url) + '" alt="" loading="lazy">'
    : '<span class="thumb-ph">' + I.boxSmall + '</span>';
  return '<div class="swipe-slot" data-slot="' + p.id + '">' +
    '<div class="swipe-bg">' +
      '<span class="swipe-side left">' + I.arrowIn + ' Book in</span>' +
      '<span class="swipe-side right">Book out ' + I.arrowOut + '</span>' +
    '</div>' +
    '<div class="row" data-prow="' + p.id + '">' +
      thumb +
      '<div class="row-body" data-open="' + p.id + '">' +
        '<div class="row-title">' + escapeHtml(p.name) + '</div>' +
        (meta.length ? '<div class="row-meta">' + meta.join('') + '</div>' : '') +
      '</div>' +
      '<span class="qty-pill ' + qtyClass(p) + '"><span class="qn">' + fmtQty(p.qty) + '</span><span class="qu">' + escapeHtml(p.unit || 'ea') + '</span></span>' +
    '</div></div>';
}

function wireStock(el) {
  wireSearch(el);
  el.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
    state.cat = b.getAttribute('data-cat'); render();
  }));
  wireProductRows(el);
}
function wireSearch(el) {
  const input = el.querySelector('#searchInput');
  if (input) {
    input.addEventListener('input', () => {
      state.q = input.value;
      render();
    });
    if (state.q) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }
  const clear = el.querySelector('#searchClear');
  if (clear) clear.addEventListener('click', () => { state.q = ''; render(); });
}
function wireProductRows(el) {
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openProductDetail(b.getAttribute('data-open'))));
  el.querySelectorAll('[data-slot]').forEach(attachSwipe);
}

/* ---- swipe: right = book in, left = book out ---- */
function attachSwipe(slot) {
  const row = slot.querySelector('.row');
  const bg = slot.querySelector('.swipe-bg');
  const id = slot.getAttribute('data-slot');
  slot.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    const startX = e.clientX, startY = e.clientY;
    let dx = 0, axis = null, lastX = startX, lastT = performance.now(), vel = 0;
    const width = row.getBoundingClientRect().width;

    function onMove(ev) {
      const dxRaw = ev.clientX - startX, dyRaw = ev.clientY - startY;
      if (!axis) {
        if (Math.abs(dxRaw) > 10 || Math.abs(dyRaw) > 10) {
          axis = Math.abs(dxRaw) > Math.abs(dyRaw) ? 'x' : 'y';
          if (axis === 'x' && bg) bg.style.opacity = '1';
        } else return;
      }
      if (axis !== 'x') return;
      ev.preventDefault();
      const now = performance.now();
      vel = (ev.clientX - lastX) / Math.max(1, (now - lastT) / 1000);
      lastX = ev.clientX; lastT = now;
      const max = width * 0.55;
      dx = Math.abs(dxRaw) > max ? Math.sign(dxRaw) * max + rubberband(dxRaw - Math.sign(dxRaw) * max, width) : dxRaw;
      row.style.transform = 'translateX(' + dx + 'px)';
    }
    function settle(then) {
      const s = new Spring(dx, { dampingRatio: 0.85, response: 0.24 });
      s.velocity = vel; s.set(0);
      runSpring(s, (v) => { row.style.transform = 'translateX(' + v + 'px)'; },
        () => { row.style.transform = ''; if (bg) bg.style.opacity = '0'; if (then) then(); });
    }
    function onUp() {
      slot.removeEventListener('pointermove', onMove);
      slot.removeEventListener('pointerup', onUp);
      slot.removeEventListener('pointercancel', onUp);
      if (axis !== 'x') return;
      const projected = dx + project(vel);
      if (projected > width * 0.4) { haptic(10); settle(() => openMoveSheet(id, 'in')); }
      else if (projected < -width * 0.4) { haptic(10); settle(() => openMoveSheet(id, 'out')); }
      else settle();
    }
    slot.addEventListener('pointermove', onMove);
    slot.addEventListener('pointerup', onUp);
    slot.addEventListener('pointercancel', onUp);
  });
}

/* ---- press feedback ---- */
document.addEventListener('pointerdown', (e) => {
  const row = e.target.closest('.row, .rack-head, .qtile');
  if (!row) return;
  const spring = new Spring(1, { dampingRatio: 1, response: 0.15 });
  spring.set(0.985);
  runSpring(spring, (v) => { if (!row.style.transform.includes('translateX')) row.style.transform = 'scale(' + v + ')'; });
  const up = () => {
    const s2 = new Spring(0.985, { dampingRatio: 0.8, response: 0.22 });
    s2.set(1);
    runSpring(s2, (v) => { if (!row.style.transform.includes('translateX')) row.style.transform = 'scale(' + v + ')'; },
      () => { if (!row.style.transform.includes('translateX')) row.style.transform = ''; });
    window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
  };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
});

/* ===================== RACKS screen ===================== */
function locationsScreenHtml() {
  const q = state.q.trim().toLowerCase();
  const base = activeProducts();
  const pool = q
    ? base.filter(p => [p.name, p.code, p.location].some(v => String(v || '').toLowerCase().includes(q)))
    : base;

  // letter -> location code -> items. An item that spans several locations is
  // listed under each of them, so it is found wherever someone goes looking.
  const groups = {};
  pool.forEach(p => {
    const codes = locList(p.location);
    if (!codes.length) { ((groups['—'] = groups['—'] || {})[''] = groups['—'][''] || []).push(p); return; }
    codes.forEach(c => {
      const g = locGroup(c);
      groups[g] = groups[g] || {};
      (groups[g][c] = groups[g][c] || []).push(p);
    });
  });
  // Letters first, then anything in the old format, then items with no location.
  const rank = (g) => (g === '—' ? 2 : g === '?' ? 1 : 0);
  const names = Object.keys(groups).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  let html = searchRowHtml('Find a location or an item…');

  if (!names.length) {
    html += '<div class="group"><div class="empty-note">Nothing stored yet. Give each item a location like <strong>A1R1</strong> — and more than one if it spans several — and it will show up here.</div></div>';
    return html;
  }

  html += '<div class="section-title">' + names.length + ' group' + (names.length === 1 ? '' : 's') + '</div>';
  html += names.map(g => {
    const codes = sortLocs(Object.keys(groups[g]).filter(Boolean));
    const items = Array.from(new Set([].concat.apply([], Object.values(groups[g]))));
    const units = items.reduce((s, p) => s + num(p.qty), 0);
    const open = !!state.openRacks[g] || !!q;

    const title = g === '—' ? 'No location set'
      : g === '?' ? 'Old-style locations'
      : codes.length === 1 ? codes[0]
      : codes[0] + ' – ' + codes[codes.length - 1];
    const sub = g === '?'
      ? 'Change these to the A1R1 format'
      : items.length + ' line' + (items.length === 1 ? '' : 's') + ' · ' + fmtQty(units) + ' units' +
        (codes.length ? ' · ' + codes.length + ' location' + (codes.length === 1 ? '' : 's') : '');

    let body = '';
    if (open) {
      body = '<div class="rack-body">';
      (codes.length ? codes : ['']).forEach(c => {
        const here = (groups[g][c] || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
        body += '<div class="loc-label">' + escapeHtml(c || 'No location set') + '</div>';
        here.forEach(p => {
          const elsewhere = sortLocs(p.location).filter(x => x !== c);
          body += '<div class="row">' +
            (p.photo_url ? '<img class="thumb" src="' + escapeHtml(p.photo_url) + '" alt="" loading="lazy">' : '<span class="thumb-ph">' + I.boxSmall + '</span>') +
            '<div class="row-body" data-open="' + p.id + '">' +
              '<div class="row-title">' + escapeHtml(p.name) + '</div>' +
              ((p.code || elsewhere.length)
                ? '<div class="row-meta">' +
                    (p.code ? '<span class="meta-chip code">' + escapeHtml(p.code) + '</span>' : '') +
                    (elsewhere.length ? '<span>also ' + escapeHtml(elsewhere.join(', ')) + '</span>' : '') +
                  '</div>'
                : '') +
            '</div>' +
            '<span class="qty-pill ' + qtyClass(p) + '"><span class="qn">' + fmtQty(p.qty) + '</span><span class="qu">' + escapeHtml(p.unit || 'ea') + '</span></span>' +
            '</div>';
        });
      });
      body += '</div>';
    }

    return '<div class="group" style="margin-bottom:10px;">' +
      '<div class="rack-head" data-rack="' + escapeHtml(g) + '">' +
        '<span class="rack-badge">' + escapeHtml(g) + '</span>' +
        '<div style="flex:1;min-width:0;">' +
          '<div class="rack-name">' + escapeHtml(title) + '</div>' +
          '<div class="rack-sub">' + escapeHtml(sub) + '</div>' +
        '</div>' +
        '<span class="rack-chev ' + (open ? 'open' : '') + '">' + I.chev + '</span>' +
      '</div>' + body + '</div>';
  }).join('');

  return html;
}
function wireLocations(el) {
  wireSearch(el);
  el.querySelectorAll('[data-rack]').forEach(b => b.addEventListener('click', () => {
    const r = b.getAttribute('data-rack');
    state.openRacks[r] = !state.openRacks[r];
    render();
  }));
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openProductDetail(b.getAttribute('data-open'))));
}

/* ===================== ITEMS screen (catalogue management) ===================== */
function itemsScreenHtml() {
  const q = state.q.trim().toLowerCase();
  const list = state.products
    .filter(p => !q || [p.name, p.code, p.group_name, p.category].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  let html = searchRowHtml('Search the catalogue…');
  html += '<button class="new-item-btn" id="newItemBtn" type="button">' + I.plus + '<span>New item</span></button>';

  html += '<div class="group">';
  if (!state.products.length) {
    html += '<div class="empty-note">No items in the catalogue yet. Tap <strong>New item</strong> to add the first one — photo, name and rack code.</div>';
  } else if (!list.length) {
    html += '<div class="empty-note">Nothing matches that.</div>';
  } else {
    html += list.map(p => {
      const sku = orDash(p.code);
      const group = orDash(p.group_name);
      const owner = clientNameOf(p);
      return '<div class="row"><div class="row-body" data-edit="' + p.id + '">' +
        '<div class="row-title">' + escapeHtml(p.name) + (p.dormant ? ' <span class="meta-chip">dormant</span>' : '') + '</div>' +
        '<div class="row-meta"><span class="row-mono">' + sku + ' · ' + group + '</span>' +
          (owner ? '<span class="meta-chip client">' + escapeHtml(owner) + '</span>' : '') + '</div>' +
        '</div>' +
        '<button class="row-trail row-print" data-printcard="' + p.id + '" type="button" title="Print Kanban card">' + I.print + '</button>' +
        '<span class="row-trail edit-pencil">✎</span></div>';
    }).join('');
  }
  html += '</div>';
  return html;
}
function wireItems(el) {
  wireSearch(el);
  const nb = el.querySelector('#newItemBtn');
  if (nb) nb.addEventListener('click', () => openItemForm(null));
  el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const p = productById(b.getAttribute('data-edit'));
    if (p) openItemForm(p);
  }));
  // Print straight from the catalogue row, so a card can be run off without
  // going via the rack screen and opening the item first.
  el.querySelectorAll('[data-printcard]').forEach(b => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const p = productById(b.getAttribute('data-printcard'));
    if (p) openPrintCardSheet(p);
  }));
}

/* ===================== REORDER screen (Kanban signal board) ===================== */
const CARD_STATUS_LABEL = { to_order: 'To order', ordered: 'Ordered', received: 'Received' };

function reorderScreenHtml() {
  const toOrder = state.reorderCards.filter(c => c.status === 'to_order').sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const ordered = state.reorderCards.filter(c => c.status === 'ordered').sort((a, b) => (a.ordered_at || '').localeCompare(b.ordered_at || ''));
  const received = state.reorderCards.filter(c => c.status === 'received').sort((a, b) => (b.received_at || '').localeCompare(a.received_at || '')).slice(0, 15);

  let html = '<button class="new-item-btn" id="newCardBtn" type="button">' + I.plus + '<span>Add item to board</span></button>';

  html += reorderColumnHtml('To order', toOrder, cardToOrderRowHtml, 'Nothing waiting to be ordered. Cards appear here automatically from low stock, or add one yourself.');
  html += reorderColumnHtml('Ordered — awaiting delivery', ordered, cardOrderedRowHtml, 'Nothing on order right now.');
  if (received.length) html += reorderColumnHtml('Recently received', received, cardReceivedRowHtml, '');

  return html;
}
function reorderColumnHtml(title, cards, rowFn, emptyText) {
  let html = '<div class="section-title">' + title + (cards.length ? ' &nbsp;·&nbsp; ' + cards.length : '') + '</div><div class="group">';
  html += cards.length ? cards.map(rowFn).join('') : ('<div class="empty-note">' + emptyText + '</div>');
  html += '</div>';
  return html;
}
function cardMetaBits(c, p) {
  const bits = [];
  if (p && p.location) bits.push(locChipsHtml(p.location));
  bits.push('<span>' + fmtQty(c.qty) + ' ' + escapeHtml((p && p.unit) || 'ea') + '</span>');
  if (c.supplier) bits.push('<span>' + escapeHtml(c.supplier) + '</span>');
  return bits.join('');
}
function cardToOrderRowHtml(c) {
  const p = productById(c.product_id);
  return '<div class="row"><div class="row-body" data-card="' + c.id + '">' +
    '<div class="row-title">' + escapeHtml(cardProductName(c)) + '</div>' +
    '<div class="row-meta">' + cardMetaBits(c, p) + '</div>' +
    '</div><button class="order-btn" data-markordered="' + c.id + '" type="button">Mark ordered</button></div>';
}
function cardOrderedRowHtml(c) {
  const p = productById(c.product_id);
  return '<div class="row"><div class="row-body" data-card="' + c.id + '">' +
    '<div class="row-title">' + escapeHtml(cardProductName(c)) + '</div>' +
    '<div class="row-meta">' + cardMetaBits(c, p) + '<span>ordered ' + fmtWhen(c.ordered_at) + (c.ordered_by ? ' · ' + escapeHtml(c.ordered_by) : '') + '</span></div>' +
    '</div><button class="order-btn" data-markreceived="' + c.id + '" type="button">' + I.truck + ' Received</button></div>';
}
function cardReceivedRowHtml(c) {
  const p = productById(c.product_id);
  return '<div class="row"><div class="row-body" data-card="' + c.id + '" style="opacity:.6;">' +
    '<div class="row-title">' + escapeHtml(cardProductName(c)) + '</div>' +
    '<div class="row-meta">' + cardMetaBits(c, p) + '<span>received ' + fmtWhen(c.received_at) + (c.received_by ? ' · ' + escapeHtml(c.received_by) : '') + '</span></div>' +
    '</div></div>';
}
function wireReorder(el) {
  const nb = el.querySelector('#newCardBtn');
  if (nb) nb.addEventListener('click', openNewReorderPicker);
  el.querySelectorAll('[data-card]').forEach(b => b.addEventListener('click', () => {
    const c = state.reorderCards.find(x => x.id === b.getAttribute('data-card'));
    if (c) openReorderCardSheet(c);
  }));
  el.querySelectorAll('[data-markordered]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); markCardOrdered(b.getAttribute('data-markordered')); }));
  el.querySelectorAll('[data-markreceived]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); markCardReceived(b.getAttribute('data-markreceived')); }));
}

async function markCardOrdered(id) {
  if (!state.me && !DB.signedIn) { openPersonSheet(() => markCardOrdered(id)); return; }
  const c = state.reorderCards.find(x => x.id === id);
  if (!c) return;
  try {
    await DB.updateReorderCard(id, { status: 'ordered', ordered_at: new Date().toISOString(), ordered_by: state.me });
    await refresh();
    toast('Marked ordered · ' + cardProductName(c), 'good');
  } catch (e) { toast(e.message || 'Could not update', 'bad'); }
}
async function markCardReceived(id) {
  if (!state.me && !DB.signedIn) { openPersonSheet(() => markCardReceived(id)); return; }
  const c = state.reorderCards.find(x => x.id === id);
  if (!c) return;
  try {
    await DB.updateReorderCard(id, { status: 'received', received_at: new Date().toISOString(), received_by: state.me });
    await refresh();
    toast('Marked received · ' + cardProductName(c), 'good');
    // Receiving stock is naturally followed by booking it in — jump straight there, pre-filled.
    if (productById(c.product_id)) {
      moveCtx = { id: c.product_id, dir: 'in', amount: num(c.qty) || 1, target: 0, note: 'Reorder delivery' };
      renderMoveSheet();
      openSheet();
    }
  } catch (e) { toast(e.message || 'Could not update', 'bad'); }
}

/* ---- reorder card detail/edit sheet ---- */
function openReorderCardSheet(c) {
  const p = productById(c.product_id);
  const editable = c.status !== 'received';
  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    (p && p.photo_url ? '<img class="photo-hero" src="' + escapeHtml(p.photo_url) + '" alt="">' : '') +
    '<div class="sheet-title">' + escapeHtml(cardProductName(c)) + '</div>' +
    '<div class="sheet-sub">' + CARD_STATUS_LABEL[c.status] + (p && p.location ? ' · ' + escapeHtml(formatLocs(p.location)) : '') + '</div>' +
    (p ? '<div class="detail-qty ' + qtyClass(p) + '" style="margin-bottom:10px;"><span class="dq">' + fmtQty(p.qty) + '</span><span class="du">' + escapeHtml(p.unit || 'ea') + ' currently in stock</span></div>' : '') +
    '<div class="form-card">' +
      (editable
        ? '<label class="form-field"><div class="ff-label">Qty to order</div><input id="cQty" type="number" inputmode="decimal" min="0" value="' + fmtQty(c.qty) + '"></label>' +
          '<label class="form-field"><div class="ff-label">Supplier</div><input id="cSupplier" type="text" value="' + escapeHtml(c.supplier || '') + '" placeholder="Supplier name"></label>' +
          '<label class="form-field"><div class="ff-label">Note</div><input id="cNote" type="text" value="' + escapeHtml(c.note || '') + '" placeholder="Job, order ref…"></label>'
        : '<div class="field-row"><span class="fname">Qty ordered</span><span class="field-val">' + fmtQty(c.qty) + ' ' + escapeHtml((p && p.unit) || 'ea') + '</span></div>' +
          (c.supplier ? '<div class="field-row"><span class="fname">Supplier</span><span class="field-val">' + escapeHtml(c.supplier) + '</span></div>' : '')) +
    '</div>' +
    (c.status !== 'to_order' ? '<div class="field-group" style="margin-bottom:12px;">' +
      (c.ordered_at ? '<div class="field-row"><span class="fname">Ordered</span><span class="field-val">' + fmtWhen(c.ordered_at) + (c.ordered_by ? ' · ' + escapeHtml(c.ordered_by) : '') + '</span></div>' : '') +
      (c.received_at ? '<div class="field-row"><span class="fname">Received</span><span class="field-val">' + fmtWhen(c.received_at) + (c.received_by ? ' · ' + escapeHtml(c.received_by) : '') + '</span></div>' : '') +
    '</div>' : '') +
    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-close type="button">Close</button>' +
      '<button class="sheet-delete" data-remove type="button">' + I.trash + '</button>' +
      (editable ? '<button class="sheet-save" data-save type="button">Save</button>' : '') +
    '</div>';

  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  sheetEl.querySelector('[data-remove]').addEventListener('click', async () => {
    if (!confirm('Remove this card from the reorder board?')) return;
    try { await DB.deleteReorderCard(c.id); closeSheet(); await refresh(); toast('Removed from board', 'good'); }
    catch (e) { toast(e.message || 'Could not remove', 'bad'); }
  });
  const saveBtn = sheetEl.querySelector('[data-save]');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    try {
      await DB.updateReorderCard(c.id, {
        qty: num($('cQty').value), supplier: ($('cSupplier').value || '').trim() || null, note: ($('cNote').value || '').trim() || null
      });
      closeSheet();
      await refresh();
      toast('Saved', 'good');
    } catch (e) {
      saveBtn.disabled = false; saveBtn.textContent = 'Save';
      toast(e.message || 'Could not save', 'bad');
    }
  });
  openSheet();
}

/* ---- manually add a product to the board ---- */
let reorderPickQuery = '';
function openNewReorderPicker() {
  reorderPickQuery = '';
  renderReorderPicker();
  openSheet();
  setTimeout(() => { const i = $('reorderPickSearch'); if (i) i.focus(); }, 80);
}
function renderReorderPicker() {
  const q = reorderPickQuery.trim().toLowerCase();
  const list = activeProducts()
    .filter(p => !openCardFor(p.id))
    .filter(p => !q || [p.name, p.code, p.location].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .slice(0, 40);

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">Add to reorder board</div>' +
    '<div class="sheet-sub">Items already on the board are hidden here.</div>' +
    '<div class="search-row" style="background:var(--bg-elevated-2);">' +
      '<span class="search-icon">' + I.search + '</span>' +
      '<input type="search" id="reorderPickSearch" placeholder="Search items…" value="' + escapeHtml(reorderPickQuery) + '" autocomplete="off">' +
    '</div>' +
    '<div class="group">' +
      (list.length ? list.map(p =>
        '<div class="row"><div class="row-body" data-pickcard="' + p.id + '">' +
          '<div class="row-title">' + escapeHtml(p.name) + '</div>' +
          '<div class="row-meta">' + locChipsHtml(p.location) +
          '<span class="meta-chip">' + fmtQty(p.qty) + ' ' + escapeHtml(p.unit || 'ea') + '</span></div>' +
        '</div><span class="row-trail">' + I.chev + '</span></div>').join('')
        : '<div class="empty-note">Nothing matches, or everything is already on the board.</div>') +
    '</div>' +
    '<div class="sheet-actions"><button class="sheet-cancel" data-close type="button">Cancel</button></div>';

  const input = $('reorderPickSearch');
  input.addEventListener('input', () => {
    reorderPickQuery = input.value;
    const pos = input.selectionStart;
    renderReorderPicker();
    const again = $('reorderPickSearch');
    again.focus();
    try { again.setSelectionRange(pos, pos); } catch (e) {}
  });
  sheetEl.querySelectorAll('[data-pickcard]').forEach(b => b.addEventListener('click', async () => {
    const p = productById(b.getAttribute('data-pickcard'));
    if (!p) return;
    try {
      const card = await DB.createReorderCard({
        product_id: p.id, status: 'to_order', qty: suggestReorderQty(p),
        supplier: p.pref_supplier || null, created_by: state.me || null
      });
      await refresh();
      toast('Added to reorder board · ' + p.name, 'good');
      openReorderCardSheet(state.reorderCards.find(x => x.id === card.id) || Object.assign({}, card, { products: p }));
    } catch (e) { toast(e.message || 'Could not add', 'bad'); }
  }));
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
}

/* ===================== PICKING screen =====================
   Somebody writes down what is needed; somebody else walks the racks and
   fetches it. The picker often has no phone on them, so every list prints
   on one sheet with the rack locations and a box to tick. Ticking lines off
   in the app is the same job done the other way round, and booking the whole
   list out at the end is one tap rather than one booking per line. */

function pickLineName(l) {
  if (l.products && l.products.name) return l.products.name;
  const p = productById(l.product_id);
  return p ? p.name : 'Deleted item';
}
function pickLineUnit(l) {
  if (l.products && l.products.unit) return l.products.unit;
  const p = productById(l.product_id);
  return (p && p.unit) || 'ea';
}
function pickLineLoc(l) {
  if (l.products && l.products.location) return l.products.location;
  const p = productById(l.product_id);
  return (p && p.location) || '';
}
function pickLines(list) {
  // Walk order: by each item's first location, so the picker crosses the yard once.
  return (list.pick_list_items || []).slice().sort((a, b) =>
    locSortKey(firstLoc(pickLineLoc(a))).localeCompare(locSortKey(firstLoc(pickLineLoc(b)))));
}
function pickDone(list) {
  const lines = list.pick_list_items || [];
  return lines.length > 0 && lines.every(l => l.picked);
}

function pickingScreenHtml() {
  const q = state.q.trim().toLowerCase();
  const lists = state.pickLists
    .filter(l => !q || [l.title, l.for_whom].some(v => String(v || '').toLowerCase().includes(q)));
  const open = lists.filter(l => l.status !== 'done');
  const done = lists.filter(l => l.status === 'done');

  let html = searchRowHtml('Search picking lists…');
  html += '<button class="new-item-btn" id="newPickBtn" type="button">' + I.plus + '<span>New picking list</span></button>';

  if (!state.pickLists.length) {
    html += '<div class="group"><div class="empty-note">No picking lists yet. Make one, add what is needed, then print it or hand it to whoever is fetching.</div></div>';
    return html;
  }

  const card = (l) => {
    const lines = l.pick_list_items || [];
    const got = lines.filter(x => x.picked).length;
    const pct = lines.length ? Math.round(got / lines.length * 100) : 0;
    return '<div class="row"><div class="row-body" data-openpick="' + escapeHtml(l.id) + '">' +
        '<div class="row-title">' + escapeHtml(l.title) +
          (l.status === 'done' ? ' <span class="meta-chip good">done</span>' : '') + '</div>' +
        '<div class="row-meta">' +
          (l.for_whom ? '<span>' + escapeHtml(l.for_whom) + '</span>' : '') +
          '<span>' + got + ' of ' + lines.length + ' picked</span>' +
          '<span>' + escapeHtml(fmtWhen(l.created_at)) + '</span>' +
        '</div>' +
        (l.status !== 'done' ? '<div class="pick-bar"><span style="width:' + pct + '%"></span></div>' : '') +
      '</div><span class="row-trail">' + I.chev + '</span></div>';
  };

  if (open.length) {
    html += '<div class="field-label">To pick</div><div class="group">' + open.map(card).join('') + '</div>';
  }
  if (done.length) {
    html += '<div class="field-label" style="margin-top:16px;">Finished</div><div class="group">' + done.map(card).join('') + '</div>';
  }
  if (!open.length && !done.length) {
    html += '<div class="group"><div class="empty-note">Nothing matches that.</div></div>';
  }
  return html;
}

function wirePicking(el) {
  wireSearch(el);
  const nb = el.querySelector('#newPickBtn');
  if (nb) nb.addEventListener('click', openNewPickSheet);
  el.querySelectorAll('[data-openpick]').forEach(b =>
    b.addEventListener('click', () => openPickSheet(b.getAttribute('data-openpick'))));
}

/* ---- Making one ---- */
let pickDraft = null;

function openNewPickSheet() {
  pickDraft = { title: '', for_whom: '', note: '', lines: [], q: '' };
  renderNewPickSheet();
  openSheet();
}

function renderNewPickSheet() {
  const d = pickDraft;
  const q = d.q.trim().toLowerCase();
  const matches = q
    ? activeProducts()
        .filter(p => [p.name, p.code, p.location].some(v => String(v || '').toLowerCase().includes(q)))
        .filter(p => !d.lines.some(l => l.product_id === p.id))
        .slice(0, 8)
    : [];

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">New picking list</div>' +
    '<div class="sheet-sub">What is needed, and who is fetching it.</div>' +
    '<div class="form-card">' +
      '<label class="form-field"><div class="ff-label">What is it for</div>' +
        '<input id="pkTitle" type="text" value="' + escapeHtml(d.title) + '" placeholder="e.g. Job 1042 — oak table run"></label>' +
      '<label class="form-field"><div class="ff-label">Who is fetching it</div>' +
        '<input id="pkFor" type="text" value="' + escapeHtml(d.for_whom) + '" placeholder="e.g. Pieter"></label>' +
    '</div>' +

    '<div class="field-label">Items' + (d.lines.length ? ' · ' + d.lines.length : '') + '</div>' +
    '<div class="group" style="margin-bottom:10px;">' +
      (d.lines.length
        ? d.lines.map(l => {
            const p = productById(l.product_id);
            return '<div class="row"><div class="row-body">' +
              '<div class="row-title">' + escapeHtml(p ? p.name : 'Item') + '</div>' +
              '<div class="row-meta">' + escapeHtml(formatLocs(p && p.location) || 'No location') + ' · ' + fmtQty(p ? p.qty : 0) + ' in stock</div>' +
            '</div>' +
            '<input class="pick-qty" type="number" inputmode="decimal" min="0" step="any" value="' + escapeHtml(l.qty) + '" data-pkqty="' + escapeHtml(l.product_id) + '">' +
            '<button class="row-trail" data-pkdrop="' + escapeHtml(l.product_id) + '" type="button" style="background:none;border:none;color:var(--label-tertiary);cursor:pointer;padding:6px;">' + I.trash + '</button></div>';
          }).join('')
        : '<div class="empty-note">Nothing on the list yet. Search below and tap to add.</div>') +
    '</div>' +

    '<div class="search-row" style="background:var(--bg-elevated-2);">' +
      '<span class="search-icon">' + I.search + '</span>' +
      '<input type="search" id="pkSearch" placeholder="Add an item — name, SKU or rack" value="' + escapeHtml(d.q) + '" autocomplete="off">' +
    '</div>' +
    (matches.length
      ? '<div class="group" style="margin-bottom:10px;">' + matches.map(p =>
          '<div class="row"><div class="row-body" data-pkadd="' + escapeHtml(p.id) + '">' +
            '<div class="row-title">' + escapeHtml(p.name) + '</div>' +
            '<div class="row-meta">' + escapeHtml(formatLocs(p.location) || 'No location') + ' · ' + fmtQty(p.qty) + ' ' + escapeHtml(p.unit || 'ea') + ' in stock</div>' +
          '</div><span class="row-trail">' + I.plus + '</span></div>').join('') + '</div>'
      : (q ? '<div class="empty-note">Nothing matches that.</div>' : '')) +

    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-close type="button">Cancel</button>' +
      '<button class="sheet-save" data-save type="button">Create list</button>' +
    '</div>';

  const search = $('pkSearch');
  search.addEventListener('input', () => { pickDraft.q = search.value; renderNewPickSheet(); });
  $('pkTitle').addEventListener('input', (e) => { pickDraft.title = e.target.value; });
  $('pkFor').addEventListener('input', (e) => { pickDraft.for_whom = e.target.value; });

  sheetEl.querySelectorAll('[data-pkadd]').forEach(b => b.addEventListener('click', () => {
    const id = b.getAttribute('data-pkadd');
    pickDraft.lines.push({ product_id: id, qty: 1 });
    pickDraft.q = '';
    renderNewPickSheet();
  }));
  sheetEl.querySelectorAll('[data-pkqty]').forEach(i => i.addEventListener('input', () => {
    const line = pickDraft.lines.find(l => l.product_id === i.getAttribute('data-pkqty'));
    if (line) line.qty = i.value;
  }));
  sheetEl.querySelectorAll('[data-pkdrop]').forEach(b => b.addEventListener('click', () => {
    pickDraft.lines = pickDraft.lines.filter(l => l.product_id !== b.getAttribute('data-pkdrop'));
    renderNewPickSheet();
  }));
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  sheetEl.querySelector('[data-save]').addEventListener('click', savePickList);

  if (pickDraft.q) { search.focus(); search.setSelectionRange(search.value.length, search.value.length); }
}

async function savePickList() {
  const d = pickDraft;
  d.title = ($('pkTitle').value || '').trim();
  d.for_whom = ($('pkFor').value || '').trim();
  if (!d.title) { $('pkTitle').focus(); toast('Give the list a name'); return; }
  const lines = d.lines.filter(l => num(l.qty) > 0);
  if (!lines.length) { toast('Add at least one item'); return; }

  const btn = sheetEl.querySelector('[data-save]');
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    const list = await DB.createPickList({
      title: d.title, for_whom: d.for_whom || null, created_by: state.me || null
    });
    await DB.addPickItems(list.id, lines.map(l => ({ product_id: l.product_id, qty: num(l.qty) })));
    await refresh();
    toast('Picking list created · ' + d.title, 'good');
    openPickSheet(list.id);
  } catch (e) {
    toast(e.message || 'Could not create that list', 'bad');
    btn.disabled = false; btn.textContent = 'Create list';
  }
}

/* ---- Working one ---- */
function openPickSheet(id) {
  renderPickSheet(id);
  openSheet();
}

function renderPickSheet(id) {
  const list = state.pickLists.find(l => l.id === id);
  if (!list) { closeSheet(); return; }
  const lines = pickLines(list);
  const got = lines.filter(l => l.picked).length;
  const finished = list.status === 'done';

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">' + escapeHtml(list.title) + '</div>' +
    '<div class="sheet-sub">' +
      (list.for_whom ? 'For ' + escapeHtml(list.for_whom) + ' · ' : '') +
      got + ' of ' + lines.length + ' picked' +
      (finished ? ' · finished ' + escapeHtml(fmtWhen(list.done_at)) : '') +
    '</div>' +

    '<div class="group" style="margin-bottom:12px;">' +
      lines.map(l => {
        const p = productById(l.product_id);
        const short = p && num(p.qty) < num(l.qty);
        return '<div class="row pick-row ' + (l.picked ? 'picked' : '') + '">' +
          '<button class="pick-tick ' + (l.picked ? 'on' : '') + '" data-pktick="' + escapeHtml(l.id) + '" type="button" ' + (finished ? 'disabled' : '') + '>' +
            (l.picked ? I.check : '') + '</button>' +
          '<div class="row-body" data-pkitem="' + escapeHtml(l.product_id) + '">' +
            '<div class="row-title">' + escapeHtml(pickLineName(l)) + '</div>' +
            '<div class="row-meta"><span class="row-mono">' + escapeHtml(formatLocs(pickLineLoc(l)) || 'No location') + '</span>' +
              (short ? '<span class="meta-chip warn">only ' + fmtQty(p.qty) + ' in stock</span>' : '') + '</div>' +
          '</div>' +
          '<span class="pick-need">' + fmtQty(l.qty) + '<small>' + escapeHtml(pickLineUnit(l)) + '</small></span>' +
        '</div>';
      }).join('') +
    '</div>' +

    (finished
      ? ''
      : '<div class="sheet-actions" style="margin-bottom:10px;">' +
          '<button class="sheet-cancel" data-pkprint type="button" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;">' + I.print + ' Print list</button>' +
          '<button class="sheet-save" data-pkdone type="button" ' + (got === lines.length && lines.length ? '' : 'disabled') + '>Book out picked</button>' +
        '</div>') +

    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-close type="button">Close</button>' +
      (finished ? '<button class="sheet-cancel" data-pkprint type="button" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;">' + I.print + ' Print</button>' : '') +
      '<button class="sheet-delete" data-pkdel type="button">' + I.trash + '</button>' +
    '</div>';

  sheetEl.querySelectorAll('[data-pktick]').forEach(b => b.addEventListener('click', async () => {
    const lineId = b.getAttribute('data-pktick');
    const line = (list.pick_list_items || []).find(x => x.id === lineId);
    if (!line) return;
    line.picked = !line.picked;          // optimistic: the tick must feel instant
    renderPickSheet(id);
    try { await DB.updatePickItem(lineId, { picked: line.picked }); }
    catch (e) { line.picked = !line.picked; renderPickSheet(id); toast(e.message || 'Could not save that', 'bad'); }
  }));
  sheetEl.querySelectorAll('[data-pkitem]').forEach(b =>
    b.addEventListener('click', () => openProductDetail(b.getAttribute('data-pkitem'))));
  sheetEl.querySelectorAll('[data-pkprint]').forEach(b =>
    b.addEventListener('click', () => printPickList(list)));
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);

  const doneBtn = sheetEl.querySelector('[data-pkdone]');
  if (doneBtn) doneBtn.addEventListener('click', () => finishPickList(list));

  sheetEl.querySelector('[data-pkdel]').addEventListener('click', async () => {
    if (!confirm('Delete "' + list.title + '"? The stock is not touched.')) return;
    try {
      await DB.removePickList(list.id);
      await refresh();
      closeSheet();
      toast('Picking list deleted', 'good');
    } catch (e) { toast(e.message || 'Could not delete that', 'bad'); }
  });
}

/** Booking the whole list out in one go, rather than one movement at a time
    through the move sheet. Each line still lands in the log on its own. */
async function finishPickList(list) {
  const lines = (list.pick_list_items || []).filter(l => l.picked);
  if (!lines.length) return;
  if (!confirm('Book out all ' + lines.length + ' picked item' + (lines.length === 1 ? '' : 's') + '? This takes them off the shelf for good.')) return;

  const btn = sheetEl.querySelector('[data-pkdone]');
  if (btn) { btn.disabled = true; btn.textContent = 'Booking out…'; }
  const failed = [];
  for (const l of lines) {
    try {
      await DB.applyMovement({
        productId: l.product_id, delta: -num(l.qty), reason: 'out',
        person: state.me || '', note: 'Picked · ' + list.title
      });
    } catch (e) { failed.push(pickLineName(l)); }
  }
  try {
    await DB.updatePickList(list.id, { status: 'done', done_at: new Date().toISOString(), done_by: state.me || null });
  } catch (e) { /* the movements are what matter; the flag can be retried */ }
  await refresh();
  closeSheet();
  if (failed.length) toast(failed.length + ' line' + (failed.length === 1 ? '' : 's') + ' did not book out', 'bad');
  else toast('Booked out · ' + list.title, 'good');
}

/* ---- On paper ----
   For whoever is walking the racks without a phone: rack order, big tick
   boxes, and room to write what was actually taken when it differs. */
function pickListHtml(list) {
  const lines = pickLines(list);
  return '<div class="plist">' +
    '<div class="plist-head">' +
      '<div class="plist-title">' + escapeHtml(list.title) + '</div>' +
      '<div class="plist-meta">' +
        (list.for_whom ? '<span><b>For:</b> ' + escapeHtml(list.for_whom) + '</span>' : '') +
        '<span><b>Raised:</b> ' + escapeHtml(fmtWhen(list.created_at)) + (list.created_by ? ' by ' + escapeHtml(list.created_by) : '') + '</span>' +
        '<span><b>Lines:</b> ' + lines.length + '</span>' +
      '</div>' +
    '</div>' +
    '<table class="plist-table">' +
      '<thead><tr>' +
        '<th class="pl-tick">Got</th><th class="pl-loc">Location</th><th>Item</th>' +
        '<th class="pl-sku">SKU</th><th class="pl-qty">Qty</th><th class="pl-took">Taken</th>' +
      '</tr></thead><tbody>' +
      lines.map(l => {
        const p = productById(l.product_id);
        const sku = (l.products && l.products.code) || (p && p.code) || '';
        return '<tr>' +
          '<td class="pl-tick"><span class="pl-box"></span></td>' +
          '<td class="pl-loc">' + (sortLocs(pickLineLoc(l)).map(escapeHtml).join('<br>') || '—') + '</td>' +
          '<td>' + escapeHtml(pickLineName(l)) + '</td>' +
          '<td class="pl-sku">' + escapeHtml(sku) + '</td>' +
          '<td class="pl-qty">' + fmtQty(l.qty) + ' ' + escapeHtml(pickLineUnit(l)) + '</td>' +
          '<td class="pl-took"></td>' +
        '</tr>';
      }).join('') +
    '</tbody></table>' +
    '<div class="plist-foot">' +
      '<div class="plist-sign"><span>Picked by</span></div>' +
      '<div class="plist-sign"><span>Date</span></div>' +
      '<div class="plist-sign"><span>Received by</span></div>' +
    '</div>' +
  '</div>';
}

function printPickList(list) {
  let root = document.getElementById('printRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'printRoot';
    document.body.appendChild(root);
  }
  root.innerHTML = pickListHtml(list);
  window.print();
}

/* ===================== LOG screen (movement history) ===================== */
function activityScreenHtml() {
  const q = state.q.trim().toLowerCase();
  let list = state.movements.slice();
  if (state.actFilter === 'Me' && state.me) list = list.filter(m => m.person === state.me);
  else if (state.actFilter === 'In') list = list.filter(m => num(m.delta) > 0 && m.reason !== 'set');
  else if (state.actFilter === 'Out') list = list.filter(m => num(m.delta) < 0 && m.reason !== 'set');
  if (q) list = list.filter(m => [movementProductName(m), m.person, m.note].some(v => String(v || '').toLowerCase().includes(q)));

  let html = searchRowHtml('Search the log…');
  html += '<div class="chiprow">' + ['All', 'In', 'Out', 'Me'].map(c =>
    '<button class="chip ' + (state.actFilter === c ? 'active' : '') + '" data-act="' + c + '" type="button">' + c + '</button>').join('') + '</div>';

  if (!list.length) {
    html += '<div class="group"><div class="empty-note">Nothing logged yet. Every book-in and book-out lands here with the name of whoever did it.</div></div>';
    return html;
  }

  let lastDay = null;
  list.forEach(m => {
    const k = dayKey(m.created_at);
    if (k !== lastDay) {
      if (lastDay !== null) html += '</div>';
      html += '<div class="section-title">' + escapeHtml(dayLabel(m.created_at)) + '</div><div class="group">';
      lastDay = k;
    }
    const d = num(m.delta);
    const kind = m.reason === 'set' ? 'set' : d > 0 ? 'in' : 'out';
    const label = m.reason === 'set' ? '=' + fmtQty(m.qty_after) : (d > 0 ? '+' : '') + fmtQty(d);
    const bits = [];
    if (m.person) bits.push(escapeHtml(m.person));
    bits.push(fmtWhen(m.created_at));
    if (m.note) bits.push(escapeHtml(m.note));
    html += '<div class="row">' +
      '<span class="act-delta ' + kind + '">' + label + '</span>' +
      '<div class="row-body" data-open="' + escapeHtml(m.product_id) + '">' +
        '<div class="row-title">' + escapeHtml(movementProductName(m)) + '</div>' +
        '<div class="row-meta">' + bits.join(' <span style="opacity:.5">·</span> ') + '</div>' +
      '</div>' +
      '<span class="row-trail" style="font-size:12px;font-variant-numeric:tabular-nums;">' + fmtQty(m.qty_after) + '</span>' +
      '</div>';
  });
  html += '</div>';
  return html;
}
function wireActivity(el) {
  wireSearch(el);
  el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => { state.actFilter = b.getAttribute('data-act'); render(); }));
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => {
    const id = b.getAttribute('data-open');
    if (productById(id)) openProductDetail(id); else toast('That product was removed');
  }));
}

/* ===================== Settings sheet (team & data) ===================== */
/** The Clients row in Settings. Supabase only — local mode has no accounts
    to attach a client to. */
function clientsSettingsRowHtml() {
  const allocated = state.products.filter(p => p.client_id).length;
  return '<div class="field-label">Access</div>' +
    '<div class="group" style="margin-bottom:16px;">' +
      '<div class="row"><span class="thumb-ph">' + I.person + '</span><div class="row-body" data-clients>' +
        '<div class="row-title">Accounts</div>' +
        '<div class="row-meta">' + (state.clients.length
          ? 'Team logins · ' + state.clients.length + ' client' + (state.clients.length === 1 ? '' : 's') + ' · ' + allocated + ' items allocated'
          : 'Team logins, and clients you hold stock for') + '</div>' +
      '</div><span class="row-trail">' + I.chev + '</span></div>' +
      '<div class="row"><span class="thumb-ph">' + I.person + '</span><div class="row-body" data-testlogin>' +
        '<div class="row-title">Sign in / switch account</div>' +
        '<div class="row-meta">Try a login, or sign this device in</div>' +
      '</div><span class="row-trail">' + I.chev + '</span></div>' +
    '</div>';
}

function openSettingsSheet() {
  // A client has no settings. Their only control is the account sheet.
  if (isClientView()) { openClientAccountSheet(); return; }
  const mode = DB.mode === 'supabase' ? 'Shared (Supabase)' : 'Local to this device';
  const sync = DB.lastSync ? fmtWhen(new Date(DB.lastSync).toISOString()) : '—';

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">Settings</div>' +
    '<div class="sheet-sub">You, your team, and this device</div>' +
    '<div class="field-label">You</div><div class="group" style="margin-bottom:16px;">' +
      '<div class="row"><span class="avatar" style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--sys-blue),var(--sys-teal));color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + escapeHtml(initials(state.me || '?')) + '</span>' +
      '<div class="row-body" ' + (DB.signedIn ? '' : 'data-changeme') + '><div class="row-title">' + escapeHtml(state.me || 'Not set') + '</div>' +
      '<div class="row-meta">' + (DB.signedIn
        ? 'Signed in as ' + escapeHtml((state.profile && state.profile.username) || '') + ' · bookings are logged under this name'
        : 'Your bookings are logged under this name') + '</div></div>' +
      (DB.signedIn ? '' : '<span class="row-trail">' + I.chev + '</span>') + '</div>' +
    '</div>' +
    (DB.signedIn ? '' :
    '<div class="field-label">Team<button class="link-btn" data-addperson type="button" style="float:right;">Add person</button></div>' +
    '<div class="group" style="margin-bottom:16px;">' +
    (state.people.length
      ? state.people.map(p =>
          '<div class="row"><span class="avatar" style="width:30px;height:30px;border-radius:50%;background:var(--bg-elevated-3);color:var(--label);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + escapeHtml(initials(p.name)) + '</span>' +
          '<div class="row-body" data-pickperson="' + escapeHtml(p.name) + '"><div class="row-title">' + escapeHtml(p.name) + (p.name === state.me ? ' <span class="meta-chip" style="background:rgba(10,132,255,.2);color:var(--sys-blue)">you</span>' : '') + '</div></div>' +
          '<button class="row-trail" data-delperson="' + p.id + '" style="background:none;border:none;color:var(--label-tertiary);cursor:pointer;padding:6px;">' + I.trash + '</button></div>'
        ).join('')
      : '<div class="empty-note">No names on the list yet. Add everyone who works the store room — no passwords, they just tap their name once.</div>') +
    '</div>') +
    (DB.mode === 'supabase' && isAdmin() ? clientsSettingsRowHtml() : '') +
    '<div class="field-label">Data</div>' +
    '<div class="field-group" style="margin-bottom:4px;">' +
      '<div class="field-row"><span class="fname">Mode</span><span class="field-val">' + mode + '</span></div>' +
      '<div class="field-row"><span class="fname">Last synced</span><span class="field-val">' + escapeHtml(sync) + '</span></div>' +
      '<div class="field-row" data-refresh style="cursor:pointer;"><span class="fname" style="color:var(--sys-blue);">Refresh now</span></div>' +
      '<div class="field-row" data-export style="cursor:pointer;"><span class="fname" style="color:var(--sys-blue);">Export a backup (JSON)</span></div>' +
    '</div>' +
    (DB.signedIn
      ? '<div class="field-group" style="margin-bottom:4px;"><div class="field-row" data-signout style="cursor:pointer;">' +
          '<span class="fname" style="color:var(--sys-red);">Sign out' + ((state.profile && state.profile.username) ? ' (' + escapeHtml(state.profile.username) + ')' : '') + '</span></div></div>'
      : '') +
    '<div class="status-line">Yard Stock · v1.0<br>Add to Home Screen for a full-screen app.</div>' +
    '<div class="sheet-actions"><button class="sheet-cancel" data-close type="button" style="flex:1;">Close</button></div>';

  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  const cl = sheetEl.querySelector('[data-clients]');
  if (cl) cl.addEventListener('click', openAccountsSheet);
  const tl = sheetEl.querySelector('[data-testlogin]');
  if (tl) tl.addEventListener('click', () => {
    state.forceSignIn = true;
    state.signInFrom = 'settings';
    closeSheet();
    render();
  });
  const so = sheetEl.querySelector('[data-signout]');
  if (so) so.addEventListener('click', doSignOut);
  const cm = sheetEl.querySelector('[data-changeme]');
  if (cm) cm.addEventListener('click', () => openPersonSheet());
  const ap = sheetEl.querySelector('[data-addperson]');
  if (ap) ap.addEventListener('click', () => openAddPersonSheet(() => openSettingsSheet()));
  sheetEl.querySelectorAll('[data-pickperson]').forEach(b => b.addEventListener('click', () => {
    setMe(b.getAttribute('data-pickperson')); toast('Signed in as ' + state.me, 'good'); renderHeader(); openSettingsSheet();
  }));
  sheetEl.querySelectorAll('[data-delperson]').forEach(b => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    const id = b.getAttribute('data-delperson');
    const person = state.people.find(p => p.id === id);
    if (!person) return;
    if (!confirm('Remove ' + person.name + ' from the list? Their past bookings stay in the log.')) return;
    try { await DB.removePerson(id); if (state.me === person.name) setMe(''); await refresh(); openSettingsSheet(); }
    catch (err) { toast(err.message || 'Could not remove', 'bad'); }
  }));
  const rf = sheetEl.querySelector('[data-refresh]');
  if (rf) rf.addEventListener('click', async () => { await refresh(true); openSettingsSheet(); });
  const ex = sheetEl.querySelector('[data-export]');
  if (ex) ex.addEventListener('click', exportBackup);
  openSheet();
}

function exportBackup() {
  const data = { exported_at: new Date().toISOString(), products: state.products, movements: state.movements, people: state.people };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'yard-stock-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Backup downloaded', 'good');
}

/* ===================== Accounts: the team, and the clients =====================
   Everyone who uses the app has a username and a password. An Elmos login
   sees the whole app; a client login sees only the items allocated to their
   company. Both are created here, so nobody needs the Supabase dashboard. */

let staffLogins = [];
let clientLogins = [];

async function openAccountsSheet() {
  // Only the boss hands out logins. The row is hidden for everyone else, and
  // this refuses as well, so a stale handler cannot open it.
  if (!isAdmin()) { toast('Only the owner account can manage logins'); return; }
  renderAccountsSheet(true);
  openSheet();
  try { staffLogins = await DB.listStaffLogins(); } catch (e) { staffLogins = []; }
  renderAccountsSheet(false);
}

function renderAccountsSheet(loading) {
  const counts = {};
  state.products.forEach(p => { if (p.client_id) counts[p.client_id] = (counts[p.client_id] || 0) + 1; });
  const site = CFG.SITE_NAME || 'Our team';

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">Accounts</div>' +
    '<div class="sheet-sub">Everyone signs in with a username and password you issue here.</div>' +

    '<div class="field-label">' + escapeHtml(site) + ' — sees everything' +
      '<button class="link-btn" data-addstaff type="button" style="float:right;">Add</button></div>' +
    '<div class="group" style="margin-bottom:16px;">' +
      (loading
        ? '<div class="empty-note">Loading…</div>'
        : staffLogins.length
          ? staffLogins.map(l => loginRowHtml(l)).join('')
          : '<div class="empty-note">No team logins yet. Add yours first, and test it before anything is locked down.</div>') +
    '</div>' +

    '<div class="field-label">Clients — see only their own stock' +
      '<button class="link-btn" data-addclient type="button" style="float:right;">Add client</button></div>' +
    '<div class="group" style="margin-bottom:16px;">' +
      (state.clients.length
        ? state.clients.map(c =>
            '<div class="row"><div class="row-body" data-openclient="' + escapeHtml(c.id) + '">' +
              '<div class="row-title">' + escapeHtml(c.name) + '</div>' +
              '<div class="row-meta">' + (counts[c.id] || 0) + ' item' + ((counts[c.id] || 0) === 1 ? '' : 's') + ' allocated</div>' +
            '</div><span class="row-trail">' + I.chev + '</span></div>').join('')
        : '<div class="empty-note">No clients yet. Add one, then set an item&rsquo;s owner to them on the item screen.</div>') +
    '</div>' +

    '<div class="sheet-actions"><button class="sheet-cancel" data-close type="button" style="flex:1;">Close</button></div>';

  sheetEl.querySelector('[data-close]').addEventListener('click', () => openSettingsSheet());
  sheetEl.querySelector('[data-addclient]').addEventListener('click', openAddClientSheet);
  sheetEl.querySelector('[data-addstaff]').addEventListener('click', () => openAddLoginSheet(null));
  sheetEl.querySelectorAll('[data-openclient]').forEach(b =>
    b.addEventListener('click', () => openClientDetailSheet(b.getAttribute('data-openclient'))));
  wireLoginRows(sheetEl, () => openAccountsSheet());
}

function loginRowHtml(l) {
  const isMe = state.profile && state.profile.id === l.id;
  // The name leads: it is what shows in the header and against every booking
  // in the log. The username is the thing they type, so it comes second.
  return '<div class="row"><div class="row-body" data-editlogin="' + escapeHtml(l.id) + '">' +
      '<div class="row-title">' + escapeHtml(l.label || l.username || 'login') +
        (isMe ? ' <span class="meta-chip" style="background:rgba(10,132,255,.2);color:var(--sys-blue)">you</span>' : '') + '</div>' +
      '<div class="row-meta">' + escapeHtml(l.username || '') + ' · ' +
        (l.role === 'admin' ? 'owner, can create accounts' : l.role === 'staff' ? 'stock only' : 'client') + '</div></div>' +
    (isMe ? '<span class="row-trail"></span>'
          : '<button class="row-trail" data-dellogin="' + escapeHtml(l.id) + '" style="background:none;border:none;color:var(--label-tertiary);cursor:pointer;padding:6px;">' + I.trash + '</button>') +
  '</div>';
}

function wireLoginRows(root, after) {
  root.querySelectorAll('[data-editlogin]').forEach(b => b.addEventListener('click', () => {
    const id = b.getAttribute('data-editlogin');
    const l = staffLogins.concat(clientLogins).find(x => x.id === id);
    if (l) openRenameLoginSheet(l, after);
  }));
  root.querySelectorAll('[data-dellogin]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Remove this login? They will not be able to sign in again.')) return;
    try {
      await DB.removeLogin(b.getAttribute('data-dellogin'));
      toast('Login removed', 'good');
      after();
    } catch (e) { toast(e.message || 'Could not remove that login', 'bad'); }
  }));
}

function openAddClientSheet() {
  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">Add client</div>' +
    '<div class="sheet-sub">Just the name for now &mdash; their logins come next.</div>' +
    '<div class="form-card">' +
      '<label class="form-field"><div class="ff-label">Client name</div>' +
        '<input id="newClientName" type="text" placeholder="e.g. RBF"></label>' +
    '</div>' +
    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-back type="button">Cancel</button>' +
      '<button class="sheet-save" data-save type="button">Add</button>' +
    '</div>';
  sheetEl.querySelector('[data-back]').addEventListener('click', () => openAccountsSheet());
  sheetEl.querySelector('[data-save]').addEventListener('click', async () => {
    const name = ($('newClientName').value || '').trim();
    if (!name) { $('newClientName').focus(); return; }
    const btn = sheetEl.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      await DB.createClient(name);
      state.clients = await DB.listClients();
      toast('Client added · ' + name, 'good');
      openAccountsSheet();
    } catch (e) {
      toast(e.message || 'Could not add that client', 'bad');
      btn.disabled = false; btn.textContent = 'Add';
    }
  });
  setTimeout(() => { const i = $('newClientName'); if (i) i.focus(); }, 80);
}

async function openClientDetailSheet(clientId) {
  const c = state.clients.find(x => x.id === clientId);
  if (!c) { openAccountsSheet(); return; }
  clientLogins = [];
  renderClientDetailSheet(c, true);
  try { clientLogins = await DB.listClientLogins(clientId); } catch (e) { /* shown as none */ }
  renderClientDetailSheet(c, false);
}

function renderClientDetailSheet(c, loading) {
  const items = state.products.filter(p => p.client_id === c.id && !p.archived);
  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">' + escapeHtml(c.name) + '</div>' +
    '<div class="sheet-sub">' + items.length + ' item' + (items.length === 1 ? '' : 's') + ' allocated to them</div>' +

    '<div class="field-label">Logins<button class="link-btn" data-addlogin type="button" style="float:right;">Create login</button></div>' +
    '<div class="group" style="margin-bottom:16px;">' +
      (loading
        ? '<div class="empty-note">Loading…</div>'
        : clientLogins.length
          ? clientLogins.map(l => loginRowHtml(l)).join('')
          : '<div class="empty-note">No login yet. Create one and send them the link, username and password.</div>') +
    '</div>' +

    '<div class="field-label">Their link</div>' +
    '<div class="form-card" style="margin-bottom:16px;">' +
      '<label class="form-field"><div class="ff-label">Send this with their username and password</div>' +
        '<input id="clientLink" type="text" readonly value="' + escapeHtml(clientSignInUrl()) + '"></label>' +
    '</div>' +

    '<div class="field-label">Their items</div>' +
    '<div class="group" style="margin-bottom:16px;">' +
      (items.length
        ? items.slice(0, 12).map(p =>
            '<div class="row"><div class="row-body"><div class="row-title">' + escapeHtml(p.name) + '</div>' +
            '<div class="row-meta">' + fmtQty(p.qty) + ' ' + escapeHtml(p.unit || 'ea') + '</div></div></div>').join('') +
          (items.length > 12 ? '<div class="empty-note">…and ' + (items.length - 12) + ' more.</div>' : '')
        : '<div class="empty-note">Nothing allocated yet. Open an item and set its owner to ' + escapeHtml(c.name) + '.</div>') +
    '</div>' +

    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-back type="button">Back</button>' +
      '<button class="sheet-delete" data-delclient type="button">' + I.trash + '</button>' +
    '</div>';

  sheetEl.querySelector('[data-back]').addEventListener('click', () => openAccountsSheet());
  sheetEl.querySelector('[data-addlogin]').addEventListener('click', () => openAddLoginSheet(c));
  wireLoginRows(sheetEl, () => openClientDetailSheet(c.id));
  sheetEl.querySelector('[data-delclient]').addEventListener('click', async () => {
    if (!confirm('Delete ' + c.name + '? Their items stay, but become our own stock again and their logins stop working.')) return;
    try {
      await DB.removeClient(c.id);
      state.clients = await DB.listClients();
      await refresh();
      openAccountsSheet();
      toast('Client deleted', 'good');
    } catch (e) { toast(e.message || 'Could not delete that client', 'bad'); }
  });
}

/** c is a client, or null for a login on the Elmos team. */
/** Rename an account. The username and password stay as they are — those are
    what the person types, and changing them would strand them. */
function openRenameLoginSheet(l, after) {
  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">' + escapeHtml(l.label || l.username) + '</div>' +
    '<div class="sheet-sub">Signs in as <strong>' + escapeHtml(l.username || '') + '</strong>' +
      (l.role === 'admin' ? ' · owner, can create accounts' : l.role === 'staff' ? ' · sees all stock' : ' · client') + '</div>' +
    '<div class="form-card">' +
      '<label class="form-field"><div class="ff-label">Name</div>' +
        '<input id="renameLabel" type="text" value="' + escapeHtml(l.label || '') + '" placeholder="e.g. Oscar Bekker"></label>' +
    '</div>' +
    '<div class="form-hint">This is what shows in the app and against every booking in the log.</div>' +
    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-back type="button">Cancel</button>' +
      '<button class="sheet-save" data-save type="button">Save</button>' +
    '</div>';

  sheetEl.querySelector('[data-back]').addEventListener('click', after);
  sheetEl.querySelector('[data-save]').addEventListener('click', async () => {
    const name = ($('renameLabel').value || '').trim();
    if (!name) { $('renameLabel').focus(); toast('Give them a name'); return; }
    const btn = sheetEl.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await DB.renameLogin(l.id, name);
      // Renaming yourself has to show up straight away, in the header and on
      // everything you book from here on.
      if (state.profile && state.profile.id === l.id) {
        state.profile.label = name;
        applyProfileIdentity();
        renderHeader();
      }
      toast('Saved · ' + name, 'good');
      after();
    } catch (e) {
      toast(e.message || 'Could not save that', 'bad');
      btn.disabled = false; btn.textContent = 'Save';
    }
  });
  setTimeout(() => { const i = $('renameLabel'); if (i) i.focus(); }, 80);
}

function openAddLoginSheet(c) {

  const staff = !c;
  const site = CFG.SITE_NAME || 'our team';
  // Suggested, not imposed: a password that can be read down a phone line but
  // is not guessable. Only you can change it, so it wants to be something you
  // are content to have written down.
  const suggestion = suggestPassword();

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">' + (staff ? 'New team login' : 'Login for ' + escapeHtml(c.name)) + '</div>' +
    '<div class="sheet-sub">' + (staff
      ? 'Sees the whole app — stock, costs, suppliers, the log.'
      : 'Sees only ' + escapeHtml(c.name) + '&rsquo;s stock: photo, name and quantity.') + '</div>' +
    '<div class="form-card">' +
      '<label class="form-field"><div class="ff-label">Username</div>' +
        '<input id="loginUser" type="text" autocapitalize="off" spellcheck="false" placeholder="' + (staff ? 'e.g. pieter' : 'e.g. rottie') + '"></label>' +
      '<label class="form-field"><div class="ff-label">Password</div>' +
        '<input id="loginPass" type="text" value="' + escapeHtml(suggestion) + '"></label>' +
      '<label class="form-field"><div class="ff-label">Their name</div>' +
        '<input id="loginLabel" type="text" placeholder="' + (staff ? 'e.g. Pieter, store room' : 'e.g. Sipho, purchasing') + '"></label>' +
    '</div>' +
    (staff
      ? '<div class="field-label">Can they create accounts?</div>' +
        '<div class="segmented">' +
          '<button class="seg-btn active" data-newrole="staff" type="button">No — stock only</button>' +
          '<button class="seg-btn" data-newrole="admin" type="button">Yes — another owner</button>' +
        '</div>'
      : '') +
    '<div class="form-hint">Copy the password before you tap Create &mdash; it is not shown again. Usernames are unique across everyone: letters, digits, dots, dashes and underscores.</div>' +
    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-back type="button">Cancel</button>' +
      '<button class="sheet-save" data-save type="button">Create</button>' +
    '</div>';

  // Everyone on the team sees all the stock; this only decides whether they
  // can also hand out logins. Staff is the right answer for almost everyone.
  let newRole = 'staff';
  sheetEl.querySelectorAll('[data-newrole]').forEach(b => b.addEventListener('click', () => {
    newRole = b.getAttribute('data-newrole');
    sheetEl.querySelectorAll('[data-newrole]').forEach(x =>
      x.classList.toggle('active', x.getAttribute('data-newrole') === newRole));
  }));
  sheetEl.querySelector('[data-back]').addEventListener('click', () => staff ? openAccountsSheet() : openClientDetailSheet(c.id));
  sheetEl.querySelector('[data-save]').addEventListener('click', async () => {
    const user = ($('loginUser').value || '').trim();
    const pass = $('loginPass').value || '';
    const label = ($('loginLabel').value || '').trim();
    if (!user) { $('loginUser').focus(); toast('Give them a username'); return; }
    if (pass.length < 8) { $('loginPass').focus(); toast('At least 8 characters'); return; }
    const btn = sheetEl.querySelector('[data-save]');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      await DB.createLogin({
        role: staff ? newRole : 'client',
        clientId: staff ? null : c.id,
        username: user, password: pass, label: label || user
      });
      toast('Login created · ' + user, 'good');
      if (staff) openAccountsSheet(); else openClientDetailSheet(c.id);
    } catch (e) {
      toast(e.message || 'Could not create that login', 'bad');
      btn.disabled = false; btn.textContent = 'Create';
    }
  });
  setTimeout(() => { const i = $('loginUser'); if (i) i.focus(); }, 80);
}

function suggestPassword() {
  // No l/1/O/0 in the alphabet: this gets read out over a phone line.
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const out = new Uint32Array(12);
  crypto.getRandomValues(out);
  return Array.from(out, n => chars[n % chars.length]).join('');
}


/* ===================== Sheet plumbing ===================== */
const scrimEl = $('scrim');
const sheetEl = $('sheet');

/* Only one animation may own the sheet at a time. Without this, a quick
   close-then-open (tapping a name, then straight into a product) leaves two
   springs writing the same transform, and the sheet can end up parked
   off-screen with the scrim still up. Each run takes a ticket; stale runs
   keep stepping but stop painting. */
let sheetAnim = 0;
let scrimAnim = 0;

/** Where the sheet is on its way in or out: 0 fully open, 105 gone. The
    stylesheet turns this into a slide or a fade depending on the screen, so
    nothing here needs to know which. */
function sheetY() {
  const v = parseFloat(sheetEl.style.getPropertyValue('--sheet-t'));
  return isNaN(v) ? 105 : v;
}
function setSheetY(v) {
  sheetEl.style.setProperty('--sheet-t', String(v));
}
function openSheet() {
  scrimEl.style.pointerEvents = 'auto';
  animateOpacity(scrimEl, 1, 220);
  // Starting from wherever the sheet already is means swapping its contents
  // (detail → edit, pick → book) slides nothing: it just stays put.
  const from = sheetY();
  if (from > 1) sheetEl.scrollTop = 0;
  sheetEl.classList.add('open');
  const ticket = ++sheetAnim;
  const s = new Spring(from, { dampingRatio: 0.86, response: 0.34 });
  s.set(0);
  runSpring(s, (v) => { if (ticket === sheetAnim) setSheetY(v); });
}
function closeSheet() {
  // Closing is the one exit every sheet shares, so the camera and any
  // half-finished crop are released here rather than in each caller.
  stopScanner();
  releaseCrop();
  const ticket = ++sheetAnim;
  const s = new Spring(sheetY(), { dampingRatio: 1, response: 0.26 });
  s.set(105);
  runSpring(s, (v) => { if (ticket === sheetAnim) setSheetY(v); },
    () => {
      if (ticket !== sheetAnim) return;
      scrimEl.style.pointerEvents = 'none';
      sheetEl.classList.remove('open');
    });
  animateOpacity(scrimEl, 0, 180);
}
function animateOpacity(el, target, ms) {
  if (REDUCE_MOTION) { el.style.opacity = target; return; }
  const ticket = ++scrimAnim;
  const start = parseFloat(el.style.opacity || 0);
  const t0 = performance.now();
  (function frame(now) {
    if (ticket !== scrimAnim) return;
    const p = Math.min(1, (now - t0) / ms);
    el.style.opacity = start + (target - start) * p;
    if (p < 1) requestAnimationFrame(frame);
  })(performance.now());
}
scrimEl.addEventListener('click', closeSheet);

/* ---- Swipe a sheet down to dismiss it (phones only) ----
   Only where the sheet is a panel against the bottom edge; on a wide screen
   it is a centred dialog with nothing to swipe towards. Touch events rather
   than pointer events because the sheet scrolls: we have to be able to
   preventDefault the moment a downward drag starts at the top of it, or the
   browser rubber-bands instead and the drag never reaches us. */
let sheetDrag = null;

function isBottomSheet() {
  return window.matchMedia('(max-width: 699px)').matches;
}

sheetEl.addEventListener('touchstart', (e) => {
  if (!isBottomSheet() || e.touches.length !== 1) { sheetDrag = null; return; }
  // Only from the top of the sheet's own scroll, or the drag would fight
  // with reading a long form.
  if (sheetEl.scrollTop > 0) { sheetDrag = null; return; }
  // Let a text field keep its own drag-to-select.
  if (e.target.closest('input, textarea, select, .crop-stage, .scan-stage')) { sheetDrag = null; return; }
  sheetDrag = { y0: e.touches[0].clientY, t0: performance.now(), active: false };
}, { passive: true });

sheetEl.addEventListener('touchmove', (e) => {
  if (!sheetDrag || e.touches.length !== 1) return;
  const dy = e.touches[0].clientY - sheetDrag.y0;
  if (!sheetDrag.active) {
    // Upward means they want to scroll; hand it back and stay out of the way.
    if (dy < 8) { if (dy < -4) sheetDrag = null; return; }
    sheetDrag.active = true;
    sheetAnim++;            // cancel any spring still running
  }
  e.preventDefault();
  setSheetY(Math.max(0, dy / sheetEl.offsetHeight * 100));
}, { passive: false });

function endSheetDrag(e) {
  if (!sheetDrag) return;
  const active = sheetDrag.active;
  const touch = e.changedTouches && e.changedTouches[0];
  const dy = touch ? touch.clientY - sheetDrag.y0 : 0;
  const dt = performance.now() - sheetDrag.t0;
  sheetDrag = null;
  if (!active) return;
  // Far enough, or a quick flick: let it go. Otherwise spring back.
  const travelled = dy / sheetEl.offsetHeight * 100;
  if (travelled > 30 || (dy > 50 && dt < 320)) closeSheet();
  else openSheet();
}
sheetEl.addEventListener('touchend', endSheetDrag);
sheetEl.addEventListener('touchcancel', endSheetDrag);

/* ---- Your own account, for anyone who works here ----
   Replaces the old "Who are you?" prompt: the login already says who you are,
   so this just shows it and offers the way out. */
function openMyAccountSheet() {
  const p = state.profile || {};
  const roleLine = p.role === 'admin'
    ? 'Owner — you can create and remove logins'
    : 'Sees all stock, books it in and out';

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">' + escapeHtml(state.me || p.username || 'You') + '</div>' +
    '<div class="sheet-sub">' + escapeHtml(roleLine) + '</div>' +
    '<div class="field-group" style="margin-bottom:14px;">' +
      '<div class="field-row"><span class="fname">Username</span><span class="field-val">' + escapeHtml(p.username || '—') + '</span></div>' +
      '<div class="field-row"><span class="fname">Bookings logged as</span><span class="field-val">' + escapeHtml(state.me || '—') + '</span></div>' +
    '</div>' +
    (p.role === 'admin'
      ? '<button class="link-btn" data-accounts type="button" style="display:block;margin:0 auto 14px;">Manage accounts</button>'
      : '') +
    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-close type="button">Close</button>' +
      '<button class="sheet-delete" data-signout type="button" style="flex:1;border-radius:var(--r-md);">Sign out</button>' +
    '</div>';

  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  sheetEl.querySelector('[data-signout]').addEventListener('click', doSignOut);
  const acc = sheetEl.querySelector('[data-accounts]');
  if (acc) acc.addEventListener('click', openAccountsSheet);
  openSheet();
}

/* ===================== Product detail sheet ===================== */
let detailMore = false;

function openProductDetail(id) {
  const p = productById(id);
  if (!p) { toast('Product not found'); return; }
  detailMore = false;
  renderProductDetail(p);
  openSheet();
}

function renderProductDetail(p) {
  const recent = state.movements.filter(m => m.product_id === p.id).slice(0, 3);

  const morePanel = detailMore
    ? '<div class="field-group" style="margin-bottom:12px;">' +
        (p.notes ? '<div class="field-row" style="display:block;"><div class="row-notes" style="white-space:normal;font-size:13.5px;line-height:1.45;">' + escapeHtml(p.notes) + '</div></div>' : '') +
        '<div class="field-row"><span class="fname">Preferred supplier</span><span class="field-val">' + orDash(p.pref_supplier) + (p.pref_price ? ' · ' + escapeHtml(p.pref_price) : '') + '</span></div>' +
        '<div class="field-row"><span class="fname">Pref MOQ / lead time</span><span class="field-val">' + orDash(p.pref_moq) + ' · ' + orDash(p.pref_lead_time) + '</span></div>' +
        '<div class="field-row"><span class="fname">Secondary supplier</span><span class="field-val">' + orDash(p.sec_supplier) + (p.sec_price ? ' · ' + escapeHtml(p.sec_price) : '') + '</span></div>' +
        '<div class="field-row"><span class="fname">Sec MOQ / lead time</span><span class="field-val">' + orDash(p.sec_moq) + ' · ' + orDash(p.sec_lead_time) + '</span></div>' +
        '<div class="field-row"><span class="fname">Bulk location</span><span class="field-val">' + orDash(p.bulk_location) + '</span></div>' +
        '<div class="field-row"><span class="fname">Place of use</span><span class="field-val">' + orDash(p.place_of_use) + '</span></div>' +
        '<div class="field-row"><span class="fname">Pack size / weight</span><span class="field-val">' + orDash(p.pack_size) + ' · ' + orDash(p.pack_weight) + '</span></div>' +
        '<div class="field-row"><span class="fname">Last updated</span><span class="field-val">' + (p.updated_at ? fmtWhen(p.updated_at) : '—') + '</span></div>' +
        '<div class="field-row"><span class="fname">Dormant</span><span class="field-val">' + (p.dormant ? 'Yes' : 'No') + '</span></div>' +
      '</div>'
    : '';

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    (p.photo_url ? '<img class="photo-hero" src="' + escapeHtml(p.photo_url) + '" alt="">' : '') +
    '<div class="sheet-title">' + escapeHtml(p.name) + '</div>' +
    '<div class="sheet-sub">' + (p.category || 'Parts') + (p.code ? ' · ' + escapeHtml(p.code) : '') + '</div>' +
    '<div class="detail-qty ' + qtyClass(p) + '"><span class="dq">' + fmtQty(p.qty) + '</span><span class="du">' + escapeHtml(p.unit || 'ea') + ' in stock · warn below ' + fmtQty(p.min_qty) + '</span></div>' +
    '<div class="detail-actions">' +
      '<button class="detail-btn in" data-in type="button">' + I.arrowIn + ' Book in</button>' +
      '<button class="detail-btn out" data-out type="button">' + I.arrowOut + ' Book out</button>' +
    '</div>' +
    '<div class="field-group" style="margin-bottom:12px;">' +
      '<div class="field-row"><span class="fname">Owner</span><span class="field-val">' + (clientNameOf(p) ? escapeHtml(clientNameOf(p)) + ' (client stock)' : 'Ours') + '</span></div>' +
      '<div class="field-row"><span class="fname">' + (locList(p.location).length > 1 ? 'Locations' : 'Location') + '</span><span class="field-val" style="color:var(--sys-teal);font-weight:700;font-variant-numeric:tabular-nums;">' + orDash(formatLocs(p.location)) + '</span></div>' +
      '<div class="field-row"><span class="fname">SKU</span><span class="field-val" style="font-family:ui-monospace,Menlo,monospace;">' + orDash(p.code) + '</span></div>' +
      '<div class="field-row"><span class="fname">Group / type</span><span class="field-val">' + orDash(p.group_name) + ' · ' + orDash(p.category) + '</span></div>' +
      '<div class="field-row"><span class="fname">Cost (budget)</span><span class="field-val">' + orDash(p.cost) + '</span></div>' +
    '</div>' +
    '<button class="link-btn" data-more type="button" style="margin-bottom:6px;">' + (detailMore ? '− Hide' : '+ Show') + ' cost, supplier &amp; pack details</button>' +
    morePanel +
    '<div class="sheet-actions" style="margin-top:0;margin-bottom:14px;">' +
      '<button class="sheet-cancel" data-count type="button" style="border-radius:999px;font-weight:700;">Set count</button>' +
      '<button class="sheet-cancel" data-printcard type="button" style="border-radius:999px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;">' + I.print + ' Print card</button>' +
    '</div>' +
    (recent.length ? '<div class="field-label">Last movements</div><div class="group" style="margin-bottom:12px;">' +
      recent.map(m => {
        const d = num(m.delta);
        const kind = m.reason === 'set' ? 'set' : d > 0 ? 'in' : 'out';
        const label = m.reason === 'set' ? '=' + fmtQty(m.qty_after) : (d > 0 ? '+' : '') + fmtQty(d);
        return '<div class="row"><span class="act-delta ' + kind + '">' + label + '</span>' +
          '<div class="row-body" style="cursor:default"><div class="row-title" style="font-size:14.5px">' + escapeHtml(m.person || 'Someone') + '</div>' +
          '<div class="row-meta">' + fmtWhen(m.created_at) + (m.note ? ' <span style="opacity:.5">·</span> ' + escapeHtml(m.note) : '') + '</div></div></div>';
      }).join('') + '</div>' : '') +
    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-close type="button">Close</button>' +
      '<button class="sheet-cancel" data-edit type="button" style="color:var(--sys-blue);font-weight:700;">Edit item</button>' +
    '</div>';

  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  sheetEl.querySelector('[data-in]').addEventListener('click', () => openMoveSheet(p.id, 'in'));
  sheetEl.querySelector('[data-out]').addEventListener('click', () => openMoveSheet(p.id, 'out'));
  sheetEl.querySelector('[data-count]').addEventListener('click', () => openMoveSheet(p.id, 'set'));
  sheetEl.querySelector('[data-edit]').addEventListener('click', () => openItemForm(p));
  sheetEl.querySelector('[data-more]').addEventListener('click', () => { detailMore = !detailMore; renderProductDetail(productById(p.id) || p); });
  sheetEl.querySelector('[data-printcard]').addEventListener('click', () => openPrintCardSheet(p));
}

/* ===================== Printable Kanban card ===================== */
/** Where a scanned card should send a phone: this same app, opened straight
    to the item. index.html reads ?item=<id> on boot and jumps to it. */
function itemDeepLink(p) {
  const url = new URL(location.href);
  url.search = ''; url.hash = '';
  url.searchParams.set('item', p.id);
  return url.toString();
}
/* The four card types, each with the banner colour it ships with. Internal,
   external and manufacture name the card type in the banner and carry the
   item name below it; plain puts the item name in the banner, matching the
   printed template. Banner colours are overridable per type — see kanbanColor. */
const KANBAN_TYPES = {
  internal:    { label: 'Internal KANBAN',    color: '#6B2E1F' },
  external:    { label: 'External KANBAN',    color: '#1E7B34' },
  manufacture: { label: 'Manufacture KANBAN', color: '#1F5FA8' },
  plain:       { label: '',                   color: '#B0301F' }
};
let kanbanType = localStorage.getItem('ys_kanban_type') || 'external';

/* Per-type banner colour the user has picked, keyed by type. Anything not in
   here falls back to the type's shipped colour. */
let kanbanColors = (() => {
  try { return JSON.parse(localStorage.getItem('ys_kanban_colors') || '{}') || {}; }
  catch (e) { return {}; }
})();
function kanbanColor(type) {
  return kanbanColors[type] || (KANBAN_TYPES[type] || KANBAN_TYPES.external).color;
}
function setKanbanColor(type, hex) {
  kanbanColors[type] = hex;
  localStorage.setItem('ys_kanban_colors', JSON.stringify(kanbanColors));
}
/** Black or white banner text, whichever survives on the chosen colour —
    a pale custom banner would swallow white text entirely. */
function bannerInk(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 150 ? '#000' : '#fff';
}

/* 95 x 65mm landscape card: 95x10mm type header, then a 30mm photo/QR rail
   on the left and a 65mm-wide field stack on the right. Every box size and
   font size is fixed in mm/pt in styles.css so it prints true to template. */
function kanbanCardHtml(p) {
  const t = KANBAN_TYPES[kanbanType] || KANBAN_TYPES.external;
  let qrSvg = '';
  try { qrSvg = QR.toSvg(itemDeepLink(p), { dark: '#000' }); } catch (e) { qrSvg = ''; }

  const moq = parseAmountUnit(p.pref_moq, p.unit);
  // A manufacture card is a make signal, so what matters is how long the
  // replacement takes to come off the line, not where the stock gets used.
  const isMfg = kanbanType === 'manufacture';
  const photo = p.photo_url
    ? '<img class="kcard-photo" src="' + escapeHtml(p.photo_url) + '" alt="">'
    : '<div class="kcard-photo kcard-photo-ph">no photo</div>';

  const row = (k, v) => '<div class="kcard-row"><span class="kcard-k">' + k + ':</span><span class="kcard-v">' + v + '</span></div>';

  // Plain cards follow the printed template — item name in the banner, the
  // word KANBAN below it. The named types keep the type in the banner with
  // the item name under it, so a rack of them still reads at a glance.
  const isPlain = kanbanType === 'plain';
  const headText = isPlain ? p.name : t.label;
  const nameText = isPlain ? 'KANBAN' : p.name;
  // Whatever lands in the banner has to fit 95mm on one line — step the 18pt
  // down for the long ones rather than clipping them.
  const headLen = String(headText || '').length;
  const headSize = headLen > 30 ? ' kcard-head-xs' : headLen > 22 ? ' kcard-head-sm' : '';
  const bg = kanbanColor(kanbanType);

  // Re-order qty and MOQ share one row, split down the middle.
  const reorderRow =
    '<div class="kcard-row kcard-row-split">' +
      '<span class="kcard-k">Re-Order QTY:</span>' +
      '<span class="kcard-v">' + fmtQty(p.min_qty) + '</span>' +
      '<span class="kcard-k kcard-k2">MOQ:</span>' +
      '<span class="kcard-v kcard-v2">' + (moq.qty ? escapeHtml(moq.qty) : '—') + '</span>' +
    '</div>';

  return '<div class="kcard">' +
    '<div class="kcard-head' + headSize + '" style="background:' + bg + ';color:' + bannerInk(bg) + '">' + escapeHtml(headText) + '</div>' +
    '<div class="kcard-body">' +
      '<div class="kcard-left">' +
        photo +
        '<div class="kcard-qr">' + (qrSvg || '<span class="kcard-qr-fallback">QR</span>') + '</div>' +
      '</div>' +
      '<div class="kcard-fields">' +
        '<div class="kcard-name' + (isPlain ? ' kcard-name-type' : '') + '">' + escapeHtml(nameText) + '</div>' +
        row('SKU', orDash(p.code)) +
        reorderRow +
        row('Supplier', orDash(p.pref_supplier)) +
        (isMfg ? row('Lead Time', orDash(p.pref_lead_time)) : row('Place of Use', orDash(p.place_of_use))) +
        row('Store Location', orDash(formatLocs(p.location))) +
      '</div>' +
    '</div>' +
  '</div>';
}

function openPrintCardSheet(p) {
  renderPrintCardSheet(p);
  openSheet();
}

/* A handful of presets covers the usual set; the swatch beside them is a
   native colour picker for anything else. Both save per card type. */
const KANBAN_SWATCHES = ['#B0301F', '#6B2E1F', '#1E7B34', '#1F5FA8', '#C9782A', '#5B2D82', '#2B2B2B'];

function renderPrintCardSheet(p) {
  const types = [['internal', 'Internal'], ['external', 'External'], ['manufacture', 'Manufacture'], ['plain', 'Plain']];
  const cur = kanbanColor(kanbanType);
  const isDefault = !kanbanColors[kanbanType];

  sheetEl.innerHTML =
    '<div class="sheet-handle no-print"></div>' +
    '<div class="sheet-title no-print">Print Kanban card</div>' +
    '<div class="sheet-sub no-print">95 &times; 65mm. Turn off "Fit to page" / "Scale" in the print dialog so it prints true size.</div>' +
    '<div class="segmented no-print">' +
      types.map(([k, label]) =>
        '<button class="seg-btn ' + (kanbanType === k ? 'active' : '') + '" data-ktype="' + k + '" type="button">' + label + '</button>').join('') +
    '</div>' +
    '<div class="kcolor-row no-print">' +
      '<span class="kcolor-label">Label colour</span>' +
      KANBAN_SWATCHES.map(c =>
        '<button class="kcolor-dot ' + (c.toLowerCase() === cur.toLowerCase() ? 'active' : '') + '" data-kswatch="' + c + '" style="background:' + c + '" type="button" title="' + c + '"></button>').join('') +
      '<label class="kcolor-custom" title="Pick any colour">' +
        '<input type="color" data-kcolor value="' + cur + '">' +
      '</label>' +
      (isDefault ? '' : '<button class="kcolor-reset" data-kreset type="button">Reset</button>') +
    '</div>' +
    '<div class="print-area">' + kanbanCardHtml(p) + '</div>' +
    '<div class="sheet-actions no-print">' +
      '<button class="sheet-cancel" data-close type="button">Close</button>' +
      '<button class="sheet-save" data-doprint type="button">' + I.print + ' Print</button>' +
    '</div>';

  sheetEl.querySelectorAll('[data-ktype]').forEach(b => b.addEventListener('click', () => {
    kanbanType = b.getAttribute('data-ktype');
    localStorage.setItem('ys_kanban_type', kanbanType);
    renderPrintCardSheet(p);
  }));
  sheetEl.querySelectorAll('[data-kswatch]').forEach(b => b.addEventListener('click', () => {
    setKanbanColor(kanbanType, b.getAttribute('data-kswatch'));
    renderPrintCardSheet(p);
  }));
  const picker = sheetEl.querySelector('[data-kcolor]');
  // Repaint the banner live as the picker is dragged, but only re-render the
  // sheet once it settles — a re-render mid-drag closes the colour picker.
  picker.addEventListener('input', () => paintBanner(picker.value));
  picker.addEventListener('change', () => { setKanbanColor(kanbanType, picker.value); renderPrintCardSheet(p); });
  const reset = sheetEl.querySelector('[data-kreset]');
  if (reset) reset.addEventListener('click', () => {
    delete kanbanColors[kanbanType];
    localStorage.setItem('ys_kanban_colors', JSON.stringify(kanbanColors));
    renderPrintCardSheet(p);
  });
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  sheetEl.querySelector('[data-doprint]').addEventListener('click', () => printKanbanCard(p));
}

function paintBanner(hex) {
  const head = sheetEl.querySelector('.kcard-head');
  if (!head) return;
  head.style.background = hex;
  head.style.color = bannerInk(hex);
}

/** Clone the card to a top-level print container so no transformed ancestor
    can shift it, then hand it to the browser's print dialog. */
function printKanbanCard(p) {
  let root = document.getElementById('printRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'printRoot';
    document.body.appendChild(root);
  }
  root.innerHTML = kanbanCardHtml(p);
  window.print();
}


/* ===================== QR scanner =====================
   Reads the QR printed on a Kanban card and jumps to that item, so a card
   can be actioned without leaving the app. Decoding uses the browser's own
   BarcodeDetector — no library ships with the app. Where that is missing
   (Safari, notably) the sheet says so and points at the phone's Camera app,
   which opens the same deep link the QR carries. */
let scanStream = null;
let scanTicket = 0;

function scannerSupported() {
  return typeof BarcodeDetector !== 'undefined' &&
         !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function openScanSheet() {
  // Scanning lands on a product detail sheet full of costs and suppliers.
  if (isClientView()) return;
  renderScanSheet();
  openSheet();
  if (scannerSupported()) startScanner();
}

function renderScanSheet() {
  const stage = scannerSupported()
    ? '<div class="scan-stage"><video id="scanVideo" playsinline muted autoplay></video><div class="scan-frame"></div></div>' +
      '<div class="scan-status" id="scanStatus">Starting the camera…</div>'
    : '<div class="scan-stage scan-stage-off"><div class="scan-off-note">' +
        'This browser cannot read QR codes inside a page.<br>' +
        'Point the phone\'s own <strong>Camera</strong> app at the card instead — the QR opens this same item.' +
      '</div></div>';

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">Scan a Kanban card</div>' +
    '<div class="sheet-sub">Hold the card\'s QR square inside the frame.</div>' +
    stage +
    '<div class="sheet-actions"><button class="sheet-cancel" data-close type="button">Cancel</button></div>';

  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
}

function setScanStatus(msg) {
  const el = $('scanStatus');
  if (el) el.textContent = msg;
}

async function startScanner() {
  const ticket = ++scanTicket;
  const video = $('scanVideo');
  if (!video) return;

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }
    });
  } catch (e) {
    setScanStatus('No camera. Allow camera access for this site, then try again.');
    return;
  }
  // The sheet may have been closed while the camera was warming up.
  if (ticket !== scanTicket) { stopScanner(); return; }

  video.srcObject = scanStream;
  try { await video.play(); } catch (e) { /* autoplay is best-effort */ }
  setScanStatus('Point at the QR on the card');

  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  // Ten looks a second is plenty and leaves the phone responsive; running
  // this off requestAnimationFrame just burns battery holding a steady card.
  (function tick() {
    if (ticket !== scanTicket) return;
    detector.detect(video)
      .then(codes => {
        if (ticket !== scanTicket) return;
        const hit = codes && codes.length ? codes[0].rawValue : '';
        if (hit) onScanned(hit);
        else setTimeout(tick, 120);
      })
      .catch(() => { if (ticket === scanTicket) setTimeout(tick, 250); });
  })();
}

function stopScanner() {
  scanTicket++;
  if (!scanStream) return;
  scanStream.getTracks().forEach(t => t.stop());
  scanStream = null;
}

/** Pull the item id out of whatever the QR carried — normally the deep link
    this app prints, but a bare id is accepted too. */
function itemIdFromScan(raw) {
  const s = String(raw || '').trim();
  try {
    const v = new URL(s).searchParams.get('item');
    if (v) return v;
  } catch (e) { /* not a URL — fall through */ }
  return /^[0-9a-f-]{20,}$/i.test(s) ? s : '';
}

function onScanned(raw) {
  stopScanner();
  const id = itemIdFromScan(raw);
  if (!id) { toast('That is not a Yard Stock card'); closeSheet(); return; }
  if (!productById(id)) { toast('That item was not found'); closeSheet(); return; }
  if (navigator.vibrate) navigator.vibrate(20);
  openProductDetail(id);
}

/* ===================== Move sheet (book in / out / set) ===================== */
let moveCtx = null;
const MOVE_TITLES = { in: 'Book in', out: 'Book out', set: 'Stock take' };

function openMoveSheet(productId, dir) {
  const p = productById(productId);
  if (!p) { toast('Product not found'); return; }
  // A signed-in device already knows; only a shared one has to ask.
  if (!state.me && !DB.signedIn) { openPersonSheet(() => openMoveSheet(productId, dir)); return; }
  moveCtx = { id: productId, dir: dir || 'out', amount: 1, target: num(p.qty), note: '' };
  renderMoveSheet();
  openSheet();
}

function renderMoveSheet() {
  const p = productById(moveCtx.id);
  if (!p) { closeSheet(); return; }
  const cur = num(p.qty);
  const isSet = moveCtx.dir === 'set';
  const value = isSet ? moveCtx.target : moveCtx.amount;
  const after = isSet ? moveCtx.target : moveCtx.dir === 'in' ? cur + moveCtx.amount : cur - moveCtx.amount;
  const invalid = after < 0 || (!isSet && moveCtx.amount <= 0);

  const quick = isSet ? [] : [1, 2, 5, 10, 25];

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">' + (MOVE_TITLES[moveCtx.dir] || 'Book out') + '</div>' +
    '<div class="sheet-sub">' + escapeHtml(p.name) + (p.location ? ' · ' + escapeHtml(formatLocs(p.location)) : '') + '</div>' +
    '<div class="segmented">' +
      '<button class="seg-btn in ' + (moveCtx.dir === 'in' ? 'active' : '') + '" data-dir="in" type="button">' + I.arrowIn + ' In</button>' +
      '<button class="seg-btn out ' + (moveCtx.dir === 'out' ? 'active' : '') + '" data-dir="out" type="button">' + I.arrowOut + ' Out</button>' +
      '<button class="seg-btn set ' + (isSet ? 'active' : '') + '" data-dir="set" type="button">Set count</button>' +
    '</div>' +
    '<div class="stepper">' +
      '<button class="step-btn" data-minus type="button" ' + (value <= (isSet ? 0 : 1) ? 'disabled' : '') + '>−</button>' +
      '<input class="step-val" id="moveVal" type="number" inputmode="decimal" value="' + value + '" min="0">' +
      '<button class="step-btn" data-plus type="button">+</button>' +
    '</div>' +
    (quick.length ? '<div class="step-quick">' + quick.map(n => '<button class="qbtn" data-quick="' + n + '" type="button">' + (moveCtx.dir === 'in' ? '+' : '−') + n + '</button>').join('') +
      (moveCtx.dir === 'out' && cur > 0 ? '<button class="qbtn" data-quick="all" type="button">All (' + fmtQty(cur) + ')</button>' : '') + '</div>' : '') +
    '<div class="result-line ' + (invalid ? 'bad' : '') + '">' +
      (invalid && after < 0
        ? 'Only ' + fmtQty(cur) + ' ' + escapeHtml(p.unit || 'ea') + ' on the system — book out ' + fmtQty(cur) + ' or less, or use Set count.'
        : cur + ' → <strong>' + fmtQty(after) + ' ' + escapeHtml(p.unit || 'ea') + '</strong>') +
    '</div>' +
    '<div class="field-label">Reference (optional)</div>' +
    '<input type="text" id="moveNote" placeholder="Job number, order, reason…" maxlength="120" value="' + escapeHtml(moveCtx.note) + '">' +
    '<div class="step-quick" style="margin-top:0;margin-bottom:4px;">' +
      ['Job', 'Sold', 'Damaged', 'Returned', 'Stock take'].map(t => '<button class="qbtn" data-note="' + t + '" type="button">' + t + '</button>').join('') +
    '</div>' +
    '<div class="field-group" style="margin-top:12px;">' +
      '<div class="field-row"><span class="fname">Booked by</span><button data-me type="button" style="background:none;border:none;color:var(--sys-blue);font-size:15px;font-weight:600;cursor:pointer;">' + escapeHtml(state.me || 'Choose…') + '</button></div>' +
    '</div>' +
    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-close type="button">Cancel</button>' +
      '<button class="sheet-save ' + (isSet ? '' : moveCtx.dir) + '" data-confirm type="button" ' + (invalid ? 'disabled' : '') + '>' +
        (isSet ? 'Set to ' + fmtQty(moveCtx.target) : moveCtx.dir === 'in' ? 'Book in ' + fmtQty(moveCtx.amount) : 'Book out ' + fmtQty(moveCtx.amount)) +
      '</button>' +
    '</div>' +
    '<div class="status-line">Stamped as ' + escapeHtml(state.me || '—') + ' · needs a connection to save</div>';

  const valEl = $('moveVal');
  function setVal(v, rerender) {
    v = Math.max(0, num(v));
    if (isSet) moveCtx.target = v; else moveCtx.amount = v;
    if (rerender !== false) renderMoveSheet();
  }
  sheetEl.querySelectorAll('[data-dir]').forEach(b => b.addEventListener('click', () => {
    const d = b.getAttribute('data-dir');
    moveCtx.dir = d;
    if (d === 'set') moveCtx.target = cur; else moveCtx.amount = Math.max(1, moveCtx.amount || 1);
    renderMoveSheet();
  }));
  sheetEl.querySelector('[data-minus]').addEventListener('click', () => { haptic(6); setVal(value - 1); });
  sheetEl.querySelector('[data-plus]').addEventListener('click', () => { haptic(6); setVal(value + 1); });
  // No re-render on blur: tapping Confirm blurs the field, and rebuilding the
  // sheet under the finger would swallow that tap.
  valEl.addEventListener('input', () => { if (isSet) moveCtx.target = num(valEl.value); else moveCtx.amount = num(valEl.value); updateMoveResult(); });
  $('moveNote').addEventListener('input', (e) => { moveCtx.note = e.target.value; });
  sheetEl.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => {
    haptic(6);
    const v = b.getAttribute('data-quick');
    setVal(v === 'all' ? cur : num(v));
  }));
  sheetEl.querySelectorAll('[data-note]').forEach(b => b.addEventListener('click', () => {
    const inp = $('moveNote');
    const tag = b.getAttribute('data-note');
    inp.value = inp.value.trim() ? inp.value.trim() + ' · ' + tag : tag;
    moveCtx.note = inp.value;
  }));
  // Signed in, the name is the account's and is not up for grabs.
  const meBtn = sheetEl.querySelector('[data-me]');
  if (meBtn) meBtn.addEventListener('click', () => { if (!DB.signedIn) openPersonSheet(() => renderMoveSheet()); });
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  sheetEl.querySelector('[data-confirm]').addEventListener('click', confirmMove);
}

function updateMoveResult() {
  // Light-touch update while typing so the sheet doesn't rebuild under the keyboard.
  const p = productById(moveCtx.id); if (!p) return;
  const cur = num(p.qty);
  const isSet = moveCtx.dir === 'set';
  const after = isSet ? moveCtx.target : moveCtx.dir === 'in' ? cur + moveCtx.amount : cur - moveCtx.amount;
  const invalid = after < 0 || (!isSet && moveCtx.amount <= 0);
  const line = sheetEl.querySelector('.result-line');
  if (line) {
    line.className = 'result-line' + (invalid ? ' bad' : '');
    line.innerHTML = invalid && after < 0
      ? 'Only ' + fmtQty(cur) + ' on the system — book out less, or use Set count.'
      : cur + ' → <strong>' + fmtQty(after) + ' ' + escapeHtml(p.unit || 'ea') + '</strong>';
  }
  const btn = sheetEl.querySelector('[data-confirm]');
  if (btn) {
    btn.disabled = invalid;
    btn.textContent = isSet ? 'Set to ' + fmtQty(moveCtx.target)
      : moveCtx.dir === 'in' ? 'Book in ' + fmtQty(moveCtx.amount) : 'Book out ' + fmtQty(moveCtx.amount);
  }
}

async function confirmMove() {
  const p = productById(moveCtx.id);
  if (!p) return;
  const cur = num(p.qty);
  const isSet = moveCtx.dir === 'set';
  const delta = isSet ? moveCtx.target - cur : moveCtx.dir === 'in' ? moveCtx.amount : -moveCtx.amount;
  if (!isSet && moveCtx.amount <= 0) return;
  if (cur + delta < 0) return;
  if (isSet && delta === 0) { closeSheet(); return; }

  const note = (($('moveNote') && $('moveNote').value) || moveCtx.note || '').trim();
  const btn = sheetEl.querySelector('[data-confirm]');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    await DB.applyMovement({ productId: p.id, delta, reason: isSet ? 'set' : moveCtx.dir, person: state.me, note });
    haptic(18);
    closeSheet();
    await refresh();
    const verb = isSet ? 'Count set to ' + fmtQty(moveCtx.target) : (delta > 0 ? 'Booked in ' : 'Booked out ') + fmtQty(Math.abs(delta));
    toast(verb + ' · ' + p.name, 'good');
  } catch (e) {
    btn.disabled = false;
    renderMoveSheet();
    toast(e && e.offline ? 'No connection — booking not saved' : (e.message || 'Could not save'), 'bad');
  }
}

/* ===================== Item form (add / edit catalogue entry) ===================== */
let itemDraft = null;

function openItemForm(existing) {
  const p = existing || {};
  const unit = p.unit || 'ea';
  const prefMoq = parseAmountUnit(p.pref_moq, unit);
  const secMoq = parseAmountUnit(p.sec_moq, unit);
  const prefLead = parseAmountUnit(p.pref_lead_time, 'wks');
  const secLead = parseAmountUnit(p.sec_lead_time, 'wks');
  const packSize = parseAmountUnit(p.pack_size, unit);
  const packWeight = parseAmountUnit(p.pack_weight, 'kg');
  itemDraft = {
    id: p.id || null,
    name: p.name || '', code: p.code || '', notes: p.notes || '',
    category: p.category || 'Parts', group_name: p.group_name || '',
    unit, qty: p.id ? num(p.qty) : 0, min_qty: num(p.min_qty) || '', cost: parseMoney(p.cost),
    locs: sortLocs(p.location),
    // The letter the picker starts on: this item's own, so adding a neighbouring
    // location is a two-number job.
    locLetter: (parseLoc(firstLoc(p.location)) || {}).letter || 'A',
    bulk_location: p.bulk_location || '',
    place_of_use: p.place_of_use || '',
    client_id: p.client_id || '',
    pref_supplier: p.pref_supplier || '',
    pref_moq_qty: prefMoq.qty, pref_moq_unit: prefMoq.unit,
    pref_lead_qty: prefLead.qty, pref_lead_unit: prefLead.unit,
    pref_price: parseMoney(p.pref_price),
    sec_supplier: p.sec_supplier || '',
    sec_moq_qty: secMoq.qty, sec_moq_unit: secMoq.unit,
    sec_lead_qty: secLead.qty, sec_lead_unit: secLead.unit,
    sec_price: parseMoney(p.sec_price),
    pack_size_qty: packSize.qty, pack_size_unit: packSize.unit,
    pack_weight_qty: packWeight.qty, pack_weight_unit: packWeight.unit,
    dormant: !!p.dormant,
    photo_url: p.photo_url || '', photoBlob: null
  };
  renderItemForm();
  openSheet();
}

function uniqueValues(field) {
  return Array.from(new Set(state.products.map(p => p[field]).filter(v => v && String(v).trim()))).sort();
}
function formFieldHtml(id, label, value, opts) {
  opts = opts || {};
  const tag = opts.textarea ? 'textarea' : 'input';
  const attrs = opts.textarea
    ? 'rows="2" style="resize:none;"'
    : 'type="' + (opts.type || 'text') + '"' + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + (opts.type === 'number' ? ' min="0"' : '');
  const inner = opts.textarea ? escapeHtml(value) : '';
  const valAttr = opts.textarea ? '' : ' value="' + escapeHtml(value) + '"';
  return '<label class="form-field"><div class="ff-label">' + label + '</div>' +
    '<' + tag + ' id="' + id + '" data-ff="' + id + '" ' + attrs + valAttr +
    (opts.placeholder ? ' placeholder="' + escapeHtml(opts.placeholder) + '"' : '') +
    (opts.mono ? ' style="font-family:ui-monospace,Menlo,monospace;"' : '') + '>' + inner + '</' + tag + '></label>';
}

/** A numeric field with the currency symbol sitting right against the input
    (not just mentioned in the label above it, which was easy to miss) —
    used for Cost and both supplier Price fields. */
function moneyFieldHtml(id, label, value) {
  const sym = (CFG.CURRENCY_SYMBOL || '').trim();
  return '<label class="form-field"><div class="ff-label">' + label + '</div>' +
    '<div class="money-row">' +
      (sym ? '<span class="money-sym">' + escapeHtml(sym) + '</span>' : '') +
      '<input id="' + id + '" data-ff="' + id + '" type="number" inputmode="decimal" min="0" step="0.01" value="' + escapeHtml(value) + '" placeholder="0.00">' +
    '</div></label>';
}

/** A number field paired with a unit select — used for MOQ ("500 ea") and
    lead time ("3 wks") so the on-screen keyboard is the numeric pad, not
    a free-text field a unit word has to be typed into. */
function qtyUnitPairHtml(qtyId, qtyLabel, unitId, unitLabel, qtyVal, unitVal, options) {
  return '<div class="form-field-pair">' +
    '<label class="form-field"><div class="ff-label">' + qtyLabel + '</div>' +
      '<input id="' + qtyId + '" data-ff="' + qtyId + '" type="number" inputmode="decimal" min="0" value="' + escapeHtml(qtyVal) + '" placeholder="0"></label>' +
    '<label class="form-field"><div class="ff-label">' + unitLabel + '</div>' +
      '<select id="' + unitId + '" data-ff="' + unitId + '">' +
        options.map(u => '<option value="' + escapeHtml(u) + '" ' + (unitVal === u ? 'selected' : '') + '>' + u + '</option>').join('') +
      '</select></label>' +
  '</div>';
}

/** What the owner pills mean, spelled out — it is the one field on this form
    that changes who else can see the item. */
function clientHintText(d) {
  if (!d.client_id) return 'Our own stock. Clients cannot see it.';
  const c = state.clients.find(x => x.id === d.client_id);
  return 'Shows on ' + (c ? c.name : 'that client') + "'s own sign-in: name, photo and quantity only — never cost, supplier or rack.";
}

function renderItemForm() {
  const d = itemDraft;
  const editing = !!d.id;
  const groups = uniqueValues('group_name');

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">' + (editing ? 'Edit item' : 'New item') + '</div>' +

    '<div class="photo-tile-wrap">' +
      '<button class="photo-tile" data-photo type="button">' +
        (d.photo_url
          ? '<img src="' + escapeHtml(d.photo_url) + '" alt=""><span class="retake">Retake photo</span>'
          : I.camera + '<span>Take a photo of the item</span>') +
      '</button>' +
      (d.photo_url ? '<button class="photo-crop" data-recrop type="button">Crop</button>' : '') +
    '</div>' +
    // Invisible otherwise: nobody guesses at a drop target.
    (canDropPhotos()
      ? '<div class="photo-hint">Drag a picture in from WhatsApp, or copy it and press Ctrl+V</div>'
      : '') +

    '<div class="form-section-label">Basics</div>' +
    '<div class="form-card">' +
      formFieldHtml('fName', 'Item name', d.name, { placeholder: 'e.g. Oak leg, turned 430mm' }) +
      formFieldHtml('fCode', 'SKU', d.code, { placeholder: 'e.g. LG-430', mono: true }) +
      formFieldHtml('fNotes', 'Description', d.notes, { textarea: true, placeholder: 'Short description' }) +
    '</div>' +

    '<div class="form-section-label">Whose stock is this?</div>' +
    '<div class="pill-grid" style="margin-bottom:4px;">' +
      '<button class="pill-btn ' + (!d.client_id ? 'active' : '') + '" data-setclient="" type="button">Ours</button>' +
      state.clients.map(c =>
        '<button class="pill-btn ' + (d.client_id === c.id ? 'active' : '') + '" data-setclient="' + escapeHtml(c.id) + '" type="button">' + escapeHtml(c.name) + '</button>').join('') +
    '</div>' +
    '<div class="form-hint" id="clientHint">' + clientHintText(d) + '</div>' +

    '<div class="form-section-label">Group &amp; category</div>' +
    '<div class="form-card">' + formFieldHtml('fGroup', 'Group', d.group_name, { placeholder: 'e.g. Timber' }) + '</div>' +
    (groups.length ? '<div class="chip-wrap">' + groups.map(g => '<button class="pill-btn pill-sm" data-setgroup="' + escapeHtml(g) + '" type="button">' + escapeHtml(g) + '</button>').join('') + '</div>' : '') +
    '<div class="pill-grid" style="margin-top:6px;">' + CATEGORIES.map(c =>
      '<button class="pill-btn ' + (d.category === c ? 'active' : '') + '" data-pcat="' + escapeHtml(c) + '" type="button">' + c + '</button>').join('') + '</div>' +

    '<div class="form-section-label">Stock levels</div>' +
    '<div class="form-card">' +
      '<div class="form-field-pair">' +
        (editing
          ? '<div class="form-field"><div class="ff-label">Current qty</div><div class="ff-readonly">' + fmtQty(d.qty) + ' ' + escapeHtml(d.unit) + ' · use Set count to change</div></div>'
          : formFieldHtml('fQty', 'Starting qty', d.qty, { type: 'number', inputmode: 'decimal' })) +
        '<label class="form-field"><div class="ff-label">Unit</div><select id="fUnit" data-ff="fUnit">' + UNITS.map(u => '<option value="' + u + '" ' + (d.unit === u ? 'selected' : '') + '>' + u + '</option>').join('') + '</select></label>' +
      '</div>' +
      formFieldHtml('fMin', 'Reorder qty (min stock)', d.min_qty, { type: 'number', inputmode: 'decimal', placeholder: 'Warn when stock drops below this' }) +
      moneyFieldHtml('fCost', 'Cost (budget price)', d.cost) +
    '</div>' +

    '<div class="form-section-label">Location</div>' +
    '<div class="locpick">' +
      '<div class="loc-chips" id="locChips">' + locEditChipsHtml(d.locs) + '</div>' +
      // Laid out the way the code reads — letter, number, R, number — so the
      // format explains itself without a label on every box.
      '<div class="locpick-row">' +
        '<select id="lLetter" aria-label="Letter">' +
          'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(x => '<option' + (d.locLetter === x ? ' selected' : '') + '>' + x + '</option>').join('') +
        '</select>' +
        '<input id="lNum" type="number" inputmode="numeric" min="1" max="999" placeholder="1" aria-label="Number">' +
        '<span class="locpick-r">R</span>' +
        '<input id="lRackNo" type="number" inputmode="numeric" min="1" max="999" placeholder="1" aria-label="Rack">' +
        '<button class="locpick-add" data-locadd type="button">Add</button>' +
      '</div>' +
      '<div class="locpick-hint" id="locHint">For example A1R1. Add more than one if it spans several.</div>' +
    '</div>' +
    '<div class="form-card" style="margin-top:10px;">' +
      formFieldHtml('fBulk', 'Bulk location', d.bulk_location, { placeholder: 'e.g. Yard 2, bay 4' }) +
      formFieldHtml('fPlaceUse', 'Place of use', d.place_of_use, { placeholder: 'e.g. Assembly line 2' }) +
    '</div>' +

    '<div class="form-section-label">Preferred supplier</div>' +
    '<div class="form-card">' +
      formFieldHtml('fPrefSupplier', 'Supplier', d.pref_supplier, { placeholder: 'Supplier name' }) +
      qtyUnitPairHtml('fPrefMoqQty', 'MOQ', 'fPrefMoqUnit', 'Unit', d.pref_moq_qty, d.pref_moq_unit, UNITS) +
      qtyUnitPairHtml('fPrefLeadQty', 'Lead time', 'fPrefLeadUnit', 'Period', d.pref_lead_qty, d.pref_lead_unit, LEAD_UNITS) +
      moneyFieldHtml('fPrefPrice', 'Price', d.pref_price) +
    '</div>' +

    '<div class="form-section-label">Secondary supplier</div>' +
    '<div class="form-card">' +
      formFieldHtml('fSecSupplier', 'Supplier', d.sec_supplier, { placeholder: 'Supplier name (optional)' }) +
      qtyUnitPairHtml('fSecMoqQty', 'MOQ', 'fSecMoqUnit', 'Unit', d.sec_moq_qty, d.sec_moq_unit, UNITS) +
      qtyUnitPairHtml('fSecLeadQty', 'Lead time', 'fSecLeadUnit', 'Period', d.sec_lead_qty, d.sec_lead_unit, LEAD_UNITS) +
      moneyFieldHtml('fSecPrice', 'Price', d.sec_price) +
    '</div>' +

    '<div class="form-section-label">Packing &amp; status</div>' +
    '<div class="form-card">' +
      qtyUnitPairHtml('fPackSizeQty', 'Pack size', 'fPackSizeUnit', 'Unit', d.pack_size_qty, d.pack_size_unit, UNITS) +
      qtyUnitPairHtml('fPackWeightQty', 'Pack weight', 'fPackWeightUnit', 'Unit', d.pack_weight_qty, d.pack_weight_unit, WEIGHT_UNITS) +
      '<div class="dormant-row"><span class="fname">Dormant</span><div class="segmented segmented-sm">' +
        '<button class="seg-btn ' + (!d.dormant ? 'active' : '') + '" data-dormant="0" type="button">No</button>' +
        '<button class="seg-btn ' + (d.dormant ? 'active' : '') + '" data-dormant="1" type="button">Yes</button>' +
      '</div></div>' +
    '</div>' +

    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-close type="button">Cancel</button>' +
      (editing ? '<button class="sheet-delete" data-delete type="button">' + I.trash + '</button>' : '') +
      '<button class="sheet-save" data-save type="button">' + (editing ? 'Save' : 'Create item') + '</button>' +
    '</div>';

  sheetEl.querySelectorAll('[data-ff]').forEach(e => e.addEventListener('input', () => {
    const key = e.getAttribute('data-ff');
    const map = { fName: 'name', fCode: 'code', fNotes: 'notes', fGroup: 'group_name', fQty: 'qty', fUnit: 'unit',
      fMin: 'min_qty', fCost: 'cost', fBulk: 'bulk_location', fPlaceUse: 'place_of_use', fPrefSupplier: 'pref_supplier',
      fPrefMoqQty: 'pref_moq_qty', fPrefMoqUnit: 'pref_moq_unit', fPrefLeadQty: 'pref_lead_qty', fPrefLeadUnit: 'pref_lead_unit',
      fPrefPrice: 'pref_price', fSecSupplier: 'sec_supplier',
      fSecMoqQty: 'sec_moq_qty', fSecMoqUnit: 'sec_moq_unit', fSecLeadQty: 'sec_lead_qty', fSecLeadUnit: 'sec_lead_unit',
      fSecPrice: 'sec_price',
      fPackSizeQty: 'pack_size_qty', fPackSizeUnit: 'pack_size_unit',
      fPackWeightQty: 'pack_weight_qty', fPackWeightUnit: 'pack_weight_unit' };
    if (map[key]) d[map[key]] = e.value;
  }));
  wireLocPicker(d);
  sheetEl.querySelectorAll('[data-pcat]').forEach(b => b.addEventListener('click', () => {
    d.category = b.getAttribute('data-pcat');
    sheetEl.querySelectorAll('[data-pcat]').forEach(x => x.classList.toggle('active', x.getAttribute('data-pcat') === d.category));
  }));
  // Toggling classes rather than re-rendering: this sits halfway down a long
  // form, and a re-render would throw the user back to the top of it.
  sheetEl.querySelectorAll('[data-setclient]').forEach(b => b.addEventListener('click', () => {
    d.client_id = b.getAttribute('data-setclient') || '';
    sheetEl.querySelectorAll('[data-setclient]').forEach(x =>
      x.classList.toggle('active', (x.getAttribute('data-setclient') || '') === d.client_id));
    const hint = $('clientHint');
    if (hint) hint.textContent = clientHintText(d);
  }));
  sheetEl.querySelectorAll('[data-setgroup]').forEach(b => b.addEventListener('click', () => { d.group_name = b.getAttribute('data-setgroup'); $('fGroup').value = d.group_name; }));
  sheetEl.querySelectorAll('[data-dormant]').forEach(b => b.addEventListener('click', () => {
    d.dormant = b.getAttribute('data-dormant') === '1';
    sheetEl.querySelectorAll('[data-dormant]').forEach(x => x.classList.toggle('active', (x.getAttribute('data-dormant') === '1') === d.dormant));
  }));
  sheetEl.querySelector('[data-photo]').addEventListener('click', capturePhoto);
  const recropBtn = sheetEl.querySelector('[data-recrop]');
  if (recropBtn) recropBtn.addEventListener('click', recropPhoto);
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  sheetEl.querySelector('[data-save]').addEventListener('click', saveItem);
  const del = sheetEl.querySelector('[data-delete]');
  if (del) del.addEventListener('click', deleteItem);
}

function locEditChipsHtml(locs) {
  if (!locs.length) return '<span class="loc-none">No location yet</span>';
  return locs.map(c =>
    '<span class="loc-chip' + (parseLoc(c) ? '' : ' old') + '"' + (parseLoc(c) ? '' : ' title="Old format — remove it and add the A1R1 version"') + '>' +
      escapeHtml(c) +
      '<button type="button" data-locdel="' + escapeHtml(c) + '" aria-label="Remove ' + escapeHtml(c) + '">×</button>' +
    '</span>').join('');
}

/** Only the chips and the hint are redrawn, never the whole form: this sits
    halfway down a long sheet, and a full re-render would jump back to the top
    and drop the keyboard between one location and the next. */
function wireLocPicker(d) {
  const chips = $('locChips'), hint = $('locHint');
  const letter = $('lLetter'), n = $('lNum'), rack = $('lRackNo');

  const say = (msg, bad) => { hint.textContent = msg; hint.classList.toggle('bad', !!bad); };
  const redraw = () => { chips.innerHTML = locEditChipsHtml(d.locs); wireChips(); };
  const wireChips = () => chips.querySelectorAll('[data-locdel]').forEach(b => b.addEventListener('click', () => {
    d.locs = d.locs.filter(x => x !== b.getAttribute('data-locdel'));
    redraw();
    say(d.locs.length ? 'Removed.' : 'For example A1R1. Add more than one if it spans several.');
  }));

  const add = () => {
    const code = buildLoc(letter.value, n.value, rack.value);
    if (!code) { say('Fill in both numbers — for example ' + letter.value + '1R1.', true); (n.value ? rack : n).focus(); return; }
    if (d.locs.includes(code)) { say(code + ' is already on this item.', true); return; }
    d.locs = sortLocs(d.locs.concat(code));
    d.locLetter = letter.value;
    redraw();
    n.value = ''; rack.value = '';
    say('Added ' + code + '.');
    n.focus();
  };

  letter.addEventListener('change', () => { d.locLetter = letter.value; });
  sheetEl.querySelector('[data-locadd]').addEventListener('click', add);
  rack.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  n.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); rack.focus(); } });
  wireChips();
}

/** Numbers typed into the picker but never added would otherwise be lost on
    Save — the easiest mistake to make with a separate Add button. */
function takePendingLoc(d) {
  const letter = $('lLetter'), n = $('lNum'), rack = $('lRackNo');
  if (!letter || !n || !rack) return;
  const code = buildLoc(letter.value, n.value, rack.value);
  if (code && !d.locs.includes(code)) d.locs = sortLocs(d.locs.concat(code));
}


/* ===================== Photo cropper =====================
   A square crop, because the photo is shown at three different shapes — the
   16:10 tile and hero in the app, and the 10:9 box on the printed card. A
   square covers all three with the least surprise. Drag to pan, pinch or
   slide to zoom; the frame is the stage itself, so what you see is the crop.

   The square is the shape that gets saved, but it no longer forces anything
   to be thrown away: the zoom winds out past "fill the frame" all the way to
   "the whole photo fits", and the slack around it is filled white. Before
   that, a portrait photo always lost its top and bottom whatever you did.

   Rotate turns the photo in 90° steps. Everything below works in the photo's
   rotated dimensions — see cropDims — so a quarter turn needs no special
   cases in the pan, zoom or clamp maths. */
let cropCtx = null;

/** The photo's dimensions the right way up for the current rotation: a
    quarter turn swaps them. All the pan/zoom maths is in these, never in
    naturalWidth/naturalHeight directly. */
function cropDims() {
  const c = cropCtx;
  const quarter = (c.rot % 180) !== 0;
  return {
    w: quarter ? c.img.naturalHeight : c.img.naturalWidth,
    h: quarter ? c.img.naturalWidth : c.img.naturalHeight
  };
}

async function openCropSheet(source, onDone) {
  releaseCrop();
  const isBlob = source instanceof Blob;
  const url = isBlob ? URL.createObjectURL(source) : source;
  const img = new Image();
  // A photo already uploaded lives on another origin; without this the canvas
  // is tainted and toBlob throws when the crop is applied.
  if (!isBlob) img.crossOrigin = 'anonymous';
  img.style.maxWidth = 'none';

  try {
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  } catch (e) {
    if (isBlob) URL.revokeObjectURL(url);
    toast(isBlob ? 'Could not open that photo'
                 : 'That photo cannot be re-cropped here — retake it instead', 'bad');
    return;
  }

  cropCtx = { img, url, revoke: isBlob, onDone, zoom: 1, tx: 0, ty: 0, base: 1, minZoom: 1, rot: 0, stage: 0, pointers: new Map() };
  renderCropSheet();
  openSheet();
}

function releaseCrop() {
  if (!cropCtx) return;
  if (cropCtx.revoke) URL.revokeObjectURL(cropCtx.url);
  cropCtx = null;
}

function renderCropSheet() {
  const c = cropCtx;
  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">Crop photo</div>' +
    '<div class="sheet-sub">Drag to move, pinch or slide to zoom. Wind the zoom all the way down to fit the whole photo in. The square is what gets saved.</div>' +
    '<div class="crop-stage" id="cropStage"></div>' +
    '<div class="crop-zoom-row">' +
      '<span class="crop-zoom-mark">' + I.search + '</span>' +
      // min is a placeholder: the real floor depends on the photo's shape and
      // is only known once the stage has been measured. See layoutCrop.
      '<input type="range" id="cropZoom" min="0.1" max="5" step="0.01" value="' + c.zoom + '">' +
      '<button class="crop-rotate" data-croprotate type="button" title="Rotate" aria-label="Rotate the photo a quarter turn">' + I.rotate + '</button>' +
    '</div>' +
    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-cropcancel type="button">Cancel</button>' +
      '<button class="sheet-save" data-cropdone type="button">Use photo</button>' +
    '</div>';

  const stage = $('cropStage');
  stage.appendChild(c.img);
  // The stage has no width until it is in the layout, so measure on the next frame.
  requestAnimationFrame(layoutCrop);

  stage.addEventListener('pointerdown', onCropDown);
  stage.addEventListener('pointermove', onCropMove);
  stage.addEventListener('pointerup', onCropUp);
  stage.addEventListener('pointercancel', onCropUp);
  stage.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const r = stage.getBoundingClientRect();
    zoomCrop(c.zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });

  $('cropZoom').addEventListener('input', (ev) => {
    const half = c.stage / 2;
    zoomCrop(parseFloat(ev.target.value), half, half);
  });
  sheetEl.querySelector('[data-croprotate]').addEventListener('click', () => {
    c.rot = (c.rot + 90) % 360;
    // Re-centre on the turn. A quarter turn leaves the scale alone (both the
    // cover and fit scales are computed off the short and long edge, which
    // only swap), so only the framing needs settling again.
    layoutCrop();
  });
  sheetEl.querySelector('[data-cropcancel]').addEventListener('click', () => {
    const done = cropCtx.onDone;
    releaseCrop();
    done(null);
  });
  sheetEl.querySelector('[data-cropdone]').addEventListener('click', applyCrop);
}

function layoutCrop() {
  const stage = $('cropStage');
  if (!stage || !cropCtx) return;
  const c = cropCtx;
  c.stage = stage.clientWidth;
  const d = cropDims();
  // Zoom 1 is still "cover" — the scale that fills the square — so opening a
  // photo frames it the way it always did. The slider now reaches below 1,
  // down to the scale where the whole photo fits inside the square.
  c.base = Math.max(c.stage / d.w, c.stage / d.h);
  c.minZoom = Math.min(c.stage / d.w, c.stage / d.h) / c.base;
  if (c.zoom < c.minZoom) c.zoom = c.minZoom;
  const s = c.base * c.zoom;
  c.tx = (c.stage - d.w * s) / 2;
  c.ty = (c.stage - d.h * s) / 2;
  clampCrop();
  paintCrop();
  syncZoomSlider();
}

/** The slider's floor is per-photo, so it can only be set once the photo and
    the stage have both been measured. */
function syncZoomSlider() {
  const slider = $('cropZoom');
  if (!slider || !cropCtx) return;
  slider.min = cropCtx.minZoom;
  slider.value = cropCtx.zoom;
}

function clampCrop() {
  const c = cropCtx, s = c.base * c.zoom;
  const d = cropDims();
  const dw = d.w * s, dh = d.h * s;
  // Zoomed out past "fill the frame" the photo is smaller than the stage on
  // one axis or both. Centre it on those axes — clamping it as if it were
  // larger would jam it against an edge and pile all the white on one side.
  c.tx = dw <= c.stage ? (c.stage - dw) / 2 : Math.min(0, Math.max(c.stage - dw, c.tx));
  c.ty = dh <= c.stage ? (c.stage - dh) / 2 : Math.min(0, Math.max(c.stage - dh, c.ty));
}

function paintCrop() {
  const c = cropCtx, s = c.base * c.zoom;
  const W = c.img.naturalWidth, H = c.img.naturalHeight;
  // CSS applies these right to left, so the photo is turned first and then
  // nudged back: rotating about the origin swings it off into negative space,
  // and each quarter turn needs a different shove to put its corner at 0,0.
  const nudge = { 0: [0, 0], 90: [H, 0], 180: [W, H], 270: [0, W] }[c.rot] || [0, 0];
  c.img.style.transform =
    'translate(' + c.tx + 'px,' + c.ty + 'px) scale(' + s + ') ' +
    'translate(' + nudge[0] + 'px,' + nudge[1] + 'px) rotate(' + c.rot + 'deg)';
}

/** Zoom about a point in stage coordinates, so whatever is under the fingers
    (or the cursor) stays put rather than the image sliding away from them. */
function zoomCrop(next, fx, fy) {
  const c = cropCtx;
  next = Math.max(c.minZoom, Math.min(5, next));
  const ratio = next / c.zoom;
  c.tx = fx - (fx - c.tx) * ratio;
  c.ty = fy - (fy - c.ty) * ratio;
  c.zoom = next;
  clampCrop();
  paintCrop();
  const slider = $('cropZoom');
  if (slider && parseFloat(slider.value) !== next) slider.value = next;
}

function cropPointList() {
  return Array.from(cropCtx.pointers.values());
}
function onCropDown(ev) {
  if (!cropCtx) return;
  ev.currentTarget.setPointerCapture(ev.pointerId);
  cropCtx.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  cropCtx.gesture = null;
}
function onCropMove(ev) {
  if (!cropCtx || !cropCtx.pointers.has(ev.pointerId)) return;
  const c = cropCtx;
  const prev = cropPointList();
  c.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  const now = cropPointList();

  if (now.length === 1) {
    c.tx += now[0].x - prev[0].x;
    c.ty += now[0].y - prev[0].y;
    clampCrop();
    paintCrop();
    return;
  }
  if (now.length < 2) return;
  const dist = (pts) => Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  const was = dist(prev), is = dist(now);
  if (!was) return;
  const rect = $('cropStage').getBoundingClientRect();
  const midX = (now[0].x + now[1].x) / 2 - rect.left;
  const midY = (now[0].y + now[1].y) / 2 - rect.top;
  zoomCrop(c.zoom * (is / was), midX, midY);
}
function onCropUp(ev) {
  if (!cropCtx) return;
  cropCtx.pointers.delete(ev.pointerId);
}

/** The photo with its rotation baked in, as something drawImage can read
    exactly like the original. Turning and cropping in a single drawImage
    would mean carrying the source rectangle through the rotation by hand;
    doing the turn first leaves the crop maths identical to the unrotated
    case, which is worth one throwaway canvas. */
function rotatedSource() {
  const c = cropCtx;
  if (!c.rot) return c.img;
  const d = cropDims();
  const cv = document.createElement('canvas');
  cv.width = d.w; cv.height = d.h;
  const x = cv.getContext('2d');
  x.translate(d.w / 2, d.h / 2);
  x.rotate(c.rot * Math.PI / 180);
  x.drawImage(c.img, -c.img.naturalWidth / 2, -c.img.naturalHeight / 2);
  return cv;
}

async function applyCrop() {
  const c = cropCtx;
  const btn = sheetEl.querySelector('[data-cropdone]');
  btn.disabled = true; btn.textContent = 'Working…';
  const s = c.base * c.zoom;
  const side = c.stage / s;                     // source pixels covered by the frame
  const out = Math.max(240, Math.min(CFG.PHOTO_MAX_PX || 1400, Math.round(side)));
  const canvas = document.createElement('canvas');
  canvas.width = out; canvas.height = out;
  const ctx = canvas.getContext('2d');
  // Zoomed out, the frame reaches past the edges of the photo. White rather
  // than transparent: these get printed onto Kanban cards, and a transparent
  // JPEG comes out black.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(rotatedSource(), -c.tx / s, -c.ty / s, side, side, 0, 0, out, out);

  let blob = null;
  try {
    blob = await new Promise((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('no blob')), 'image/jpeg', CFG.PHOTO_QUALITY || 0.82));
  } catch (e) {
    // A cross-origin photo the storage host will not share taints the canvas.
    toast('That photo cannot be re-cropped here — retake it instead', 'bad');
  }
  const done = c.onDone;
  releaseCrop();
  done(blob);
}

/* ---- photo capture ---- */
function capturePhoto() {
  const input = $('photoInput');
  input.value = '';
  const onChange = async () => {
    input.removeEventListener('change', onChange);
    const file = input.files && input.files[0];
    if (!file) return;
    // Straight into the cropper. The crop resizes to PHOTO_MAX_PX and re-encodes
    // as JPEG on its way out, so there is no separate compression pass — a second
    // pass would only be a lossier trip over the same pixels.
    openCropSheet(file, (blob) => {
      if (blob) usePhotoBlob(blob);
      renderItemForm();
    });
  };
  input.addEventListener('change', onChange);
  input.click();
}

/** Re-crop what is already on the draft, without making the user retake it. */
function recropPhoto() {
  const d = itemDraft;
  const source = d.photoBlob || d.photo_url;
  if (!source) { capturePhoto(); return; }
  openCropSheet(source, (blob) => {
    if (blob) usePhotoBlob(blob);
    renderItemForm();
  });
}

function usePhotoBlob(blob) {
  const d = itemDraft;
  if (d.photoBlob && d.photo_url && d.photo_url.startsWith('blob:')) URL.revokeObjectURL(d.photo_url);
  d.photoBlob = blob;
  d.photo_url = URL.createObjectURL(blob);
}

/* ---- Photos from outside the app: dropped in, or pasted ----
   On the floor the camera is the way in, but at a desk the photo is
   usually already on screen — in WhatsApp, in an email from the supplier —
   and saving it to Downloads just to pick it back out again is a chore.
   Both routes land in the same cropper the camera does.

   Pasting is the one to trust. Dragging out of WhatsApp Desktop hands over
   a real file and works; dragging out of WhatsApp *Web* only offers a blob:
   URL belonging to WhatsApp's own origin, which this page is not allowed to
   read, and no amount of trying will change that. Copy the image and press
   Ctrl+V and both of them work.

   Dropping an image on a page normally navigates the browser to it, which
   would throw away a half-filled item form. So a drop anywhere on the app is
   swallowed whether or not there is anywhere to put it. */

/** The item form is the only place a photo can land. Both halves of this
    matter: closeSheet leaves the markup where it is and only drops the
    'open' class, so the photo tile alone would still be sitting there long
    after the form was dismissed — and a photo would land on a draft nobody
    is editing any more. */
function itemFormOpen() {
  return sheetEl.classList.contains('open') && !!sheetEl.querySelector('[data-photo]');
}

/** Worth intercepting? Files covers a drag from Explorer or WhatsApp
    Desktop; uri-list covers an image dragged off a web page. Plain text
    dragged about inside the app carries neither, and is left alone. */
function draggingAPhoto(dt) {
  if (!dt || !dt.types) return false;
  const types = Array.from(dt.types);
  return types.indexOf('Files') !== -1 || types.indexOf('text/uri-list') !== -1;
}

/** An image out of a drop or a paste. Real files arrive on .files; a
    clipboard image arrives only as an item, so both are worth a look. */
function imageFromTransfer(dt) {
  if (!dt) return null;
  const files = dt.files;
  if (files) {
    for (let i = 0; i < files.length; i++) {
      if (files[i].type && files[i].type.indexOf('image/') === 0) return files[i];
    }
  }
  if (dt.items) {
    for (let i = 0; i < dt.items.length; i++) {
      const it = dt.items[i];
      if (it.kind === 'file' && it.type && it.type.indexOf('image/') === 0) {
        const f = it.getAsFile();
        if (f) return f;
      }
    }
  }
  return null;
}

/** Last resort for an image dragged off a web page: fetch it ourselves.
    Only http(s) is worth trying — a blob: or data: URL from another origin
    is unreadable here — and even then the site has to allow it. */
async function fetchDraggedImage(url) {
  if (!/^https?:/i.test(url)) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return (blob.type && blob.type.indexOf('image/') === 0) ? blob : null;
  } catch (e) {
    return null;
  }
}

function photoFromOutside(blob) {
  openCropSheet(blob, (out) => {
    if (out) usePhotoBlob(out);
    renderItemForm();
  });
}

/** Only worth telling someone about drag and paste if they have a mouse. */
function canDropPhotos() {
  try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; }
  catch (e) { return false; }
}

let dragDepth = 0;
function paintDropTarget(on) {
  const tile = sheetEl.querySelector('[data-photo]');
  if (tile) tile.classList.toggle('dropping', on);
}

document.addEventListener('dragenter', (e) => {
  if (!draggingAPhoto(e.dataTransfer)) return;
  dragDepth++;
  if (itemFormOpen()) paintDropTarget(true);
});
document.addEventListener('dragleave', (e) => {
  if (!draggingAPhoto(e.dataTransfer)) return;
  // dragenter on a child fires before dragleave on the parent, so count the
  // nesting rather than clearing the highlight on the first leave.
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) paintDropTarget(false);
});
document.addEventListener('dragover', (e) => {
  if (!draggingAPhoto(e.dataTransfer)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('drop', (e) => {
  if (!draggingAPhoto(e.dataTransfer)) return;
  e.preventDefault();
  dragDepth = 0;
  paintDropTarget(false);

  // A DataTransfer is only readable while the event is being handled, so
  // take what is needed off it before anything is awaited.
  const file = imageFromTransfer(e.dataTransfer);
  const url = (e.dataTransfer.getData('text/uri-list') || '').split('\n')[0].trim();

  if (!itemFormOpen()) {
    toast('Open an item first, then drop the photo onto it');
    return;
  }
  if (file) { photoFromOutside(file); return; }
  if (!url) { toast('That did not come through as a picture', 'bad'); return; }

  fetchDraggedImage(url).then(blob => {
    if (blob) photoFromOutside(blob);
    // The WhatsApp Web case, and any site that will not share its images.
    else toast('Could not read that one — copy the image and press Ctrl+V instead', 'bad');
  });
});

document.addEventListener('paste', (e) => {
  if (!itemFormOpen()) return;
  const file = imageFromTransfer(e.clipboardData);
  // No image on the clipboard means this is an ordinary text paste into a
  // field, which must be left alone.
  if (!file) return;
  e.preventDefault();
  photoFromOutside(file);
});

async function saveItem() {
  const d = itemDraft;
  takePendingLoc(d);
  d.name = ($('fName').value || '').trim();
  if (!d.name) { $('fName').focus(); toast('Give it a name first'); return; }

  const btn = sheetEl.querySelector('[data-save]');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    let photoUrl = d.photo_url;
    if (d.photoBlob) {
      btn.textContent = 'Uploading photo…';
      photoUrl = await DB.uploadPhoto(d.photoBlob, d.id || undefined);
    }
    const payload = {
      name: d.name, code: (d.code || '').trim(), notes: (d.notes || '').trim(),
      category: d.category, group_name: (d.group_name || '').trim() || null,
      location: formatLocs(d.locs) || null, unit: d.unit,
      min_qty: num(d.min_qty), cost: formatMoney(d.cost),
      bulk_location: (d.bulk_location || '').trim() || null,
      place_of_use: (d.place_of_use || '').trim() || null,
      client_id: d.client_id || null,
      pref_supplier: (d.pref_supplier || '').trim() || null,
      pref_moq: formatAmountUnit(d.pref_moq_qty, d.pref_moq_unit),
      pref_lead_time: formatAmountUnit(d.pref_lead_qty, d.pref_lead_unit),
      pref_price: formatMoney(d.pref_price),
      sec_supplier: (d.sec_supplier || '').trim() || null,
      sec_moq: formatAmountUnit(d.sec_moq_qty, d.sec_moq_unit),
      sec_lead_time: formatAmountUnit(d.sec_lead_qty, d.sec_lead_unit),
      sec_price: formatMoney(d.sec_price),
      pack_size: formatAmountUnit(d.pack_size_qty, d.pack_size_unit),
      pack_weight: formatAmountUnit(d.pack_weight_qty, d.pack_weight_unit),
      dormant: !!d.dormant, photo_url: photoUrl || null
    };
    if (d.id) {
      await DB.updateProduct(d.id, payload);
    } else {
      payload.qty = num(d.qty);
      payload.__person = state.me;
      await DB.createProduct(payload);
    }
    closeSheet();
    await refresh();
    toast(d.id ? 'Saved · ' + d.name : 'Item created · ' + d.name, 'good');
  } catch (e) {
    btn.disabled = false; btn.textContent = d.id ? 'Save' : 'Create item';
    toast(e && e.offline ? 'No connection — not saved' : (e.message || 'Could not save'), 'bad');
  }
}

async function deleteItem() {
  const d = itemDraft;
  if (!d.id) return;
  if (!confirm('Remove "' + d.name + '" from the catalogue?\n\nIts movement history is kept.')) return;
  try {
    await DB.deleteProduct(d.id);
    closeSheet();
    await refresh();
    toast('Removed', 'good');
  } catch (e) {
    toast(e.message || 'Could not remove', 'bad');
  }
}

/* ===================== Person sheets ===================== */
function openPersonSheet(afterPick) {
  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">Who are you?</div>' +
    '<div class="sheet-sub">Tap your name. This phone remembers it, and every booking gets logged under it.</div>' +
    '<div class="pill-grid">' +
      state.people.map(p => '<button class="pill-btn ' + (p.name === state.me ? 'active' : '') + '" data-person="' + escapeHtml(p.name) + '" type="button">' + escapeHtml(p.name) + '</button>').join('') +
      '<button class="pill-btn" data-newperson type="button" style="color:var(--sys-blue);font-weight:700;">+ Add a name</button>' +
    '</div>' +
    (state.people.length ? '' : '<div class="empty-note" style="padding:0 2px 10px;">Nobody on the list yet — add yourself to get going.</div>') +
    '<div class="sheet-actions"><button class="sheet-cancel" data-close type="button">Cancel</button></div>';

  sheetEl.querySelectorAll('[data-person]').forEach(b => b.addEventListener('click', () => {
    setMe(b.getAttribute('data-person'));
    haptic(10);
    renderHeader();
    if (afterPick) afterPick(); else { closeSheet(); render(); }
  }));
  sheetEl.querySelector('[data-newperson]').addEventListener('click', () => openAddPersonSheet(afterPick));
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  openSheet();
}

function openAddPersonSheet(afterPick) {
  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">Add a name</div>' +
    '<div class="sheet-sub">Everyone who books stock in or out of the store room.</div>' +
    '<input type="text" id="newPersonName" placeholder="Full name" maxlength="60" autocomplete="name">' +
    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-close type="button">Cancel</button>' +
      '<button class="sheet-save" data-add type="button">Add</button>' +
    '</div>';
  const input = $('newPersonName');
  setTimeout(() => input.focus(), 60);
  const submit = async () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const btn = sheetEl.querySelector('[data-add]');
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      await DB.addPerson(name);
      setMe(name);
      await refresh();
      if (afterPick) afterPick(); else closeSheet();
      toast('Hello, ' + name.split(/\s+/)[0], 'good');
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Add';
      toast(e.message || 'Could not add', 'bad');
    }
  };
  sheetEl.querySelector('[data-add]').addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  openSheet();
}

/* ===================== FAB action sheet ===================== */
function openFabSheet() {
  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">What are you doing?</div>' +
    '<div class="sheet-sub">' + (state.me ? 'Logged as ' + escapeHtml(state.me) : 'Pick your name first') + '</div>' +
    '<div class="detail-actions">' +
      '<button class="detail-btn in" data-pickin type="button">' + I.arrowIn + ' Book in</button>' +
      '<button class="detail-btn out" data-pickout type="button">' + I.arrowOut + ' Book out</button>' +
    '</div>' +
    '<div class="group" style="margin-top:6px;">' +
      '<div class="row"><span class="thumb-ph">' + I.pick + '</span><div class="row-body" data-newpick>' +
        '<div class="row-title">New picking list</div><div class="row-meta">What to fetch, and who is fetching it</div></div>' +
        '<span class="row-trail">' + I.chev + '</span></div>' +
      '<div class="row"><span class="thumb-ph">' + I.plus + '</span><div class="row-body" data-newitem>' +
        '<div class="row-title">New item</div><div class="row-meta">Photo, name and a rack code</div></div>' +
        '<span class="row-trail">' + I.chev + '</span></div>' +
    '</div>' +
    '<div class="sheet-actions"><button class="sheet-cancel" data-close type="button">Cancel</button></div>';
  sheetEl.querySelector('[data-pickin]').addEventListener('click', () => openPickProduct('in'));
  sheetEl.querySelector('[data-pickout]').addEventListener('click', () => openPickProduct('out'));
  sheetEl.querySelector('[data-newpick]').addEventListener('click', openNewPickSheet);
  sheetEl.querySelector('[data-newitem]').addEventListener('click', () => openItemForm(null));
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  openSheet();
}

let pickQuery = '';
function openPickProduct(dir) {
  pickQuery = '';
  renderPickProduct(dir);
  openSheet();
  setTimeout(() => { const i = $('pickSearch'); if (i) i.focus(); }, 80);
}
function renderPickProduct(dir) {
  const q = pickQuery.trim().toLowerCase();
  const list = activeProducts()
    .filter(p => !q || [p.name, p.code, p.location].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .slice(0, 40);

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">' + (MOVE_TITLES[dir] || 'Book out') + '</div>' +
    '<div class="sheet-sub">Which item? Search by name, code or rack.</div>' +
    '<div class="search-row" style="background:var(--bg-elevated-2);">' +
      '<span class="search-icon">' + I.search + '</span>' +
      '<input type="search" id="pickSearch" placeholder="e.g. oak leg, A3.1" value="' + escapeHtml(pickQuery) + '" autocomplete="off">' +
    '</div>' +
    '<div class="group">' +
      (list.length ? list.map(p =>
        '<div class="row"><div class="row-body" data-pick="' + p.id + '">' +
          '<div class="row-title">' + escapeHtml(p.name) + '</div>' +
          '<div class="row-meta">' + locChipsHtml(p.location) +
          '<span class="meta-chip">' + fmtQty(p.qty) + ' ' + escapeHtml(p.unit || 'ea') + '</span></div>' +
        '</div><span class="row-trail">' + I.chev + '</span></div>').join('')
        : '<div class="empty-note">Nothing matches that.</div>') +
    '</div>' +
    '<div class="sheet-actions"><button class="sheet-cancel" data-close type="button">Cancel</button></div>';

  const input = $('pickSearch');
  input.addEventListener('input', () => {
    pickQuery = input.value;
    const pos = input.selectionStart;
    renderPickProduct(dir);
    const again = $('pickSearch');
    again.focus();
    try { again.setSelectionRange(pos, pos); } catch (e) {}
  });
  sheetEl.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => openMoveSheet(b.getAttribute('data-pick'), dir)));
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
}

/* ===================== Init ===================== */
$('fabAdd').innerHTML = I.plus;
$('fabAdd').addEventListener('click', () => { if (!state.loading && !isClientView()) openFabSheet(); });
$('navMe').addEventListener('click', () => {
  // The login already says who you are; only a device with no account on it
  // still has to ask.
  if (isClientView()) openClientAccountSheet();
  else if (DB.signedIn) openMyAccountSheet();
  else openPersonSheet();
});
$('navScan').innerHTML = I.scan;
$('navScan').addEventListener('click', openScanSheet);
$('navGear').innerHTML = I.gear;
$('navGear').addEventListener('click', () => openSettingsSheet());

window.addEventListener('online', () => { DB.online = true; refresh(); });
window.addEventListener('offline', () => { DB.online = false; render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !state.loading) refresh(); });

(async function boot() {
  // Read before the first render: ?login decides which screen opens.
  if (new URLSearchParams(location.search).has('login')) {
    state.forceSignIn = true;
    state.signInFrom = 'link';
  }
  render();
  await DB.init();
  // Who is signed in decides which of the three shapes the app takes, so this
  // has to settle before anything is fetched.
  await loadProfile();
  // Nobody signed in and no account anywhere: this is a brand new install and
  // somebody has to be able to make the first login.
  if (!DB.signedIn) state.needsSetup = !(await DB.anyStaffAccounts());
  const mode = appMode();
  if (mode === 'signin' || mode === 'setup') { state.loading = false; render(); return bootServiceWorker(); }
  await refresh();

  // A scanned Kanban card lands here as ?item=<id> — jump straight to it,
  // then scrub the URL so refreshing the page later doesn't reopen it.
  const deepLinkId = new URLSearchParams(location.search).get('item');
  if (deepLinkId) history.replaceState(null, '', location.pathname);

  if (isClientView()) {
    // Nothing to ask a client: no name to pick, and cards deep-link to a
    // detail sheet full of costs and suppliers they should not see.
    bootServiceWorker();
    return;
  }

  applyProfileIdentity();
  // "Who are you?" is for a shared phone with no accounts on it. Signing in
  // has already answered the question.
  if (!state.me && !DB.signedIn) {
    openPersonSheet(deepLinkId ? () => openDeepLinkedItem(deepLinkId) : undefined);
  } else if (deepLinkId) {
    openDeepLinkedItem(deepLinkId);
  }

  bootServiceWorker();
})();

function bootServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
function openDeepLinkedItem(id) {
  if (productById(id)) openProductDetail(id);
  else toast('That item was not found');
}

})();
