// INMP441 I2S microphone with in-firmware radix-2 FFT.
//
// Per fast cycle we capture 1024 audio samples (~64 ms at 16 kHz), apply a Hann
// window, run a 1024-point FFT, and bin the magnitude spectrum into 16 linear
// bands of 500 Hz each (covering 0 - 8 kHz). The bands array is what the
// dashboard's spectrogram waterfall renders.
//
// acoustic_capture_mel() additionally captures a contiguous ~1 s window
// (PG_MEL_FRAMES frames at hop=512) and emits a 40×32 log-mel patch for the ML
// scorer. The mel filterbank here MUST stay identical to ml/features/melspec.py.
#include "acoustic.h"
#include "../../include/config.h"

#include <Arduino.h>
#include <math.h>
#include <string.h>
#include "driver/i2s.h"

namespace {

constexpr i2s_port_t I2S_PORT = I2S_NUM_0;
constexpr int CHUNK   = 256;
constexpr int N       = PG_FFT_N;            // 1024
constexpr int LOG2N   = PG_FFT_LOG2N;        // 10
constexpr int BANDS   = 16;
constexpr float SR    = (float)PG_AUDIO_SR;

bool inited        = false;
bool tables_ready  = false;

// Hann window (1024 floats = 4 KB)
__attribute__((aligned(16))) float window_tab[N];
// FFT scratch buffers (8 KB each)
__attribute__((aligned(16))) float fft_re[N];
__attribute__((aligned(16))) float fft_im[N];
// Magnitude (^2) — only first N/2 bins are meaningful
__attribute__((aligned(16))) float mag2[N / 2];

// 1-pole HPF state
float hpf_y_prev = 0, hpf_x_prev = 0;
constexpr float HPF_ALPHA = 0.97f;

// ─── Mel filterbank (HTK mel; MUST match ml/features/melspec.py) ─────────
float mel_pts_hz[PG_MEL_BANDS + 2];
bool  mel_ready = false;

inline float hz_to_mel(float f) { return 2595.0f * log10f(1.0f + f / 700.0f); }
inline float mel_to_hz(float m) { return 700.0f * (powf(10.0f, m / 2595.0f) - 1.0f); }

void mel_init() {
  if (mel_ready) return;
  float lo = hz_to_mel((float)PG_MEL_FMIN);
  float hi = hz_to_mel((float)PG_MEL_FMAX);
  for (int k = 0; k < PG_MEL_BANDS + 2; ++k)
    mel_pts_hz[k] = mel_to_hz(lo + (hi - lo) * (float)k / (float)(PG_MEL_BANDS + 1));
  mel_ready = true;
}

// Triangular filterbank over a power spectrum (first N/2 bins). Writes
// PG_MEL_BANDS log-energy values (10*log10) into mel_out.
void mel_from_power(const float *power, float *mel_out) {
  const float bin_hz = SR / (float)N;
  for (int m = 0; m < PG_MEL_BANDS; ++m) {
    const float fl = mel_pts_hz[m], fc = mel_pts_hz[m + 1], fr = mel_pts_hz[m + 2];
    int lo = (int)ceilf(fl / bin_hz);
    int hi = (int)floorf(fr / bin_hz);
    if (lo < 1) lo = 1;
    if (hi > N / 2 - 1) hi = N / 2 - 1;
    float e = 0.0f;
    for (int i = lo; i <= hi; ++i) {
      const float f = (float)i * bin_hz;
      const float w = (f <= fc) ? (f - fl) / (fc - fl) : (fr - f) / (fr - fc);
      if (w > 0.0f) e += w * power[i];
    }
    mel_out[m] = 10.0f * log10f(fmaxf(e, 1e-10f));
  }
}

// ─── I2S setup ─────────────────────────────────────────────────────────
bool i2s_setup() {
  i2s_config_t cfg = {};
  cfg.mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX);
  cfg.sample_rate          = PG_AUDIO_SR;
  cfg.bits_per_sample      = I2S_BITS_PER_SAMPLE_32BIT;
  cfg.channel_format       = I2S_CHANNEL_FMT_ONLY_LEFT;
  cfg.communication_format = I2S_COMM_FORMAT_STAND_I2S;
  cfg.intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1;
  cfg.dma_buf_count        = 4;
  cfg.dma_buf_len          = CHUNK;
  cfg.use_apll             = false;
  cfg.tx_desc_auto_clear   = false;
  cfg.fixed_mclk           = 0;

  i2s_pin_config_t pins = {};
  pins.mck_io_num   = I2S_PIN_NO_CHANGE;
  pins.bck_io_num   = PG_I2S_BCLK;
  pins.ws_io_num    = PG_I2S_LRCK;
  pins.data_out_num = I2S_PIN_NO_CHANGE;
  pins.data_in_num  = PG_I2S_DIN;

