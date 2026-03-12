// ============================================================
//  QuickBasket — firebase.js  v5
// ============================================================

// ── Helpers (available immediately) ──────────────────────
function qbSetStatus(state) {
  var dot   = document.getElementById('statusDot');
  var label = document.getElementById('statusLabel');
  if (dot)   dot.className    = 'status-dot ' + state;
  if (label) label.textContent = state === 'online'     ? 'Live'
                               : state === 'connecting' ? 'Connecting…'
                               : 'Offline';
}

function qbEsc(str) {
  return String(str || '').replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// ── Main init — runs immediately (scripts are at bottom of body) ──
(function() {

  // Check Firebase SDK loaded
  if (typeof firebase === 'undefined') {
    console.error('QB: firebase SDK not loaded — check <head> script tags');
    qbSetStatus('offline');
    return;
  }

  // Init FB global
  window.FB = {
    app: null, db: null, auth: null,
    enabled: false, user: null,
    sessionId: (function() {
      try {
        var s = sessionStorage.getItem('qb_sid');
        if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('qb_sid', s); }
        return s;
      } catch(e) { return 'sess_' + Date.now(); }
    })()
  };

  qbSetStatus('connecting');

  try {
    FB.app = (firebase.apps && firebase.apps.length) ? firebase.apps[0] : firebase.initializeApp({
      apiKey:            "AIzaSyB6xiR4lpnaPP_OEXPqr5w8M8IDyUNfnhs",
      authDomain:        "quickbasket-ac8ae.firebaseapp.com",
      projectId:         "quickbasket-ac8ae",
      storageBucket:     "quickbasket-ac8ae.firebasestorage.app",
      messagingSenderId: "380670547080",
      appId:             "1:380670547080:web:8ed43c010aff2229b0bb3d"
    });
    FB.db      = firebase.firestore();
    FB.auth    = firebase.auth();
    FB.enabled = true;
    console.log('QB Firebase: init OK');
  } catch(e) {
    console.error('QB Firebase init error:', e);
    qbSetStatus('offline');
    return;
  }

  // Mark live immediately after init — don't wait for Firestore round-trip
  qbSetStatus('online');

  // Auth: catch redirect result (when user returns from Google sign-in page)
  FB.auth.getRedirectResult()
    .then(function(result) {
      if (result && result.user) {
        showToast('✅ Welcome, ' + (result.user.displayName || 'User') + '!', 'success');
      }
    })
    .catch(function(e) {
      if (e.code !== 'auth/no-auth-event') console.warn('QB getRedirectResult:', e.code);
    });

  // Auth state
  FB.auth.onAuthStateChanged(function(user) {
    FB.user = user || null;
    console.log('QB auth state:', user ? user.email : 'signed out');
    qbUpdateAuthBtn();
    if (user) loadSavedBaskets();
  });

  // Seed Firestore if empty
  FB.db.collection('products').limit(1).get()
    .then(function(snap) {
      if (snap.empty) qbSeed();
    }).catch(function() {});

})();

// ── Sign In ────────────────────────────────────────────────
window.signInWithGoogle = function() {
  console.log('QB signInWithGoogle called, FB.auth:', window.FB && !!window.FB.auth);

  if (!window.FB || !window.FB.auth) {
    showToast('Firebase not ready — try again in a moment', 'error');
    return;
  }

  var provider = new firebase.auth.GoogleAuthProvider();
  var mobile   = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  console.log('QB sign in method:', mobile ? 'redirect' : 'popup');

  if (mobile) {
    showToast('Opening Google sign-in…', '');
    FB.auth.signInWithRedirect(provider)
      .catch(function(e) {
        console.error('QB redirect sign-in error:', e);
        showToast('Sign in error: ' + (e.code || e.message), 'error');
      });
  } else {
    FB.auth.signInWithPopup(provider)
      .then(function(r) {
        showToast('✅ Welcome, ' + (r.user.displayName || 'User') + '!', 'success');
      })
      .catch(function(e) {
        console.error('QB popup sign-in error:', e.code, e.message);
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request') {
          FB.auth.signInWithRedirect(provider);
        } else if (e.code === 'auth/unauthorized-domain') {
          showToast('Domain not authorised — add sathyan-tech.github.io in Firebase Console', 'error');
        } else {
          showToast('Sign in failed: ' + (e.code || e.message), 'error');
        }
      });
  }
};

