#!/usr/bin/env python3
"""
Palm Guard - mock ESP32-S3 device.

Posts realistic JSON readings to the local backend at the same cadence (~30 s)
that the real firmware will use. Intended for two purposes:
  1. End-to-end testing of the backend + dashboard before firmware is flashed.
  2. Generating background "noise" while a real ESP32 is also connected.

Behaviour: 95% of cycles produce healthy baselines. Every ~50 cycles the
device simulates an "infestation event": click rate climbs, mid-band acoustic
energy increases, BME680 gas resistance drops, and trunk core temperature
rises 1-3 degrees above ambient. This produces a HIGH_RISK alert on the
backend so the dashboard's full pipeline can be exercised.

Usage:
    python tools/mock_device.py --device-id PG-001
    python tools/mock_device.py --device-id PG-001 --interval 5 --force-event
    python tools/mock_device.py --server http://192.168.1.10:4000

The backend's response includes a `stream_bands` flag. When true (a dashboard
has subscribed to spectrogram for this device), the mock will switch to 2-second
cycles and include a `bands16` array in `ac` until the flag clears.
"""
from __future__ import annotations

import argparse
import math
import random
import signal
import sys
import time
from typing import Any

import urllib.error
import urllib.request
import json


# ---------- helpers --------------------------------------------------------

def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def jitter(value: float, pct: float = 0.05) -> float:
    """Add gaussian noise as a fraction of |value|."""
    return value + random.gauss(0, max(abs(value), 0.1) * pct)


def post_json(url: str, payload: dict[str, Any], timeout: float = 5.0) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "palmguard-mock/0.1"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ---------- realistic sensor models ---------------------------------------

class AcousticModel:
    """Generate INMP441-style acoustic features.

    Healthy: pink noise + occasional environmental peaks, low click rate.
    Infested: broadband impulses concentrated in 2-6 kHz, high click rate.
    """

    def features(self, infested: bool) -> dict[str, Any]:
        if infested:
            # Strong mid-band, peaky spectrum, lots of clicks
            bands = [
                random.gauss(-70, 3),  # 0-500 Hz
                random.gauss(-65, 3),  # 500-1k
                random.gauss(-58, 3),  # 1-2k
                random.gauss(-30, 4),  # 2-4k  <- peak
                random.gauss(-26, 4),  # 4-6k  <- peak
                random.gauss(-50, 3),  # 6-8k
            ]
            peaks = [
                [random.uniform(2900, 3700), random.uniform(-20, -14)],
                [random.uniform(3900, 4800), random.uniform(-22, -16)],
                [random.uniform(4800, 5800), random.uniform(-25, -18)],
                [random.uniform(2200, 2700), random.uniform(-28, -22)],
                [random.uniform(6000, 7000), random.uniform(-30, -24)],
            ]
            return dict(
                bands=bands, peaks=peaks,
                cent=random.uniform(4000, 5200),
                flat=random.uniform(0.10, 0.25),     # peaky
                rms=random.uniform(-32, -22),
                zcr=random.uniform(0.20, 0.32),
                clk=random.uniform(8.0, 18.0),       # high click rate
            )
        else:
            # Healthy ambient: pink-ish noise, mostly flat
            base = -55 + random.gauss(0, 2)
            bands = [base - 5, base - 2, base + 1, base + 2, base, base - 4]
            for i in range(6):
                bands[i] = jitter(bands[i], 0.05)
            peaks = []
            if random.random() < 0.4:
                # occasional environmental peak (machinery, wind gust)
                peaks.append([random.uniform(200, 1500), random.uniform(-45, -35)])
            return dict(
                bands=bands, peaks=peaks,
                cent=random.uniform(800, 2500),
                flat=random.uniform(0.55, 0.85),
                rms=random.uniform(-55, -42),
                zcr=random.uniform(0.05, 0.15),
                clk=random.uniform(0.0, 1.5),
            )

    def bands16(self, infested: bool) -> list[float]:
        """High-resolution 16-band spectrum for the live spectrogram page."""
        out = []
        for i in range(16):
            if infested and 4 <= i <= 11:        # mid-band emphasis
                out.append(random.gauss(-26, 4))
            else:
                out.append(random.gauss(-55, 3))
        return out


class VibrationModel:
    """MPU6050 RMS / peak / dominant frequency."""
    def features(self, infested: bool) -> dict[str, Any]:
        if infested:
            return dict(
                vib_rms=random.uniform(0.10, 0.22),
                vib_pk=random.uniform(0.30, 0.55),
                vib_dom_hz=random.uniform(8, 22),     # internal-activity band
            )
        return dict(
            vib_rms=random.uniform(0.005, 0.04),
            vib_pk=random.uniform(0.02, 0.10),
            vib_dom_hz=random.uniform(0.3, 4),         # leaf rustle / wind
        )


