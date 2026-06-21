// Peristaltic micro-dosing pump driver.
//
// Hardware (see docs/HARDWARE.md): the gate pin drives a LOGIC-LEVEL MOSFET
// (IRLZ44N / IRL540N / IRLB8721). The 5 V pump is powered from a dedicated 5 V
// boost branch — never the 3.3 V rail or raw VBAT (§5.2). An external 10 k gate
// pull-down keeps the pump OFF while the MCU boots/floats.
//
// This module ONLY turns the pump on for a bounded time. All dose policy
// (arm, caps, cooldown, anti-replay) lives in dose_fsm — the pump itself is
// a dumb, hard-clamped actuator and is the last physical safeguard.
#pragma once

#include <stdint.h>

// Configure the gate pin, force OFF. Call once in setup().
void pump_init();

// Run the pump for `ms` (hard-clamped to PG_DOSE_MAX_MS). Blocks for the
// duration in short slices, polling `abort()` so a physical disarm can cut it
// short. Returns the actual on-time in ms. Guarantees the pump is OFF on exit.
uint32_t pump_run_ms(uint32_t ms, bool (*abort)());

// Force the pump OFF immediately (used by the hard-kill path).
void pump_off();
