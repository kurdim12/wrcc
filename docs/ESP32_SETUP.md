# ESP32-S3 Setup

> **This guide has moved.** The canonical, up-to-date wiring, pin map, power
> budget and bring-up steps live in:
>
> - **[`HARDWARE.md`](HARDWARE.md)** — bill of materials, pin map, electrical notes.
> - **[`BENCH_BRINGUP.md`](BENCH_BRINGUP.md)** — flash + first-light validation.
> - **[`firmware/palmguard-esp32s3/README.md`](../firmware/palmguard-esp32s3/README.md)** — build/flash with PlatformIO.
>
> The earlier version of this file described an **MPU6050 on the I²C bus**. That is
> **stale**: the node's vibration sensor is an **SW-420 (LM393 analog module read
> on the ADC)**, not an I²C IMU — see `HARDWARE.md`. Pin numbers and firmware
> version in the old guide were also out of date relative to `config.h` (the
> single source of truth).

Quick start (details in the docs above):
```powershell
cd firmware/palmguard-esp32s3
copy include\secrets.h.example include\secrets.h   # set WiFi + server host
pio run -e palmguard -t upload                     # build + flash
pio device monitor
```
The dashboard shows the device on its first POST.

`TODO(zaid): if you prefer a single standalone setup guide, fold the relevant bits
of HARDWARE.md back in here — but keep ONE canonical wiring source to avoid drift.`
