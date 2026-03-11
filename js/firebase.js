// ============================================================
//  QuickBasket — firebase.js
//  Config hardcoded — no setup prompt, works on every device
// ============================================================

import { initializeApp }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore,
         doc, getDoc, setDoc, addDoc, getDocs,
         collection, query, where, orderBy,
         serverTimestamp, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAnalytics }    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';

// ——— Hardcoded config — no modal needed ———
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB6xiR4lpnaPP_OEXPqr5w8M8IDyUNfnhs",
  authDomain:        "quickbasket-ac8ae.firebaseapp.com",
  projectId:         "quickbasket-ac8ae",
  storageBucket:     "quickbasket-ac8ae.firebasestorage.app",
  messagingSenderId: "380670547080",
  appId:             "1:380670547080:web:8ed43c010aff2229b0bb3d",
  measurementId:     "G-QEZFV7NHGJ",
};

// ——— State ———
window.FB = {
  app:       null,
  db:        null,
  analytics: null,
  enabled:   false,
  sessionId: crypto.randomUUID(),
};

// ——— Auto-init on load (no user action needed) ———
window.tryAutoInitFirebase = async function () {
  try {
    setStatus('connecting');
    FB.app       = initializeApp(FIREBASE_CONFIG);
    FB.db        = getFirestore(FB.app);
    FB.analytics = getAnalytics(FB.app);
    FB.enabled   = true;
    setStatus('online');

    // Hide setup modal if somehow visible
    const modal = document.getElementById('firebaseSetupModal');
    if (modal) modal.classList.add('hidden');

    await seedIfEmpty();
    await loadSavedBaskets();
    return true;
  } catch (e) {
    console.error('Firebase init error:', e);
    setStatus('offline');
    return false;
  }
};

// ——— These are kept so old references don't break ———
window.initFirebaseFromForm = window.tryAutoInitFirebase;
window.skipFirebase = function () {
  const modal = document.getElementById('firebaseSetupModal');
  if (modal) modal.classList.add('hidden');
};

// ——— Status indicator ———
function setStatus(state) {
  const dot   = document.getElementById('statusDot');
  const label = document.getElementById('statusLabel');
  if (!dot || !label) return;
  dot.className     = 'status-dot ' + state;
  label.textContent = state === 'online' ? 'Live' : state === 'connecting' ? 'Connecting…' : 'Offline';
}

// ——— Seed Firestore on first run ———
async function seedIfEmpty() {
  if (!FB.db) return;
  try {
    const snap = await getDocs(collection(FB.db, 'products'));
    if (!snap.empty) return;
    console.log('First run — seeding Firestore…');
    for (const p of PRODUCTS) {
      await setDoc(doc(FB.db, 'products', p.id), {
        name: p.name, unit: p.unit, emoji: p.emoji,
        cat: p.cat, basePrice: p.basePrice,
        lastUpdated: serverTimestamp(),
      });
    }
    for (const a of APPS) {
      await setDoc(doc(FB.db, 'appFees', a.id), {
        name: a.name, color: a.color, eta: a.eta,
        freeDeliveryAbove: a.freeDeliveryAbove,
        priceMultiplierDefault: a.priceMultiplier.default,
        lastUpdated: serverTimestamp(),
      });
    }
    console.log('Seeding complete.');
  } catch (e) {
    console.warn('Seed error (Firestore rules may need update):', e);
  }
}

