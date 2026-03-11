// ============================================================
//  QuickBasket — app.js
//  Core UI logic, basket management, comparison engine
// ============================================================

// ——— Global state ———
window.basket = {};
window.currentCity = 'Mumbai';
let activeCategory = 'all';
let searchQuery = '';

// ——— Toast helper ———
window.showToast = function (msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.classList.add('hidden'); }, 3200);
};

// ——— Location ———
window.selectCity = function (city) {
  currentCity = city;
  document.getElementById('locDisplay').textContent = city;
  document.getElementById('locationInput').value = city;
  document.querySelectorAll('.modal-city').forEach(el =>
    el.classList.toggle('selected', el.textContent.includes(city)));
};

window.confirmLocation = function () {
  const val = document.getElementById('locationInput').value.trim();
  if (val) { currentCity = val; document.getElementById('locDisplay').textContent = val; }
  document.getElementById('locationModal').classList.add('hidden');
  clearResults();
};

// ——— Category filter ———
window.filterCat = function (cat, el) {
  activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  renderProducts();
};

// ——— Product search filter ———
window.filterProducts = function () {
  searchQuery = document.getElementById('searchInput').value.toLowerCase();
  renderProducts();
};

// ——— Render product list ———
window.renderProducts = function () {
  const list = document.getElementById('productList');
  const filtered = PRODUCTS.filter(p => {
    const matchCat = activeCategory === 'all' || p.cat === activeCategory;
    const matchQ   = !searchQuery || p.name.toLowerCase().includes(searchQuery);
    return matchCat && matchQ;
  });

  if (!filtered.length) {
    list.innerHTML = `<p style="font-size:0.8rem;color:var(--muted);padding:1rem 0;text-align:center">No products found</p>`;
    return;
  }

  list.innerHTML = filtered.map(p => {
    const qty = basket[p.id] || 0;
    const inBasket = qty > 0;
    return `
    <div class="product-item${inBasket ? ' in-basket' : ''}">
      <span class="product-emoji">${p.emoji}</span>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-unit">${p.unit}</div>
      </div>
      <span class="product-price">₹${p.basePrice}</span>
      ${inBasket
        ? `<div class="qty-stepper">
             <button onclick="changeQty('${p.id}',-1)">−</button>
             <span class="qty-num">${qty}</span>
             <button onclick="changeQty('${p.id}',1)">+</button>
           </div>`
        : `<button class="add-btn" onclick="addToBasket('${p.id}')">+</button>`
      }
    </div>`;
  }).join('');
};

// ——— Basket actions ———
window.addToBasket = function (id) {
  basket[id] = 1;
  updateBasketUI();
  renderProducts();
};

window.changeQty = function (id, delta) {
  basket[id] = (basket[id] || 0) + delta;
  if (basket[id] <= 0) delete basket[id];
  updateBasketUI();
  renderProducts();
};

window.removeFromBasket = function (id) {
  delete basket[id];
  updateBasketUI();
  renderProducts();
  clearResults();
};

window.clearBasket = function () {
  basket = {};
  updateBasketUI();
  renderProducts();
  clearResults();
};

window.updateBasketUI = function () {
  const tags = document.getElementById('basketTags');
  const btn  = document.getElementById('compareBtn');
  const saveBtn  = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const items = Object.keys(basket);

  if (!items.length) {
    tags.innerHTML = `<span style="font-size:0.8rem;color:var(--muted)">Add items from the left to compare</span>`;
    btn.disabled = true;
    saveBtn.classList.add('hidden');
    clearBtn.classList.add('hidden');
    return;
  }

  tags.innerHTML = items.map(id => {
    const p = PRODUCTS.find(x => x.id === id);
    return `<div class="basket-tag">
      <span class="tag-emoji">${p.emoji}</span>
      <span>${p.name} ×${basket[id]}</span>
      <span class="remove-tag" onclick="removeFromBasket('${id}')">✕</span>
    </div>`;
  }).join('');

  btn.disabled = false;
  saveBtn.classList.remove('hidden');
  clearBtn.classList.remove('hidden');
};

// ——— Saved baskets panel ———
window.toggleSavedPanel = function () {
  document.getElementById('savedPanel').classList.toggle('hidden');
};

// ——— Report modal ———
window.openReportModal = function () {
  // Populate product dropdown
  const sel = document.getElementById('reportProduct');
  sel.innerHTML = '<option value="">Select Product</option>' +
    PRODUCTS.map(p => `<option value="${p.id}">${p.emoji} ${p.name} (${p.unit})</option>`).join('');
  document.getElementById('reportCity').value = currentCity;
  document.getElementById('reportModal').classList.remove('hidden');
};

