from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import datetime
import threading
import time

# ใช้ requests สำหรับ push ไป Firebase (ถ้าไม่มีให้รัน: pip install requests)
try:
    import requests as req_lib
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("⚠️  ไม่พบ 'requests' library — ติดตั้งด้วย: pip install requests")

# =====================================================================
# ตั้งค่าครั้งเดียว — ใช้งานได้ตลอด ไม่ต้องแตะอีก
# =====================================================================

# Firebase Realtime Database URL
# วิธีหา: Firebase Console → Realtime Database → ดู URL ด้านบน
# เช่น: "https://my-project-default-rtdb.asia-southeast1.firebasedatabase.app"
FIREBASE_RTDB_URL = "https://gsta-gold-trading-default-rtdb.asia-southeast1.firebasedatabase.app"

# Database Secret (ถ้า RTDB อยู่ใน test mode ปล่อยว่างไว้ได้)
# วิธีหา: Firebase Console → Project Settings → Service accounts → Database secrets
FIREBASE_RTDB_SECRET = ""

# ความถี่ในการ push ราคาขึ้น Firebase (วินาที)
PUSH_INTERVAL = 2

# =====================================================================


# --- ลองโหลด MetaTrader5 (Windows only) ---
try:
    import MetaTrader5 as _mt5_lib
    _mt5_available = True
except ImportError:
    _mt5_lib = None
    _mt5_available = False

_mt5_initialized = False
_price_source_label = "unknown"


def _price_from_mt5():
    """ดึงราคาจาก MT5 Python API (Windows เท่านั้น)"""
    global _mt5_initialized
    try:
        if not _mt5_initialized:
            if not _mt5_lib.initialize():
                return None
            _mt5_initialized = True
        tick = _mt5_lib.symbol_info_tick("XAUUSD")
        return round(tick.ask, 2) if tick else None
    except Exception:
        _mt5_initialized = False
        return None


def _price_from_local_bridge():
    """ดึงราคาจาก MT5 bridge ที่รันอยู่แล้วบน localhost:8050"""
    if not HAS_REQUESTS:
        return None
    try:
        r = req_lib.get('http://localhost:8050/api/price', timeout=2)
        if r.status_code == 200:
            data = r.json()
            p = float(data.get('ask') or data.get('price') or 0)
            return round(p, 2) if p > 100 else None
    except Exception:
        pass
    return None


def _price_from_yahoo():
    """ดึง XAUUSD จาก Yahoo Finance"""
    if not HAS_REQUESTS:
        return None
    try:
        url = 'https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD%3DX?interval=1m&range=1d'
        r = req_lib.get(url, timeout=4, headers={'User-Agent': 'Mozilla/5.0'})
        if r.status_code == 200:
            meta = r.json()['chart']['result'][0]['meta']
            return round(float(meta['regularMarketPrice']), 2)
    except Exception:
        pass
    return None


def _price_from_binance():
    """ดึง PAXG/USDT จาก Binance (gold proxy)"""
    if not HAS_REQUESTS:
        return None
    try:
        r = req_lib.get('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT', timeout=3)
        if r.status_code == 200:
            return round(float(r.json()['price']), 2)
    except Exception:
        pass
    return None


def get_mt5_price():
    global _price_source_label

    # Priority 1: MT5 Python (Windows)
    if _mt5_available:
        p = _price_from_mt5()
        if p:
            _price_source_label = "MT5"
            return p

    # Priority 2: Local MT5 bridge (dashboard.py หรือ server อื่นที่รันบน port 8050)
    p = _price_from_local_bridge()
    if p:
        _price_source_label = "LocalBridge-MT5"
        return p

    # Priority 3: Yahoo Finance XAUUSD
    p = _price_from_yahoo()
    if p:
        _price_source_label = "Yahoo-XAUUSD"
        return p

    # Priority 4: Binance PAXG
    p = _price_from_binance()
    if p:
        _price_source_label = "Binance-PAXG"
        return p

    return None


# --- Push ราคาขึ้น Firebase RTDB ---
def push_price_to_firebase(price):
    if not FIREBASE_RTDB_URL or not HAS_REQUESTS:
        return False

    url = FIREBASE_RTDB_URL.rstrip('/') + "/live_price.json"
    if FIREBASE_RTDB_SECRET:
        url += f"?auth={FIREBASE_RTDB_SECRET}"

    payload = {
        "price": price,
        "symbol": "XAUUSD",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "source": "MT5"
    }

    try:
        r = req_lib.put(url, json=payload, timeout=3)
        return r.status_code == 200
    except Exception as e:
        print(f"  Firebase push error: {e}")
        return False


# --- Background thread: push ราคาทุก N วินาที ---
def price_push_loop():
    print(f"🚀 เริ่ม push ราคาไป Firebase ทุก {PUSH_INTERVAL} วินาที...")
    fail_count = 0
    while True:
        price = get_mt5_price()
        if price:
            ok = push_price_to_firebase(price)
            if ok:
                fail_count = 0
                print(f"  📤 Push XAUUSD = {price:.2f}  [{datetime.datetime.now().strftime('%H:%M:%S')}]  src={_price_source_label}")
            else:
                fail_count += 1
                if fail_count <= 3:
                    print(f"  ❌ Push ล้มเหลว (ครั้งที่ {fail_count})")
        time.sleep(PUSH_INTERVAL)


# --- HTTP Server (สำหรับ local / fallback) ---
class MT5Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # ปิด log รก

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/price':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            price = get_mt5_price()
            response = {
                "symbol": "XAUUSD",
                "price": price,
                "timestamp": datetime.datetime.now().isoformat(),
                "status": "connected"
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))

        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "firebase": bool(FIREBASE_RTDB_URL)}).encode())
        else:
            self.send_response(404)
            self.end_headers()


def run(port=8051):
    server_address = ('', port)
    httpd = HTTPServer(server_address, MT5Handler)
    print(f"🌐 HTTP server รันบน port {port}  →  http://localhost:{port}/api/price")
    httpd.serve_forever()


if __name__ == '__main__':
    print("=" * 55)
    print("  GSTA MT5 Bridge Server")
    print("=" * 55)

    if FIREBASE_RTDB_URL:
        print(f"✅ Firebase RTDB: {FIREBASE_RTDB_URL}")
        # เริ่ม push thread
        t = threading.Thread(target=price_push_loop, daemon=True)
        t.start()
    else:
        print("⚠️  Firebase RTDB ยังไม่ได้ตั้งค่า")
        print("   ราคาจะออกเฉพาะ HTTP API (localhost เท่านั้น)")
        print("   ใส่ FIREBASE_RTDB_URL ด้านบนเพื่อให้ทุกเครื่องรับราคาได้")

    print("-" * 55)
    run()
