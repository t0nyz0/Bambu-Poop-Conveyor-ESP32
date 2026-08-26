#!/usr/bin/env python3
"""Local-only UI preview server with representative, non-secret API data."""
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS = {"ok": True, "version": "1.5.0", "displayVersion": "1.5.0", "bootId": 1500, "hostname": "BambuConveyor-ESP32", "mdns": "bambuconveyor-esp32.local", "ip": "192.168.1.116", "uptimeMs": 8670000, "mode": "mqtt", "wifi": {"connected": True, "ssid": "Workshop Wi-Fi", "rssi": -52}, "system": {"freeHeap": 214824, "minFreeHeap": 186240, "heapSize": 327680, "cpuMHz": 240, "cpuCores": 2}, "mqtt": {"connected": True}, "printer": {"stage": 0, "subStage": 0, "stageDescription": "Printing", "subStageDescription": "Printing", "gcodeState": "RUNNING"}, "motor": {"state": "Idle", "running": False, "waiting": False, "cooldown": False, "remainingMs": 0}, "leds": {"green": True, "yellow": False, "red": False}}
CONFIG = {"ok": True, "operationMode": "mqtt", "gmtOffset": -6, "ssid": "Workshop Wi-Fi", "wifiPasswordSet": True, "printerIp": "192.168.1.50", "accessCodeSet": True, "serialNumber": "01S00A000000000", "printerModel": "H2", "debug": False, "motor": {"waitMs": 5000, "runMs": 2000, "cooldownMs": 120000, "speed": 240, "direction": 1}}
TRIGGERS = {"ok": True, "maxRules": 16, "defaults": {"waitMs": 5000, "runMs": 2000, "cooldownMs": 120000}, "rules": [{"source": "stage", "value": 14, "state": "", "label": "Stage 14 · Cleaning nozzle tip", "enabled": True, "oncePerPrint": True, "waitMs": 5000, "runMs": 2000, "cooldownMs": 120000}, {"source": "stage", "value": 4, "state": "", "label": "Stage 4 · Changing filament", "enabled": False, "oncePerPrint": False, "waitMs": 5000, "runMs": 2000, "cooldownMs": 120000}, {"source": "substage", "value": 4, "state": "", "label": "Substage 4", "enabled": False, "oncePerPrint": False, "waitMs": 80000, "runMs": 2000, "cooldownMs": 120000}]}
CATALOG = {"ok": True, "stages": [{"value": 0, "label": "Printing"}, {"value": 4, "label": "Changing filament"}, {"value": 14, "label": "Cleaning nozzle tip"}, {"value": 68, "label": "Moving toolhead above purge chute"}, {"value": 76, "label": "Pre-extrusion before printing"}, {"value": 77, "label": "Preparing AMS"}, {"value": 255, "label": "Idle"}], "gcodeStates": ["FAILED", "FINISH", "IDLE", "INIT", "OFFLINE", "PAUSE", "PREPARE", "RUNNING", "SLICING", "UNKNOWN"]}
LOGS = {"ok": True, "debug": False, "capacity": 200, "count": 5, "returned": 5, "entries": [{"timestamp": int(time.time()) - 420, "message": "WiFi connected. IP address: 192.168.1.116"}, {"timestamp": int(time.time()) - 416, "message": "MQTT connected to printer"}, {"timestamp": int(time.time()) - 255, "message": "Print state changed to RUNNING"}, {"timestamp": int(time.time()) - 121, "message": "Printer stage: Printing"}, {"timestamp": int(time.time()) - 18, "message": "Status requested from web interface"}]}
RELEASES = {
    "stable": {"version": "1.5.0", "label": "v1.5.0", "bin": "https://t0nyz.com/flasher/Bambu-Poop-Conveyor-v1.5.0-ota.bin", "githubBin": "https://raw.githubusercontent.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/Bambu-Conveyor-ESP32/firmware/releases/v1.5.0/Bambu-Poop-Conveyor-v1.5.0-ota.bin"},
    "beta": {"version": "1.5.0", "label": "v1.5.0 Beta 17", "bin": "https://t0nyz.com/flasher-beta/firmware/Bambu-Poop-Conveyor-v1.5.0-beta.17-ota.bin", "githubBin": "https://raw.githubusercontent.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/Bambu-Conveyor-ESP32/firmware/releases/v1.5.0-beta.17/Bambu-Poop-Conveyor-v1.5.0-beta.17-ota.bin"},
    "rollback": {"version": "1.4.2", "label": "v1.4.2", "bin": "https://t0nyz.com/flasher/Bambu-Poop-Conveyor.v1.4.2-update.ino.bin", "githubBin": "https://raw.githubusercontent.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/Bambu-Conveyor-ESP32/firmware/releases/v1.4.2/Bambu-Poop-Conveyor.v1.4.2-update.ino.bin"},
}
if os.environ.get("PREVIEW_COOLDOWN"):
    STATUS["motor"] = {"state": "Cooldown", "running": False, "waiting": False, "cooldown": True, "remainingMs": 83400}
    COOLDOWN_END = time.monotonic() + 83.4
