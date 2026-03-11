// ============================================================
//  QuickBasket — firebase.js  v3
//  Google Sign-In + Firestore + fixed saved baskets
// ============================================================

(function initFirebase() {
function loadScript(src) {
return new Promise(function(res, rej) {
if (document.querySelector(‘script[src=”’ + src + ‘”]’)) { res(); return; }
var s = document.createElement(‘script’);
s.src = src; s.onload = res; s.onerror = rej;
document.head.appendChild(s);
});
}

var BASE = ‘https://www.gstatic.com/firebasejs/9.23.0/’;

Promise.all([
loadScript(BASE + ‘firebase-app-compat.js’),
loadScript(BASE + ‘firebase-firestore-compat.js’),
loadScript(BASE + ‘firebase-auth-compat.js’),
loadScript(BASE + ‘firebase-analytics-compat.js’),
]).then(function() {
var cfg = {
apiKey:            “AIzaSyB6xiR4lpnaPP_OEXPqr5w8M8IDyUNfnhs”,
authDomain:        “quickbasket-ac8ae.firebaseapp.com”,
projectId:         “quickbasket-ac8ae”,
storageBucket:     “quickbasket-ac8ae.firebasestorage.app”,
messagingSenderId: “380670547080”,
appId:             “1:380670547080:web:8ed43c010aff2229b0bb3d”,
measurementId:     “G-QEZFV7NHGJ”
};

```
window.FB = { app: null, db: null, auth: null, analytics: null,
              enabled: false, user: null, sessionId: crypto.randomUUID() };

setStatus('connecting');

try {
  FB.app       = firebase.initializeApp(cfg);
  FB.db        = firebase.firestore();
  FB.auth      = firebase.auth();
  FB.analytics = firebase.analytics();
  FB.enabled   = true;
} catch(e) {
  console.error('Firebase init:', e);
  setStatus('offline'); return;
}

// Handle redirect result when user returns after Google sign-in
FB.auth.getRedirectResult().then(function(result) {
  if (result && result.user) {
    showToast('✅ Welcome, ' + (result.user.displayName || 'User') + '!', 'success');
  }
}).catch(function(e) {
  if (e.code && e.code !== 'auth/no-auth-event') {
    console.warn('Redirect result:', e.code);
  }
});

// Listen for auth state changes
FB.auth.onAuthStateChanged(function(user) {
  FB.user = user || null;
  updateAuthUI();
  seedIfEmpty();
  loadSavedBaskets();
});

setStatus('online');
```

}).catch(function(e) {
console.warn(‘Firebase SDK load failed:’, e);
window.FB = { enabled: false, user: null, sessionId: crypto.randomUUID() };
setStatus(‘offline’);
});
})();

// ── Auth UI ───────────────────────────────────────────────
function updateAuthUI() {
var btn = document.getElementById(‘authBtn’);
if (!btn) return;
if (FB.user) {
var name = FB.user.displayName || FB.user.email || ‘User’;
var photo = FB.user.photoURL
? ‘<img src="' + FB.user.photoURL + '" style="width:20px;height:20px;border-radius:50%;vertical-align:middle;margin-right:4px">’
: ‘’;
btn.innerHTML = photo + name + ’  ·  Sign out’;
btn.onclick = function() { FB.auth.signOut(); };
btn.title = ‘Sign out’;
} else {
btn.innerHTML = ‘\ud83d\udc64 Sign in with Google’;
btn.onclick = window.signInWithGoogle;
btn.title = ‘Sign in to sync your baskets’;
}
}

window.signInWithGoogle = function() {
if (!window.FB || !window.FB.auth) {
showToast(‘Firebase not ready yet — try again in a moment’, ‘error’); return;
}
var provider = new firebase.auth.GoogleAuthProvider();
var isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

if (isMobile) {
// Mobile: use redirect (popup is blocked by iOS/Android browsers)
showToast(‘Redirecting to Google…’, ‘’);
FB.auth.signInWithRedirect(provider).catch(function(e) {
console.error(‘Redirect sign in error:’, e);
showToast(’Sign in failed: ’ + (e.message || e.code), ‘error’);
});
} else {
// Desktop: use popup
FB.auth.signInWithPopup(provider)
.then(function(result) {
showToast(’✅ Welcome, ’ + (result.user.displayName || ‘User’) + ‘!’, ‘success’);
})
.catch(function(e) {
console.error(‘Popup sign in error:’, e);
if (e.code === ‘auth/popup-blocked’) {
// Popup was blocked, fall back to redirect
FB.auth.signInWithRedirect(provider);
} else {
showToast(’Sign in failed: ’ + (e.message || e.code), ‘error’);
}
});
}
};

// ── Status dot ────────────────────────────────────────────
function setStatus(state) {
var dot   = document.getElementById(‘statusDot’);
var label = document.getElementById(‘statusLabel’);
if (!dot || !label) return;
dot.className     = ’status-dot ’ + state;
label.textContent = state === ‘online’ ? ‘Live’ : state === ‘connecting’ ? ‘Connecting\u2026’ : ‘Offline’;
}

