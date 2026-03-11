// ============================================================
//  QuickBasket — app.js
//  v3: Robust GPS + fully open custom product search
// ============================================================

// ——— Global state ———
window.basket       = {};        // { id -> qty }  (catalogue + custom items)
window.customItems  = {};        // { id -> {name, emoji, basePrice} }
window.currentCity  = 'Mumbai';
window.currentLat   = null;
window.currentLng   = null;
let activeCategory  = 'all';
let searchQuery     = '';
let gpsWatchId      = null;

// ——— Toast ———
window.showToast = function (msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3800);
};

// ================================================================
//  GPS LOCATION  (works on HTTPS / GitHub Pages)
// ================================================================
window.detectLocation = function () {
  const btn = document.getElementById('gpsBtn');
  const info = document.getElementById('gpsInfo');

  // Browser support check
  if (!('geolocation' in navigator)) {
    info.innerHTML = '❌ Your browser does not support GPS. Please type your city below.';
    info.style.color = 'var(--danger)';
    return;
  }

  btn.innerHTML = '📡 Requesting permission…';
  btn.disabled  = true;
  info.innerHTML = '⏳ Waiting for location access…';
  info.style.color = 'var(--muted)';

  const options = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000,   // accept a cached fix up to 1 min old
  };

  navigator.geolocation.getCurrentPosition(
    onGPSSuccess,
    onGPSError,
    options
  );
};

async function onGPSSuccess(pos) {
  const btn  = document.getElementById('gpsBtn');
  const info = document.getElementById('gpsInfo');

  currentLat = pos.coords.latitude;
  currentLng = pos.coords.longitude;
  const acc  = Math.round(pos.coords.accuracy);

  info.innerHTML = `✅ GPS fix: ${currentLat.toFixed(5)}, ${currentLng.toFixed(5)} (±${acc}m) — Reverse geocoding…`;
  info.style.color = 'var(--accent)';

  // Reverse geocode via OpenStreetMap Nominatim
  try {
    const url  = `https://nominatim.openstreetmap.org/reverse?lat=${currentLat}&lon=${currentLng}&format=json&addressdetails=1&accept-language=en`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('Nominatim error ' + res.status);
    const data = await res.json();
    const addr = data.address || {};

    const locality = addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || '';
    const city     = addr.city   || addr.town || addr.county || addr.state_district || addr.state || 'Your Location';
    const display  = locality ? `${locality}, ${city}` : city;

    currentCity = city;
    document.getElementById('locDisplay').textContent   = display;
    document.getElementById('locationInput').value      = display;
    document.querySelectorAll('.modal-city').forEach(el =>
      el.classList.toggle('selected', el.textContent.toLowerCase().includes(city.toLowerCase())));

    info.innerHTML = `📍 <strong>${display}</strong> — location confirmed!`;
    showToast(`📍 Location set to ${display}`, 'success');

  } catch (e) {
    // Reverse geocode failed — use coordinates
    currentCity = `${currentLat.toFixed(4)},${currentLng.toFixed(4)}`;
    document.getElementById('locDisplay').textContent = '📍 GPS Location';
    document.getElementById('locationInput').value    = currentCity;
    info.innerHTML = `📍 GPS: ${currentLat.toFixed(5)}, ${currentLng.toFixed(5)} (city lookup failed — check internet)`;
    showToast('📍 GPS location detected', 'success');
  }

  btn.innerHTML = '📍 Use My Current Location';
  btn.disabled  = false;

  setTimeout(() => {
    document.getElementById('locationModal').classList.add('hidden');
    clearResults();
  }, 1200);
}

