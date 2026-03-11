// ============================================================
//  QuickBasket — app.js  v5  (clean rewrite — all window globals)
// ============================================================

window.basket        = {};
window.customItems   = {};
window.currentCity   = 'Mumbai';
window.currentLat    = null;
window.currentLng    = null;
window.activeCategory = 'all';
window.searchQuery    = '';

// ── Toast ─────────────────────────────────────────────────
window.showToast = function(msg, type) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(t._hide);
  t._hide = setTimeout(function() { t.classList.add('hidden'); }, 3500);
};

// ── getProduct ────────────────────────────────────────────
window.getProduct = function(id) {
  return PRODUCTS.find(function(p) { return p.id === id; }) || window.customItems[id] || null;
};

// ── per-100g/ml label ──────────────────────────────────────
function perUnit(p) {
  var m = (p.unit || '').toLowerCase().match(/([\d.]+)\s*(kg|g|ml|l|ltr)/);
  if (!m) return null;
  var grams = parseFloat(m[1]);
  if (m[2] === 'kg' || m[2] === 'l' || m[2] === 'ltr') grams *= 1000;
  if (grams <= 0) return null;
  var per = Math.round(p.basePrice / grams * 100);
  var lbl = (m[2] === 'ml' || m[2] === 'l' || m[2] === 'ltr') ? 'ml' : 'g';
  return '₹' + per + '/100' + lbl;
}

// ── GPS ───────────────────────────────────────────────────
window.detectLocation = function() {
  var btn  = document.getElementById('gpsBtn');
  var info = document.getElementById('gpsInfo');
  if (!navigator.geolocation) {
    info.textContent = '❌ GPS not supported.'; return;
  }
  btn.textContent = '📡 Detecting…'; btn.disabled = true;
  info.textContent = '⏳ Waiting for GPS…';
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      window.currentLat = pos.coords.latitude;
      window.currentLng = pos.coords.longitude;
      info.textContent = '✅ Got location, looking up city…';
      fetch('https://nominatim.openstreetmap.org/reverse?lat=' + window.currentLat +
            '&lon=' + window.currentLng + '&format=json&accept-language=en')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var a    = d.address || {};
          var city = a.city || a.town || a.county || a.state || 'Your City';
          var area = a.suburb || a.neighbourhood || '';
          var disp = area ? area + ', ' + city : city;
          window.currentCity = city;
          document.getElementById('locDisplay').textContent = disp;
          document.getElementById('locationInput').value = disp;
          info.innerHTML = '📍 <strong>' + disp + '</strong>';
          showToast('📍 ' + disp, 'success');
          btn.textContent = '📍 Use My Current Location (GPS)'; btn.disabled = false;
          setTimeout(function() { document.getElementById('locationModal').classList.add('hidden'); }, 1000);
        })
        .catch(function() {
          window.currentCity = window.currentLat.toFixed(3) + ',' + window.currentLng.toFixed(3);
          document.getElementById('locDisplay').textContent = '📍 GPS';
          info.textContent = '📍 GPS detected (city lookup failed)';
          btn.textContent = '📍 Use My Current Location (GPS)'; btn.disabled = false;
          setTimeout(function() { document.getElementById('locationModal').classList.add('hidden'); }, 1000);
        });
    },
    function(err) {
      btn.textContent = '📍 Use My Current Location (GPS)'; btn.disabled = false;
      var m = { 1:'🔒 Permission denied — allow location in browser settings.',
                2:'📡 Location unavailable.', 3:'⏱️ Timed out.' };
      info.textContent = m[err.code] || '❌ Location error.';
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
};

window.selectCity = function(city) {
  window.currentCity = city;
  document.getElementById('locDisplay').textContent = city;
  document.getElementById('locationInput').value = city;
  document.querySelectorAll('.modal-city').forEach(function(el) {
    el.classList.toggle('selected', el.textContent.includes(city));
  });
  var info = document.getElementById('gpsInfo');
  if (info) info.innerHTML = '✅ Selected: <strong>' + city + '</strong>';
};

window.confirmLocation = function() {
  var v = (document.getElementById('locationInput').value || '').trim();
  if (v) { window.currentCity = v; document.getElementById('locDisplay').textContent = v; }
  document.getElementById('locationModal').classList.add('hidden');
};

// ── Custom product ─────────────────────────────────────────
window.openCustomProductModal = function() {
  document.getElementById('customProductModal').classList.remove('hidden');
  setTimeout(function() { document.getElementById('cp_name').focus(); }, 80);
};

