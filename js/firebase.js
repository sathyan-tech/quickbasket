// ============================================================
//  QuickBasket — firebase.js  (plain script, no ES modules)
//  Loaded dynamically by app.js after DOM ready
// ============================================================

(async function initFirebase() {
  // Dynamically load Firebase compat SDKs
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  try {
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics-compat.js');
  } catch(e) {
    console.warn('Firebase SDK load failed:', e);
    window.FB = { enabled: false, sessionId: crypto.randomUUID() };
    setStatus('offline');
    return;
  }

  const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyB6xiR4lpnaPP_OEXPqr5w8M8IDyUNfnhs",
    authDomain:        "quickbasket-ac8ae.firebaseapp.com",
    projectId:         "quickbasket-ac8ae",
    storageBucket:     "quickbasket-ac8ae.firebasestorage.app",
    messagingSenderId: "380670547080",
    appId:             "1:380670547080:web:8ed43c010aff2229b0bb3d",
    measurementId:     "G-QEZFV7NHGJ",
  };

  window.FB = {
    app: null, db: null, analytics: null,
    enabled: false,
    sessionId: crypto.randomUUID(),
  };

  try {
    setStatus('connecting');
    FB.app       = firebase.initializeApp(FIREBASE_CONFIG);
    FB.db        = firebase.firestore();
    FB.analytics = firebase.analytics();
    FB.enabled   = true;
    setStatus('online');
    await seedIfEmpty();
    await loadSavedBaskets();
  } catch(e) {
    console.error('Firebase init error:', e);
    setStatus('offline');
  }
})();

// ——— Keep these as stubs so app.js never crashes calling them before firebase loads ———
window.tryAutoInitFirebase  = async () => true;  // firebase.js handles its own init
window.initFirebaseFromForm = async () => {};
window.skipFirebase         = () => { document.getElementById('firebaseSetupModal')?.classList.add('hidden'); };

function setStatus(state) {
  const dot   = document.getElementById('statusDot');
  const label = document.getElementById('statusLabel');
  if (!dot || !label) return;
  dot.className     = 'status-dot ' + state;
  label.textContent = state === 'online' ? 'Live' : state === 'connecting' ? 'Connecting…' : 'Offline';
}

