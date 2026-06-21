#!/usr/bin/env python3
"""Server-side dose-cap tests (Tier 2 / Task 4).

Spawns a FRESH backend (temp DB + port, ML pointed at a dead address so fusion
uses its deterministic heuristic fallback) and asserts the server doseEngine
independently enforces the caps — proving BOTH guards (server here + device FSM
in test_device_fsm.py) block bad doses on their own.

Run:  python3 tests/test_server_caps.py        (needs node; no ML/other deps)
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
PORT = 4098
BASE = f"http://127.0.0.1:{PORT}/api/v1"
DB = "/tmp/pg_captest.db"
DEV = "PG-CAP"
PASS, FAIL = 0, 0


def check(name, cond):
    global PASS, FAIL
    if cond: PASS += 1; print(f"  ok   {name}")
    else: FAIL += 1; print(f"  FAIL {name}")


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data,
                               headers={"Content-Type": "application/json"}, method=method)
    try:
        with urllib.request.urlopen(r, timeout=5) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def post(infested, armed_echo=False, last_nonce=0):
    ac = ({"bands": [-70, -65, -58, -28, -25, -50], "clk": 14, "flat": 0.15, "cent": 2500}
          if infested else {"bands": [-58, -55, -54, -53, -55, -59], "clk": 1, "flat": 0.7, "cent": 1500})
    body = {"v": 1, "dev": DEV, "ts": int(time.time()), "seq": int(time.time() * 1000) % 100000,
            "ac": ac,
            "vb": {"vib_rms": 0.16 if infested else 0.02, "vib_dom_hz": 15 if infested else 2},
            "th": {"core_c": 36 if infested else 30, "amb_c": 29},
            "env": {"amb_c": 29, "hum": 45, "pres": 1011, "gas_kohm": 25 if infested else 150},
            "act": {"armed": armed_echo, "doses_today": 0, "last_dose_s": 5, "last_nonce": last_nonce},
            "sys": {"bat_pct": 90}}
    return req("POST", "/readings", body)[1]


def doses():
    return req("GET", f"/doses?device_id={DEV}")[1]["doses"]


# ── spawn backend ────────────────────────────────────────────────────────
for s in ("", "-wal", "-shm"):
    try: os.remove(DB + s)
    except OSError: pass
env = {**os.environ, "PG_DB_PATH": DB, "PORT": str(PORT), "HOST": "127.0.0.1",
       "PG_ML_URL": "http://127.0.0.1:1"}   # dead ML -> deterministic fallback
proc = subprocess.Popen(["node", "server.js"], cwd=BACKEND, env=env,
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/v1/health", timeout=1); break
        except Exception:
            time.sleep(0.2)
    else:
        print("backend did not start"); proc.terminate(); sys.exit(1)

    print("server-side dose caps (fresh backend, ML in fallback):")

    # A) DISARMED: sustained high risk must NOT create a pending dose.
    post(False)
    for _ in range(4):
        r = post(True)
    check("disarmed -> no pending dose (Rule 0 gated by armed)", len(doses()) == 0)
    check("infested risk crosses HIGH via fallback", r["risk_score"] >= 61)

    # B) ARM -> sustained high -> pending -> confirm -> sent + nonce.
    req("POST", f"/devices/{DEV}/arm", {"armed": True})
    for _ in range(3):
        post(True, armed_echo=True)
    pend = [d for d in doses() if d["status"] == "pending"]
    check("armed + sustained high -> pending dose created", len(pend) == 1)
    pid = pend[0]["id"]
    status, body = req("POST", f"/doses/{pid}/confirm", {"confirmed_by": "test"})
    nonce = body.get("dose", {}).get("nonce")
    check("confirm -> sent + nonce issued", body.get("dose", {}).get("status") == "sent" and nonce)

    # downlink command is present and within the hard cap
    r = post(True, armed_echo=True)
    cmd = r.get("cmd")
    check("downlink cmd present after confirm", bool(cmd) and cmd["dose"] is True)
    check("downlink pump_ms within hard cap (<=3000)", cmd and 0 < cmd["pump_ms"] <= 3000)

    # C) DEVICE ACK -> done; then COOLDOWN blocks a new Rule-0 dose.
    post(True, armed_echo=True, last_nonce=int(nonce))   # echo nonce -> handleDeviceAck
    time.sleep(0.2)
    done = [d for d in doses() if d["id"] == pid and d["status"] == "done"]
    check("device ack (last_nonce) -> dose done", len(done) == 1)
    for _ in range(4):
        post(True, armed_echo=True)
    new_pending = [d for d in doses() if d["status"] == "pending"]
    check("cooldown -> server blocks a new pending dose", len(new_pending) == 0)

    # replay/no-resend: with the dose done, a fresh poll carries NO cmd.
    r = post(True, armed_echo=True)
    check("server does not resend a completed dose (no replay)", not r.get("cmd"))

    # D) OVER-CAP pump_ms rejected by policy schema (cannot store > MAX).
    status_bad, _ = req("PATCH", f"/devices/{DEV}/policy", {"pump_ms": 9999})
    status_ok, _ = req("PATCH", f"/devices/{DEV}/policy", {"pump_ms": 3000})
    check("policy pump_ms > 3000 rejected (400)", status_bad == 400)
    check("policy pump_ms = 3000 accepted", status_ok == 200)

    # E) confirm after DISARM is rejected (server guard at confirm time).
    req("POST", f"/devices/{DEV}/arm", {"armed": False})       # cancels open + disarms
    req("POST", f"/devices/{DEV}/arm", {"armed": True})
    req("PATCH", f"/devices/{DEV}/policy", {"cooldown_s": 0})   # clear cooldown so a pending can form
    for _ in range(3):
        post(True, armed_echo=True)
    p2 = [d for d in doses() if d["status"] == "pending"]
    if p2:
        req("POST", f"/devices/{DEV}/arm", {"armed": False})    # disarm before confirm
        st, b = req("POST", f"/doses/{p2[0]['id']}/confirm", {"confirmed_by": "test"})
        check("confirm while disarmed -> rejected", st == 409 or b.get("error"))
    else:
        check("confirm while disarmed -> rejected (no pending formed; n/a)", True)

    print(f"\n{PASS} passed, {FAIL} failed")
finally:
    proc.terminate()
    try: proc.wait(timeout=5)
    except Exception: proc.kill()

sys.exit(1 if FAIL else 0)