window.addCustomProduct = function() {
  var name  = (document.getElementById('cp_name').value  || '').trim();
  var price = parseFloat(document.getElementById('cp_price').value);
  var unit  = (document.getElementById('cp_unit').value  || '').trim() || '1 pc';
  var emoji = (document.getElementById('cp_emoji').value || '').trim() || '📦';
  if (!name)            { showToast('Enter a product name', 'error'); return; }
  if (!price || price <= 0) { showToast('Enter a valid price > 0', 'error'); return; }
  var id = 'custom_' + Date.now();
  window.customItems[id] = { id: id, name: name, brand: '', emoji: emoji, unit: unit, basePrice: price, cat: 'custom', tags: [] };
  window.basket[id] = 1;
  ['cp_name','cp_price','cp_unit'].forEach(function(f) { document.getElementById(f).value = ''; });
  document.getElementById('customProductModal').classList.add('hidden');
  updateBasketUI();
  showToast('✅ "' + name + '" added!', 'success');
};

// ── Search ────────────────────────────────────────────────
var ALIASES = {
  anda:'eggs', ande:'eggs', doodh:'milk', dudh:'milk',
  makhan:'butter', makkhan:'butter', dahi:'curd', panir:'paneer',
  chaas:'buttermilk', chhaas:'buttermilk', aata:'atta', ata:'atta',
  chawal:'rice', chaawal:'rice', cheeni:'sugar', chini:'sugar',
  namak:'salt', tel:'oil', pyaaz:'onion', pyaz:'onion', kanda:'onion',
  aloo:'potato', alu:'potato', tamatar:'tomato', palak:'spinach',
  saag:'spinach', gajar:'carrot', bhindi:'ladyfinger', baingan:'eggplant',
  mirchi:'chilli', adrak:'ginger', lehsun:'garlic', lasan:'garlic',
  nimbu:'lemon', kela:'banana', seb:'apple', aam:'mango',
  santara:'orange', angur:'grapes', tarbooz:'watermelon',
  anar:'pomegranate', amrood:'guava', papita:'papaya', nariyal:'coconut',
  chai:'tea', sabun:'soap', jheenga:'prawn', murga:'chicken',
  machli:'fish', gosht:'mutton', pani:'water', paani:'water',
  daal:'dal', sooji:'suji', rawa:'suji', rava:'suji',
  sarson:'mustard', jeera:'cumin', haldi:'turmeric', dhania:'coriander',
  imli:'tamarind', diaper:'diapers', nappy:'diapers',
  moongphali:'peanuts', badam:'almonds', kaju:'cashew',
  akhrot:'walnuts', kishmish:'raisins', matar:'peas', bhutta:'corn',
  gobi:'cauliflower', methi:'fenugreek', pudina:'mint'
};

function resolveQuery(raw) {
  return ALIASES[raw] || raw;
}

function matchesSearch(p, q) {
  if (!q) return true;
  var hay = [p.name || '', p.brand || '', p.cat || '', p.unit || '']
    .concat(p.tags || []).join(' ').toLowerCase();
  return q.split(/\s+/).filter(Boolean).every(function(w) { return hay.indexOf(w) !== -1; });
}

window.filterProducts = function() {
  var raw = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  window.searchQuery = resolveQuery(raw);
  renderProducts();
};

window.filterCat = function(cat, el) {
  window.activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(function(p) { p.classList.remove('active'); });
  el.classList.add('active');
  renderProducts();
};

// ── Render product list ───────────────────────────────────
window.renderProducts = function() {
  var list = document.getElementById('productList');
  if (!list) return;

  var q   = window.searchQuery || '';
  var cat = window.activeCategory || 'all';

  var filtered = PRODUCTS.filter(function(p) {
    return (cat === 'all' || p.cat === cat) && matchesSearch(p, q);
  });

  var html = '';

  if (q) {
    var raw = (document.getElementById('searchInput').value || '').trim();
    html += '<div style="background:rgba(0,229,160,0.06);border:1px dashed rgba(0,229,160,0.4);border-radius:10px;padding:0.65rem;margin-bottom:0.5rem">'
      + '<div style="font-size:0.73rem;color:var(--accent);font-weight:600;margin-bottom:0.3rem">Can\'t find "' + raw + '"?</div>'
      + '<button onclick="openCustomProductModal()" style="width:100%;padding:0.3rem;border-radius:7px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:0.75rem;font-weight:600;cursor:pointer">+ Add Custom Product</button>'
      + '</div>';
  }

  if (!filtered.length) {
    if (!q) html += '<div style="padding:1.2rem 0;text-align:center;color:var(--muted);font-size:0.82rem">No products in this category</div>';
    list.innerHTML = html;
    return;
  }

  // Group by name
  var groups = {};
  filtered.forEach(function(p) {
    if (!groups[p.name]) groups[p.name] = [];
    groups[p.name].push(p);
  });

  Object.keys(groups).forEach(function(name) {
    var items = groups[name].slice().sort(function(a,b) { return a.basePrice - b.basePrice; });
    if (items.length === 1) {
      html += renderSingleCard(items[0]);
    } else {
      html += renderGroupCard(name, items);
    }
  });

  list.innerHTML = html;
};