// ── Seed ──────────────────────────────────────────────────
function seedIfEmpty() {
if (!FB.db) return;
FB.db.collection(‘products’).limit(1).get().then(function(snap) {
if (!snap.empty) return;
var batch = FB.db.batch();
PRODUCTS.forEach(function(p) {
batch.set(FB.db.doc(‘products/’ + p.id), {
name: p.name, unit: p.unit, emoji: p.emoji,
cat: p.cat, basePrice: p.basePrice,
lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
});
});
batch.commit().catch(function(e) { console.warn(‘Seed error:’, e); });
}).catch(function() {});
}

// ── Saved baskets ──────────────────────────────────────────
window.saveBasketToFirebase = function() {
var name  = (document.getElementById(‘basketNameInput’).value || ‘’).trim();
var items = Object.keys(window.basket).map(function(id) { return { id: id, qty: window.basket[id] }; });
if (!name)         { showToast(‘Enter a basket name’, ‘error’); return; }
if (!items.length) { showToast(‘Basket is empty’, ‘error’); return; }

var doc = {
name: name, city: window.currentCity, items: items,
savedAt: FB && FB.enabled ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
};

if (FB && FB.enabled) {
// Use user UID if logged in, else sessionId
doc.ownerId = (FB.user ? FB.user.uid : null);
doc.sessionId = FB.sessionId;

```
FB.db.collection('savedBaskets').add(doc)
  .then(function() {
    showToast('\ud83d\udcbe "' + name + '" saved!', 'success');
    document.getElementById('saveBasketModal').classList.add('hidden');
    document.getElementById('basketNameInput').value = '';
    loadSavedBaskets();
  })
  .catch(function(e) { console.error(e); showToast('\u274c Save failed', 'error'); });
```

} else {
// localStorage fallback
try {
var saved = JSON.parse(localStorage.getItem(‘qb_saved’) || ‘[]’);
doc.id = ‘local_’ + Date.now();
saved.unshift(doc);
localStorage.setItem(‘qb_saved’, JSON.stringify(saved));
showToast(’\ud83d\udcbe “’ + name + ‘” saved locally’, ‘success’);
document.getElementById(‘saveBasketModal’).classList.add(‘hidden’);
document.getElementById(‘basketNameInput’).value = ‘’;
loadSavedBaskets();
} catch(e) { showToast(’\u274c Save failed’, ‘error’); }
}
};

window.loadSavedBaskets = function() {
var list = document.getElementById(‘savedBasketsList’);
if (!list) return;
list.innerHTML = ‘<p style="font-size:0.82rem;color:var(--muted);text-align:center;padding:1rem 0">\u23f3 Loading\u2026</p>’;

if (FB && FB.enabled) {
var q = FB.db.collection(‘savedBaskets’).orderBy(‘savedAt’, ‘desc’).limit(30);
// Filter by user uid if logged in, else sessionId
if (FB.user) {
q = FB.db.collection(‘savedBaskets’)
.where(‘ownerId’, ‘==’, FB.user.uid)
.orderBy(‘savedAt’, ‘desc’).limit(30);
} else {
q = FB.db.collection(‘savedBaskets’)
.where(‘sessionId’, ‘==’, FB.sessionId)
.orderBy(‘savedAt’, ‘desc’).limit(30);
}

```
q.get().then(function(snap) {
  var baskets = snap.docs.map(function(d) {
    var data = d.data();
    data.id = d.id;
    return data;
  });
  // Also merge localStorage ones
  try {
    var local = JSON.parse(localStorage.getItem('qb_saved') || '[]');
    baskets = baskets.concat(local.filter(function(b) { return b.id && b.id.startsWith('local_'); }));
  } catch(e) {}
  renderSavedBaskets(baskets);
}).catch(function(e) {
  console.warn('Load baskets error:', e);
  // Fall back to localStorage
  try {
    renderSavedBaskets(JSON.parse(localStorage.getItem('qb_saved') || '[]'));
  } catch(ex) { renderSavedBaskets([]); }
});
```

} else {
try {
renderSavedBaskets(JSON.parse(localStorage.getItem(‘qb_saved’) || ‘[]’));
} catch(e) { renderSavedBaskets([]); }
}
};

