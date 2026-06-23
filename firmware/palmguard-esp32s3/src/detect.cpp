// Pin auto-detector for Palm Guard.
//
// Strategy:
//   1. Quick ACK-only scan of priority + full S3 GPIO combos (~10 ms each)
//      - prints every (SDA, SCL) that has at least one I2C device responding
//      - records all ACKing addresses per bus
//   2. Best-bus selection (the bus that ACKs the most expected addresses)
//   3. Chip-ID confirmation on the best bus (BME680 register 0xD0, MPU register 0x75)
//   4. 1-Wire scan for DS18B20 family-code 0x28
//
// Even if chip-ID confirmation fails (slow bus, weak pull-ups), the address
// pattern alone usually identifies which sensor is which.

#include <Arduino.h>
#include <Wire.h>
#include <OneWire.h>

// S3-valid GPIOs (no 22, no 33-37 PSRAM, no 43/44 UART0, no strapping/USB)
static const int ALL_PINS[] = {
  2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21,
  38, 39, 40, 41, 42, 47, 48
};
static const int N_ALL = sizeof(ALL_PINS) / sizeof(int);

struct Combo { int sda, scl; };
static const Combo PRIORITY[] = {
  { 8,  9}, { 4,  5}, { 5,  4}, { 9,  8}, {47, 48}, {48, 47},
  {17, 18}, {18, 17}, { 6,  7}, { 7,  6}, {14, 15}, {15, 14},
  {41, 42}, {42, 41}, {38, 39}, {39, 38}, {11, 12}, {12, 11},
  {16, 17}, {21, 47}, { 4, 21}, { 8, 18}, {10, 11}, { 2,  4},
};
static const int N_PRIO = sizeof(PRIORITY) / sizeof(Combo);

// Addresses we care about for our four sensors
static const uint8_t INTERESTING[] = { 0x68, 0x69, 0x76, 0x77 };
static const int N_INT = sizeof(INTERESTING) / sizeof(uint8_t);

struct BusHit {
  int sda, scl;
  uint8_t acks;            // bitmask: bit 0=0x68, 1=0x69, 2=0x76, 3=0x77
};

#define MAX_HITS 16
static BusHit hits[MAX_HITS];
static int hitsCount = 0;


static uint8_t scanBus(int sda, int scl) {
  Wire.end();
  delay(2);
  Wire.begin(sda, scl, 100000);
  Wire.setTimeOut(20);             // 20ms - fast enough but tolerant
  delay(2);

  uint8_t acks = 0;
  for (int k = 0; k < N_INT; k++) {
    Wire.beginTransmission(INTERESTING[k]);
    int err = Wire.endTransmission();
    if (err == 0) acks |= (1 << k);
  }
  return acks;
}

static void recordHit(int sda, int scl, uint8_t acks) {
  if (acks == 0 || hitsCount >= MAX_HITS) return;
  hits[hitsCount++] = { sda, scl, acks };
  Serial.printf("  SDA=%-2d SCL=%-2d :", sda, scl);
  for (int k = 0; k < N_INT; k++) {
    if (acks & (1 << k)) Serial.printf(" 0x%02X", INTERESTING[k]);
  }
  Serial.println();
  Serial.flush();
}


// Returns the index of the most useful hit (a bus with a likely BME680
// address (0x76/0x77) and/or a likely MPU6050 address (0x68/0x69)).
static int bestHit() {
  int bestIdx = -1, bestScore = 0;
  for (int i = 0; i < hitsCount; i++) {
    int sc = 0;
    if (hits[i].acks & 0x0C) sc += 2;   // BME bit
    if (hits[i].acks & 0x03) sc += 1;   // MPU bit
    sc += __builtin_popcount(hits[i].acks);
    if (sc > bestScore) { bestScore = sc; bestIdx = i; }
  }
  return bestIdx;
}


static bool readByte(uint8_t addr, uint8_t reg, uint8_t &out) {
  Wire.setTimeOut(50);
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(addr, (uint8_t)1) != 1) return false;
  out = Wire.read();
  return true;
}


static bool probe1Wire(int pin, uint8_t out_rom[8]) {
  OneWire ow(pin);
  for (int attempt = 0; attempt < 3; attempt++) {
    ow.reset_search();
    uint8_t addr[8];
    if (ow.search(addr)) {
      if (OneWire::crc8(addr, 7) == addr[7] && addr[0] == 0x28) {
        memcpy(out_rom, addr, 8);
        return true;
      }
    }
    delay(5);
  }
  return false;
}


