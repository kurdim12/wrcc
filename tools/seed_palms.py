#!/usr/bin/env python3
"""
Palm Guard - seed the database with a 10x8 grid of palm trees.

Coordinates match the original `code.txt:71-72` reference farm
(lat=31.917632, lng=35.589378 in Al-Qassim Block A, Jordan) so the
satellite view in the dashboard lines up.

Usage:
    python tools/seed_palms.py
    python tools/seed_palms.py --server http://192.168.1.10:4000 --count 80
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import urllib.error
import urllib.request


CENTER_LAT = 31.917632
CENTER_LNG = 35.589378


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Seed Palm Guard with a grid of palms")
    ap.add_argument("--server", default="http://localhost:4000")
    ap.add_argument("--count", type=int, default=80, help="Number of palm rows to seed (10 cols × N/10 rows)")
    ap.add_argument("--farm-id", default="al-qassim-block-a")
    args = ap.parse_args(argv)

    palms = []
    for i in range(args.count):
        col = i % 10
        row = i // 10
        lat_offset = (row - 4) * 0.00015
        lng_offset = (col - 5) * 0.00015
        palms.append({
            "id": f"P-{1000 + i}",
            "lat": CENTER_LAT + lat_offset + random.uniform(0, 0.00002),
            "lng": CENTER_LNG + lng_offset + random.uniform(0, 0.00002),
            "variety": random.choice(["Medjool", "Barhi", "Deglet Nour", "Khalas"]),
            "row_idx": row,
            "col_idx": col,
            "farm_id": args.farm_id,
        })

    url = args.server.rstrip("/") + "/api/v1/palms/bulk"
    body = json.dumps({"palms": palms}).encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        print(f"Seed failed: cannot reach {url} ({e.reason})", file=sys.stderr)
        return 1

    print(f"Seeded {result.get('inserted', '?')} palms into {url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
