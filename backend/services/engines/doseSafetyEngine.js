// Safety Dose Agent — read-only safety view over the server-authoritative dose
// caps in doseEngine.js. It does NOT gate, create, confirm, or send any dose;
// it only reports the safety posture for the UI/explanation. The actual gating
// stays in doseEngine.serverCapsPass (mirrored by the device failsafes).
//
// Human confirmation is ALWAYS required by design; demo is clear water only.
//
// Input:  deviceId, isDemo
// Output: { allowed, blockedReason, requiresHumanConfirmation, demoClearWaterOnly, caps }

import * as doseEngine from '../doseEngine.js';

export const doseSafetyEngine = (deviceId, isDemo = false) => {
  const s = doseEngine.capsSnapshot(deviceId);
  return {
    allowed: s.capsPass.ok,                 // would server caps pass IF a confirmed dose existed
    blockedReason: s.capsPass.ok ? null : s.capsPass.reason,
    requiresHumanConfirmation: true,        // mandatory — never auto-released without arm + confirm
    demoClearWaterOnly: !!isDemo,
    caps: {
      armed: s.armed,
      maxDosesDay: s.maxDosesDay,
      dosesToday: s.dosesToday,
      cooldownS: s.cooldownS,
      cooldownRemainingS: s.cooldownRemainingS,
      pumpMs: s.pumpMs,
      pumpMsCeiling: s.pumpMsCeiling,
      antiReplayNonce: true,                // every sent dose carries a single-use nonce
    },
  };
};

export default doseSafetyEngine;
