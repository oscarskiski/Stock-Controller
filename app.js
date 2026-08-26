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
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>'
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

/* ---- location helpers: "A3.1.1" = rack A, bay 3, level 1, position 1 ---- */
function parseLoc(s) {
  const m = /^([A-Za-z]{1,2})\s*(\d+)(?:[.\-](\d+))?(?:[.\-](\d+))?$/.exec(String(s || '').trim());
  if (!m) return null;
  return { rack: m[1].toUpperCase(), bay: m[2], level: m[3] || '', pos: m[4] || '' };
}
function buildLoc(rack, bay, level, pos) {
  if (!rack || !bay) return '';
  let s = rack.toUpperCase() + bay;
  if (level) s += '.' + level;
  if (level && pos) s += '.' + pos;
  return s;
}
function rackOf(loc) { const p = parseLoc(loc); return p ? p.rack : (loc ? '?' : ''); }
function locSortKey(loc) {
  const p = parseLoc(loc);
  if (!p) return 'zzz' + String(loc || '');
  return p.rack + String(p.bay).padStart(4, '0') + String(p.level || '0').padStart(4, '0') + String(p.pos || '0').padStart(4, '0');
}

const CATEGORIES = ['Parts', 'Unfinished', 'Finished', 'Materials', 'Other'];
const UNITS = ['ea', 'set', 'pair', 'box', 'pack', 'm', 'm²', 'kg', 'litre'];

/* ===================== State ===================== */
const state = {
  screen: 'stock',
  products: [],
  movements: [],
  people: [],
  me: localStorage.getItem('ys_me') || '',
  q: '',
  cat: 'All',
  actFilter: 'All',
  openRacks: {},
  loading: true,
  error: ''
};

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
function qtyClass(p) { return isZero(p) ? 'zero' : isLow(p) ? 'low' : ''; }
function movementProductName(m) {
  if (m.product_name) return m.product_name;
  if (m.products && m.products.name) return m.products.name;
  const p = productById(m.product_id);
  return p ? p.name : 'Deleted item';
}

async function refresh(showSpinner) {
  if (showSpinner) { state.loading = true; render(); }
  try {
    const [products, movements, people] = await Promise.all([
      DB.listProducts(), DB.listMovements(300), DB.listPeople()
    ]);
    state.products = products || [];
    state.movements = movements || [];
    state.people = people || [];
    state.error = '';
  } catch (e) {
    state.error = e && e.message ? e.message : 'Could not load stock';
  }
  state.loading = false;
  render();
}

/* ===================== Header & tabs ===================== */
const TABS = [
  { id: 'stock', label: 'Stock', icon: I.box },
  { id: 'locations', label: 'Racks', icon: I.rack },
  { id: 'activity', label: 'Activity', icon: I.activity },
  { id: 'settings', label: 'Me', icon: I.person }
];

function renderHeader() {
  const titles = {
    stock: ['Stock', CFG.SITE_NAME || 'Off-site store'],
    locations: ['Racks', 'Browse by location'],
    activity: ['Activity', 'Everything booked in and out'],
    settings: ['Settings', 'You and this device']
  };
  const [t, s] = titles[state.screen] || titles.stock;
  $('navTitle').textContent = t;
  $('navSub').textContent = s;

  const me = $('navMe');
  if (state.me) {
    me.innerHTML = '<span class="avatar">' + escapeHtml(initials(state.me)) + '</span>' +
                   '<span class="mename">' + escapeHtml(state.me.split(/\s+/)[0]) + '</span>';
  } else {
    me.innerHTML = '<span class="avatar">?</span><span class="mename">Who are you?</span>';
  }
}

