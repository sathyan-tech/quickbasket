// ============================================================
//  QuickBasket — firebase.js
//  Firebase initialization, Firestore helpers
// ============================================================
//
//  Database schema (Firestore):
//
//  /products/{productId}
//    name, unit, emoji, cat, basePrice, lastUpdated
//
//  /appFees/{appId}
//    name, deliveryFeeThreshold, deliveryFee, handlingFee,
//    platformFee, smallOrderThreshold, smallOrderFee,
//    priceMultiplier, freeDeliveryAbove, lastUpdated
//
//  /priceReports/{autoId}
//    appId, productId, reportedPrice, city, reportedAt,
//    verified (bool), reporterSession
//
//  /savedBaskets/{userId}/{basketId}
//    name, city, items: [{id, qty}], savedAt, lastCompared
//
//  /comparisons/{autoId}
//    city, items, results (snapshot), createdAt, sessionId
//
// ============================================================

import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore,
         doc, getDoc, setDoc, addDoc, getDocs,
         collection, query, where, orderBy,
         serverTimestamp, onSnapshot, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAnalytics }         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';

// ——— State ———
window.FB = {
  app: null,
  db: null,
  analytics: null,
  enabled: false,
  sessionId: crypto.randomUUID(),
};

// ——— Init from form (called by UI) ———
window.initFirebaseFromForm = async function () {
  const config = {
    apiKey:            document.getElementById('fb_apiKey').value.trim(),
    authDomain:        document.getElementById('fb_authDomain').value.trim(),
    projectId:         document.getElementById('fb_projectId').value.trim(),
    storageBucket:     document.getElementById('fb_storageBucket').value.trim(),
    messagingSenderId: document.getElementById('fb_messagingSenderId').value.trim(),
    appId:             document.getElementById('fb_appId').value.trim(),
  };

  if (!config.apiKey || !config.projectId) {
    showToast('⚠️ Please fill in at least apiKey and projectId', 'error');
    return;
  }

  try {
    setStatus('connecting');
    FB.app       = initializeApp(config);
    FB.db        = getFirestore(FB.app);
    FB.analytics = getAnalytics(FB.app);
    FB.enabled   = true;

    // Persist config in localStorage for next visit
    localStorage.setItem('qb_firebase_config', JSON.stringify(config));

    setStatus('online');
    document.getElementById('firebaseSetupModal').classList.add('hidden');
    showToast('🔥 Firebase connected!', 'success');

    // Seed initial data if collections are empty
    await seedIfEmpty();

    // Load saved baskets
    await loadSavedBaskets();

  } catch (err) {
    console.error('Firebase init error:', err);
    setStatus('offline');
    showToast('❌ Firebase connection failed. Check config.', 'error');
  }
};

// ——— Auto-init from localStorage ———
window.tryAutoInitFirebase = async function () {
  const saved = localStorage.getItem('qb_firebase_config');
  if (!saved) return false;
  try {
    const config = JSON.parse(saved);
    // Pre-fill form
    Object.keys(config).forEach(k => {
      const el = document.getElementById('fb_' + k);
      if (el) el.value = config[k];
    });
    setStatus('connecting');
    FB.app       = initializeApp(config);
    FB.db        = getFirestore(FB.app);
    FB.enabled   = true;
    setStatus('online');
    document.getElementById('firebaseSetupModal').classList.add('hidden');
    await seedIfEmpty();
    await loadSavedBaskets();
    return true;
  } catch (e) {
    console.warn('Auto-init failed:', e);
    setStatus('offline');
    return false;
  }
};

// ——— Skip Firebase (offline mode) ———
window.skipFirebase = function () {
  document.getElementById('firebaseSetupModal').classList.add('hidden');
  setStatus('offline');
  showToast('Running in offline mode', '');
};