  if (i2s_driver_install(I2S_PORT, &cfg, 0, nullptr) != ESP_OK) return false;
  if (i2s_set_pin(I2S_PORT, &pins) != ESP_OK)                   return false;
  i2s_zero_dma_buffer(I2S_PORT);
  return true;
}

// Read exactly `count` samples (HPF-filtered floats) into dst. Returns false on
// I2S error. Shared by the fast frame and the mel capture.
bool read_samples(float *dst, int count) {
  static int32_t raw[CHUNK];
  int filled = 0;
  while (filled < count) {
    size_t got = 0;
    if (i2s_read(I2S_PORT, raw, sizeof(raw), &got, 200 / portTICK_PERIOD_MS) != ESP_OK) return false;
    int n = got / sizeof(int32_t);
    if (n == 0) continue;
    if (filled + n > count) n = count - filled;
    for (int i = 0; i < n; ++i) {
      // INMP441: 24-bit signed left-justified in 32-bit slots
      float x = (float)(raw[i] >> 8) / 8388608.0f;
      // 1-pole HPF
      float y = HPF_ALPHA * (hpf_y_prev + x - hpf_x_prev);
      hpf_x_prev = x;
      hpf_y_prev = y;
      dst[filled + i] = y;
    }
    filled += n;
  }
  return true;
}

// ─── In-place radix-2 Cooley-Tukey FFT ─────────────────────────────────
void fft_inplace(float *re, float *im) {
  int j = 0;
  for (int i = 1; i < N; i++) {
    int bit = N >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) {
      float tr = re[i]; re[i] = re[j]; re[j] = tr;
      float ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (int len = 2; len <= N; len <<= 1) {
    float angle = -2.0f * (float)M_PI / (float)len;
    float wlen_r = cosf(angle);
    float wlen_i = sinf(angle);
    int half = len >> 1;
    for (int i = 0; i < N; i += len) {
      float wr = 1.0f, wi = 0.0f;
      for (int k = 0; k < half; k++) {
        float ur = re[i + k];
        float ui = im[i + k];
        float vr_in = re[i + k + half];
        float vi_in = im[i + k + half];
        float vr = wr * vr_in - wi * vi_in;
        float vi = wr * vi_in + wi * vr_in;
        re[i + k]        = ur + vr;
        im[i + k]        = ui + vi;
        re[i + k + half] = ur - vr;
        im[i + k + half] = ui - vi;
        float new_wr = wr * wlen_r - wi * wlen_i;
        wi           = wr * wlen_i + wi * wlen_r;
        wr           = new_wr;
      }
    }
  }
}

void initTables() {
  if (tables_ready) return;
  for (int i = 0; i < N; ++i) {
    window_tab[i] = 0.5f * (1.0f - cosf(2.0f * (float)M_PI * (float)i / (float)(N - 1)));
  }
  tables_ready = true;
}

// ─── Spectral features from a power spectrum (shared by both paths) ──────
// `power` holds N/2 power-spectrum bins. Fills bands[6], bands16[16], peaks,
// centroid, flatness, click_rate. Caller fills rms_dbfs/zcr/mini_wave.
void derive_spectral_features(const float *power, AcousticFeatures &out, bool stream_bands16) {
  const float bin_hz = SR / (float)N;

  // 16 linear bands of 500 Hz each (0 - 8 kHz). 32 bins per 500 Hz band.
  const float band_w = 500.0f;
  int per_band = (int)(band_w / bin_hz);     // 32
  for (int b = 0; b < BANDS; ++b) {
    int lo = b * per_band;
    int hi = (b + 1) * per_band;
    if (hi > N / 2) hi = N / 2;
    float p = 0;
    for (int i = lo; i < hi; ++i) p += power[i];
    p /= (float)(hi - lo);
    out.bands16[b] = 10.0f * log10f(fmaxf(p, 1e-12f));
  }

  // 6 coarser bands
  const float band6_edges[] = { 0, 500, 1000, 2000, 4000, 6000, 8000 };
  for (int b = 0; b < 6; ++b) {
    int lo = (int)(band6_edges[b]   / bin_hz);
    int hi = (int)(band6_edges[b+1] / bin_hz);
    if (hi > N / 2) hi = N / 2;
    if (hi <= lo)   hi = lo + 1;
    float p = 0;
    for (int i = lo; i < hi; ++i) p += power[i];
    p /= (float)(hi - lo);
    out.bands[b] = 10.0f * log10f(fmaxf(p, 1e-12f));
  }

  // Top-5 peaks in 1-8 kHz
  int peak_idx[5] = {0,0,0,0,0};
  float peak_db[5] = { -INFINITY, -INFINITY, -INFINITY, -INFINITY, -INFINITY };
  int b_lo = (int)(1000.0f / bin_hz);
  int b_hi = (int)(8000.0f / bin_hz);
  for (int i = b_lo + 1; i < b_hi - 1; ++i) {
    if (power[i] > power[i-1] && power[i] > power[i+1]) {
      float db = 10.0f * log10f(fmaxf(power[i], 1e-12f));
      for (int p = 0; p < 5; ++p) {
        if (db > peak_db[p]) {
          for (int q = 4; q > p; --q) { peak_db[q] = peak_db[q-1]; peak_idx[q] = peak_idx[q-1]; }
          peak_db[p] = db; peak_idx[p] = i;
          break;
        }
      }
    }
  }
  out.peak_count = 0;
  for (int p = 0; p < 5 && peak_db[p] > -90.0f; ++p) {
    out.peaks[p][0] = (float)peak_idx[p] * bin_hz;
    out.peaks[p][1] = peak_db[p];
    out.peak_count++;
  }

  // Centroid + flatness
  float sum_p = 0, sum_fp = 0;
  int max_bin = (int)(8000.0f / bin_hz);
  for (int i = 1; i < max_bin; ++i) { sum_p += power[i]; sum_fp += power[i] * (float)i * bin_hz; }
  out.centroid_hz = sum_p > 0 ? (sum_fp / sum_p) : 0;

  float log_sum = 0, lin_sum = 0; int n_flat = 0;
  int fl_lo = (int)(500.0f / bin_hz);
  int fl_hi = (int)(8000.0f / bin_hz);
  for (int i = fl_lo; i < fl_hi; ++i) { log_sum += logf(fmaxf(power[i], 1e-12f)); lin_sum += power[i]; n_flat++; }
  if (n_flat > 0 && lin_sum > 0) {
    float gm = expf(log_sum / n_flat);
    float am = lin_sum / n_flat;
    float f = gm / am;
    if (f < 0) f = 0; if (f > 1) f = 1;
    out.flatness = f;
  }

  // Click rate (coarse transient indicator from band contrast)
  float mid_hi = 0; int cnt = 0;
  for (int b = 4; b < 16; ++b) { mid_hi += out.bands16[b]; cnt++; }
  mid_hi /= cnt;
  float mid_lo_avg = 0; cnt = 0;
  for (int b = 0; b < 4; ++b) { mid_lo_avg += out.bands16[b]; cnt++; }
  mid_lo_avg /= cnt;
  out.click_rate = (mid_hi - mid_lo_avg) > 6.0f ? 6.0f : 0.0f;

  out.stream_bands16 = stream_bands16;
}

}  // namespace


