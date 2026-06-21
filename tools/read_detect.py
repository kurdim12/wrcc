#!/usr/bin/env python3
"""Read 30s of Serial output from the detect firmware on COM4 and print it.
Used by the agent to capture the auto-detected pin assignments without
needing pio device monitor (which is interactive).
"""
import sys, time
import serial
# Force UTF-8 stdout so on Windows we don't crash on box-drawing characters.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

PORT = sys.argv[1] if len(sys.argv) > 1 else 'COM4'
BAUD = int(sys.argv[2]) if len(sys.argv) > 2 else 115200
TIMEOUT_S = int(sys.argv[3]) if len(sys.argv) > 3 else 30

ser = serial.Serial(PORT, BAUD, timeout=1)
# Pulse DTR/RTS to reset the chip so we capture the boot output
ser.dtr = False
ser.rts = True
time.sleep(0.1)
ser.rts = False
time.sleep(0.1)

start = time.time()
print(f"--- reading {PORT} @ {BAUD} for {TIMEOUT_S} s ---", flush=True)
while time.time() - start < TIMEOUT_S:
    line = ser.readline()
    if not line:
        continue
    try:
        s = line.decode('utf-8', errors='replace').rstrip('\r\n')
    except Exception:
        s = repr(line)
    print(s, flush=True)
    if 'SCAN DONE' in s or 'Switch back to normal firmware' in s:
        # capture a couple more lines then exit
        for _ in range(5):
            extra = ser.readline()
            if extra:
                print(extra.decode('utf-8', errors='replace').rstrip('\r\n'), flush=True)
        break
ser.close()
print('--- end of capture ---', flush=True)
