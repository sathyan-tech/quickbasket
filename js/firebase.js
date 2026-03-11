// ============================================================
//  QuickBasket — firebase.js  v4
//  SDKs loaded in index.html <head> — no dynamic loading here
// ============================================================

(function() {

// ── Status helpers ────────────────────────────────────────
function setStatus(state) {
var dot   = document.getElementById(‘statusDot’);
var label = document.getElementById(‘statusLabel’);
if (dot)   dot.className   = ’status-dot ’ + state;
if (label) label.textContent = state === ‘online’       ? ‘Live’
: state === ‘connecting’   ? ‘Connecting…’
: ‘Offline’;
}

function esc(str) {
return String(str || ‘’).replace(/[&<>”’]/g, function(c) {
return {’&’:’&’,’<’:’<’,’>’:’>’,’”’:’"’,”’”:’'’}[c];
});
}

// ── Wait for DOM + firebase global ───────────────────────
function init() {
if (typeof firebase === ‘undefined’) {
console.error(‘QuickBasket: firebase global not found. Check SDK scripts in index.html.’);
setStatus(‘offline’);
return;
}

```
window.FB = {
  app:       null,
  db:        null,
  auth:      null,
  enabled:   false,
  user:      null,
  sessionId: (function() {
    var s = sessionStorage.getItem('qb_sid');
    if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('qb_sid', s); }
    return s;
  })()
};

setStatus('connecting');

try {
  // Avoid duplicate app error on hot reload
  if (firebase.apps && firebase.apps.length) {
    FB.app = firebase.apps[0];
  } else {
    FB.app = firebase.initializeApp({
      apiKey:            "AIzaSyB6xiR4lpnaPP_OEXPqr5w8M8IDyUNfnhs",
      authDomain:        "quickbasket-ac8ae.firebaseapp.com",
      projectId:         "quickbasket-ac8ae",
      storageBucket:     "quickbasket-ac8ae.firebasestorage.app",
      messagingSenderId: "380670547080",
      appId:             "1:380670547080:web:8ed43c010aff2229b0bb3d"
    });
  }

  FB.db   = firebase.firestore();
  FB.auth = firebase.auth();
  FB.enabled = true;

} catch(e) {
  console.error('Firebase init failed:', e);
  setStatus('offline');
  return;
}

// ── Verify Firestore is reachable ─────────────────────
FB.db.collection('_ping').limit(1).get()
  .then(function()  { setStatus('online'); })
  .catch(function() { setStatus('online'); }); // still mark online — rules may block _ping

// ── Auth: handle redirect result first ────────────────
FB.auth.getRedirectResult()
  .then(function(result) {
    if (result && result.user) {
      showToast('✅ Welcome, ' + (result.user.displayName || 'User') + '!', 'success');
    }
  })
  .catch(function(e) {
    if (e.code !== 'auth/no-auth-event') console.warn('getRedirectResult:', e.code, e.message);
  });

// ── Auth state listener ───────────────────────────────
FB.auth.onAuthStateChanged(function(user) {
  FB.user = user || null;
  updateAuthUI();
  if (user) loadSavedBaskets();
});

// ── Seed products if Firestore is empty ───────────────
seedIfEmpty();
```

} // end init()

// Run after DOM ready
if (document.readyState === ‘loading’) {
document.addEventListener(‘DOMContentLoaded’, init);
} else {
init();
}

})();

// ── Google Sign-In ─────────────────────────────────────────
window.signInWithGoogle = function() {
if (!window.FB || !window.FB.auth) {
showToast(‘Firebase not ready — wait a moment’, ‘error’); return;
}
var provider = new firebase.auth.GoogleAuthProvider();
var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
showToast(‘Redirecting to Google…’, ‘’);
FB.auth.signInWithRedirect(provider)
.catch(function(e) { showToast(’Sign in error: ’ + (e.message || e.code), ‘error’); });
} else {
FB.auth.signInWithPopup(provider)
.then(function(r) {
showToast(’✅ Welcome, ’ + (r.user.displayName || ‘User’) + ‘!’, ‘success’);
})
.catch(function(e) {
if (e.code === ‘auth/popup-blocked’) {
FB.auth.signInWithRedirect(provider);
} else {
console.error(‘signInWithPopup:’, e);
showToast(’Sign in failed: ’ + (e.message || e.code), ‘error’);
}
});
}
};

// ── Auth UI ────────────────────────────────────────────────
function updateAuthUI() {
var btn = document.getElementById(‘authBtn’);
if (!btn) return;
if (window.FB && window.FB.user) {
var u = window.FB.user;
var photo = u.photoURL
? ‘<img src="' + u.photoURL + '" style="width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:3px">’
: ‘’;
btn.innerHTML = photo + esc(u.displayName || u.email || ‘Account’) + ’ · Sign out’;
btn.onclick = function() {
window.FB.auth.signOut().then(function() { showToast(‘Signed out’, ‘’); });
};
} else {
btn.innerHTML = ‘👤 Sign in’;
btn.onclick = window.signInWithGoogle;
}
}

