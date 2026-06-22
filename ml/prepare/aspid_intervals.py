#!/usr/bin/env python3
"""ASPID *raw research export* adapter — time-INTERVAL driven (not filename driven).

The canonical filename-indexed ASPID (one WAV per CSV row) is handled by
`aspid_prepare.py`. THIS adapter handles the raw export where:

  * `aspids_log.csv` is a sparse experiment log: columns
    `start,end,target,material,description,noise` — time INTERVALS, NO filename.
  * audio lives in deeply-nested, device-timestamped session dirs
    (`.../<corrected-date>/[<device-date>/]<ts>_t00100/<ts>_ChN_NNNNN.wav`),
    multi-channel, pre-segmented; ~11.7k WAVs across ~1.09k sessions.

Mapping: every WAV filename begins with its recording timestamp
(`YYYY_MM_DD_HH_MM_SS.mmm`). We parse that, find the single CSV row whose
[start,end] interval contains it, and inherit that row's `target` + `noise`.
This is deterministic — no guessing. A recorder-clock glitch affected only 2 of
1091 sessions (device clock read 2023-03-30/31 instead of 2023-05-17); those
device-dated files fall on a date with NO log rows and so drop out naturally,
while their corrected `Processed/` copies align. Verified: 1089/1091 sessions
have device-date == corrected-folder-date.

Labels reuse aspid_prepare.classify() (clean / activity / drop). Per the
--inspect warning on this corpus, the non-insect distractor `target`s
(`Noise NN dB`, `White Noise - NN dB`, `Ronald Reagan Speech`, `Talking`,
`Sweep`) must be folded into `clean` as HARD NEGATIVES (precision-favoring) — so
the default --negative-targets here is broader than aspid_prepare's.

GROUPING (§9.4): recording_id = the logged INTERVAL (one experimental condition).
All channels/segments/sessions inside one 5-min logged interval stay in one split
— no leakage of a recording across train/val/test.

Run --dry-run FIRST (timestamp alignment + label/noise tallies, NO audio I/O):
    python -m prepare.aspid_intervals --log "<...>/aspids_log.csv" \
        --audio-root "<...>" --dry-run
Then the real ingest (resample + window + write clips + manifest):
    python -m prepare.aspid_intervals --log "<...>/aspids_log.csv" \
        --audio-root "<...>" --manifest data/manifest_aspid.csv
"""
from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

from features.params import SR, CLIP_SAMPLES
from prepare.aspid_prepare import classify, slug
from prepare.standardize import load_resampled, window

# WAV filename / session-dir timestamp prefix: 2023_05_24_19_41_19.559
TS_RE = re.compile(r"(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})(?:\.(\d+))?")

# Broadened defaults for the raw export's distractor vocabulary (see module doc).
DEFAULT_NEG = "talking,sweep,noise,speech,reagan"


def parse_ts(name: str):
    m = TS_RE.match(name)
    if not m:
        return None
    y, mo, d, h, mi, s, frac = m.groups()
    micro = int((frac or "0").ljust(6, "0")[:6])
    try:
        return datetime(int(y), int(mo), int(d), int(h), int(mi), int(s), micro)
    except ValueError:
        return None


def load_intervals(log: Path):
    """CSV rows -> list of dicts with parsed start/end datetimes, indexed by date."""
    rows = list(csv.DictReader(log.open(newline="")))
    intervals = []
    for i, r in enumerate(rows):
        try:
            a = datetime.strptime(r["start"].strip(), "%Y-%m-%d %H:%M:%S")
            b = datetime.strptime(r["end"].strip(), "%Y-%m-%d %H:%M:%S")
        except (ValueError, KeyError, AttributeError):
            continue
        intervals.append({"idx": i, "start": a, "end": b,
                          "target": r.get("target"), "noise": r.get("noise")})
    by_date = {}
    for iv in intervals:
        by_date.setdefault(iv["start"].date(), []).append(iv)
    return intervals, by_date


