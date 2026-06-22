# Train a proxy model WITHOUT downloading a big corpus — Claude Code runbook (streaming)

**When to use:** you can't / don't want to download ASPID (~106 GB). This streams
**ESC-50 from Hugging Face** (no bulk local copy) and trains the Palm Guard CNN on
log-mel features computed on the fly. It is a **fallback** — read the honesty box.

> ### ⚠️ Honesty box — this is a WEAK proxy
> ESC-50's only insect class is **flying insects (wingbeats)** — acoustically
> *nothing* like RPW larvae chewing inside a trunk, and it's just **40 positive
> clips**. So this trains a real model + real numbers, but they are a **weak
> proxy** (ESC-50 "insect vs non-insect"), reported as proxy, **never** "RPW
> accuracy." ESC-50 is **CC BY-NC** (non-commercial) — research/demo only.
> For a *real* proxy with a tiny download, prefer **TreeVibes**
> (`kaggle datasets download -d potamitis/treevibes`). For zero data at all, the
> repo's `ml/prepare/make_toy_corpus.py` runs the pipeline on synthetic audio
> (smoke test only — label it "toy", not evidence).

## 0. Hard rules
1. **No fabricated metrics** — fill `ml/model_card.md` only from the real
   `eval_report/metrics.json` this produces; tag every number proxy + name the source.
2. **License:** ESC-50 = CC BY-NC → augmentation/research/demo only; do not
   republish it and do not present it as a commercial validation.
3. **Safety code untouched** (dose engine / FSM / caps / nonce).
4. **Git:** branch `claude/elegant-keller-aurxdw`; never commit audio or
   `data/*.npz` / `export/*` (gitignored); do not merge to `main` / open a PR
   without approval.
5. **Ambiguous schema/field name? STOP and inspect** (Step 2 prints one example).

## 1. Setup (no big download — just packages)
```bash
git clone https://github.com/kurdim12/wrcc.git && cd wrcc      # if not already cloned
cd ml && python -m venv .venv
# Windows: .\.venv\Scripts\Activate.ps1   |   Linux/WSL: source .venv/bin/activate
pip install -r requirements-train.txt "datasets>=2.19" soundfile librosa huggingface_hub
huggingface-cli whoami        # should print your HF user; else: huggingface-cli login
```
All `python` commands below run **from inside `ml/`** (so `features`/`train` import).

## 2. Inspect the stream, then cache tiny features  →  create `ml/prepare/stream_esc50.py`
Streaming + `cast_column(Audio(16000))` decodes audio in memory at 16 kHz — no WAV
files are kept. We persist only a tiny features file (~a few MB).

```python
# ml/prepare/stream_esc50.py  — REVIEW before running; untested in CI.
import numpy as np
from datasets import load_dataset, Audio
from features.params import SR                 # 16000
from features.melspec import logmel_patch       # -> (40,32) float32, firmware-matched

ds = load_dataset("ashraq/esc50", split="train", streaming=True)
ds = ds.cast_column("audio", Audio(sampling_rate=SR))

# INSPECT first (confirm field names: expect 'category' (str), 'fold' (int), 'audio')
first = next(iter(ds)); print({k: type(v).__name__ for k, v in first.items()}); print("category=", first["category"])

NEG_PER_POS = 3                                 # subsample 'clean' to ~3:1 (ESC-50 is 49:1 otherwise)
X, y, groups, npos = [], [], [], 0
for ex in load_dataset("ashraq/esc50", split="train", streaming=True).cast_column("audio", Audio(sampling_rate=SR)):
    cat = str(ex["category"]).lower()
    label = 1 if "insect" in cat else 0
    X.append(logmel_patch(np.asarray(ex["audio"]["array"], dtype=np.float32)))
    y.append(label); groups.append(int(ex["fold"]))
    if label: npos += 1
X = np.asarray(X, np.float32); y = np.asarray(y, np.int32); groups = np.asarray(groups, np.int32)
# balance negatives down to NEG_PER_POS * npos, preserving folds
rng = np.random.default_rng(0)
neg_idx = np.where(y == 0)[0]; keep_neg = rng.choice(neg_idx, size=min(len(neg_idx), NEG_PER_POS*npos), replace=False)
keep = np.concatenate([np.where(y == 1)[0], keep_neg]); keep.sort()
np.savez("data/esc50_features.npz", X=X[keep], y=y[keep], groups=groups[keep])
print(f"cached {keep.size} clips  ({npos} positive)  -> data/esc50_features.npz")
```
```bash
mkdir -p data && python -m prepare.stream_esc50
```
> If the printed schema lacks `category`/`fold`/`audio`, **stop and adjust the
> field names** to whatever the inspect line shows.