else:
    COOLDOWN_END = None

class Handler(BaseHTTPRequestHandler):
    def send_json(self, value, status=200):
        body = json.dumps(value).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/api/status", "/api/health"):
            if path == "/api/status" and COOLDOWN_END is not None:
                STATUS["motor"]["remainingMs"] = max(0, int((COOLDOWN_END - time.monotonic()) * 1000))
            self.send_json(STATUS); return
        if path == "/api/config": self.send_json(CONFIG); return
        if path in ("/api/triggers", "/api/trigger-catalog") and os.environ.get("PREVIEW_SLOW_TRIGGERS"):
            time.sleep(3)
        if path == "/api/triggers": self.send_json(TRIGGERS); return
        if path == "/api/trigger-catalog": self.send_json(CATALOG); return
        if path == "/api/logs": self.send_json(LOGS); return
        if path == "/api/releases/stable": self.send_json(RELEASES["stable"]); return
        if path == "/api/releases/beta": self.send_json(RELEASES["beta"]); return
        if path == "/api/releases/rollback": self.send_json(RELEASES["rollback"]); return
        body = (ROOT / "web" / "index.html").read_text().replace(
            "https://t0nyz.com/flasher/latest.json", "/api/releases/stable"
        ).replace(
            "https://t0nyz.com/flasher-beta/latest.json", "/api/releases/beta"
        ).replace(
            "https://t0nyz.com/flasher/rollback.json", "/api/releases/rollback"
        ).encode()
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_POST(self):
        size = int(self.headers.get("Content-Length", 0)); body = self.rfile.read(size)
        if self.path == "/api/triggers":
            try:
                payload = json.loads(body or b"{}")
                rules = payload["rules"]
                if not isinstance(rules, list) or len(rules) > TRIGGERS["maxRules"]:
                    raise ValueError("Invalid rule list")
                stages = {item["value"]: item["label"] for item in CATALOG["stages"]}
                for rule in rules:
                    source = rule["source"]
                    if source == "stage":
                        rule["label"] = f'Stage {rule["value"]} · {stages.get(rule["value"], "Unknown stage")}'
                    elif source == "substage":
                        rule["label"] = f'Substage {rule["value"]}'
                    elif source == "gcode_state":
                        rule["label"] = f'Print state · {rule["state"]}'
                    else:
                        raise ValueError("Invalid status family")
                TRIGGERS["rules"] = rules
                self.send_json(TRIGGERS)
            except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
                self.send_json({"ok": False, "error": str(error)}, 400)
        elif self.path == "/update":
            STATUS["bootId"] += 1
            self.send_json({"ok": True, "rebootInMs": 100})
        elif self.path.startswith("/api/"): self.send_json({"ok": True, "rebooting": False})
        else: self.send_json({"ok": False, "error": "Not supported in preview"}, 400)

    def log_message(self, *_): pass

if __name__ == "__main__":
    print("Preview: http://127.0.0.1:8765", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