function renderSingleCard(p) {
  var qty = window.basket[p.id] || 0;
  var pu  = perUnit(p);
  return '<div class="product-item' + (qty > 0 ? ' in-basket' : '') + '">'
    + '<span class="product-emoji">' + p.emoji + '</span>'
    + '<div class="product-info">'
    +   '<div class="product-name">' + p.name + '</div>'
    +   '<div class="product-unit">'
    +     (p.brand ? '<span style="color:var(--accent);font-size:0.68rem;font-weight:600">' + p.brand + '</span> · ' : '')
    +     p.unit
    +     (pu ? ' <span style="font-size:0.65rem;color:var(--muted)">(' + pu + ')</span>' : '')
    +   '</div>'
    + '</div>'
    + '<span class="product-price">₹' + p.basePrice + '</span>'
    + (qty > 0
      ? '<div class="qty-stepper"><button onclick="changeQty(\'' + p.id + '\',-1)">−</button><span class="qty-num">' + qty + '</span><button onclick="changeQty(\'' + p.id + '\',1)">+</button></div>'
      : '<button class="add-btn" onclick="addToBasket(\'' + p.id + '\')">+</button>')
    + '</div>';
}

function renderGroupCard(name, items) {
  var cheapest = items[0];
  var html = '<div class="product-group">'
    + '<div class="group-header">'
    + '<span class="group-emoji">' + cheapest.emoji + '</span>'
    + '<span class="group-name">' + name + '</span>'
    + '<span class="group-count">' + items.length + ' options</span>'
    + '</div>';

  items.forEach(function(p) {
    var qty = window.basket[p.id] || 0;
    var isC = p.id === cheapest.id;
    var pu  = perUnit(p);
    html += '<div class="group-item' + (qty > 0 ? ' in-basket' : '') + (isC ? ' cheapest-item' : '') + '">'
      + '<div class="group-item-left">'
      + (isC ? '<span class="cheapest-tag">💰 Cheapest</span>' : '')
      + '<div class="group-brand">' + (p.brand || '—') + '</div>'
      + '<div class="group-unit-price">'
      +   '<span class="gi-unit">' + p.unit + '</span>'
      +   ' <span class="gi-price">₹' + p.basePrice + '</span>'
      +   (pu ? ' <span class="gi-per">(' + pu + ')</span>' : '')
      + '</div>'
      + '</div>'
      + (qty > 0
        ? '<div class="qty-stepper sm"><button onclick="changeQty(\'' + p.id + '\',-1)">−</button><span class="qty-num">' + qty + '</span><button onclick="changeQty(\'' + p.id + '\',1)">+</button></div>'
        : '<button class="add-btn sm" onclick="addToBasket(\'' + p.id + '\')">+</button>')
      + '</div>';
  });

  return html + '</div>';
}

// ── Basket ────────────────────────────────────────────────
window.addToBasket = function(id) {
  window.basket[id] = 1;
  updateBasketUI(); renderProducts();
};

window.changeQty = function(id, delta) {
  var next = (window.basket[id] || 0) + delta;
  if (next <= 0) {
    delete window.basket[id];
    if (window.customItems[id]) delete window.customItems[id];
  } else {
    window.basket[id] = next;
  }
  updateBasketUI(); renderProducts();
};

window.removeFromBasket = function(id) {
  delete window.basket[id];
  if (window.customItems[id]) delete window.customItems[id];
  updateBasketUI(); renderProducts(); clearResults();
};

window.clearBasket = function() {
  if (!Object.keys(window.basket).length) return;
  if (!confirm('Clear all items?')) return;
  window.basket = {}; window.customItems = {};
  updateBasketUI(); renderProducts(); clearResults();
};