async function seedIfEmpty() {
  if (!FB.db) return;
  try {
    const snap = await FB.db.collection('products').limit(1).get();
    if (!snap.empty) return;
    console.log('Seeding Firestore…');
    const batch = FB.db.batch();
    for (const p of PRODUCTS) {
      batch.set(FB.db.doc('products/' + p.id), {
        name: p.name, unit: p.unit, emoji: p.emoji,
        cat: p.cat, basePrice: p.basePrice,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    console.log('Seeding done.');
  } catch(e) { console.warn('Seed error:', e); }
}

window.saveBasketToFirebase = async function() {
  const name  = document.getElementById('basketNameInput').value.trim();
  const items = Object.entries(window.basket).map(([id, qty]) => ({ id, qty }));
  if (!name)         { showToast('Enter a basket name', 'error'); return; }
  if (!items.length) { showToast('Basket is empty', 'error'); return; }
  try {
    if (FB.enabled) {
      await FB.db.collection('savedBaskets').add({
        name, city: window.currentCity, items,
        savedAt: firebase.firestore.FieldValue.serverTimestamp(),
        sessionId: FB.sessionId,
      });
      showToast(`💾 "${name}" saved!`, 'success');
    } else {
      const local = JSON.parse(localStorage.getItem('qb_saved') || '[]');
      local.unshift({ id: Date.now()+'', name, city: window.currentCity, items, savedAt: new Date().toISOString() });
      localStorage.setItem('qb_saved', JSON.stringify(local));
      showToast(`💾 "${name}" saved locally`, 'success');
    }
    document.getElementById('saveBasketModal').classList.add('hidden');
    document.getElementById('basketNameInput').value = '';
    await loadSavedBaskets();
  } catch(e) { console.error(e); showToast('❌ Save failed', 'error'); }
};

window.loadSavedBaskets = async function() {
  let baskets = [];
  try {
    if (FB.enabled) {
      const snap = await FB.db.collection('savedBaskets')
        .where('sessionId', '==', FB.sessionId)
        .orderBy('savedAt', 'desc').get();
      baskets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      baskets = JSON.parse(localStorage.getItem('qb_saved') || '[]');
    }
  } catch(e) {
    baskets = JSON.parse(localStorage.getItem('qb_saved') || '[]');
  }
  renderSavedBaskets(baskets);
};

function renderSavedBaskets(baskets) {
  const list = document.getElementById('savedBasketsList');
  if (!list) return;
  if (!baskets.length) {
    list.innerHTML = `<p style="font-size:0.82rem;color:var(--muted);text-align:center;padding:2rem 0">No saved baskets yet.</p>`; return;
  }
  list.innerHTML = baskets.map(b => {
    const date  = b.savedAt?.toDate ? b.savedAt.toDate().toLocaleDateString('en-IN') : new Date(b.savedAt).toLocaleDateString('en-IN');
    const count = b.items?.length || 0;
    return `<div class="saved-basket-item">
      <div class="saved-basket-name">${esc(b.name)}</div>
      <div class="saved-basket-meta">📍 ${esc(b.city||'')} · ${count} item${count!==1?'s':''} · ${date}</div>
      <div class="saved-basket-actions">
        <button class="saved-basket-btn" onclick="loadBasketById('${b.id}')">📂 Load</button>
        <button class="saved-basket-btn danger" onclick="deleteBasketById('${b.id}')">🗑️ Delete</button>
      </div>
    </div>`;
  }).join('');
}

window.loadBasketById = async function(id) {
  let data = null;
  try {
    if (FB.enabled) {
      const snap = await FB.db.doc('savedBaskets/' + id).get();
      if (snap.exists) data = snap.data();
    } else {
      data = JSON.parse(localStorage.getItem('qb_saved')||'[]').find(b => b.id===id);
    }
  } catch(e) {}
  if (!data) { showToast('Not found', 'error'); return; }
  window.basket = {};
  (data.items||[]).forEach(({id:pid,qty}) => { window.basket[pid]=qty; });
  window.currentCity = data.city || window.currentCity;
  document.getElementById('locDisplay').textContent = window.currentCity;
  updateBasketUI(); renderProducts(); toggleSavedPanel();
  showToast(`✅ "${data.name}" loaded!`, 'success');
};

window.deleteBasketById = async function(id) {
  if (!confirm('Delete this basket?')) return;
  try {
    if (FB.enabled) await FB.db.doc('savedBaskets/'+id).delete();
    else {
      const local = JSON.parse(localStorage.getItem('qb_saved')||'[]');
      localStorage.setItem('qb_saved', JSON.stringify(local.filter(b=>b.id!==id)));
    }
    showToast('🗑️ Deleted',''); await loadSavedBaskets();
  } catch(e) { showToast('❌ Delete failed','error'); }
};

window.submitPriceReport = async function() {
  const appId=document.getElementById('reportApp').value;
  const productId=document.getElementById('reportProduct').value;
  const price=parseFloat(document.getElementById('reportPrice').value);
  const city=document.getElementById('reportCity').value.trim();
  if (!appId||!productId||!price||!city) { showToast('Fill all fields','error'); return; }
  try {
    await FB.db.collection('priceReports').add({
      appId, productId, reportedPrice:price, city,
      reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
      verified:false, sessionId:FB.sessionId,
    });
    showToast('🚩 Reported! Thank you.','success');
    document.getElementById('reportModal').classList.add('hidden');
    ['reportApp','reportProduct','reportPrice','reportCity'].forEach(f=>document.getElementById(f).value='');
  } catch(e) { showToast('❌ Submit failed','error'); }
};

window.logComparison = async function(city, items, results) {
  if (!FB.enabled||!FB.db) return;
  try { await FB.db.collection('comparisons').add({ city, items, results, createdAt: firebase.firestore.FieldValue.serverTimestamp(), sessionId:FB.sessionId }); } catch(e){}
};

function esc(str) {
  return String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
