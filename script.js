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

// Alert Modal Elements
const alertModal = document.getElementById('alert-modal');
const alertTitle = document.getElementById('alert-title');
const alertMessage = document.getElementById('alert-message');
const alertOkBtn = document.getElementById('alert-ok-btn');
const alertSound = document.getElementById('alert-sound');

alertOkBtn.addEventListener('click', () => {
    alertModal.style.display = 'none';
});

let candleData = [];

// =====================================================================
// MT5 Bridge URL — เปลี่ยนเป็น ngrok URL เมื่อต้องการเข้าถึงจาก Vercel
// ตัวอย่าง: "https://abc123.ngrok-free.app"
// หรือปล่อยว่างไว้ "" เพื่อใช้ localhost อย่างเดียว
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
                        console.log(`🔄 ซิงค์ข้อมูลจากเครื่องอื่น: ${trades.length} รายการ`);
                        updateStatsUI();
                        refreshMarkers();
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
    updateStatsUI();
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

function updateStatsUI() {
    const elWinRate = document.getElementById('stat-winrate');
    const elTotal = document.getElementById('stat-total');
    const elWin = document.getElementById('stat-win');
    const elLoss = document.getElementById('stat-loss');
    
    if (!elTotal) return; // UI not found

    let wins = trades.filter(t => t.status === 'WIN').length;
    let losses = trades.filter(t => t.status === 'LOSS').length;
    let total = wins + losses;
    let winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    
    elWinRate.textContent = winRate + '%';
    elTotal.textContent = total;
    elWin.textContent = wins;
    elLoss.textContent = losses;
}

function evaluateTrades(high, low) {
    let changed = false;
    for (let t of trades) {
        if (t.status === 'OPEN') {
            if (t.type === 'BUY') {
                if (low <= t.sl) { t.status = 'LOSS'; changed = true; }
                else if (high >= t.tp) { t.status = 'WIN'; changed = true; }
            } else if (t.type === 'SELL') {
                if (high >= t.sl) { t.status = 'LOSS'; changed = true; }
                else if (low <= t.tp) { t.status = 'WIN'; changed = true; }
            }
        }
    }
    if (changed) {
        saveTrades();
        refreshMarkers();
    }
}

function evaluateAllHistory() {
    // Re-evaluate open trades using historical data
    for (let c of candleData) {
        evaluateTrades(c.high, c.low);
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
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: '#1f2937' },
            horzLines: { color: '#1f2937' },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: (time, tickMarkType, locale) => {
                const date = new Date(time * 1000);
                if (tickMarkType >= 3) {
                    return date.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
                }
                return date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short' });
            }
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
        wickDownColor: '#ef5350'
    });

    // Bollinger Bands Lines
    upperBandSeries = chart.addLineSeries({ color: 'rgba(38, 166, 154, 0.4)', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed });
    middleBandSeries = chart.addLineSeries({ color: 'rgba(255, 165, 0, 0.5)', lineWidth: 1 });
    lowerBandSeries = chart.addLineSeries({ color: 'rgba(239, 83, 80, 0.4)', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed });

    elStatus.textContent = "เชื่อมต่อกราฟ Lightweight Charts (XAUUSD) สำเร็จ!";
    elDot.classList.add('connected');
}

function calculateBollingerBands(data, period = 20, multiplier = 2) {
    let bb = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) continue;
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        let sma = sum / period;
        
        let sumDev = 0;
        for (let j = 0; j < period; j++) {
            sumDev += Math.pow(data[i - j].close - sma, 2);
        }
        let stdDev = Math.sqrt(sumDev / period);
        
        bb.push({
            time: data[i].time,
            middle: sma,
            upper: sma + (multiplier * stdDev),
            lower: sma - (multiplier * stdDev)
        });
    }
    return bb;
}

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

    const bbData = calculateBollingerBands(uniqueData);
    if(bbData.length > 0) {
        upperBandSeries.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
        middleBandSeries.setData(bbData.map(d => ({ time: d.time, value: d.middle })));
        lowerBandSeries.setData(bbData.map(d => ({ time: d.time, value: d.lower })));
    }
    
    // Evaluate loaded history against open trades and render saved markers
    evaluateAllHistory();
    refreshMarkers();
    updateStatsUI();
}