// ——— Price calculation ———
function calcAppTotal(app) {
  let subtotal = 0;
  const itemPrices = {};
  for (const [id, qty] of Object.entries(basket)) {
    const p    = PRODUCTS.find(x => x.id === id);
    const mult = app.priceMultiplier[id] ?? app.priceMultiplier.default;
    const price = Math.round(p.basePrice * mult);
    itemPrices[id] = price;
    subtotal += price * qty;
  }
  const delivery   = app.deliveryFee(subtotal);
  const handling   = app.handlingFee(subtotal);
  const platform   = app.platformFee(subtotal);
  const smallOrder = app.smallOrderFee(subtotal);
  const total      = subtotal + delivery + handling + platform + smallOrder;
  return { subtotal, delivery, handling, platform, smallOrder, total, itemPrices };
}

// ——— Run comparison ———
window.runComparison = async function () {
  const loading     = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  loading.classList.remove('hidden');

  const msgs = [
    'Fetching prices from Blinkit…',
    'Checking Zepto inventory…',
    'Comparing Instamart rates…',
    'Analyzing BB Now prices…',
    'Calculating delivery charges…',
    'Finding the best deals for you…',
  ];
  let i = 0;
  const interval = setInterval(() => { loadingText.textContent = msgs[i++ % msgs.length]; }, 550);
  await new Promise(r => setTimeout(r, 2600));
  clearInterval(interval);
  loading.classList.add('hidden');

  renderResults();
};

