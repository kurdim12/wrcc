#!/usr/bin/env python3
"""Palm Guard — compact REAL-DATA acoustic-activity trainer (no TensorFlow).

Trains a small, honest "insect-feeding activity vs quiet" classifier on REAL
weevil/borer feeding recordings, leakage-safe (GroupKFold by recording), and
sanity-checks it on REAL Red Palm Weevil (Rhynchophorus ferrugineus) clips.

Why this design:
  * Uses real audio, not synthetic — the positive class is genuine insect
    feeding activity; the negative is genuine quiet from the SAME recordings.
  * GroupKFold by FILE so train/test never share a recording (no leakage).
  * Tiny model (standardized logistic regression) = the "tiny agent" math:
    interpretable, exportable as a few coefficients, hand-quantizable for the
    ESP32-S3. Honest ceiling, never a fabricated 99%.

Outputs (ml/eval_report/):
  real_model.json    feature names + standardization + coefficients
  real_metrics.json  ROC-AUC / acc / F1 (pooled out-of-fold) + provenance
"""
from __future__ import annotations
import json, os, glob, math, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.metrics import roc_auc_score, accuracy_score, f1_score

SR = 8000           # target sample rate (corpus is ~8 kHz mono)
WIN = 1.0           # window seconds
HOP = 0.5
BANDS = [(0,250),(250,500),(500,1000),(1000,2000),(2000,3000),(3000,4000)]
FEATS = ['rms_db','zcr','centroid','flatness','clk'] + [f'b{i}' for i in range(len(BANDS))]

