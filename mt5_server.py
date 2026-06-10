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


# --- ฟังก์ชันดึงราคาจาก MT5 ---
def get_mt5_price():
    """
    ใส่ code MT5 จริงที่นี่ เมื่อพร้อมใช้งาน:

    import MetaTrader5 as mt5
    if not mt5.initialize():
        return None
    tick = mt5.symbol_info_tick("XAUUSD")
    mt5.shutdown()
    return tick.last if tick else None
    """
    # โหมด simulate (ลบออกเมื่อต่อ MT5 จริง)
    import random
    return round(random.uniform(3300.0, 3400.0), 2)


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
                print(f"  📤 Push XAUUSD = {price:.2f}  [{datetime.datetime.now().strftime('%H:%M:%S')}]")
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


def run(port=8050):
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
