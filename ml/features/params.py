"""Canonical feature parameters — the SINGLE SOURCE OF TRUTH shared by:
  - firmware/palmguard-esp32s3/include/config.h   (PG_MEL_* / PG_FFT_N / PG_AUDIO_SR)
  - firmware .../sensors/acoustic.cpp             (HTK mel filterbank)
  - ml/features/melspec.py                        (training + serving features)

If you change ANY value here, change config.h to match (and vice-versa) or the
device-emitted patch and the trained model will disagree (§8.3 / §9.5).
"""

SR        = 16000     # PG_AUDIO_SR
N_FFT     = 1024      # PG_FFT_N
HOP       = 512       # PG_MEL_HOP (50% overlap)
N_MELS    = 40        # PG_MEL_BANDS
N_FRAMES  = 32        # PG_MEL_FRAMES
FMIN      = 200       # PG_MEL_FMIN (Hz)
FMAX      = 8000      # PG_MEL_FMAX (Hz)

# Clip length that yields exactly N_FRAMES frames at hop=HOP with an N_FFT window:
#   samples = HOP*(N_FRAMES-1) + N_FFT
CLIP_SAMPLES = HOP * (N_FRAMES - 1) + N_FFT      # 16384  (~1.02 s @ 16 kHz)
CLIP_SECONDS = CLIP_SAMPLES / SR

PATCH_SHAPE = (N_MELS, N_FRAMES)                 # (40, 32)
PATCH_LEN   = N_MELS * N_FRAMES                  # 1280, band-major flatten

# Feeding-band mel rows (~0.5-4 kHz) used by the heuristic baseline. Derived from
# the HTK mel mapping of FMIN..FMAX; see ml/serve/app.py. Kept here so the demo
# generators (backend/services/demoMode.js, tools/mock_device.py) stay aligned.
FEED_LO = 4
FEED_HI = 30
