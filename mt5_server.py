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


# --- ลองโหลด MetaTrader5 (Windows) หรือ siliconmetatrader5 (Mac Docker) ---
_mt5_lib = None
_mt5_available = False
_mt5_symbol = "XAUUSD"

try:
    import MetaTrader5 as _mt5_lib
    _mt5_available = True
    _mt5_symbol = "XAUUSD"
except ImportError:
    pass

if not _mt5_available:
    try:
        import siliconmetatrader5 as _smt5_module
        _mt5_lib = _smt5_module.MetaTrader5(host="localhost", port=8001)
        _mt5_available = True
        _mt5_symbol = "XAUUSDm"   # Exness Mac ใช้ suffix m
        print("✅ siliconmetatrader5 (Mac Docker MT5) พร้อมแล้ว")
    except Exception as e:
        print(f"⚠️  siliconmetatrader5 โหลดไม่ได้: {e}")

_mt5_initialized = False
_price_source_label = "unknown"


def _price_from_mt5():
    """ดึงราคาจาก MT5 (Windows native หรือ Mac Docker)"""
    global _mt5_initialized
    try:
        if not _mt5_initialized:
            if not _mt5_lib.initialize():
                return None
            _mt5_lib.symbol_select(_mt5_symbol, True)
            _mt5_initialized = True
        tick = _mt5_lib.symbol_info_tick(_mt5_symbol)
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


# =====================================================================
# Telegram Notification
# =====================================================================
TELEGRAM_BOT_TOKEN = "8336486804:AAFSuGm6_U_OB45Wybf3Z2QAeJFehgB9AQA"
TELEGRAM_CHAT_ID   = "8523273130"

def send_telegram(message):
    if not TELEGRAM_BOT_TOKEN or not HAS_REQUESTS:
        return
    try:
        req_lib.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"},
            timeout=5
        )
    except Exception as e:
        print(f"  Telegram error: {e}")


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
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "MT5"
    }

    try:
        r = req_lib.put(url, json=payload, timeout=3)
        return r.status_code == 200
    except Exception as e:
        print(f"  Firebase push error: {e}")
        return False


# =====================================================================
# Price Alert — อ่านจาก Firebase RTDB, แจ้งเตือนแม้ web ปิดอยู่
# =====================================================================
_alerted_ids = set()  # กัน alert ซ้ำ

def fetch_price_alerts():
    """อ่าน price alerts จาก RTDB ที่ web app บันทึกไว้"""
    if not FIREBASE_RTDB_URL or not HAS_REQUESTS:
        return []
    try:
        url = FIREBASE_RTDB_URL.rstrip('/') + "/price_alerts.json"
        r = req_lib.get(url, timeout=3)
        if r.status_code == 200 and r.json():
            data = r.json()
            if isinstance(data, dict):
                return list(data.values())
            if isinstance(data, list):
                return [a for a in data if a]
    except Exception:
        pass
    return []

def mark_alert_triggered(alert_id):
    """อัปเดตสถานะ alert ใน RTDB เป็น triggered"""
    if not FIREBASE_RTDB_URL or not HAS_REQUESTS:
        return
    try:
        url = FIREBASE_RTDB_URL.rstrip('/') + f"/price_alerts/{alert_id}/triggered.json"
        req_lib.put(url, json=True, timeout=3)
    except Exception:
        pass

def check_price_alerts(current_price):
    """ตรวจ price alerts ทุก tick — ส่ง Telegram ถ้าราคาแตะเป้า"""
    alerts = fetch_price_alerts()
    for alert in alerts:
        if not isinstance(alert, dict):
            continue
        alert_id = alert.get('id')
        if not alert_id or alert.get('triggered') or alert_id in _alerted_ids:
            continue

        price  = float(alert.get('price', 0))
        direction = alert.get('direction', 'above')
        label  = alert.get('label', '')

        hit = (direction == 'above' and current_price >= price) or \
              (direction == 'below' and current_price <= price)

        if hit:
            _alerted_ids.add(alert_id)
            mark_alert_triggered(alert_id)
            dir_th = '📈 ราคาขึ้นถึง' if direction == 'above' else '📉 ราคาลงถึง'
            now_str = datetime.datetime.now().strftime('%H:%M:%S %d/%m/%Y')
            msg = (f"🔔 <b>GSTA Price Alert!</b>\n"
                   f"━━━━━━━━━━━━━━━━━━\n"
                   f"{dir_th} <b>{price:.2f}</b>\n"
                   f"{('📌 ' + label + chr(10)) if label else ''}"
                   f"ราคาปัจจุบัน: <b>{current_price:.2f}</b>\n"
                   f"🕐 {now_str}\n"
                   f"<i>(แจ้งเตือนจาก mt5_server แม้ web ปิดอยู่)</i>")
            send_telegram(msg)
            print(f"  🔔 Price Alert triggered! {dir_th} {price:.2f} (ราคา={current_price:.2f})")


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
                check_price_alerts(price)   # ตรวจ alert ทุก push
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
