// ============================================================
//  QuickBasket — app.js  v6
//  Fixes: search, location persistence, brand in comparison
// ============================================================

window.basket        = {};
window.customItems   = {};
window.currentCity   = localStorage.getItem(‘qb_city’) || ‘Mumbai’;
window.currentLat    = null;
window.currentLng    = null;
window.activeCategory = ‘all’;
window.searchQuery    = ‘’;

// ── Toast ─────────────────────────────────────────────────
window.showToast = function(msg, type) {
var t = document.getElementById(‘toast’);
if (!t) return;
t.textContent = msg;
t.className = ‘toast’ + (type ? ’ ’ + type : ‘’);
clearTimeout(t._hide);
t._hide = setTimeout(function() { t.classList.add(‘hidden’); }, 3500);
};

// ── getProduct ────────────────────────────────────────────
window.getProduct = function(id) {
for (var i = 0; i < PRODUCTS.length; i++) {
if (PRODUCTS[i].id === id) return PRODUCTS[i];
}
return window.customItems[id] || null;
};

// ── per-100g/ml label ──────────────────────────────────────
function perUnit(p) {
var m = (p.unit || ‘’).toLowerCase().match(/([\d.]+)\s*(kg|g|ml|l|ltr)/);
if (!m) return null;
var grams = parseFloat(m[1]);
if (m[2] === ‘kg’ || m[2] === ‘l’ || m[2] === ‘ltr’) grams *= 1000;
if (grams <= 0) return null;
var per = Math.round(p.basePrice / grams * 100);
var lbl = (m[2] === ‘ml’ || m[2] === ‘l’ || m[2] === ‘ltr’) ? ‘ml’ : ‘g’;
return ‘\u20b9’ + per + ‘/100’ + lbl;
}

// ── Location (persisted) ──────────────────────────────────
function saveCity(city) {
window.currentCity = city;
try { localStorage.setItem(‘qb_city’, city); } catch(e) {}
var el = document.getElementById(‘locDisplay’);
if (el) el.textContent = city;
}