def match_interval(ts: datetime, by_date):
    """Return the interval whose [start,end] contains ts, else None."""
    for iv in by_date.get(ts.date(), ()):  # log uses corrected wall-clock dates
        if iv["start"] <= ts <= iv["end"]:
            return iv
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="ASPID raw export (interval-driven) -> clips + manifest")
    ap.add_argument("--log", required=True)
    ap.add_argument("--audio-root", required=True, help="dir containing the *_t00100 session WAVs")
    ap.add_argument("--out", default="data/clips_aspid")
    ap.add_argument("--manifest", default="data/manifest_aspid.csv")
    ap.add_argument("--clean-match", default="No Insects")
    ap.add_argument("--negative-targets", default=DEFAULT_NEG,
                    help="comma-sep substrings in target marking NON-INSECT distractors")
    ap.add_argument("--negative-policy", choices=("clean", "drop"), default="clean")
    ap.add_argument("--channel", default="Ch0",
                    help="substring to keep ONE mic channel (ASPID has Ch0..Ch7 near-duplicate "
                         "mics); '' keeps all. Default Ch0 to drop 8x redundancy.")
    ap.add_argument("--overlap", type=float, default=0.5)
    ap.add_argument("--max-clips-per-wav", type=int, default=48,
                    help="cap clips from one recording so long files don't dominate (0=unlimited)")
    ap.add_argument("--limit", type=int, default=0, help="process at most N wavs (testing)")
    ap.add_argument("--dry-run", action="store_true",
                    help="alignment + label/noise tallies only; NO audio I/O, NO manifest write")
    args = ap.parse_args()

    clean_lc = args.clean_match.lower()
    neg_subs = [s.strip().lower() for s in args.negative_targets.split(",") if s.strip()]

    log, root = Path(args.log), Path(args.audio_root)
    intervals, by_date = load_intervals(log)
    print(f"[aspid-iv] {len(intervals)} log intervals across {len(by_date)} dates")

    wavs = sorted(root.rglob("*.wav"))
    if args.channel:
        wavs = [w for w in wavs if args.channel in w.name]
    if args.limit:
        wavs = wavs[: args.limit]
    print(f"[aspid-iv] {len(wavs)} wav files under {root}"
          f"{f' (channel filter {args.channel!r})' if args.channel else ''}")

    # ── Alignment pass (always; cheap — just filename timestamps) ──
    no_ts = unmatched = dropped_label = 0
    matched = []                                   # (wav, interval, label)
    grp_labels, cond_wavs, label_wavs = {}, Counter(), Counter()
    for w in wavs:
        ts = parse_ts(w.name)
        if ts is None:
            no_ts += 1; continue
        iv = match_interval(ts, by_date)
        if iv is None:
            unmatched += 1; continue
        label = classify(iv["target"], clean_lc, neg_subs, args.negative_policy)
        if label is None:                          # distractor under --negative-policy drop
            dropped_label += 1; continue
        rec = f"aspid:iv{iv['idx']:03d}"           # group = logged interval (leak-safe)
        matched.append((w, ts, iv, label, rec))
        label_wavs[label] += 1
        cond_wavs[slug(iv["noise"])] += 1
        grp_labels.setdefault(rec, label)

    print(f"\n[aspid-iv] wavs aligned to an interval: {len(matched)}")
    print(f"[aspid-iv]   no-timestamp: {no_ts}   unmatched (no log interval): {unmatched}"
          f"   distractor-dropped: {dropped_label}")
    print(f"[aspid-iv] groups (intervals with >=1 aligned wav): {len(grp_labels)}")
    print(f"[aspid-iv] label distribution (wavs):  {dict(label_wavs)}")
    print(f"[aspid-iv] group distribution (intervals): {dict(Counter(grp_labels.values()))}")
    print("\n[aspid-iv] per-noise-condition (aligned wav count):")
    for cond, n in cond_wavs.most_common():
        print(f"     {cond:18} {n}")
    if matched[:3]:
        print("\n[aspid-iv] example alignments:")
        for w, ts, iv, label, rec in matched[:3]:
            print(f"     {w.name[:40]:40} -> {iv['target']!r}/{iv['noise']!r} = {label} [{rec}]")

    if args.dry_run:
        print("\n[aspid-iv] DRY RUN — no audio processed, no manifest written.")
        return 0

    # ── Ingest pass: resample + window each aligned wav -> clips + manifest ──
    import soundfile as sf
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    man = Path(args.manifest); man.parent.mkdir(parents=True, exist_ok=True)
    new = not man.exists()
    hop = max(1, int(CLIP_SAMPLES * (1.0 - args.overlap)))
    n_clips = skipped = 0
    with man.open("a", newline="") as mf:
        wr = csv.writer(mf)
        if new:
            wr.writerow(["path", "source", "label", "recording_id", "snr_condition"])
        for i, (w, ts, iv, label, rec) in enumerate(matched):
            try:
                y = load_resampled(w)
            except Exception as e:
                skipped += 1; print(f"  skip {w.name}: {e}"); continue
            keep = int((iv["end"] - ts).total_seconds() * SR)   # only audio within the logged window
            if keep <= 0:
                continue
            y = y[:keep]
            cond = slug(iv["noise"])
            for j, clip in enumerate(window(y, hop)):
                if args.max_clips_per_wav and j >= args.max_clips_per_wav:
                    break
                cp = out / f"{rec.replace(':', '_')}_{i:06d}_{j:03d}.wav"
                sf.write(str(cp), clip, SR, subtype="PCM_16")
                wr.writerow([str(cp), "aspid", label, rec, cond])
                n_clips += 1
    print(f"\n[aspid-iv] wrote {n_clips} clips -> {args.manifest} "
          f"(from {len(matched)} wavs, {skipped} unreadable)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