void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println();
  Serial.println(F("================================================================"));
  Serial.println(F(" Palm Guard - Pin Auto-Detect"));
  Serial.println(F("================================================================"));
  Serial.flush();

  // ── Phase A: priority combos
  Serial.printf("\n[A] Priority I2C combos (%d)...\n", N_PRIO);
  Serial.flush();
  for (int k = 0; k < N_PRIO; k++) {
    uint8_t a = scanBus(PRIORITY[k].sda, PRIORITY[k].scl);
    if (a) recordHit(PRIORITY[k].sda, PRIORITY[k].scl, a);
  }

  // ── Phase B: full sweep
  Serial.printf("\n[B] Full sweep of %dx%d combos (~%d s)...\n  ", N_ALL, N_ALL - 1, (N_ALL * (N_ALL - 1)) / 50);
  Serial.flush();
  int count = 0;
  for (int i = 0; i < N_ALL; i++) {
    for (int j = 0; j < N_ALL; j++) {
      if (i == j) continue;
      int sda = ALL_PINS[i], scl = ALL_PINS[j];
      // Skip combos already tried in priority
      bool skip = false;
      for (int k = 0; k < N_PRIO; k++) {
        if (PRIORITY[k].sda == sda && PRIORITY[k].scl == scl) { skip = true; break; }
      }
      if (skip) continue;
      uint8_t a = scanBus(sda, scl);
      if (a) recordHit(sda, scl, a);
      count++;
      if (count % 50 == 0) { Serial.print('.'); Serial.flush(); }
    }
  }
  Serial.println();
  Wire.end();

  // ── Pick best bus and confirm
  int bme_addr = 0, mpu_addr = 0;
  int best_sda = -1, best_scl = -1;
  if (hitsCount > 0) {
    int idx = bestHit();
    BusHit b = hits[idx];
    best_sda = b.sda; best_scl = b.scl;
    Serial.printf("\n[C] Best I2C bus: SDA=%d SCL=%d  (verifying chip IDs...)\n", b.sda, b.scl);
    Serial.flush();
    Wire.begin(b.sda, b.scl, 100000);
    Wire.setTimeOut(50);
    delay(10);
    uint8_t v;
    // BME680: 0xD0 register should return 0x61
    if ((b.acks & (1 << 3)) && readByte(0x77, 0xD0, v)) {
      Serial.printf("  0x77 chip-id = 0x%02X %s\n", v, (v == 0x61) ? "(BME680 confirmed!)" : "(unknown chip)");
      if (v == 0x61) bme_addr = 0x77;
    }
    if (!bme_addr && (b.acks & (1 << 2)) && readByte(0x76, 0xD0, v)) {
      Serial.printf("  0x76 chip-id = 0x%02X %s\n", v, (v == 0x61) ? "(BME680 confirmed!)" : "(unknown chip)");
      if (v == 0x61) bme_addr = 0x76;
    }
    // MPU6050: 0x75 register should return 0x68 (or 0x71 for MPU9250, 0x70 for MPU6500)
    if ((b.acks & (1 << 0)) && readByte(0x68, 0x75, v)) {
      Serial.printf("  0x68 WHO_AM_I = 0x%02X %s\n", v,
        (v == 0x68) ? "(MPU6050 confirmed!)" :
        (v == 0x70) ? "(MPU6500 - works similarly)" :
        (v == 0x71) ? "(MPU9250 - works similarly)" : "(unknown)");
      if (v == 0x68 || v == 0x70 || v == 0x71) mpu_addr = 0x68;
    }
    if (!mpu_addr && (b.acks & (1 << 1)) && readByte(0x69, 0x75, v)) {
      Serial.printf("  0x69 WHO_AM_I = 0x%02X %s\n", v,
        (v == 0x68 || v == 0x70 || v == 0x71) ? "(MPU confirmed!)" : "(unknown)");
      if (v == 0x68 || v == 0x70 || v == 0x71) mpu_addr = 0x69;
    }
    Wire.end();
  }

  // ── 1-Wire scan
  Serial.println(F("\n[D] DS18B20 scan..."));
  Serial.flush();
  int ds_pin = -1;
  uint8_t ds_rom[8] = {0};
  for (int i = 0; i < N_ALL; i++) {
    int pin = ALL_PINS[i];
    uint8_t rom[8];
    if (probe1Wire(pin, rom)) {
      Serial.printf("  GPIO %-2d : DS18B20 found  ROM=", pin);
      for (int k = 0; k < 8; k++) Serial.printf("%02X", rom[k]);
      Serial.println();
      Serial.flush();
      ds_pin = pin;
      memcpy(ds_rom, rom, 8);
      break;
    }
  }

  // ── Summary
  Serial.println();
  Serial.println(F("================================================================"));
  Serial.println(F(" RESULT"));
  Serial.println(F("================================================================"));
  if (best_sda >= 0 || ds_pin >= 0) {
    Serial.println(F("\nPaste these into firmware/palmguard-esp32s3/include/config.h:"));
    Serial.println();
    if (best_sda >= 0) {
      Serial.printf("    #define PG_I2C_SDA          %d\n", best_sda);
      Serial.printf("    #define PG_I2C_SCL          %d\n", best_scl);
      if (bme_addr) Serial.printf("    #define PG_BME680_I2C_ADDR  0x%02X\n", bme_addr);
      if (mpu_addr) Serial.printf("    #define PG_MPU_I2C_ADDR     0x%02X\n", mpu_addr);
    }
    if (ds_pin >= 0) Serial.printf("    #define PG_ONEWIRE_PIN      %d\n", ds_pin);
    Serial.println();
    if (!bme_addr) Serial.println("  ! BME680 NOT FOUND - check VCC/GND + SDO->GND + CS->3V3.");
    if (!mpu_addr) Serial.println("  (optional) no MPU6050 on I2C - expected: vibration is the analog SW-420 on the ADC, not an I2C IMU.");
    if (ds_pin < 0) Serial.println("  ! DS18B20 NOT FOUND - check 4.7 kOhm pull-up between DATA and 3V3.");
  } else {
    Serial.println(F("\nNo sensors detected. Verify shared 3V3 + GND + sensor pull-ups, then re-run."));
  }
  Serial.println(F("\nINMP441 (I2S) cannot be auto-detected. Tell the agent: SCK=?  WS=?  SD=?"));
  Serial.println(F("\n[SCAN DONE]"));
  Serial.flush();
}


void loop() { delay(60000); }