class ThermalModel:
    """DS18B20 trunk core + ambient.

    The mock keeps an internal slow-drift baseline for ambient that follows
    a sinusoid (day/night). Infested cycles add +1-3 °C to core_c.
    """
    def __init__(self) -> None:
        self.t0 = time.time()

    def ambient(self) -> float:
        # Diurnal sinusoid 22 -> 32 -> 22 over 86400 s
        phase = ((time.time() - self.t0) / 86400) * 2 * math.pi
        return 27 + 5 * math.sin(phase) + random.gauss(0, 0.3)

    def features(self, infested: bool) -> dict[str, Any]:
        amb = self.ambient()
        offset = random.uniform(1.4, 2.4)              # palm core normally amb + ~2
        if infested:
            offset += random.uniform(1.5, 3.5)         # metabolic stress
        return dict(core_c=amb + offset, amb_c=amb)


class EnvModel:
    """BME680 humidity, pressure, gas resistance.

    Gas resistance starts high (~150 kΩ for clean air) and drops when VOCs are
    present. Infested events drop it to 15-30 kΩ.
    """
    def __init__(self) -> None:
        self.warmup_remaining = 4   # quick warm-up for testing (firmware uses 240)

    def features(self, infested: bool) -> dict[str, Any]:
        amb = 27 + random.gauss(0, 2)
        hum = max(20, min(80, random.gauss(50, 8)))
        pres = random.gauss(1011, 2)
        if self.warmup_remaining > 0:
            self.warmup_remaining -= 1
            gas = random.uniform(80, 120)              # pre-warmup unstable
        elif infested:
            gas = random.uniform(15, 35)               # heavy VOC -> low resistance
        else:
            gas = random.uniform(110, 180)             # clean air -> high resistance
        return dict(amb_c=amb, hum=hum, pres=pres, gas_kohm=gas)


# ---------- log-mel patch (matches ml/serve heuristic feeding rows [4,30)) ----

MEL_BANDS, MEL_FRAMES, FEED_LO, FEED_HI = 40, 32, 4, 30


def mel_patch(infested: bool) -> list[float]:
    """40×32 band-major log-mel patch, per-clip mean-var normalized (matches the
    firmware + backend demo generator). Infested lifts the feeding-band rows."""
    raw = [0.0] * (MEL_BANDS * MEL_FRAMES)
    for b in range(MEL_BANDS):
        for f in range(MEL_FRAMES):
            v = random.gauss(-52, 2)
            if infested and FEED_LO <= b < FEED_HI:
                v += 9 + 4 * math.sin(f * 0.9 + b)
                if random.random() < 0.18:
                    v += random.uniform(4, 9)
            raw[b * MEL_FRAMES + f] = v
    mean = sum(raw) / len(raw)
    var = max(sum((x - mean) ** 2 for x in raw) / len(raw), 1e-6)
    inv = 1.0 / math.sqrt(var)
    return [round((x - mean) * inv, 2) for x in raw]


class DoseSim:
    """Simulates the on-device dose FSM + failsafes (mirrors firmware/dose_fsm).

    Adopts the server's `armed` flag from each response, executes a downlink
    {dose,pump_ms,nonce} only if local guards pass, then echoes act.last_nonce so
    the backend closes the dose lifecycle.
    """
    MAX_MS = 3000
    COOLDOWN_S = 1800
    MAX_PER_DAY = 4

    def __init__(self, cooldown_s=None):
        self.armed = False
        self.doses_today = 0
        self.last_dose_s = 0
        self.has_dosed = False        # explicit "never dosed" flag (uptime second 0 is valid)
        self.last_nonce = 0
        self.start = time.time()
        if cooldown_s is not None:
            self.COOLDOWN_S = cooldown_s

    def now_s(self) -> int:
        return int(time.time() - self.start)

    def act_block(self) -> dict[str, Any]:
        return {
            "armed": self.armed,
            "doses_today": self.doses_today,
            "last_dose_s": self.last_dose_s,
            "last_nonce": self.last_nonce,
        }

    def apply(self, resp: dict[str, Any]) -> None:
        self.armed = bool(resp.get("armed", False))
        cmd = resp.get("cmd")
        if not cmd or not cmd.get("dose"):
            return
        pump_ms = int(cmd.get("pump_ms", 0))
        nonce = int(cmd.get("nonce", 0))
        now = self.now_s()
        # Local failsafe gauntlet (independent of the server caps).
        if not self.armed:
            print("  [dose] REJECT: disarmed"); return
        if not (0 < pump_ms <= self.MAX_MS):
            print(f"  [dose] REJECT: pump_ms {pump_ms} out of range"); return
        if nonce != 0 and nonce == self.last_nonce:
            print(f"  [dose] REJECT: replayed nonce {nonce}"); return
        if self.has_dosed and (now - self.last_dose_s) < self.COOLDOWN_S:
            print("  [dose] REJECT: cooldown"); return
        if self.doses_today >= self.MAX_PER_DAY:
            print("  [dose] REJECT: daily cap"); return
        # Execute (simulated pump-on).
        print(f"  [dose] *** DOSING {pump_ms} ms (nonce={nonce}) ***")
        self.last_dose_s = now
        self.has_dosed = True
        self.last_nonce = nonce
        self.doses_today += 1


