// Unit tests for the multi-sensor expert architecture (pure modules — no DB,
// so this runs anywhere Node 18+ is available). Dose CAP behaviour (cooldown,
// daily cap, pump ceiling, nonce replay, disarmed) is covered by the existing
// Python test_server_caps.py and is intentionally not duplicated here.
//
// Run: node --test tests/test_intelligence.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { acousticExpert }    from '../backend/services/experts/acousticExpert.js';
import { vibrationExpert }   from '../backend/services/experts/vibrationExpert.js';
import { environmentExpert } from '../backend/services/experts/environmentExpert.js';
import { sensorHealthExpert } from '../backend/services/experts/sensorHealthExpert.js';
import { riskFusionEngine }  from '../backend/services/engines/riskFusionEngine.js';
import { explanationExpert } from '../backend/services/experts/explanationExpert.js';

const inRange = (v) => v >= 0 && v <= 100;

test('acoustic expert: score clamped 0-100 + label buckets + no overclaim', () => {
  for (const sa of [-20, 0, 10, 40, 60, 90, 130]) {
    const r = acousticExpert({ sa, ac: { clk: 5, bands: [-60,-55,-50,-30,-28,-55] } });
    assert.ok(inRange(r.score), `score ${r.score} in range`);
    assert.ok(r.confidence >= 0 && r.confidence <= 1);
  }
  assert.equal(acousticExpert({ sa: 10 }).label, 'quiet');
  assert.equal(acousticExpert({ sa: 85 }).label, 'high_acoustic_activity');
  // honesty: never claims confirmed RPW detection.
  const joined = acousticExpert({ sa: 95, ac: { clk: 12 } }).reasons.join(' ').toLowerCase();
  assert.ok(!joined.includes('rpw detected'));
  assert.ok(!joined.includes('confirmed rpw') || joined.includes('not confirmed rpw'));
});

test('vibration expert: range + corroboration wording', () => {
  const hi = vibrationExpert({ sv: 80, vb: { vib_rms: 0.18, vib_dom_hz: 12 } });
  assert.ok(inRange(hi.score));
  assert.ok(hi.reasons.join(' ').includes('corroborates'));
  const lo = vibrationExpert({ sv: 10, vb: { vib_rms: 0.01, vib_dom_hz: 2 } });
  assert.ok(lo.reasons.join(' ').includes('does not corroborate'));
});

test('environment expert: always context-only, never proves infestation', () => {
  const r = environmentExpert({ st: 80, svoc: 70, th: { core_c: 33, amb_c: 28 }, env: { hum: 55 } });
  assert.ok(inRange(r.score));
  const joined = r.reasons.join(' ').toLowerCase();
  assert.ok(joined.includes('context only'));
  assert.ok(!joined.includes('proves') && !joined.includes('confirms infestation'));
});

test('sensor health: missing acoustic + impossible ranges -> unhealthy + penalty', () => {
  const bad = sensorHealthExpert({ core_c: 250, hum: 180 }, null, 1000);  // no acoustic, impossible temp+hum
  assert.equal(bad.healthy, false);
  assert.ok(bad.faults.length >= 1);
  assert.ok(bad.confidencePenalty > 0);
  const good = sensorHealthExpert(
    { sa: 40, ac_rms: -45, core_c: 30, amb_c: 28, hum: 50, vib_rms: 0.05 },
    { last_seen: 995, status: 'online' }, 1000);
  assert.equal(good.healthy, true);
  assert.equal(good.confidencePenalty, 0);
});

test('sensor health: stale device is a fault', () => {
  const r = sensorHealthExpert({ sa: 40, ac_rms: -45 }, { last_seen: 0, status: 'online' }, 10000);
  assert.equal(r.healthy, false);
  assert.ok(r.faults.join(' ').includes('stale'));
});

test('fusion: risk clamped 0-100 + level mapping', () => {
  const mk = (riskScore) => riskFusionEngine({
    riskScore,
    acoustic: { score: 50, confidence: 0.7, label: 'background_activity' },
    vibration: { score: 50, confidence: 0.6 },
    environment: { score: 20, confidence: 0.4 },
    sensorHealth: { healthy: true, confidencePenalty: 0, score: 100, faults: [], warnings: [] },
  });
  assert.equal(mk(-50).risk, 0);
  assert.equal(mk(200).risk, 100);
  assert.equal(mk(10).level, 'low');
  assert.equal(mk(50).level, 'elevated');
  assert.equal(mk(90).level, 'critical');
});

test('fusion: high acoustic+vibration & healthy -> prepare_human_confirmed_dose', () => {
  const r = riskFusionEngine({
    riskScore: 75,
    acoustic: { score: 85, confidence: 0.9, label: 'high_acoustic_activity' },
    vibration: { score: 70, confidence: 0.8 },
    environment: { score: 30, confidence: 0.4 },
    sensorHealth: { healthy: true, confidencePenalty: 0, score: 100, faults: [], warnings: [] },
  });
  assert.equal(r.recommendation, 'prepare_human_confirmed_dose');
  assert.ok(r.confidence >= 0.35);
});

test('fusion: bad sensor health forces resample (never acts on bad data)', () => {
  const r = riskFusionEngine({
    riskScore: 90,                       // would be critical…
    acoustic: { score: 95, confidence: 0.9 },
    vibration: { score: 80, confidence: 0.8 },
    environment: { score: 40, confidence: 0.5 },
    sensorHealth: { healthy: false, confidencePenalty: 0.6, score: 30, faults: ['acoustic data missing'], warnings: [] },
  });
  assert.equal(r.recommendation, 'resample');   // …but health gate wins
});

test('fusion: environment alone does NOT trigger a dose recommendation', () => {
  const r = riskFusionEngine({
    riskScore: 20,                        // authoritative risk stays low
    acoustic: { score: 10, confidence: 0.5 },
    vibration: { score: 5, confidence: 0.4 },
    environment: { score: 95, confidence: 0.6 },  // high context, but context only
    sensorHealth: { healthy: true, confidencePenalty: 0, score: 100, faults: [], warnings: [] },
  });
  assert.notEqual(r.recommendation, 'prepare_human_confirmed_dose');
  assert.equal(r.recommendation, 'observe');
});

test('explanation: honest, withholds on bad health, no overclaim', () => {
  const bad = explanationExpert(
    { level: 'critical', risk: 90, confidence: 0.2, recommendation: 'resample',
      expertBreakdown: { acoustic: { score: 95 }, vibration: { score: 80 }, sensorHealth: { healthy: false, faults: ['acoustic data missing'] } } },
    { allowed: false });
  assert.ok(bad.toLowerCase().includes('resample'));
  assert.ok(!bad.toLowerCase().includes('rpw detected'));

  const ok = explanationExpert(
    { level: 'high', risk: 72, confidence: 0.8, recommendation: 'prepare_human_confirmed_dose',
      expertBreakdown: { acoustic: { score: 80 }, vibration: { score: 65 }, sensorHealth: { healthy: true, faults: [] } } },
    { allowed: true, demoClearWaterOnly: true });
  assert.ok(ok.toLowerCase().includes('human confirmation'));
  assert.ok(ok.toLowerCase().includes('clear-water'));
});
