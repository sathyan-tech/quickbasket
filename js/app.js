// ============================================================
//  QuickBasket — app.js  v4
//  Fixed search (tags+brand+name), brand/size comparison view
// ============================================================

window.basket       = {};
window.customItems  = {};
window.currentCity  = 'Mumbai';
window.currentLat   = null;
window.currentLng   = null;
window.activeCategory = 'all';
window.searchQuery    = '';

// ——— Toast ———
window.showToast = function (msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3800);
};

// ================================================================
//  GPS
// ================================================================
window.detectLocation = function () {
  const btn  = document.getElementById('gpsBtn');
  const info = document.getElementById('gpsInfo');
  if (!('geolocation' in navigator)) {
    info.innerHTML = '❌ GPS not supported. Type your city below.';
    info.style.color = 'var(--danger)'; return;
  }
  btn.innerHTML = '📡 Requesting permission…'; btn.disabled = true;
  info.innerHTML = '⏳ Waiting for location access…'; info.style.color = 'var(--muted)';
  navigator.geolocation.getCurrentPosition(onGPSSuccess, onGPSError,
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
};

async function onGPSSuccess(pos) {
  const btn = document.getElementById('gpsBtn'), info = document.getElementById('gpsInfo');
  window.currentLat = pos.coords.latitude; window.currentLng = pos.coords.longitude;
  info.innerHTML = `✅ GPS: ${window.currentLat.toFixed(5)}, ${window.currentLng.toFixed(5)} (±${Math.round(pos.coords.accuracy)}m) — Reverse geocoding…`;
  info.style.color = 'var(--accent)';
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${window.currentLat}&lon=${window.currentLng}&format=json&addressdetails=1&accept-language=en`);
    const data = await res.json();
    const addr = data.address || {};
    const loc  = addr.suburb || addr.neighbourhood || addr.village || '';
    const city = addr.city || addr.town || addr.county || addr.state || 'Your Location';
    const disp = loc ? `${loc}, ${city}` : city;
    window.currentCity = city;
    document.getElementById('locDisplay').textContent = disp;
    document.getElementById('locationInput').value    = disp;
    document.querySelectorAll('.modal-city').forEach(el =>
      el.classList.toggle('selected', el.textContent.toLowerCase().includes(city.toLowerCase())));
    info.innerHTML = `📍 <strong>${disp}</strong> — confirmed!`;
    showToast(`📍 ${disp}`, 'success');
  } catch(e) {
    window.currentCity = `${window.currentLat.toFixed(4)},${window.currentLng.toFixed(4)}`;
    document.getElementById('locDisplay').textContent = '📍 GPS Location';
    document.getElementById('locationInput').value    = window.currentCity;
    info.innerHTML = `📍 GPS detected (city lookup failed — check internet)`;
    showToast('📍 GPS location detected', 'success');
  }
  btn.innerHTML = '📍 Use My Current Location'; btn.disabled = false;
  setTimeout(() => { document.getElementById('locationModal').classList.add('hidden'); clearResults(); }, 1200);
}

function onGPSError(err) {
  const btn = document.getElementById('gpsBtn'), info = document.getElementById('gpsInfo');
  btn.innerHTML = '📍 Use My Current Location'; btn.disabled = false;
  const msgs = {
    1:'🔒 <strong>Permission denied.</strong><br><small>Tap 🔒 in address bar → Site settings → Location → Allow, then retry.</small>',
    2:'📡 <strong>Location unavailable.</strong><br><small>Turn on GPS/Location in your device settings.</small>',
    3:'⏱️ <strong>Timed out.</strong><br><small>Move to better signal or turn on Wi-Fi.</small>',
  };
  info.innerHTML = msgs[err.code] || '❌ Unknown error.'; info.style.color = 'var(--danger)';
}

window.selectCity = function (city) {
  window.currentCity = city;
  document.getElementById('locDisplay').textContent = city;
  document.getElementById('locationInput').value    = city;
  document.querySelectorAll('.modal-city').forEach(el =>
    el.classList.toggle('selected', el.textContent.includes(city)));
  const info = document.getElementById('gpsInfo');
  if (info) { info.innerHTML = `✅ Selected: <strong>${city}</strong>`; info.style.color = 'var(--accent)'; }
};
window.confirmLocation = function () {
  const val = document.getElementById('locationInput').value.trim();
  if (val) { window.currentCity = val; document.getElementById('locDisplay').textContent = val; }
  document.getElementById('locationModal').classList.add('hidden'); clearResults();
};

// ================================================================
//  CUSTOM PRODUCT
// ================================================================
window.openCustomProductModal = function () {
  document.getElementById('customProductModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('cp_name').focus(), 100);
};
window.addCustomProduct = function () {
  const name  = document.getElementById('cp_name').value.trim();
  const price = parseFloat(document.getElementById('cp_price').value);
  const unit  = document.getElementById('cp_unit').value.trim() || '1 pc';
  const emoji = document.getElementById('cp_emoji').value.trim() || '📦';
  if (!name)         { showToast('Enter a product name', 'error'); return; }
  if (!price || price <= 0) { showToast('Enter a valid price', 'error'); return; }
  const id = 'custom_' + Date.now();
  window.customItems[id] = { name, brand: 'Custom', emoji, unit, basePrice: price, tags: [name.toLowerCase()] };
  window.basket[id] = 1;
  ['cp_name','cp_price','cp_unit'].forEach(f => document.getElementById(f).value = '');
  document.getElementById('customProductModal').classList.add('hidden');
  updateBasketUI(); showToast(`✅ "${name}" added!`, 'success');
};
window.getProduct = id => PRODUCTS.find(x => x.id === id) || window.customItems[id] || null;

// ================================================================
//  SEARCH — searches name + brand + tags, supports Hindi aliases
// ================================================================
const ALIASES = {
  anda:'eggs',ande:'eggs',doodh:'milk',dudh:'milk',makhan:'butter',makkhan:'butter',
  dahi:'curd',panir:'paneer',chaas:'buttermilk',chhaas:'buttermilk',
  aata:'atta',ata:'atta',chawal:'rice',chaawal:'rice',cheeni:'sugar',chini:'sugar',
  namak:'salt',tel:'oil',
  pyaaz:'onion',pyaz:'onion',kanda:'onion',
  aloo:'potato',alu:'potato',
  tamatar:'tomato',palak:'spinach',saag:'spinach',
  gajar:'carrot',bhindi:'ladyfinger',baingan:'eggplant',brinjal:'eggplant',
  mirchi:'chilli',hari:'green chilli',lal:'red chilli',
  adrak:'ginger',lehsun:'garlic',lasan:'garlic',
  nimbu:'lemon',kela:'banana',seb:'apple',aam:'mango',
  santara:'orange',angur:'grapes',tarbooz:'watermelon',tarbuj:'watermelon',
  anar:'pomegranate',amrood:'guava',papita:'papaya',nariyal:'coconut',
  chai:'tea',chai:'tea',sabun:'soap',
  jheenga:'prawn',murga:'chicken',machli:'fish',gosht:'mutton',
  pani:'water',paani:'water',
  daal:'dal',
  sooji:'suji',rawa:'suji',rava:'suji',
  sarson:'mustard',sarso:'mustard',jeera:'cumin',haldi:'turmeric',
  dhania:'coriander',imli:'tamarind',
  diaper:'diapers',nappy:'diapers',
  jhadu:'broom',bartan:'dishwash',pocha:'mop',
  moongphali:'peanuts',badam:'almonds',kaju:'cashew',akhrot:'walnuts',kishmish:'raisins',
  matar:'peas',bhutta:'corn',
  phool:'cauliflower',gobi:'cauliflower',
  methi:'fenugreek',pudina:'mint',dhania:'coriander',
  // brand shortcuts
  'amul':'amul','nestle':'nestle','britannia':'britannia','parle':'parle',
  'haldiram':'haldiram','maggi':'maggi','cadbury':'cadbury','tata':'tata',
  'patanjali':'patanjali','licious':'licious','kelloggs':'cornflakes',
};

window.filterCat = function (cat, el) {
  window.activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active'); renderProducts();
};

window.filterProducts = function () {
  const raw = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  // Use alias if exact match exists, otherwise search raw text directly
  window.searchQuery = (ALIASES[raw] !== undefined && ALIASES[raw] !== '') ? ALIASES[raw] : raw;
  renderProducts();
};

// Searches name + brand + every tag — any single matching word is enough
function matchesSearch(p, q) {
  if (!q || q.length === 0) return true;
  const haystack = [
    p.name || '',
    p.brand || '',
    ...(p.tags || []),
    p.cat || '',
    p.unit || '',
  ].join(' ').toLowerCase();
  // Each word in the query must appear in the haystack
  return q.trim().split(/\s+/).filter(Boolean).every(w => haystack.includes(w));
}

// ================================================================
//  RENDER PRODUCTS  — grouped by name with brand/size comparison
// ================================================================
window.renderProducts = function () {
  const list = document.getElementById('productList');
  if (!list) return;
  const q   = window.searchQuery || '';
  const cat = window.activeCategory || 'all';
  const filtered = PRODUCTS.filter(p =>
    (cat === 'all' || p.cat === cat) && matchesSearch(p, q)
  );

  let html = '';

  // Custom product button always visible at top when searching
  if (q) {
    const rawInput = (document.getElementById('searchInput').value || '').trim();
    html += `<div style="background:rgba(0,229,160,0.06);border:1px dashed rgba(0,229,160,0.35);border-radius:10px;padding:0.7rem;margin-bottom:0.6rem">
      <div style="font-size:0.75rem;font-weight:600;color:var(--accent);margin-bottom:0.25rem">Can't find "${rawInput}"?</div>
      <button onclick="openCustomProductModal()" style="width:100%;padding:0.35rem;border-radius:7px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:0.76rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">+ Add Custom Product</button>
    </div>`;
  }

  if (!filtered.length) {
    if (!q) html += `<div style="padding:1rem 0;text-align:center;color:var(--muted);font-size:0.8rem">No products in this category</div>`;
    list.innerHTML = html; return;
  }

  // Group products by their base name (strip brand) to show brand/size comparisons
  const groups = {};
  for (const p of filtered) {
    const key = p.name; // group by product name
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  for (const [groupName, items] of Object.entries(groups)) {
    if (items.length === 1) {
      // Single result — show normally
      html += renderProductCard(items[0]);
    } else {
      // Multiple brands/sizes — show compact comparison group
      // Sort by price ascending so cheapest is first
      items.sort((a, b) => a.basePrice - b.basePrice);
      const cheapest = items[0];

      html += `<div class="product-group">
        <div class="group-header">
          <span class="group-emoji">${cheapest.emoji}</span>
          <span class="group-name">${groupName}</span>
          <span class="group-count">${items.length} options</span>
        </div>`;

      for (const p of items) {
        const isCheapest = p.id === cheapest.id;
        const qty = window.basket[p.id] || 0;
        const inB = qty > 0;
        html += `
        <div class="group-item${inB ? ' in-basket' : ''}${isCheapest ? ' cheapest-item' : ''}">
          <div class="group-item-left">
            ${isCheapest ? '<span class="cheapest-tag">💰 Cheapest</span>' : ''}
            <div class="group-brand">${p.brand}</div>
            <div class="group-unit-price">
              <span class="gi-unit">${p.unit}</span>
              <span class="gi-price">₹${p.basePrice}</span>
              ${items.length > 1 ? `<span class="gi-per">(₹${perUnitLabel(p)} per unit)</span>` : ''}
            </div>
          </div>
          ${inB
            ? `<div class="qty-stepper sm">
                 <button onclick="changeQty('${p.id}',-1)">−</button>
                 <span class="qty-num">${qty}</span>
                 <button onclick="changeQty('${p.id}',1)">+</button>
               </div>`
            : `<button class="add-btn sm" onclick="addToBasket('${p.id}')">+</button>`
          }
        </div>`;
      }
      html += `</div>`;
    }
  }

  list.innerHTML = html;
};

function renderProductCard(p) {
  const qty = window.basket[p.id] || 0;
  const inB = qty > 0;
  return `
  <div class="product-item${inB ? ' in-basket' : ''}">
    <span class="product-emoji">${p.emoji}</span>
    <div class="product-info">
      <div class="product-name">${p.name}</div>
      <div class="product-unit">${p.brand ? `<span style="color:var(--accent);font-size:0.68rem">${p.brand}</span> · ` : ''}${p.unit}</div>
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
}

// ——— per-unit price label (normalises to per 100g / per 100ml) ———
function perUnitLabel(p) {
  const u = (p.unit || '').toLowerCase();
  const match = u.match(/([\d.]+)\s*(kg|g|ml|l|ltr)/);
  if (!match) return `₹${p.basePrice}`;
  let qty = parseFloat(match[1]);
  const unit = match[2];
  if (unit === 'kg' || unit === 'l' || unit === 'ltr') qty *= 1000;
  if (qty <= 0) return `₹${p.basePrice}`;
  const per100 = Math.round(p.basePrice / qty * 100);
  const unitLabel = (unit === 'l' || unit === 'ltr' || unit === 'ml') ? 'ml' : 'g';
  return `₹${per100}/100${unitLabel}`;
}

// ================================================================
//  BASKET
// ================================================================
window.addToBasket = function (id) { window.basket[id] = 1; updateBasketUI(); renderProducts(); };
window.changeQty   = function (id, delta) {
  window.basket[id] = (window.basket[id] || 0) + delta;
  if (window.basket[id] <= 0) { delete window.basket[id]; if (window.customItems[id]) delete window.customItems[id]; }
  updateBasketUI(); renderProducts();
};
window.removeFromBasket = function (id) {
  delete window.basket[id]; if (window.customItems[id]) delete window.customItems[id];
  updateBasketUI(); renderProducts(); clearResults();
};
window.clearBasket = function () {
  if (!Object.keys(window.basket).length) return;
  if (!confirm('Clear all items?')) return;
  window.basket = {}; window.customItems = {};
  updateBasketUI(); renderProducts(); clearResults();
};

window.updateBasketUI = function () {
  const tags    = document.getElementById('basketTags');
  const btn     = document.getElementById('compareBtn');
  const saveBtn = document.getElementById('saveBtn');
  const clrBtn  = document.getElementById('clearBtn');
  const items   = Object.keys(window.basket);
  if (!items.length) {
    tags.innerHTML = `<span style="font-size:0.8rem;color:var(--muted)">Add items or custom products to compare</span>`;
    btn.disabled = true; saveBtn.classList.add('hidden'); clrBtn.classList.add('hidden'); return;
  }
  tags.innerHTML = items.map(id => {
    const p = getProduct(id); if (!p) return '';
    return `<div class="basket-tag${window.customItems[id]?' custom-tag':''}">
      <span class="tag-emoji">${p.emoji}</span>
      <span>${p.brand ? p.brand+' ' : ''}${p.name} ${p.unit} ×${window.basket[id]}</span>
      ${window.customItems[id] ? '<span style="font-size:0.65rem;color:var(--accent)">✏️</span>' : ''}
      <span class="remove-tag" onclick="removeFromBasket('${id}')">✕</span>
    </div>`;
  }).join('');
  btn.disabled = false; saveBtn.classList.remove('hidden'); clrBtn.classList.remove('hidden');
};

// ================================================================
//  PANELS
// ================================================================
window.toggleSavedPanel = function () { document.getElementById('savedPanel').classList.toggle('hidden'); };
window.openReportModal  = function () {
  const sel = document.getElementById('reportProduct');
  sel.innerHTML = '<option value="">Select Product</option>' +
    PRODUCTS.map(p => `<option value="${p.id}">${p.emoji} ${p.brand} ${p.name} (${p.unit})</option>`).join('');
  document.getElementById('reportCity').value = window.currentCity;
  document.getElementById('reportModal').classList.remove('hidden');
};

// ================================================================
//  PRICE CALCULATION
// ================================================================
function calcAppTotal(app) {
  let subtotal = 0;
  const itemPrices = {};
  for (const [id, qty] of Object.entries(window.basket)) {
    const p = getProduct(id); if (!p) continue;
    const mult  = app.priceMultiplier[id] ?? app.priceMultiplier.default;
    const price = Math.round(p.basePrice * mult);
    itemPrices[id] = price; subtotal += price * qty;
  }
  const delivery   = app.deliveryFee(subtotal);
  const handling   = app.handlingFee(subtotal);
  const platform   = app.platformFee(subtotal);
  const smallOrder = app.smallOrderFee(subtotal);
  return { subtotal, delivery, handling, platform, smallOrder, total: subtotal+delivery+handling+platform+smallOrder, itemPrices };
}

// ================================================================
//  COMPARISON
// ================================================================
window.runComparison = async function () {
  const loading = document.getElementById('loadingOverlay'), lt = document.getElementById('loadingText');
  loading.classList.remove('hidden');
  const msgs = ['Checking Blinkit…','Scanning Zepto…','Comparing Instamart…','Analysing BB Now…','Calculating fees…','Finding your best deal…'];
  let i = 0; const iv = setInterval(() => { lt.textContent = msgs[i++ % msgs.length]; }, 520);
  await new Promise(r => setTimeout(r, 2400));
  clearInterval(iv); loading.classList.add('hidden'); renderResults();
};

function renderResults() {
  document.getElementById('emptyState').style.display = 'none';
  const area = document.getElementById('resultsArea'); area.style.display = 'block';

  const results = APPS.map(app => ({ app, ...calcAppTotal(app) }));
  results.sort((a, b) => a.total - b.total);
  const cheapest = results[0], priciest = results[results.length-1];
  const savings  = priciest.total - cheapest.total;

  const itemCheapest = {};
  for (const id of Object.keys(window.basket)) {
    let best = null, bestPrice = Infinity;
    for (const r of results) {
      if ((r.itemPrices[id] ?? Infinity) < bestPrice) { bestPrice = r.itemPrices[id]; best = r.app; }
    }
    itemCheapest[id] = { app: best, price: bestPrice };
  }

  logComparison(window.currentCity, Object.entries(window.basket).map(([id,qty]) => ({ id, qty })), results.map(r => ({ appId: r.app.id, total: r.total })));

  let html = `<div style="display:flex;align-items:center;gap:0.5rem;font-size:0.78rem;color:var(--muted);margin-bottom:1rem;flex-wrap:wrap">
    <span>📍 <strong style="color:var(--text)">${window.currentCity}</strong>${window.currentLat?` <span style="font-size:0.7rem;opacity:0.6">(GPS ${window.currentLat.toFixed(3)}, ${window.currentLng.toFixed(3)})</span>`:''}</span>
    <button onclick="document.getElementById('locationModal').classList.remove('hidden')"
      style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:6px;padding:0.2rem 0.6rem;color:var(--muted);font-size:0.72rem;cursor:pointer">Change ▾</button>
  </div>`;

  const customCount = Object.keys(window.customItems).length;
  if (customCount > 0)
    html += `<div style="background:rgba(0,229,160,0.06);border:1px solid rgba(0,229,160,0.2);border-radius:10px;padding:0.65rem 1rem;font-size:0.78rem;color:var(--muted);margin-bottom:1rem">
      ✏️ <strong style="color:var(--accent)">${customCount} custom item${customCount>1?'s':''}</strong> included with user-entered prices</div>`;

  if (savings > 0)
    html += `<div class="savings-banner"><div class="save-big">💰</div><div>
      <div class="savings-num">Save ₹${savings}</div>
      <div class="savings-sub">ordering from <strong>${cheapest.app.name}</strong> vs most expensive</div>
    </div></div>`;

  // ——— App cards ———
  html += `<div class="app-cards">`;
  for (const r of results) {
    const isBest = r.app.id === cheapest.app.id;
    html += `<div class="app-card${isBest?' cheapest':''}">
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
        ${Object.entries(window.basket).map(([id,qty]) => {
          const p = getProduct(id); if(!p) return '';
          const price = r.itemPrices[id]??0;
          const isBestItem = itemCheapest[id]?.app?.id === r.app.id;
          return `<div class="item-row">
            <span class="item-left">${p.emoji} <strong>${p.brand||''}</strong> ${p.name} ${p.unit} ×${qty}</span>
            <span class="item-right">${isBestItem?'✅ ':''}₹${price*qty}</span>
          </div>`;
        }).join('')}
      </div>
      <button class="go-btn" style="background:${r.app.color};color:${r.app.textColor}"
        onclick="openApp('${r.app.id}','${r.app.deeplink(window.currentCity)}')">Order on ${r.app.name} →</button>
    </div>`;
  }
  html += '</div>';

  // ——— Smart split basket ———
  const appGroups = {};
  for (const [id,qty] of Object.entries(window.basket)) {
    const { app, price } = itemCheapest[id] || {}; if(!app) continue;
    if (!appGroups[app.id]) appGroups[app.id] = { app, items:[] };
    appGroups[app.id].items.push({ id, qty, price });
  }
  html += `<div class="optimal-section">
    <div class="optimal-title">🎯 Smart Split Basket
      <span style="font-size:0.73rem;color:var(--muted);font-family:'DM Sans';font-weight:400">— each item from cheapest app</span>
    </div>
    <div class="optimal-card">`;
  for (const [appId, g] of Object.entries(appGroups)) {
    html += `<div style="padding:0.65rem 1.1rem;background:rgba(${hexToRgb(g.app.color)},0.07);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0.6rem">
      <div style="width:26px;height:26px;border-radius:7px;background:${g.app.color};color:${g.app.textColor};display:flex;align-items:center;justify-content:center;font-size:0.8rem;flex-shrink:0">${g.app.emoji}</div>
      <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.83rem">${g.app.name}</span>
      <span style="font-size:0.73rem;color:var(--muted)">— ${g.items.length} item${g.items.length>1?'s':''}</span>
      <button class="go-btn" style="background:${g.app.color};color:${g.app.textColor};width:auto;margin:0;margin-left:auto;padding:0.28rem 0.8rem;font-size:0.73rem"
        onclick="openApp('${appId}','${g.app.deeplink(window.currentCity)}')">Open →</button>
    </div>`;
    for (const item of g.items) {
      const p = getProduct(item.id); if(!p) continue;
      html += `<div class="optimal-row">
        <span class="opt-emoji">${p.emoji}</span>
        <span class="opt-name"><strong>${p.brand||''}</strong> ${p.name}</span>
        <span class="opt-qty">${p.unit} × ${item.qty}</span>
        <span class="opt-price">₹${item.price * item.qty}</span>
      </div>`;
    }
  }
  const smartTotal = Object.entries(window.basket).reduce((s,[id,qty]) => s + (itemCheapest[id]?.price||0)*qty, 0);
  html += `<div style="padding:0.9rem 1.1rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:0.8rem;color:var(--muted)">Items total (before delivery)</span>
    <span style="font-family:'Syne',sans-serif;font-weight:800;color:var(--accent);font-size:1.05rem">₹${smartTotal}</span>
  </div></div></div>`;

  area.innerHTML = html;
}

window.openApp = function(appId, url) {
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

// ——— Stubs so code never crashes if firebase.js hasn't loaded yet ———
if (!window.logComparison)        window.logComparison        = async () => {};
if (!window.saveBasketToFirebase) window.saveBasketToFirebase = async () => showToast('Firebase loading…','');
if (!window.loadSavedBaskets)     window.loadSavedBaskets     = async () => {};
if (!window.tryAutoInitFirebase)  window.tryAutoInitFirebase  = async () => false;

document.addEventListener('DOMContentLoaded', () => {
  // Wire search directly in JS — belt AND suspenders alongside the oninput attribute
  const searchEl = document.getElementById('searchInput');
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      const raw = this.value.trim().toLowerCase();
      window.searchQuery = (ALIASES[raw] !== undefined && ALIASES[raw] !== '') ? ALIASES[raw] : raw;
      window.renderProducts();
    });
  }

  // Load firebase.js as a plain script — it self-initialises
  const fbScript = document.createElement('script');
  fbScript.src = 'js/firebase.js';
  document.head.appendChild(fbScript);

  // Render UI immediately
  window.renderProducts();
  window.updateBasketUI();
});