bool acoustic_init() {
  if (inited) return true;
  if (!i2s_setup()) {
    Serial.println(F("[acoustic] I2S init failed"));
    return false;
  }
  initTables();
  mel_init();
  // Discard ~50 ms of warm-up samples
  static int32_t warmup[CHUNK];
  size_t got = 0;
  for (int i = 0; i < 4; ++i) {
    i2s_read(I2S_PORT, warmup, sizeof(warmup), &got, 100 / portTICK_PERIOD_MS);
  }
  inited = true;
  Serial.println(F("[acoustic] INMP441 ready (FFT 1024-pt, 16 bands, 40-mel)"));
  return true;
}


bool acoustic_sample(AcousticFeatures &out, bool stream_bands16) {
  memset(&out, 0, sizeof(out));
  out.flatness = 1.0f;
  out.rms_dbfs = -90.0f;
  if (!inited && !acoustic_init()) return false;

  // 1. Capture exactly N samples (1024 = 64 ms)
  if (!read_samples(fft_re, N)) return false;
  for (int i = 0; i < N; ++i) fft_im[i] = 0.0f;

  // 2. Time-domain features over the buffer + mini_wave envelope
  double total_sum_sq = 0;
  int total_zc = 0;
  bool prev_pos = false, init_sign = false;
  constexpr int MINI_TARGET = N / PG_MINI_WAVE_LEN;
  for (int i = 0; i < PG_MINI_WAVE_LEN; ++i) out.mini_wave[i] = 0;
  double mini_sum_sq = 0; int mini_n = 0, mini_idx = 0;

  for (int i = 0; i < N; ++i) {
    float y = fft_re[i];
    total_sum_sq += (double)y * y;
    mini_sum_sq  += (double)y * y;
    mini_n++;
    if (mini_n >= MINI_TARGET && mini_idx < PG_MINI_WAVE_LEN) {
      float r = sqrtf((float)(mini_sum_sq / mini_n));
      float db = 20.0f * log10f(fmaxf(r, 1e-6f));
      int v = (int)((db + 60.0f) * 100.0f / 60.0f);
      if (v < 0) v = 0; if (v > 100) v = 100;
      out.mini_wave[mini_idx++] = (uint8_t)v;
      mini_sum_sq = 0; mini_n = 0;
    }
    bool pos = y > 0;
    if (init_sign && pos != prev_pos) total_zc++;
    prev_pos = pos; init_sign = true;
  }

  out.rms_dbfs = 20.0f * log10f(fmaxf(sqrtf((float)(total_sum_sq / N)), 1e-9f));
  out.zcr      = (float)total_zc / (float)N;

  // 3. Hann window + FFT
  for (int i = 0; i < N; ++i) fft_re[i] *= window_tab[i];
  fft_inplace(fft_re, fft_im);

  // 4. Power spectrum -> spectral features
  for (int i = 0; i < N / 2; ++i) mag2[i] = fft_re[i] * fft_re[i] + fft_im[i] * fft_im[i];
  derive_spectral_features(mag2, out, true);

  return true;
}


