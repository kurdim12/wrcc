# ESP32-S3 Setup Guide

End-to-end steps to wire up the four sensors on your ESP32-S3-DevKitC-1, flash the firmware, and watch the Palm Guard dashboard light up live.

## 1. Bill of materials

| Component | Notes |
|---|---|
| ESP32-S3-DevKitC-1 (or any S3 board with PSRAM) | USB-C |
| INMP441 I2S MEMS mic breakout | SCK / WS / SD / VDD / GND / L+R |
| MPU6050 6-axis IMU breakout | I2C |
| DS18B20 waterproof probe + 4.7 kΩ resistor | 1-Wire |
| BME680 breakout (e.g. CJMCU-680) | I2C |
| Half-size breadboard + jumper wires | |
| (Optional) 18650 + protected charger + voltage divider | for battery monitoring |

## 2. Wiring

```
ESP32-S3                              Sensors
────────                              ───────
3V3 ──────────────────────────►  VDD of all 4 sensors
GND ──────────────────────────►  GND of all 4 sensors + INMP441 L/R

GPIO 14 ──────────────────────►  INMP441 SCK
GPIO 15 ──────────────────────►  INMP441 WS
GPIO 16 ──────────────────────►  INMP441 SD

GPIO 8  ──┬───────────────────►  BME680 SDA
          └───────────────────►  MPU6050 SDA
GPIO 9  ──┬───────────────────►  BME680 SCL
          └───────────────────►  MPU6050 SCL

GPIO 4  ──────────────────────►  DS18B20 DATA
                              ┌── 4.7 kΩ ──── 3V3
GPIO 4 ───────────────────────┘

(Optional)
GPIO 1  ───── voltage divider ───── Battery+
```

The two I2C devices share GPIO 8/9. There is no address conflict (BME680 = 0x77, MPU6050 = 0x68).

## 3. Install PlatformIO

If you use VS Code:

1. Install the **PlatformIO IDE** extension.
2. `File > Open Folder` -> `C:\xampp\htdocs\palm-Guard\firmware\palmguard-esp32s3`
3. Wait for PlatformIO to download dependencies (first time takes a few minutes).

If you prefer the CLI:

```powershell
pip install platformio
cd C:\xampp\htdocs\palm-Guard\firmware\palmguard-esp32s3
pio run                           # build only
```

## 4. Configure secrets

```powershell
cd C:\xampp\htdocs\palm-Guard\firmware\palmguard-esp32s3
copy include\secrets.h.example include\secrets.h
notepad include\secrets.h
```

Set:

- `PG_WIFI_SSID` / `PG_WIFI_PASSWORD` — your WiFi
- `PG_SERVER_HOST` — the local IP of the PC. The Vite dev terminal prints it on startup, e.g.:
  ```
  Network: http://192.168.100.124:5173/
  ```
  Use the same IP (without the `:5173`) — the backend listens on port 4000.

(Optional) edit `include/config.h` to change the device id (`PG_DEVICE_ID = "PG-002"`, ...) if you have multiple boards.

## 4b. Already wired? Auto-detect existing pins

If the breadboard is already built and you'd rather not re-trace the wires,
run the included scanner. It sweeps every safe GPIO pair as (SDA, SCL),
verifies BME680 chip-id (0x61) and MPU6050 WHO_AM_I (0x68), and probes every
GPIO for a DS18B20 ROM family-code 0x28.

```powershell
cd firmware\palmguard-esp32s3
pio run -e detect -t upload
pio device monitor
```

Expected output (~10 s after upload):