## 3. Train / eval / export  →  create `ml/train/train_stream.py`
Grouped split by ESC-50 `fold` (test = fold 5) so no clip leaks across the split.

```python
# ml/train/train_stream.py  — REVIEW before running.
import json, os, numpy as np, tensorflow as tf
from sklearn.metrics import roc_auc_score, average_precision_score, confusion_matrix, precision_recall_curve
from train.model import build_model

d = np.load("data/esc50_features.npz"); X = d["X"][..., None]; y = d["y"]; g = d["groups"]
te = g == 5; Xtr, ytr, Xte, yte = X[~te], y[~te], X[te], y[te]
cw = {0: 1.0, 1: float((ytr == 0).sum()) / max(int((ytr == 1).sum()), 1)}   # weight the rare positive
m = build_model(); m.fit(Xtr, ytr, epochs=25, batch_size=16, validation_split=0.15, class_weight=cw, verbose=2)

p = m.predict(Xte, verbose=0).ravel()
roc = float(roc_auc_score(yte, p)); pr = float(average_precision_score(yte, p))
# precision-favoring threshold: smallest thr reaching >=0.8 precision (else 0.5)
prec, rec, thr = precision_recall_curve(yte, p); thr = np.append(thr, 1.0)
ok = np.where(prec >= 0.8)[0]; T = float(thr[ok[0]]) if len(ok) else 0.5
cm = confusion_matrix(yte, (p >= T).astype(int)).tolist()
os.makedirs("eval_report", exist_ok=True)
json.dump({"model_version": "cnn-esc50-stream-v1", "proxy": True, "field_validated": False,
           "source": "ashraq/esc50 (CC BY-NC) streamed; insect vs non-insect — WEAK proxy, not RPW",
           "roc_auc": roc, "pr_auc": pr, "threshold": T, "confusion_matrix": cm,
           "n_test": int(te.sum()), "n_test_pos": int(yte.sum())},
          open("eval_report/metrics.json", "w"), indent=2)
os.makedirs("export", exist_ok=True); m.save("export/model.keras"); m.export("export/saved_model")
print(json.load(open("eval_report/metrics.json")))
```
```bash
python -m train.train_stream
python -m export.export_tflite --saved export/saved_model     # optional int8 (stretch)
python -c "import serve.app as a; print(a._model_version, a._model_loaded)"   # serve should load it
```

## 4. Fill the model card (real numbers only)
In `ml/model_card.md` fill from `eval_report/metrics.json`: version
`cnn-esc50-stream-v1`, source = ESC-50 (CC BY-NC, streamed), the ROC/PR-AUC,
the precision-favoring threshold, the confusion matrix, and **prominently** the
weak-proxy + non-commercial caveat (n_test_pos is tiny → high variance). Do not
claim per-noise-condition rows (ESC-50 has none). Keep the Honesty summary.

## 5. Commit (code + card only)
```bash
git checkout claude/elegant-keller-aurxdw
git add ml/prepare/stream_esc50.py ml/train/train_stream.py ml/model_card.md
git commit -m "ml: streaming ESC-50 proxy path (no-download) + weak-proxy metrics in model_card"
git push -u origin claude/elegant-keller-aurxdw
```
**Never** add `data/*.npz` or `export/*` (gitignored). Do not merge to main without approval.
Paste back: `eval_report/metrics.json` (so the card/report wording can be finalized honestly).

## 6. Acceptance
- [ ] HF stream works (Step 2 printed a schema + cached `esc50_features.npz`).
- [ ] `eval_report/metrics.json` from a real run; tagged proxy + source + not-field-validated.
- [ ] `export/model.keras` produced; serve loads `cnn-esc50-stream-v1`.
- [ ] `model_card.md` filled with the weak-proxy + CC BY-NC caveat.
- [ ] Committed to dev; no audio/npz/export committed; not merged to main.
- [ ] You understand this is a **demo-grade weak proxy** — for a stronger one, use TreeVibes/ASPID.