# ---------- main mock loop ------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Palm Guard mock ESP32 device")
    ap.add_argument("--device-id", default="PG-001",
                    help="Device id reported as `dev` field")
    ap.add_argument("--server", default="http://localhost:4000",
                    help="Backend base URL")
    ap.add_argument("--interval", type=float, default=5.0,
                    help="Seconds between cycles (real firmware uses 30)")
    ap.add_argument("--event-every", type=int, default=20,
                    help="Trigger an infestation event every N healthy cycles")
    ap.add_argument("--force-event", action="store_true",
                    help="Emit infestation patterns from the first cycle")
    ap.add_argument("--max-cycles", type=int, default=0,
                    help="Stop after N cycles (0 = run forever)")
    ap.add_argument("--dose-cooldown", type=int, default=None,
                    help="Override local dose cooldown (s) for demos (default 1800)")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args(argv)

    url = args.server.rstrip("/") + "/api/v1/readings"

    ac = AcousticModel()
    vb = VibrationModel()
    th = ThermalModel()
    en = EnvModel()
    dose = DoseSim(cooldown_s=args.dose_cooldown)

    seq = 0
    streaming = False
    stop = False
    def _sigint(*_a):
        nonlocal stop
        stop = True
        print("\n[mock] interrupted, exiting...", file=sys.stderr)
    signal.signal(signal.SIGINT, _sigint)

    print(f"[mock] device_id={args.device_id} -> {url}")
    print(f"[mock] interval={args.interval}s  event_every={args.event_every} cycles")
    print("[mock] Ctrl+C to stop")

    while not stop and (args.max_cycles == 0 or seq < args.max_cycles):
        seq += 1
        infested = args.force_event or (seq % args.event_every == 0)

        # Build payload
        ac_features = ac.features(infested)
        ac_features["mel"] = mel_patch(infested)          # 40×32 log-mel for the ML scorer
        if streaming:
            ac_features["bands16"] = ac.bands16(infested)

        payload: dict[str, Any] = {
            "v": 1,
            "dev": args.device_id,
            "ts": int(time.time()),
            "seq": seq,
            "ac": ac_features,
            "vb": vb.features(infested),
            "th": th.features(infested),
            "env": en.features(infested),
            "act": dose.act_block(),                      # actuation truth -> closes dose loop
            "sys": {
                "bat_pct": max(20, 95 - seq // 720),  # slow drain
                "rssi": random.randint(-75, -55),
                "fw": "mock-2.0.0",
                "up_s": int(time.time() - th.t0),
            },
        }

        try:
            resp = post_json(url, payload)
        except urllib.error.URLError as e:
            print(f"[mock] POST failed: {e.reason} - retrying in 3 s", file=sys.stderr)
            time.sleep(3)
            continue
        except Exception as e:
            print(f"[mock] error: {e}", file=sys.stderr)
            time.sleep(3)
            continue

        streaming = bool(resp.get("stream_bands"))
        # Adopt server arm state + apply any dose downlink (with local failsafes).
        dose.apply(resp)
        if not args.quiet:
            tag = "EVENT" if infested else "ok   "
            stream_tag = " [STREAM]" if streaming else ""
            arm_tag = " [ARMED]" if dose.armed else ""
            pa = resp.get("p_activity")
            pa_s = f" p_act={pa:.2f}" if isinstance(pa, (int, float)) else ""
            print(
                f"[mock] #{seq:5d}  {tag}  risk={resp['risk_score']:5.1f} "
                f"({resp['classification']:6}){pa_s}{stream_tag}{arm_tag}"
            )

        # If the dashboard is asking for spectrogram, run faster (2 s)
        cadence = 2.0 if streaming else args.interval
        time.sleep(cadence)

    return 0


if __name__ == "__main__":
    sys.exit(main())