```
================================================================
 Palm Guard - Pin Auto-Detect
================================================================
 27 candidate GPIOs to test  (~702 I2C combos)
----------------------------------------------------------------

[1/2] I2C scan ...
  SDA=8  SCL=9  : BME680 @ 0x77  MPU6050 @ 0x68

[2/2] 1-Wire scan (DS18B20)...
  GPIO 4  : DS18B20 found  ROM=28FF1A...

================================================================
 RESULT
================================================================

Paste these into firmware/palmguard-esp32s3/include/config.h:

    #define PG_I2C_SDA       8
    #define PG_I2C_SCL       9
    #define PG_BME680_I2C_ADDR  0x77
    #define PG_MPU_I2C_ADDR     0x68
    #define PG_ONEWIRE_PIN   4

INMP441 (I2S) cannot be auto-detected. Report 3 pins manually:
    SCK -> ?  WS -> ?  SD -> ?
```

Update `include/config.h` with those values, supply the three I2S pins
yourself (INMP441 is output-only and cannot be probed), then flash the
normal firmware:

```powershell
pio run -e palmguard -t upload
```

## 5. Flash & monitor

```powershell
cd C:\xampp\htdocs\palm-Guard\firmware\palmguard-esp32s3
pio run -t upload
pio device monitor
```

Within 10-15 seconds you should see:

```
============================================
 Palm Guard PG-001  fw 0.1.0
============================================
[wifi] connecting to '...'..
[wifi] connected, IP=192.168.100.183, RSSI=-58
[acoustic] ready
[env] BME680 ready
[thermal] DS18B20 ready
[init] acoustic=1 vibration=1 thermal=1 env=1
[poster] OK seq=1 size=312 stream=no
[poster] OK seq=2 size=312 stream=no
...
```

The dashboard will start showing the device immediately.

## 6. Trigger a HIGH_RISK alert (smoke test)

Best non-destructive way to fake larvae feeding sounds:

- Lightly tap a metal washer / paperclip rapidly on the desk near the INMP441 mic, ~5 taps/second, for 2-3 cycles in a row.
- Or scratch fine sandpaper (or a dry sponge) close to the mic — that produces broadband noise in the 3-5 kHz band.

You should see:
- Console: `[poster] OK ... stream=no` (or `stream=yes` if you opened the Spectrogram page).
- Dashboard: KPI "Critical Risk" goes from 0 to 1, an `HIGH_RISK` alert appears in the alert list and the bell icon shows a red dot.

## 7. Common troubleshooting

| Symptom | Fix |
|---|---|
| `[wifi] failed - will retry next cycle` | Check SSID/password, confirm 2.4 GHz network (ESP32-S3 doesn't do 5 GHz on most variants) |
| Compiles but `[acoustic] I2S init failed` | Verify INMP441 SCK/WS/SD pins match `config.h` |
| `[thermal] no DS18B20 detected` | The 4.7 kΩ pull-up to 3.3 V is missing or wrong |
| All sensors return zeros | Wires are loose or you have the wrong I2C address. Run `i2cscan.ino` separately to enumerate addresses |
| `HTTP -1` or `HTTP -11` from poster | PC firewall blocks incoming TCP/4000 from the LAN. On Windows: allow `node.exe` in Windows Defender Firewall |
| Risk score stays low even when tapping near mic | BME680 still in 20-min warm-up — wait, or run `tools/mock_device.py` in parallel to verify the dashboard pipeline first |

## 8. Adding more devices

1. Power up another ESP32-S3 with `PG_DEVICE_ID = "PG-002"` in its `config.h`.
2. Flash and let it auto-register on first POST.
3. (Optional) attach it to a palm: in the dashboard go to **Mesh Network** -> click the device -> assign a palm.

## 9. Power management roadmap

The current firmware uses `delay()` between cycles for simplicity. To reach the report's 6-12 month battery target you'd want to switch to:

- **Light sleep** between cycles (`esp_light_sleep_start()`), keeping I2S DMA active.
- **Deep sleep** for longer idle periods, accepting the I2S re-init cost.
- Solar trickle-charge integration: see `extension_report.txt` §7.2.

These are out of scope for the v0.1 demo build but the cycle-time budget already leaves the device idle ~95% of the time, so adding sleep modes is mechanical.