function renderSavedBaskets(baskets) {
var list = document.getElementById(‘savedBasketsList’);
if (!list) return;
if (!baskets || !baskets.length) {
list.innerHTML = ‘<p style="font-size:0.82rem;color:var(--muted);text-align:center;padding:2rem 0">No saved baskets yet.<br><span style="font-size:0.75rem">Add items and tap \ud83d\udcbe</span></p>’;
return;
}
list.innerHTML = baskets.map(function(b) {
var dateStr = ‘’;
try {
var d = b.savedAt && b.savedAt.toDate ? b.savedAt.toDate() : new Date(b.savedAt);
dateStr = d.toLocaleDateString(‘en-IN’, { day:‘numeric’, month:‘short’ });
} catch(e) {}
var count = (b.items || []).length;
return ‘<div class="saved-basket-item">’
+ ‘<div class="saved-basket-name">’ + esc(b.name) + ‘</div>’
+ ‘<div class="saved-basket-meta">\ud83d\udccd ’ + esc(b.city || ‘’) + ’ \u00b7 ’ + count + ’ item’ + (count !== 1 ? ‘s’ : ‘’) + (dateStr ? ’ \u00b7 ’ + dateStr : ‘’) + ‘</div>’
+ ‘<div class="saved-basket-actions">’
+   ‘<button class="saved-basket-btn" onclick="loadBasketById(\'' + b.id + '\'">\ud83d\udcc2 Load</button>’
+   ‘<button class="saved-basket-btn danger" onclick="deleteBasketById(\'' + b.id + '\'">\ud83d\uddd1\ufe0f Delete</button>’
+ ‘</div>’
+ ‘</div>’;
}).join(’’);
}

window.loadBasketById = function(id) {
function applyBasket(data) {
if (!data) { showToast(‘Not found’, ‘error’); return; }
window.basket = {};
(data.items || []).forEach(function(item) { window.basket[item.id] = item.qty; });
if (data.city) { window.currentCity = data.city; try { localStorage.setItem(‘qb_city’, data.city); } catch(e) {} }
var el = document.getElementById(‘locDisplay’);
if (el) el.textContent = window.currentCity;
updateBasketUI(); renderProducts();
document.getElementById(‘savedPanel’).classList.add(‘hidden’);
showToast(’\u2705 “’ + data.name + ‘” loaded!’, ‘success’);
}

if (id.startsWith(‘local_’)) {
try {
var local = JSON.parse(localStorage.getItem(‘qb_saved’) || ‘[]’);
applyBasket(local.find(function(b) { return b.id === id; }));
} catch(e) { showToast(‘Not found’, ‘error’); }
return;
}

if (FB && FB.enabled) {
FB.db.doc(‘savedBaskets/’ + id).get().then(function(snap) {
if (snap.exists) applyBasket(snap.data());
else showToast(‘Not found’, ‘error’);
}).catch(function() { showToast(‘Load failed’, ‘error’); });
}
};

window.deleteBasketById = function(id) {
if (!confirm(‘Delete this basket?’)) return;

if (id.startsWith(‘local_’)) {
try {
var local = JSON.parse(localStorage.getItem(‘qb_saved’) || ‘[]’);
localStorage.setItem(‘qb_saved’, JSON.stringify(local.filter(function(b) { return b.id !== id; })));
showToast(’\ud83d\uddd1\ufe0f Deleted’, ‘’);
loadSavedBaskets();
} catch(e) {}
return;
}

if (FB && FB.enabled) {
FB.db.doc(‘savedBaskets/’ + id).delete()
.then(function() { showToast(’\ud83d\uddd1\ufe0f Deleted’, ‘’); loadSavedBaskets(); })
.catch(function() { showToast(’\u274c Delete failed’, ‘error’); });
}
};

// ── Price reporting ────────────────────────────────────────
window.submitPriceReport = function() {
var appId     = document.getElementById(‘reportApp’).value;
var productId = document.getElementById(‘reportProduct’).value;
var price     = parseFloat(document.getElementById(‘reportPrice’).value);
var city      = (document.getElementById(‘reportCity’).value || ‘’).trim();
if (!appId || !productId || !price || !city) { showToast(‘Fill all fields’, ‘error’); return; }
if (!FB || !FB.enabled) { showToast(‘Firebase offline’, ‘error’); return; }
FB.db.collection(‘priceReports’).add({
appId: appId, productId: productId, reportedPrice: price, city: city,
reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
verified: false, sessionId: FB.sessionId,
uid: FB.user ? FB.user.uid : null
}).then(function() {
showToast(’\ud83d\udea9 Reported! Thank you.’, ‘success’);
document.getElementById(‘reportModal’).classList.add(‘hidden’);
[‘reportApp’,‘reportProduct’,‘reportPrice’,‘reportCity’].forEach(function(f) {
document.getElementById(f).value = ‘’;
});
}).catch(function(e) { showToast(’\u274c Submit failed’, ‘error’); });
};

window.logComparison = function(city, items, results) {
if (!FB || !FB.enabled || !FB.db) return;
FB.db.collection(‘comparisons’).add({
city: city, items: items, results: results,
createdAt: firebase.firestore.FieldValue.serverTimestamp(),
sessionId: FB.sessionId, uid: FB.user ? FB.user.uid : null
}).catch(function() {});
};

function esc(str) {
return String(str).replace(/[&<>”’]/g, function(c) {
return { ‘&’:’&’, ‘<’:’<’, ‘>’:’>’, ‘”’:’"’, “’”:’'’ }[c];
});
}