// ── Auth button UI ─────────────────────────────────────────
function qbUpdateAuthBtn() {
  var btn = document.getElementById('authBtn');
  if (!btn) return;
  if (window.FB && window.FB.user) {
    var u = window.FB.user;
    var photo = u.photoURL
      ? '<img src="' + u.photoURL + '" style="width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:4px">'
      : '';
    btn.innerHTML = photo + qbEsc(u.displayName || u.email || 'Account') + ' · Sign out';
    btn.onclick   = function() { FB.auth.signOut().then(function() { showToast('Signed out', ''); }); };
  } else {
    btn.innerHTML = '👤 Sign in';
    btn.onclick   = window.signInWithGoogle;
  }
}

// ── Saved baskets ──────────────────────────────────────────
window.saveBasketToFirebase = function() {
  var name  = (document.getElementById('basketNameInput').value || '').trim();
  var items = Object.keys(window.basket || {}).map(function(id) {
    return { id: id, qty: window.basket[id] };
  });
  if (!name)         { showToast('Enter a basket name', 'error'); return; }
  if (!items.length) { showToast('Basket is empty',     'error'); return; }

  document.getElementById('saveBasketModal').classList.add('hidden');
  document.getElementById('basketNameInput').value = '';

  var doc = {
    name: name, city: window.currentCity || '', items: items,
    sessionId: (window.FB && window.FB.sessionId) || 'local',
    ownerId:   (window.FB && window.FB.user) ? window.FB.user.uid : null,
    savedAt:   new Date().toISOString()
  };

  if (window.FB && window.FB.enabled) {
    doc.savedAt = firebase.firestore.FieldValue.serverTimestamp();
    window.FB.db.collection('savedBaskets').add(doc)
      .then(function() { showToast('💾 "' + name + '" saved!', 'success'); loadSavedBaskets(); })
      .catch(function(e) { console.warn('save basket:', e); qbSaveLocal(doc, name); });
  } else {
    qbSaveLocal(doc, name);
  }
};

function qbSaveLocal(doc, name) {
  try {
    var arr = JSON.parse(localStorage.getItem('qb_saved') || '[]');
    doc.id  = 'local_' + Date.now();
    arr.unshift(doc);
    localStorage.setItem('qb_saved', JSON.stringify(arr.slice(0, 50)));
    showToast('💾 "' + name + '" saved locally', 'success');
    loadSavedBaskets();
  } catch(e) { showToast('Save failed', 'error'); }
}

window.loadSavedBaskets = function() {
  var list = document.getElementById('savedBasketsList');
  if (!list) return;
  list.innerHTML = '<p style="font-size:0.8rem;color:var(--muted);text-align:center;padding:1rem">⏳ Loading…</p>';

  var local = [];
  try { local = JSON.parse(localStorage.getItem('qb_saved') || '[]'); } catch(e) {}

  if (!window.FB || !window.FB.enabled) { qbRenderBaskets(local); return; }

  var q;
  if (window.FB.user) {
    q = window.FB.db.collection('savedBaskets')
          .where('ownerId', '==', window.FB.user.uid)
          .orderBy('savedAt', 'desc').limit(30);
  } else {
    q = window.FB.db.collection('savedBaskets')
          .where('sessionId', '==', window.FB.sessionId)
          .orderBy('savedAt', 'desc').limit(30);
  }

  q.get()
    .then(function(snap) {
      var remote    = snap.docs.map(function(d) { var x = d.data(); x.id = d.id; return x; });
      var remoteIds = remote.map(function(b) { return b.id; });
      var onlyLocal = local.filter(function(b) { return b.id && b.id.indexOf('local_') === 0 && remoteIds.indexOf(b.id) === -1; });
      qbRenderBaskets(remote.concat(onlyLocal));
    })
    .catch(function(e) { console.warn('loadSavedBaskets:', e); qbRenderBaskets(local); });
};

function qbRenderBaskets(list) {
  var el = document.getElementById('savedBasketsList');
  if (!el) return;
  if (!list || !list.length) {
    el.innerHTML = '<p style="font-size:0.82rem;color:var(--muted);text-align:center;padding:2rem 0">No saved baskets yet.<br><span style="font-size:0.75rem">Add items and tap 💾</span></p>';
    return;
  }
  el.innerHTML = list.map(function(b) {
    var ds = '';
    try {
      var d = b.savedAt && b.savedAt.toDate ? b.savedAt.toDate() : new Date(b.savedAt);
      if (!isNaN(d)) ds = d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
    } catch(e) {}
    var n = (b.items || []).length;
    return '<div class="saved-basket-item">'
      + '<div class="saved-basket-name">' + qbEsc(b.name) + '</div>'
      + '<div class="saved-basket-meta">📍 ' + qbEsc(b.city||'') + ' · ' + n + ' item' + (n!==1?'s':'') + (ds?' · '+ds:'') + '</div>'
      + '<div class="saved-basket-actions">'
      +   '<button class="saved-basket-btn" onclick="loadBasketById(\'' + qbEsc(b.id) + '\')">📂 Load</button>'
      +   '<button class="saved-basket-btn danger" onclick="deleteBasketById(\'' + qbEsc(b.id) + '\')">🗑️</button>'
      + '</div></div>';
  }).join('');
}

