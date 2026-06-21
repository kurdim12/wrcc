#!/usr/bin/env python3
"""Index the prepared corpus into SQLite — metadata only; audio stays as files.

Loads one or more manifests (path,source,label,recording_id,snr_condition[,split])
into a `clips` table so the corpus is queryable: class balance, source mix,
per-noise-condition support (n_recordings / n_clips → the model-card support
floor), split composition, and a label-leak check (a recording with >1 label).

Audio is NOT copied into the DB — a 106 GB corpus belongs on disk; only the
index belongs in SQLite. Idempotent (keyed by `path`), stdlib-only (sqlite3),
so it runs anywhere the manifests exist (your GPU box) with no extra deps. Pass
--durations to also read each wav for duration/sample-rate (slow; needs audio).

Usage:
  # index ASPID (run aspid_prepare first), then print the support tables:
  python -m prepare.manifest_to_db --manifest data/manifest_aspid.csv --db data/corpus.db --report
  # index several corpora at once:
  python -m prepare.manifest_to_db --manifest data/manifest_aspid.csv --manifest data/manifest.csv --db data/corpus.db
  # report only (no ingest):
  python -m prepare.manifest_to_db --db data/corpus.db --report
"""
from __future__ import annotations

import argparse
import csv
import sqlite3
import time
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS clips (
  path           TEXT PRIMARY KEY,        -- relative wav path (the file itself stays on disk)
  source         TEXT NOT NULL,           -- aspid | esc50 | inmp441 | toy | ...
  label          TEXT NOT NULL,           -- activity | clean
  recording_id   TEXT NOT NULL,           -- group key — no clip from one recording spans two splits
  snr_condition  TEXT,                    -- ASPID noise condition (silence/helicopter/...) or null
  split          TEXT,                    -- train | val | test | null (assigned by train.py)
  duration_s     REAL,                    -- optional (--durations)
  sample_rate    INTEGER,                 -- optional (--durations)
  ingested_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clips_rec   ON clips(recording_id);
CREATE INDEX IF NOT EXISTS idx_clips_label ON clips(label);
CREATE INDEX IF NOT EXISTS idx_clips_cond  ON clips(snr_condition);
CREATE INDEX IF NOT EXISTS idx_clips_src   ON clips(source);
"""

UPSERT = """
INSERT INTO clips(path,source,label,recording_id,snr_condition,split,duration_s,sample_rate,ingested_at)
VALUES(:path,:source,:label,:recording_id,:snr_condition,:split,:duration_s,:sample_rate,:ingested_at)
ON CONFLICT(path) DO UPDATE SET
  source=excluded.source, label=excluded.label, recording_id=excluded.recording_id,
  snr_condition=excluded.snr_condition,
  split=COALESCE(excluded.split, clips.split),
  duration_s=COALESCE(excluded.duration_s, clips.duration_s),
  sample_rate=COALESCE(excluded.sample_rate, clips.sample_rate),
  ingested_at=excluded.ingested_at
"""


def connect(db: str) -> sqlite3.Connection:
    Path(db).parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db)
    con.executescript(SCHEMA)
    return con


def ingest(con: sqlite3.Connection, manifest: str, want_dur: bool) -> int:
    rows = list(csv.DictReader(Path(manifest).open(newline="")))
    sf = None
    if want_dur:
        import soundfile as sf  # only needed (and imported) when reading audio
    now = int(time.time())
    n = 0
    for r in rows:
        path = (r.get("path") or "").strip()
        if not path:
            continue
        dur = sr = None
        if want_dur:
            try:
                info = sf.info(path)
                dur, sr = round(info.frames / info.samplerate, 3), info.samplerate
            except Exception:
                pass
        con.execute(UPSERT, {
            "path": path,
            "source": r.get("source") or "unknown",
            "label": r.get("label") or "unknown",
            "recording_id": r.get("recording_id") or path,
            "snr_condition": (r.get("snr_condition") or None),
            "split": (r.get("split") or None),
            "duration_s": dur, "sample_rate": sr, "ingested_at": now,
        })
        n += 1
    con.commit()
    return n


def report(con: sqlite3.Connection) -> None:
    cur = con.cursor()
    total, recs = cur.execute("SELECT COUNT(*), COUNT(DISTINCT recording_id) FROM clips").fetchone()
    print(f"\n=== corpus index ===  clips: {total}   recordings: {recs}")
    if total == 0:
        print("(empty — ingest a manifest first)")
        return

    print("\n-- by source --")
    print(f"{'source':12}{'clips':>9}{'recs':>8}{'activity':>10}{'clean':>8}")
    for s, c, r, a, cl in cur.execute(
        """SELECT source, COUNT(*), COUNT(DISTINCT recording_id),
                  SUM(label='activity'), SUM(label='clean')
           FROM clips GROUP BY source ORDER BY source"""):
        print(f"{s:12}{c:>9}{r:>8}{(a or 0):>10}{(cl or 0):>8}")

    print("\n-- by label --")
    for l, c, r in cur.execute(
        "SELECT label, COUNT(*), COUNT(DISTINCT recording_id) FROM clips GROUP BY label ORDER BY label"):
        print(f"{l:12} clips={c:<9} recordings={r}")

    print("\n-- by noise condition (model-card support table; lock the floor from these) --")
    print(f"{'condition':16}{'recs':>7}{'clips':>9}{'activity':>10}{'clean':>8}")
    for cond, r, c, a, cl in cur.execute(
        """SELECT COALESCE(snr_condition,'(none)'), COUNT(DISTINCT recording_id), COUNT(*),
                  SUM(label='activity'), SUM(label='clean')
           FROM clips GROUP BY snr_condition ORDER BY COUNT(*) DESC"""):
        print(f"{str(cond):16}{r:>7}{c:>9}{(a or 0):>10}{(cl or 0):>8}")

    print("\n-- by split --")
    for sp, c, r in cur.execute(
        "SELECT COALESCE(split,'(unassigned)'), COUNT(*), COUNT(DISTINCT recording_id) FROM clips GROUP BY split ORDER BY split"):
        print(f"{sp:14} clips={c:<9} recordings={r}")

    bad = cur.execute(
        "SELECT recording_id, COUNT(DISTINCT label) d FROM clips GROUP BY recording_id HAVING d>1").fetchall()
    if bad:
        print(f"\n⚠️  {len(bad)} recording(s) carry >1 label (labeling/leak risk): {[b[0] for b in bad[:5]]}")
    else:
        print("\nok  every recording_id maps to a single label (no label leak)")


def main() -> int:
    ap = argparse.ArgumentParser(description="Index prepared manifests into SQLite (metadata only)")
    ap.add_argument("--manifest", action="append", default=[], help="manifest CSV (repeatable)")
    ap.add_argument("--db", default="data/corpus.db")
    ap.add_argument("--durations", action="store_true", help="read each wav for duration/sample_rate (slow; needs audio)")
    ap.add_argument("--report", action="store_true", help="print summary tables after ingest")
    args = ap.parse_args()

    con = connect(args.db)
    for m in args.manifest:
        n = ingest(con, m, args.durations)
        print(f"[db] {m}: {n} rows -> {args.db}")
    if args.report or not args.manifest:
        report(con)
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