// ── Saved baskets ──────────────────────────────────────────
window.saveBasketToFirebase = function() {
var name  = (document.getElementById(‘basketNameInput’).value || ‘’).trim();
var items = Object.keys(window.basket).map(function(id) {
return { id: id, qty: window.basket[id] };
});
if (!name)         { showToast(‘Enter a basket name’, ‘error’); return; }
if (!items.length) { showToast(‘Basket is empty’, ‘error’); return; }

document.getElementById(‘saveBasketModal’).classList.add(‘hidden’);

var doc = {
name:      name,
city:      window.currentCity,
items:     items,
sessionId: window.FB ? window.FB.sessionId : ‘local’,
ownerId:   (window.FB && window.FB.user) ? window.FB.user.uid : null,
savedAt:   new Date().toISOString()
};

if (window.FB && window.FB.enabled) {
doc.savedAt = firebase.firestore.FieldValue.serverTimestamp();
window.FB.db.collection(‘savedBaskets’).add(doc)
.then(function() {
document.getElementById(‘basketNameInput’).value = ‘’;
showToast(‘💾 “’ + name + ‘” saved!’, ‘success’);
loadSavedBaskets();
})
.catch(function(e) {
console.error(‘Save basket:’, e);
// Fall back to localStorage
saveLocal(doc, name);
});
} else {
saveLocal(doc, name);
}
};

function saveLocal(doc, name) {
try {
var saved = JSON.parse(localStorage.getItem(‘qb_saved’) || ‘[]’);
doc.id = ‘local_’ + Date.now();
saved.unshift(doc);
localStorage.setItem(‘qb_saved’, JSON.stringify(saved.slice(0, 50)));
document.getElementById(‘basketNameInput’).value = ‘’;
showToast(‘💾 “’ + name + ‘” saved locally’, ‘success’);
loadSavedBaskets();
} catch(e) { showToast(‘Save failed’, ‘error’); }
}

window.loadSavedBaskets = function() {
var list = document.getElementById(‘savedBasketsList’);
if (!list) return;
list.innerHTML = ‘<p style="font-size:0.8rem;color:var(--muted);text-align:center;padding:1rem">⏳ Loading…</p>’;

var localBaskets = [];
try { localBaskets = JSON.parse(localStorage.getItem(‘qb_saved’) || ‘[]’); } catch(e) {}

if (!window.FB || !window.FB.enabled) {
renderSavedBaskets(localBaskets); return;
}

var q;
if (window.FB.user) {
q = window.FB.db.collection(‘savedBaskets’)
.where(‘ownerId’, ‘==’, window.FB.user.uid)
.orderBy(‘savedAt’, ‘desc’).limit(30);
} else {
q = window.FB.db.collection(‘savedBaskets’)
.where(‘sessionId’, ‘==’, window.FB.sessionId)
.orderBy(‘savedAt’, ‘desc’).limit(30);
}

q.get()
.then(function(snap) {
var remote = snap.docs.map(function(d) {
var data = d.data(); data.id = d.id; return data;
});
// Merge remote + local (dedupe by id)
var remoteIds = remote.map(function(b) { return b.id; });
var onlyLocal = localBaskets.filter(function(b) { return b.id && b.id.startsWith(‘local_’) && remoteIds.indexOf(b.id) === -1; });
renderSavedBaskets(remote.concat(onlyLocal));
})
.catch(function(e) {
console.warn(‘loadSavedBaskets:’, e);
renderSavedBaskets(localBaskets);
});
};

function renderSavedBaskets(baskets) {
var list = document.getElementById(‘savedBasketsList’);
if (!list) return;
if (!baskets || !baskets.length) {
list.innerHTML = ‘<p style="font-size:0.82rem;color:var(--muted);text-align:center;padding:2rem 0">No saved baskets yet.<br><span style="font-size:0.75rem">Add items and tap 💾</span></p>’;
return;
}
list.innerHTML = baskets.map(function(b) {
var dateStr = ‘’;
try {
var d = b.savedAt && b.savedAt.toDate ? b.savedAt.toDate() : new Date(b.savedAt);
if (!isNaN(d)) dateStr = d.toLocaleDateString(‘en-IN’, { day:‘numeric’, month:‘short’ });
} catch(e) {}
var count = (b.items || []).length;
return ‘<div class="saved-basket-item">’
+ ‘<div class="saved-basket-name">’ + esc(b.name) + ‘</div>’
+ ‘<div class="saved-basket-meta">📍 ’ + esc(b.city || ‘’) + ’ · ’ + count + ’ item’ + (count !== 1 ? ‘s’ : ‘’) + (dateStr ? ’ · ’ + dateStr : ‘’) + ‘</div>’
+ ‘<div class="saved-basket-actions">’
+   ‘<button class="saved-basket-btn" onclick="loadBasketById(\'' + esc(b.id) + '\')">📂 Load</button>’
+   ‘<button class="saved-basket-btn danger" onclick="deleteBasketById(\'' + esc(b.id) + '\')">🗑️ Delete</button>’
+ ‘</div></div>’;
}).join(’’);
}

