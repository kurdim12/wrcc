# Palm Guard - ESP32-S3 Firmware

PlatformIO project for the sensor node. Reads INMP441 (acoustic), an SW-420 LM393 analog vibration module (corroboration), DS18B20 (trunk core temperature), and BME680 (temperature, humidity, pressure, gas/VOC), runs an on-device FFT for the acoustic features, and POSTs a small JSON payload to the backend every 30 s.

## Wiring

Pins below mirror `include/config.h` (the single source of truth — see also
[`../../docs/HARDWARE.md`](../../docs/HARDWARE.md)).

| Sensor       | ESP32-S3 GPIO | Notes                                       |
|--------------|---------------|---------------------------------------------|
| INMP441 SCK  | GPIO 9        | I2S BCLK                                     |
| INMP441 WS   | GPIO 10       | I2S LRCK                                     |
| INMP441 SD   | GPIO 11       | I2S DATA in                                  |
| INMP441 L/R  | GND           | left channel only                           |
| INMP441 VDD  | 3V3           |                                             |
| SW-420 A0    | GPIO 4        | **analog** vibration envelope on ADC1 (not I2C); corroboration only |
| BME680 SDA   | GPIO 8        | I2C, addr 0x77 (or 0x76)                     |
| BME680 SCL   | GPIO 18       | I2C                                          |
| DS18B20 DATA | GPIO 0        | needs 4.7 kΩ pull-up to 3.3 V               |
| Pump gate    | GPIO 5        | MOSFET gate (LEDC PWM-capable)               |
| Status LED   | GPIO 48       | WS2812 onboard addressable LED               |
| Battery ADC  | GPIO 1        | optional, voltage divider on Li-Po cell     |

All sensors share 3.3 V and GND with the ESP32-S3. The vibration sensor is an
**SW-420 (LM393 comparator module) read as an analog envelope on the ADC** — not
an I²C IMU, and not a calibrated accelerometer (corroboration signal only).

## First-time setup

1. Install PlatformIO (VS Code extension recommended).
2. `cd firmware/palmguard-esp32s3`
3. `cp include/secrets.h.example include/secrets.h`
4. Edit `include/secrets.h`:
   - `PG_WIFI_SSID` / `PG_WIFI_PASSWORD`: your local WiFi
   - `PG_SERVER_HOST`: the local IP of the PC running the backend (e.g. `192.168.100.124` - the Vite terminal prints this on startup)
5. (Optional) edit `include/config.h` to change the device id (`PG_DEVICE_ID`) or pin map.
6. Plug the ESP32-S3 into USB.
7. `pio run -t upload`
8. `pio device monitor`

You should see, within 10-15 s:

```
============================================
 Palm Guard PG-001  fw 2.0.0
============================================
[wifi] connecting to '...'..
[wifi] connected, IP=192.168.100.183, RSSI=-58
[acoustic] ready
[env] BME680 ready
[thermal] DS18B20 ready
[init] acoustic=1 vibration=1 thermal=1 env=1
[poster] OK seq=1 size=312 stream=no
```

The dashboard at `http://localhost:5173` will start showing the device immediately.

## Cycle behavior

- Default cadence: **30 s** ("Listen-and-Sleep" - matches the technical-report power budget).
- When a dashboard subscribes to the **Live Spectrogram** page for a device, the backend tells the next POST to switch to **2 s** cycles and include a 16-band 2-8 kHz spectrum (`bands16`). Cadence reverts after the dashboard unsubscribes (~60 s window).
- BME680 gas resistance is unstable for the first ~20 min after power-on; the firmware reports `voc_warmup=true` for the first 240 cycles so the backend can mask `SVOC` until the sensor stabilises.

## Common issues

- **Compiles but no audio data.** Check that the INMP441 L/R pin is tied to GND. The driver reads only the left channel.
- **`[thermal] no DS18B20 detected`**. Make sure the 4.7 kΩ pull-up resistor is in place between the data line and 3.3 V.
- **`HTTP -1` from poster.** PC firewall is blocking incoming TCP on port 4000. Allow it for the local network.
- **`HTTP 400 invalid_payload`**. Open `pio device monitor`, copy the JSON, and paste it into a [zod playground](https://zod.dev/) against `backend/routes/readings.js` schema.
