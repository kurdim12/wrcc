#!/usr/bin/env python3
"""Record labelled 16 kHz mono clips for fine-tuning + honest validation (§9.10).

The single highest-value data action: capture YOUR mic in YOUR conditions. Metrics
on real INMP441 audio in a real palm setting are far more credible to a judge than
any proxy AUC.

Two capture routes (pick one):
  A) HOST AUDIO  (default): the INMP441 (or any mic tapping the trunk) is on a
     host audio input. Records from the default input device.
  B) UDP STREAM: a firmware mode streams raw PCM16 @16 kHz to a UDP port; pass
     --udp PORT and this writes it to clips. (Firmware UDP mode is a small future
     addition — documented in docs/BENCH_BRINGUP.md.)

Clips land under ml/data/raw/own/<label>/ named so prepare/standardize.py groups
them by recording_id (one --session = one recording = one split group).

Examples:
    # 20 x 3s "clean" farm-ambient clips from the default input device
    python tools/record_inmp441.py --label clean --session ambientA --clips 20

    # "activity": scrape/knock a palm log near the mic, or controlled insects
    python tools/record_inmp441.py --label activity --session logtapB --clips 20

Then: cd ml && python -m prepare.standardize --in data/raw/own/activity --label activity --source own
                python -m prepare.standardize --in data/raw/own/clean    --label clean    --source own
"""
from __future__ import annotations

import argparse
import sys
import wave
from pathlib import Path

SR = 16000


def write_wav(path: Path, pcm16_bytes: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm16_bytes)


def record_host(args):
    try:
        import sounddevice as sd
        import numpy as np
    except ImportError:
        print("Host capture needs sounddevice + numpy:\n"
              "  pip install sounddevice numpy\n"
              "(or use --udp with the firmware UDP stream mode).", file=sys.stderr)
        return 1
    out = Path(args.out) / args.label
    print(f"[rec] device-input @ {SR} Hz mono · {args.clips}×{args.seconds}s · -> {out}")
    print("[rec] press Ctrl+C to stop early")
    try:
        for i in range(args.clips):
            print(f"  recording clip {i+1}/{args.clips} ({args.seconds}s)…", flush=True)
            audio = sd.rec(int(args.seconds * SR), samplerate=SR, channels=1, dtype="int16")
            sd.wait()
            write_wav(out / f"own_{args.session}_{i:03d}.wav", audio.tobytes())
    except KeyboardInterrupt:
        print("\n[rec] stopped.")
    print(f"[rec] done -> {out}")
    return 0


def record_udp(args):
    import socket
    out = Path(args.out) / args.label
    bytes_per_clip = int(args.seconds * SR) * 2
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", args.udp))
    print(f"[rec] UDP PCM16 @ {SR} Hz on :{args.udp} · {args.clips}×{args.seconds}s -> {out}")
    try:
        for i in range(args.clips):
            buf = bytearray()
            while len(buf) < bytes_per_clip:
                data, _ = sock.recvfrom(4096)
                buf.extend(data)
            write_wav(out / f"own_{args.session}_{i:03d}.wav", bytes(buf[:bytes_per_clip]))
            print(f"  wrote clip {i+1}/{args.clips}", flush=True)
    except KeyboardInterrupt:
        print("\n[rec] stopped.")
    finally:
        sock.close()
    return 0


def main():
    ap = argparse.ArgumentParser(description="Record labelled 16 kHz INMP441 clips (§9.10)")
    ap.add_argument("--label", required=True, choices=["activity", "clean"])
    ap.add_argument("--session", required=True, help="recording id / grouping key (one session = one group)")
    ap.add_argument("--clips", type=int, default=20)
    ap.add_argument("--seconds", type=float, default=3.0)
    ap.add_argument("--out", default="ml/data/raw/own")
    ap.add_argument("--udp", type=int, default=0, help="UDP port for firmware PCM stream (0 = host audio)")
    args = ap.parse_args()
    return record_udp(args) if args.udp else record_host(args)


if __name__ == "__main__":
    raise SystemExit(main())