// ——— Status helper ———
function setStatus(state) {
  const dot   = document.getElementById('statusDot');
  const label = document.getElementById('statusLabel');
  dot.className = 'status-dot ' + state;
  label.textContent = state === 'online' ? 'Live' : state === 'connecting' ? 'Connecting…' : 'Offline';
}

// ——— Seed Firestore with initial product & app data ———
async function seedIfEmpty() {
  if (!FB.db) return;
  try {
    const snapshot = await getDocs(collection(FB.db, 'products'));
    if (!snapshot.empty) return; // already seeded

    console.log('Seeding Firestore with initial data…');

    // Seed products
    for (const p of PRODUCTS) {
      await setDoc(doc(FB.db, 'products', p.id), {
        name: p.name, unit: p.unit, emoji: p.emoji,
        cat: p.cat, basePrice: p.basePrice,
        lastUpdated: serverTimestamp(),
      });
    }

    // Seed app fees
    for (const a of APPS) {
      await setDoc(doc(FB.db, 'appFees', a.id), {
        name: a.name, color: a.color, textColor: a.textColor,
        eta: a.eta,
        freeDeliveryAbove: a.freeDeliveryAbove,
        priceMultiplierDefault: a.priceMultiplier.default,
        available: a.available,
        lastUpdated: serverTimestamp(),
      });
    }

    console.log('Seeding complete.');
    showToast('✅ Database seeded with product data!', 'success');
  } catch (e) {
    console.warn('Seeding error (check Firestore rules):', e);
  }
}

// ——— Save basket to Firestore ———
window.saveBasketToFirebase = async function () {
  const name = document.getElementById('basketNameInput').value.trim();
  if (!name) { showToast('Please enter a basket name', 'error'); return; }

  const items = Object.entries(window.basket).map(([id, qty]) => ({ id, qty }));
  if (items.length === 0) { showToast('Basket is empty', 'error'); return; }

  const data = {
    name,
    city: window.currentCity,
    items,
    savedAt: FB.enabled ? serverTimestamp() : new Date().toISOString(),
    sessionId: FB.sessionId,
  };

  try {
    if (FB.enabled && FB.db) {
      await addDoc(collection(FB.db, 'savedBaskets'), data);
      showToast(`💾 "${name}" saved to Firebase!`, 'success');
    } else {
      // Offline: save to localStorage
      const local = JSON.parse(localStorage.getItem('qb_saved_baskets') || '[]');
      local.push({ ...data, id: Date.now().toString(), savedAt: new Date().toISOString() });
      localStorage.setItem('qb_saved_baskets', JSON.stringify(local));
      showToast(`💾 "${name}" saved locally!`, 'success');
    }
    document.getElementById('saveBasketModal').classList.add('hidden');
    document.getElementById('basketNameInput').value = '';
    await loadSavedBaskets();
  } catch (e) {
    console.error('Save error:', e);
    showToast('❌ Could not save basket', 'error');
  }
};

// ——— Load saved baskets ———
window.loadSavedBaskets = async function () {
  let baskets = [];

  try {
    if (FB.enabled && FB.db) {
      const q = query(
        collection(FB.db, 'savedBaskets'),
        where('sessionId', '==', FB.sessionId),
        orderBy('savedAt', 'desc')
      );
      const snap = await getDocs(q);
      baskets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      baskets = JSON.parse(localStorage.getItem('qb_saved_baskets') || '[]').reverse();
    }
  } catch (e) {
    console.warn('Load baskets error:', e);
    baskets = JSON.parse(localStorage.getItem('qb_saved_baskets') || '[]').reverse();
  }

  renderSavedBaskets(baskets);
};

