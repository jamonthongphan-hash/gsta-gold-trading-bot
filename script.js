// DOM Elements
const elDot = document.getElementById('ws-dot');
const elStatus = document.getElementById('connection-status');
const elPrice = document.getElementById('current-price');
const elTrend = document.getElementById('market-trend');
const elSmc = document.getElementById('smc-struct');
const elSupply = document.getElementById('supply-zone-text');
const elDemand = document.getElementById('demand-zone-text');

// Signal Elements
const elSignalCard = document.getElementById('latest-signal');
const elSignalType = document.getElementById('signal-type');
const elSignalDesc = document.getElementById('signal-desc');
const elSigEntry = document.getElementById('sig-entry');
const elSigTp = document.getElementById('sig-tp');
const elSigSl = document.getElementById('sig-sl');
const elSignalOverlay = document.getElementById('signal-overlay');

// Alert Modal Elements (rebuilt — รองรับ signal details + MT5 Bridge status)
const alertModal = document.getElementById('alert-modal');
const alertSound = document.getElementById('alert-sound');

// ปุ่มรับทราบ
const _ackBtn = document.getElementById('signal-modal-ack');
if (_ackBtn) _ackBtn.addEventListener('click', () => { alertModal.style.display = 'none'; });

// ปุ่มส่งซ้ำ — push สัญญาณล่าสุดไป Bridge อีกครั้ง (กรณี user เปิด toggle ทีหลัง)
let _lastSignalForResend = null;
const _resendBtn = document.getElementById('signal-modal-resend');
if (_resendBtn) {
    _resendBtn.addEventListener('click', async () => {
        if (!_lastSignalForResend) return;
        _resendBtn.disabled = true;
        _resendBtn.textContent = '📤 กำลังส่ง...';
        await pushSignalToMT5Bot(_lastSignalForResend);
        _resendBtn.textContent = '✅ ส่งแล้ว';
        setTimeout(() => {
            _resendBtn.disabled = false;
            _resendBtn.textContent = '📤 ส่งซ้ำ → MT5';
        }, 2000);
    });
}

/**
 * แสดง modal สัญญาณเทรด — รายละเอียดครบ + สถานะ MT5 Bridge
 */
function showSignalModal(opts) {
    // opts: { type, quality, entry, sl, tp, reason, bridgeSent, bridgeEnabled }
    const isBuy = opts.type === 'BUY';
    const color = isBuy ? '#26a69a' : '#ef5350';
    const icon  = isBuy ? '🟢📈' : '🔴📉';

    document.getElementById('signal-modal-header').style.backgroundColor = color;
    document.getElementById('signal-modal-icon').textContent  = icon;
    document.getElementById('signal-modal-title').textContent = `${opts.type} SIGNAL NOW`;

    const qBadge =
        opts.quality === 'PREMIUM' ? '💎 PREMIUM (SMC + STO Strong)' :
        opts.quality === 'MAJOR'   ? '🔥 MAJOR (MBOS + ROF)' :
                                     '📊 MINOR (mBOS)';
    document.getElementById('signal-modal-quality').textContent = qBadge;

    const rr = Math.abs(opts.tp - opts.entry) / Math.abs(opts.entry - opts.sl);
    const slDist = Math.abs(opts.entry - opts.sl).toFixed(2);
    const tpDist = Math.abs(opts.tp - opts.entry).toFixed(2);
    document.getElementById('signal-modal-details').innerHTML = `
        <span style="color:#9ca3af;">Entry:</span><span style="font-weight:bold; color:#f2a900;">${opts.entry.toFixed(2)}</span>
        <span style="color:#9ca3af;">TP:</span><span style="font-weight:bold; color:#26a69a;">${opts.tp.toFixed(2)} <small style="color:#6b7280;">(+${tpDist}$)</small></span>
        <span style="color:#9ca3af;">SL:</span><span style="font-weight:bold; color:#ef5350;">${opts.sl.toFixed(2)} <small style="color:#6b7280;">(-${slDist}$)</small></span>
        <span style="color:#9ca3af;">R:R:</span><span style="color:#d1d4dc;">1:${rr.toFixed(1)}</span>
    `;
    document.getElementById('signal-modal-reason').textContent = `📌 ${opts.reason}`;

    // MT5 Bridge status
    const bridgeEl = document.getElementById('signal-modal-bridge');
    if (opts.bridgeSent) {
        bridgeEl.style.background = 'rgba(38,166,154,0.12)';
        bridgeEl.style.border     = '1px solid #26a69a';
        bridgeEl.innerHTML = `
            <div style="color:#26a69a; font-weight:bold; margin-bottom:4px;">✅ ส่งไปยัง MT5 Bot Bridge แล้ว</div>
            <div style="color:#9ca3af; font-size:0.78rem;">
                → เปิด <b>localhost:8050</b> บน Mac → ดู banner ใน "เปิดออเดอร์ด้วยตนเอง"<br>
                → กด <b>📥 Apply</b> → form เติม Vol/SL/TP → กด BUY/SELL ในฟอร์ม
            </div>`;
        _resendBtn.style.display = 'none';
    } else if (opts.bridgeEnabled === false) {
        bridgeEl.style.background = 'rgba(242,169,0,0.08)';
        bridgeEl.style.border     = '1px solid #f2a900';
        bridgeEl.innerHTML = `
            <div style="color:#f2a900; font-weight:bold; margin-bottom:4px;">⏸ MT5 Bridge ปิดอยู่</div>
            <div style="color:#9ca3af; font-size:0.78rem;">
                เปิด toggle "🤖 MT5 BOT BRIDGE" ในแท็บ "ข้อมูล" เพื่อส่งสัญญาณอัตโนมัติ<br>
                หรือกดปุ่มขวาเพื่อส่งครั้งเดียว
            </div>`;
        _resendBtn.style.display = 'block';
        _resendBtn.textContent   = '📤 ส่งครั้งเดียว → MT5';
    } else {
        bridgeEl.style.background = 'rgba(239,83,80,0.08)';
        bridgeEl.style.border     = '1px solid #ef5350';
        bridgeEl.innerHTML = `
            <div style="color:#ef5350; font-weight:bold; margin-bottom:4px;">❌ ส่งไป MT5 ไม่สำเร็จ</div>
            <div style="color:#9ca3af; font-size:0.78rem;">Firebase RTDB ไม่ตอบสนอง — กดปุ่มขวาเพื่อลองใหม่</div>`;
        _resendBtn.style.display = 'block';
        _resendBtn.textContent   = '📤 ลองใหม่ → MT5';
    }

    alertModal.style.display = 'flex';

    // Auto-dismiss หลัง 60 วินาที (กันค้างหน้าจอ)
    setTimeout(() => { if (alertModal.style.display === 'flex') alertModal.style.display = 'none'; }, 60000);
}

let candleData = [];

// =====================================================================
// Telegram Notification — ส่งผ่าน RTDB outbox → dashboard.py เป็นคน relay
// Token อยู่ฝั่ง dashboard.py (.env) เท่านั้น ไม่มีในโค้ดสาธารณะ
// ต้องเข้าสู่ระบบ (Google Sign-In) ก่อนถึงจะส่งได้ — บังคับด้วย security rules
// =====================================================================
async function sendTelegram(message) {
    if (!RTDB_ENABLED || !rtdb) return;
    try {
        await rtdb.ref('telegram_outbox').push({
            text: message,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
    } catch(e) {
        console.warn('Telegram outbox ส่งไม่ได้ (ยังไม่ได้เข้าสู่ระบบ?):', e.message || e);
    }
}
// =====================================================================

// =====================================================================
// MT5 Bot Bridge — ส่งสัญญาณไปยัง gold-trading-bot dashboard ผ่าน RTDB
// =====================================================================
const MT5_BRIDGE_KEY = 'gsta_mt5_bridge_enabled';
let mt5BridgeEnabled = localStorage.getItem(MT5_BRIDGE_KEY) === '1';

function initMT5Bridge() {
    const toggle = document.getElementById('mt5-bridge-toggle');
    const label  = document.getElementById('mt5-bridge-toggle-label');
    if (!toggle || !label) return;
    toggle.checked = mt5BridgeEnabled;
    label.textContent = mt5BridgeEnabled ? 'เปิด ✅' : 'ปิด';
    label.style.color = mt5BridgeEnabled ? '#26a69a' : '#9ca3af';
    toggle.addEventListener('change', () => {
        mt5BridgeEnabled = toggle.checked;
        localStorage.setItem(MT5_BRIDGE_KEY, mt5BridgeEnabled ? '1' : '0');
        label.textContent = mt5BridgeEnabled ? 'เปิด ✅' : 'ปิด';
        label.style.color = mt5BridgeEnabled ? '#26a69a' : '#9ca3af';
        if (mt5BridgeEnabled) {
            sendTelegram(`🤖 <b>MT5 Bot Bridge เปิดแล้ว</b>\nสัญญาณ BUY/SELL จะถูกส่งไปยัง gold-trading-bot อัตโนมัติ`);
        }
    });
}

async function pushSignalToMT5Bot(signal) {
    if (!mt5BridgeEnabled || !RTDB_ENABLED || !rtdb) return;
    try {
        await rtdb.ref(`gsta_signals_queue/${signal.id}`).set({
            ...signal,
            status: 'PENDING',
            volume: 0.01,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            source: 'GSTA-Live'
        });
        const elLast = document.getElementById('mt5-bridge-last');
        if (elLast) elLast.innerHTML = `<span style="color:#26a69a;">📤 ส่งล่าสุด: ${signal.type} @ ${signal.entry.toFixed(2)} (${new Date().toLocaleTimeString('th-TH')})</span>`;
    } catch(e) {
        console.warn('MT5 Bridge push failed:', e);
        const elLast = document.getElementById('mt5-bridge-last');
        if (elLast) elLast.innerHTML = `<span style="color:#ef5350;">❌ ส่งไม่สำเร็จ: ${e.message}</span>`;
    }
}
// =====================================================================

// =====================================================================
// Price Alert — แจ้งเตือนเมื่อราคาแตะระดับที่ตั้งไว้
// =====================================================================
let priceAlerts = [];  // [{ price, direction, label, triggered }]

function checkPriceAlerts(currentPrice) {
    priceAlerts.forEach(alert => {
        if (alert.triggered) return;
        const hit = alert.direction === 'above'
            ? currentPrice >= alert.price
            : currentPrice <= alert.price;
        if (hit) {
            alert.triggered = true;
            const dir = alert.direction === 'above' ? '📈 ราคาขึ้นถึง' : '📉 ราคาลงถึง';
            const msg = `🔔 <b>GSTA Price Alert!</b>\n━━━━━━━━━━━━━━━━━━\n${dir} <b>${alert.price.toFixed(2)}</b>\n${alert.label ? '📌 ' + alert.label + '\n' : ''}ราคาปัจจุบัน: <b>${currentPrice.toFixed(2)}</b>\n🕐 ${new Date().toLocaleTimeString('th-TH')}`;
            sendTelegram(msg);
            // แสดง browser notification ด้วย
            if (Notification.permission === 'granted') {
                new Notification(`Price Alert: ${currentPrice.toFixed(2)}`, { body: `${dir} ${alert.price.toFixed(2)}` });
            }
            renderPriceAlerts();
        }
    });
}
// =====================================================================

// =====================================================================
// MT5 Bridge URL — เปลี่ยนเป็น ngrok URL เมื่อต้องการเข้าถึงจาก Vercel
// =====================================================================
const MT5_NGROK_URL = "";  // ← วาง ngrok URL ที่นี่
// =====================================================================

// =====================================================================
// Firebase Configuration — ตั้งค่าครั้งเดียว ใช้ได้ตลอด
//
// วิธีเปิด Realtime Database (สำหรับราคา MT5):
//   Firebase Console → Build → Realtime Database → Create database
//   เลือก region ใกล้ที่สุด → Start in test mode → Enable
//   แล้วคัดลอก URL ที่ได้ (เช่น https://xxx-default-rtdb.asia-southeast1.firebasedatabase.app)
//   ใส่ใน databaseURL ด้านล่าง
// =====================================================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDJS-P0mVLacBjAWBfzkVQ6Eq4iXGQlz1w",
    authDomain: "gsta-gold-trading.firebaseapp.com",
    projectId: "gsta-gold-trading",
    storageBucket: "gsta-gold-trading.firebasestorage.app",
    messagingSenderId: "852675050711",
    appId: "1:852675050711:web:88fa072da2058e30b78492",
    measurementId: "G-STZC0R3V0M",
    databaseURL: "https://gsta-gold-trading-default-rtdb.asia-southeast1.firebasedatabase.app"
};
// =====================================================================

const FIREBASE_ENABLED = FIREBASE_CONFIG.projectId !== "your-project-id" && FIREBASE_CONFIG.apiKey !== "AIzaSyDemoKeyReplaceWithYours";
const RTDB_ENABLED = FIREBASE_ENABLED && FIREBASE_CONFIG.databaseURL !== "";
let db = null;
let rtdb = null;
const TRADES_COLLECTION = 'gsta_signals';
const TRADES_DOC = 'trade_history';

if (FIREBASE_ENABLED) {
    try {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore();
        console.log("✅ Firebase Firestore เชื่อมต่อสำเร็จ");
        if (RTDB_ENABLED) {
            rtdb = firebase.database();
            console.log("✅ Firebase RTDB พร้อม — จะรับราคา MT5 แบบ real-time");
        }
    } catch(e) {
        console.warn("⚠️ Firebase เริ่มต้นไม่ได้:", e);
    }
} else {
    console.warn("⚠️ Firebase ยังไม่ได้ตั้งค่า — ใช้ localStorage แทน");
}

// =====================================================================
// 🔐 Google Sign-In — จำเป็นสำหรับ "เขียน" ข้อมูล (สัญญาณ, alerts, Telegram)
// การ "อ่าน" (ราคา, กราฟ, สถิติ) ไม่ต้องเข้าสู่ระบบ
// Security rules ฝั่ง server อนุญาตเขียนเฉพาะบัญชีเจ้าของเท่านั้น
// =====================================================================
let currentUser = null;

function updateAuthUI() {
    const el = document.getElementById('auth-status');
    if (!el) return;
    if (currentUser) {
        el.textContent = `🔓 ${(currentUser.email || '').split('@')[0]}`;
        el.title = `เข้าสู่ระบบแล้ว: ${currentUser.email}\nคลิกเพื่อออกจากระบบ`;
        el.style.color = '#26a69a';
        el.style.borderColor = '#26a69a';
    } else {
        el.textContent = '🔐 เข้าสู่ระบบ';
        el.title = 'คลิกเพื่อเข้าสู่ระบบด้วย Google\nจำเป็นสำหรับ: ส่งสัญญาณไปบอท, บันทึกเทรด, Telegram, Price Alerts';
        el.style.color = '#ef5350';
        el.style.borderColor = '#ef5350';
    }
}

async function toggleAuth() {
    if (!FIREBASE_ENABLED || !firebase.auth) return;
    try {
        if (currentUser) {
            if (confirm(`ออกจากระบบ ${currentUser.email}?`)) await firebase.auth().signOut();
        } else {
            const provider = new firebase.auth.GoogleAuthProvider();
            await firebase.auth().signInWithPopup(provider);
        }
    } catch(e) {
        console.warn('Auth error:', e.code, e.message);
        if (e.code === 'auth/operation-not-allowed' || e.code === 'auth/configuration-not-found') {
            alert('⚠️ ยังไม่ได้เปิด Google Sign-In ใน Firebase Console\n\nไปที่: Firebase Console → Authentication → Get started → Sign-in method → Google → Enable');
        }
    }
}

if (FIREBASE_ENABLED && firebase.auth) {
    firebase.auth().onAuthStateChanged(u => {
        currentUser = u;
        updateAuthUI();
        if (u) console.log(`🔓 เข้าสู่ระบบ: ${u.email}`);
    });
    document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('auth-status');
        if (el) el.addEventListener('click', toggleAuth);
        updateAuthUI();
    });
}

// --- Trade History & Stats System ---
const TRADES_STORAGE_KEY = 'gsta_trades';
let trades = [];
let _isSavingToFirebase = false;

async function loadTrades() {
    if (FIREBASE_ENABLED && db) {
        try {
            const doc = await db.collection(TRADES_COLLECTION).doc(TRADES_DOC).get();
            if (doc.exists) {
                trades = doc.data().trades || [];
                console.log(`📊 โหลด trades จาก Firebase: ${trades.length} รายการ`);
            } else {
                // First time — migrate from localStorage if exists
                const local = JSON.parse(localStorage.getItem(TRADES_STORAGE_KEY) || '[]');
                if (local.length > 0) {
                    trades = local;
                    await saveTrades();
                    console.log(`📦 ย้ายข้อมูล ${local.length} รายการจาก localStorage ไป Firebase เรียบร้อย`);
                }
            }
            // Real-time listener: sync instantly when another device updates
            db.collection(TRADES_COLLECTION).doc(TRADES_DOC).onSnapshot((snap) => {
                if (_isSavingToFirebase) return;
                if (snap.exists) {
                    const remote = snap.data().trades || [];
                    if (JSON.stringify(remote) !== JSON.stringify(trades)) {
                        trades = remote;
                        normalizeTrades();  // backfill fields ทุกครั้งที่รับข้อมูลใหม่
                        console.log(`🔄 ซิงค์ข้อมูลจากเครื่องอื่น: ${trades.length} รายการ`);
                        updateStatsUI();
                        refreshMarkers();
                        refreshSignalCard();
                    }
                }
            });
            updateFirebaseStatus(true);
        } catch(e) {
            console.warn("Firebase load error, ใช้ localStorage:", e);
            trades = JSON.parse(localStorage.getItem(TRADES_STORAGE_KEY) || '[]');
            updateFirebaseStatus(false);
        }
    } else {
        trades = JSON.parse(localStorage.getItem(TRADES_STORAGE_KEY) || '[]');
        updateFirebaseStatus(false);
    }
    // normalize: เติม strategy/quality/rMultiple ให้ trade เก่า แล้วพยายาม persist
    //   (การ persist กลับ Firebase อาจถูกปฏิเสธถ้ายังไม่ sign in — แต่ display ถูกต้องเสมอ)
    if (normalizeTrades()) {
        console.log('🔧 อัปเดตข้อมูลเทรดเก่าให้มี strategy/quality/R-multiple');
        saveTrades();
    }

    updateStatsUI();
    refreshSignalCard();
}

// normalize trades ในหน่วยความจำ (backfill fields) — คืน true ถ้ามีการเปลี่ยนแปลง
// เรียกทุกครั้งที่ trades ถูกโหลด/ซิงค์ เพื่อให้ display ถูกต้องไม่ขึ้นกับการ persist
function normalizeTrades() {
    let changed = false;
    for (const t of trades) { if (backfillTradeFields(t)) changed = true; }
    return changed;
}