window.updateBasketUI = function() {
  var tags   = document.getElementById('basketTags');
  var cmpBtn = document.getElementById('compareBtn');
  var savBtn = document.getElementById('saveBtn');
  var clrBtn = document.getElementById('clearBtn');
  if (!tags) return;

  var ids = Object.keys(window.basket);
  if (!ids.length) {
    tags.innerHTML = '<span style="font-size:0.8rem;color:var(--muted)">Add items to compare</span>';
    if (cmpBtn) cmpBtn.disabled = true;
    if (savBtn) savBtn.classList.add('hidden');
    if (clrBtn) clrBtn.classList.add('hidden');
    return;
  }

  tags.innerHTML = ids.map(function(id) {
    var p = window.getProduct(id);
    if (!p) return '';
    var isC = !!window.customItems[id];
    return '<div class="basket-tag' + (isC ? ' custom-tag' : '') + '">'
      + '<span class="tag-emoji">' + p.emoji + '</span>'
      + '<span>' + (p.brand ? p.brand + ' ' : '') + p.name + ' ' + p.unit + ' ×' + window.basket[id] + '</span>'
      + (isC ? '<span style="font-size:0.65rem;color:var(--accent)"> ✏️</span>' : '')
      + '<span class="remove-tag" onclick="removeFromBasket(\'' + id + '\')">✕</span>'
      + '</div>';
  }).join('');

  if (cmpBtn) cmpBtn.disabled = false;
  if (savBtn) savBtn.classList.remove('hidden');
  if (clrBtn) clrBtn.classList.remove('hidden');
};

// ── Panels ────────────────────────────────────────────────
window.toggleSavedPanel = function() {
  document.getElementById('savedPanel').classList.toggle('hidden');
};

window.openReportModal = function() {
  var sel = document.getElementById('reportProduct');
  if (sel) {
    sel.innerHTML = '<option value="">Select Product</option>'
      + PRODUCTS.map(function(p) {
          return '<option value="' + p.id + '">' + p.emoji + ' ' + (p.brand ? p.brand + ' ' : '') + p.name + ' (' + p.unit + ')</option>';
        }).join('');
  }
  var rc = document.getElementById('reportCity');
  if (rc) rc.value = window.currentCity;
  document.getElementById('reportModal').classList.remove('hidden');
};

// ── Price calculation ──────────────────────────────────────
function calcApp(app) {
  var subtotal   = 0;
  var itemPrices = {};
  Object.keys(window.basket).forEach(function(id) {
    var p = window.getProduct(id);
    if (!p) return;
    var mult  = (app.priceMultiplier[id] !== undefined) ? app.priceMultiplier[id] : app.priceMultiplier.default;
    var price = Math.round(p.basePrice * mult);
    itemPrices[id] = price;
    subtotal += price * window.basket[id];
  });
  var delivery   = app.deliveryFee(subtotal);
  var handling   = app.handlingFee(subtotal);
  var platform   = app.platformFee(subtotal);
  var smallOrder = app.smallOrderFee(subtotal);
  return { subtotal: subtotal, delivery: delivery, handling: handling,
           platform: platform, smallOrder: smallOrder,
           total: subtotal + delivery + handling + platform + smallOrder,
           itemPrices: itemPrices };
}

// ── Comparison ────────────────────────────────────────────
window.runComparison = function() {
  if (!Object.keys(window.basket).length) { showToast('Add items first', 'error'); return; }
  var overlay = document.getElementById('loadingOverlay');
  var lt      = document.getElementById('loadingText');
  if (overlay) overlay.classList.remove('hidden');
  var msgs = ['Checking Blinkit…','Scanning Zepto…','Comparing Instamart…','Analysing BB Now…','Finding best deal…'];
  var i = 0;
  var iv = setInterval(function() { if (lt) lt.textContent = msgs[i++ % msgs.length]; }, 500);
  setTimeout(function() {
    clearInterval(iv);
    if (overlay) overlay.classList.add('hidden');
    renderResults();
  }, 2200);
};