window.loadBasketById = function(id) {
  function apply(data) {
    if (!data) { showToast('Basket not found', 'error'); return; }
    window.basket = {};
    (data.items||[]).forEach(function(it) { window.basket[it.id] = it.qty; });
    if (data.city) {
      window.currentCity = data.city;
      try { localStorage.setItem('qb_city', data.city); } catch(e) {}
      var el = document.getElementById('locDisplay');
      if (el) el.textContent = data.city;
    }
    updateBasketUI(); renderProducts();
    document.getElementById('savedPanel').classList.add('hidden');
    showToast('✅ "' + data.name + '" loaded!', 'success');
  }
  if (String(id).indexOf('local_') === 0) {
    try { apply((JSON.parse(localStorage.getItem('qb_saved')||'[]')).find(function(b){return b.id===id;})); }
    catch(e) { showToast('Not found','error'); }
    return;
  }
  if (window.FB && window.FB.enabled) {
    window.FB.db.doc('savedBaskets/'+id).get()
      .then(function(s) { s.exists ? apply(s.data()) : showToast('Not found','error'); })
      .catch(function() { showToast('Load failed','error'); });
  }
};

window.deleteBasketById = function(id) {
  if (!confirm('Delete this basket?')) return;
  if (String(id).indexOf('local_') === 0) {
    try {
      var a = JSON.parse(localStorage.getItem('qb_saved')||'[]');
      localStorage.setItem('qb_saved', JSON.stringify(a.filter(function(b){return b.id!==id;})));
      showToast('🗑️ Deleted',''); loadSavedBaskets();
    } catch(e) {}
    return;
  }
  if (window.FB && window.FB.enabled) {
    window.FB.db.doc('savedBaskets/'+id).delete()
      .then(function(){showToast('🗑️ Deleted',''); loadSavedBaskets();})
      .catch(function(){showToast('Delete failed','error');});
  }
};

// ── Price reporting ────────────────────────────────────────
window.submitPriceReport = function() {
  var appId=document.getElementById('reportApp').value,
      pid  =document.getElementById('reportProduct').value,
      price=parseFloat(document.getElementById('reportPrice').value),
      city =(document.getElementById('reportCity').value||'').trim();
  if (!appId||!pid||!price||!city){showToast('Fill all fields','error');return;}
  if (!window.FB||!window.FB.enabled){showToast('Firebase offline','error');return;}
  window.FB.db.collection('priceReports').add({
    appId:appId, productId:pid, reportedPrice:price, city:city,
    reportedAt:firebase.firestore.FieldValue.serverTimestamp(),
    verified:false, sessionId:window.FB.sessionId,
    uid:window.FB.user?window.FB.user.uid:null
  }).then(function(){
    showToast('🚩 Thanks for reporting!','success');
    document.getElementById('reportModal').classList.add('hidden');
    ['reportApp','reportProduct','reportPrice','reportCity'].forEach(function(f){document.getElementById(f).value='';});
  }).catch(function(){showToast('Submit failed','error');});
};

window.logComparison = function(city, items, results) {
  if (!window.FB||!window.FB.enabled) return;
  window.FB.db.collection('comparisons').add({
    city:city, items:items, results:results,
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    sessionId:window.FB.sessionId, uid:window.FB.user?window.FB.user.uid:null
  }).catch(function(){});
};

function qbSeed() {
  if (!window.FB||!window.FB.db||typeof PRODUCTS==='undefined') return;
  var batch = window.FB.db.batch();
  PRODUCTS.forEach(function(p) {
    batch.set(window.FB.db.doc('products/'+p.id), {
      name:p.name, unit:p.unit, emoji:p.emoji, cat:p.cat, basePrice:p.basePrice,
      lastUpdated:firebase.firestore.FieldValue.serverTimestamp()
    });
  });
  batch.commit().catch(function(e){console.warn('QB seed:',e);});
}