async function saveTrades() {
    localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(trades));

    if (FIREBASE_ENABLED && db) {
        _isSavingToFirebase = true;
        try {
            await db.collection(TRADES_COLLECTION).doc(TRADES_DOC).set({
                trades: trades,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch(e) {
            console.warn("Firebase save error:", e);
        } finally {
            _isSavingToFirebase = false;
        }
    }

    updateStatsUI();
}

function updatePriceSourceBadge(source) {
    const badge = document.getElementById('price-source-badge');
    if (!badge) return;
    const sources = {
        'MT5-Firebase': { txt: '🟢 MT5 Live',      color: '#26a69a', tip: 'ราคาจริงจาก MT5 ผ่าน Firebase Cloud' },
        'MT5':          { txt: '🟢 MT5 Local',     color: '#26a69a', tip: 'ราคาจริงจาก MT5 บนเครื่องเดียวกัน' },
        'metals.live':  { txt: '🟡 Spot Gold (metals.live)', color: '#f2a900', tip: 'ราคา Spot Gold realtime — ใกล้ MT5 มาก (±$0.10)' },
        'Yahoo':        { txt: '🟢 Spot Gold (Yahoo)',       color: '#26a69a', tip: 'ราคา Spot Gold (XAUUSD=X) จาก Yahoo Finance' },
        'PAXG':         { txt: '🟠 PAXG Backup',   color: '#ff9800', tip: 'PAXG Token จาก Binance — สำรองเมื่อแหล่งอื่นล่ม (อาจคลาดเคลื่อน $1-2)' },
        'TradingView':  { txt: '🟢 TradingView',   color: '#26a69a', tip: 'ราคาจาก TradingView' },
    };
    const s = sources[source] || { txt: '⏳ ' + source, color: '#787b86', tip: 'กำลังเชื่อมต่อ' };
    badge.textContent = s.txt;
    badge.style.color = s.color;
    badge.style.borderColor = s.color;
    badge.title = s.tip;
}

function updateFirebaseStatus(connected) {
    const badge = document.getElementById('firebase-status');
    if (!badge) return;
    if (!FIREBASE_ENABLED) {
        badge.textContent = '💾 Local Only';
        badge.style.color = '#787b86';
        badge.title = 'Firebase ยังไม่ได้ตั้งค่า — ข้อมูลบันทึกแค่ในเครื่องนี้';
    } else if (connected) {
        badge.textContent = '☁️ Cloud Sync';
        badge.style.color = '#26a69a';
        badge.title = 'Firebase เชื่อมต่อแล้ว — ข้อมูลซิงค์ทุกเครื่อง';
    } else {
        badge.textContent = '⚠️ Sync Error';
        badge.style.color = '#ef5350';
        badge.title = 'Firebase เชื่อมต่อไม่ได้ — ใช้ local backup';
    }
}

// อัปเดต signal card ด้วยข้อมูล trade ล่าสุด — เรียกหลัง loadTrades / onSnapshot
function refreshSignalCard() {
    if (!trades || trades.length === 0) {
        elSignalCard.className = 'signal-card waiting';
        elSignalType.textContent = 'กำลังรอจังหวะเทรด...';
        elSignalDesc.textContent = 'สแกนหาสัญญาณ SMC + STO confluence';
        elSigEntry.textContent = '-';
        elSigTp.textContent = '-';
        elSigSl.textContent = '-';
        return;
    }
    // แสดง OPEN trade ก่อน ถ้าไม่มีให้แสดง trade ล่าสุด
    const openTrade = [...trades].reverse().find(t => t.status === 'OPEN');
    const t = openTrade || trades[trades.length - 1];
    if (!t) return;

    const typeLC = (t.type || 'buy').toLowerCase();
    elSignalCard.className = `signal-card ${typeLC}`;

    const qMap = { PREMIUM: '💎 PREMIUM', MAJOR: '🔥 MAJOR', MINOR: '📊 MINOR', SCALP: '✂️ SCALP' };
    const qualityTag = qMap[t.quality] || '📊';
    const statusTag  = t.status === 'OPEN' ? ' 🔴 เปิดอยู่' : t.status === 'WIN' ? ' ✅ WIN' : t.status === 'LOSS' ? ' ❌ LOSS' : '';
    elSignalType.textContent = `${t.type} ${qualityTag}${statusTag}`;
    elSignalDesc.textContent = t.reason ? `📌 ${t.reason}` : `สัญญาณ ${t.type} — ${qualityTag}`;
    elSigEntry.textContent = t.entry != null ? parseFloat(t.entry).toFixed(2) : '-';
    elSigTp.textContent    = t.tp    != null ? parseFloat(t.tp).toFixed(2)    : '-';
    elSigSl.textContent    = t.sl    != null ? parseFloat(t.sl).toFixed(2)    : '-';
}

// คำนวณสถิติของชุด trade (ปิดแล้วเท่านั้น) → winRate, expectancy (avg R), totalR
function computeBucketStats(list) {
    const closed = list.filter(t => t.status === 'WIN' || t.status === 'LOSS');
    const wins   = closed.filter(t => t.status === 'WIN').length;
    const losses = closed.filter(t => t.status === 'LOSS').length;
    const total  = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    let totalR = 0;
    for (const t of closed) {
        const r = (t.rMultiple !== undefined) ? t.rMultiple : computeTradeResult(t).rMultiple;
        totalR += r;
    }
    const expectancy = total > 0 ? totalR / total : 0; // R เฉลี่ยต่อไม้ = ตัวชี้กำไรระยะยาว
    return { wins, losses, total, winRate, totalR, expectancy };
}

function _rColor(v) { return v > 0.01 ? '#26a69a' : v < -0.01 ? '#ef5350' : '#9ca3af'; }
function _fmtR(v)   { return (v >= 0 ? '+' : '') + v.toFixed(2) + 'R'; }

function updateStatsUI() {
    const elWinRate = document.getElementById('stat-winrate');
    const elTotal   = document.getElementById('stat-total');
    const elWin     = document.getElementById('stat-win');
    const elLoss    = document.getElementById('stat-loss');
    const elBar     = document.getElementById('winrate-bar');

    if (!elTotal) return;

    const all = computeBucketStats(trades);

    elWinRate.textContent = all.winRate + '%';
    elWinRate.style.color = all.winRate >= 70 ? '#26a69a' : all.winRate >= 50 ? '#f2a900' : '#ef5350';
    elTotal.textContent   = all.total;
    elWin.textContent     = all.wins;
    elLoss.textContent    = all.losses;
    if (elBar) elBar.style.width = all.winRate + '%';

    // ── Expectancy + Total R (ตัวชี้วัดกำไรระยะยาวที่แท้จริง หลังหัก spread) ──
    const elExp   = document.getElementById('stat-expectancy');
    const elTotR  = document.getElementById('stat-total-r');
    if (elExp) {
        elExp.textContent = _fmtR(all.expectancy);
        elExp.style.color = _rColor(all.expectancy);
    }
    if (elTotR) {
        elTotR.textContent = _fmtR(all.totalR);
        elTotR.style.color = _rColor(all.totalR);
    }

    // ── Breakdown แยกตามเครื่องยนต์ (SMC / SCALP) และคุณภาพ ──
    const elBreak = document.getElementById('stats-breakdown');
    if (elBreak) {
        const rows = [];
        const mkRow = (label, list, emoji) => {
            const s = computeBucketStats(list);
            if (s.total === 0) return;
            rows.push(`<tr>
                <td style="padding:4px 6px;color:#d1d4dc;">${emoji} ${label}</td>
                <td style="padding:4px 6px;text-align:center;color:#9ca3af;">${s.total}</td>
                <td style="padding:4px 6px;text-align:center;color:${s.winRate>=50?'#26a69a':'#ef5350'};">${s.winRate}%</td>
                <td style="padding:4px 6px;text-align:right;font-weight:700;color:${_rColor(s.expectancy)};">${_fmtR(s.expectancy)}</td>
                <td style="padding:4px 6px;text-align:right;color:${_rColor(s.totalR)};">${_fmtR(s.totalR)}</td>
            </tr>`);
        };
        mkRow('SMC', trades.filter(t => (t.strategy||'SMC') === 'SMC'), '📈');
        mkRow('Scalp', trades.filter(t => t.strategy === 'SCALP'), '✂️');
        // แยกคุณภาพเฉพาะ SMC
        mkRow('— PREMIUM', trades.filter(t => t.quality === 'PREMIUM'), '💎');
        mkRow('— MAJOR', trades.filter(t => t.quality === 'MAJOR'), '🔥');
        mkRow('— MINOR', trades.filter(t => t.quality === 'MINOR'), '📊');

        elBreak.innerHTML = rows.length ? `
            <table style="width:100%;border-collapse:collapse;font-size:0.72rem;margin-top:4px;">
                <thead><tr style="color:#6b7280;border-bottom:1px solid #2a2e39;">
                    <th style="padding:4px 6px;text-align:left;font-weight:600;">เครื่องยนต์</th>
                    <th style="padding:4px 6px;text-align:center;font-weight:600;">ไม้</th>
                    <th style="padding:4px 6px;text-align:center;font-weight:600;">ชนะ</th>
                    <th style="padding:4px 6px;text-align:right;font-weight:600;">คาดหวัง/ไม้</th>
                    <th style="padding:4px 6px;text-align:right;font-weight:600;">รวม R</th>
                </tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
            <div style="font-size:0.62rem;color:#4b5563;margin-top:5px;line-height:1.4;">
                💡 <b>คาดหวัง/ไม้ (Expectancy)</b> = กำไรเฉลี่ยต่อไม้เป็นหน่วย R (หัก spread $${SPREAD_COST} แล้ว) — บวก = ระบบทำกำไรระยะยาว
            </div>` : `<div style="font-size:0.7rem;color:#6b7280;padding:6px;">ยังไม่มีไม้ที่ปิด — รอผลการเทรด</div>`;
    }
}

// ── updateLiveMarketUI ──────────────────────────────────────────────
// อัปเดต section-info + zone panel ด้วยข้อมูลที่เข้าใจง่ายสำหรับมือใหม่
// เรียกจาก analyzeMarketStructure() ทุก bar close
function updateLiveMarketUI() {
    if (!candleData || candleData.length === 0) return;
    const price = candleData[candleData.length - 1].close;

    // ─── Market Summary Box ────────────────────────────────────────
    const elIcon   = document.getElementById('market-summary-icon');
    const elLabel  = document.getElementById('market-summary-label');
    const elSub    = document.getElementById('market-summary-sub');
    const elAction = document.getElementById('market-action-box');

    // แสดง loading state ถ้ายังมีข้อมูลไม่พอสำหรับ analysis
    if (candleData.length < 50) {
        if (elIcon)   elIcon.textContent  = '⏳';
        if (elLabel)  elLabel.textContent = `กำลังโหลดข้อมูล... (${candleData.length}/50 แท่ง)`;
        if (elSub)    elSub.textContent   = `ราคาปัจจุบัน: ${price.toFixed(2)} — รอข้อมูลพอสำหรับวิเคราะห์`;
        if (elAction) elAction.style.display = 'none';
        return;
    }

    if (elIcon && elLabel && elSub) {
        let icon, label, sub, actionHTML, borderColor;

        const isInvalid = structureQuality === 'INVALID';
        const isMajor   = structureQuality === 'MAJOR';

        if (isInvalid) {
            icon   = '⚠️';
            label  = 'โครงสร้างราคาไม่ชัดเจน';
            sub    = 'ราคาขึ้น-ลงแบบไม่มีแบบแผน — ตลาดสับสน';
            borderColor = '#6b7280';
            actionHTML = `🚫 <b>ควรทำ:</b> ห้ามเข้า order จนกว่าตลาดจะมีทิศทางชัด<br>
                💡 รอให้เห็น BOS (ทำ High/Low ใหม่) อย่างชัดเจนก่อน`;
        } else if (currentTrend === 'BULLISH' && isMajor) {
            icon   = '🟢';
            label  = 'ขาขึ้นแข็งแกร่ง — โอกาส BUY สูง';
            sub    = `Pull back ${structurePullbackPct}% → รอกราฟดีดกลับที่แนวรับ`;
            borderColor = '#26a69a';
            actionHTML = `✅ <b>ควรทำ:</b> มองหาจังหวะ <b style="color:#26a69a">BUY</b> ที่แนวรับ / Demand Zone<br>
                📐 Pullback ${structurePullbackPct}% ผ่าน EQ → โครงสร้าง MAJOR = สัญญาณแข็งแกร่ง<br>
                ⚡ รอ STO Cross ใน Oversold เพื่อยืนยัน`;
        } else if (currentTrend === 'BULLISH') {
            icon   = '↗️';
            label  = 'แนวโน้มขาขึ้น — ระวังพักตัว';
            sub    = `Pull back ${structurePullbackPct}% (ตื้น) → โอกาส BUY แต่ระวัง`;
            borderColor = '#81c784';
            actionHTML = `⚠️ <b>ควรทำ:</b> มองหา <b style="color:#26a69a">BUY</b> แต่ควรรอ STO ยืนยันก่อน<br>
                💡 Pullback ตื้น (${structurePullbackPct}%) = structure MINOR → เสี่ยงกว่า MAJOR<br>
                🎯 SL ต้องอยู่ใต้ Demand Zone เสมอ`;
        } else if (currentTrend === 'BEARISH' && isMajor) {
            icon   = '🔴';
            label  = 'ขาลงแข็งแกร่ง — โอกาส SELL สูง';
            sub    = `Pull back ${structurePullbackPct}% → รอกราฟดีดขึ้นที่แนวต้าน`;
            borderColor = '#ef5350';
            actionHTML = `✅ <b>ควรทำ:</b> มองหาจังหวะ <b style="color:#ef5350">SELL</b> ที่แนวต้าน / Supply Zone<br>
                📐 Pullback ${structurePullbackPct}% ผ่าน EQ → โครงสร้าง MAJOR = สัญญาณแข็งแกร่ง<br>
                ⚡ รอ STO Cross ใน Overbought เพื่อยืนยัน`;
        } else if (currentTrend === 'BEARISH') {
            icon   = '↘️';
            label  = 'แนวโน้มขาลง — ระวังดีดตัว';
            sub    = `Pull back ${structurePullbackPct}% (ตื้น) → โอกาส SELL แต่ระวัง`;
            borderColor = '#ef9a9a';
            actionHTML = `⚠️ <b>ควรทำ:</b> มองหา <b style="color:#ef5350">SELL</b> แต่ควรรอ STO ยืนยันก่อน<br>
                💡 Pullback ตื้น (${structurePullbackPct}%) = structure MINOR → เสี่ยงกว่า MAJOR`;
        } else {
            icon   = '⏸️';
            label  = 'ตลาดไม่มีทิศ — รอดู';
            sub    = 'ยังไม่เห็น BOS หรือ CHoCH ที่ชัดเจน';
            borderColor = '#6b7280';
            actionHTML = `⏸️ <b>ควรทำ:</b> ไม่เข้า order — รอให้ตลาดแสดงทิศทาง<br>
                💡 ดูว่าราคาจะทะลุ High หรือ Low ล่าสุดก่อน`;
        }

        elIcon.textContent  = icon;
        elLabel.textContent = label;
        elSub.textContent   = sub;

        const summary = document.getElementById('market-summary');
        if (summary) summary.style.borderColor = borderColor;

        if (elAction) {
            elAction.innerHTML = actionHTML;
            elAction.style.borderLeftColor = borderColor;
            elAction.style.display = 'block';
        }
    }

    // ─── Zone Distance Badges ──────────────────────────────────────
    const elSupplyDist  = document.getElementById('supply-dist-badge');
    const elDemandDist  = document.getElementById('demand-dist-badge');
    const elSupplyHint  = document.getElementById('supply-zone-hint');
    const elDemandHint  = document.getElementById('demand-zone-hint');
    const elPriceZone   = document.getElementById('price-in-zones');
    const elPDStatus    = document.getElementById('pd-zone-status');

    if (elPriceZone) elPriceZone.textContent = price.toFixed(2);

    if (lastSupply && elSupplyDist) {
        const dist = lastSupply.bottom - price;
        const distAbs = Math.abs(dist).toFixed(2);
        const isNear = dist < 3.0 && dist > 0;
        const isInside = dist <= 0;
        elSupplyDist.textContent = isInside ? '⚡ อยู่ในโซน!' : `+${distAbs}$`;
        elSupplyDist.style.background = isInside ? 'rgba(239,83,80,0.3)' : 'rgba(239,83,80,0.12)';
        elSupplyDist.style.color      = isInside ? '#ff6b6b' : '#ef5350';
        if (elSupplyHint) {
            if (isInside)    elSupplyHint.innerHTML = `<span style="color:#ef5350;font-weight:600;">⚡ ราคาอยู่ในแนวต้าน!</span> รอ Rejection → โอกาส SELL`;
            else if (isNear) elSupplyHint.innerHTML = `<span style="color:#ffd54f;">⚠️ ใกล้แนวต้านมาก</span> ระวัง — ห้ามเพิ่ม BUY`;
            else             elSupplyHint.innerHTML = `ราคาต้องขึ้นอีก <b>${distAbs}$</b> ถึงจะแตะแนวต้าน`;
        }
    }

    if (lastDemand && elDemandDist) {
        const dist = price - lastDemand.top;
        const distAbs = Math.abs(dist).toFixed(2);
        const isNear = dist < 3.0 && dist > 0;
        const isInside = dist <= 0;
        elDemandDist.textContent = isInside ? '⚡ อยู่ในโซน!' : `-${distAbs}$`;
        elDemandDist.style.background = isInside ? 'rgba(38,166,154,0.3)' : 'rgba(38,166,154,0.12)';
        elDemandDist.style.color      = isInside ? '#4dd0c4' : '#26a69a';
        if (elDemandHint) {
            if (isInside)    elDemandHint.innerHTML = `<span style="color:#26a69a;font-weight:600;">⚡ ราคาอยู่ในแนวรับ!</span> รอ Bounce → โอกาส BUY`;
            else if (isNear) elDemandHint.innerHTML = `<span style="color:#ffd54f;">⚠️ ใกล้แนวรับมาก</span> เตรียมพร้อม BUY`;
            else             elDemandHint.innerHTML = `ราคาต้องลงอีก <b>${distAbs}$</b> ถึงจะแตะแนวรับ`;
        }
    }

    // Premium / Discount zone status
    if (elPDStatus && equilibriumLevel) {
        const inDiscount = price < equilibriumLevel;
        const pdPct = Math.abs(((price - equilibriumLevel) / (equilibriumLevel)) * 100).toFixed(1);
        elPDStatus.style.display = 'block';
        elPDStatus.style.background = inDiscount ? 'rgba(38,166,154,0.08)' : 'rgba(239,83,80,0.08)';
        elPDStatus.style.border = `1px solid ${inDiscount ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)'}`;
        elPDStatus.innerHTML = inDiscount
            ? `<span style="color:#26a69a;">📉 Discount Zone</span> <span style="color:#6b7280;font-size:0.7rem;">(ใต้ EQ ${pdPct}%)</span><br><span style="font-size:0.72rem;color:#9ca3af;">ราคาถูก = เขต BUY ตาม Smart Money</span>`
            : `<span style="color:#ef5350;">📈 Premium Zone</span> <span style="color:#6b7280;font-size:0.7rem;">(เหนือ EQ ${pdPct}%)</span><br><span style="font-size:0.72rem;color:#9ca3af;">ราคาแพง = เขต SELL ตาม Smart Money</span>`;
    }
}

// ── updateOpenTradePnL ──────────────────────────────────────────────
// อัปเดต P&L real-time ของ open trade — เรียกจาก processLiveTick ทุก tick
function updateOpenTradePnL(price) {
    const elBox   = document.getElementById('open-trade-pnl');
    const elVal   = document.getElementById('open-pnl-value');
    const elDist  = document.getElementById('open-pnl-dist');
    if (!elBox || !elVal) return;

    const openTrade = [...trades].reverse().find(t => t.status === 'OPEN');
    if (!openTrade) {
        elBox.style.display = 'none';
        return;
    }

    const pnl = openTrade.type === 'BUY'
        ? price - openTrade.entry
        : openTrade.entry - price;
    const isProfit = pnl >= 0;
    const color = isProfit ? '#26a69a' : '#ef5350';
    const sign  = isProfit ? '+' : '';

    elBox.style.display = 'block';
    elBox.style.borderColor = color + '40';
    elVal.textContent = `${sign}${pnl.toFixed(2)} $`;
    elVal.style.color = color;

    // บอกระยะห่างจาก TP / SL
    const distToTP = openTrade.type === 'BUY' ? openTrade.tp - price : price - openTrade.tp;
    const distToSL = openTrade.type === 'BUY' ? price - openTrade.sl : openTrade.sl - price;
    if (elDist) {
        elDist.innerHTML = `🎯 ถึง TP อีก <b style="color:#26a69a">${Math.max(0,distToTP).toFixed(2)}$</b>  &nbsp; 🛑 ถึง SL อีก <b style="color:#ef5350">${Math.max(0,distToSL).toFixed(2)}$</b>`;
    }
}

// ─── ต้นทุนต่อไม้ (spread + commission) โดยประมาณสำหรับ XAUUSD ───────────────
// spread ปกติ ~$0.20-0.40, ช่วงข่าว $1+ — ใช้ $0.35 เป็นค่ากลางที่สมจริง
// เป็นต้นทุน "ไป-กลับ" (เข้า+ออก) หักจาก P&L ทุกไม้ที่ปิด → expectancy ที่แท้จริง
const SPREAD_COST = 0.35;

/**
 * คำนวณผลลัพธ์ trade ที่ปิดแล้ว (หัก spread) → { pnl, rMultiple }
 *   pnl        = กำไร/ขาดทุนสุทธิเป็นดอลลาร์ (หัก spread แล้ว) ต่อ 1 หน่วยราคา
 *   rMultiple  = pnl / ความเสี่ยงเริ่มต้น (|entry - sl|) — ตัวชี้วัดสำคัญที่สุด
 * WIN  → +|tp-entry| - spread   |   LOSS → -|entry-sl| - spread
 */
function computeTradeResult(t) {
    if (t.status !== 'WIN' && t.status !== 'LOSS') return { pnl: 0, rMultiple: 0 };
    const risk = Math.abs(t.entry - t.sl);
    if (!(risk > 0)) return { pnl: 0, rMultiple: 0 };
    const gross = t.status === 'WIN' ? Math.abs(t.tp - t.entry) : -Math.abs(t.entry - t.sl);
    const pnl = gross - SPREAD_COST;       // หัก spread ทุกไม้
    return { pnl, rMultiple: pnl / risk };
}

/**
 * เดา strategy/quality สำหรับ trade เก่าที่ยังไม่มี field (backward-compat)
 */
function backfillTradeFields(t) {
    let changed = false;
    if (!t.strategy) {
        t.strategy = (t.quality === 'SCALP' || /SCALP/i.test(t.reason || '')) ? 'SCALP' : 'SMC';
        changed = true;
    }
    if (!t.quality) {
        const r = t.reason || '';
        if (/PREMIUM|💎/.test(r)) t.quality = 'PREMIUM';
        else if (/🔥|MBOS \+ ROF/.test(r)) t.quality = 'MAJOR';
        else t.quality = t.strategy === 'SCALP' ? 'SCALP' : 'MINOR';
        changed = true;
    }
    // คำนวณ R-multiple ย้อนหลังสำหรับไม้ที่ปิดแล้วแต่ยังไม่มีค่า
    if ((t.status === 'WIN' || t.status === 'LOSS') && t.rMultiple === undefined) {
        const res = computeTradeResult(t);
        t.pnl = res.pnl;
        t.rMultiple = res.rMultiple;
        changed = true;
    }
    return changed;
}

/**
 * ประเมิน trade ที่ OPEN อยู่ — ถ้ามี high/low ถึง SL หรือ TP → mark LOSS/WIN
 *
 * @param {number} high       high ของแท่ง
 * @param {number} low        low ของแท่ง
 * @param {number} [barTime]  เวลาของแท่ง (Unix sec) — ถ้าระบุจะข้าม trade ที่เปิด AFTER แท่งนี้
 *                            (ป้องกัน mark LOSS จากแท่งที่เกิดก่อน trade entry)
 */
function evaluateTrades(high, low, barTime) {
    let changed = false;
    for (let t of trades) {
        if (t.status !== 'OPEN') continue;
        // 🛡️ Time guard: ข้ามถ้าแท่งเกิดก่อนหรือพร้อม trade entry
        //    (trade.time = closedCandle.time → ราคา high/low ของแท่งนั้นเกิดก่อน entry)
        if (barTime !== undefined && barTime <= t.time) continue;

        let closed = false;
        if (t.type === 'BUY') {
            if (low <= t.sl)       { t.status = 'LOSS'; closed = true; }
            else if (high >= t.tp) { t.status = 'WIN';  closed = true; }
        } else if (t.type === 'SELL') {
            if (high >= t.sl)     { t.status = 'LOSS'; closed = true; }
            else if (low <= t.tp) { t.status = 'WIN';  closed = true; }
        }
        if (closed) {
            const res = computeTradeResult(t);
            t.pnl = res.pnl;
            t.rMultiple = res.rMultiple;
            t.closedAt = Math.floor(Date.now() / 1000);
            changed = true;
        }
    }
    if (changed) {
        saveTrades();
        refreshMarkers();
        refreshSignalCard();
    }
}

function evaluateAllHistory() {
    // Re-evaluate open trades using historical data — ส่ง barTime เพื่อ time filter
    for (let c of candleData) {
        evaluateTrades(c.high, c.low, c.time);
    }
}

function refreshMarkers() {
    if (!candleSeries) return;
    chartMarkers = [];
    for (let t of trades) {
        let color, text;
        if (t.status === 'WIN') { color = '#4caf50'; text = t.type + ' (WIN)'; }
        else if (t.status === 'LOSS') { color = '#f44336'; text = t.type + ' (LOSS)'; }
        else { color = t.type === 'BUY' ? '#ffeb3b' : '#ff9800'; text = t.type + ' (OPEN)'; }

        chartMarkers.push({
            time: t.time,
            position: t.type === 'BUY' ? 'belowBar' : 'aboveBar',
            color: color,
            shape: t.type === 'BUY' ? 'arrowUp' : 'arrowDown',
            text: text,
            size: 2
        });
    }
    
    const uniqueMarkers = [];
    const seen = new Set();
    for (let m of chartMarkers) {
        if (!seen.has(m.time + m.text)) {
            uniqueMarkers.push(m);
            seen.add(m.time + m.text);
        }
    }
    uniqueMarkers.sort((a,b) => a.time - b.time);
    candleSeries.setMarkers(uniqueMarkers);
}
// ------------------------------------

// 1. Initialize TradingView Lightweight Charts
let chart = null;
let candleSeries = null;
let upperBandSeries = null;
let middleBandSeries = null;
let lowerBandSeries = null;

let demandLine = null;
let supplyLine = null;
let chartMarkers = [];

// Phase 3 — EMA Lines on chart
let ema5Series   = null;
let ema21Series  = null;
let ema50Series  = null;
let ema100Series = null;
let lastEmaValues = { ema5: null, ema21: null, ema50: null, ema100: null };

function initTVWidget() {
    if (!window.LightweightCharts) return;
    
    const container = document.getElementById('tv_chart_container');
    container.innerHTML = ''; // Clear existing contents
    
    chart = LightweightCharts.createChart(container, {
        autoSize: true,
        width: container.clientWidth || 800,
        height: container.clientHeight || 600,
        layout: {
            background: { type: 'solid', color: '#0b0e14' },
            textColor: '#9ca3af',
            fontSize: 12,
        },
        grid: {
            vertLines: { color: 'rgba(31,41,55,0.4)' },
            horzLines: { color: 'rgba(31,41,55,0.4)' },
        },
        rightPriceScale: {
            borderColor: '#1f2937',
            scaleMargins: { top: 0.15, bottom: 0.15 },
            autoScale: true,
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: '#1f2937',
            rightOffset: 8,
            barSpacing: 8,
            tickMarkFormatter: (time, tickMarkType, locale) => {
                const date = new Date(time * 1000);
                if (tickMarkType >= 3) {
                    return date.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
                }
                return date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short' });
            }
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: { color: 'rgba(242,169,0,0.4)', width: 1, style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: '#f2a900' },
            horzLine: { color: 'rgba(242,169,0,0.4)', width: 1, style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: '#f2a900' },
        },
        localization: {
            timeFormatter: (timestamp) => {
                const date = new Date(timestamp * 1000);
                return date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            }
        },
    });

    // Fallback for resizing
    new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== container) { return; }
        const newRect = entries[0].contentRect;
        chart.applyOptions({ height: newRect.height, width: newRect.width });
    }).observe(container);

    candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        priceLineVisible: true,
        priceLineColor: '#f2a900',
        priceLineWidth: 1,
        priceLineStyle: LightweightCharts.LineStyle.Dotted,
        lastValueVisible: true,
    });

    elStatus.textContent = "เชื่อมต่อกราฟ Lightweight Charts (XAUUSD) สำเร็จ!";
    elDot.classList.add('connected');
}

