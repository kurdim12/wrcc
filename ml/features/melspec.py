"""Log-mel patch extraction — byte-for-byte compatible with the firmware.

The firmware (acoustic.cpp) builds an HTK-mel triangular filterbank over the
linear FFT bins (bin i center = i * SR / N_FFT), applies it to the power
spectrum, takes 10*log10, and per-clip mean-var normalizes the 40×32 patch.

We replicate that EXACTLY here (no librosa default filterbank) so a model
trained on these features scores device-emitted patches correctly. The only
freedom is overall gain, which per-clip normalization removes.
"""
from __future__ import annotations

import numpy as np

from .params import SR, N_FFT, HOP, N_MELS, N_FRAMES, FMIN, FMAX, CLIP_SAMPLES, PATCH_SHAPE


def _hz_to_mel(f: np.ndarray | float) -> np.ndarray | float:
    return 2595.0 * np.log10(1.0 + np.asarray(f) / 700.0)


def _mel_to_hz(m: np.ndarray | float) -> np.ndarray | float:
    return 700.0 * (10.0 ** (np.asarray(m) / 2595.0) - 1.0)


def mel_filterbank() -> np.ndarray:
    """(N_MELS, N_FFT//2) triangular HTK filterbank matching acoustic.cpp."""
    n_bins = N_FFT // 2                       # 512 usable bins, center i*SR/N_FFT
    bin_hz = SR / N_FFT
    freqs = np.arange(n_bins) * bin_hz
    mel_pts = np.linspace(_hz_to_mel(FMIN), _hz_to_mel(FMAX), N_MELS + 2)
    hz_pts = _mel_to_hz(mel_pts)
    fb = np.zeros((N_MELS, n_bins), dtype=np.float64)
    for m in range(N_MELS):
        fl, fc, fr = hz_pts[m], hz_pts[m + 1], hz_pts[m + 2]
        for i in range(n_bins):
            f = freqs[i]
            if f <= fl or f >= fr:
                w = 0.0
            elif f <= fc:
                w = (f - fl) / (fc - fl)
            else:
                w = (fr - f) / (fr - fc)
            if w > 0:
                fb[m, i] = w
    return fb


_FB = mel_filterbank()
_WINDOW = 0.5 * (1.0 - np.cos(2.0 * np.pi * np.arange(N_FFT) / (N_FFT - 1)))  # Hann


def logmel_patch(samples: np.ndarray) -> np.ndarray:
    """Compute a (40, 32) per-clip mean-var normalized log-mel patch.

    `samples`: 1-D float waveform at SR. Trimmed/padded to CLIP_SAMPLES.
    """
    x = np.asarray(samples, dtype=np.float64).ravel()
    if x.shape[0] < CLIP_SAMPLES:
        x = np.pad(x, (0, CLIP_SAMPLES - x.shape[0]))
    else:
        x = x[:CLIP_SAMPLES]

    patch = np.empty(PATCH_SHAPE, dtype=np.float64)
    for f in range(N_FRAMES):
        start = f * HOP
        frame = x[start:start + N_FFT] * _WINDOW
        spec = np.fft.rfft(frame, n=N_FFT)
        power = (spec.real ** 2 + spec.imag ** 2)[: N_FFT // 2]   # match firmware bin range
        mel_e = _FB @ power
        patch[:, f] = 10.0 * np.log10(np.maximum(mel_e, 1e-10))

    # Per-clip mean-var normalization (identical to firmware + demo generators).
    mean = patch.mean()
    var = max(patch.var(), 1e-6)
    return ((patch - mean) / np.sqrt(var)).astype(np.float32)


def patch_to_flat(patch: np.ndarray) -> list[float]:
    """Band-major flatten (row 0 frames 0..31, row 1 ...), matching the envelope."""
    return np.asarray(patch, dtype=np.float32).reshape(-1).tolist()


def flat_to_patch(flat) -> np.ndarray:
    """Inverse of patch_to_flat: 1280-vector -> (40, 32)."""
    return np.asarray(flat, dtype=np.float32).reshape(PATCH_SHAPE)