window.loadBasketById = function(id) {
function apply(data) {
if (!data) { showToast(‘Basket not found’, ‘error’); return; }
window.basket = {};
(data.items || []).forEach(function(it) { window.basket[it.id] = it.qty; });
if (data.city) {
window.currentCity = data.city;
try { localStorage.setItem(‘qb_city’, data.city); } catch(e) {}
var el = document.getElementById(‘locDisplay’);
if (el) el.textContent = data.city;
}
updateBasketUI(); renderProducts();
document.getElementById(‘savedPanel’).classList.add(‘hidden’);
showToast(‘✅ “’ + data.name + ‘” loaded!’, ‘success’);
}

if (String(id).startsWith(‘local_’)) {
try { apply((JSON.parse(localStorage.getItem(‘qb_saved’) || ‘[]’)).find(function(b) { return b.id === id; })); }
catch(e) { showToast(‘Not found’, ‘error’); }
return;
}
if (window.FB && window.FB.enabled) {
window.FB.db.doc(‘savedBaskets/’ + id).get()
.then(function(s) { if (s.exists) apply(s.data()); else showToast(‘Not found’,‘error’); })
.catch(function() { showToast(‘Load failed’,‘error’); });
}
};

window.deleteBasketById = function(id) {
if (!confirm(‘Delete this basket?’)) return;
if (String(id).startsWith(‘local_’)) {
try {
var s = JSON.parse(localStorage.getItem(‘qb_saved’) || ‘[]’);
localStorage.setItem(‘qb_saved’, JSON.stringify(s.filter(function(b) { return b.id !== id; })));
showToast(‘🗑️ Deleted’, ‘’); loadSavedBaskets();
} catch(e) {}
return;
}
if (window.FB && window.FB.enabled) {
window.FB.db.doc(‘savedBaskets/’ + id).delete()
.then(function() { showToast(‘🗑️ Deleted’, ‘’); loadSavedBaskets(); })
.catch(function() { showToast(‘Delete failed’, ‘error’); });
}
};

// ── Price reporting ────────────────────────────────────────
window.submitPriceReport = function() {
var appId     = document.getElementById(‘reportApp’).value;
var productId = document.getElementById(‘reportProduct’).value;
var price     = parseFloat(document.getElementById(‘reportPrice’).value);
var city      = (document.getElementById(‘reportCity’).value || ‘’).trim();
if (!appId || !productId || !price || !city) { showToast(‘Fill all fields’, ‘error’); return; }
if (!window.FB || !window.FB.enabled)        { showToast(‘Firebase offline’, ‘error’); return; }
window.FB.db.collection(‘priceReports’).add({
appId: appId, productId: productId, reportedPrice: price, city: city,
reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
verified: false, sessionId: window.FB.sessionId,
uid: window.FB.user ? window.FB.user.uid : null
}).then(function() {
showToast(‘🚩 Reported! Thank you.’, ‘success’);
document.getElementById(‘reportModal’).classList.add(‘hidden’);
[‘reportApp’,‘reportProduct’,‘reportPrice’,‘reportCity’].forEach(function(f) { document.getElementById(f).value = ‘’; });
}).catch(function(e) { showToast(‘Submit failed’, ‘error’); });
};

window.logComparison = function(city, items, results) {
if (!window.FB || !window.FB.enabled) return;
window.FB.db.collection(‘comparisons’).add({
city: city, items: items, results: results,
createdAt: firebase.firestore.FieldValue.serverTimestamp(),
sessionId: window.FB.sessionId,
uid: window.FB.user ? window.FB.user.uid : null
}).catch(function() {});
};

// ── Seed ──────────────────────────────────────────────────
function seedIfEmpty() {
if (!window.FB || !window.FB.db) return;
window.FB.db.collection(‘products’).limit(1).get()
.then(function(snap) {
if (!snap.empty) return;
var batch = window.FB.db.batch();
PRODUCTS.forEach(function(p) {
batch.set(window.FB.db.doc(‘products/’ + p.id), {
name: p.name, unit: p.unit, emoji: p.emoji,
cat: p.cat, basePrice: p.basePrice,
lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
});
});
batch.commit().catch(function(e) { console.warn(‘Seed:’, e); });
}).catch(function() {});
}