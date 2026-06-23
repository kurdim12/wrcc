# Palm Guard V4 — electronics integration

How the ESP32-S3 node sits inside the V4 enclosure (mechanical design:
[`MECHANICAL_DOSSIER.md`](MECHANICAL_DOSSIER.md)).

- **Controller:** ESP32-S3 in the enclosure cavity; USB-C exposed at the side
  service slot for flashing/serial.
- **Acoustic:** INMP441 MEMS mic coupled to the trunk surface through the
  enclosure base (structure-borne); on-device 1024-pt FFT → 40 × 32 log-mel.
- **Vibration:** SW-420 analog module read on the ADC (corroboration only).
- **Trunk temperature:** DS18B20 routed into the probe's **sealed sensor lumen**,
  reading trunk-core temperature through the tip wall.
- **Treatment path:** micro-pump → OD4 / ID2 silicone tube → probe **treatment
  lumen** → 2 × side ports inside the trunk. **Clear water in the demo**; every
  dose is human-confirmed and hard-capped on both server and device.
- **Power:** solar panel on the 15° lid tray → charge controller → LiPo; the
  firmware duty-cycles to fit the per-tree energy budget.
- **Status:** NeoPixel state LED (healthy / watch / high / treated).