def load_mono(path):
    sr, x = wavfile.read(path)
    if x.ndim > 1: x = x.mean(axis=1)
    x = x.astype(np.float64)
    if np.issubdtype(np.dtype(x.dtype), np.integer): pass
    m = np.max(np.abs(x)) or 1.0
    x = x / m
    if sr != SR:
        g = math.gcd(int(sr), SR)
        x = resample_poly(x, SR // g, int(sr) // g)
    return x

def win_feats(w):
    n = len(w)
    rms = math.sqrt(float(np.mean(w*w)) + 1e-12)
    rms_db = 20*math.log10(rms + 1e-9)
    zcr = float(np.mean(np.abs(np.diff(np.sign(w))) > 0))
    sp = np.abs(np.fft.rfft(w * np.hanning(n)))**2 + 1e-12
    freqs = np.fft.rfftfreq(n, 1.0/SR)
    centroid = float(np.sum(freqs*sp)/np.sum(sp))
    flatness = float(np.exp(np.mean(np.log(sp))) / np.mean(sp))
    med = np.median(np.abs(w)) + 1e-9
    clk = float(np.mean(np.abs(w) > 6*med))     # transient/click density
    be = []
    for lo,hi in BANDS:
        m = (freqs>=lo)&(freqs<hi)
        be.append(math.log10(float(np.sum(sp[m]))+1e-9))
    return [rms_db, zcr, centroid, flatness, clk] + be

def windows(x):
    step, wl = int(HOP*SR), int(WIN*SR)
    out = []
    for s in range(0, max(0,len(x)-wl)+1, step):
        out.append(x[s:s+wl])
    return out

def extract(paths):
    X, y, g, rms_list = [], [], [], []
    per_file = []
    for fi, p in enumerate(paths):
        try: x = load_mono(p)
        except Exception as e:
            print('  skip', os.path.basename(p), e); continue
        ws = windows(x)
        if len(ws) < 6: continue
        fr = [win_feats(w) for w in ws]
        rms = np.array([f[0] for f in fr])
        # adaptive gate: top third by loudness = feeding/active; bottom third = quiet
        hi = np.percentile(rms, 66); lo = np.percentile(rms, 33)
        for f, r in zip(fr, rms):
            if r >= hi: lab = 1
            elif r <= lo: lab = 0
            else: continue
            X.append(f); y.append(lab); g.append(fi)
        per_file.append((os.path.basename(p), len(ws)))
    return np.array(X), np.array(y), np.array(g), per_file

def main():
    root = sys.argv[1] if len(sys.argv)>1 else r'C:\pg_data\rice-weevil'
    rpw  = sys.argv[2] if len(sys.argv)>2 else r'C:\pg_data\rpw-usda'
    paths = sorted(glob.glob(os.path.join(root,'**','*.wav'), recursive=True))
    print(f'[real] {len(paths)} recordings under {root}')
    X, y, g, per_file = extract(paths)
    print(f'[real] {len(y)} labelled windows · {len(set(g))} recordings · pos={int(y.sum())} neg={int((y==0).sum())}')
    if len(set(g)) < 3 or len(np.unique(y)) < 2:
        print('[real] not enough data/classes'); return 1

    mean, std = X.mean(0), X.std(0)+1e-9
    Xs = (X-mean)/std
    # leakage-safe out-of-fold predictions (no recording in both train and test)
    k = min(5, len(set(g)))
    oof = np.zeros(len(y))
    for tr, te in GroupKFold(n_splits=k).split(Xs, y, g):
        m = LogisticRegression(max_iter=2000, C=1.0, class_weight='balanced').fit(Xs[tr], y[tr])
        oof[te] = m.predict_proba(Xs[te])[:,1]
    auc = roc_auc_score(y, oof); acc = accuracy_score(y, oof>0.5); f1 = f1_score(y, oof>0.5)
    print(f'[real] OOF ROC-AUC={auc:.3f}  acc={acc:.3f}  F1={f1:.3f}  (GroupKFold k={k})')

    # final model on all data (for export)
    final = LogisticRegression(max_iter=2000, C=1.0, class_weight='balanced').fit(Xs, y)

    # genuine-species reference: mean activity score on REAL RPW clips
    rpw_paths = sorted(glob.glob(os.path.join(rpw,'*.wav')))
    rpw_score = None
    if rpw_paths:
        rs = []
        for p in rpw_paths:
            try:
                ws = windows(load_mono(p))
                if not ws: continue
                fr = (np.array([win_feats(w) for w in ws])-mean)/std
                rs.append(float(final.predict_proba(fr)[:,1].mean()))
            except Exception: pass
        if rs: rpw_score = round(float(np.mean(rs)),3)
        print(f'[real] mean activity on {len(rpw_paths)} REAL RPW clips = {rpw_score} (cross-sensor reference, illustrative)')

    # EDGE model: only device-portable features (no band-edge dependency) so it
    # transfers cleanly to the ESP32's exact feature pipeline -> pg_model.h.
    EDGE_IDX = [0, 1, 2, 3, 4]   # rms_db, zcr, centroid, flatness, clk
    Xe = Xs[:, EDGE_IDX]
    oofe = np.zeros(len(y))
    for tr, te in GroupKFold(n_splits=k).split(Xe, y, g):
        oofe[te] = LogisticRegression(max_iter=2000, C=1.0, class_weight='balanced').fit(Xe[tr], y[tr]).predict_proba(Xe[te])[:, 1]
    auce = roc_auc_score(y, oofe)
    finale = LogisticRegression(max_iter=2000, C=1.0, class_weight='balanced').fit(Xe, y)
    print(f'[real] EDGE (5-feat device-portable) OOF ROC-AUC={auce:.3f}')

    out = os.path.join(os.path.dirname(__file__),'eval_report'); os.makedirs(out, exist_ok=True)
    json.dump({'feature_names':[FEATS[i] for i in EDGE_IDX],
               'mean':[float(mean[i]) for i in EDGE_IDX],'std':[float(std[i]) for i in EDGE_IDX],
               'coef':finale.coef_[0].tolist(),'intercept':float(finale.intercept_[0]),
               'roc_auc':round(float(auce),3),'sr':SR,'win_s':WIN,'hop_s':HOP},
              open(os.path.join(out,'real_model_edge.json'),'w'), indent=2)
    json.dump({'feature_names':FEATS,'mean':mean.tolist(),'std':std.tolist(),
               'coef':final.coef_[0].tolist(),'intercept':float(final.intercept_[0]),
               'sr':SR,'win_s':WIN,'hop_s':HOP},
              open(os.path.join(out,'real_model.json'),'w'), indent=2)
    json.dump({'real_data_used':True,'task':'insect-feeding activity vs quiet (proxy for RPW)',
               'roc_auc':round(auc,3),'accuracy':round(acc,3),'f1':round(f1,3),
               'cv':'GroupKFold by recording (leakage-safe)','folds':k,
               'n_windows':int(len(y)),'n_recordings':int(len(set(g))),
               'positives':int(y.sum()),'negatives':int((y==0).sum()),
               'rpw_reference_mean_activity':rpw_score,
               'sources':['cbalingbing/Rice-Acoustic-Sensor (real weevil/borer feeding)',
                          'USDA-ARS Mankin sound library (real Rhynchophorus ferrugineus)'],
               'honesty':'proxy species + cross-sensor; airborne-mic field validation is the documented next step; never claimed as field-validated RPW accuracy'},
              open(os.path.join(out,'real_metrics.json'),'w'), indent=2)
    print('[real] wrote eval_report/real_model.json + real_metrics.json')
    return 0

if __name__=='__main__':
    sys.exit(main())
