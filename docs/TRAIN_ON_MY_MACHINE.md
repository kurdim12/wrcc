# Train the Palm Guard model on my machine — Claude Code runbook

**How to use:** clone the repo on your GPU/dev box, open **Claude Code** in the
repo root, and say: *"Follow `docs/TRAIN_ON_MY_MACHINE.md` end to end."* Claude
Code has terminal + filesystem + git here, so it runs every step itself — confirm
prompts as they come. This produces a **proxy** acoustic model + real proxy
metrics and fills `ml/model_card.md`. It never fabricates a number.

---

## Step 0 — get the project onto this machine (DO THIS FIRST)
The training code (`ml/prepare/…`, `ml/train/…`, etc.) lives **in the repo**, so
clone it before anything else. In a terminal (PowerShell / cmd / bash) with `git`:
```bash
git clone https://github.com/kurdim12/wrcc.git
cd wrcc
git checkout claude/elegant-keller-aurxdw      # branch with the latest work
```
- **Private repo?** Authenticate first: `gh auth login` (GitHub CLI), or paste a
  GitHub Personal Access Token when `git` prompts for a password.
- **No git installed?** Install it (`winget install Git.Git` on Windows) — or
  download the repo ZIP from GitHub and unzip it, then `cd` in.

Then **open Claude Code inside the `wrcc/` folder** (`claude` in that directory)
so it can see every file. All commands below assume you're in the repo, and the
`python -m …` commands run from inside `ml/` (Step 1 does `cd ml`).

## 0. Hard rules (do not violate)
1. **No fabricated metrics.** Every number is a **PROXY** metric on a grouped
   held-out split of open proxy corpora — **never** "RPW accuracy" / field-proven.
   Fill `ml/model_card.md` only from the real `eval_report/metrics.json`.
2. **Licenses:** ASPID = MIT (OK). ESC-50 = CC BY-NC (**augmentation only**, never
   a class, never republished). InsectSound1000 = CC BY 4.0 but **DO NOT USE** (no
   clean/negative class — folding a fake negative would break rule 1).
