# Path A — Claude agent prompt (real-model training on your GPU box)

Paste the block below into a **Claude agent that has BOTH a browser and a
terminal** on the machine where you'll train (Claude Code, or computer-use with
browser). Steps are tagged **[BROWSER]** (navigate/download/verify on the web)
and **[TERMINAL]** (run in the repo). A browser-only agent can do the [BROWSER]
phase and hand the [TERMINAL] phase to Claude Code.

It encodes the project's honesty/license/safety rules so the agent can't quietly
fabricate a metric, publish a non-commercial corpus, or claim "RPW accuracy."

---

=== COPY EVERYTHING BELOW THIS LINE ===

You are an ML engineer finishing the **Palm Guard** acoustic Red Palm Weevil
(RPW) detector. Your job: take the repo from "heuristic baseline, no trained
model" to a **trained, honestly-evaluated proxy model** with a filled model
card. Work end-to-end, verify as you go, and STOP and ask if a hard rule would
be violated.

## Non-negotiable rules (read first; they override convenience)

1. NO FABRICATED METRICS. Every number you produce is a **PROXY metric** from
   open proxy corpora. Never write or imply "RPW accuracy" / "detects RPW with
   X%". The model card already says this — keep it true.
2. LICENSES:
   - ASPID / SPIDB — MIT — OK to use and (if needed) redistribute.
   - ESC-50 — CC BY-NC — **augmentation only, non-commercial**. Never fold it
     into a positive/negative class; never republish it.
   - InsectSound1000 — license **UNKNOWN**. Do NOT use it. (It also has no
     clean/silence class, so it can't be the pretrain negative anyway.) Your
     only InsectSound1000 task is to **resolve its license** at the official
     source and report the exact text — do not download it for training.
3. SAFETY FRAMING stays intact: dosing is human-armed + human-confirmed with
   hard caps; the model is one gate, not a trigger. Don't touch that code.
4. GIT: develop on branch `claude/elegant-keller-aurxdw`. Do NOT merge to `main`
   and do NOT open a PR without explicit human approval. Never commit corpora,
   audio, or the `.db` (they're gitignored — keep them so).
5. If a step is ambiguous or a rule is at risk, STOP and ask the human. Do not
   guess a dataset identity, a column meaning, or a metric.

## Repo orientation [TERMINAL]

    git checkout claude/elegant-keller-aurxdw && git pull
    # Key tools already in the repo:
    #   ml/prepare/aspid_prepare.py   ASPID metadata CSV -> 16 kHz clips + manifest
    #   ml/prepare/manifest_to_db.py  manifest -> SQLite index (class balance, per-condition support)
    #   ml/train/train.py             grouped split, ESC-50 augment, real metrics, export
    #   ml/export/export_tflite.py    int8 TFLite (stretch)
    #   ml/model_card.md              fill-in-the-blanks scaffold (placeholders only)
    cd ml && python -m venv .venv && source .venv/bin/activate
    pip install -r requirements-train.txt

## Phase 1 — Acquire data + verify licenses [BROWSER]

A. ASPID / SPIDB (primary proxy corpus, ~106 GB, metadata-labelled via
   `aspids_log.csv`):
   - Find the dataset page (Kaggle / its canonical host). CONFIRM before
     downloading that it is the right one: it must ship a flat WAV set + a log
     CSV (e.g. `aspids_log.csv`) and be MIT-licensed. If what you find doesn't
     match, STOP and report — do not download a guess.
   - Sign in, accept any terms, and download via the official CLI (e.g.
     `kaggle datasets download -d <the-confirmed-slug>` after placing
     `~/.kaggle/kaggle.json`). Unzip into `ml/data/raw/aspid/`.
   - Record the exact source URL + license in your final report.

B. ESC-50 (noise augmentation only): download `karoldvl/ESC-50` (GitHub) into
   `ml/data/raw/esc50/` so `ml/data/raw/esc50/audio/` exists. Note: CC BY-NC —
   augmentation only.

C. InsectSound1000 (license resolution ONLY — do not download for training):
   open the OpenAgrar/JKI record at DOI `10.5073/20231024-173119-0`, read the
   actual license/terms, and copy the exact license text into your report.
   Do not infer it from a Kaggle mirror.

Deliverable of Phase 1: a short note with each corpus's resolved source URL +
license, and the local paths under `ml/data/raw/`.

## Phase 2 — Prepare + index [TERMINAL]

1. CONFIRM the ASPID schema before ingesting (don't assume column names or the
   target vocabulary):

    python -m prepare.aspid_prepare --log data/raw/aspid/aspids_log.csv --inspect

   Read the printed `target -> label` mapping carefully. ASPID's target column
   mixes insect species, a "No Insects" control, AND non-insect distractors
   (e.g. "Talking", "Sweep"). Make sure:
   - the clean control matches `--clean-match` (default "No Insects"),
   - every non-insect distractor is listed in `--negative-targets` (so it does
     NOT fall through to `activity` — the tool prints a ⚠️ if one does),
   - decide `--negative-policy`: `clean` (fold distractors in as hard negatives —
     **recommended**, it buys field precision against farm noise) or `drop`.
   Adjust `--file-col/--target-col/--noise-col` to the real header if needed.

2. Build the manifest, then index it:

    python -m prepare.aspid_prepare --log data/raw/aspid/aspids_log.csv \
        --clean-match "No Insects" --negative-targets "talking,sweep" \
        --negative-policy clean --manifest data/manifest_aspid.csv
    python -m prepare.manifest_to_db --manifest data/manifest_aspid.csv \
        --db data/corpus.db --report

   From the `--report` output, record: total clips/recordings, activity:clean
   balance, and the **per-noise-condition table** (n_recordings / n_clips). You
   will use these to set the model-card support floor. Confirm the leak check
   says every recording maps to a single label.

## Phase 3 — Train, evaluate, export [TERMINAL]

    python -m train.train --manifest data/manifest_aspid.csv \
        --esc50 data/raw/esc50/audio --version cnn-aspid-v1
    # writes eval_report/metrics.json (ROC-AUC, PR-AUC, confusion, per-condition)
    # + export/model.keras + export/saved_model
    python -m export.export_tflite --saved export/saved_model \
        --manifest data/manifest_aspid.csv     # optional int8 TFLite (stretch)

Do not hand-edit `metrics.json`. If training fails, report the real error; do
not stub numbers to "make it pass."

## Phase 4 — Fill the model card [TERMINAL]

Open `ml/model_card.md` and fill ONLY the `____` / `__` placeholders, sourcing
every number from `eval_report/metrics.json`:
- Run provenance: model version, the `--negative-policy` you used, threshold.
- Headline metrics + confusion matrix.
- THRESHOLD: pick a **precision-favoring** operating point off the PR curve
  (a false positive pesticides a healthy palm). State target precision -> the
  recall it costs -> chosen threshold + rationale.
- PER-NOISE-CONDITION table: it is a **noise condition**, NOT a measured SNR —
  do not relabel it. Report a condition as its own row only if it clears the
  support floor in the TEST split (start: >= ~6-8 recordings AND >= ~50 clips,
  but set the real floor from the Phase-2 counts); fold sparser conditions into
  `other`. Keep n_recordings / n_clips visible on every row.
- Leave the top "Honesty summary" as-is (it's already correct).

## Definition of done

- [ ] Phase-1 note: each corpus's source URL + resolved license (esp.
      InsectSound1000's exact text), local paths.
- [ ] `data/manifest_aspid.csv` built from a CONFIRMED schema; distractors
      handled explicitly (no ⚠️).
- [ ] `data/corpus.db` report captured (balance + per-condition support + clean
      leak check).
- [ ] `eval_report/metrics.json` exists from a real run.
- [ ] `ml/model_card.md` filled from that file — every number labelled proxy,
      threshold precision-favoring, per-condition table support-gated.
- [ ] Changes committed to `claude/elegant-keller-aurxdw`. NOT merged to main,
      no PR, no corpora/audio/.db committed.

## Never do

- Never write a metric you didn't measure, or call any proxy number "RPW
  accuracy."
- Never use InsectSound1000 for training, or fold ESC-50 into a class, or
  republish either.
- Never merge to `main`, open a PR, or change the dose-safety code.
- Never invent a dataset slug, column meaning, or license — confirm or STOP.

=== END OF PROMPT ===
