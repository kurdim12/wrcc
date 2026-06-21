#!/usr/bin/env python3
"""Serial -> Palm Guard backend bridge.

Reads tagged JSON lines from a Serial port (the ESP32-S3 sensor node) and
forwards every reading to the local backend's /api/v1/readings endpoint.
Used when WiFi isn't available on the sensor node — data flows USB -> PC.

Each firmware reading is emitted as one line:
    #PG#{"v":1,"dev":"PG-001",...}

Anything not starting with the tag is ignored (debug/boot messages).

To keep up with fast cycles (4 Hz+), POSTs run on a background thread pool
so serial reads never block on HTTP latency.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor
import urllib.error
import urllib.request

import serial

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

TAG = '#PG#'
_lock = threading.Lock()
_count = 0


def post_json(url: str, payload: dict, echo: bool, timeout: float = 3.0) -> None:
    global _count
    body = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url, data=body,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode('utf-8'))
        with _lock:
            _count += 1
            n = _count
        if echo:
            risk = data.get('risk_score')
            cls = data.get('classification', '?')
            risk_s = f"{risk:5.1f}" if isinstance(risk, (int, float)) else "?"
            ac = payload.get('ac', {})
            vb = payload.get('vb', {})
            th = payload.get('th', {})
            print(f"[#{n:5d}] {payload.get('dev'):<10} "
                  f"risk={risk_s} ({cls})  "
                  f"vib={vb.get('vib_rms', 0):.3f}g "
                  f"core={th.get('core_c', '?')}C "
                  f"clk={ac.get('clk', 0):.1f}/s",
                  flush=True)
    except urllib.error.HTTPError as e:
        print(f"  [bridge] backend HTTP {e.code}", flush=True)
    except urllib.error.URLError as e:
        print(f"  [bridge] backend unreachable: {e.reason}", flush=True)
    except Exception as e:
        print(f"  [bridge] post failed: {e}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description='Palm Guard serial->HTTP bridge')
    ap.add_argument('--port', default='COM4')
    ap.add_argument('--baud', default=115200, type=int)
    ap.add_argument('--backend', default='http://localhost:4000')
    ap.add_argument('--echo', action='store_true', help='print every parsed line + serial debug')
    ap.add_argument('--workers', default=8, type=int, help='HTTP worker threads')
    args = ap.parse_args()

    url = args.backend.rstrip('/') + '/api/v1/readings'
    print(f"[bridge] {args.port}@{args.baud}  ->  {url}", flush=True)

    while True:
        try:
            ser = serial.Serial(args.port, args.baud, timeout=0.05)
            print(f"[bridge] {args.port} opened", flush=True)
            break
        except serial.SerialException as e:
            print(f"[bridge] cannot open {args.port}: {e}. Retrying in 3s...", flush=True)
            time.sleep(3)

    pool = ThreadPoolExecutor(max_workers=args.workers, thread_name_prefix='post')
    line_buf = b''
    last_stats = time.time()
    seen = 0
    posted_at_last_stats = 0

    try:
        while True:
            chunk = ser.read(2048)
            if chunk:
                line_buf += chunk
            while b'\n' in line_buf:
                raw, _, line_buf = line_buf.partition(b'\n')
                try:
                    line = raw.decode('utf-8', errors='replace').rstrip('\r\n')
                except Exception:
                    continue

                idx = line.find(TAG)
                if idx < 0:
                    if args.echo and line.strip():
                        print(f"  [serial] {line}", flush=True)
                    continue

                payload_str = line[idx + len(TAG):].strip()
                if not payload_str.startswith('{'):
                    continue
                try:
                    payload = json.loads(payload_str)
                except json.JSONDecodeError:
                    continue

                seen += 1
                pool.submit(post_json, url, payload, args.echo)

            now = time.time()
            if now - last_stats >= 5.0:
                with _lock:
                    posted = _count
                rate_post = (posted - posted_at_last_stats) / (now - last_stats)
                print(f"[bridge] received {seen}, posted {posted} ({rate_post:.1f} Hz)", flush=True)
                last_stats = now
                posted_at_last_stats = posted

    except KeyboardInterrupt:
        print('\n[bridge] stopping...', flush=True)
    finally:
        ser.close()
        pool.shutdown(wait=False)
    return 0


if __name__ == '__main__':
    sys.exit(main())
