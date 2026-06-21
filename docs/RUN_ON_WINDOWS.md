# Running the Palm Guard ML pipeline on Windows

Two paths. **Path 1 (native + CPU) is recommended** — it's the fastest way to
make progress and is perfectly adequate for this model (a tiny 40×32 log-mel
CNN; the 106 GB ASPID download + preprocessing dominate wall-clock, not the GPU).
**Path 2 (WSL2 + GPU)** is an optional upgrade if you specifically want the 3070.

> Reality check on Windows + GPU: TensorFlow dropped native-Windows GPU support
> after **2.10**. Any modern `pip install tensorflow` on native Windows runs
> **CPU-only** — the 3070 sits idle. GPU on Windows = **WSL2** (Path 2). For this
> model that's a nice-to-have, not a requirement.

---

## Prerequisites (both paths)

- **Python 3.10–3.12** (TensorFlow's supported range) + `git` on PATH.
- **A Kaggle account + API token** for ASPID: download `kaggle.json` from your
  Kaggle account page and put it at `%USERPROFILE%\.kaggle\kaggle.json`.
- **Disk:** ASPID is **106 GB** to download and roughly doubles while unzipping.
  Budget **≥ ~150 GB free** (≈220 GB comfortable). You can delete the `.zip`
  right after extracting to reclaim ~106 GB. Generated clips are small (~10 GB).

---

## Path 1 — Native Windows + CPU (recommended)

Run in **PowerShell**, from the repo root.

    git checkout claude/elegant-keller-aurxdw
    git pull
    cd ml
    python -m venv .venv
    .\.venv\Scripts\Activate.ps1            # (cmd.exe: .venv\Scripts\activate)
    pip install tensorflow kaggle
    pip install -r requirements-train.txt
    python -c "import tensorflow as tf; print('TF', tf.__version__)"   # CPU build is fine

### Get the data

    # ASPID (~106 GB) — needs %USERPROFILE%\.kaggle\kaggle.json
    kaggle datasets download -d dkadyrov/stored-product-insect-database-spidb-aspids -p data\raw\aspid
    tar -xf data\raw\aspid\stored-product-insect-database-spidb-aspids.zip -C data\raw\aspid
    # ESC-50 (~600 MB, noise augmentation only)
    git clone https://github.com/karoldvl/ESC-50 data\raw\esc50

The ASPID zip extracts a folder containing `aspids\aspids_log.csv` + the WAVs.
Point `--log` at wherever `aspids_log.csv` actually lands (the `--inspect` step
confirms it). InsectSound1000 is **not** downloaded — it stays out of training
(no clean/negative class).

### Prepare → index → train → export

    # 1) CONFIRM the schema first — read the printed target->label mapping. If any
    #    non-insect target (e.g. Talking/Sweep) maps to 'activity', the tool warns;
    #    add it to --negative-targets before ingesting.
    python -m prepare.aspid_prepare  --log data/raw/aspid/aspids/aspids_log.csv --inspect

    # 2) build the manifest + index it (records per-noise-condition support that
    #    locks the model_card floor; also runs a label-leak check)
    python -m prepare.aspid_prepare  --log data/raw/aspid/aspids/aspids_log.csv `
        --clean-match "No Insects" --negative-targets "talking,sweep" --negative-policy clean `
        --manifest data/manifest_aspid.csv
    python -m prepare.manifest_to_db --manifest data/manifest_aspid.csv --db data/corpus.db --report

    # 3) train + evaluate + export (writes eval_report/metrics.json)
    python -m train.train          --manifest data/manifest_aspid.csv --esc50 data/raw/esc50/audio --version cnn-aspid-v1
    python -m export.export_tflite --saved export/saved_model --manifest data/manifest_aspid.csv

> PowerShell line-continuation is a backtick `` ` `` (used above), **not** `\`.
> Python handles the `/` in the path arguments fine on Windows.

### Hand back
Paste `eval_report\metrics.json` + the `manifest_to_db --report` output (the
per-noise-condition `n_recordings`/`n_clips`) and the model card gets filled from
those real numbers — precision-favoring threshold, support-gated table, every
value tagged **proxy**.

---

## Path 2 — WSL2 + GPU (optional upgrade)

Gets the 3070 working **and** lets every Linux command in `PATH_A_AGENT_PROMPT.md`
run verbatim.

In **PowerShell as Administrator**:

    wsl --install -d Ubuntu

If that fails with **`0x80072ee7`** (a network/name-resolution error on the
download — common behind VPN/proxy/firewall):

1. Enable the features, then **REBOOT** (required):

       dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
       dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

2. **Turn off any VPN/proxy** (this is the usual cause — note `wsl --list --online`
   can succeed while the actual package download still fails).
3. Force the download off the Store and retry:

       wsl --update --web-download
       wsl --install -d Ubuntu

If `0x80072ee7` persists, the block is on your network — fall back to **Path 1**.

Once Ubuntu is up, **inside the Ubuntu shell**:

    sudo apt update && sudo apt install -y python3-venv python3-pip git unzip
    cd ml && python3 -m venv .venv && source .venv/bin/activate
    pip install 'tensorflow[and-cuda]'
    python -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"   # should list the 3070

Don't install a Linux NVIDIA driver — WSL2 uses your existing **Windows** driver
(keep it current). Then `pip install -r requirements-train.txt` and follow the
same prepare → index → train → export commands (Linux paths/`source` as in
`PATH_A_AGENT_PROMPT.md`).

---

## Guardrails (unchanged on either path)

- **No fabricated metrics.** Every number is a **proxy** metric; never "RPW
  accuracy." Fill `ml/model_card.md` only from `eval_report/metrics.json`.
- **Licenses:** ASPID MIT · ESC-50 CC BY-NC (augmentation only, never a class,
  never republished) · InsectSound1000 CC BY 4.0 but **unused** (no negative class).
- **Dosing stays human-armed + human-confirmed** with hard caps — don't touch it.
- **Git:** work on `claude/elegant-keller-aurxdw`; no merge to `main` / no PR
  without explicit approval; never commit corpora, audio, or `data/*.db`
  (gitignored).