bool acoustic_capture_mel(AcousticFeatures &out, bool stream_bands16, float *patch) {
  memset(&out, 0, sizeof(out));
  out.flatness = 1.0f;
  out.rms_dbfs = -90.0f;
  if (!inited && !acoustic_init()) return false;
  mel_init();

  static float win[N];                    // sliding 1024-sample window
  static float agg[N / 2];                // aggregate power for spectral features
  for (int i = 0; i < N / 2; ++i) agg[i] = 0.0f;

  double total_sum_sq = 0; long total_zc = 0, total_n = 0;
  bool prev_pos = false, init_sign = false;

  // First full window, then slide by hop each frame (50% overlap at hop=512).
  if (!read_samples(win, N)) return false;

  for (int f = 0; f < PG_MEL_FRAMES; ++f) {
    if (f > 0) {
      memmove(win, win + PG_MEL_HOP, (N - PG_MEL_HOP) * sizeof(float));
      if (!read_samples(win + (N - PG_MEL_HOP), PG_MEL_HOP)) return false;
    }

    // Time-domain accumulation across the whole capture
    double frame_sum_sq = 0;
    for (int i = 0; i < N; ++i) {
      float y = win[i];
      total_sum_sq += (double)y * y;
      frame_sum_sq += (double)y * y;
      bool pos = y > 0;
      if (init_sign && pos != prev_pos) total_zc++;
      prev_pos = pos; init_sign = true;
      total_n++;
    }
    // One mini_wave bucket per frame (32 frames == PG_MINI_WAVE_LEN)
    if (f < PG_MINI_WAVE_LEN) {
      float fr_rms = sqrtf((float)(frame_sum_sq / N));
      float fr_db = 20.0f * log10f(fmaxf(fr_rms, 1e-6f));
      int mv = (int)((fr_db + 60.0f) * 100.0f / 60.0f);
      if (mv < 0) mv = 0; if (mv > 100) mv = 100;
      out.mini_wave[f] = (uint8_t)mv;
    }

    // Windowed FFT for this frame
    for (int i = 0; i < N; ++i) { fft_re[i] = win[i] * window_tab[i]; fft_im[i] = 0.0f; }
    fft_inplace(fft_re, fft_im);
    for (int i = 0; i < N / 2; ++i) { float p = fft_re[i]*fft_re[i] + fft_im[i]*fft_im[i]; mag2[i] = p; agg[i] += p; }

    // Mel column f
    float melcol[PG_MEL_BANDS];
    mel_from_power(mag2, melcol);
    for (int m = 0; m < PG_MEL_BANDS; ++m) patch[m * PG_MEL_FRAMES + f] = melcol[m];
  }

  out.rms_dbfs = 20.0f * log10f(fmaxf(sqrtf((float)(total_sum_sq / total_n)), 1e-9f));
  out.zcr      = (float)total_zc / (float)total_n;

  // Aggregate (mean) power spectrum -> spectral features for the dashboard
  for (int i = 0; i < N / 2; ++i) agg[i] /= (float)PG_MEL_FRAMES;
  derive_spectral_features(agg, out, stream_bands16);

  // Per-clip mean-var normalization of the mel patch (matches ml/features)
  const int L = PG_MEL_PATCH_LEN;
  double sum = 0, sumsq = 0;
  for (int i = 0; i < L; ++i) { sum += patch[i]; sumsq += (double)patch[i] * patch[i]; }
  float mean = (float)(sum / L);
  float var  = (float)(sumsq / L - (double)mean * mean);
  if (var < 1e-6f) var = 1e-6f;
  float inv = 1.0f / sqrtf(var);
  for (int i = 0; i < L; ++i) patch[i] = (patch[i] - mean) * inv;

  return true;
}