function onGPSError(err) {
  const btn  = document.getElementById('gpsBtn');
  const info = document.getElementById('gpsInfo');
  btn.innerHTML = '📍 Use My Current Location';
  btn.disabled  = false;

  const messages = {
    1: `🔒 <strong>Permission denied.</strong><br>
        <small>To fix: tap the 🔒 lock icon in your browser address bar → Site settings → Location → Allow, then try again.</small>`,
    2: `📡 <strong>Location unavailable.</strong><br>
        <small>Make sure your device location/GPS is turned ON in system settings, then try again.</small>`,
    3: `⏱️ <strong>Request timed out.</strong><br>
        <small>Move to an area with better signal or enable Wi-Fi for faster location.</small>`,
  };
  info.innerHTML     = messages[err.code] || '❌ Unknown location error.';
  info.style.color   = 'var(--danger)';
}

// ——— Manual city select ———
window.selectCity = function (city) {
  currentCity = city;
  document.getElementById('locDisplay').textContent = city;
  document.getElementById('locationInput').value    = city;
  document.querySelectorAll('.modal-city').forEach(el =>
    el.classList.toggle('selected', el.textContent.includes(city)));
  const info = document.getElementById('gpsInfo');
  if (info) { info.innerHTML = `✅ Selected: <strong>${city}</strong>`; info.style.color = 'var(--accent)'; }
};

window.confirmLocation = function () {
  const val = document.getElementById('locationInput').value.trim();
  if (val) { currentCity = val; document.getElementById('locDisplay').textContent = val; }
  document.getElementById('locationModal').classList.add('hidden');
  clearResults();
};

// ================================================================
//  CUSTOM PRODUCT ENTRY  — add ANY product with your own price
// ================================================================
window.openCustomProductModal = function () {
  document.getElementById('customProductModal').classList.remove('hidden');
  document.getElementById('cp_name').focus();
};

