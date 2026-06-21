#!/usr/bin/env python3
"""Device-side dose-failsafe tests (Tier 2 / Task 4).

The firmware dose FSM (firmware/.../actuation/dose_fsm.cpp) can't compile here,
so we test its HOST PORT — the DoseSim in tools/mock_device.py — which mirrors
the exact gauntlet: armed AND pump_ms<=MAX AND cooldown AND daily-cap AND
nonce-not-replayed. Each failsafe is covered independently.

Run:  python3 tests/test_device_fsm.py    (no deps, no server)
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from mock_device import DoseSim  # noqa: E402

PASS, FAIL = 0, 0


def check(name, cond):
    global PASS, FAIL
    if cond:
        PASS += 1; print(f"  ok   {name}")
    else:
        FAIL += 1; print(f"  FAIL {name}")


def cmd(nonce, pump_ms=2000):
    return {"armed": True, "cmd": {"dose": True, "pump_ms": pump_ms, "nonce": nonce}}


print("device dose_fsm failsafes (host port = DoseSim):")

# 1) Disarmed blocks even with a valid command.
s = DoseSim(cooldown_s=0)
s.apply({"armed": False, "cmd": {"dose": True, "pump_ms": 2000, "nonce": 11}})
check("disarmed -> no dose", s.doses_today == 0 and s.last_nonce == 0)

# 2) Armed + valid -> executes once.
s = DoseSim(cooldown_s=0)
s.apply(cmd(101))
check("armed+valid -> dose executes", s.doses_today == 1 and s.last_nonce == 101)

# 3) Replayed nonce blocked (cooldown=0 isolates the replay guard).
s.apply(cmd(101))
check("replayed nonce -> blocked", s.doses_today == 1)

# 4) Over-cap pump_ms blocked (> PG_DOSE_MAX_MS = 3000).
s = DoseSim(cooldown_s=0)
s.apply(cmd(202, pump_ms=5000))
check("pump_ms > MAX -> blocked", s.doses_today == 0)

# 5) Cooldown blocks a second dose within the window.
s = DoseSim(cooldown_s=1800)
s.apply(cmd(301)); first = s.doses_today
s.apply(cmd(302))
check("cooldown -> second dose blocked", first == 1 and s.doses_today == 1)

# 6) Daily cap blocks the 5th dose (MAX_PER_DAY = 4), distinct nonces, no cooldown.
s = DoseSim(cooldown_s=0)
for n in range(1, 6):
    s.apply(cmd(1000 + n))
check("daily cap -> stops at MAX_PER_DAY (4)", s.doses_today == 4)

# 7) Zero pump_ms blocked.
s = DoseSim(cooldown_s=0)
s.apply(cmd(404, pump_ms=0))
check("pump_ms == 0 -> blocked", s.doses_today == 0)

print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