// หมายเหตุ: calculateBollingerBands (เวอร์ชันเดียวที่ใช้จริง) อยู่ในส่วน Scalping Engine
//   คืนค่า BB ของแท่งล่าสุด { upper, middle, lower, std } — ใช้ทั้ง scalp และ reversal monitor

// =====================================================================
// Stochastic Oscillator (STO)
//
// 💡 จุดประสงค์: จับจังหวะระยะสั้นแบบ "เข้าเร็ว-ออกเร็ว" — เป็น Indicator ที่
//    ตอบสนองเร็วที่สุดในชุดนี้ (เร็วกว่า EMA, MACD) เหมาะสำหรับการ scalp,
//    timing entry ของ SMC, หรือ exit position ที่กำลังเปิดอยู่
//
// 📐 สูตร (Slow Stochastic 3 ขั้น):
//    1) Raw %K = ((Close - LowestLow_N) / (HighestHigh_N - LowestLow_N)) × 100
//    2) %K (smoothed) = SMA(Raw %K, kSmoothing)  ← ลด noise
//    3) %D = SMA(%K smoothed, dPeriod)
//
// ⚙️ ปรับ Period ได้ที่ STO_CONFIG ด้านล่าง:
//    - Default (14, 3, 3) = มาตรฐาน balance ความเร็ว/ความแม่น
//    - (9, 3, 3) = ไวขึ้น เหมาะ scalp 1m-5m
//    - (21, 5, 5) = ช้าลง false signal ลด เหมาะ swing 1h-4h
// =====================================================================
const STO_CONFIG = {
    kPeriod:    14,   // ช่วงข้อมูล lookback ของ %K
    kSmoothing: 3,    // smoothing ของ %K (ลด whipsaw)
    dPeriod:    3,    // SMA ของ %K → ได้ %D
    overbought: 80,
    oversold:   20,
};

let lastStoData = [];                  // เก็บค่า %K, %D ทุกแท่ง
let lastStoCrossBar = null;            // เวลาแท่งที่เกิด cross ล่าสุด (กัน notify ซ้ำ)

/**
 * คำนวณ Slow Stochastic %K และ %D
 * @param {Array} data    candleData (high/low/close)
 * @param {Object} config STO_CONFIG
 * @returns {Array} [{time, k, d}] — null ถ้ายังไม่มีข้อมูลพอ
 */
function calculateStochastic(data, config = STO_CONFIG) {
    const { kPeriod, kSmoothing, dPeriod } = config;
    const result = [];
    if (!data || data.length < kPeriod + kSmoothing + dPeriod) return result;

    // ขั้น 1: Raw %K — ตำแหน่งราคาใน range สูงสุด/ต่ำสุดของ kPeriod แท่งย้อนหลัง
    const rawK = new Array(data.length).fill(null);
    for (let i = kPeriod - 1; i < data.length; i++) {
        let hh = -Infinity, ll = Infinity;
        for (let j = i - kPeriod + 1; j <= i; j++) {
            if (data[j].high > hh) hh = data[j].high;
            if (data[j].low  < ll) ll = data[j].low;
        }
        const range = hh - ll;
        rawK[i] = range === 0 ? 50 : ((data[i].close - ll) / range) * 100;
    }

    // ขั้น 2: Smooth %K ด้วย SMA(kSmoothing)
    const slowK = new Array(data.length).fill(null);
    for (let i = kPeriod - 1 + kSmoothing - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < kSmoothing; j++) sum += rawK[i - j];
        slowK[i] = sum / kSmoothing;
    }

    // ขั้น 3: %D = SMA(slowK, dPeriod)
    const lineD = new Array(data.length).fill(null);
    for (let i = kPeriod - 1 + kSmoothing - 1 + dPeriod - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < dPeriod; j++) sum += slowK[i - j];
        lineD[i] = sum / dPeriod;
    }

    for (let i = 0; i < data.length; i++) {
        result.push({ time: data[i].time, k: slowK[i], d: lineD[i] });
    }
    return result;
}

/**
 * ตรวจ Stochastic Crossover ของ 2 แท่งล่าสุด (ใช้แท่งที่ปิดแล้ว 2 แท่ง — No Repaint)
 *
 * 🎯 Logic:
 *   - Bullish Cross: %K ตัดขึ้นเหนือ %D → BUY signal
 *     ✨ Strong: เกิดในโซน Oversold (< 20) → ความแม่นยำสูงมาก
 *   - Bearish Cross: %K ตัดลงใต้ %D → SELL signal
 *     ✨ Strong: เกิดในโซน Overbought (> 80) → ความแม่นยำสูงมาก
 *
 * @returns {Object|null} { type, strength, k, d, zone, label } หรือ null
 */
function detectStochasticCross(stoData) {
    if (!stoData || stoData.length < 3) return null;
    // ใช้ 2 แท่งที่ปิดแล้ว (last-1, last-2) — ไม่ใช้แท่งปัจจุบันที่ยัง forming
    const last = stoData[stoData.length - 2];
    const prev = stoData[stoData.length - 3];
    if (last.k === null || last.d === null || prev.k === null || prev.d === null) return null;

    const { overbought, oversold } = STO_CONFIG;

    // Bullish Cross — %K ตัดขึ้นเหนือ %D
    if (prev.k <= prev.d && last.k > last.d) {
        const inOversold = last.k < oversold || prev.k < oversold || prev.d < oversold;
        return {
            type:     'BULLISH',
            strength: inOversold ? 'STRONG' : 'NORMAL',
            k:        last.k,
            d:        last.d,
            zone:     inOversold ? 'OVERSOLD' : 'NEUTRAL',
            label:    inOversold
                      ? '🟢 STO Bullish Cross + Oversold ✨'
                      : '🟢 STO Bullish Cross',
            time:     last.time,
        };
    }

    // Bearish Cross — %K ตัดลงใต้ %D
    if (prev.k >= prev.d && last.k < last.d) {
        const inOverbought = last.k > overbought || prev.k > overbought || prev.d > overbought;
        return {
            type:     'BEARISH',
            strength: inOverbought ? 'STRONG' : 'NORMAL',
            k:        last.k,
            d:        last.d,
            zone:     inOverbought ? 'OVERBOUGHT' : 'NEUTRAL',
            label:    inOverbought
                      ? '🔴 STO Bearish Cross + Overbought ✨'
                      : '🔴 STO Bearish Cross',
            time:     last.time,
        };
    }

    return null;
}

/**
 * อัปเดต UI Stochastic panel + ยิง Telegram alert ถ้ามี cross ใหม่
 * เรียกใช้ทุกครั้งที่แท่งใหม่ปิด (จาก analyzeMarketStructure)
 */