function renderSavedBaskets(baskets) {
  const list = document.getElementById('savedBasketsList');
  if (!baskets.length) {
    list.innerHTML = `<p style="font-size:0.82rem;color:var(--muted);text-align:center;padding:2rem 0">No saved baskets yet.<br>Build a basket and save it!</p>`;
    return;
  }

  list.innerHTML = baskets.map(b => {
    const date = b.savedAt?.toDate ? b.savedAt.toDate().toLocaleDateString() : (b.savedAt ? new Date(b.savedAt).toLocaleDateString() : 'Recently');
    const itemCount = b.items?.length || 0;
    return `
    <div class="saved-basket-item">
      <div class="saved-basket-name">${escHtml(b.name)}</div>
      <div class="saved-basket-meta">📍 ${escHtml(b.city)} · ${itemCount} items · ${date}</div>
      <div class="saved-basket-actions">
        <button class="saved-basket-btn" onclick="loadBasketById('${b.id}')">📂 Load</button>
        <button class="saved-basket-btn danger" onclick="deleteBasketById('${b.id}')">🗑️ Delete</button>
      </div>
    </div>`;
  }).join('');
}

window.loadBasketById = async function (id) {
  let basket = null;

  if (FB.enabled && FB.db) {
    const snap = await getDoc(doc(FB.db, 'savedBaskets', id));
    if (snap.exists()) basket = snap.data();
  } else {
    const local = JSON.parse(localStorage.getItem('qb_saved_baskets') || '[]');
    basket = local.find(b => b.id === id);
  }

  if (!basket) { showToast('Basket not found', 'error'); return; }

  window.basket = {};
  (basket.items || []).forEach(({ id: pid, qty }) => { window.basket[pid] = qty; });
  window.currentCity = basket.city || window.currentCity;
  document.getElementById('locDisplay').textContent = window.currentCity;

  updateBasketUI();
  renderProducts();
  toggleSavedPanel();
  showToast(`✅ "${basket.name}" loaded!`, 'success');
};

window.deleteBasketById = async function (id) {
  if (!confirm('Delete this saved basket?')) return;
  try {
    if (FB.enabled && FB.db) {
      await deleteDoc(doc(FB.db, 'savedBaskets', id));
    } else {
      const local = JSON.parse(localStorage.getItem('qb_saved_baskets') || '[]');
      localStorage.setItem('qb_saved_baskets', JSON.stringify(local.filter(b => b.id !== id)));
    }
    showToast('🗑️ Basket deleted', '');
    await loadSavedBaskets();
  } catch (e) {
    showToast('❌ Could not delete', 'error');
  }
};

// ——— Price report submission ———
window.submitPriceReport = async function () {
  const appId    = document.getElementById('reportApp').value;
  const productId= document.getElementById('reportProduct').value;
  const price    = parseFloat(document.getElementById('reportPrice').value);
  const city     = document.getElementById('reportCity').value.trim();

  if (!appId || !productId || !price || !city) {
    showToast('Please fill all fields', 'error');
    return;
  }

  const report = {
    appId, productId, reportedPrice: price, city,
    reportedAt: FB.enabled ? serverTimestamp() : new Date().toISOString(),
    verified: false,
    sessionId: FB.sessionId,
  };

  try {
    if (FB.enabled && FB.db) {
      await addDoc(collection(FB.db, 'priceReports'), report);
      showToast('🚩 Price reported! Thank you.', 'success');
    } else {
      showToast('⚠️ Connect Firebase to submit reports', 'error');
      return;
    }
    document.getElementById('reportModal').classList.add('hidden');
    // Reset form
    ['reportApp','reportProduct','reportPrice','reportCity'].forEach(id => {
      document.getElementById(id).value = '';
    });
  } catch (e) {
    console.error('Report error:', e);
    showToast('❌ Could not submit report', 'error');
  }
};

// ——— Log comparison to Firestore ———
window.logComparison = async function (city, items, results) {
  if (!FB.enabled || !FB.db) return;
  try {
    await addDoc(collection(FB.db, 'comparisons'), {
      city, items, results,
      createdAt: serverTimestamp(),
      sessionId: FB.sessionId,
    });
  } catch (e) { /* silent */ }
};

// ——— Helper ———
function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
