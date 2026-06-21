# Tests

Host-runnable safety + pipeline tests (no hardware, no PlatformIO).

| File | What | Needs |
|---|---|---|
| `test_device_fsm.py` | Device-side dose failsafes — the host port of `firmware/.../dose_fsm.cpp` (`DoseSim` in `tools/mock_device.py`): armed, pump_ms≤MAX, cooldown, daily-cap, anti-replay. | python3 only |
| `test_server_caps.py` | Server-side `doseEngine` caps — spawns a fresh backend (temp DB + port, ML in fallback) and asserts disarmed/cooldown/over-cap/no-replay independently block. | node 22+ |

Together they prove **both** independent guards (server + device) block an
over-cap / replayed / disarmed dose — the §3 two-guards-by-design requirement,
validated without flashing hardware.

```bash
bash tests/run_all.sh
# or individually:
python3 tests/test_device_fsm.py
python3 tests/test_server_caps.py
```