3. **Safety untouched:** do not change the dose engine / dose FSM / caps / nonce.
4. **Git:** work on branch `claude/elegant-keller-aurxdw`. **Never commit corpora,
   audio, or `data/*.db`** (they're gitignored — keep them so). Do **not** merge to
   `main` or open a PR without explicit human approval.
5. **If anything is ambiguous — a dataset slug, a CSV column, a license — STOP and
   ask.** Do not guess.

---

## 1. Machine setup

Detect the OS and pick one path. This model is a **small CNN (40×32 log-mel)** —
**CPU is perfectly adequate**; the GPU only speeds training, and the 106 GB
download + preprocessing dominate wall-clock either way.

### Path A — native Windows + CPU (most reliable; recommended if WSL fights you)
> Native-Windows TensorFlow is **CPU-only** (GPU support dropped after TF 2.10) —
> the 3070 sits idle, and that's fine here.
```powershell
cd ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1            # cmd.exe: .venv\Scripts\activate
pip install -r requirements-train.txt
pip install kaggle
python -c "import tensorflow as tf; print('TF', tf.__version__)"
```

### Path B — WSL2 + GPU (RTX 3070; optional speedup)
See `docs/RUN_ON_WINDOWS.md` for WSL2 install + the `0x80072ee7` fixes. Then,
**inside Ubuntu**:
```bash
cd ml && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-train.txt 'tensorflow[and-cuda]' kaggle
python -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"  # should list the 3070
```
(Don't install a Linux NVIDIA driver — WSL2 uses the Windows driver.)

**Disk:** ASPID is ~106 GB and roughly doubles while unzipping — keep **≥ 150 GB
free**; delete the `.zip` after extracting.

---

## 2. Get the data

```bash
# ASPID (primary proxy, MIT). Needs a Kaggle token at ~/.kaggle/kaggle.json
#   (Windows: %USERPROFILE%\.kaggle\kaggle.json). Get it at kaggle.com/settings.
kaggle datasets download -d dkadyrov/stored-product-insect-database-spidb-aspids -p data/raw/aspid
#   then unzip into data/raw/aspid/  (Linux: unzip ...  | Windows: tar -xf ...\*.zip -C data\raw\aspid)

# ESC-50 (noise augmentation only, CC BY-NC)
git clone https://github.com/karoldvl/ESC-50 data/raw/esc50    # gives data/raw/esc50/audio/

# InsectSound1000 — DO NOT download for training (unused; no negative class).
```
The ASPID zip extracts a folder containing `aspids/aspids_log.csv` + the WAVs.
Note where `aspids_log.csv` lands — you point `--log` at it next.

---

## 3. Prepare + index (CONFIRM the schema first)

```bash
# 3a) INSPECT — read the printed target->label mapping. ASPID's `target` column
#     mixes species, a "No Insects" control, AND non-insect distractors
#     ("Talking","Sweep"). The tool prints a ⚠️ if a non-insect target would map
#     to 'activity' — if so, add it to --negative-targets before ingesting.
python -m prepare.aspid_prepare --log data/raw/aspid/aspids/aspids_log.csv --inspect

# 3b) BUILD the manifest. Default policy folds distractors into 'clean' as HARD
#     NEGATIVES (precision-favoring: a loud non-insect sound must NOT read as
#     activity). Use --negative-policy drop to exclude them instead.
python -m prepare.aspid_prepare --log data/raw/aspid/aspids/aspids_log.csv \
    --clean-match "No Insects" --negative-targets "talking,sweep" \
    --negative-policy clean --manifest data/manifest_aspid.csv

# 3c) INDEX into SQLite + print the support tables (class balance + per-noise-
#     condition n_recordings/n_clips — needed for the model-card support floor;
#     also runs a label-leak check).
python -m prepare.manifest_to_db --manifest data/manifest_aspid.csv --db data/corpus.db --report
```
**Record the `--report` output** — you'll paste it back, and it sets the
support-floor row counts in the model card.

---

## 4. Train, evaluate, export

```bash
python -m train.train --manifest data/manifest_aspid.csv \
    --esc50 data/raw/esc50/audio --version cnn-aspid-v1
#   → writes eval_report/metrics.json (ROC-AUC, PR-AUC, confusion, per-condition)
#     + export/model.keras + export/saved_model. Grouped (recording-level) split.

python -m export.export_tflite --saved export/saved_model --manifest data/manifest_aspid.csv
#   → export/model_int8.tflite (stretch; for esp-tflite-micro)
```
- Do **not** hand-edit `metrics.json`. If training fails, report the real error;
  never stub numbers to "make it pass."
- Sanity-check serving picks up the trained model:
  `python -c "import serve.app as a; print(a._model_version, a._model_loaded)"`
  → expect `cnn-aspid-v1 True`.

---

## 5. Fill the model card (from real numbers only)

Open `ml/model_card.md` and fill **only** the `____` / `__` placeholders, sourced
from `eval_report/metrics.json` and the §3c report:
- **Run provenance:** model version, the `--negative-policy` used, threshold.
- **Headline metrics + confusion matrix** (all tagged proxy).
- **Threshold — precision-favoring:** pick the operating point off the proxy PR
  curve as *target precision → resulting recall (cost) → chosen threshold*. A
  false positive pesticides a healthy palm, so favor precision; state the recall
  it costs. (Dosing is human-confirmed + capped regardless — the model is one
  gate, not the trigger.)
- **Per-noise-condition table:** it's a **noise condition**, not a measured SNR —
  do not relabel. Report a condition as its own row only if it clears the support
  floor in the **test** split (start: ≥ 6–8 recordings AND ≥ 50 clips; set the
  real floor from §3c); fold sparser conditions into `other`. Keep
  `n_recordings`/`n_clips` visible on every row.
- Leave the top **Honesty summary** as-is (it's already correct).

Then update the report/audit to match the shipped state:
- `docs/PROJECT_REPORT.md` §3.7/§4 and `docs/CLAIMS_AUDIT.md`: a **proxy** model
  now exists — replace "no trained model / no metrics" wording with the real
  **proxy** numbers, **keeping** "proxy-validated, not field-validated."
- Verify the dashboard shows the model version + a proxy badge (no accuracy %).

---

## 6. Commit + hand back

```bash
git checkout claude/elegant-keller-aurxdw
git add ml/model_card.md docs/PROJECT_REPORT.md docs/CLAIMS_AUDIT.md
#   NOTE: data/, *.db, export/* are gitignored — do NOT force-add corpora/artifacts.
git commit -m "ml: trained proxy model cnn-aspid-v1 + real proxy metrics in model_card"
git push -u origin claude/elegant-keller-aurxdw
```
**Do not merge to `main` without approval.**

Paste back to the chat: **(1)** `eval_report/metrics.json`, **(2)** the
`manifest_to_db --report` output, **(3)** which `--negative-policy` you used. With
those, the card/report finalization (threshold justification, support-gated table)
is mechanical and honest.

---

## 7. Acceptance checklist
- [ ] Schema confirmed via `--inspect`; no ⚠️ (distractors handled explicitly).
- [ ] `data/manifest_aspid.csv` built; `data/corpus.db --report` captured.
- [ ] `eval_report/metrics.json` exists from a **real** run (grouped split).
- [ ] `export/model.keras` (+ `model_int8.tflite`) produced; serve loads
      `cnn-aspid-v1`.
- [ ] `ml/model_card.md` filled from that file — every number proxy; threshold
      precision-favoring; per-condition table support-gated.
- [ ] Report/CLAIMS_AUDIT updated to the proxy reality (still not field-validated).
- [ ] Committed to `claude/elegant-keller-aurxdw`; no corpora/audio/.db committed;
      not merged to main.

## 8. Never do
- Never write a metric you didn't measure, or call any proxy number "RPW accuracy."
- Never use InsectSound1000 for training, or fold ESC-50 into a class, or
  republish either.
- Never change the dose-safety code; never merge to `main` / open a PR unprompted.
- Never invent a dataset slug, column meaning, or license — confirm or STOP.