function renderTabs() {
  const lowCount = state.products.filter(p => isLow(p) || isZero(p)).length;
  $('tabbar').innerHTML = TABS.map(tab => {
    const badge = (tab.id === 'stock' && lowCount)
      ? '<span class="tab-badge">' + (lowCount > 99 ? '99+' : lowCount) + '</span>' : '';
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
function render() {
  renderHeader();
  renderTabs();
  const el = $('screenContent');

  if (state.loading) { el.innerHTML = '<div class="spinner"></div>'; return; }

  let html = connectionBannerHtml();
  if (state.screen === 'stock') html += stockScreenHtml();
  else if (state.screen === 'locations') html += locationsScreenHtml();
  else if (state.screen === 'activity') html += activityScreenHtml();
  else html += settingsScreenHtml();
  el.innerHTML = html;

  wireBanner(el);
  if (state.screen === 'stock') wireStock(el);
  else if (state.screen === 'locations') wireLocations(el);
  else if (state.screen === 'activity') wireActivity(el);
  else wireSettings(el);
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

/* ===================== STOCK screen ===================== */
function filteredProducts() {
  const q = state.q.trim().toLowerCase();
  return state.products.filter(p => {
    if (state.cat === 'Low') { if (!isLow(p) && !isZero(p)) return false; }
    else if (state.cat !== 'All' && (p.category || 'Other') !== state.cat) return false;
    if (!q) return true;
    return [p.name, p.code, p.location, p.notes, p.category]
      .some(v => String(v || '').toLowerCase().includes(q));
  }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function stockScreenHtml() {
  const list = filteredProducts();
  const lowCount = state.products.filter(p => isLow(p) || isZero(p)).length;
  const totalUnits = state.products.reduce((s, p) => s + num(p.qty), 0);

  let html = searchRowHtml('Search name, code or rack…');

  html += '<div class="stats">' +
    '<div class="stat ok"><div class="sv">' + state.products.length + '</div><div class="sl">Products</div></div>' +
    '<div class="stat ok"><div class="sv">' + fmtQty(totalUnits) + '</div><div class="sl">Units held</div></div>' +
    '<div class="stat ' + (lowCount ? 'warn' : 'ok') + '"><div class="sv">' + lowCount + '</div><div class="sl">Low / out</div></div>' +
    '</div>';

  const chips = ['All'].concat(CATEGORIES).concat(['Low']);
  html += '<div class="chiprow">' + chips.map(c =>
    '<button class="chip ' + (state.cat === c ? 'active' : '') + '" data-cat="' + c + '" type="button">' +
    (c === 'Low' ? 'Low stock' : c) + '</button>').join('') + '</div>';

  html += '<div class="group">';
  if (!state.products.length) {
    html += '<div class="empty-note">No products yet. Tap the <strong>+</strong> button, take a photo of the item and give it a rack code like <strong>A3.1.1</strong>.</div>';
  } else if (!list.length) {
    html += '<div class="empty-note">Nothing matches that.</div>';
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
  if (p.location) meta.push('<span class="meta-chip loc">' + escapeHtml(p.location) + '</span>');
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
  const row = e.target.closest('.row, .rack-head');
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

/* ===================== LOCATIONS screen ===================== */
function locationsScreenHtml() {
  const q = state.q.trim().toLowerCase();
  const pool = q
    ? state.products.filter(p => [p.name, p.code, p.location].some(v => String(v || '').toLowerCase().includes(q)))
    : state.products;

  const racks = {};
  pool.forEach(p => {
    const r = p.location ? rackOf(p.location) : '—';
    (racks[r] = racks[r] || []).push(p);
  });
  const rackNames = Object.keys(racks).sort((a, b) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)));

  let html = searchRowHtml('Find a rack or an item…');

  if (!rackNames.length) {
    html += '<div class="group"><div class="empty-note">Nothing stored yet. Give each product a rack code like <strong>A3.1.1</strong> — rack A, bay 3, level 1, position 1 — and it will show up here.</div></div>';
    return html;
  }

  html += '<div class="section-title">' + rackNames.length + ' rack' + (rackNames.length === 1 ? '' : 's') + '</div>';
  html += rackNames.map(r => {
    const items = racks[r].slice().sort((a, b) => locSortKey(a.location).localeCompare(locSortKey(b.location)) || String(a.name).localeCompare(String(b.name)));
    const units = items.reduce((s, p) => s + num(p.qty), 0);
    const open = !!state.openRacks[r] || !!q;
    const spots = new Set(items.map(p => p.location).filter(Boolean)).size;

    let body = '';
    if (open) {
      body = '<div class="rack-body">';
      let lastLoc = null;
      items.forEach(p => {
        const loc = p.location || 'No location set';
        if (loc !== lastLoc) { body += '<div class="loc-label">' + escapeHtml(loc) + '</div>'; lastLoc = loc; }
        body += '<div class="row">' +
          (p.photo_url ? '<img class="thumb" src="' + escapeHtml(p.photo_url) + '" alt="" loading="lazy">' : '<span class="thumb-ph">' + I.boxSmall + '</span>') +
          '<div class="row-body" data-open="' + p.id + '">' +
            '<div class="row-title">' + escapeHtml(p.name) + '</div>' +
            (p.code ? '<div class="row-meta"><span class="meta-chip code">' + escapeHtml(p.code) + '</span></div>' : '') +
          '</div>' +
          '<span class="qty-pill ' + qtyClass(p) + '"><span class="qn">' + fmtQty(p.qty) + '</span><span class="qu">' + escapeHtml(p.unit || 'ea') + '</span></span>' +
          '</div>';
      });
      body += '</div>';
    }

    return '<div class="group" style="margin-bottom:10px;">' +
      '<div class="rack-head" data-rack="' + escapeHtml(r) + '">' +
        '<span class="rack-badge">' + escapeHtml(r) + '</span>' +
        '<div style="flex:1;min-width:0;">' +
          '<div class="rack-name">' + (r === '—' ? 'No rack assigned' : 'Rack ' + escapeHtml(r)) + '</div>' +
          '<div class="rack-sub">' + items.length + ' product' + (items.length === 1 ? '' : 's') + ' · ' + fmtQty(units) + ' units' + (spots ? ' · ' + spots + ' spot' + (spots === 1 ? '' : 's') : '') + '</div>' +
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

/* ===================== ACTIVITY screen ===================== */
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

/* ===================== SETTINGS screen ===================== */
function settingsScreenHtml() {
  const mode = DB.mode === 'supabase' ? 'Shared (Supabase)' : 'Local to this device';
  const sync = DB.lastSync ? fmtWhen(new Date(DB.lastSync).toISOString()) : '—';

  let html = '<div class="section-title">You</div><div class="group">';
  html += '<div class="row"><span class="avatar" style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--sys-blue),var(--sys-teal));color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + escapeHtml(initials(state.me || '?')) + '</span>' +
    '<div class="row-body" data-changeme><div class="row-title">' + escapeHtml(state.me || 'Not set') + '</div>' +
    '<div class="row-meta">Your bookings are logged under this name</div></div>' +
    '<span class="row-trail">' + I.chev + '</span></div>';
  html += '</div>';

  html += '<div class="section-title">Team<button class="st-action" data-addperson type="button">Add person</button></div><div class="group">';
  if (!state.people.length) {
    html += '<div class="empty-note">No names on the list yet. Add everyone who works the store room — no passwords, they just tap their name once.</div>';
  } else {
    html += state.people.map(p =>
      '<div class="row"><span class="avatar" style="width:30px;height:30px;border-radius:50%;background:var(--bg-elevated-3);color:var(--label);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + escapeHtml(initials(p.name)) + '</span>' +
      '<div class="row-body" data-pickperson="' + escapeHtml(p.name) + '"><div class="row-title">' + escapeHtml(p.name) + (p.name === state.me ? ' <span class="meta-chip" style="background:rgba(10,132,255,.2);color:var(--sys-blue)">you</span>' : '') + '</div></div>' +
      '<button class="row-trail" data-delperson="' + p.id + '" style="background:none;border:none;color:var(--label-tertiary);cursor:pointer;padding:6px;">' + I.trash + '</button></div>'
    ).join('');
  }
  html += '</div>';

  html += '<div class="section-title">Data</div><div class="group">' +
    '<div class="row"><div class="row-body" style="cursor:default"><div class="row-title">Mode</div></div><span class="row-trail" style="font-size:14px;color:var(--label-secondary)">' + mode + '</span></div>' +
    '<div class="row"><div class="row-body" style="cursor:default"><div class="row-title">Last synced</div></div><span class="row-trail" style="font-size:14px;color:var(--label-secondary)">' + escapeHtml(sync) + '</span></div>' +
    '<div class="row"><div class="row-body" data-refresh><div class="row-title" style="color:var(--sys-blue)">Refresh now</div></div></div>' +
    '<div class="row"><div class="row-body" data-export><div class="row-title" style="color:var(--sys-blue)">Export a backup (JSON)</div><div class="row-meta">Products and full movement history</div></div></div>' +
    '</div>';

  html += '<div class="status-line">Yard Stock · v1.0<br>Add to Home Screen for a full-screen app.</div>';
  return html;
}
function wireSettings(el) {
  const cm = el.querySelector('[data-changeme]');
  if (cm) cm.addEventListener('click', openPersonSheet);
  const ap = el.querySelector('[data-addperson]');
  if (ap) ap.addEventListener('click', () => openAddPersonSheet());
  el.querySelectorAll('[data-pickperson]').forEach(b => b.addEventListener('click', () => {
    setMe(b.getAttribute('data-pickperson')); toast('Signed in as ' + state.me, 'good'); render();
  }));
  el.querySelectorAll('[data-delperson]').forEach(b => b.addEventListener('click', async () => {
    const id = b.getAttribute('data-delperson');
    const person = state.people.find(p => p.id === id);
    if (!person) return;
    if (!confirm('Remove ' + person.name + ' from the list? Their past bookings stay in the log.')) return;
    try { await DB.removePerson(id); if (state.me === person.name) setMe(''); await refresh(); }
    catch (e) { toast(e.message || 'Could not remove', 'bad'); }
  }));
  const rf = el.querySelector('[data-refresh]');
  if (rf) rf.addEventListener('click', () => refresh(true));
  const ex = el.querySelector('[data-export]');
  if (ex) ex.addEventListener('click', exportBackup);
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

function sheetY() {
  const m = /translateY\(([-\d.]+)%\)/.exec(sheetEl.style.transform);
  return m ? parseFloat(m[1]) : 105;
}
function openSheet() {
  scrimEl.style.pointerEvents = 'auto';
  animateOpacity(scrimEl, 1, 220);
  // Starting from wherever the sheet already is means swapping its contents
  // (detail → edit, pick → book) slides nothing: it just stays put.
  const from = sheetY();
  if (from > 1) sheetEl.scrollTop = 0;
  const ticket = ++sheetAnim;
  const s = new Spring(from, { dampingRatio: 0.86, response: 0.34 });
  s.set(0);
  runSpring(s, (v) => { if (ticket === sheetAnim) sheetEl.style.transform = 'translateY(' + v + '%)'; });
}
function closeSheet() {
  const ticket = ++sheetAnim;
  const s = new Spring(sheetY(), { dampingRatio: 1, response: 0.26 });
  s.set(105);
  runSpring(s, (v) => { if (ticket === sheetAnim) sheetEl.style.transform = 'translateY(' + v + '%)'; },
    () => { if (ticket === sheetAnim) scrimEl.style.pointerEvents = 'none'; });
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

/* ===================== Product detail sheet ===================== */
function openProductDetail(id) {
  const p = productById(id);
  if (!p) { toast('Product not found'); return; }
  const recent = state.movements.filter(m => m.product_id === id).slice(0, 6);

  const meta = [];
  if (p.code) meta.push('<span class="meta-chip code">' + escapeHtml(p.code) + '</span>');
  if (p.category) meta.push('<span class="meta-chip cat">' + escapeHtml(p.category) + '</span>');
  if (num(p.min_qty) > 0) meta.push('<span class="meta-chip">min ' + fmtQty(p.min_qty) + '</span>');

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    (p.photo_url ? '<img class="photo-hero" src="' + escapeHtml(p.photo_url) + '" alt="">' : '') +
    '<div class="sheet-title">' + escapeHtml(p.name) + '</div>' +
    '<div class="sheet-sub">' + (p.location
      ? '<span class="meta-chip loc" style="font-size:14px;padding:3px 10px;">' + escapeHtml(p.location) + '</span> ' + locWords(p.location)
      : 'No rack location set') + '</div>' +
    (meta.length ? '<div class="row-meta" style="margin:-6px 0 12px;">' + meta.join('') + '</div>' : '') +
    '<div class="detail-qty ' + qtyClass(p) + '"><span class="dq">' + fmtQty(p.qty) + '</span><span class="du">' + escapeHtml(p.unit || 'ea') + ' in stock' + (isLow(p) && !isZero(p) ? ' · running low' : isZero(p) ? ' · none left' : '') + '</span></div>' +
    (p.notes ? '<div class="row-notes" style="white-space:normal;margin-bottom:12px;font-size:14px;line-height:1.45;">' + escapeHtml(p.notes) + '</div>' : '') +
    '<div class="detail-actions">' +
      '<button class="detail-btn in" data-in type="button">' + I.arrowIn + ' Book in</button>' +
      '<button class="detail-btn out" data-out type="button">' + I.arrowOut + ' Book out</button>' +
    '</div>' +
    (recent.length ? '<div class="field-label">Recent movements</div><div class="group" style="margin-bottom:12px;">' +
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
      '<button class="sheet-cancel" data-count type="button">Set count</button>' +
      '<button class="sheet-cancel" data-edit type="button" style="color:var(--sys-blue);font-weight:700;">Edit</button>' +
    '</div>';

  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  sheetEl.querySelector('[data-in]').addEventListener('click', () => openMoveSheet(id, 'in'));
  sheetEl.querySelector('[data-out]').addEventListener('click', () => openMoveSheet(id, 'out'));
  sheetEl.querySelector('[data-count]').addEventListener('click', () => openMoveSheet(id, 'set'));
  sheetEl.querySelector('[data-edit]').addEventListener('click', () => openProductSheet(p));
  openSheet();
}
function locWords(loc) {
  const l = parseLoc(loc);
  if (!l) return '';
  const bits = ['Rack ' + l.rack, 'bay ' + l.bay];
  if (l.level) bits.push('level ' + l.level);
  if (l.pos) bits.push('position ' + l.pos);
  return bits.join(', ');
}

/* ===================== Move sheet (book in / out / set) ===================== */
let moveCtx = null;

function openMoveSheet(productId, dir) {
  const p = productById(productId);
  if (!p) { toast('Product not found'); return; }
  if (!state.me) { openPersonSheet(() => openMoveSheet(productId, dir)); return; }
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
    '<div class="sheet-title">' + escapeHtml(p.name) + '</div>' +
    '<div class="sheet-sub">' + (p.location ? escapeHtml(p.location) + ' · ' : '') + fmtQty(cur) + ' ' + escapeHtml(p.unit || 'ea') + ' in stock now</div>' +
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
        : 'New count: <strong>' + fmtQty(after) + ' ' + escapeHtml(p.unit || 'ea') + '</strong>') +
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
    '</div>';

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
  sheetEl.querySelector('[data-me]').addEventListener('click', () => openPersonSheet(() => renderMoveSheet()));
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
      : 'New count: <strong>' + fmtQty(after) + ' ' + escapeHtml(p.unit || 'ea') + '</strong>';
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

/* ===================== Product add / edit sheet ===================== */
let prodDraft = null;

function openProductSheet(existing) {
  const p = existing || {};
  const loc = parseLoc(p.location) || { rack: '', bay: '', level: '', pos: '' };
  prodDraft = {
    id: p.id || null,
    name: p.name || '',
    code: p.code || '',
    category: p.category || 'Parts',
    unit: p.unit || 'ea',
    qty: p.id ? num(p.qty) : 0,
    min_qty: num(p.min_qty),
    notes: p.notes || '',
    photo_url: p.photo_url || '',
    photoBlob: null,
    rack: loc.rack, bay: loc.bay, level: loc.level, pos: loc.pos
  };
  renderProductSheet();
  openSheet();
}

function renderProductSheet() {
  const d = prodDraft;
  const editing = !!d.id;
  const locStr = buildLoc(d.rack, d.bay, d.level, d.pos);
  const rackOpts = uniqueRacks();

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">' + (editing ? 'Edit product' : 'New product') + '</div>' +
    '<div class="sheet-sub">' + (editing ? 'Changes apply for everyone.' : 'Photo, name and rack code — that is all it takes.') + '</div>' +

    '<button class="photo-tile" data-photo type="button">' +
      (d.photo_url
        ? '<img src="' + escapeHtml(d.photo_url) + '" alt=""><span class="retake">Retake photo</span>'
        : I.camera + '<span>Take a photo of the item</span>') +
    '</button>' +

    '<input type="text" id="pName" placeholder="What is it? e.g. Oak chair leg, 450mm" maxlength="120" value="' + escapeHtml(d.name) + '">' +
    '<input type="text" id="pCode" placeholder="Code / SKU (optional)" maxlength="40" value="' + escapeHtml(d.code) + '">' +

    '<div class="field-label">Category</div>' +
    '<div class="pill-grid">' + CATEGORIES.map(c =>
      '<button class="pill-btn ' + (d.category === c ? 'active' : '') + '" data-pcat="' + c + '" type="button">' + c + '</button>').join('') + '</div>' +

    '<div class="field-label">Where is it stored?</div>' +
    '<div class="locpick">' +
      '<div class="locpick-preview ' + (locStr ? '' : 'none') + '">' + (locStr ? escapeHtml(locStr) : 'No location set') + '</div>' +
      '<div class="locpick-grid">' +
        '<div class="locpick-cell"><label>Rack</label>' +
          '<select id="lRack"><option value="">—</option>' +
          rackOpts.map(r => '<option value="' + r + '" ' + (d.rack === r ? 'selected' : '') + '>' + r + '</option>').join('') +
          '</select></div>' +
        '<div class="locpick-cell"><label>Bay</label><input id="lBay" type="number" inputmode="numeric" min="1" max="999" value="' + escapeHtml(d.bay) + '" placeholder="–"></div>' +
        '<div class="locpick-cell"><label>Level</label><input id="lLevel" type="number" inputmode="numeric" min="1" max="99" value="' + escapeHtml(d.level) + '" placeholder="–"></div>' +
        '<div class="locpick-cell"><label>Pos</label><input id="lPos" type="number" inputmode="numeric" min="1" max="99" value="' + escapeHtml(d.pos) + '" placeholder="–"></div>' +
      '</div>' +
      '<button class="locpick-clear" data-locclear type="button">Clear location</button>' +
    '</div>' +

    '<div class="field-group">' +
      '<div class="field-row"><span class="fname">Unit</span><select id="pUnit">' +
        UNITS.map(u => '<option value="' + u + '" ' + (d.unit === u ? 'selected' : '') + '>' + u + '</option>').join('') +
      '</select></div>' +
      (editing
        ? '<div class="field-row"><span class="fname">Count</span><span style="color:var(--label-secondary);font-size:15px;">' + fmtQty(d.qty) + ' ' + escapeHtml(d.unit) + ' · change with Set count</span></div>'
        : '<div class="field-row"><span class="fname">Opening count</span><input type="number" id="pQty" inputmode="decimal" value="' + d.qty + '" min="0"></div>') +
      '<div class="field-row"><span class="fname">Warn me below</span><input type="number" id="pMin" inputmode="decimal" value="' + d.min_qty + '" min="0" placeholder="0"></div>' +
    '</div>' +

    '<textarea class="sheet-notes" id="pNotes" placeholder="Notes — finish, batch, customer, anything worth knowing…" maxlength="1000">' + escapeHtml(d.notes) + '</textarea>' +

    '<div class="sheet-actions">' +
      '<button class="sheet-cancel" data-close type="button">Cancel</button>' +
      (editing ? '<button class="sheet-delete" data-delete type="button">' + I.trash + '</button>' : '') +
      '<button class="sheet-save" data-save type="button">' + (editing ? 'Save' : 'Add product') + '</button>' +
    '</div>';

  // keep typed values in the draft so re-renders don't lose them
  const bindText = (id, key) => {
    const e = $(id); if (e) e.addEventListener('input', () => { d[key] = e.value; });
  };
  bindText('pName', 'name'); bindText('pCode', 'code'); bindText('pNotes', 'notes');
  ['lBay', 'lLevel', 'lPos'].forEach((id, i) => {
    const key = ['bay', 'level', 'pos'][i];
    const e = $(id);
    e.addEventListener('input', () => { d[key] = e.value.replace(/\D/g, ''); updateLocPreview(); });
  });
  $('lRack').addEventListener('change', () => { d.rack = $('lRack').value; updateLocPreview(); });
  $('pUnit').addEventListener('change', () => { d.unit = $('pUnit').value; });
  if ($('pQty')) $('pQty').addEventListener('input', () => { d.qty = num($('pQty').value); });
  $('pMin').addEventListener('input', () => { d.min_qty = num($('pMin').value); });

  sheetEl.querySelectorAll('[data-pcat]').forEach(b => b.addEventListener('click', () => {
    d.category = b.getAttribute('data-pcat');
    sheetEl.querySelectorAll('[data-pcat]').forEach(x => x.classList.toggle('active', x.getAttribute('data-pcat') === d.category));
  }));
  sheetEl.querySelector('[data-locclear]').addEventListener('click', () => {
    d.rack = ''; d.bay = ''; d.level = ''; d.pos = '';
    renderProductSheet();
  });
  sheetEl.querySelector('[data-photo]').addEventListener('click', capturePhoto);
  sheetEl.querySelector('[data-close]').addEventListener('click', closeSheet);
  sheetEl.querySelector('[data-save]').addEventListener('click', saveProduct);
  const del = sheetEl.querySelector('[data-delete]');
  if (del) del.addEventListener('click', deleteProduct);
}

function updateLocPreview() {
  const d = prodDraft;
  const s = buildLoc(d.rack, d.bay, d.level, d.pos);
  const el = sheetEl.querySelector('.locpick-preview');
  if (!el) return;
  el.className = 'locpick-preview' + (s ? '' : ' none');
  el.textContent = s || 'No location set';
}
function uniqueRacks() {
  const set = new Set();
  state.products.forEach(p => { const r = rackOf(p.location); if (r && r !== '?') set.add(r); });
  'ABCDEFGHIJ'.split('').forEach(r => set.add(r));
  return Array.from(set).sort();
}

/* ---- photo capture + compression ---- */
function capturePhoto() {
  const input = $('photoInput');
  input.value = '';
  const onChange = async () => {
    input.removeEventListener('change', onChange);
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const blob = await compressImage(file);
      prodDraft.photoBlob = blob;
      prodDraft.photo_url = URL.createObjectURL(blob);
      renderProductSheet();
    } catch (e) {
      toast('Could not read that photo', 'bad');
    }
  };
  input.addEventListener('change', onChange);
  input.click();
}

async function compressImage(file) {
  const maxPx = CFG.PHOTO_MAX_PX || 1400;
  const quality = CFG.PHOTO_QUALITY || 0.82;
  let bitmap;
  if (window.createImageBitmap) {
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { bitmap = await createImageBitmap(file); }
  } else {
    bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bitmap.width, h = bitmap.height;
  const scale = Math.min(1, maxPx / Math.max(w, h));
  const cw = Math.round(w * scale), ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, cw, ch);
  if (bitmap.close) bitmap.close();
  return await new Promise((resolve) => canvas.toBlob(b => resolve(b), 'image/jpeg', quality));
}

async function saveProduct() {
  const d = prodDraft;
  d.name = ($('pName').value || '').trim();
  if (!d.name) { $('pName').focus(); toast('Give it a name first'); return; }
  d.code = ($('pCode').value || '').trim();
  d.notes = ($('pNotes').value || '').trim();

  const btn = sheetEl.querySelector('[data-save]');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    let photoUrl = d.photo_url;
    if (d.photoBlob) {
      btn.textContent = 'Uploading photo…';
      photoUrl = await DB.uploadPhoto(d.photoBlob, d.id || undefined);
    }
    const payload = {
      name: d.name, code: d.code, category: d.category, location: buildLoc(d.rack, d.bay, d.level, d.pos),
      unit: d.unit, min_qty: num(d.min_qty), notes: d.notes, photo_url: photoUrl || null
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
    toast(d.id ? 'Saved' : 'Added ' + d.name, 'good');
  } catch (e) {
    btn.disabled = false; btn.textContent = d.id ? 'Save' : 'Add product';
    toast(e && e.offline ? 'No connection — not saved' : (e.message || 'Could not save'), 'bad');
  }
}

async function deleteProduct() {
  const d = prodDraft;
  if (!d.id) return;
  if (!confirm('Remove "' + d.name + '" from the stock list?\n\nIts movement history is kept.')) return;
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
      '<div class="row"><span class="thumb-ph">' + I.plus + '</span><div class="row-body" data-newprod>' +
        '<div class="row-title">New product</div><div class="row-meta">Photo, name and a rack code</div></div>' +
        '<span class="row-trail">' + I.chev + '</span></div>' +
    '</div>' +
    '<div class="sheet-actions"><button class="sheet-cancel" data-close type="button">Cancel</button></div>';
  sheetEl.querySelector('[data-pickin]').addEventListener('click', () => openPickProduct('in'));
  sheetEl.querySelector('[data-pickout]').addEventListener('click', () => openPickProduct('out'));
  sheetEl.querySelector('[data-newprod]').addEventListener('click', () => openProductSheet(null));
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
  const list = state.products
    .filter(p => !q || [p.name, p.code, p.location].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .slice(0, 40);

  sheetEl.innerHTML =
    '<div class="sheet-handle"></div>' +
    '<div class="sheet-title">' + (dir === 'in' ? 'Book in' : 'Book out') + '</div>' +
    '<div class="sheet-sub">Which item? Search by name, code or rack.</div>' +
    '<div class="search-row" style="background:var(--bg-elevated-2);">' +
      '<span class="search-icon">' + I.search + '</span>' +
      '<input type="search" id="pickSearch" placeholder="e.g. oak leg, A3.1" value="' + escapeHtml(pickQuery) + '" autocomplete="off">' +
    '</div>' +
    '<div class="group">' +
      (list.length ? list.map(p =>
        '<div class="row"><div class="row-body" data-pick="' + p.id + '">' +
          '<div class="row-title">' + escapeHtml(p.name) + '</div>' +
          '<div class="row-meta">' + (p.location ? '<span class="meta-chip loc">' + escapeHtml(p.location) + '</span>' : '') +
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
$('fabAdd').addEventListener('click', () => { if (!state.loading) openFabSheet(); });
$('navMe').addEventListener('click', () => openPersonSheet());

window.addEventListener('online', () => { DB.online = true; refresh(); });
window.addEventListener('offline', () => { DB.online = false; render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !state.loading) refresh(); });

(async function boot() {
  render();
  await DB.init();
  await refresh();
  if (!state.me) openPersonSheet();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

})();