window.detectLocation = function() {
var btn  = document.getElementById(‘gpsBtn’);
var info = document.getElementById(‘gpsInfo’);
if (!navigator.geolocation) {
info.textContent = ‘\u274c GPS not supported.’; return;
}
btn.textContent = ‘\ud83d\udce1 Detecting\u2026’; btn.disabled = true;
info.textContent = ‘\u23f3 Waiting for GPS\u2026’;
navigator.geolocation.getCurrentPosition(
function(pos) {
window.currentLat = pos.coords.latitude;
window.currentLng = pos.coords.longitude;
info.textContent = ‘\u2705 Got location, looking up city\u2026’;
fetch(‘https://nominatim.openstreetmap.org/reverse?lat=’ + window.currentLat +
‘&lon=’ + window.currentLng + ‘&format=json&accept-language=en’)
.then(function(r) { return r.json(); })
.then(function(d) {
var a    = d.address || {};
var city = a.city || a.town || a.county || a.state || ‘Your City’;
var area = a.suburb || a.neighbourhood || ‘’;
var disp = area ? area + ‘, ’ + city : city;
saveCity(disp);
document.getElementById(‘locationInput’).value = disp;
info.innerHTML = ‘\ud83d\udccd <strong>’ + disp + ‘</strong>’;
showToast(’\ud83d\udccd ’ + disp, ‘success’);
btn.textContent = ‘\ud83d\udccd Use My Current Location (GPS)’; btn.disabled = false;
setTimeout(function() { document.getElementById(‘locationModal’).classList.add(‘hidden’); }, 900);
})
.catch(function() {
var fallback = window.currentLat.toFixed(3) + ‘,’ + window.currentLng.toFixed(3);
saveCity(fallback);
info.textContent = ‘\ud83d\udccd GPS detected (city lookup failed)’;
btn.textContent = ‘\ud83d\udccd Use My Current Location (GPS)’; btn.disabled = false;
setTimeout(function() { document.getElementById(‘locationModal’).classList.add(‘hidden’); }, 900);
});
},
function(err) {
btn.textContent = ‘\ud83d\udccd Use My Current Location (GPS)’; btn.disabled = false;
var m = { 1:’\ud83d\udd12 Permission denied \u2014 allow location in browser settings.’,
2:’\ud83d\udce1 Location unavailable.’, 3:’\u23f1\ufe0f Timed out.’ };
info.textContent = m[err.code] || ‘\u274c Location error.’;
},
{ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
);
};

window.selectCity = function(city) {
saveCity(city);
document.getElementById(‘locationInput’).value = city;
document.querySelectorAll(’.modal-city’).forEach(function(el) {
el.classList.toggle(‘selected’, el.textContent.includes(city));
});
var info = document.getElementById(‘gpsInfo’);
if (info) info.innerHTML = ‘\u2705 Selected: <strong>’ + city + ‘</strong>’;
};

window.confirmLocation = function() {
var v = (document.getElementById(‘locationInput’).value || ‘’).trim();
if (v) saveCity(v);
document.getElementById(‘locationModal’).classList.add(‘hidden’);
};

// ── Custom product ─────────────────────────────────────────
window.openCustomProductModal = function() {
document.getElementById(‘customProductModal’).classList.remove(‘hidden’);
setTimeout(function() { document.getElementById(‘cp_name’).focus(); }, 80);
};

window.addCustomProduct = function() {
var name  = (document.getElementById(‘cp_name’).value  || ‘’).trim();
var price = parseFloat(document.getElementById(‘cp_price’).value);
var unit  = (document.getElementById(‘cp_unit’).value  || ‘’).trim() || ‘1 pc’;
var emoji = (document.getElementById(‘cp_emoji’).value || ‘’).trim() || ‘\ud83d\udce6’;
if (!name)                { showToast(‘Enter a product name’, ‘error’); return; }
if (!price || price <= 0) { showToast(‘Enter a valid price > 0’, ‘error’); return; }
var id = ‘custom_’ + Date.now();
window.customItems[id] = { id: id, name: name, brand: ‘’, emoji: emoji, unit: unit, basePrice: price, cat: ‘custom’, tags: [] };
window.basket[id] = 1;
[‘cp_name’,‘cp_price’,‘cp_unit’].forEach(function(f) { document.getElementById(f).value = ‘’; });
document.getElementById(‘customProductModal’).classList.add(‘hidden’);
updateBasketUI();
showToast(’\u2705 “’ + name + ‘” added!’, ‘success’);
};

// ── Search ────────────────────────────────────────────────
var ALIASES = {
anda:‘eggs’, ande:‘eggs’, doodh:‘milk’, dudh:‘milk’,
makhan:‘butter’, makkhan:‘butter’, dahi:‘curd’, panir:‘paneer’,
chaas:‘buttermilk’, aata:‘atta’, ata:‘atta’,
chawal:‘rice’, cheeni:‘sugar’, chini:‘sugar’, namak:‘salt’, tel:‘oil’,
pyaaz:‘onion’, pyaz:‘onion’, kanda:‘onion’, aloo:‘potato’, alu:‘potato’,
tamatar:‘tomato’, palak:‘spinach’, saag:‘spinach’, gajar:‘carrot’,
bhindi:‘ladyfinger’, baingan:‘eggplant’, mirchi:‘chilli’,
adrak:‘ginger’, lehsun:‘garlic’, lasan:‘garlic’,
nimbu:‘lemon’, kela:‘banana’, seb:‘apple’, aam:‘mango’,
santara:‘orange’, angur:‘grapes’, tarbooz:‘watermelon’,
anar:‘pomegranate’, amrood:‘guava’, papita:‘papaya’, nariyal:‘coconut’,
chai:‘tea’, sabun:‘soap’, jheenga:‘prawn’, murga:‘chicken’,
machli:‘fish’, gosht:‘mutton’, pani:‘water’, paani:‘water’,
daal:‘dal’, sooji:‘suji’, rawa:‘suji’, rava:‘suji’,
sarson:‘mustard’, jeera:‘cumin’, haldi:‘turmeric’, dhania:‘coriander’,
imli:‘tamarind’, diaper:‘diapers’, nappy:‘diapers’,
moongphali:‘peanuts’, badam:‘almonds’, kaju:‘cashew’,
akhrot:‘walnuts’, kishmish:‘raisins’, matar:‘peas’, bhutta:‘corn’,
gobi:‘cauliflower’, methi:‘fenugreek’, pudina:‘mint’
};

function resolveQuery(raw) {
return ALIASES[raw] || raw;
}

function matchesSearch(p, q) {
if (!q) return true;
var hay = [p.name || ‘’, p.brand || ‘’, p.cat || ‘’, p.unit || ‘’].concat(p.tags || []).join(’ ’).toLowerCase();
var words = q.split(/\s+/).filter(function(w) { return w.length > 0; });
for (var i = 0; i < words.length; i++) {
if (hay.indexOf(words[i]) === -1) return false;
}
return true;
}

window.filterProducts = function() {
var raw = (document.getElementById(‘searchInput’).value || ‘’).trim().toLowerCase();
window.searchQuery = resolveQuery(raw);
renderProducts();
};

window.filterCat = function(cat, el) {
window.activeCategory = cat;
document.querySelectorAll(’.cat-pill’).forEach(function(p) { p.classList.remove(‘active’); });
el.classList.add(‘active’);
renderProducts();
};

// ── Render product list ───────────────────────────────────
window.renderProducts = function() {
var list = document.getElementById(‘productList’);
if (!list) return;
if (typeof PRODUCTS === ‘undefined’) {
list.innerHTML = ‘<div style="color:red;padding:1rem">Error: product data not loaded</div>’;
return;
}

var q   = window.searchQuery || ‘’;
var cat = window.activeCategory || ‘all’;

var filtered = [];
for (var i = 0; i < PRODUCTS.length; i++) {
var p = PRODUCTS[i];
if ((cat === ‘all’ || p.cat === cat) && matchesSearch(p, q)) {
filtered.push(p);
}
}

var html = ‘’;

if (q) {
var raw = (document.getElementById(‘searchInput’).value || ‘’).trim();
html += ‘<div style="background:rgba(0,229,160,0.06);border:1px dashed rgba(0,229,160,0.4);border-radius:10px;padding:0.65rem;margin-bottom:0.5rem">’
+ ‘<div style="font-size:0.73rem;color:var(--accent);font-weight:600;margin-bottom:0.3rem">Can't find “’ + raw + ‘”?</div>’
+ ‘<button onclick="openCustomProductModal()" style="width:100%;padding:0.3rem;border-radius:7px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:0.75rem;font-weight:600;cursor:pointer">+ Add Custom Product</button>’
+ ‘</div>’;
}

if (!filtered.length) {
if (!q) html += ‘<div style="padding:1.2rem 0;text-align:center;color:var(--muted);font-size:0.82rem">No products in this category</div>’;
list.innerHTML = html;
return;
}

// Group by name
var groups = {};
var groupOrder = [];
for (var j = 0; j < filtered.length; j++) {
var fp = filtered[j];
if (!groups[fp.name]) { groups[fp.name] = []; groupOrder.push(fp.name); }
groups[fp.name].push(fp);
}

for (var k = 0; k < groupOrder.length; k++) {
var gname = groupOrder[k];
var items = groups[gname].slice().sort(function(a,b) { return a.basePrice - b.basePrice; });
if (items.length === 1) {
html += renderSingleCard(items[0]);
} else {
html += renderGroupCard(gname, items);
}
}

list.innerHTML = html;
};

function renderSingleCard(p) {
var qty = window.basket[p.id] || 0;
var pu  = perUnit(p);
return ‘<div class="product-item' + (qty > 0 ? ' in-basket' : '') + '">’
+ ‘<span class="product-emoji">’ + p.emoji + ‘</span>’
+ ‘<div class="product-info">’
+   ‘<div class="product-name">’ + p.name + ‘</div>’
+   ‘<div class="product-unit">’
+     (p.brand ? ‘<span style="color:var(--accent);font-size:0.68rem;font-weight:600">’ + p.brand + ‘</span> · ’ : ‘’)
+     p.unit
+     (pu ? ’ <span style="font-size:0.65rem;color:var(--muted)">(’ + pu + ‘)</span>’ : ‘’)
+   ‘</div>’
+ ‘</div>’
+ ‘<span class="product-price">\u20b9’ + p.basePrice + ‘</span>’
+ (qty > 0
? ‘<div class="qty-stepper"><button onclick="changeQty(\'' + p.id + '\',-1)">\u2212</button><span class="qty-num">’ + qty + ‘</span><button onclick="changeQty(\'' + p.id + '\',1)">+</button></div>’
: ‘<button class="add-btn" onclick="addToBasket(\'' + p.id + '\')">+</button>’)
+ ‘</div>’;
}

function renderGroupCard(name, items) {
var cheapest = items[0];
var html = ‘<div class="product-group">’
+ ‘<div class="group-header">’
+ ‘<span class="group-emoji">’ + cheapest.emoji + ‘</span>’
+ ‘<span class="group-name">’ + name + ‘</span>’
+ ‘<span class="group-count">’ + items.length + ’ brands</span>’
+ ‘</div>’;

for (var i = 0; i < items.length; i++) {
var p   = items[i];
var qty = window.basket[p.id] || 0;
var isC = p.id === cheapest.id;
var pu  = perUnit(p);
html += ‘<div class="group-item' + (qty > 0 ? ' in-basket' : '') + (isC ? ' cheapest-item' : '') + '">’
+ ‘<div class="group-item-left">’
+ (isC ? ‘<span class="cheapest-tag">\ud83d\udcb0 Cheapest</span>’ : ‘’)
+ ‘<div class="group-brand">’ + (p.brand || ‘\u2014’) + ‘</div>’
+ ‘<div class="group-unit-price">’
+   ‘<span class="gi-unit">’ + p.unit + ‘</span>’
+   ’ <span class="gi-price">\u20b9’ + p.basePrice + ‘</span>’
+   (pu ? ’ <span class="gi-per">(’ + pu + ‘)</span>’ : ‘’)
+ ‘</div>’
+ ‘</div>’
+ (qty > 0
? ‘<div class="qty-stepper sm"><button onclick="changeQty(\'' + p.id + '\',-1)">\u2212</button><span class="qty-num">’ + qty + ‘</span><button onclick="changeQty(\'' + p.id + '\',1)">+</button></div>’
: ‘<button class="add-btn sm" onclick="addToBasket(\'' + p.id + '\')">+</button>’)
+ ‘</div>’;
}
return html + ‘</div>’;
}

// ── Basket ────────────────────────────────────────────────
window.addToBasket = function(id) {
window.basket[id] = 1; updateBasketUI(); renderProducts();
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
if (!confirm(‘Clear all items?’)) return;
window.basket = {}; window.customItems = {};
updateBasketUI(); renderProducts(); clearResults();
};

window.updateBasketUI = function() {
var tags   = document.getElementById(‘basketTags’);
var cmpBtn = document.getElementById(‘compareBtn’);
var savBtn = document.getElementById(‘saveBtn’);
var clrBtn = document.getElementById(‘clearBtn’);
if (!tags) return;

var ids = Object.keys(window.basket);
if (!ids.length) {
tags.innerHTML = ‘<span style="font-size:0.8rem;color:var(--muted)">Add items to compare</span>’;
if (cmpBtn) cmpBtn.disabled = true;
if (savBtn) savBtn.classList.add(‘hidden’);
if (clrBtn) clrBtn.classList.add(‘hidden’);
return;
}

tags.innerHTML = ids.map(function(id) {
var p = window.getProduct(id);
if (!p) return ‘’;
var isC = !!window.customItems[id];
return ‘<div class="basket-tag' + (isC ? ' custom-tag' : '') + '">’
+ p.emoji + ’ ’
+ (p.brand ? ‘<strong>’ + p.brand + ‘</strong> ’ : ‘’)
+ p.name + ’ ’ + p.unit + ’ \u00d7’ + window.basket[id]
+ (isC ? ’ <span style="font-size:0.65rem;color:var(--accent)">\u270f\ufe0f</span>’ : ‘’)
+ ’ <span class="remove-tag" onclick="removeFromBasket(\'' + id + '\')">\u2715</span>’
+ ‘</div>’;
}).join(’’);

if (cmpBtn) cmpBtn.disabled = false;
if (savBtn) savBtn.classList.remove(‘hidden’);
if (clrBtn) clrBtn.classList.remove(‘hidden’);
};

// ── Panels ────────────────────────────────────────────────
window.toggleSavedPanel = function() {
var panel = document.getElementById(‘savedPanel’);
panel.classList.toggle(‘hidden’);
// Reload baskets every time panel opens
if (!panel.classList.contains(‘hidden’) && window.loadSavedBaskets) {
window.loadSavedBaskets();
}
};

window.openReportModal = function() {
var sel = document.getElementById(‘reportProduct’);
if (sel) {
sel.innerHTML = ‘<option value="">Select Product</option>’
+ PRODUCTS.map(function(p) {
return ‘<option value="' + p.id + '">’ + p.emoji + ’ ’ + (p.brand ? p.brand + ’ ’ : ‘’) + p.name + ’ (’ + p.unit + ‘)</option>’;
}).join(’’);
}
var rc = document.getElementById(‘reportCity’);
if (rc) rc.value = window.currentCity;
document.getElementById(‘reportModal’).classList.remove(‘hidden’);
};

// ── Price calculation ──────────────────────────────────────
function calcApp(app) {
var subtotal = 0, itemPrices = {};
var ids = Object.keys(window.basket);
for (var i = 0; i < ids.length; i++) {
var id = ids[i];
var p  = window.getProduct(id);
if (!p) continue;
var mult  = (app.priceMultiplier[id] !== undefined) ? app.priceMultiplier[id] : app.priceMultiplier.default;
var price = Math.round(p.basePrice * mult);
itemPrices[id] = price;
subtotal += price * window.basket[id];
}
var d = app.deliveryFee(subtotal), h = app.handlingFee(subtotal),
pf = app.platformFee(subtotal), so = app.smallOrderFee(subtotal);
return { subtotal: subtotal, delivery: d, handling: h, platform: pf,
smallOrder: so, total: subtotal+d+h+pf+so, itemPrices: itemPrices };
}

// ── Comparison ────────────────────────────────────────────
window.runComparison = function() {
if (!Object.keys(window.basket).length) { showToast(‘Add items first’, ‘error’); return; }
var overlay = document.getElementById(‘loadingOverlay’);
var lt      = document.getElementById(‘loadingText’);
if (overlay) overlay.classList.remove(‘hidden’);
var msgs = [‘Checking Blinkit\u2026’,‘Scanning Zepto\u2026’,‘Comparing Instamart\u2026’,‘Analysing BB Now\u2026’,‘Finding best deal\u2026’];
var i = 0;
var iv = setInterval(function() { if (lt) lt.textContent = msgs[i++ % msgs.length]; }, 480);
setTimeout(function() {
clearInterval(iv);
if (overlay) overlay.classList.add(‘hidden’);
renderResults();
}, 2200);
};

function renderResults() {
var emptyState = document.getElementById(‘emptyState’);
var area       = document.getElementById(‘resultsArea’);
if (!area) return;
if (emptyState) emptyState.style.display = ‘none’;
area.style.display = ‘block’;

var results = [];
for (var i = 0; i < APPS.length; i++) {
var c = calcApp(APPS[i]);
results.push({ app: APPS[i], subtotal: c.subtotal, delivery: c.delivery,
handling: c.handling, platform: c.platform, smallOrder: c.smallOrder,
total: c.total, itemPrices: c.itemPrices });
}
results.sort(function(a,b) { return a.total - b.total; });

var cheapest = results[0];
var savings  = results[results.length-1].total - cheapest.total;

// Per-item cheapest app
var itemBest = {};
var bids = Object.keys(window.basket);
for (var b = 0; b < bids.length; b++) {
var bid = bids[b], bestApp = null, bestPrice = Infinity;
for (var r = 0; r < results.length; r++) {
var rp = results[r].itemPrices[bid] || Infinity;
if (rp < bestPrice) { bestPrice = rp; bestApp = results[r].app; }
}
itemBest[bid] = { app: bestApp, price: bestPrice };
}

if (window.logComparison) {
window.logComparison(window.currentCity,
Object.keys(window.basket).map(function(id) { return { id: id, qty: window.basket[id] }; }),
results.map(function(r) { return { appId: r.app.id, total: r.total }; }));
}

var html = ‘’;

// Location + user info bar
var userHtml = ‘’;
if (window.FB && window.FB.user) {
userHtml = ’  ·  <img src="' + (window.FB.user.photoURL||'') + '" style="width:18px;height:18px;border-radius:50%;vertical-align:middle"> ’
+ ‘<span style="color:var(--text)">’ + (window.FB.user.displayName || window.FB.user.email) + ‘</span>’;
}
html += ‘<div style="display:flex;align-items:center;gap:0.5rem;font-size:0.78rem;color:var(--muted);margin-bottom:1rem">’
+ ‘\ud83d\udccd <strong style="color:var(--text)">’ + window.currentCity + ‘</strong>’ + userHtml
+ ’<button onclick=“document.getElementById('locationModal').classList.remove('hidden')” ’
+ ‘style=“margin-left:auto;background:none;border:1px solid var(–border);border-radius:6px;padding:0.2rem 0.5rem;color:var(–muted);font-size:0.72rem;cursor:pointer”>Change \u25be</button>’
+ ‘</div>’;

if (savings > 0) {
html += ‘<div class="savings-banner"><div class="save-big">\ud83d\udcb0</div><div>’
+ ‘<div class="savings-num">Save \u20b9’ + savings + ‘</div>’
+ ‘<div class="savings-sub">order from <strong>’ + cheapest.app.name + ‘</strong> vs most expensive</div>’
+ ‘</div></div>’;
}

// App cards
html += ‘<div class="app-cards">’;
for (var ri = 0; ri < results.length; ri++) {
var rv    = results[ri];
var isBest = rv.app.id === cheapest.app.id;
html += ‘<div class="app-card' + (isBest ? ' cheapest' : '') + '">’
+ (isBest ? ‘<div class="cheapest-badge">\u26a1 Best Price</div>’ : ‘’)
+ ‘<div class="app-card-header">’
+   ‘<div class="app-logo-circle" style="background:' + rv.app.color + ';color:' + rv.app.textColor + '">’ + rv.app.emoji + ‘</div>’
+   ‘<div class="app-meta">’
+     ‘<div class="app-name">’ + rv.app.name + ‘</div>’
+     ‘<div class="app-eta">\ud83d\udd50 ’ + rv.app.eta + ’ \u00b7 Free over \u20b9’ + rv.app.freeDeliveryAbove + ‘</div>’
+   ‘</div>’
+ ‘</div>’
+ ‘<div class="app-total-area">’
+   ‘<div class="total-label">Total to pay</div>’
+   ‘<div class="total-amount" style="color:' + (isBest ? 'var(--accent)' : 'var(--text)') + '">\u20b9’ + rv.total + ‘</div>’
+ ‘</div>’
+ ‘<div class="fee-rows">’
+   ‘<div class="fee-row"><span class="fee-name">Items subtotal</span><span class="fee-val">\u20b9’ + rv.subtotal + ‘</span></div>’
+   ‘<div class="fee-row' + (rv.delivery === 0 ? ' free' : '') + '">’
+     ‘<span class="fee-name">Delivery’ + (rv.delivery === 0 ? ’ \ud83c\udf89’ : ‘’) + ‘</span>’
+     ‘<span class="fee-val">’ + (rv.delivery === 0 ? ‘FREE’ : ‘\u20b9’ + rv.delivery) + ‘</span>’
+   ‘</div>’
+   (rv.handling   > 0 ? ‘<div class="fee-row"><span class="fee-name">Handling</span><span class="fee-val">\u20b9’ + rv.handling + ‘</span></div>’ : ‘’)
+   (rv.platform   > 0 ? ‘<div class="fee-row"><span class="fee-name">Platform fee</span><span class="fee-val">\u20b9’ + rv.platform + ‘</span></div>’ : ‘’)
+   (rv.smallOrder > 0 ? ‘<div class="fee-row"><span class="fee-name">Small order fee</span><span class="fee-val">\u20b9’ + rv.smallOrder + ‘</span></div>’ : ‘’)
+   ‘<div class="fee-row divider"><span>Grand Total</span><span>\u20b9’ + rv.total + ‘</span></div>’
+ ‘</div>’
+ ‘<div class="item-list">’;

```
var itemIds = Object.keys(window.basket);
for (var ii = 0; ii < itemIds.length; ii++) {
  var iid = itemIds[ii];
  var ip  = window.getProduct(iid);
  if (!ip) continue;
  var iprice     = rv.itemPrices[iid] || 0;
  var isBestItem = itemBest[iid] && itemBest[iid].app && itemBest[iid].app.id === rv.app.id;
  // Show: brand + name + unit clearly
  var label = ip.name + (ip.brand ? ' (' + ip.brand + ')' : '') + ' ' + ip.unit;
  html += '<div class="item-row">'
    + '<span class="item-left">' + ip.emoji + ' ' + label + ' \u00d7' + window.basket[iid] + '</span>'
    + '<span class="item-right">' + (isBestItem ? '\u2705 ' : '') + '\u20b9' + (iprice * window.basket[iid]) + '</span>'
    + '</div>';
}

html += '</div>'
  + '<button class="go-btn" style="background:' + rv.app.color + ';color:' + rv.app.textColor + '" '
  + 'onclick="openApp(\'' + rv.app.id + '\',\'' + rv.app.deeplink(window.currentCity) + '\')">'
  + 'Order on ' + rv.app.name + ' \u2192</button>'
  + '</div>';
```

}
html += ‘</div>’; // .app-cards

// Smart split basket
var splits = {}, splitOrder = [];
var sids = Object.keys(window.basket);
for (var si = 0; si < sids.length; si++) {
var sid = sids[si], sb = itemBest[sid];
if (!sb || !sb.app) continue;
if (!splits[sb.app.id]) { splits[sb.app.id] = { app: sb.app, items: [] }; splitOrder.push(sb.app.id); }
splits[sb.app.id].items.push({ id: sid, qty: window.basket[sid], price: sb.price });
}

html += ‘<div class="optimal-section">’
+ ’<div class="optimal-title">\ud83c\udfaf Smart Split Basket ’
+ ‘<span style="font-size:0.73rem;color:var(--muted);font-weight:400">\u2014 cheapest app per item</span></div>’
+ ‘<div class="optimal-card">’;

for (var soi = 0; soi < splitOrder.length; soi++) {
var g = splits[splitOrder[soi]];
html += ‘<div style="padding:0.6rem 1rem;background:rgba(255,255,255,0.04);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:0.6rem">’
+ ‘<div style="width:26px;height:26px;border-radius:7px;background:' + g.app.color + ';color:' + g.app.textColor + ';display:flex;align-items:center;justify-content:center;font-size:0.85rem">’ + g.app.emoji + ‘</div>’
+ ‘<strong style="font-size:0.85rem">’ + g.app.name + ‘</strong>’
+ ‘<span style="font-size:0.72rem;color:var(--muted)">\u2014 ’ + g.items.length + ’ item’ + (g.items.length > 1 ? ‘s’ : ‘’) + ‘</span>’
+ ‘<button class=“go-btn” style=“background:’ + g.app.color + ‘;color:’ + g.app.textColor + ’;width:auto;margin:0 0 0 auto;padding:0.25rem 0.7rem;font-size:0.72rem” ’
+ ‘onclick=“openApp('’ + splitOrder[soi] + ‘','’ + g.app.deeplink(window.currentCity) + ‘')”>Open \u2192</button>’
+ ‘</div>’;

```
for (var gi = 0; gi < g.items.length; gi++) {
  var gitem = g.items[gi], gp = window.getProduct(gitem.id);
  if (!gp) continue;
  html += '<div class="optimal-row">'
    + '<span class="opt-emoji">' + gp.emoji + '</span>'
    + '<span class="opt-name">' + gp.name + (gp.brand ? ' <span style="font-size:0.7rem;color:var(--accent)">(' + gp.brand + ')</span>' : '') + '</span>'
    + '<span class="opt-qty">' + gp.unit + ' \u00d7 ' + gitem.qty + '</span>'
    + '<span class="opt-price">\u20b9' + (gitem.price * gitem.qty) + '</span>'
    + '</div>';
}
```

}

var splitTotal = 0;
var stids = Object.keys(window.basket);
for (var sti = 0; sti < stids.length; sti++) {
splitTotal += (itemBest[stids[sti]] ? itemBest[stids[sti]].price : 0) * window.basket[stids[sti]];
}

html += ‘<div style="padding:0.8rem 1rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">’
+ ‘<span style="font-size:0.8rem;color:var(--muted)">Items subtotal (before delivery)</span>’
+ ‘<span style="font-family:\'Syne\',sans-serif;font-weight:800;color:var(--accent);font-size:1rem">\u20b9’ + splitTotal + ‘</span>’
+ ‘</div></div></div>’;

area.innerHTML = html;
}

window.clearResults = function() {
var es = document.getElementById(‘emptyState’);
var ra = document.getElementById(‘resultsArea’);
if (es) es.style.display = ‘flex’;
if (ra) { ra.style.display = ‘none’; ra.innerHTML = ‘’; }
};

window.openApp = function(appId, url) {
var found = null;
for (var i = 0; i < APPS.length; i++) { if (APPS[i].id === appId) { found = APPS[i]; break; } }
showToast(’\ud83d\uded2 Opening ’ + (found ? found.name : ‘app’) + ‘\u2026’, ‘success’);
setTimeout(function() { window.open(url, ‘_blank’); }, 500);
};

// ── Firebase stubs (overridden by firebase.js) ────────────
if (!window.logComparison)        window.logComparison        = function() {};
if (!window.saveBasketToFirebase) window.saveBasketToFirebase = function() { showToast(‘Saving\u2026’,’’); };
if (!window.loadSavedBaskets)     window.loadSavedBaskets     = function() {};

// ── Boot ──────────────────────────────────────────────────
document.addEventListener(‘DOMContentLoaded’, function() {
// Restore saved city
var el = document.getElementById(‘locDisplay’);
if (el) el.textContent = window.currentCity;

// Wire search
var inp = document.getElementById(‘searchInput’);
if (inp) {
inp.addEventListener(‘input’, function() {
window.searchQuery = resolveQuery(this.value.trim().toLowerCase());
renderProducts();
});
inp.addEventListener(‘keydown’, function(e) {
if (e.key === ‘Escape’) { this.value = ‘’; window.searchQuery = ‘’; renderProducts(); }
});
}

// Load firebase (static script in <head>, just call init)
if (window.loadSavedBaskets) window.loadSavedBaskets();

renderProducts();
updateBasketUI();
});