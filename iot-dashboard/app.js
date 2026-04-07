import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyAzRZ9NLdM-go5sP--39qZwRfJkrMy5Mqw",
  authDomain: "iot-projekat-zalijevanje.firebaseapp.com",
  projectId: "iot-projekat-zalijevanje",
  storageBucket: "iot-projekat-zalijevanje.firebasestorage.app",
  messagingSenderId: "458906723375",
  appId: "1:458906723375:web:803996f80054538b2212da",
  measurementId: "G-454TYLQ8KH",
  databaseURL: "https://iot-projekat-zalijevanje-default-rtdb.europe-west1.firebasedatabase.app"
};

const DEVICE_ID = "esp32-001";

// ================= INIT =================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = getFirestore(app);
const rtdb = getDatabase(app);

console.log("APP LOADED ✅", { DEVICE_ID });

let liveUnsub = null;

// ================= HELPERS =================
const $ = (id) => document.getElementById(id);

function setMsg(t) {
  const el = $("actionMsg");
  if (el) el.textContent = t ?? "—";
}

async function ensureLogin() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

function fmtEpochMs(epochMs) {
  if (!epochMs) return "—";
  const ms = Number(epochMs);
  if (!Number.isFinite(ms) || ms < 1000000000000) return "—";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pushUI(d) {
  const ms = Number(d?.tsEpochMs);
  const d2 = {
    ...d,
    tsText: fmtEpochMs(ms) !== "—" ? fmtEpochMs(ms) : (d?.tsText ?? "—")
  };

  const uid = auth.currentUser ? auth.currentUser.uid : null;

  if (window.renderUI) window.renderUI(d2, uid);
  else console.warn("renderUI nije definisan na window-u");

  console.log("LIVE UI ✅", { tsEpochMs: d?.tsEpochMs, tsText: d2.tsText });
}
// SOS signal (3x brzo blink na ESP32)
$("btnSOS")?.addEventListener("click", async () => {
  try {
    await ensureLogin();
    await set(ref(rtdb, `devices/${DEVICE_ID}/commands/sos`), true);
  
    await addDoc(collection(fs, "devices", DEVICE_ID, "actions"), {
      type: "SOS",
      ts: serverTimestamp(),
      byUid: auth.currentUser?.uid ?? null
    });

 
    console.log("CMD SENT ✅ sos");
  } catch (e) {
    console.error("btnSOS error ❌:", e?.code, e?.message, e);
    setMsg("Greška (SOS): " + (e?.message ?? "nepoznato"));
  }
});

//==============ZAUSTVAI
$("btnStopSOS")?.addEventListener("click", async () => {
  try {
    await ensureLogin();

    await set(ref(rtdb, `devices/${DEVICE_ID}/commands/sosStop`), true);
    await set(ref(rtdb, `devices/${DEVICE_ID}/commands/sos`), false);

    setMsg("SOS zaustavljen.");
    console.log("CMD SENT ✅ sosStop");
  } catch (e) {
    console.error("btnStopSOS error ❌:", e?.code, e?.message, e);
    setMsg("Greška (STOP SOS): " + (e?.message ?? "nepoznato"));
  }
});



// 10x blink signal
$("btnBlink10")?.addEventListener("click", async () => {
  try {
    await ensureLogin();

    await set(ref(rtdb, `devices/${DEVICE_ID}/commands/blink10`), true);
    await set(ref(rtdb, `devices/${DEVICE_ID}/commands/blink10Stop`), false);
    await set(ref(rtdb, `devices/${DEVICE_ID}/commands/sos`), false);
    await set(ref(rtdb, `devices/${DEVICE_ID}/commands/sosStop`), true);

    await addDoc(collection(fs, "devices", DEVICE_ID, "actions"), {
      type: "BLINK10",
      ts: serverTimestamp(),
      byUid: auth.currentUser?.uid ?? null
    });

    setMsg("Poslana komanda: 10x blink.");
    console.log("CMD SENT ✅ blink10");
  } catch (e) {
    console.error("btnBlink10 error ❌:", e?.code, e?.message, e);
    setMsg("Greška (BLINK10): " + (e?.message ?? "nepoznato"));
  }
});

// stop 10x blink
$("btnStopBlink10")?.addEventListener("click", async () => {
  try {
    await ensureLogin();

    await set(ref(rtdb, `devices/${DEVICE_ID}/commands/blink10Stop`), true);
    await set(ref(rtdb, `devices/${DEVICE_ID}/commands/blink10`), false);

    setMsg("10x blink zaustavljen.");
    console.log("CMD SENT ✅ blink10Stop");
  } catch (e) {
    console.error("btnStopBlink10 error ❌:", e?.code, e?.message, e);
    setMsg("Greška (STOP BLINK10): " + (e?.message ?? "nepoznato"));
  }
});


// ================= SAVE LATEST -> FIRESTORE (Spark/free) =================

let lastSavedTs = 0;
let lastSavedAt = 0;
const SAVE_MIN_MS = 10000; // snimi najviše svakih 10 sekundi

async function saveReadingToFirestore(latest) {
  try {
    
    if (!auth.currentUser) return;

    const tsEpochMs = Number(latest?.tsEpochMs || 0);
    const now = Date.now();

    // 1) ako je isti tsEpochMs kao zadnji put -> preskoči
    if (tsEpochMs && tsEpochMs === lastSavedTs) return;

    // 2) ako nema tsEpochMs (npr. NTP nije sync), snimaj max svakih 10s
    if (!tsEpochMs && (now - lastSavedAt) < SAVE_MIN_MS) return;

    const payload = {
      ...latest,
      deviceId: DEVICE_ID,
      tsEpochMs: tsEpochMs || null,
      tsText: latest?.tsText ?? null,
      // server timestamp za sortiranje u historiji
      ts: serverTimestamp()
    };

    if (tsEpochMs) {
      // docId = tsEpochMs => nema duplikata
      const docId = String(tsEpochMs);
      await setDoc(doc(fs, "devices", DEVICE_ID, "readings", docId), payload, { merge: true });
      lastSavedTs = tsEpochMs;
      console.log("Saved reading ✅", { docId });
    } else {
      // fallback auto-id
      await addDoc(collection(fs, "devices", DEVICE_ID, "readings"), payload);
      console.log("Saved reading ✅", { docId: "auto" });
    }

    lastSavedAt = now;
  } catch (e) {
    console.warn("Save reading failed ⚠️", e?.code, e?.message);
  }
}

// ================= LIVE (RTDB latest) =================
function startLive() {
  try {
    if (typeof liveUnsub === "function") {
      liveUnsub();
      liveUnsub = null;
    }

    const path = `devices/${DEVICE_ID}/state/latest`;
    const latestRef = ref(rtdb, path);

    console.log("START LIVE (RTDB) ✅", path);

    liveUnsub = onValue(
      latestRef,
      (snap) => {
        const data = snap.val();
        console.log("RTDB SNAP ✅", data);

        if (!data) {
          if (window.renderUI) window.renderUI({ tsText: "—" }, auth.currentUser ? auth.currentUser.uid : null);
          return;
        }

        pushUI(data);

        
        saveReadingToFirestore(data);
      },
      (e) => {
        console.error("RTDB LIVE error ❌:", e?.code, e?.message);
        setMsg("Greška RTDB LIVE: " + (e?.message ?? "nepoznato"));
      }
    );
  } catch (e) {
    console.error("startLive crash ❌:", e);
    setMsg("Greška: startLive se srušio");
  }
}

// ================= BUTTONS =================
$("btnLogin")?.addEventListener("click", async () => {
  try {
    await ensureLogin();
    startLive();
    setMsg("Ulogovana (anonymous).");
  } catch (e) {
    console.error("Login error ❌:", e?.code, e?.message);
    setMsg("Greška login: " + (e?.message ?? "nepoznato"));
  }
});

// Ručno zalijevanje (ignoriše dan/noć na ESP32 strani jer manualWatering pali LED bez uslova)
$("btnWaterNow")?.addEventListener("click", async () => {
  try {
    await ensureLogin();

    // 1) RTDB komanda ESP-u (one-shot flag)
    await set(ref(rtdb, `devices/${DEVICE_ID}/commands/waterNow`), true);

    // 2) Firestore log (dokaz)
    await addDoc(collection(fs, "devices", DEVICE_ID, "actions"), {
      type: "WATER_NOW",
      ts: serverTimestamp(),
      byUid: auth.currentUser?.uid ?? null
    });

    setMsg("Poslana komanda: ručno zalijevanje (LED).");
    console.log("CMD SENT ✅ waterNow");
  } catch (e) {
    console.error("btnWaterNow error ❌:", e?.code, e?.message, e);
    setMsg("Greška (waterNow): " + (e?.message ?? "nepoznato"));
  }
});

// ================= HISTORIJA (Firestore readings) =================
let chartTemp = null;
let chartSoil = null;

function getDocDateMaybe(d) {
  if (d?.tsEpochMs) {
    const ms = Number(d.tsEpochMs);
    if (Number.isFinite(ms)) return new Date(ms);
  }
  if (d?.ts && typeof d.ts.toDate === "function") return d.ts.toDate();
  if (d?.tsMs && typeof d.tsMs.toDate === "function") return d.tsMs.toDate();
  if (d?.tsMs && Number.isFinite(Number(d.tsMs))) {
    const ms = Number(d.tsMs);
    if (ms > 1000000000000) return new Date(ms);
  }
  return null;
}

function setHistoryMsg(t) {
  const el = $("historyMsg");
  if (el) el.textContent = t ?? "";
}

function showHistory(show) {
  const wrap = $("historyWrap");
  if (wrap) wrap.style.display = show ? "block" : "none";
}


let historyOpen = false;

function setHistoryExpanded(open) {
  historyOpen = !!open;

  const card = $("historyCard");
  if (card) card.classList.toggle("expanded", historyOpen);

  const btn = $("btnHistory");
  if (btn) btn.textContent = historyOpen ? "Sakrij mjerenja" : "Pregledaj sva mjerenja";

  if (!historyOpen) {
    showHistory(false);
    setHistoryMsg('Klikni “Pregledaj sva mjerenja”.');
  }
}

function upsertCharts(labels, temps, soils) {
  const ctxT = $("chartTemp");
  const ctxS = $("chartSoil");
  if (!ctxT || !ctxS || !window.Chart) return;

  if (chartTemp) chartTemp.destroy();
  chartTemp = new Chart(ctxT, {
    type: "line",
    data: { labels, datasets: [{ label: "Temp (°C)", data: temps, tension: 0.25 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
  });

  if (chartSoil) chartSoil.destroy();
  chartSoil = new Chart(ctxS, {
    type: "line",
    data: { labels, datasets: [{ label: "Zemlja (raw)", data: soils, tension: 0.25 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
  });
}

async function loadHistory(forceOpen = false) {
  try {
    
    if (historyOpen && !forceOpen) {
      setHistoryExpanded(false);
      return;
    }

    setHistoryExpanded(true);
    await ensureLogin();
    const limEl = $("historyLimit");
    const lim = limEl ? Number(limEl.value) : 20;

    setHistoryMsg("Učitavam mjerenja...");
    showHistory(false);

    const qy = query(
      collection(fs, "devices", DEVICE_ID, "readings"),
      orderBy("ts", "desc"),
      limit(lim)
    );

    const snap = await getDocs(qy);

    if (snap.empty) {
      setHistoryMsg("Nema mjerenja u Firestore (devices/{id}/readings). Sačekaj 10-20s da se napuni iz LIVE.");
      return;
    }

    const rows = [];
    snap.forEach((d) => rows.push(d.data()));
    rows.reverse();

    const tbody = $("historyTbody");
    if (tbody) {
      tbody.innerHTML = "";
      for (const r of rows) {
        const tr = document.createElement("tr");

        const dt = getDocDateMaybe(r);
        const time = dt ? dt.toLocaleString() : (r?.tsText ?? "—");

        const temp = (r?.tempC ?? "—");
        const hum  = (r?.humPct ?? "—");
        const soil = (r?.soilRaw ?? "—");
        const ldr  = (r?.ldrRaw ?? "—");
        const watering = (r?.shouldWater === true) ? "DA" : (r?.shouldWater === false ? "NE" : "—");

        tr.innerHTML = `
          <td>${time}</td>
          <td>${temp}</td>
          <td>${hum}</td>
          <td>${soil}</td>
          <td>${ldr}</td>
          <td>${watering}</td>
        `;
        tbody.appendChild(tr);
      }
    }

    const labels = rows.map((r) => {
      const dt = getDocDateMaybe(r);
      return dt ? dt.toLocaleTimeString() : "—";
    });

    const temps = rows.map((r) => (typeof r.tempC === "number" ? r.tempC : Number(r.tempC)));
    const soils = rows.map((r) => (typeof r.soilRaw === "number" ? r.soilRaw : Number(r.soilRaw)));

    upsertCharts(labels, temps, soils);

    setHistoryMsg(`Prikazano ${rows.length} mjerenja.`);
    showHistory(true);

  } catch (e) {
    console.error("History load error ❌:", e?.code, e?.message, e);
    setHistoryMsg("Greška pri učitavanju mjerenja: " + (e?.message ?? "nepoznato"));
  }
}

$("btnHistory")?.addEventListener("click", () => loadHistory(false));
$("historyLimit")?.addEventListener("change", () => loadHistory(true));
// ================= AUTH STATE =================
onAuthStateChanged(auth, (user) => {
  console.log("AUTH STATE ✅", user ? user.uid : null);
  if (user) startLive();
  else if (window.renderUI) window.renderUI({ tsText: "—" }, null);
});

// auto-login
ensureLogin().catch((e) => console.error("Auto-login error ❌:", e?.code, e?.message));