function updateStochasticUI() {
    lastStoData = calculateStochastic(candleData);
    if (lastStoData.length === 0) return;

    const last = lastStoData[lastStoData.length - 1];
    const elK    = document.getElementById('sto-k-val');
    const elD    = document.getElementById('sto-d-val');
    const elZone = document.getElementById('sto-zone');
    const elCross = document.getElementById('sto-cross-status');
    const elBar  = document.getElementById('sto-bar-fill');
    if (!elK || last.k === null) return;

    const k = last.k, d = last.d;
    elK.textContent = k.toFixed(1);
    elD.textContent = d.toFixed(1);

    // Zone label
    if (k > STO_CONFIG.overbought) {
        elZone.textContent = `Overbought (>${STO_CONFIG.overbought}) 🔴`;
        elZone.style.color = '#ef5350';
    } else if (k < STO_CONFIG.oversold) {
        elZone.textContent = `Oversold (<${STO_CONFIG.oversold}) 🟢`;
        elZone.style.color = '#26a69a';
    } else {
        elZone.textContent = `Neutral (${STO_CONFIG.oversold}-${STO_CONFIG.overbought})`;
        elZone.style.color = '#9ca3af';
    }

    // Bar fill (visualize %K position 0-100)
    if (elBar) {
        elBar.style.width = `${Math.max(0, Math.min(100, k))}%`;
        elBar.style.backgroundColor = k > 80 ? '#ef5350' : k < 20 ? '#26a69a' : '#f2a900';
    }

    // ตรวจ cross ที่เพิ่งเกิด (เทียบ 2 แท่งล่าสุดที่ปิดแล้ว)
    const cross = detectStochasticCross(lastStoData);
    if (cross && cross.time !== lastStoCrossBar) {
        lastStoCrossBar = cross.time;
        const color = cross.type === 'BULLISH' ? '#26a69a' : '#ef5350';
        const subtitle = cross.strength === 'STRONG'
            ? `✨ <b>HIGH PROBABILITY</b> — ${cross.zone === 'OVERSOLD' ? 'จับ bottom' : 'จับ top'} ระยะสั้น`
            : 'จุดกลับตัวระยะสั้น — ระวัง false signal นอก OB/OS zone';

        elCross.innerHTML = `<div style="color:${color};font-weight:bold;font-size:0.92rem;">${cross.label}</div><div style="font-size:0.78rem;color:#9ca3af;margin-top:3px;line-height:1.4;">${subtitle}<br>%K=${cross.k.toFixed(1)} / %D=${cross.d.toFixed(1)}</div>`;

        // 🔔 Telegram alert — แจ้งเฉพาะ STRONG cross (ความแม่นยำสูง)
        if (cross.strength === 'STRONG') {
            const emoji = cross.type === 'BULLISH' ? '🟢' : '🔴';
            const lastPrice = candleData[candleData.length - 1].close;
            sendTelegram(`${emoji} <b>STO ${cross.type === 'BULLISH' ? 'Bullish' : 'Bearish'} Cross ✨ STRONG</b>
━━━━━━━━━━━━━━━━━━
%K: <b>${cross.k.toFixed(1)}</b> ตัด${cross.type === 'BULLISH' ? 'ขึ้น' : 'ลง'}%D: <b>${cross.d.toFixed(1)}</b>
Zone: <b>${cross.zone}</b> (ความแม่นยำสูง)
ราคา: <b>${lastPrice.toFixed(2)}</b>
━━━━━━━━━━━━━━━━━━
📌 จับ${cross.zone === 'OVERSOLD' ? 'bottom' : 'top'} ระยะสั้น — เหมาะ scalp/exit
🕐 ${new Date().toLocaleTimeString('th-TH')}`);
        }
    } else if (!cross) {
        // ไม่มี cross — แสดงสถานะปัจจุบัน (%K vs %D)
        const trend = k > d ? '↗️ %K เหนือ %D (โน้มขึ้น)' : '↘️ %K ใต้ %D (โน้มลง)';
        const trendColor = k > d ? '#26a69a' : '#ef5350';
        elCross.innerHTML = `<div style="color:${trendColor};font-size:0.85rem;">${trend}</div>`;
    }

    // ===== 🎯 Action Recommendation — อ่านสถานะปัจจุบันแล้วสรุปคำแนะนำ =====
    const elActionCard = document.getElementById('sto-action-card');
    const elActionText = document.getElementById('sto-action-text');
    if (elActionCard && elActionText) {
        const { overbought, oversold } = STO_CONFIG;
        const kAboveD = k > d;
        const inOB    = k > overbought;
        const inOS    = k < oversold;
        let action, color, bg;

        if (cross && cross.strength === 'STRONG') {
            // เพิ่งเกิด strong cross — สัญญาณชัด
            if (cross.type === 'BULLISH') {
                color = '#26a69a'; bg = 'rgba(38,166,154,0.12)';
                action = `<b style="color:${color};">✅ BUY NOW — STRONG ✨</b><br>
                    • Cross เกิดใน Oversold → ความน่าจะเป็น win สูง<br>
                    • Entry: ราคาปัจจุบัน ${candleData[candleData.length-1].close.toFixed(2)}<br>
                    • SL: ใต้แนวรับ ${lastDemand ? lastDemand.bottom.toFixed(2) : '-'} -0.5$<br>
                    • TP: 1:2 RR หรือรอ %K แตะ 80`;
            } else {
                color = '#ef5350'; bg = 'rgba(239,83,80,0.12)';
                action = `<b style="color:${color};">✅ SELL NOW — STRONG ✨</b><br>
                    • Cross เกิดใน Overbought → ความน่าจะเป็น win สูง<br>
                    • Entry: ราคาปัจจุบัน ${candleData[candleData.length-1].close.toFixed(2)}<br>
                    • SL: เหนือแนวต้าน ${lastSupply ? lastSupply.top.toFixed(2) : '-'} +0.5$<br>
                    • TP: 1:2 RR หรือรอ %K แตะ 20`;
            }
        } else if (cross && cross.strength === 'NORMAL') {
            // Cross นอกโซน → สัญญาณอ่อน
            color = '#f2a900'; bg = 'rgba(242,169,0,0.1)';
            const dir = cross.type === 'BULLISH' ? 'BUY' : 'SELL';
            action = `<b style="color:${color};">⚠️ ${dir} (Normal — รอ confluence)</b><br>
                • Cross นอก OB/OS → false signal สูง<br>
                • รอเช็ค: แนวรับ/แนวต้าน, EMA trend, SMC structure<br>
                • ถ้าทุกอย่างสอดคล้อง → เข้าได้ ลด lot ลง 50%`;
        } else if (inOS && kAboveD) {
            // อยู่ใน OS, %K โน้มขึ้น — รอ cross ยืนยัน
            color = '#26a69a'; bg = 'rgba(38,166,154,0.08)';
            action = `<b style="color:${color};">⏳ จับตา BUY — Oversold + %K เริ่มหันขึ้น</b><br>
                • รอ %K ตัดขึ้นเหนือ %D เพื่อ confirm<br>
                • เตรียม Entry, SL ใต้ ${lastDemand ? lastDemand.bottom.toFixed(2) : '-'}`;
        } else if (inOB && !kAboveD) {
            // อยู่ใน OB, %K โน้มลง — รอ cross ยืนยัน
            color = '#ef5350'; bg = 'rgba(239,83,80,0.08)';
            action = `<b style="color:${color};">⏳ จับตา SELL — Overbought + %K เริ่มหันลง</b><br>
                • รอ %K ตัดลงใต้ %D เพื่อ confirm<br>
                • เตรียม Entry, SL เหนือ ${lastSupply ? lastSupply.top.toFixed(2) : '-'}`;
        } else if (inOS && !kAboveD) {
            color = '#26a69a'; bg = 'rgba(38,166,154,0.06)';
            action = `<b style="color:#26a69a;">⏸ HOLD — Oversold แต่ %K ยังหันลง</b><br>
                • อย่ารีบ BUY — รอ %K หันขึ้นก่อน<br>
                • Trend แรงอาจกด OS ต่อได้อีก`;
        } else if (inOB && kAboveD) {
            color = '#ef5350'; bg = 'rgba(239,83,80,0.06)';
            action = `<b style="color:#ef5350;">⏸ HOLD — Overbought แต่ %K ยังหันขึ้น</b><br>
                • อย่ารีบ SELL — รอ %K หันลงก่อน<br>
                • Trend แรงอาจดัน OB ต่อได้อีก`;
        } else {
            // Neutral
            color = '#9ca3af'; bg = 'rgba(120,123,134,0.08)';
            const bias = kAboveD ? 'BULLISH' : 'BEARISH';
            const biasColor = kAboveD ? '#26a69a' : '#ef5350';
            action = `<b style="color:${color};">⏸ WAIT — ${bias === 'BULLISH' ? 'โน้มขึ้น' : 'โน้มลง'} ใน Neutral zone</b><br>
                • Bias: <span style="color:${biasColor};">${bias}</span><br>
                • รอราคาเข้าโซน OB (>${overbought}) หรือ OS (&lt;${oversold}) เพื่อหา setup ที่ดีกว่า`;
        }

        elActionCard.style.borderLeftColor = color;
        elActionCard.style.background      = bg;
        elActionText.innerHTML             = action;
    }
}
// =====================================================================

// =====================================================================
// Phase 3 — EMA / Divergence / Gap Detection
// =====================================================================

// EMA for chart series: returns [{time, value}]
function calculateEMAForChart(data, period) {
    const result = [];
    const k = 2 / (period + 1);
    let prev = null;
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) continue;
        if (prev === null) {
            let sum = 0;
            for (let j = 0; j < period; j++) sum += data[i - j].close;
            prev = sum / period;
        } else {
            prev = data[i].close * k + prev * (1 - k);
        }
        result.push({ time: data[i].time, value: prev });
    }
    return result;
}

// EMA on plain number array (null-padded during warmup) — used for MACD
function _emaArr(arr, period) {
    const result = new Array(arr.length).fill(null);
    const k = 2 / (period + 1);
    let prev = null;
    for (let i = 0; i < arr.length; i++) {
        if (i < period - 1) continue;
        if (prev === null) {
            let sum = 0;
            for (let j = 0; j < period; j++) sum += arr[i - j];
            prev = sum / period;
        } else {
            prev = arr[i] * k + prev * (1 - k);
        }
        result[i] = prev;
    }
    return result;
}

// Divergence: Bullish / Bearish / Hidden Bull / Hidden Bear (uses MACD 12,26)
function detectDivergence(data) {
    if (!data || data.length < 60) return null;

    const closes = data.map(d => d.close);
    const ema12  = _emaArr(closes, 12);
    const ema26  = _emaArr(closes, 26);
    const macd   = ema12.map((v, i) => (v !== null && ema26[i] !== null) ? v - ema26[i] : null);

    // Pivot detection in last 60 candles (swing of 3 bars each side)
    const start = Math.max(3, data.length - 60);
    const pivotHighIdx = [];
    const pivotLowIdx  = [];
    for (let i = start; i < data.length - 3; i++) {
        if (macd[i] === null) continue;
        const isH = data[i].high > data[i-1].high && data[i].high > data[i-2].high &&
                    data[i].high > data[i+1].high && data[i].high > data[i+2].high;
        const isL = data[i].low  < data[i-1].low  && data[i].low  < data[i-2].low  &&
                    data[i].low  < data[i+1].low  && data[i].low  < data[i+2].low;
        if (isH) pivotHighIdx.push(i);
        if (isL) pivotLowIdx.push(i);
    }

    if (pivotHighIdx.length >= 2) {
        const i1 = pivotHighIdx[pivotHighIdx.length - 2];
        const i2 = pivotHighIdx[pivotHighIdx.length - 1];
        if (macd[i1] !== null && macd[i2] !== null) {
            const priceHH = data[i2].high > data[i1].high;
            const macdHH  = macd[i2] > macd[i1];
            if ( priceHH && !macdHH) return { type:'BEARISH',     label:'Bearish Divergence ⚡',      desc:'ราคา HH / MACD LH — ระวังกลับตัวขาลง',   color:'#ef5350' };
            if (!priceHH &&  macdHH) return { type:'HIDDEN_BEAR', label:'Hidden Bear Divergence 📉', desc:'ราคา LH / MACD HH — trend ขาลงยังต่อ',    color:'#ef5350' };
        }
    }

    if (pivotLowIdx.length >= 2) {
        const i1 = pivotLowIdx[pivotLowIdx.length - 2];
        const i2 = pivotLowIdx[pivotLowIdx.length - 1];
        if (macd[i1] !== null && macd[i2] !== null) {
            const priceLL = data[i2].low < data[i1].low;
            const macdLL  = macd[i2] < macd[i1];
            if ( priceLL && !macdLL) return { type:'BULLISH',     label:'Bullish Divergence ⚡',      desc:'ราคา LL / MACD HL — ระวังกลับตัวขาขึ้น',  color:'#26a69a' };
            if (!priceLL &&  macdLL) return { type:'HIDDEN_BULL', label:'Hidden Bull Divergence 📈', desc:'ราคา HL / MACD LL — trend ขาขึ้นยังต่อ',   color:'#26a69a' };
        }
    }

    return null;
}

// Gap Detection: Exhaustion / Breakaway / Runaway
function detectGap(data) {
    if (!data || data.length < 20) return null;
    for (let i = data.length - 3; i >= Math.max(1, data.length - 8); i--) {
        const prev    = data[i - 1];
        const curr    = data[i];
        const rawGap  = curr.open - prev.close;
        const gapSize = Math.abs(rawGap);
        if (gapSize < 0.5) continue;

        const direction = rawGap > 0 ? 'UP' : 'DOWN';

        // Skip if gap already filled by later price action
        const filled = data.slice(i + 1).some(c =>
            direction === 'UP' ? c.low <= prev.close : c.high >= prev.close
        );
        if (filled) continue;

        // Count same-direction candles in 12 bars before the gap
        let trendCount = 0;
        const lookback = Math.min(12, i - 1);
        for (let j = i - lookback; j < i; j++) {
            if (direction === 'UP'   && data[j].close > data[j].open) trendCount++;
            if (direction === 'DOWN' && data[j].close < data[j].open) trendCount++;
        }

        let gapType;
        if (gapSize >= 2.0 && trendCount >= 7) gapType = 'EXHAUSTION'; // Large gap after long run → wave 5 ending
        else if (trendCount <= 3)               gapType = 'BREAKAWAY';  // Gap from consolidation → wave 3 start
        else                                    gapType = 'RUNAWAY';    // Mid-trend gap → wave 3 continuation

        return { type: gapType, direction, size: gapSize.toFixed(2) };
    }
    return null;
}

// Update sidebar Phase 3 panel
function updatePhase3UI() {
    const { ema5: v5, ema21: v21, ema50: v50, ema100: v100 } = lastEmaValues;
    const price = candleData.length > 0 ? candleData[candleData.length - 1].close : null;

    // ── EMA Alignment ──────────────────────────────────────────────
    const elEmaAlign = document.getElementById('ema-align-badge');
    const elEmaStack = document.getElementById('ema-stack-display');
    const elEmaHint  = document.getElementById('ema-align-hint');
    if (elEmaAlign && price && v5 && v21 && v50 && v100) {
        // กำหนดสถานะ
        const perfectBull = price > v5 && v5 > v21 && v21 > v50 && v50 > v100;
        const perfectBear = price < v5 && v5 < v21 && v21 < v50 && v50 < v100;
        const biasBull    = !perfectBull && price > v50 && price > v100;
        const biasBear    = !perfectBear && price < v50 && price < v100;

        let badgeTxt, badgeCls, hintTxt, hintColor;
        if (perfectBull) {
            badgeTxt = '🟢 ขาขึ้นแข็งแกร่ง (Perfect Bull)';
            badgeCls = 'badge bullish';
            hintColor = '#26a69a';
            hintTxt = '✅ <b>ทำอะไร:</b> หา BUY เท่านั้น หลีกเลี่ยง SELL<br>EMA ทุกเส้นเรียงสวยจากบนลงล่าง ราคาอยู่เหนือทุกเส้น = momentum แข็งมาก';
        } else if (perfectBear) {
            badgeTxt = '🔴 ขาลงแข็งแกร่ง (Perfect Bear)';
            badgeCls = 'badge bearish';
            hintColor = '#ef5350';
            hintTxt = '✅ <b>ทำอะไร:</b> หา SELL เท่านั้น หลีกเลี่ยง BUY<br>EMA ทุกเส้นเรียงกลับจากล่างขึ้นบน ราคาอยู่ใต้ทุกเส้น = แรงขายแข็งมาก';
        } else if (biasBull) {
            badgeTxt = '↗️ Bias ขาขึ้น (แต่ยังไม่ Full Align)';
            badgeCls = 'badge bullish';
            hintColor = '#81c784';
            hintTxt = '⚠️ <b>ทำอะไร:</b> เน้น BUY แต่ระวัง — EMA ยังไม่เรียงสมบูรณ์<br>ราคาอยู่เหนือ EMA50/100 = Big picture ยังขาขึ้น แต่อาจมีพักตัว';
        } else if (biasBear) {
            badgeTxt = '↘️ Bias ขาลง (แต่ยังไม่ Full Align)';
            badgeCls = 'badge bearish';
            hintColor = '#ef9a9a';
            hintTxt = '⚠️ <b>ทำอะไร:</b> เน้น SELL แต่ระวัง — EMA ยังไม่เรียงสมบูรณ์<br>ราคาอยู่ใต้ EMA50/100 = Big picture ยังขาลง แต่อาจมีดีดตัว';
        } else {
            badgeTxt = '⚪ Choppy / ไม่ชัดเจน';
            badgeCls = 'badge neutral';
            hintColor = '#9ca3af';
            hintTxt = '🚫 <b>ทำอะไร:</b> หลีกเลี่ยงการเข้า หรือลด lot<br>EMA พันกันไม่เรียง = ตลาดไม่มีทิศ เสี่ยง whipsaw สูง';
        }
        elEmaAlign.textContent = badgeTxt;
        elEmaAlign.className   = badgeCls;

        // Visual stack — แสดงลำดับจากบนลงล่าง
        const fmt = v => v.toFixed(2);
        const dot = (v, ref) => {
            const above = ref > v;
            return `<span style="color:${above?'#26a69a':'#ef5350'};font-size:0.65rem;">${above?'▲':'▼'}</span>`;
        };
        if (elEmaStack) {
            // สร้าง array ของ [label, value] เรียงจากมากไปน้อย
            const layers = [
                { label: 'ราคา',   val: price,  color: '#f2a900' },
                { label: 'EMA5',   val: v5,     color: '#7986cb' },
                { label: 'EMA21',  val: v21,    color: '#4fc3f7' },
                { label: 'EMA50',  val: v50,    color: '#aed581' },
                { label: 'EMA100', val: v100,   color: '#ffb74d' },
            ].sort((a, b) => b.val - a.val);

            elEmaStack.innerHTML = layers.map((l, i) => {
                const bar = '━'.repeat(Math.max(1, Math.round(16 - i * 2)));
                return `<div style="display:flex;align-items:center;gap:6px;">
                    <span style="color:${l.color};width:46px;font-size:0.75rem;">${l.label}</span>
                    <span style="color:${l.color};letter-spacing:-1px;">${bar}</span>
                    <span style="color:#e0e0e0;font-size:0.75rem;">${l.val.toFixed(2)}</span>
                </div>`;
            }).join('');
        }
        if (elEmaHint) {
            elEmaHint.innerHTML = hintTxt;
            elEmaHint.style.borderLeft = `3px solid ${hintColor}`;
            elEmaHint.style.display = 'block';
        }
    }

    // ── Divergence ────────────────────────────────────────────────
    const elDiv    = document.getElementById('divergence-status');
    const elDivDet = document.getElementById('divergence-detail');
    if (elDiv) {
        const div = detectDivergence(candleData);
        if (div) {
            // ไอคอนภาพอธิบาย divergence
            const diagrams = {
                BULLISH:     { icon:'📈', action:'เตรียม BUY', diagram:'ราคา: ↘↘↘ (Low ใหม่)<br>MACD:  ↗↗  (ไม่ Low ใหม่) ← ขาลงหมดแรง!' },
                BEARISH:     { icon:'📉', action:'เตรียม SELL', diagram:'ราคา: ↗↗↗ (High ใหม่)<br>MACD:  ↘↘  (ไม่ High ใหม่) ← ขาขึ้นหมดแรง!' },
                HIDDEN_BULL: { icon:'📈', action:'ถือ BUY ต่อ / เพิ่ม', diagram:'ราคา: ↗ (Higher Low = ย่อแล้วสูงขึ้น)<br>MACD:  ↘  (Lower Low) ← trend ขาขึ้นยังไม่จบ' },
                HIDDEN_BEAR: { icon:'📉', action:'ถือ SELL ต่อ / เพิ่ม', diagram:'ราคา: ↘ (Lower High = เด้งแล้วต่ำลง)<br>MACD:  ↗  (Higher High) ← trend ขาลงยังไม่จบ' },
            };
            const d = diagrams[div.type] || {};
            const isBull = div.color === '#26a69a';
            elDiv.innerHTML = `<span style="color:${div.color};font-weight:700;">${d.icon || ''} ${div.label}</span>
                <span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:4px;background:${isBull?'rgba(38,166,154,0.15)':'rgba(239,83,80,0.15)'};color:${div.color};font-size:0.75rem;font-weight:600;">${d.action}</span>`;
            if (elDivDet) {
                elDivDet.innerHTML = `<b style="color:#e0e0e0;">วิธีอ่าน:</b><br>${d.diagram || div.desc}<br><br>
                    <b style="color:#e0e0e0;">ทำอะไร:</b> ${d.action}<br>
                    <span style="color:#6b7280;font-size:0.73rem;">⚡ Divergence คือสัญญาณที่ราคากับ Indicator ไม่สอดคล้องกัน = momentum กำลังเปลี่ยน ไม่ใช่สัญญาณ 100% ต้องรอยืนยันจาก SMC ด้วย</span>`;
                elDivDet.style.display = 'block';
            }
        } else {
            elDiv.innerHTML = '<span style="color:#4b5563;">ไม่พบ Divergence ในขณะนี้</span>';
            if (elDivDet) elDivDet.style.display = 'none';
        }
    }

    // ── Gap Analysis ──────────────────────────────────────────────
    const elGap     = document.getElementById('gap-warning');
    const elGapDet  = document.getElementById('gap-detail');
    const elGapNone = document.getElementById('gap-none-msg');
    if (elGap) {
        const gap = detectGap(candleData);
        if (gap) {
            if (elGapNone) elGapNone.style.display = 'none';
            const dir = gap.direction === 'UP' ? '↑' : '↓';
            const gapDefs = {
                EXHAUSTION: {
                    color:'#ef5350', bg:'rgba(239,83,80,0.1)',
                    icon:'⚠️', name:'Exhaustion Gap (ช่องว่างหมดแรง)',
                    msg:`Exhaustion Gap ${dir} ${gap.size}$ — ระวังกลับตัว!`,
                    explain:`ราคาวิ่งมานานมากแล้วเกิดช่องว่างใหญ่ขึ้นมา = สัญญาณว่า wave กำลังจะจบ<br>
                        <b style="color:#ef5350;">❌ ห้ามเข้าตามทิศเดิม</b> — คนส่วนใหญ่ FOMO เข้าตอนนี้แล้วติดดอย<br>
                        💡 รอดูการกลับตัว หรือรอ STO Cross เพื่อเข้าสวน`,
                },
                BREAKAWAY: {
                    color:'#f2a900', bg:'rgba(242,169,0,0.1)',
                    icon:'⚡', name:'Breakaway Gap (ช่องว่างทะลุ)',
                    msg:`Breakaway Gap ${dir} ${gap.size}$ — Wave 3 เริ่มต้น!`,
                    explain:`ราคาออกจากการพักตัวด้วยช่องว่างใหญ่ = สัญญาณว่า trend ใหม่กำลังเริ่ม<br>
                        <b style="color:#f2a900;">✅ เข้าตามทิศของ Gap</b> — นี่คือ momentum เริ่มต้น<br>
                        💡 Gap มักไม่ถูก Fill ทันที ราคาจะวิ่งต่อก่อน`,
                },
                RUNAWAY: {
                    color:'#26a69a', bg:'rgba(38,166,154,0.1)',
                    icon:'📊', name:'Runaway Gap (ช่องว่างกลาง trend)',
                    msg:`Runaway Gap ${dir} ${gap.size}$ — Wave 3 ยังวิ่งต่อ`,
                    explain:`Gap เกิดกลาง trend ที่แรงอยู่ = สัญญาณว่ายังมีแรงวิ่งต่อ<br>
                        <b style="color:#26a69a;">✅ ถือ position เดิมต่อ</b> หรือเพิ่มไซส์<br>
                        💡 ราคายังอยู่กลาง wave 3 — ยังไม่ถึงเวลาออก`,
                },
            };
            const s = gapDefs[gap.type] || gapDefs.RUNAWAY;
            elGap.style.display = 'block';
            elGap.innerHTML = `<div style="padding:7px 10px;border-radius:6px;background:${s.bg};border-left:3px solid ${s.color};">
                <div style="color:${s.color};font-weight:700;font-size:0.83rem;">${s.icon} ${s.name}</div>
                <div style="color:${s.color};font-size:0.78rem;margin-top:2px;">${s.msg}</div>
            </div>`;
            if (elGapDet) {
                elGapDet.innerHTML = `<b style="color:#e0e0e0;">ความหมาย:</b><br>${s.explain}<br><br>
                    <span style="color:#6b7280;font-size:0.73rem;">⚠️ Gap ที่ยัง "ไม่ถูก Fill" คือยังมีช่องว่างระหว่างแท่งที่ราคาไม่เคยผ่าน — ราคามักย้อนกลับมาปิด Gap ในที่สุด</span>`;
                elGapDet.style.display = 'block';
            }
        } else {
            elGap.style.display = 'none';
            elGap.innerHTML = '';
            if (elGapDet) elGapDet.style.display = 'none';
            if (elGapNone) elGapNone.style.display = 'block';
        }
    }

}
// =====================================================================