// ——— Render results ———
function renderResults() {
  document.getElementById('emptyState').style.display = 'none';
  const area = document.getElementById('resultsArea');
  area.style.display = 'block';

  const apps    = APPS; // all apps (city filtering could be added here)
  const results = apps.map(app => ({ app, ...calcAppTotal(app) }));
  results.sort((a, b) => a.total - b.total);

  const cheapest     = results[0];
  const mostExpensive= results[results.length - 1];
  const savings      = mostExpensive.total - cheapest.total;

  // Per-item cheapest
  const itemCheapest = {};
  for (const id of Object.keys(basket)) {
    let best = null, bestPrice = Infinity;
    for (const r of results) {
      if (r.itemPrices[id] < bestPrice) { bestPrice = r.itemPrices[id]; best = r.app; }
    }
    itemCheapest[id] = { app: best, price: bestPrice };
  }

  // Log to Firebase
  const logResults = results.map(r => ({ appId: r.app.id, total: r.total }));
  const logItems   = Object.entries(basket).map(([id, qty]) => ({ id, qty }));
  logComparison(currentCity, logItems, logResults);

  let html = '';

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
    const isCheapest = r.app.id === cheapest.app.id;
    html += `
    <div class="app-card${isCheapest ? ' cheapest' : ''}">
      ${isCheapest ? '<div class="cheapest-badge">⚡ Best Price</div>' : ''}
      <div class="app-card-header">
        <div class="app-logo-circle" style="background:${r.app.color};color:${r.app.textColor}">${r.app.emoji}</div>
        <div class="app-meta">
          <div class="app-name">${r.app.name}</div>
          <div class="app-eta">🕐 ${r.app.eta} · Free over ₹${r.app.freeDeliveryAbove}</div>
        </div>
      </div>

      <div class="app-total-area">
        <div class="total-label">Total to pay</div>
        <div class="total-amount" style="color:${isCheapest ? 'var(--accent)' : 'var(--text)'}">₹${r.total}</div>
      </div>

      <div class="fee-rows">
        <div class="fee-row">
          <span class="fee-name">Items subtotal</span>
          <span class="fee-val">₹${r.subtotal}</span>
        </div>
        <div class="fee-row${r.delivery === 0 ? ' free' : ''}">
          <span class="fee-name">Delivery fee${r.delivery === 0 ? ' 🎉' : ''}</span>
          <span class="fee-val">${r.delivery === 0 ? 'FREE' : '₹' + r.delivery}</span>
        </div>
        ${r.handling   > 0 ? `<div class="fee-row"><span class="fee-name">Handling fee</span><span class="fee-val">₹${r.handling}</span></div>` : ''}
        ${r.platform   > 0 ? `<div class="fee-row"><span class="fee-name">Platform fee</span><span class="fee-val">₹${r.platform}</span></div>` : ''}
        ${r.smallOrder > 0 ? `<div class="fee-row"><span class="fee-name">Small order fee</span><span class="fee-val">₹${r.smallOrder}</span></div>` : ''}
        <div class="fee-row divider">
          <span>Grand Total</span>
          <span>₹${r.total}</span>
        </div>
      </div>

      <div class="item-list">
        ${Object.entries(basket).map(([id, qty]) => {
          const p            = PRODUCTS.find(x => x.id === id);
          const price        = r.itemPrices[id];
          const isBest       = itemCheapest[id].app.id === r.app.id;
          return `<div class="item-row">
            <span class="item-left">${p.emoji} ${p.name} ×${qty}</span>
            <span class="item-right">${isBest ? '✅ ' : ''}₹${price * qty}</span>
          </div>`;
        }).join('')}
      </div>

      <button class="go-btn"
        style="background:${r.app.color};color:${r.app.textColor}"
        onclick="openApp('${r.app.id}','${r.app.deeplink(currentCity)}')">
        Order on ${r.app.name} →
      </button>
    </div>`;
  }
  html += `</div>`;

  // Smart Split Basket
  const appGroups = {};
  for (const [id, qty] of Object.entries(basket)) {
    const { app, price } = itemCheapest[id];
    if (!appGroups[app.id]) appGroups[app.id] = { app, items: [] };
    appGroups[app.id].items.push({ id, qty, price });
  }

  html += `<div class="optimal-section">
    <div class="optimal-title">🎯 Smart Split Basket
      <span style="font-size:0.73rem;color:var(--muted);font-family:'DM Sans';font-weight:400">
        — buy each item from its cheapest app
      </span>
    </div>
    <div class="optimal-card">`;

  for (const [appId, group] of Object.entries(appGroups)) {
    html += `
    <div style="padding:0.65rem 1.1rem;background:rgba(${hexToRgb(group.app.color)},0.06);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0.6rem">
      <div style="width:26px;height:26px;border-radius:7px;background:${group.app.color};color:${group.app.textColor};display:flex;align-items:center;justify-content:center;font-size:0.8rem;flex-shrink:0">${group.app.emoji}</div>
      <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.83rem">${group.app.name}</span>
      <span style="font-size:0.73rem;color:var(--muted)">— ${group.items.length} item${group.items.length > 1 ? 's' : ''}</span>
      <button class="go-btn" style="background:${group.app.color};color:${group.app.textColor};width:auto;margin:0;margin-left:auto;padding:0.28rem 0.8rem;font-size:0.73rem"
        onclick="openApp('${appId}','${group.app.deeplink(currentCity)}')">Open →</button>
    </div>`;

    for (const item of group.items) {
      const p = PRODUCTS.find(x => x.id === item.id);
      html += `<div class="optimal-row">
        <span class="opt-emoji">${p.emoji}</span>
        <span class="opt-name">${p.name}</span>
        <span class="opt-qty">${p.unit} × ${item.qty}</span>
        <span class="opt-price">₹${item.price * item.qty}</span>
      </div>`;
    }
  }

  const smartTotal = Object.entries(basket).reduce((s, [id, qty]) => s + itemCheapest[id].price * qty, 0);
  const fullTotal  = cheapest.total;
  html += `<div style="padding:0.9rem 1.1rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:0.8rem;color:var(--muted)">Smart Basket (items only, no delivery)</span>
    <span style="font-family:'Syne',sans-serif;font-weight:800;color:var(--accent);font-size:1.05rem">₹${smartTotal}</span>
  </div>`;

  html += `</div></div>`;
  area.innerHTML = html;
}

// ——— Open app ———
window.openApp = function (appId, url) {
  const appName = APPS.find(a => a.id === appId)?.name || 'App';
  showToast(`🛒 Opening ${appName}…`, 'success');
  setTimeout(() => window.open(url, '_blank'), 600);
};

// ——— Clear results ———
window.clearResults = function () {
  document.getElementById('emptyState').style.display = 'flex';
  const r = document.getElementById('resultsArea');
  r.style.display = 'none';
  r.innerHTML = '';
};

// ——— Hex → RGB helper ———
function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '0,0,0';
}

// ——— Init ———
document.addEventListener('DOMContentLoaded', async () => {
  renderProducts();
  updateBasketUI();

  // Try auto-connecting Firebase from saved config
  const connected = await tryAutoInitFirebase();
  if (!connected) {
    // Show setup modal after a short delay
    setTimeout(() => {
      document.getElementById('firebaseSetupModal').classList.remove('hidden');
    }, 800);
  }
});
