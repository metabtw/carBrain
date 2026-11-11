import http.server
import json
import urllib.parse
import os
import sys
import struct
import numpy as np

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from ecu_parser import EcuBinaryParser
from checksum_engine import Edc15ChecksumEngine

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
STOCK_BIN_PATH = os.path.join(DATA_DIR, "edc15_19tdi_stock.bin")

SESSION_BIN: bytearray = bytearray()

def get_current_bin() -> bytearray:
    global SESSION_BIN
    if not SESSION_BIN:
        if os.path.exists(STOCK_BIN_PATH):
            with open(STOCK_BIN_PATH, "rb") as f:
                SESSION_BIN = bytearray(f.read())
    return SESSION_BIN

DAMOS_KNOWLEDGE_BASE = [
    {
        "keywords": ["yokus", "yokuş", "bayil", "bayıl", "cekis", "çekiş", "tork", "rampa", "gucsuz", "güçsüz"],
        "intent": "hill_climb_torque",
        "description": "Yokuşlarda ve düşük devirlerde motorun erken tork üretmesi için Tork Limitörü (0x4F080) ve Turbo Basınç Haritası (0x4D200) optimize edilmelidir.",
        "recommended_params": {"turbo": 12.0, "injection": 6.0, "throttle": 12.0},
        "target_maps": ["0x4F080 (Torque Limiter)", "0x4D200 (Boost Map)", "0x4C120 (Driver Wish)"],
        "safety_note": "Alt devirlerde ani aşırı tork verilmesi çift kütleli volana (DMF) ekstra yük bindirir. Bu nedenle +%12 artış güvenli üst sınırdır."
    },
    {
        "keywords": ["yakit", "yakıt", "tasarruf", "ekonomi", "uzun yol", "az yaksın"],
        "intent": "eco_mileage",
        "description": "Şehirlerarası sakin sürüşlerde püskürtme haritasını (0x4E150) optimize ederek hava/yakıt oranını fakir karışıma doğru kaydırır.",
        "recommended_params": {"turbo": 4.0, "injection": -6.0, "throttle": 4.0},
        "target_maps": ["0x4E150 (Smoke Limiter)", "0x4C120 (Driver Wish)"],
        "safety_note": "Aşırı fakir karışım dizel motorlarda yanma odası sıcaklığını kontrol altında tutmak için turbo basıncıyla dengelenmelidir."
    },
    {
        "keywords": ["sport", "hiz", "hız", "gaz tepkisi", "atak", "agresif", "stage 1", "stage1"],
        "intent": "stage1_sport",
        "description": "Fabrika turbosu ve enjektör sınırları dahilinde maksimum güvenli Stage 1 kalibrasyonu uygular.",
        "recommended_params": {"turbo": 14.0, "injection": 8.0, "throttle": 14.0},
        "target_maps": ["0x4D200 (Boost Map)", "0x4C120 (Driver Wish)", "0x4E150 (Smoke Limiter)"],
        "safety_note": "+15 HP ve +35 Nm tork artışı elde edilir. Yağ ve soğutma suyu sıcaklığı fabrika toleransında kalır."
    }
]

class EcuHttpHandler(http.server.BaseHTTPRequestHandler):
    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/health":
            self._send_json({
                "status": "online",
                "engine": "Python 3.14 + ThreadingHTTPServer + NumPy",
                "supported_ecu": "Bosch EDC15 (1.9 TDI)",
                "binary_size": len(get_current_bin())
            })
        elif path.startswith("/api/map"):
            map_name = query.get("name", ["boost"])[0]
            parser = EcuBinaryParser(STOCK_BIN_PATH)
            parser.data = bytes(get_current_bin())
            try:
                res = parser.get_known_map(map_name)
                np_mat = np.array(res["matrix"], dtype=np.float32)
                res["stats"] = {
                    "min": float(np_mat.min()),
                    "max": float(np_mat.max()),
                    "mean": float(np.round(np_mat.mean(), 1)),
                    "shape": list(np_mat.shape)
                }
                self._send_json(res)
            except Exception as e:
                self._send_json({"error": str(e)}, status=404)
        elif path == "/api/download":
            turbo = float(query.get("turbo", [0])[0])
            injection = float(query.get("injection", [0])[0])
            throttle = float(query.get("throttle", [0])[0])

            engine = Edc15ChecksumEngine(get_current_bin())
            patched = engine.patch_maps(turbo, injection, throttle)

            filename = f"golf_iv_19tdi_edc15_tuned_T{int(turbo):+d}_I{int(injection):+d}.bin"
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(patched)))
            self.end_headers()
            self.wfile.write(patched)
        else:
            self._send_json({"error": "Endpoint not found"}, status=404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        if path == "/api/patch":
            global SESSION_BIN
            try:
                data = json.loads(body.decode("utf-8")) if body else {}
            except Exception:
                data = {}

            turbo = float(data.get("turbo", 0.0))
            injection = float(data.get("injection", 0.0))
            throttle = float(data.get("throttle", 0.0))

            guardrail_warnings = []
            if turbo > 15.0:
                guardrail_warnings.append("⚠️ Garrett GT1749V için %15 üzeri basınç pallerde aşırı devirlenmeye yol açabilir!")
            if injection > 10.0 and turbo < 4.0:
                guardrail_warnings.append("⚠️ Yetersiz hava basıncıyla aşırı yakıt, siyah duman ve yüksek EGT (>850°C) üretir.")

            engine = Edc15ChecksumEngine(get_current_bin())
            patched = engine.patch_maps(turbo, injection, throttle)
            SESSION_BIN = patched

            chk_status = Edc15ChecksumEngine(patched).verify_all_blocks()

            parser = EcuBinaryParser(STOCK_BIN_PATH)
            parser.data = bytes(patched)
            boost_map = parser.get_known_map("boost")

            self._send_json({
                "success": True,
                "message": "Harita değerleri NumPy matris motoruyla güncellendi ve Checksum başarıyla imzalandı.",
                "guardrail_warnings": guardrail_warnings,
                "checksum_verification": chk_status,
                "updated_matrix": boost_map["matrix"],
                "x_axis": boost_map["x_axis"],
                "y_axis": boost_map["y_axis"]
            })
        elif path == "/api/rag/chat":
            try:
                data = json.loads(body.decode("utf-8")) if body else {}
            except Exception:
                data = {}
            prompt = data.get("prompt", "").lower()

            matched = None
            for item in DAMOS_KNOWLEDGE_BASE:
                for kw in item["keywords"]:
                    if kw in prompt:
                        matched = item
                        break
                if matched:
                    break
            if not matched:
                matched = DAMOS_KNOWLEDGE_BASE[0]

            self._send_json({
                "user_query": prompt,
                "matched_intent": matched["intent"],
                "technical_diagnosis": matched["description"],
                "target_ecu_maps": matched["target_maps"],
                "recommended_params": matched["recommended_params"],
                "guardrail_advice": matched["safety_note"],
                "ai_response": f"{matched['description']}\n\nHedef Harita Adresleri: {', '.join(matched['target_maps'])}\n\nGüvenlik Bekçisi: {matched['safety_note']}"
            })
        else:
            self._send_json({"error": "Unknown POST route"}, status=404)

def run_server(port=8000):
    server_address = ("127.0.0.1", port)
    httpd = http.server.ThreadingHTTPServer(server_address, EcuHttpHandler)
    print(f"AutoTune AI Python Core Engine listening on http://127.0.0.1:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()