function updateChartData() {
    if (!candleSeries) return;

    // De-duplicate times before setting data to prevent Lightweight Charts errors
    const uniqueData = [];
    const seenTimes = new Set();
    for (let i = candleData.length - 1; i >= 0; i--) {
        if (!seenTimes.has(candleData[i].time)) {
            uniqueData.unshift(candleData[i]);
            seenTimes.add(candleData[i].time);
        }
    }

    candleSeries.setData(uniqueData);

    // EMA values still calculated for sidebar EMA Alignment badge (not drawn on chart)
    const e5  = calculateEMAForChart(uniqueData, 5);
    const e21 = calculateEMAForChart(uniqueData, 21);
    const e50 = calculateEMAForChart(uniqueData, 50);
    const e100 = calculateEMAForChart(uniqueData, 100);
    if (e5.length   > 0) lastEmaValues.ema5   = e5[e5.length-1].value;
    if (e21.length  > 0) lastEmaValues.ema21  = e21[e21.length-1].value;
    if (e50.length  > 0) lastEmaValues.ema50  = e50[e50.length-1].value;
    if (e100.length > 0) lastEmaValues.ema100 = e100[e100.length-1].value;
    
    // Evaluate loaded history against open trades and render saved markers
    evaluateAllHistory();
    refreshMarkers();
    updateStatsUI();
}

// Ensure TV Widget loads, then immediately fetch initial candle history
if (window.LightweightCharts) {
    initTVWidget();
    fetchHistory();
} else {
    setTimeout(() => { initTVWidget(); fetchHistory(); }, 1000);
}

// Timeframe selection state
let currentInterval = '1m';
const timeframeSelect = document.getElementById('timeframe-select');
if (timeframeSelect) {
    timeframeSelect.addEventListener('change', (e) => {
        currentInterval = e.target.value;
        fetchHistory();
    });
}

// ปุ่ม Backtest — ไล่แท่งใน memory ผ่าน engine (เฟส 5)
const _btBtn = document.getElementById('btn-backtest');
if (_btBtn) _btBtn.addEventListener('click', runBacktest);

// 2. Fetch History for Internal Analysis
// Generic N-bar aggregator — รวม n แท่งเล็กเป็น 1 แท่งใหญ่
function aggregateCandles(candles, n) {
    const result = [];
    for (let i = 0; i + n - 1 < candles.length; i += n) {
        const group = candles.slice(i, i + n);
        result.push({
            time:  group[0].time,
            open:  group[0].open,
            high:  Math.max(...group.map(c => c.high)),
            low:   Math.min(...group.map(c => c.low)),
            close: group[n - 1].close,
        });
    }
    return result;
}

// Universal CORS Proxy Helper สำหรับดึง Yahoo Finance ให้ทำงานได้เหมือนกัน 100% ทั้งบน Chrome และ Safari (หลบ ITP/CORS บล็อก)
async function fetchYahooJSON(yahooUrl, timeoutMs = 8000) {
    const encodedUrl = encodeURIComponent(yahooUrl);
    const proxyList = [
        { url: 'https://api.codetabs.com/v1/proxy?quest=' + encodedUrl, type: 'raw' },
        { url: 'https://api.allorigins.win/get?url=' + encodedUrl, type: 'wrapped' },
        { url: 'https://corsproxy.io/?' + encodedUrl, type: 'raw' },
        { url: 'https://api.allorigins.win/raw?url=' + encodedUrl, type: 'raw' },
        { url: 'https://thingproxy.freeboard.io/fetch/' + encodedUrl, type: 'raw' },
        { url: yahooUrl, type: 'raw' }
    ];

    for (const p of proxyList) {
        try {
            const r = await fetch(p.url, { signal: AbortSignal.timeout(timeoutMs) });
            if (!r.ok) continue;
            let j = await r.json();
            if (p.type === 'wrapped' && j && j.contents) {
                j = typeof j.contents === 'string' ? JSON.parse(j.contents) : j.contents;
            }
            if (j?.chart?.result?.[0]?.timestamp || j?.chart?.result?.[0]?.meta?.regularMarketPrice) {
                return j;
            }
        } catch(e) {}
    }
    return null;
}

async function fetchHistory() {
    // ── ดึงประวัติราคาทองคำจาก Yahoo Finance XAUUSD=X เท่านั้น (ตัด MT5 และ PAXG ออกเพื่อป้องกันราคากระโดด) ──
    const yahooMap = {
        '1m':  { yi: '1m',  range: '5d',   aggN: 1 },
        '3m':  { yi: '1m',  range: '5d',   aggN: 3 },  // aggregate 1m×3
        '5m':  { yi: '5m',  range: '60d',  aggN: 1 },
        '15m': { yi: '15m', range: '60d',  aggN: 1 },
        '30m': { yi: '30m', range: '60d',  aggN: 1 },
        '45m': { yi: '15m', range: '60d',  aggN: 3 },  // aggregate 15m×3
        '1h':  { yi: '60m', range: '730d', aggN: 1 },
        '4h':  { yi: '60m', range: '730d', aggN: 4 },  // aggregate 1h×4
        '1d':  { yi: '1d',  range: '10y',  aggN: 1 },
    };
    const cfg = yahooMap[currentInterval] || yahooMap['1m'];
    
    for (const host of ['query1', 'query2']) {
        const yahooUrl = `https://${host}.finance.yahoo.com/v8/finance/chart/XAUUSD%3DX?interval=${cfg.yi}&range=${cfg.range}`;
        const j = await fetchYahooJSON(yahooUrl, 8000);
        if (j) {
            const res = j.chart?.result?.[0];
            if (res?.timestamp) {
                const q = res.indicators.quote[0];
                let raw = res.timestamp.map((t, i) => ({
                    time:  t,
                    open:  q.open[i],
                    high:  q.high[i],
                    low:   q.low[i],
                    close: q.close[i],
                })).filter(c => c.open != null && c.close != null);
                if (raw.length >= 20) {
                    if (cfg.aggN > 1) raw = aggregateCandles(raw, cfg.aggN);
                    candleData = raw.slice(-1000);
                    currentCandle = null;
                    updateChartData();
                    analyzeMarketStructure();
                    console.log(`✅ History loaded from Yahoo XAUUSD=X (${host}, ${candleData.length} bars, TF=${currentInterval})`);
                    return;
                }
            }
        }
    }
    console.warn("Yahoo history fetch failed.");
}