window.addCustomProduct = function () {
  const name  = document.getElementById('cp_name').value.trim();
  const price = parseFloat(document.getElementById('cp_price').value);
  const unit  = document.getElementById('cp_unit').value.trim() || '1 pc';
  const emoji = document.getElementById('cp_emoji').value.trim() || '📦';

  if (!name)       { showToast('Please enter a product name', 'error'); return; }
  if (!price || price <= 0) { showToast('Please enter a valid price', 'error'); return; }

  const id = 'custom_' + Date.now();

  // Register as a custom item (not in PRODUCTS array)
  customItems[id] = { name, emoji, unit, basePrice: price };

  // Add to basket immediately
  basket[id] = 1;

  // Reset form
  ['cp_name','cp_price','cp_unit','cp_emoji'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('customProductModal').classList.add('hidden');

  updateBasketUI();
  showToast(`✅ "${name}" added to basket!`, 'success');
};

// Unified product lookup (catalogue + custom)
window.getProduct = function (id) {
  return PRODUCTS.find(x => x.id === id) || customItems[id] || null;
};

// ================================================================
//  SEARCH & FILTER
// ================================================================
const ALIASES = {
  anda:'eggs',egg:'eggs',doodh:'milk',dudh:'milk',makhan:'butter',
  dahi:'curd',yogurt:'curd',panir:'paneer',aata:'atta',ata:'atta',
  chawal:'rice',chaawal:'rice',cheeni:'sugar',namak:'salt',
  tel:'oil',pyaaz:'onion',pyaz:'onion',aloo:'potato',alu:'potato',
  tamatar:'tomato',palak:'spinach',gajar:'carrot',mirchi:'chilli',
  adrak:'ginger',lehsun:'garlic',nimbu:'lemon',kela:'banana',
  seb:'apple',aam:'mango',santara:'orange',angur:'grapes',
  chai:'tea',sabun:'soap',colgate:'toothpaste',tide:'detergent',
  surf:'detergent',biscuit:'biscuits',pani:'water',dal:'dal',
  daal:'dal',sooji:'suji',rawa:'suji',sarso:'mustard',jeera:'cumin',
  haldi:'turmeric',dhania:'coriander',imli:'tamarind',
  murga:'chicken',murgh:'chicken',machli:'fish',jheenga:'prawn',
  diaper:'diapers',jhadu:'broom',bartan:'dishwash',atta:'atta',
  besan:'gram flour',rajma:'kidney',moong:'moong',chana:'chana',
};

window.filterCat = function (cat, el) {
  activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  renderProducts();
};

window.filterProducts = function () {
  const raw   = document.getElementById('searchInput').value.trim().toLowerCase();
  searchQuery = ALIASES[raw] || raw;
  renderProducts();
};

function matchesSearch(p, q) {
  if (!q) return true;
  const hay = (p.name + ' ' + (p.cat || '') + ' ' + (p.unit || '')).toLowerCase();
  return q.split(/\s+/).every(w => hay.includes(w));
}

// ================================================================
//  PRODUCT LIST RENDER
// ================================================================
window.renderProducts = function () {
  const list     = document.getElementById('productList');
  const filtered = PRODUCTS.filter(p =>
    (activeCategory === 'all' || p.cat === activeCategory) && matchesSearch(p, searchQuery)
  );

  let html = '';

  // "Add custom product" card — always at top when searching
  if (searchQuery) {
    const rawInput = document.getElementById('searchInput').value.trim();
    html += `
    <div style="background:rgba(0,229,160,0.06);border:1px dashed rgba(0,229,160,0.35);border-radius:10px;padding:0.75rem;margin-bottom:0.5rem">
      <div style="font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:0.3rem">Can't find "${rawInput}"?</div>
      <div style="font-size:0.73rem;color:var(--muted);margin-bottom:0.5rem">Add it manually with your own price</div>
      <button onclick="openCustomProductModal()" style="
        width:100%;padding:0.4rem;border-radius:7px;border:1px solid var(--accent);
        background:transparent;color:var(--accent);font-size:0.78rem;font-weight:600;
        cursor:pointer;font-family:'DM Sans',sans-serif">
        + Add Custom Product
      </button>
    </div>`;
  }

  if (!filtered.length && !searchQuery) {
    html += `<div style="padding:1rem 0;text-align:center;color:var(--muted);font-size:0.8rem">No products in this category</div>`;
  }

  html += filtered.map(p => {
    const qty = basket[p.id] || 0;
    const inB = qty > 0;
    return `
    <div class="product-item${inB ? ' in-basket' : ''}">
      <span class="product-emoji">${p.emoji}</span>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-unit">${p.unit}</div>
      </div>
      <span class="product-price">₹${p.basePrice}</span>
      ${inB
        ? `<div class="qty-stepper">
             <button onclick="changeQty('${p.id}',-1)">−</button>
             <span class="qty-num">${qty}</span>
             <button onclick="changeQty('${p.id}',1)">+</button>
           </div>`
        : `<button class="add-btn" onclick="addToBasket('${p.id}')">+</button>`
      }
    </div>`;
  }).join('');

  list.innerHTML = html;
};

// ================================================================
//  BASKET
// ================================================================
window.addToBasket = function (id) {
  basket[id] = 1;
  updateBasketUI();
  renderProducts();
};

window.changeQty = function (id, delta) {
  basket[id] = (basket[id] || 0) + delta;
  if (basket[id] <= 0) {
    delete basket[id];
    if (customItems[id]) delete customItems[id]; // also remove custom item
  }
  updateBasketUI();
  renderProducts();
};

window.removeFromBasket = function (id) {
  delete basket[id];
  if (customItems[id]) delete customItems[id];
  updateBasketUI();
  renderProducts();
  clearResults();
};

window.clearBasket = function () {
  if (!Object.keys(basket).length) return;
  if (!confirm('Clear all items from basket?')) return;
  basket = {}; customItems = {};
  updateBasketUI(); renderProducts(); clearResults();
};

window.updateBasketUI = function () {
  const tags     = document.getElementById('basketTags');
  const btn      = document.getElementById('compareBtn');
  const saveBtn  = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const items    = Object.keys(basket);

  if (!items.length) {
    tags.innerHTML = `<span style="font-size:0.8rem;color:var(--muted)">Add items from the left panel to compare</span>`;
    btn.disabled = true;
    saveBtn.classList.add('hidden');
    clearBtn.classList.add('hidden');
    return;
  }

  tags.innerHTML = items.map(id => {
    const p = getProduct(id);
    if (!p) return '';
    const isCustom = !!customItems[id];
    return `<div class="basket-tag${isCustom ? ' custom-tag' : ''}">
      <span class="tag-emoji">${p.emoji}</span>
      <span>${p.name} ×${basket[id]}</span>
      ${isCustom ? '<span style="font-size:0.65rem;color:var(--accent);margin-left:0.1rem">✏️</span>' : ''}
      <span class="remove-tag" onclick="removeFromBasket('${id}')">✕</span>
    </div>`;
  }).join('');

  btn.disabled = false;
  saveBtn.classList.remove('hidden');
  clearBtn.classList.remove('hidden');
};

// ================================================================
//  PANELS & MODALS
// ================================================================
window.toggleSavedPanel = function () {
  document.getElementById('savedPanel').classList.toggle('hidden');
};

window.openReportModal = function () {
  const sel = document.getElementById('reportProduct');
  sel.innerHTML = '<option value="">Select Product</option>' +
    PRODUCTS.map(p => `<option value="${p.id}">${p.emoji} ${p.name} (${p.unit})</option>`).join('');
  document.getElementById('reportCity').value = currentCity;
  document.getElementById('reportModal').classList.remove('hidden');
};

// ================================================================
//  PRICE CALCULATION
// ================================================================
function calcAppTotal(app) {
  let subtotal = 0;
  const itemPrices = {};
  for (const [id, qty] of Object.entries(basket)) {
    const p     = getProduct(id);
    if (!p) continue;
    const mult  = app.priceMultiplier[id] ?? app.priceMultiplier.default;
    const price = Math.round(p.basePrice * mult);
    itemPrices[id] = price;
    subtotal += price * qty;
  }
  const delivery   = app.deliveryFee(subtotal);
  const handling   = app.handlingFee(subtotal);
  const platform   = app.platformFee(subtotal);
  const smallOrder = app.smallOrderFee(subtotal);
  return { subtotal, delivery, handling, platform, smallOrder, total: subtotal+delivery+handling+platform+smallOrder, itemPrices };
}

// ================================================================
//  COMPARISON RUN
// ================================================================
window.runComparison = async function () {
  const loading     = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  loading.classList.remove('hidden');
  const msgs = [
    'Checking Blinkit prices…','Scanning Zepto…','Comparing Instamart…',
    'Analyzing BB Now…','Calculating all delivery fees…','Finding your best deal…'
  ];
  let i = 0;
  const iv = setInterval(() => { loadingText.textContent = msgs[i++ % msgs.length]; }, 550);
  await new Promise(r => setTimeout(r, 2500));
  clearInterval(iv);
  loading.classList.add('hidden');
  renderResults();
};

// ================================================================
//  RENDER RESULTS
// ================================================================
function renderResults() {
  document.getElementById('emptyState').style.display = 'none';
  const area = document.getElementById('resultsArea');
  area.style.display = 'block';

  const results = APPS.map(app => ({ app, ...calcAppTotal(app) }));
  results.sort((a, b) => a.total - b.total);

  const cheapest = results[0], priciest = results[results.length-1];
  const savings  = priciest.total - cheapest.total;

  // Per-item cheapest
  const itemCheapest = {};
  for (const id of Object.keys(basket)) {
    let best = null, bestPrice = Infinity;
    for (const r of results) {
      if ((r.itemPrices[id] ?? Infinity) < bestPrice) { bestPrice = r.itemPrices[id]; best = r.app; }
    }
    itemCheapest[id] = { app: best, price: bestPrice };
  }

  logComparison(currentCity,
    Object.entries(basket).map(([id,qty]) => ({ id, qty })),
    results.map(r => ({ appId: r.app.id, total: r.total }))
  );

  let html = '';

  // Location strip
  html += `<div style="display:flex;align-items:center;gap:0.5rem;font-size:0.78rem;color:var(--muted);margin-bottom:1rem;flex-wrap:wrap">
    <span>📍 Results for <strong style="color:var(--text)">${currentCity}</strong>
    ${currentLat ? `<span style="font-size:0.7rem;opacity:0.6">(GPS ${currentLat.toFixed(3)}, ${currentLng.toFixed(3)})</span>` : ''}</span>
    <button onclick="document.getElementById('locationModal').classList.remove('hidden')"
      style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:6px;
      padding:0.2rem 0.6rem;color:var(--muted);font-size:0.72rem;cursor:pointer">Change ▾</button>
  </div>`;

  // Custom items notice
  const customCount = Object.keys(customItems).length;
  if (customCount > 0) {
    html += `<div style="background:rgba(0,229,160,0.06);border:1px solid rgba(0,229,160,0.2);border-radius:10px;
      padding:0.65rem 1rem;font-size:0.78rem;color:var(--muted);margin-bottom:1rem">
      ✏️ <strong style="color:var(--accent)">${customCount} custom item${customCount>1?'s':''}</strong> included —
      prices entered by you (same % difference applied per app)
    </div>`;
  }

  // Savings banner
  if (savings > 0) {
    html += `<div class="savings-banner">
      <div class="save-big">💰</div>
      <div>
        <div class="savings-num">Save ₹${savings}</div>
        <div class="savings-sub">by ordering from <strong>${cheapest.app.name}</strong> vs. the most expensive option</div>
      </div>
    </div>`;
  }

  // App cards
  html += `<div class="app-cards">`;
  for (const r of results) {
    const isBest = r.app.id === cheapest.app.id;
    html += `
    <div class="app-card${isBest?' cheapest':''}">
      ${isBest?'<div class="cheapest-badge">⚡ Best Price</div>':''}
      <div class="app-card-header">
        <div class="app-logo-circle" style="background:${r.app.color};color:${r.app.textColor}">${r.app.emoji}</div>
        <div class="app-meta">
          <div class="app-name">${r.app.name}</div>
          <div class="app-eta">🕐 ${r.app.eta} · Free over ₹${r.app.freeDeliveryAbove}</div>
        </div>
      </div>
      <div class="app-total-area">
        <div class="total-label">Total to pay</div>
        <div class="total-amount" style="color:${isBest?'var(--accent)':'var(--text)'}">₹${r.total}</div>
      </div>
      <div class="fee-rows">
        <div class="fee-row"><span class="fee-name">Items subtotal</span><span class="fee-val">₹${r.subtotal}</span></div>
        <div class="fee-row${r.delivery===0?' free':''}">
          <span class="fee-name">Delivery${r.delivery===0?' 🎉':''}</span>
          <span class="fee-val">${r.delivery===0?'FREE':'₹'+r.delivery}</span>
        </div>
        ${r.handling>0?`<div class="fee-row"><span class="fee-name">Handling</span><span class="fee-val">₹${r.handling}</span></div>`:''}
        ${r.platform>0?`<div class="fee-row"><span class="fee-name">Platform fee</span><span class="fee-val">₹${r.platform}</span></div>`:''}
        ${r.smallOrder>0?`<div class="fee-row"><span class="fee-name">Small order fee</span><span class="fee-val">₹${r.smallOrder}</span></div>`:''}
        <div class="fee-row divider"><span>Grand Total</span><span>₹${r.total}</span></div>
      </div>
      <div class="item-list">
        ${Object.entries(basket).map(([id,qty]) => {
          const p = getProduct(id); if(!p) return '';
          const price = r.itemPrices[id] ?? 0;
          const isBestItem = itemCheapest[id]?.app?.id === r.app.id;
          return `<div class="item-row">
            <span class="item-left">${p.emoji} ${p.name} ×${qty}</span>
            <span class="item-right">${isBestItem?'✅ ':''}₹${price*qty}</span>
          </div>`;
        }).join('')}
      </div>
      <button class="go-btn" style="background:${r.app.color};color:${r.app.textColor}"
        onclick="openApp('${r.app.id}','${r.app.deeplink(currentCity)}')">
        Order on ${r.app.name} →
      </button>
    </div>`;
  }
  html += '</div>';

  // Smart split basket
  const appGroups = {};
  for (const [id, qty] of Object.entries(basket)) {
    const { app, price } = itemCheapest[id] || {};
    if (!app) continue;
    if (!appGroups[app.id]) appGroups[app.id] = { app, items: [] };
    appGroups[app.id].items.push({ id, qty, price });
  }

  html += `<div class="optimal-section">
    <div class="optimal-title">🎯 Smart Split Basket
      <span style="font-size:0.73rem;color:var(--muted);font-family:'DM Sans';font-weight:400">— each item from its cheapest app</span>
    </div>
    <div class="optimal-card">`;

  for (const [appId, g] of Object.entries(appGroups)) {
    html += `<div style="padding:0.65rem 1.1rem;background:rgba(${hexToRgb(g.app.color)},0.07);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0.6rem">
      <div style="width:26px;height:26px;border-radius:7px;background:${g.app.color};color:${g.app.textColor};display:flex;align-items:center;justify-content:center;font-size:0.8rem;flex-shrink:0">${g.app.emoji}</div>
      <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.83rem">${g.app.name}</span>
      <span style="font-size:0.73rem;color:var(--muted)">— ${g.items.length} item${g.items.length>1?'s':''}</span>
      <button class="go-btn" style="background:${g.app.color};color:${g.app.textColor};width:auto;margin:0;margin-left:auto;padding:0.28rem 0.8rem;font-size:0.73rem"
        onclick="openApp('${appId}','${g.app.deeplink(currentCity)}')">Open →</button>
    </div>`;
    for (const item of g.items) {
      const p = getProduct(item.id);
      if (!p) continue;
      html += `<div class="optimal-row">
        <span class="opt-emoji">${p.emoji}</span>
        <span class="opt-name">${p.name}${customItems[item.id]?'<span style="font-size:0.65rem;color:var(--accent);margin-left:0.3rem">✏️custom</span>':''}</span>
        <span class="opt-qty">${p.unit} × ${item.qty}</span>
        <span class="opt-price">₹${item.price * item.qty}</span>
      </div>`;
    }
  }

  const smartTotal = Object.entries(basket).reduce((s,[id,qty]) => s + (itemCheapest[id]?.price||0)*qty, 0);
  html += `<div style="padding:0.9rem 1.1rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:0.8rem;color:var(--muted)">Items total (before delivery)</span>
    <span style="font-family:'Syne',sans-serif;font-weight:800;color:var(--accent);font-size:1.05rem">₹${smartTotal}</span>
  </div></div></div>`;

  area.innerHTML = html;
}

window.openApp = function (appId, url) {
  showToast(`🛒 Opening ${APPS.find(a=>a.id===appId)?.name}…`, 'success');
  setTimeout(() => window.open(url, '_blank'), 600);
};

window.clearResults = function () {
  document.getElementById('emptyState').style.display = 'flex';
  const r = document.getElementById('resultsArea');
  r.style.display = 'none'; r.innerHTML = '';
};

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '0,0,0';
}

// ——— INIT ———
document.addEventListener('DOMContentLoaded', async () => {
  renderProducts();
  updateBasketUI();
  const connected = await tryAutoInitFirebase();
  if (!connected) setTimeout(() => {
    document.getElementById('firebaseSetupModal').classList.remove('hidden');
  }, 800);
});