function renderResults() {
  var emptyState = document.getElementById('emptyState');
  var area       = document.getElementById('resultsArea');
  if (!area) return;
  if (emptyState) emptyState.style.display = 'none';
  area.style.display = 'block';

  var results = APPS.map(function(app) {
    var c = calcApp(app);
    return { app: app, subtotal: c.subtotal, delivery: c.delivery, handling: c.handling,
             platform: c.platform, smallOrder: c.smallOrder, total: c.total, itemPrices: c.itemPrices };
  }).sort(function(a,b) { return a.total - b.total; });

  var cheapest = results[0];
  var priciest = results[results.length - 1];
  var savings  = priciest.total - cheapest.total;

  // Per-item best
  var itemBest = {};
  Object.keys(window.basket).forEach(function(id) {
    var bestApp = null, bestPrice = Infinity;
    results.forEach(function(r) {
      if ((r.itemPrices[id] || Infinity) < bestPrice) {
        bestPrice = r.itemPrices[id]; bestApp = r.app;
      }
    });
    itemBest[id] = { app: bestApp, price: bestPrice };
  });

  if (window.logComparison) {
    window.logComparison(window.currentCity,
      Object.keys(window.basket).map(function(id) { return { id: id, qty: window.basket[id] }; }),
      results.map(function(r) { return { appId: r.app.id, total: r.total }; }));
  }

  var html = '';

  // Location line
  html += '<div style="display:flex;align-items:center;gap:0.5rem;font-size:0.78rem;color:var(--muted);margin-bottom:1rem">'
    + '📍 <strong style="color:var(--text)">' + window.currentCity + '</strong>'
    + '<button onclick="document.getElementById(\'locationModal\').classList.remove(\'hidden\')" '
    + 'style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:6px;padding:0.2rem 0.5rem;color:var(--muted);font-size:0.72rem;cursor:pointer">Change ▾</button>'
    + '</div>';

  // Savings banner
  if (savings > 0) {
    html += '<div class="savings-banner"><div class="save-big">💰</div><div>'
      + '<div class="savings-num">Save ₹' + savings + '</div>'
      + '<div class="savings-sub">order from <strong>' + cheapest.app.name + '</strong> vs most expensive</div>'
      + '</div></div>';
  }

  // App cards
  html += '<div class="app-cards">';
  results.forEach(function(r) {
    var isBest = r.app.id === cheapest.app.id;
    html += '<div class="app-card' + (isBest ? ' cheapest' : '') + '">'
      + (isBest ? '<div class="cheapest-badge">⚡ Best Price</div>' : '')
      + '<div class="app-card-header">'
      +   '<div class="app-logo-circle" style="background:' + r.app.color + ';color:' + r.app.textColor + '">' + r.app.emoji + '</div>'
      +   '<div class="app-meta">'
      +     '<div class="app-name">' + r.app.name + '</div>'
      +     '<div class="app-eta">🕐 ' + r.app.eta + ' · Free over ₹' + r.app.freeDeliveryAbove + '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="app-total-area">'
      +   '<div class="total-label">Total to pay</div>'
      +   '<div class="total-amount" style="color:' + (isBest ? 'var(--accent)' : 'var(--text)') + '">₹' + r.total + '</div>'
      + '</div>'
      + '<div class="fee-rows">'
      +   '<div class="fee-row"><span class="fee-name">Items subtotal</span><span class="fee-val">₹' + r.subtotal + '</span></div>'
      +   '<div class="fee-row' + (r.delivery === 0 ? ' free' : '') + '">'
      +     '<span class="fee-name">Delivery' + (r.delivery === 0 ? ' 🎉' : '') + '</span>'
      +     '<span class="fee-val">' + (r.delivery === 0 ? 'FREE' : '₹' + r.delivery) + '</span>'
      +   '</div>'
      +   (r.handling   > 0 ? '<div class="fee-row"><span class="fee-name">Handling</span><span class="fee-val">₹' + r.handling + '</span></div>' : '')
      +   (r.platform   > 0 ? '<div class="fee-row"><span class="fee-name">Platform fee</span><span class="fee-val">₹' + r.platform + '</span></div>' : '')
      +   (r.smallOrder > 0 ? '<div class="fee-row"><span class="fee-name">Small order fee</span><span class="fee-val">₹' + r.smallOrder + '</span></div>' : '')
      +   '<div class="fee-row divider"><span>Grand Total</span><span>₹' + r.total + '</span></div>'
      + '</div>'
      + '<div class="item-list">';

    // Item breakdown — brand + name clearly shown
    Object.keys(window.basket).forEach(function(id) {
      var p = window.getProduct(id);
      if (!p) return;
      var price     = r.itemPrices[id] || 0;
      var isBestItem = itemBest[id] && itemBest[id].app && itemBest[id].app.id === r.app.id;
      var label     = (p.brand ? p.brand + ' ' : '') + p.name + ' ' + p.unit;
      html += '<div class="item-row">'
        + '<span class="item-left">' + p.emoji + ' ' + label + ' ×' + window.basket[id] + '</span>'
        + '<span class="item-right">' + (isBestItem ? '✅ ' : '') + '₹' + (price * window.basket[id]) + '</span>'
        + '</div>';
    });

    html += '</div>'  // .item-list
      + '<button class="go-btn" style="background:' + r.app.color + ';color:' + r.app.textColor + '" '
      + 'onclick="openApp(\'' + r.app.id + '\',\'' + r.app.deeplink(window.currentCity) + '\')">'
      + 'Order on ' + r.app.name + ' →</button>'
      + '</div>';
  });
  html += '</div>'; // .app-cards

  // Smart split
  var splits = {};
  Object.keys(window.basket).forEach(function(id) {
    var b = itemBest[id];
    if (!b || !b.app) return;
    if (!splits[b.app.id]) splits[b.app.id] = { app: b.app, items: [] };
    splits[b.app.id].items.push({ id: id, qty: window.basket[id], price: b.price });
  });

  html += '<div class="optimal-section">'
    + '<div class="optimal-title">🎯 Smart Split Basket '
    + '<span style="font-size:0.73rem;color:var(--muted);font-weight:400">— cheapest app per item</span></div>'
    + '<div class="optimal-card">';

  Object.keys(splits).forEach(function(appId) {
    var g = splits[appId];
    html += '<div style="padding:0.6rem 1rem;background:rgba(255,255,255,0.04);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0.6rem">'
      + '<div style="width:26px;height:26px;border-radius:7px;background:' + g.app.color + ';color:' + g.app.textColor + ';display:flex;align-items:center;justify-content:center;font-size:0.85rem">' + g.app.emoji + '</div>'
      + '<strong style="font-size:0.85rem">' + g.app.name + '</strong>'
      + '<span style="font-size:0.72rem;color:var(--muted)">— ' + g.items.length + ' item' + (g.items.length > 1 ? 's' : '') + '</span>'
      + '<button class="go-btn" style="background:' + g.app.color + ';color:' + g.app.textColor + ';width:auto;margin:0 0 0 auto;padding:0.25rem 0.7rem;font-size:0.72rem" '
      + 'onclick="openApp(\'' + appId + '\',\'' + g.app.deeplink(window.currentCity) + '\')">Open →</button>'
      + '</div>';

    g.items.forEach(function(item) {
      var p = window.getProduct(item.id);
      if (!p) return;
      html += '<div class="optimal-row">'
        + '<span class="opt-emoji">' + p.emoji + '</span>'
        + '<span class="opt-name">' + (p.brand ? '<strong>' + p.brand + '</strong> ' : '') + p.name + '</span>'
        + '<span class="opt-qty">' + p.unit + ' × ' + item.qty + '</span>'
        + '<span class="opt-price">₹' + (item.price * item.qty) + '</span>'
        + '</div>';
    });
  });

  var splitTotal = Object.keys(window.basket).reduce(function(s, id) {
    return s + ((itemBest[id] ? itemBest[id].price : 0) * window.basket[id]);
  }, 0);

  html += '<div style="padding:0.8rem 1rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">'
    + '<span style="font-size:0.8rem;color:var(--muted)">Items subtotal (before delivery)</span>'
    + '<span style="font-family:\'Syne\',sans-serif;font-weight:800;color:var(--accent);font-size:1rem">₹' + splitTotal + '</span>'
    + '</div></div></div>';

  area.innerHTML = html;
}

window.clearResults = function() {
  var es = document.getElementById('emptyState');
  var ra = document.getElementById('resultsArea');
  if (es) es.style.display = 'flex';
  if (ra) { ra.style.display = 'none'; ra.innerHTML = ''; }
};

window.openApp = function(appId, url) {
  var app = APPS.find(function(a) { return a.id === appId; });
  showToast('🛒 Opening ' + (app ? app.name : 'app') + '…', 'success');
  setTimeout(function() { window.open(url, '_blank'); }, 500);
};

// ── Firebase stubs ────────────────────────────────────────
if (!window.logComparison)        window.logComparison        = function() {};
if (!window.saveBasketToFirebase) window.saveBasketToFirebase = function() { showToast('Saving…',''); };
if (!window.loadSavedBaskets)     window.loadSavedBaskets     = function() {};

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var inp = document.getElementById('searchInput');
  if (inp) {
    inp.addEventListener('input', function() {
      window.searchQuery = resolveQuery(this.value.trim().toLowerCase());
      renderProducts();
    });
  }
  var s = document.createElement('script');
  s.src = 'js/firebase.js';
  document.head.appendChild(s);
  renderProducts();
  updateBasketUI();
});
