# 🧺 QuickBasket — Smart Quick Commerce Price Comparison

Compare grocery prices across **Blinkit, Zepto, Instamart, BB Now, Dunzo & JioMart** — including all delivery fees, platform fees, and handling charges — to find the cheapest option for your basket.

[![Deploy to GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen?logo=github)](https://YOUR_USERNAME.github.io/quickbasket)

---

## ✨ Features

- 🛒 **40+ products** across 8 categories
- ⚡ **6 quick commerce apps** compared simultaneously
- 💰 **Full fee breakdown** — delivery, handling, platform, small-order fees
- 🎯 **Smart Split Basket** — buy each item from its cheapest app
- 💾 **Save baskets** — persisted in Firebase or localStorage
- 🚩 **Report prices** — community price updates via Firestore
- 📊 **Comparison analytics** — logged to Firebase for insights
- 📱 **Fully responsive** — works on mobile & desktop
- 🔌 **Offline mode** — works without Firebase

---

## 🚀 Deploy to GitHub Pages

### Step 1 — Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/quickbasket.git
cd quickbasket
```

### Step 2 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Push to `main` — the workflow in `.github/workflows/deploy.yml` will auto-deploy

Your app will be live at:
```
https://YOUR_USERNAME.github.io/quickbasket
```

---

## 🔥 Firebase Setup (Optional but Recommended)

Firebase enables: saved baskets, price reports, and usage analytics.

### Step 1 — Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `quickbasket`
3. Enable **Google Analytics** (optional)

### Step 2 — Add Web App

1. In Firebase Console → **Project Overview** → click **`</>`** (Web)
2. Register app with nickname `quickbasket-web`
3. Copy the `firebaseConfig` object — you'll paste these values in the app

### Step 3 — Enable Firestore

1. Firebase Console → **Build** → **Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (our rules handle access)
4. Select your region (e.g., `asia-south1` for India)

### Step 4 — Deploy Firestore Rules & Indexes

Install Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore
```

Copy the rules:
```bash
cp firebase/firestore.rules firestore.rules
cp firebase/firestore.indexes.json firestore.indexes.json
firebase deploy --only firestore
```

### Step 5 — Connect in the App

When you open QuickBasket, a setup modal will appear. Paste your Firebase config values:

| Field | Where to find it |
|-------|-----------------|
| `apiKey` | Firebase Console → Project Settings → General → Your Apps |
| `authDomain` | Same location (`yourproject.firebaseapp.com`) |
| `projectId` | Same location |
| `storageBucket` | Same location (`yourproject.appspot.com`) |
| `messagingSenderId` | Same location |
| `appId` | Same location |

The config is saved in `localStorage` — you only need to enter it once per browser.

---

## 🗄️ Firestore Database Schema

```
/products/{productId}
  name, unit, emoji, cat, basePrice, lastUpdated

/appFees/{appId}
  name, color, eta, freeDeliveryAbove, priceMultiplierDefault, available

/priceReports/{autoId}
  appId, productId, reportedPrice, city, reportedAt, verified, sessionId

/savedBaskets/{autoId}
  name, city, items: [{id, qty}], savedAt, sessionId

/comparisons/{autoId}
  city, items, results, createdAt, sessionId
```

> **Note:** The app auto-seeds `/products` and `/appFees` on first Firebase connection if the collections are empty.

---

## 📁 Project Structure

```
quickbasket/
├── index.html                  # Main HTML (GitHub Pages entry point)
├── css/
│   └── styles.css              # All styles
├── js/
│   ├── data.js                 # Product catalogue & app configs
│   ├── firebase.js             # Firebase init, Firestore helpers (ES module)
│   └── app.js                  # UI logic, basket, comparison engine
├── firebase/
│   ├── firestore.rules         # Firestore security rules
│   └── firestore.indexes.json  # Composite indexes
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions auto-deploy
└── README.md
```

---

## 🛠️ Local Development

No build tools needed — it's plain HTML/CSS/JS.

```bash
# Option 1: Python
python3 -m http.server 8080

# Option 2: Node
npx serve .

# Option 3: VS Code Live Server extension
```

Then open `http://localhost:8080`

---

## 🔧 Customization

### Add a new product
Edit `js/data.js` — add to the `PRODUCTS` array:
```js
{ id:'newprod1', name:'Your Product', unit:'500g', emoji:'🥝', cat:'fruits', basePrice:80 },
```

### Add a new app
Edit `js/data.js` — add to the `APPS` array with the fee structure.

### Update fee structures
Each app in `APPS` has configurable fee functions:
```js
deliveryFee:  (subtotal) => subtotal < 199 ? 25 : 0,
handlingFee:  ()         => 5,
platformFee:  ()         => 5,
smallOrderFee:(subtotal) => subtotal < 99  ? 15 : 0,
```

---

## 📄 License

MIT — free to use, modify, and deploy.

---

## 🙏 Disclaimer

Prices shown are approximate and for comparison purposes. Actual prices may vary. Always verify the final price in the respective app before ordering.