// Map timeframe string → seconds per bar (used to align live ticks with historical bars)
function getIntervalSeconds(interval) {
    const map = { '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800, '45m': 2700, '1h': 3600, '4h': 14400, '1d': 86400 };
    return map[interval] || 60;
}

// Round a Unix timestamp (seconds) DOWN to the start of the current bar for the given interval
function alignTimeToInterval(timestampSec, interval) {
    const intervalSec = getIntervalSeconds(interval);
    return Math.floor(timestampSec / intervalSec) * intervalSec;
}

// 3. Live Price Connection (1:1 Copy from Original Code for Real-time Feel)
let priceSource = '';
function connectLiveFeeds() {
    elStatus.textContent = "กำลังเชื่อมต่อข้อมูลตลาดจริง (Yahoo XAUUSD)...";
    elDot.classList.add('connected');

    // ── ดึงราคา Live Spot Gold จาก Yahoo Finance XAUUSD=X เท่านั้น (ตัด MT5, metals.live, PAXG ออกทั้งหมด) ──
    const fetchYahooSpot = async () => {
        const hosts = ['query1', 'query2'];
        for (const host of hosts) {
            try {
                const yahooUrl = `https://${host}.finance.yahoo.com/v8/finance/chart/XAUUSD%3DX?interval=1m&range=1d`;
                const j = await fetchYahooJSON(yahooUrl, 4000);
                if (j) {
                    const p = j.chart?.result?.[0]?.meta?.regularMarketPrice;
                    if (p && p > 100) {
                        priceSource = 'Yahoo';
                        elStatus.textContent = "เชื่อมต่อตลาดจริง (Yahoo XAUUSD=X)";
                        processLiveTick(p, 'Yahoo');
                        return;
                    }
                }
            } catch(e) {}
        }
    };

    let restIv = null;
    const startRest = () => {
        if (!restIv) {
            fetchYahooSpot();
            restIv = setInterval(fetchYahooSpot, 3000); // ดึงราคา Yahoo ทุก 3 วินาที
        }
    };

    startRest();
}

// ─── Rolling spike filter ────────────────────────────────────────────────────
// กรองราคากระโดดผิดปกติด้วย rolling average (ดีกว่า fixed threshold)
// Reject ถ้าราคาเบี่ยงจาก avg ของ 10 tick ล่าสุดเกิน 0.4% (~$16 บน $4000)
// แต่ถ้า reject ติดกัน 3+ ครั้ง = ตลาดเคลื่อนจริง → รับและ reset buffer
const _priceRolling  = [];
const _ROLL_SIZE     = 10;
const _OUTLIER_PCT   = 0.004;  // 0.4%
let   _outlierConsec = 0;

function _acceptPriceTick(price) {
    if (_priceRolling.length < 5) {
        _priceRolling.push(price);
        _outlierConsec = 0;
        return true;
    }
    const avg = _priceRolling.reduce((s, p) => s + p, 0) / _priceRolling.length;
    const pct = Math.abs(price - avg) / avg;
    if (pct > _OUTLIER_PCT) {
        _outlierConsec++;
        if (_outlierConsec >= 3) {
            // 3 tick ติดกันในทิศเดียว = ตลาดเคลื่อนจริง — accept + reset buffer
            _priceRolling.length = 0;
            _priceRolling.push(price);
            _outlierConsec = 0;
            console.info(`✅ ยืนยัน large move: ${avg.toFixed(2)} → ${price.toFixed(2)}`);
            return true;
        }
        console.warn(`⚠️ Spike tick #${_outlierConsec}: ${price} (avg ${avg.toFixed(2)}, +${(pct*100).toFixed(3)}%) — ถูกกรอง`);
        return false;
    }
    _priceRolling.push(price);
    if (_priceRolling.length > _ROLL_SIZE) _priceRolling.shift();
    _outlierConsec = 0;
    return true;
}
// ─────────────────────────────────────────────────────────────────────────────

let currentCandle = null;
let lastTickSource = '';
function processLiveTick(price, source) {
    if(source) {
        if (lastTickSource !== source) updatePriceSourceBadge(source);
        lastTickSource = source;
    }

    // อัปเดตราคา + เวลาที่รับราคาล่าสุด
    elPrice.textContent = price.toFixed(2);
    elPrice.style.color = '#f2a900';
    setTimeout(() => { elPrice.style.color = ''; }, 300);
    const _elTs = document.getElementById('price-last-update');
    if (_elTs) {
        const _now = new Date();
        const _hms = _now.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
        _elTs.textContent = `🕐 ${_hms}`;
        _elTs.title = `รับราคาล่าสุดเวลา ${_hms} จาก ${source || lastTickSource || '?'}`;
    }

    // Align tick to current timeframe bar start (1m, 5m, 15m, 1h, etc.)
    const nowSec = Math.floor(Date.now() / 1000);
    const tickTime = alignTimeToInterval(nowSec, currentInterval);

    // ตรวจ price alerts ทุก tick
    checkPriceAlerts(price);

    // Rolling spike filter — กรอง tick ผิดปกติด้วย rolling average (0.4% threshold)
    // ป้องกัน yfinance fallback หรือ data glitch ทำให้กราฟกระโดด
    if (!_acceptPriceTick(price)) return;

    if (!currentCandle || currentCandle.time !== tickTime) {
        if (currentCandle) {
            // ประเมิน WIN/LOSS ที่ "แท่งปิด" เท่านั้น — ใช้ high/low ของแท่งที่ปิดจริง
            //   กัน tick spike/glitch ชั่วคราวปิด trade แบบไม่ตรงกับที่เห็นบนกราฟ
            //   (time guard ใน evaluateTrades จะข้ามแท่งเดียวกับ entry ให้อยู่แล้ว)
            evaluateTrades(currentCandle.high, currentCandle.low, currentCandle.time);

            // อัปเดต EMA ที่ bar close เท่านั้น (ใช้ราคาปิดแท่ง ไม่ใช่ tick กลางแท่ง)
            const barClose = currentCandle.close;
            const _emaPeriods = [5, 21, 50, 100];
            const _emaKeys    = ['ema5', 'ema21', 'ema50', 'ema100'];
            _emaPeriods.forEach((period, idx) => {
                if (lastEmaValues[_emaKeys[idx]] === null) return;
                const k = 2 / (period + 1);
                lastEmaValues[_emaKeys[idx]] = barClose * k + lastEmaValues[_emaKeys[idx]] * (1 - k);
            });
            analyzeMarketStructure();
            checkSignals();
            checkScalpSignals();   // Scalping engine: BB + Fib + Key Level
            monitorReversals();    // แจ้งเตือนเมื่อ open trade มีสัญญาณกลับตัว
        }
        // Find existing bar at this time (we may be re-entering the same bar across reloads/TF switches)
        const lastBar = candleData[candleData.length - 1];
        if (lastBar && lastBar.time === tickTime) {
            currentCandle = lastBar;
            currentCandle.high = Math.max(currentCandle.high, price);
            currentCandle.low  = Math.min(currentCandle.low,  price);
            currentCandle.close = price;
        } else {
            currentCandle = { time: tickTime, open: price, high: price, low: price, close: price };
            candleData.push(currentCandle);
        }
    } else {
        currentCandle.high = Math.max(currentCandle.high, price);
        currentCandle.low = Math.min(currentCandle.low, price);
        currentCandle.close = price;
        candleData[candleData.length - 1] = currentCandle;
    }
    
    // หมายเหตุ: การประเมิน WIN/LOSS ย้ายไปทำที่ "แท่งปิด" ด้านบนแล้ว (กัน spike ปิดผิด)
    //   ที่นี่อัปเดตแค่ P&L สด + กราฟ ทุก tick

    // Live update on Lightweight Chart
    if (candleSeries) {
        candleSeries.update(currentCandle);
        // EMA อัปเดตที่ bar close เท่านั้น (ดูบน bar boundary ด้านบน)
    }

    // อัปเดต P&L ของ open trade ทุก tick
    updateOpenTradePnL(price);
    // อัปเดต market status ทุก tick ให้ผู้ใช้เห็นสถานะปัจจุบันตลอดเวลา
    try { updateLiveMarketUI(); } catch(e) {}
}

// Ensure TV Widget loads, then immediately fetch initial candle history
if (window.LightweightCharts) {
    initTVWidget();
    fetchHistory();
} else {
    setTimeout(() => { initTVWidget(); fetchHistory(); }, 1000);
}

// Start: load trades first, then init chart data
loadTrades().then(() => {
    fetchHistory();
});
connectLiveFeeds();
loadPriceAlertsFromRTDB();
syncAlertStatus();
initMT5Bridge();

// =====================================================================
// Price Alert UI functions
// =====================================================================
async function savePriceAlertsToRTDB() {
    if (!RTDB_ENABLED || !rtdb) return;
    // บันทึก alerts เป็น object keyed by id เพื่อให้ mt5_server.py อ่านได้
    const obj = {};
    priceAlerts.forEach(a => { obj[a.id] = a; });
    await rtdb.ref('price_alerts').set(obj);
}

async function loadPriceAlertsFromRTDB() {
    if (!RTDB_ENABLED || !rtdb) return;
    try {
        const snap = await rtdb.ref('price_alerts').get();
        if (snap.exists()) {
            const data = snap.val();
            priceAlerts = Object.values(data).filter(a => a && !a.triggered);
            renderPriceAlerts();
        }
    } catch(e) {}
}

// sync triggered status จาก server กลับมา UI
function syncAlertStatus() {
    if (!RTDB_ENABLED || !rtdb) return;
    rtdb.ref('price_alerts').on('value', snap => {
        if (!snap.exists()) return;
        const data = snap.val();
        priceAlerts.forEach(a => {
            const srv = data[a.id];
            if (srv && srv.triggered && !a.triggered) {
                a.triggered = true;
            }
        });
        renderPriceAlerts();
    });
}

function addPriceAlert() {
    const price = parseFloat(document.getElementById('alert-price-input').value);
    const direction = document.getElementById('alert-dir-select').value;
    const label = document.getElementById('alert-label-input').value.trim();
    if (!price || isNaN(price)) return;

    if (priceAlerts.some(a => a.price === price && a.direction === direction && !a.triggered)) {
        alert('มี alert ราคานี้อยู่แล้ว'); return;
    }

    const newAlert = { id: 'pa_' + Date.now(), price, direction, label, triggered: false };
    priceAlerts.push(newAlert);
    document.getElementById('alert-price-input').value = '';
    document.getElementById('alert-label-input').value = '';

    if (Notification.permission === 'default') Notification.requestPermission();

    savePriceAlertsToRTDB();
    renderPriceAlerts();

    const dir = direction === 'above' ? '↑ ขึ้นถึง' : '↓ ลงถึง';
    sendTelegram(`🔔 <b>ตั้ง Price Alert แล้ว</b>\n${dir} <b>${price.toFixed(2)}</b>${label ? '\n📌 ' + label : ''}\n<i>แจ้งเตือนแม้ปิด web แล้ว</i>`);
}

function renderPriceAlerts() {
    const list = document.getElementById('price-alerts-list');
    if (!list) return;
    if (priceAlerts.length === 0) { list.innerHTML = '<div style="color:#6b7280;font-size:0.8rem;">ยังไม่มี alert</div>'; return; }
    list.innerHTML = priceAlerts.map((a, i) => {
        const dir = a.direction === 'above' ? '↑' : '↓';
        const color = a.triggered ? '#6b7280' : (a.direction === 'above' ? '#26a69a' : '#ef5350');
        const status = a.triggered ? ' ✓' : '';
        return `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:#1f2937;border-radius:4px;font-size:0.8rem;opacity:${a.triggered?0.5:1}">
            <span style="color:${color};font-weight:bold;">${dir} ${a.price.toFixed(2)}</span>
            ${a.label ? `<span style="color:#9ca3af;flex:1">${a.label}</span>` : '<span style="flex:1"></span>'}
            <span style="color:#6b7280">${status}</span>
            <button onclick="removePriceAlert(${i})" style="background:none;border:none;color:#ef5350;cursor:pointer;padding:0 4px;font-size:0.85rem;">✕</button>
        </div>`;
    }).join('');
}

function removePriceAlert(index) {
    priceAlerts.splice(index, 1);
    savePriceAlertsToRTDB();
    renderPriceAlerts();
}
// =====================================================================

// 4. SMC / Price Action Analyzer (Winter Trader & SMC Concepts)
let swings = { highs: [], lows: [] };
let lastDemand = null; // RBR or DBR
let lastSupply = null; // DBD or RBD
let currentTrend = 'NEUTRAL';
let currentSmc = 'WAITING';

// Premium / Discount (P/D) — คำนวณจาก 50% ของ Swing High → Swing Low ล่าสุด
let equilibriumLevel = null;
let eqLine = null;

// Phase 2 — Major/Minor Structure + ROF + Inducement
let structureQuality = 'MINOR'; // 'MAJOR' (pullback ≥50%) หรือ 'MINOR' (<50%)
let structurePullbackPct = 0;   // % pullback ของ correction

function analyzeMarketStructure() {
    if(candleData.length < 50) return;
    
    // 1. Upgrade Fractal width to 5 for better stability
    let leftBars = 5;
    let rightBars = 5;
    let highs = [];
    let lows = [];
    
    for(let i = leftBars; i < candleData.length - rightBars; i++) {
        let isHigh = true;
        let isLow = true;
        let c = candleData[i];
        for(let j = 1; j <= leftBars; j++) {
            if(candleData[i-j].high >= c.high) isHigh = false;
            if(candleData[i-j].low <= c.low) isLow = false;
        }
        for(let j = 1; j <= rightBars; j++) {
            if(candleData[i+j].high > c.high) isHigh = false;
            if(candleData[i+j].low < c.low) isLow = false;
        }
        if(isHigh) highs.push({index: i, price: c.high, time: c.time, type: 'HH'});
        if(isLow) lows.push({index: i, price: c.low, time: c.time, type: 'LL'});
    }
    // บันทึก swing highs/lows สำหรับ Fibonacci + Scalping engine
    swings.highs = highs;
    swings.lows  = lows;
    // อัปเดต Key Levels ทุก bar close (ใช้ 200 bars ล่าสุด เพื่อความเร็ว)
    lastKeyLevels = detectKeyLevels(candleData.slice(-200));

    // 2. Identify TRUE Order Blocks (Demand & Supply Zones)
    // Find the last opposite candle before the pivot
    if(highs.length > 0) {
        let pivot = highs[highs.length-1];
        let idx = pivot.index;
        let baseCandle = candleData[idx];
        for(let k = idx; k >= Math.max(0, idx - 10); k--) {
            if (candleData[k].close > candleData[k].open) {
                baseCandle = candleData[k];
                break;
            }
        }
        lastSupply = { top: baseCandle.high, bottom: baseCandle.low, type: 'Supply Order Block', swingHigh: pivot.price };
        if (lastSupply.top === lastSupply.bottom) { lastSupply.bottom -= 0.5; }
        if (!_backtestMode) elSupply.textContent = `${lastSupply.bottom.toFixed(2)} - ${lastSupply.top.toFixed(2)}`;
        if (candleSeries && !_backtestMode) {
            if (supplyLine) candleSeries.removePriceLine(supplyLine);
            supplyLine = candleSeries.createPriceLine({
                price: lastSupply.bottom,
                color: '#ef5350',
                lineWidth: 2,
                title: `🔴 แนวต้าน ${lastSupply.bottom.toFixed(2)}`,
                lineStyle: LightweightCharts.LineStyle.Solid,
                axisLabelVisible: true,
            });
        }
    }

    if(lows.length > 0) {
        let pivot = lows[lows.length-1];
        let idx = pivot.index;
        let baseCandle = candleData[idx];
        for(let k = idx; k >= Math.max(0, idx - 10); k--) {
            if (candleData[k].close < candleData[k].open) {
                baseCandle = candleData[k];
                break;
            }
        }
        lastDemand = { top: baseCandle.high, bottom: baseCandle.low, type: 'Demand Order Block', swingLow: pivot.price };
        if (lastDemand.top === lastDemand.bottom) { lastDemand.top += 0.5; }
        if (!_backtestMode) elDemand.textContent = `${lastDemand.bottom.toFixed(2)} - ${lastDemand.top.toFixed(2)}`;
        if (candleSeries && !_backtestMode) {
            if (demandLine) candleSeries.removePriceLine(demandLine);
            demandLine = candleSeries.createPriceLine({
                price: lastDemand.top,
                color: '#26a69a',
                lineWidth: 2,
                title: `🟢 แนวรับ ${lastDemand.top.toFixed(2)}`,
                lineStyle: LightweightCharts.LineStyle.Solid,
                axisLabelVisible: true,
            });
        }
    }

    // Premium / Discount — 50% ของ Swing High → Swing Low ล่าสุด (ใช้ภายในเป็น filter)
    if (highs.length > 0 && lows.length > 0) {
        const pdH = highs[highs.length-1].price;
        const pdL = lows[lows.length-1].price;
        equilibriumLevel = (pdH + pdL) / 2;
    }

    // SMC Structure Analysis: BOS, CHoCH, and Liquidity Grabs
    if(highs.length >= 2 && lows.length >= 2) {
        let h1 = highs[highs.length-2].price;
        let h2 = highs[highs.length-1].price;
        let l1 = lows[lows.length-2].price;
        let l2 = lows[lows.length-1].price;

        // 3. Liquidity Sweep (Turtle Soup Logic)
        let sweptLiquidity = false;
        let sweepText = "";
        // Sweep Low: Wicked below old low, but closed above it
        let pivotLowCandle = candleData[lows[lows.length-1].index];
        let pivotHighCandle = candleData[highs[highs.length-1].index];
        
        if (l2 < l1 && pivotLowCandle.close > l1) {
            sweptLiquidity = true;
            sweepText = " (เกิด Turtle Soup แทงไส้กวาด SL ขาลง)";
        } 
        // Sweep High: Wicked above old high, but closed below it
        else if (h2 > h1 && pivotHighCandle.close < h1) {
            sweptLiquidity = true;
            sweepText = " (เกิด Turtle Soup แทงไส้กวาด SL ขาขึ้น)";
        }

        if(h2 > h1 && l2 > l1) {
            currentTrend = 'BULLISH';
            currentSmc = `ทำยอด High ใหม่ (BOS ขาขึ้น) - แรงซื้อยังแข็งแกร่ง${sweepText}`;
        } else if (h2 < h1 && l2 < l1) {
            currentTrend = 'BEARISH';
            currentSmc = `ทำจุด Low ใหม่ (BOS ขาลง) - แรงขายยังแข็งแกร่ง${sweepText}`;
        } else if (h2 > h1 && l2 < l1) {
            currentTrend = 'BULLISH';
            currentSmc = `เสียทรงขาลง (CHoCH) - กราฟเริ่มกลับตัวเป็นขาขึ้น${sweepText}`;
        } else if (h2 < h1 && l2 > l1) {
            currentTrend = 'BEARISH';
            currentSmc = `เสียทรงขาขึ้น (CHoCH) - กราฟเริ่มกลับตัวเป็นขาลง${sweepText}`;
        }

        // --- Major vs Minor Structure ---
        // Major = correction ลึก ≥50% ของ impulse ก่อนหน้า (ผ่าน EQ)
        // Minor = correction ตื้น <50% (ไม่ผ่าน EQ)
        // 🛡️ Pullback >100% = ไม่ใช่ correction แต่เป็น REVERSAL → invalidate (downgrade to MINOR)
        if (currentTrend === 'BULLISH') {
            const impulse = h2 - l1;
            const correction = h1 - l2;
            structurePullbackPct = impulse > 0 ? Math.max(0, Math.round((correction / impulse) * 100)) : 0;
        } else if (currentTrend === 'BEARISH') {
            const impulse = h1 - l2;
            const correction = h2 - l1;
            structurePullbackPct = impulse > 0 ? Math.max(0, Math.round((correction / impulse) * 100)) : 0;
        }
        // ถ้า pullback > 100 → structure invalid (ไม่ใช่ impulse-correction ปกติ)
        if (structurePullbackPct > 100) {
            structureQuality = 'INVALID';
        } else {
            structureQuality = structurePullbackPct >= 50 ? 'MAJOR' : 'MINOR';
        }
    }

    elTrend.textContent = currentTrend === 'BULLISH' ? 'ขาขึ้น (BULLISH)' : currentTrend === 'BEARISH' ? 'ขาลง (BEARISH)' : 'รอดูลาดเลา (NEUTRAL)';
    elTrend.className = `badge ${currentTrend === 'BULLISH' ? 'bullish' : currentTrend === 'BEARISH' ? 'bearish' : 'neutral'}`;

    // SMC text + Major/Minor tag
    const structColor = structureQuality === 'MAJOR' ? '#f2a900' : '#787b86';
    const structLabel = structureQuality === 'MAJOR'
        ? `<span style="color:${structColor};font-weight:bold"> [MBOS ${structurePullbackPct}% pullback → รอ ROF]</span>`
        : `<span style="color:${structColor}"> [mBOS ${structurePullbackPct}% pullback]</span>`;
    if (_backtestMode) return;  // backtest: ข้าม DOM rendering ทั้งหมด (เร็วขึ้นมาก)
    elSmc.innerHTML = `<span style="font-size:0.95rem;line-height:1.4;display:block;margin-top:5px;">${currentSmc}${structLabel}</span>`;

    // updateLiveMarketUI มาก่อน เพื่อให้ผู้ใช้เห็น market status แม้ function อื่นจะ error
    try { updateLiveMarketUI(); } catch(e) { console.warn('updateLiveMarketUI:', e); }
    try { updatePhase3UI();     } catch(e) { console.warn('updatePhase3UI:', e); }
    try { updateStochasticUI(); } catch(e) { console.warn('updateStochasticUI:', e); }
}

// --- Inducement Detection ---
// ตรวจว่ามี Liquidity Grab (ไส้เทียนแทงผ่าน swing แล้วปิดกลับมา) ก่อน entry หรือไม่
function detectInducement(type) {
    if (!candleData || candleData.length < 12) return false;
    // ดูแท่งช่วงก่อนสัญญาณ (ไม่รวมแท่งปิดล่าสุด 2 แท่ง)
    const recentCandles = candleData.slice(-14, -2);

    if (type === 'BUY' && lastDemand) {
        // Bullish Inducement: ไส้ลงแทงต่ำกว่า swing low แล้วปิดกลับขึ้นมาเหนือ swing low
        const swingLow = lastDemand.swingLow !== undefined ? lastDemand.swingLow : lastDemand.bottom;
        return recentCandles.some(c => c.low < swingLow && c.close > swingLow);
    }
    if (type === 'SELL' && lastSupply) {
        // Bearish Inducement: ไส้บนแทงสูงกว่า swing high แล้วปิดกลับลงมาต่ำกว่า swing high
        const swingHigh = lastSupply.swingHigh !== undefined ? lastSupply.swingHigh : lastSupply.top;
        return recentCandles.some(c => c.high > swingHigh && c.close < swingHigh);
    }
    return false;
}

/**
 * STO Confluence Analyzer — ใช้ STO ช่วยกรอง/ยืนยันสัญญาณหลัก
 *
 * @param {string} direction  'BUY' หรือ 'SELL'
 * @returns {Object} { rating, tag, qualityBoost }
 *   - rating: 'STRONG_CONFIRM' | 'CONFIRM' | 'NEUTRAL' | 'WARNING' | 'CONTRA'
 *   - tag: ข้อความติด reason
 *   - qualityBoost: 'UPGRADE' | 'KEEP' | 'DOWNGRADE'
 */
function getStoConfluence(direction) {
    if (!lastStoData || lastStoData.length < 3) {
        return { rating: 'NEUTRAL', tag: '', qualityBoost: 'KEEP' };
    }
    const last = lastStoData[lastStoData.length - 1];
    if (last.k === null || last.d === null) {
        return { rating: 'NEUTRAL', tag: '', qualityBoost: 'KEEP' };
    }

    const { overbought, oversold } = STO_CONFIG;
    const k = last.k, d = last.d;
    const kAboveD = k > d;
    const inOS    = k < oversold;
    const inOB    = k > overbought;
    const justCrossed = detectStochasticCross(lastStoData); // null หรือ {type, strength}

    if (direction === 'BUY') {
        // ✨ Best case: Bullish cross เพิ่งเกิดในโซน Oversold
        if (justCrossed && justCrossed.type === 'BULLISH' && justCrossed.strength === 'STRONG') {
            return { rating: 'STRONG_CONFIRM', tag: ' + STO Bullish Cross @ OS ✨', qualityBoost: 'UPGRADE' };
        }
        // ✅ Bullish cross นอกโซน OS (ยังโอเค)
        if (justCrossed && justCrossed.type === 'BULLISH') {
            return { rating: 'CONFIRM', tag: ' + STO Bullish Cross', qualityBoost: 'KEEP' };
        }
        // ✅ ยังไม่ cross แต่ %K เหนือ %D และอยู่ Oversold (กำลังเด้ง)
        if (inOS && kAboveD) {
            return { rating: 'CONFIRM', tag: ' + STO OS rebound', qualityBoost: 'UPGRADE' };
        }
        // 🟡 %K เหนือ %D เฉยๆ (โน้มขึ้น)
        if (kAboveD && !inOB) {
            return { rating: 'NEUTRAL', tag: ' | STO OK', qualityBoost: 'KEEP' };
        }
        // ⚠️ %K ใต้ %D + อยู่ Overbought (STO ขัด)
        if (!kAboveD && inOB) {
            return { rating: 'CONTRA', tag: ' ⚠️ STO Bearish @ OB ขัดสัญญาณ', qualityBoost: 'DOWNGRADE' };
        }
        // ⚠️ %K ใต้ %D
        if (!kAboveD) {
            return { rating: 'WARNING', tag: ' ⚠️ STO หันลง', qualityBoost: 'DOWNGRADE' };
        }
        // %K เหนือ %D + Overbought (อันตราย — momentum สุดแล้ว)
        if (inOB) {
            return { rating: 'WARNING', tag: ' ⚠️ STO Overbought แล้ว', qualityBoost: 'DOWNGRADE' };
        }
    }

    if (direction === 'SELL') {
        if (justCrossed && justCrossed.type === 'BEARISH' && justCrossed.strength === 'STRONG') {
            return { rating: 'STRONG_CONFIRM', tag: ' + STO Bearish Cross @ OB ✨', qualityBoost: 'UPGRADE' };
        }
        if (justCrossed && justCrossed.type === 'BEARISH') {
            return { rating: 'CONFIRM', tag: ' + STO Bearish Cross', qualityBoost: 'KEEP' };
        }
        if (inOB && !kAboveD) {
            return { rating: 'CONFIRM', tag: ' + STO OB rejection', qualityBoost: 'UPGRADE' };
        }
        if (!kAboveD && !inOS) {
            return { rating: 'NEUTRAL', tag: ' | STO OK', qualityBoost: 'KEEP' };
        }
        if (kAboveD && inOS) {
            return { rating: 'CONTRA', tag: ' ⚠️ STO Bullish @ OS ขัดสัญญาณ', qualityBoost: 'DOWNGRADE' };
        }
        if (kAboveD) {
            return { rating: 'WARNING', tag: ' ⚠️ STO หันขึ้น', qualityBoost: 'DOWNGRADE' };
        }
        if (inOS) {
            return { rating: 'WARNING', tag: ' ⚠️ STO Oversold แล้ว', qualityBoost: 'DOWNGRADE' };
        }
    }

    return { rating: 'NEUTRAL', tag: '', qualityBoost: 'KEEP' };
}

/**
 * ปรับ quality ตามผล STO confluence
 * MAJOR + UPGRADE     → PREMIUM (สูงสุด)
 * MAJOR + DOWNGRADE   → MAJOR (คงเดิม — SMC ยังแข็ง)
 * MINOR + UPGRADE     → MAJOR (boost)
 * MINOR + DOWNGRADE   → MINOR (คงเดิม — ส่งแต่เตือน)
 */
function applyStoQualityBoost(baseQuality, boost) {
    if (boost === 'UPGRADE') {
        if (baseQuality === 'MAJOR') return 'PREMIUM';
        if (baseQuality === 'MINOR') return 'MAJOR';
    }
    return baseQuality;
}

// 5. Signal Generation Logic (Confluence of SMC + D&S + STO)
let lastSignalTime = null;

// 🔬 Backtest mode — เมื่อ true, triggerSignal/triggerScalpSignal จะ "บันทึก" สัญญาณ
//    ลง _backtestSignals แทนที่จะยิง DOM/Telegram/trade-push จริง (ใช้ทดสอบย้อนหลัง)
let _backtestMode = false;
let _backtestSignals = [];

// 🛡️ Cooldown: ป้องกัน revenge trade — หลังแพ้ตัวล่าสุด ห้ามเทรดทิศเดียวกันใน X นาที
const COOLDOWN_AFTER_LOSS_MIN = 15;
function isInCooldown(direction) {
    const lastLoss = [...trades].reverse().find(t => t.status === 'LOSS' && t.type === direction);
    if (!lastLoss) return false;
    const ageSec = Date.now()/1000 - lastLoss.time;
    return ageSec < COOLDOWN_AFTER_LOSS_MIN * 60;
}

function checkSignals() {
    if(candleData.length < 50 || !lastDemand || !lastSupply) return;

    // ประเมินแท่งปิดล่าสุดเท่านั้น (No Repaint)
    // candleData[length-1] = แท่งที่เพิ่งปิด (เพราะ checkSignals ถูกเรียกที่ bar boundary
    //   ก่อนสร้างแท่งใหม่) — ไม่ใช่ length-2 (นั้นคือแท่งที่ปิดไป 1 รอบแล้ว ห่างเกินไป)
    const closedCandle = candleData[candleData.length-1];
    const prevClosedCandle = candleData[candleData.length-2];

    // --- Cemented Candle (ตาม SMC PDF) ---
    // BUY: ปิดเหนือ High ของแท่งก่อนหน้า
    const isBullishCemented = closedCandle.close > prevClosedCandle.high;
    // SELL: ปิดต่ำกว่า Low ของแท่งก่อนหน้า
    const isBearishCemented = closedCandle.close < prevClosedCandle.low;

    // --- Premium / Discount Filter ---
    // BUY เฉพาะใน Discount Zone (ต่ำกว่า EQ 50%), SELL เฉพาะใน Premium Zone
    const inDiscountZone = equilibriumLevel === null || closedCandle.close < equilibriumLevel;
    const inPremiumZone  = equilibriumLevel === null || closedCandle.close > equilibriumLevel;

    // --- Zone Touch ---
    // ราคา low แตะ Demand OB (ปลายไส้ลงมาถึงโซน)
    const inDemandZone = closedCandle.low <= lastDemand.top && closedCandle.low >= lastDemand.bottom * 0.999;
    // ราคา high แตะ Supply OB
    const inSupplyZone = closedCandle.high >= lastSupply.bottom && closedCandle.high <= lastSupply.top * 1.001;

    // 🛡️ Block INVALID structure (pullback > 100% = ไม่ใช่ correction ปกติ)
    if (structureQuality === 'INVALID') {
        return;
    }

    // 🛡️ EMA50 Trend Filter — ห้ามเทรด counter-trend กับ EMA50
    //   BUY ต้องการ price > EMA50 (หรือ EMA50 ไม่พร้อม)
    //   SELL ต้องการ price < EMA50
    const ema50 = lastEmaValues.ema50;
    const livePrice = candleData[candleData.length-1].close;

    // --- BUY Signal ---
    // 🛠️ Bug fix: ใช้ currentTrend เท่านั้น — เอา .includes('CHoCH') ออก
    //    เพราะ CHoCH ขาขึ้นจะติด BUY แต่ CHoCH ขาลงไม่ควรติด BUY
    //    (และเดิม CHoCH ขาขึ้นจะติด SELL ด้วยเพราะ includes match — บั๊กใหญ่)
    if (currentTrend === 'BULLISH' &&
        inDemandZone && isBullishCemented && inDiscountZone) {

        // 🛡️ Cooldown after recent loss
        if (isInCooldown('BUY')) {
            console.warn(`⛔ BUY blocked: in cooldown (${COOLDOWN_AFTER_LOSS_MIN} min after last loss)`);
            return;
        }

        // ⛔ EMA filter
        if (ema50 !== null && livePrice < ema50) {
            console.warn(`⛔ BUY blocked: price ${livePrice.toFixed(2)} < EMA50 ${ema50.toFixed(2)}`);
            return;
        }

        const hasInducement = detectInducement('BUY');
        const inducementTag = hasInducement ? ' + Inducement ✅' : '';
        const pdInfo = equilibriumLevel ? ` | EQ: ${equilibriumLevel.toFixed(2)}` : '';

        // 🎯 STO Confluence — ต้อง CONFIRM/STRONG_CONFIRM เท่านั้น
        const sto = getStoConfluence('BUY');
        if (sto.rating === 'CONTRA' || sto.rating === 'WARNING') {
            console.warn(`⛔ BUY blocked: STO ${sto.rating}${sto.tag}`);
            return;
        }
        // NEUTRAL ผ่านได้แต่ flag ว่า MINOR
        const stoActiveConfirm = (sto.rating === 'CONFIRM' || sto.rating === 'STRONG_CONFIRM');

        let signalLabel, baseQuality;
        if (structureQuality === 'MAJOR' && stoActiveConfirm) {
            signalLabel = `🔥 MBOS + ROF (${structurePullbackPct}%) + Demand OB${pdInfo}${inducementTag}${sto.tag}`;
            baseQuality = 'MAJOR';
        } else if (structureQuality === 'MAJOR') {
            // MAJOR แต่ STO neutral → MINOR
            signalLabel = `MBOS (${structurePullbackPct}%) + Demand OB${pdInfo}${inducementTag}${sto.tag}`;
            baseQuality = 'MINOR';
        } else if (stoActiveConfirm) {
            // MINOR + STO confirm → ยังพอ
            signalLabel = `mBOS (${structurePullbackPct}%) + Demand OB${pdInfo}${inducementTag}${sto.tag}`;
            baseQuality = 'MINOR';
        } else {
            // MINOR + STO neutral → ข้าม (คุณภาพต่ำ)
            console.warn(`⛔ BUY blocked: MINOR structure + STO neutral — quality too low`);
            return;
        }
        const finalQuality = applyStoQualityBoost(baseQuality, sto.qualityBoost);

        triggerSignal('BUY', closedCandle, signalLabel, finalQuality);
        return;
    }

    // --- SELL Signal ---
    if (currentTrend === 'BEARISH' &&
        inSupplyZone && isBearishCemented && inPremiumZone) {

        // 🛡️ Cooldown after recent loss
        if (isInCooldown('SELL')) {
            console.warn(`⛔ SELL blocked: in cooldown (${COOLDOWN_AFTER_LOSS_MIN} min after last loss)`);
            return;
        }

        // ⛔ EMA filter
        if (ema50 !== null && livePrice > ema50) {
            console.warn(`⛔ SELL blocked: price ${livePrice.toFixed(2)} > EMA50 ${ema50.toFixed(2)}`);
            return;
        }

        const hasInducement = detectInducement('SELL');
        const inducementTag = hasInducement ? ' + Inducement ✅' : '';
        const pdInfo = equilibriumLevel ? ` | EQ: ${equilibriumLevel.toFixed(2)}` : '';

        const sto = getStoConfluence('SELL');
        if (sto.rating === 'CONTRA' || sto.rating === 'WARNING') {
            console.warn(`⛔ SELL blocked: STO ${sto.rating}${sto.tag}`);
            return;
        }
        const stoActiveConfirm = (sto.rating === 'CONFIRM' || sto.rating === 'STRONG_CONFIRM');

        let signalLabel, baseQuality;
        if (structureQuality === 'MAJOR' && stoActiveConfirm) {
            signalLabel = `🔥 MBOS + ROF (${structurePullbackPct}%) + Supply OB${pdInfo}${inducementTag}${sto.tag}`;
            baseQuality = 'MAJOR';
        } else if (structureQuality === 'MAJOR') {
            signalLabel = `MBOS (${structurePullbackPct}%) + Supply OB${pdInfo}${inducementTag}${sto.tag}`;
            baseQuality = 'MINOR';
        } else if (stoActiveConfirm) {
            signalLabel = `mBOS (${structurePullbackPct}%) + Supply OB${pdInfo}${inducementTag}${sto.tag}`;
            baseQuality = 'MINOR';
        } else {
            console.warn(`⛔ SELL blocked: MINOR structure + STO neutral — quality too low`);
            return;
        }
        const finalQuality = applyStoQualityBoost(baseQuality, sto.qualityBoost);

        triggerSignal('SELL', closedCandle, signalLabel, finalQuality);
        return;
    }
}

// ── Phase 3: TP อัจฉริยะ — cap ที่ zone ตรงข้าม + ตรวจ RR ขั้นต่ำ ──────────────
const MIN_SL_DISTANCE = 3.00;  // SL ห่างขั้นต่ำ $3 (XAUUSD noise + spread)
const TP_ZONE_BUFFER  = 0.30;  // เผื่อระยะก่อนถึง zone (ราคามักกลับก่อนแตะ zone เป๊ะ)
const MIN_RR          = 1.5;   // RR ขั้นต่ำ — ต่ำกว่านี้ reward ไม่คุ้ม risk → ข้ามไม้

/**
 * คำนวณ entry/sl/tp/rr ตามหลัก SMC + TP cap ที่ zone ตรงข้าม
 * @returns {{entry,sl,tp,rr,tpCapped:boolean}}
 *   BUY : SL ใต้ swing low ของ Demand, TP = min(2R, ใต้ Supply zone)
 *   SELL: SL เหนือ swing high ของ Supply, TP = max(2R, เหนือ Demand zone)
 */
function computeTradeLevels(type, entry) {
    let sl, tp, tpCapped = false;
    if (type === 'BUY') {
        const swingLow = lastDemand.swingLow !== undefined ? lastDemand.swingLow : lastDemand.bottom;
        sl = Math.min(swingLow, lastDemand.bottom) - 0.50;
        if ((entry - sl) < MIN_SL_DISTANCE) sl = entry - MIN_SL_DISTANCE;
        const slDist = entry - sl;
        tp = entry + slDist * 2;  // baseline 2R
        // cap ที่ Supply zone ด้านบน — เฉพาะเมื่อ cap แล้วยังได้ RR ≥ MIN_RR
        //   ถ้า zone ใกล้จน RR < 1.5 → ไม่ cap ใช้ 2R เต็ม (ไม่ข้ามสัญญาณ)
        if (lastSupply && lastSupply.bottom > entry) {
            const zoneTarget = lastSupply.bottom - TP_ZONE_BUFFER;
            if (zoneTarget > entry && zoneTarget < tp && (zoneTarget - entry) / slDist >= MIN_RR) {
                tp = zoneTarget; tpCapped = true;
            }
        }
        sl = parseFloat(sl.toFixed(2)); tp = parseFloat(tp.toFixed(2));
        return { entry, sl, tp, rr: (tp - entry) / slDist, tpCapped };
    } else {
        const swingHigh = lastSupply.swingHigh !== undefined ? lastSupply.swingHigh : lastSupply.top;
        sl = Math.max(swingHigh, lastSupply.top) + 0.50;
        if ((sl - entry) < MIN_SL_DISTANCE) sl = entry + MIN_SL_DISTANCE;
        const slDist = sl - entry;
        tp = entry - slDist * 2;
        // cap ที่ Demand zone ด้านล่าง — เฉพาะเมื่อ cap แล้วยังได้ RR ≥ MIN_RR
        if (lastDemand && lastDemand.top < entry) {
            const zoneTarget = lastDemand.top + TP_ZONE_BUFFER;
            if (zoneTarget < entry && zoneTarget > tp && (entry - zoneTarget) / slDist >= MIN_RR) {
                tp = zoneTarget; tpCapped = true;
            }
        }
        sl = parseFloat(sl.toFixed(2)); tp = parseFloat(tp.toFixed(2));
        return { entry, sl, tp, rr: (entry - tp) / slDist, tpCapped };
    }
}

async function triggerSignal(type, candle, reason, quality = 'MINOR') {
    if(lastSignalTime === candle.time) return;

    // ── คำนวณระดับราคาก่อน + ตรวจ RR ก่อนทำอย่างอื่น (จะได้ข้ามไม้คุณภาพต่ำเงียบๆ) ──
    const livePrice = (candleData.length > 0) ? candleData[candleData.length-1].close : candle.close;
    const lv = computeTradeLevels(type, livePrice);
    const { entry, sl, tp, rr, tpCapped } = lv;

    // TP อัจฉริยะ: cap ที่ zone เฉพาะเมื่อยังได้ RR ดี (คำนวณใน computeTradeLevels แล้ว)
    //   ไม่ข้ามสัญญาณอีกต่อไป — ทุกสัญญาณ SMC ที่ผ่าน filter จะแสดงลูกศร + ช่อง + P&L
    if (tpCapped) reason += ` | TP capped @ ${type === 'BUY' ? 'Supply' : 'Demand'} (RR ${rr.toFixed(1)})`;

    // 🔬 Backtest: บันทึกสัญญาณแล้วออก — ไม่ยิง DOM/Telegram/trade/sound
    if (_backtestMode) {
        _backtestSignals.push({ time: candle.time, type, entry, sl, tp, quality, strategy: 'SMC', reason });
        return;
    }

    lastSignalTime = candle.time;

    const qualityLabel =
        quality === 'PREMIUM' ? `💎 ${type} PREMIUM` :
        quality === 'MAJOR'   ? `🔥 ${type} MAJOR` :
                                `${type}`;
    elSignalOverlay.textContent = `${qualityLabel} NOW!`;
    elSignalOverlay.className = `signal-overlay ${type.toLowerCase()}`;
    setTimeout(() => { elSignalOverlay.style.display = 'none'; }, 10000); // Hide after 10s

    // Play Audio Alert
    try {
        alertSound.currentTime = 0;
        alertSound.play();
    } catch(e) {}

    // Update Dashboard UI
    elSignalCard.className = `signal-card ${type.toLowerCase()}`;
    elSignalType.textContent = `${type} SIGNAL DETECTED`;
    elSignalDesc.textContent = `เหตุผล: ${reason}`;

    elSigEntry.textContent = entry.toFixed(2);
    elSigTp.textContent = tp.toFixed(2);
    elSigSl.textContent = sl.toFixed(2);

    // Save trade to history
    const signalId = Date.now();
    let bridgeSent = null; // null = ปิด, true = ส่งสำเร็จ, false = ส่งไม่สำเร็จ
    if (!trades.some(t => t.time === candle.time)) {
        trades.push({
            id: signalId,
            time: candle.time,
            type: type,
            entry: entry,
            sl: sl,
            tp: tp,
            status: 'OPEN',
            reason: reason,
            quality: quality,      // PREMIUM / MAJOR / MINOR
            strategy: 'SMC',       // เครื่องยนต์ที่ให้สัญญาณ
        });
        saveTrades();
        refreshMarkers();
        // อัปเดตช่อง "สัญญาณซื้อขายล่าสุด" + P&L สด ให้ตรงสัญญาณใหม่ทันที
        refreshSignalCard();
        updateOpenTradePnL(entry);

        // Push to MT5 Bot Bridge (gold-trading-bot dashboard will pre-fill manual form)
        const signalPayload = {
            id: signalId, type, entry, sl, tp, quality, reason, time: candle.time,
        };
        _lastSignalForResend = signalPayload;
        if (mt5BridgeEnabled) {
            try {
                await pushSignalToMT5Bot(signalPayload);
                bridgeSent = true;
            } catch(e) {
                bridgeSent = false;
            }
        }
    }

    // 🔔 แสดง modal สัญญาณเทรด (ครบทุกรายละเอียด + สถานะ Bridge)
    showSignalModal({
        type, quality, entry, sl, tp, reason,
        bridgeEnabled: mt5BridgeEnabled,
        bridgeSent,
    });

    // Telegram notification (rr มาจาก computeTradeLevels ด้านบนแล้ว)
    const emoji = type === 'BUY' ? '🟢📈' : '🔴📉';
    const qualityBadge =
        quality === 'PREMIUM' ? '💎 PREMIUM (SMC + STO Strong Confluence)' :
        quality === 'MAJOR'   ? '🔥 MAJOR (MBOS+ROF)' :
                                '📊 MINOR (mBOS)';
    const divInfo  = detectDivergence(candleData);
    const divLine  = divInfo ? `\nDiv     : <b>${divInfo.label}</b>` : '';
    const gapInfo  = detectGap(candleData);
    const gapLine  = gapInfo ? `\nGap     : <b>${gapInfo.type} Gap ${gapInfo.direction === 'UP' ? '↑' : '↓'} ${gapInfo.size}$${gapInfo.type === 'EXHAUSTION' ? ' ⚠️' : ''}</b>` : '';
    const tgMsg = `${emoji} <b>GSTA SIGNAL — ${type}</b>
━━━━━━━━━━━━━━━━━━
Signal  : <b>${type}</b>
Quality : <b>${qualityBadge}</b>
Entry   : <b>${entry.toFixed(2)}</b>
TP      : <b>${tp.toFixed(2)}</b>
SL      : <b>${sl.toFixed(2)}</b>
R:R     : 1:${rr.toFixed(1)}${divLine}${gapLine}
━━━━━━━━━━━━━━━━━━
📌 ${reason}
🕐 ${new Date().toLocaleTimeString('th-TH')} ${new Date().toLocaleDateString('th-TH')}`;
    sendTelegram(tgMsg);
}

// =====================================================================
// 🎯 SCALPING ENGINE — BB Mean Reversion + Fibonacci + Key Levels
//    กลยุทธ์สกัลปิ้ง: R:R 1:1, win rate เป้าหมาย 70-80%
//    ทำงานคู่ขนานกับ SMC Engine (ไม่แทนที่)
// =====================================================================

// --- Bollinger Bands (period=20, mult=2.0) ---
function calculateBollingerBands(candles, period = 20, mult = 2.0) {
    if (!candles || candles.length < period) return null;
    const closes = candles.slice(-period).map(c => c.close);
    const mean   = closes.reduce((a, b) => a + b, 0) / period;
    const std    = Math.sqrt(closes.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    return { upper: mean + mult * std, middle: mean, lower: mean - mult * std, std };
}

// --- Fibonacci Retracement จาก swing high/low ล่าสุด ---
function calculateFibLevels(high, low) {
    const range = high - low;
    return {
        high, low, range,
        r236: high - range * 0.236,
        r382: high - range * 0.382,
        r500: high - range * 0.500,
        r618: high - range * 0.618,
        r786: high - range * 0.786,
    };
}

// --- Key Level Detection (EA Zone style — cluster pivot ≥2 touches) ---
function detectKeyLevels(candles, clusterDollar = 2.0, minTouches = 2) {
    if (!candles || candles.length < 30) return [];
    const pivots = [];
    const lb = 3;
    for (let i = lb; i < candles.length - lb; i++) {
        let isH = true, isL = true;
        for (let j = 1; j <= lb; j++) {
            if (candles[i - j].high >= candles[i].high) isH = false;
            if (candles[i + j].high >  candles[i].high) isH = false;
            if (candles[i - j].low  <= candles[i].low)  isL = false;
            if (candles[i + j].low  <  candles[i].low)  isL = false;
        }
        if (isH) pivots.push(candles[i].high);
        if (isL) pivots.push(candles[i].low);
    }
    const used = new Array(pivots.length).fill(false);
    const levels = [];
    for (let i = 0; i < pivots.length; i++) {
        if (used[i]) continue;
        const cluster = [pivots[i]];
        for (let j = i + 1; j < pivots.length; j++) {
            if (!used[j] && Math.abs(pivots[j] - pivots[i]) <= clusterDollar) {
                cluster.push(pivots[j]);
                used[j] = true;
            }
        }
        used[i] = true;
        if (cluster.length >= minTouches) {
            levels.push({
                price: cluster.reduce((a, b) => a + b, 0) / cluster.length,
                touches: cluster.length,
            });
        }
    }
    return levels.sort((a, b) => b.touches - a.touches).slice(0, 8);
}

let lastKeyLevels = [];
let lastBbData    = null;
let lastScalpSignalTime = 0;
const SCALP_COOLDOWN_SEC = 120; // 2 นาที cooldown ระหว่าง scalp signal

// --- Scalping Signal Checker — เรียกทุก bar close ---
function checkScalpSignals() {
    if (candleData.length < 30 || !lastStoData || lastStoData.length < 3) return;

    const nowSec = Date.now() / 1000;
    if (nowSec - lastScalpSignalTime < SCALP_COOLDOWN_SEC) return;

    const closed = candleData[candleData.length - 1];
    const prev   = candleData[candleData.length - 2];
    const price  = closed.close;

    const bb = calculateBollingerBands(candleData, 20, 2.0);
    lastBbData = bb;
    if (!bb) return;

    const stoLast = lastStoData[lastStoData.length - 1];
    if (stoLast.k === null || stoLast.d === null) return;
    const kUp   = stoLast.k > stoLast.d;
    const kDown = stoLast.k < stoLast.d;

    // ── กลยุทธ์ A: BB Mean Reversion ──────────────────────────────────
    // BUY:  แท่งก่อนปิดใต้ Lower Band → แท่งปัจจุบันปิดกลับเข้ามา + STO %K ขึ้น
    // SELL: แท่งก่อนปิดเหนือ Upper Band → แท่งปัจจุบันปิดกลับเข้ามา + STO %K ลง
    const bbBuy  = prev.close < bb.lower  && closed.close >= bb.lower  && kUp;
    const bbSell = prev.close > bb.upper  && closed.close <= bb.upper  && kDown;

    // ── กลยุทธ์ B: Fibonacci Retracement + EMA21 Confluence ───────────
    let fibBuy = false, fibSell = false;
    if (swings.highs.length > 0 && swings.lows.length > 0) {
        const swH = swings.highs[swings.highs.length - 1].price;
        const swL = swings.lows[swings.lows.length - 1].price;
        const fib = calculateFibLevels(swH, swL);
        const ema21 = lastEmaValues.ema21;
        const tol   = Math.max(bb.std * 0.4, 0.80); // tolerance ≥ $0.80

        if (ema21 !== null && currentTrend === 'BULLISH') {
            // BUY: ราคาย่อมาแตะ Fib 61.8% หรือ 50% และใกล้ EMA21
            const atFib = Math.abs(price - fib.r618) <= tol || Math.abs(price - fib.r500) <= tol;
            const atEma = Math.abs(price - ema21) <= tol * 2;
            fibBuy = atFib && atEma && kUp && stoLast.k < 65;
        }
        if (ema21 !== null && currentTrend === 'BEARISH') {
            // SELL: ราคาเด้งมาแตะ Fib 38.2% หรือ 50% และใกล้ EMA21
            const atFib = Math.abs(price - fib.r382) <= tol || Math.abs(price - fib.r500) <= tol;
            const atEma = Math.abs(price - ema21) <= tol * 2;
            fibSell = atFib && atEma && kDown && stoLast.k > 35;
        }
    }

    // ── กลยุทธ์ C: Key Level Rejection (Pin Bar) ──────────────────────
    let keyBuy = false, keySell = false;
    if (lastKeyLevels.length > 0) {
        const bodySize  = Math.abs(closed.close - closed.open);
        const bodyMin   = Math.max(bodySize, 0.20); // ป้องกัน doji เป็น false signal
        const lowerWick = Math.min(closed.open, closed.close) - closed.low;
        const upperWick = closed.high - Math.max(closed.open, closed.close);
        const isPinBull = lowerWick >= bodyMin * 1.5 && closed.close > closed.open;
        const isPinBear = upperWick >= bodyMin * 1.5 && closed.close < closed.open;

        for (const kl of lastKeyLevels) {
            const nearLevel = Math.abs(price - kl.price) <= 1.50; // $1.50 tolerance
            if (!nearLevel) continue;
            if (isPinBull && price <= kl.price) keyBuy  = keyBuy  || kUp;
            if (isPinBear && price >= kl.price) keySell = keySell || kDown;
        }
    }

    // ── ประเมินผล: นับกี่ strategy ยืนยัน ─────────────────────────────
    const buyCount  = [bbBuy,  fibBuy,  keyBuy ].filter(Boolean).length;
    const sellCount = [bbSell, fibSell, keySell].filter(Boolean).length;

    // ต้องมีอย่างน้อย 1 strategy ยืนยัน และ BUY/SELL ไม่ขัดกัน
    if (buyCount > 0 && sellCount === 0) {
        const strats = [bbBuy ? 'BB Reversion' : null, fibBuy ? 'Fib 61.8%/50%' : null, keyBuy ? 'Key Level Reject' : null].filter(Boolean);
        const quality = buyCount >= 2 ? 'MAJOR' : 'MINOR';
        lastScalpSignalTime = nowSec;
        triggerScalpSignal('BUY', closed, `🎯 SCALP BUY — ${strats.join(' + ')}`, quality);
    } else if (sellCount > 0 && buyCount === 0) {
        const strats = [bbSell ? 'BB Reversion' : null, fibSell ? 'Fib 38.2%/50%' : null, keySell ? 'Key Level Reject' : null].filter(Boolean);
        const quality = sellCount >= 2 ? 'MAJOR' : 'MINOR';
        lastScalpSignalTime = nowSec;
        triggerScalpSignal('SELL', closed, `🎯 SCALP SELL — ${strats.join(' + ')}`, quality);
    }
}

// --- Scalping Signal Trigger — R:R 1:1, SL ใช้ BB std เป็นฐาน ---
async function triggerScalpSignal(type, candle, reason, quality) {
    const livePrice = candleData[candleData.length - 1].close;
    const entry = livePrice;

    // SL = 1.5× std ของ BB หรืออย่างน้อย $2
    const slDist = lastBbData ? Math.max(lastBbData.std * 1.5, 2.0) : 2.0;
    const tpDist = slDist; // R:R 1:1

    const sl = type === 'BUY' ? parseFloat((entry - slDist).toFixed(2)) : parseFloat((entry + slDist).toFixed(2));
    const tp = type === 'BUY' ? parseFloat((entry + tpDist).toFixed(2)) : parseFloat((entry - tpDist).toFixed(2));

    // 🔬 Backtest: บันทึกสัญญาณแล้วออก
    if (_backtestMode) {
        _backtestSignals.push({ time: candle.time, type, entry, sl, tp, quality: 'SCALP', strategy: 'SCALP', reason });
        return;
    }

    // บันทึก trade
    const signalId = Date.now();
    if (!trades.some(t => Math.abs(t.time - Math.floor(signalId/1000)) < 2 && t.type === type)) {
        trades.push({
            id: signalId,
            time: Math.floor(signalId / 1000),
            type, quality: 'SCALP', strategy: 'SCALP', entry, sl, tp, status: 'OPEN', reason,
        });
        saveTrades();
        refreshMarkers();
        // อัปเดตช่อง "สัญญาณซื้อขายล่าสุด" + P&L สด ให้ตรงสัญญาณใหม่ทันที
        refreshSignalCard();
        updateOpenTradePnL(entry);
    }

    // เล่นเสียงแจ้งเตือน
    try { alertSound.currentTime = 0; alertSound.play(); } catch(e) {}

    // Signal overlay
    elSignalOverlay.textContent = `✂️ SCALP ${type}`;
    elSignalOverlay.className = `signal-overlay ${type.toLowerCase()}`;
    setTimeout(() => { elSignalOverlay.style.display = 'none'; }, 8000);

    // Modal
    showSignalModal({ type, quality: 'SCALP', entry, sl, tp, reason, bridgeEnabled: false, bridgeSent: null });

    // Telegram
    const emoji = type === 'BUY' ? '🟢' : '🔴';
    sendTelegram(`${emoji} <b>SCALP ${type} ✂️</b>
━━━━━━━━━━━━━━━━━━
Entry : <b>${entry.toFixed(2)}</b>   R:R 1:1
SL    : <b>${sl.toFixed(2)}</b>  (-$${slDist.toFixed(2)})
TP    : <b>${tp.toFixed(2)}</b>  (+$${tpDist.toFixed(2)})
━━━━━━━━━━━━━━━━━━
${reason}
🕐 ${new Date().toLocaleTimeString('th-TH')}`);
}

// =====================================================================
// 🔬 BACKTEST REPLAY — ไล่แท่งเทียนในหน่วยความจำผ่าน engine จริง
//   ใช้ทดสอบว่ากลยุทธ์ (หรือการแก้ไข) มี edge จริงไหม ก่อน deploy
//   reuse checkSignals/checkScalpSignals ตัวเดียวกับ live → ไม่มี divergence
// =====================================================================

// จำลองผลของสัญญาณ 1 ตัวกับแท่งในอนาคต (แบบ 1 position ต่อ engine)
//   คืน { status:'WIN'|'LOSS'|'OPEN', exitIndex, rMultiple }
function _simulateSignal(sig, candles, entryIdx) {
    const risk = Math.abs(sig.entry - sig.sl);
    if (!(risk > 0)) return { status: 'OPEN', exitIndex: entryIdx, rMultiple: 0 };
    for (let i = entryIdx + 1; i < candles.length; i++) {
        const c = candles[i];
        if (sig.type === 'BUY') {
            // ถ้าแท่งเดียวแตะทั้ง SL และ TP → ถือว่า SL ก่อน (conservative)
            if (c.low  <= sig.sl) return { status: 'LOSS', exitIndex: i, rMultiple: -(risk + SPREAD_COST) / risk };
            if (c.high >= sig.tp) return { status: 'WIN',  exitIndex: i, rMultiple: (Math.abs(sig.tp - sig.entry) - SPREAD_COST) / risk };
        } else {
            if (c.high >= sig.sl) return { status: 'LOSS', exitIndex: i, rMultiple: -(risk + SPREAD_COST) / risk };
            if (c.low  <= sig.tp) return { status: 'WIN',  exitIndex: i, rMultiple: (Math.abs(sig.tp - sig.entry) - SPREAD_COST) / risk };
        }
    }
    return { status: 'OPEN', exitIndex: candles.length - 1, rMultiple: 0 }; // ยังไม่ปิดจนจบข้อมูล
}

// ประเมินสัญญาณทั้งหมด — แยกตาม engine, จำลอง 1 position ต่อ engine (สมจริง)
function evaluateBacktestSignals(signals, candles) {
    const timeToIdx = new Map();
    candles.forEach((c, i) => timeToIdx.set(c.time, i));
    const closed = [];
    for (const engine of ['SMC', 'SCALP']) {
        const list = signals.filter(s => s.strategy === engine).sort((a, b) => a.time - b.time);
        let busyUntil = -1;
        for (const sig of list) {
            const idx = timeToIdx.get(sig.time);
            if (idx === undefined) continue;
            if (idx <= busyUntil) continue;           // position เดิมยังไม่ปิด → ข้าม (1 ไม้ต่อ engine)
            const res = _simulateSignal(sig, candles, idx);
            if (res.status === 'OPEN') { busyUntil = candles.length; continue; } // เปิดค้างจนจบ ไม่นับผล
            busyUntil = res.exitIndex;
            closed.push({ ...sig, status: res.status, rMultiple: res.rMultiple });
        }
    }
    return closed;
}

function runBacktest() {
    if (!candleData || candleData.length < 100) {
        alert('ข้อมูลไม่พอสำหรับ backtest — ต้องมีอย่างน้อย 100 แท่ง');
        return;
    }
    const btn = document.getElementById('btn-backtest');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังคำนวณ...'; }

    // หน่วงเล็กน้อยให้ปุ่มอัปเดตก่อนลูปหนัก
    setTimeout(() => {
        const t0 = performance.now();
        // ── save live state ──
        const saved = {
            candles: candleData, trades: trades, lastSig: lastSignalTime,
            scalpSig: lastScalpSignalTime, sto: lastStoData, bb: lastBbData,
            ema: { ...lastEmaValues },
        };
        _backtestMode = true;
        _backtestSignals = [];
        trades = [];  // ตัด cooldown ไม่ให้อ้าง live trades

        try {
            const src = saved.candles;
            for (let i = 60; i <= src.length; i++) {
                candleData = src.slice(0, i);
                lastSignalTime = null;
                lastScalpSignalTime = 0;   // reset cooldown (เราคุม 1-ไม้-ต่อ-engine ตอนประเมินแทน)
                lastStoData = calculateStochastic(candleData);
                const e50 = calculateEMAForChart(candleData, 50);
                const e21 = calculateEMAForChart(candleData, 21);
                lastEmaValues.ema50 = e50.length ? e50[e50.length - 1].value : null;
                lastEmaValues.ema21 = e21.length ? e21[e21.length - 1].value : null;
                analyzeMarketStructure();
                checkSignals();
                checkScalpSignals();
            }
        } finally {
            // ── restore live state ──
            candleData = saved.candles; trades = saved.trades;
            lastSignalTime = saved.lastSig; lastScalpSignalTime = saved.scalpSig;
            lastStoData = saved.sto; lastBbData = saved.bb; lastEmaValues = saved.ema;
            _backtestMode = false;
        }

        const results = evaluateBacktestSignals(_backtestSignals, saved.candles);
        analyzeMarketStructure();  // คืน live structure/UI ให้ถูกต้อง

        renderBacktestResults(results, _backtestSignals.length, saved.candles, performance.now() - t0);
        if (btn) { btn.disabled = false; btn.textContent = '🔬 ทดสอบย้อนหลัง (Backtest)'; }
    }, 50);
}

function renderBacktestResults(closed, rawCount, candles, ms) {
    const box = document.getElementById('backtest-results');
    if (!box) return;
    const bStats = computeBucketStats;  // reuse Phase 2

    const barSec  = candles.length > 1 ? (candles[1].time - candles[0].time) : 60;
    const spanTxt = `${candles.length} แท่ง (~${Math.round(candles.length * barSec / 3600)} ชม.)`;

    const overall = bStats(closed);
    const smc   = bStats(closed.filter(t => t.strategy === 'SMC'));
    const scalp = bStats(closed.filter(t => t.strategy === 'SCALP'));

    const row = (label, s, emoji) => s.total === 0 ? '' : `<tr>
        <td style="padding:4px 6px;color:#d1d4dc;">${emoji} ${label}</td>
        <td style="padding:4px 6px;text-align:center;color:#9ca3af;">${s.total}</td>
        <td style="padding:4px 6px;text-align:center;color:${s.winRate>=50?'#26a69a':'#ef5350'};">${s.winRate}%</td>
        <td style="padding:4px 6px;text-align:right;font-weight:700;color:${_rColor(s.expectancy)};">${_fmtR(s.expectancy)}</td>
        <td style="padding:4px 6px;text-align:right;color:${_rColor(s.totalR)};">${_fmtR(s.totalR)}</td></tr>`;

    const verdict = overall.expectancy > 0.05
        ? `<span style="color:#26a69a;">✅ ระบบมี edge เชิงบวก (+${overall.expectancy.toFixed(2)}R/ไม้)</span>`
        : overall.expectancy < -0.05
        ? `<span style="color:#ef5350;">⚠️ ระบบยังติดลบ (${overall.expectancy.toFixed(2)}R/ไม้) — ควรปรับกลยุทธ์</span>`
        : `<span style="color:#f2a900;">➖ ระบบเสมอตัว — edge ไม่ชัด</span>`;

    box.style.display = 'block';
    box.innerHTML = `
        <div style="font-size:0.72rem;color:#6b7280;margin-bottom:6px;">
            📊 ทดสอบบน ${spanTxt} · พบสัญญาณดิบ ${rawCount} · ปิดจริง ${overall.total} ไม้ · ${ms.toFixed(0)}ms
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.72rem;">
            <thead><tr style="color:#6b7280;border-bottom:1px solid #2a2e39;">
                <th style="padding:4px 6px;text-align:left;">เครื่องยนต์</th>
                <th style="padding:4px 6px;text-align:center;">ไม้</th>
                <th style="padding:4px 6px;text-align:center;">ชนะ</th>
                <th style="padding:4px 6px;text-align:right;">คาดหวัง/ไม้</th>
                <th style="padding:4px 6px;text-align:right;">รวม R</th>
            </tr></thead>
            <tbody>
                ${row('รวมทุกเครื่อง', overall, '🎯')}
                ${row('SMC', smc, '📈')}
                ${row('Scalp', scalp, '✂️')}
            </tbody>
        </table>
        <div style="font-size:0.72rem;margin-top:8px;padding:7px;background:#161a25;border-radius:5px;text-align:center;">${verdict}</div>
        <div style="font-size:0.6rem;color:#4b5563;margin-top:6px;line-height:1.5;">
            ⚠️ Backtest ใช้แท่งที่โหลดอยู่ (TF ปัจจุบัน) · จำลอง 1 ไม้/เครื่องยนต์ · หัก spread $${SPREAD_COST} · ไม่รวม cooldown-after-loss · ผลในอดีตไม่รับประกันอนาคต
        </div>`;
}

// =====================================================================
// 🔄 REVERSAL MONITOR — แจ้งเตือนเมื่อ open trade มีสัญญาณกลับตัว
// =====================================================================
const _reversalAlerted = new Set(); // id ของ trade ที่แจ้งไปแล้ว

function monitorReversals() {
    const openTrades = trades.filter(t => t.status === 'OPEN');
    if (openTrades.length === 0) return;

    const bb    = calculateBollingerBands(candleData);
    const price = candleData[candleData.length - 1].close;

    for (const trade of openTrades) {
        if (_reversalAlerted.has(trade.id)) continue;

        let reversalDetected = false;
        let reversalReason   = '';

        if (trade.type === 'BUY') {
            const stoSell     = getStoConfluence('SELL');
            const atResistance = lastSupply && price >= lastSupply.bottom && price <= lastSupply.top * 1.001;
            const bbOverbought = bb && price > bb.upper;
            const trendFlipped = currentTrend === 'BEARISH';

            if (trendFlipped && (stoSell.rating === 'STRONG_CONFIRM' || stoSell.rating === 'CONFIRM')) {
                reversalDetected = true;
                reversalReason = `แนวโน้มกลับเป็น BEARISH + STO Sell ${stoSell.rating}`;
            } else if (atResistance && stoSell.rating === 'STRONG_CONFIRM') {
                reversalDetected = true;
                reversalReason = `ราคาชน Supply Zone + STO Bearish STRONG ✨`;
            } else if (bbOverbought && stoSell.rating === 'CONFIRM') {
                reversalDetected = true;
                reversalReason = `ราคาทะลุ BB Upper + STO Sell Confirm`;
            }
        } else if (trade.type === 'SELL') {
            const stoBuy      = getStoConfluence('BUY');
            const atSupport   = lastDemand && price >= lastDemand.bottom * 0.999 && price <= lastDemand.top;
            const bbOversold  = bb && price < bb.lower;
            const trendFlipped = currentTrend === 'BULLISH';

            if (trendFlipped && (stoBuy.rating === 'STRONG_CONFIRM' || stoBuy.rating === 'CONFIRM')) {
                reversalDetected = true;
                reversalReason = `แนวโน้มกลับเป็น BULLISH + STO Buy ${stoBuy.rating}`;
            } else if (atSupport && stoBuy.rating === 'STRONG_CONFIRM') {
                reversalDetected = true;
                reversalReason = `ราคาแตะ Demand Zone + STO Bullish STRONG ✨`;
            } else if (bbOversold && stoBuy.rating === 'CONFIRM') {
                reversalDetected = true;
                reversalReason = `ราคาทะลุ BB Lower + STO Buy Confirm`;
            }
        }

        if (!reversalDetected) continue;
        _reversalAlerted.add(trade.id);

        const oppDir = trade.type === 'BUY' ? 'SELL' : 'BUY';
        const pnlRaw = trade.type === 'BUY' ? price - trade.entry : trade.entry - price;
        const pnlStr = (pnlRaw >= 0 ? '+' : '') + pnlRaw.toFixed(2);
        const pnlColor = pnlRaw >= 0 ? '#26a69a' : '#ef5350';

        // แสดง banner ใน UI
        const banner = document.getElementById('reversal-banner');
        if (banner) {
            banner.innerHTML = `
                <div style="display:flex;align-items:flex-start;gap:10px;">
                    <span style="font-size:1.4rem;">${trade.type === 'BUY' ? '⚠️🔴' : '⚠️🟢'}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;font-size:0.95rem;">สัญญาณกลับตัว! พิจารณาปิด ${trade.type}</div>
                        <div style="font-size:0.82rem;color:#9ca3af;margin-top:2px;">${trade.type} @ ${trade.entry.toFixed(2)} → ราคาปัจจุบัน <b>${price.toFixed(2)}</b> <span style="color:${pnlColor}">(${pnlStr})</span></div>
                        <div style="font-size:0.8rem;color:#ffd54f;margin-top:3px;">⚡ ${reversalReason}</div>
                    </div>
                    <button onclick="document.getElementById('reversal-banner').style.display='none'" style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:1.1rem;padding:0;flex-shrink:0;">✕</button>
                </div>`;
            banner.style.display = 'block';
            // Auto-hide หลัง 90 วินาที
            setTimeout(() => { if (banner) banner.style.display = 'none'; }, 90000);
        }

        // Telegram alert
        const oppEmoji = oppDir === 'BUY' ? '🟢' : '🔴';
        sendTelegram(`⚠️ <b>สัญญาณกลับตัว!</b>
━━━━━━━━━━━━━━━━━━
ออร์เดอร์เปิดอยู่: <b>${trade.type}</b> @ ${trade.entry.toFixed(2)}
ราคาปัจจุบัน   : <b>${price.toFixed(2)}</b>  P&amp;L: <b>${pnlStr}</b>
━━━━━━━━━━━━━━━━━━
${oppEmoji} สัญญาณ <b>${oppDir}</b> กำลังเกิดขึ้น
📌 ${reversalReason}
━━━━━━━━━━━━━━━━━━
💡 พิจารณาปิด ${trade.type} และรับกำไร/ตัดขาดทุน
🕐 ${new Date().toLocaleTimeString('th-TH')}`);
    }
}