// Ensure TV Widget loads
if (window.LightweightCharts) {
    initTVWidget();
} else {
    setTimeout(initTVWidget, 1000);
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

// 2. Fetch History for Internal Analysis
async function fetchHistory() {
    try {
        // Use Binance PAXG since it natively supports 1m, 3m, 15m, 1h
        const binanceUrl = `https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval=${currentInterval}&limit=1000`;
        const r = await fetch(binanceUrl);
        if (r.ok) {
            const kl = await r.json();
            candleData = kl.map(c => ({
                time: c[0] / 1000,
                open: parseFloat(c[1]),
                high: parseFloat(c[2]),
                low: parseFloat(c[3]),
                close: parseFloat(c[4])
            }));
            updateChartData();
            analyzeMarketStructure();
        } else {
            console.warn("Failed to load historical data from Binance.");
        }
    } catch(err) {
        console.warn("History fetch issue, will rely on live build", err);
    }
}

// 3. Live Price Connection (1:1 Copy from Original Code for Real-time Feel)
let priceSource = '';
function connectLiveFeeds() {
    elStatus.textContent = "กำลังเชื่อมต่อข้อมูลจริง...";
    elDot.classList.add('connected');

    // Priority 0: Firebase RTDB (MT5 push) — ทำงานได้ทุกเครื่อง ไม่ต้องตั้งค่าอะไรเพิ่ม
    if (RTDB_ENABLED && rtdb) {
        rtdb.ref('live_price').on('value', (snap) => {
            const d = snap.val();
            if (!d || !d.price) return;
            const p = parseFloat(d.price);
            const ageMs = Date.now() - new Date(d.timestamp).getTime();
            if (p > 100 && ageMs < 15000) {
                priceSource = 'MT5-Firebase';
                // หยุด REST polling เมื่อ RTDB ทำงานแล้ว — ป้องกันราคากระโดด
                if (restIv) { clearInterval(restIv); restIv = null; }
                elStatus.textContent = `เชื่อมต่อตลาดจริง (MT5 → Firebase ✅)`;
                processLiveTick(p, 'MT5-Firebase');
            }
        }, (err) => {
            console.warn("RTDB listener error:", err);
        });
        console.log("👂 กำลังฟังราคา MT5 จาก Firebase RTDB...");
    }

    const tryMetalsWS = () => {
        try {
            const ws = new WebSocket('wss://metals.live/feed');
            let opened = false;
            ws.onopen = () => { opened = true; };
            ws.onmessage = ev => {
                // ข้ามถ้า RTDB หรือ MT5 Localhost กำลังทำงาน
                if (priceSource === 'MT5-Firebase' || priceSource === 'MT5') return;
                try {
                    const d = JSON.parse(ev.data);
                    const p = parseFloat(d.gold || d.xauusd || d.XAUUSD || 0);
                    if (p > 1000 && priceSource !== 'TradingView') {
                        priceSource = 'metals.live';
                        elStatus.textContent = "เชื่อมต่อตลาดจริง (metals.live XAU Spot)";
                        processLiveTick(p, 'metals.live');
                    }
                } catch(e){}
            };
            ws.onerror = () => { if (!opened) startRest(); };
            ws.onclose = () => { if (!opened) startRest(); };
            setTimeout(() => { if (currentCandle === null) startRest(); }, 5000);
        } catch(e) { startRest(); }
    };

    const fetchSpot = async () => {
        if (priceSource === 'TradingView') return;
        // ข้ามถ้า RTDB กำลังทำงาน — ป้องกันราคากระโดด
        if (priceSource === 'MT5-Firebase') return;

        // Priority 1: MT5 Bridge (ngrok URL ก่อน, แล้ว fallback localhost)
        const mt5Endpoints = [];
        if (MT5_NGROK_URL) mt5Endpoints.push({ url: MT5_NGROK_URL + '/api/price', label: 'MT5 via ngrok 🌐' });
        mt5Endpoints.push({ url: 'http://localhost:8050/api/price', label: 'MT5 Localhost' });

        for (const ep of mt5Endpoints) {
            try {
                const r = await fetch(ep.url, { signal: AbortSignal.timeout(2000) });
                if (r.ok) {
                    const d = await r.json();
                    const p = parseFloat(d.price);
                    if (p > 100) {
                        priceSource = 'MT5';
                        elStatus.textContent = `เชื่อมต่อตลาดจริง (${ep.label} ✅)`;
                        processLiveTick(p, 'MT5');
                        return;
                    }
                }
            } catch(e){}
        }

        // Priority 2: Yahoo Finance
        const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD%3DX?interval=1m&range=1d';
        const proxies = [
            'https://api.allorigins.win/raw?url=' + encodeURIComponent(yahooUrl),
            'https://corsproxy.io/?' + encodeURIComponent(yahooUrl),
            yahooUrl,
        ];
        for (const src of proxies) {
            try {
                const res = await fetch(src, { signal: AbortSignal.timeout(3000) });
                if (!res.ok) continue;
                const j = await res.json();
                const p = j.chart?.result?.[0]?.meta?.regularMarketPrice;
                if (p && p > 100) {
                    priceSource = 'Yahoo';
                    elStatus.textContent = "เชื่อมต่อตลาดจริง (Yahoo XAUUSD=X)";
                    processLiveTick(p, 'Yahoo');
                    return;
                }
            } catch(e){}
        }

        // Priority 3: PAXG Binance
        try {
            const r = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=PAXGUSDT', { signal: AbortSignal.timeout(3000) });
            const d = await r.json();
            const p = parseFloat(d.lastPrice);
            if (p > 100) {
                priceSource = 'PAXG';
                elStatus.textContent = "เชื่อมต่อตลาดจริง (⚠️ PAXG Binance Backup)";
                processLiveTick(p, 'PAXG');
            }
        } catch(e){}
    };

    let restIv = null;
    const startRest = () => {
        if (!restIv) {
            fetchSpot();
            restIv = setInterval(fetchSpot, 1000); // 1-second updates
        }
    };

    tryMetalsWS();
}

let currentCandle = null;
let lastTickSource = '';
function processLiveTick(price, source) {
    if(source) lastTickSource = source;
    
    // Animate the price badge for better visibility
    elPrice.textContent = price.toFixed(2);
    elPrice.style.color = '#f2a900';
    setTimeout(() => { elPrice.style.color = ''; }, 300);
    
    const now = new Date();
    now.setSeconds(0, 0);
    const tickTime = Math.floor(now.getTime() / 1000);

    if (!currentCandle || currentCandle.time !== tickTime) {
        if (currentCandle) {
            analyzeMarketStructure();
            checkSignals();
        }
        currentCandle = { time: tickTime, open: price, high: price, low: price, close: price };
        candleData.push(currentCandle);
    } else {
        currentCandle.high = Math.max(currentCandle.high, price);
        currentCandle.low = Math.min(currentCandle.low, price);
        currentCandle.close = price;
        candleData[candleData.length - 1] = currentCandle;
    }
    
    // Live evaluation of trades
    evaluateTrades(currentCandle.high, currentCandle.low);
    
    // Live update on Lightweight Chart
    if (candleSeries) {
        candleSeries.update(currentCandle);
        // Recalculate last BB values for animation
        const bbData = calculateBollingerBands(candleData);
        if (bbData.length > 0) {
            const lastBB = bbData[bbData.length - 1];
            upperBandSeries.update({ time: lastBB.time, value: lastBB.upper });
            middleBandSeries.update({ time: lastBB.time, value: lastBB.middle });
            lowerBandSeries.update({ time: lastBB.time, value: lastBB.lower });
        }
    }
}

// Ensure TV Widget loads
if (window.TradingView) {
    initTVWidget();
} else {
    setTimeout(initTVWidget, 1000);
}

// Start: load trades first, then init chart data
loadTrades().then(() => {
    fetchHistory();
});
connectLiveFeeds();

// 4. SMC / Price Action Analyzer (Winter Trader & SMC Concepts)
let swings = { highs: [], lows: [] };
let lastDemand = null; // RBR or DBR
let lastSupply = null; // DBD or RBD
let currentTrend = 'NEUTRAL';
let currentSmc = 'WAITING';

function analyzeMarketStructure() {
    if(candleData.length < 50) return;
    
    let leftBars = 3;
    let rightBars = 3;
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
    
    // Identify Demand & Supply Zones using Base Candles (Winter Trader logic)
    // Simplified: Find recent significant pivots and define order blocks
    if(highs.length > 0) {
        let lastHigh = highs[highs.length-1];
        lastSupply = { top: lastHigh.price, bottom: lastHigh.price - (lastHigh.price * 0.0003), type: 'DBD / RBD (Supply Zone)' };
        elSupply.textContent = `${lastSupply.bottom.toFixed(2)} - ${lastSupply.top.toFixed(2)}`;
        
        // Draw Supply Line on chart
        if (candleSeries) {
            if (supplyLine) candleSeries.removePriceLine(supplyLine);
            supplyLine = candleSeries.createPriceLine({ price: lastSupply.bottom, color: '#ef5350', lineWidth: 2, title: 'Supply Zone', lineStyle: LightweightCharts.LineStyle.Solid });
        }
    }
    
    if(lows.length > 0) {
        let lastLow = lows[lows.length-1];
        lastDemand = { top: lastLow.price + (lastLow.price * 0.0003), bottom: lastLow.price, type: 'RBR / DBR (Demand Zone)' };
        elDemand.textContent = `${lastDemand.bottom.toFixed(2)} - ${lastDemand.top.toFixed(2)}`;
        
        // Draw Demand Line on chart
        if (candleSeries) {
            if (demandLine) candleSeries.removePriceLine(demandLine);
            demandLine = candleSeries.createPriceLine({ price: lastDemand.top, color: '#26a69a', lineWidth: 2, title: 'Demand Zone', lineStyle: LightweightCharts.LineStyle.Solid });
        }
    }

    // SMC Structure Analysis: BOS, CHoCH, and Liquidity Grabs
    if(highs.length >= 2 && lows.length >= 2) {
        let h1 = highs[highs.length-2].price;
        let h2 = highs[highs.length-1].price;
        let l1 = lows[lows.length-2].price;
        let l2 = lows[lows.length-1].price;

        // Check for Liquidity Sweep (Inducement)
        let sweptLiquidity = false;
        let sweepText = "";
        if ((l2 < l1 && l2 > l1 * 0.999) || (h2 > h1 && h2 < h1 * 1.001)) {
            sweptLiquidity = true;
            sweepText = " (มีการกวาด Stop Loss รายย่อย)";
        }

        if(h2 > h1 && l2 > l1) { 
            currentTrend = 'BULLISH'; 
            currentSmc = `ทำยอด High ใหม่ (BOS ขาขึ้น) - แรงซื้อยังแข็งแกร่ง${sweepText}`; 
        } 
        else if (h2 < h1 && l2 < l1) { 
            currentTrend = 'BEARISH'; 
            currentSmc = `ทำจุด Low ใหม่ (BOS ขาลง) - แรงขายยังแข็งแกร่ง${sweepText}`; 
        } 
        else if (h2 > h1 && l2 < l1) { 
            currentTrend = 'BULLISH'; 
            currentSmc = `เสียทรงขาลง (CHoCH) - กราฟเริ่มกลับตัวเป็นขาขึ้น${sweepText}`; 
        } 
        else if (h2 < h1 && l2 > l1) { 
            currentTrend = 'BEARISH'; 
            currentSmc = `เสียทรงขาขึ้น (CHoCH) - กราฟเริ่มกลับตัวเป็นขาลง${sweepText}`; 
        }
    }

    elTrend.textContent = currentTrend === 'BULLISH' ? 'ขาขึ้น (BULLISH)' : currentTrend === 'BEARISH' ? 'ขาลง (BEARISH)' : 'รอดูลาดเลา (NEUTRAL)';
    elTrend.className = `badge ${currentTrend === 'BULLISH' ? 'bullish' : currentTrend === 'BEARISH' ? 'bearish' : 'neutral'}`;
    
    // Add nice HTML formatting for SMC text
    elSmc.innerHTML = `<span style="font-size: 0.95rem; line-height: 1.4; display: block; margin-top: 5px;">${currentSmc}</span>`;
}

// 5. Signal Generation Logic (Confluence of SMC + D&S)
let lastSignalTime = null;

function checkSignals() {
    if(candleData.length < 50 || !lastDemand || !lastSupply) return;
    
    const lastCandle = candleData[candleData.length-1];
    const prevCandle = candleData[candleData.length-2];
    const prevPrevCandle = candleData[candleData.length-3];
    
    // Bullish Reversal pattern (Engulfing or Pinbar) inside Demand Zone
    const isBullishEngulfing = prevCandle.close < prevCandle.open && lastCandle.close > lastCandle.open && lastCandle.close > prevCandle.open && lastCandle.open < prevCandle.close;
    const isBullishPinbar = (lastCandle.open - lastCandle.low) / (lastCandle.high - lastCandle.low) > 0.6 && lastCandle.close > lastCandle.open;
    
    // Price taps the Demand Order Block
    const inDemandZone = lastCandle.low <= lastDemand.top && lastCandle.low >= lastDemand.bottom;

    if ((currentTrend === 'BULLISH' || currentSmc.includes('CHoCH')) && inDemandZone && (isBullishEngulfing || isBullishPinbar)) {
        triggerSignal('BUY', lastCandle, 'RBR/DBR (Demand) + CHoCH + Bullish Reversal');
        return;
    }

    // Bearish Reversal pattern inside Supply Zone
    const isBearishEngulfing = prevCandle.close > prevCandle.open && lastCandle.close < lastCandle.open && lastCandle.close < prevCandle.open && lastCandle.open > prevCandle.close;
    const isBearishPinbar = (lastCandle.high - lastCandle.open) / (lastCandle.high - lastCandle.low) > 0.6 && lastCandle.close < lastCandle.open;
    
    // Price taps the Supply Order Block
    const inSupplyZone = lastCandle.high >= lastSupply.bottom && lastCandle.high <= lastSupply.top;

    if ((currentTrend === 'BEARISH' || currentSmc.includes('CHoCH')) && inSupplyZone && (isBearishEngulfing || isBearishPinbar)) {
        triggerSignal('SELL', lastCandle, 'RBD/DBD (Supply) + CHoCH + Bearish Reversal');
        return;
    }
}

function triggerSignal(type, candle, reason) {
    if(lastSignalTime === candle.time) return;
    lastSignalTime = candle.time;

    // Show massive overlay on top of the chart!
    elSignalOverlay.textContent = `${type} NOW!`;
    elSignalOverlay.className = `signal-overlay ${type.toLowerCase()}`;
    setTimeout(() => { elSignalOverlay.style.display = 'none'; }, 10000); // Hide after 10s

    // Play Audio Alert
    try {
        alertSound.currentTime = 0;
        alertSound.play();
    } catch(e) {}

    // Show Popup Modal
    alertTitle.textContent = `🚨 สัญญาณ ${type} มาแล้ว!`;
    alertMessage.textContent = `ราคา: ${candle.close.toFixed(2)}\nเหตุผล: ${reason}`;
    document.querySelector('.modal-icon').textContent = type === 'BUY' ? '🟢' : '🔴';
    alertModal.style.display = 'flex';

    // Update Dashboard UI
    elSignalCard.className = `signal-card ${type.toLowerCase()}`;
    elSignalType.textContent = `${type} SIGNAL DETECTED`;
    
    const entry = candle.close;
    let sl, tp;

    if(type === 'BUY') {
        sl = lastDemand.bottom * 0.9995;
        tp = entry + ((entry - sl) * 2); 
        elSignalDesc.textContent = `เหตุผล: ${reason} (วาดคลื่น Elliott จบขาลง)`;
    } else {
        sl = lastSupply.top * 1.0005;
        tp = entry - ((sl - entry) * 2);
        elSignalDesc.textContent = `เหตุผล: ${reason} (วาดคลื่น Elliott จบขาขึ้น)`;
    }

    elSigEntry.textContent = entry.toFixed(2);
    elSigTp.textContent = tp.toFixed(2);
    elSigSl.textContent = sl.toFixed(2);

    // Save trade to history
    if (!trades.some(t => t.time === candle.time)) {
        trades.push({
            id: Date.now(),
            time: candle.time,
            type: type,
            entry: entry,
            sl: sl,
            tp: tp,
            status: 'OPEN',
            reason: reason
        });
        saveTrades();
        refreshMarkers();
    }
}