// ——— Save basket ———
window.saveBasketToFirebase = async function () {
  const name  = document.getElementById('basketNameInput').value.trim();
  const items = Object.entries(window.basket).map(([id, qty]) => ({ id, qty }));
  if (!name)          { showToast('Please enter a basket name', 'error'); return; }
  if (!items.length)  { showToast('Basket is empty', 'error'); return; }

  const data = {
    name,
    city:      window.currentCity,
    items,
    savedAt:   serverTimestamp(),
    sessionId: FB.sessionId,
  };

  try {
    if (FB.enabled && FB.db) {
      await addDoc(collection(FB.db, 'savedBaskets'), data);
      showToast(`💾 "${name}" saved!`, 'success');
    } else {
      // Offline fallback
      const local = JSON.parse(localStorage.getItem('qb_saved_baskets') || '[]');
      local.push({ ...data, id: Date.now().toString(), savedAt: new Date().toISOString() });
      localStorage.setItem('qb_saved_baskets', JSON.stringify(local));
      showToast(`💾 "${name}" saved locally`, 'success');
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
      const q    = query(
        collection(FB.db, 'savedBaskets'),
        where('sessionId', '==', FB.sessionId),
        orderBy('savedAt', 'desc')
      );
      const snap = await getDocs(q);
      baskets    = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      baskets = JSON.parse(localStorage.getItem('qb_saved_baskets') || '[]').reverse();
    }
  } catch (e) {
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
    const date  = b.savedAt?.toDate ? b.savedAt.toDate().toLocaleDateString('en-IN') : new Date(b.savedAt).toLocaleDateString('en-IN');
    const count = b.items?.length || 0;
    return `
    <div class="saved-basket-item">
      <div class="saved-basket-name">${esc(b.name)}</div>
      <div class="saved-basket-meta">📍 ${esc(b.city)} · ${count} item${count!==1?'s':''} · ${date}</div>
      <div class="saved-basket-actions">
        <button class="saved-basket-btn" onclick="loadBasketById('${b.id}')">📂 Load</button>
        <button class="saved-basket-btn danger" onclick="deleteBasketById('${b.id}')">🗑️ Delete</button>
      </div>
    </div>`;
  }).join('');
}

window.loadBasketById = async function (id) {
  let data = null;
  try {
    if (FB.enabled && FB.db) {
      const snap = await getDoc(doc(FB.db, 'savedBaskets', id));
      if (snap.exists()) data = snap.data();
    } else {
      data = JSON.parse(localStorage.getItem('qb_saved_baskets') || '[]').find(b => b.id === id);
    }
  } catch (e) { /* fall through */ }

  if (!data) { showToast('Basket not found', 'error'); return; }

  window.basket = {};
  (data.items || []).forEach(({ id: pid, qty }) => { window.basket[pid] = qty; });
  window.currentCity = data.city || window.currentCity;
  document.getElementById('locDisplay').textContent = window.currentCity;
  updateBasketUI();
  renderProducts();
  toggleSavedPanel();
  showToast(`✅ "${data.name}" loaded!`, 'success');
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
    showToast('🗑️ Deleted', '');
    await loadSavedBaskets();
  } catch (e) { showToast('❌ Could not delete', 'error'); }
};

// ——— Price report ———
window.submitPriceReport = async function () {
  const appId     = document.getElementById('reportApp').value;
  const productId = document.getElementById('reportProduct').value;
  const price     = parseFloat(document.getElementById('reportPrice').value);
  const city      = document.getElementById('reportCity').value.trim();
  if (!appId || !productId || !price || !city) { showToast('Please fill all fields', 'error'); return; }
  try {
    await addDoc(collection(FB.db, 'priceReports'), {
      appId, productId, reportedPrice: price, city,
      reportedAt: serverTimestamp(), verified: false, sessionId: FB.sessionId,
    });
    showToast('🚩 Price reported! Thank you.', 'success');
    document.getElementById('reportModal').classList.add('hidden');
    ['reportApp','reportProduct','reportPrice','reportCity'].forEach(f => document.getElementById(f).value = '');
  } catch (e) { showToast('❌ Could not submit report', 'error'); }
};

// ——— Log comparison ———
window.logComparison = async function (city, items, results) {
  if (!FB.enabled || !FB.db) return;
  try {
    await addDoc(collection(FB.db, 'comparisons'), {
      city, items, results, createdAt: serverTimestamp(), sessionId: FB.sessionId,
    });
  } catch (e) { /* silent */ }
};

// ——— Escape HTML ———
function esc(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
