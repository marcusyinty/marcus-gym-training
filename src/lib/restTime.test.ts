import { describe, expect, it } from 'vitest';
import { workoutProgram } from '../data/workoutProgram';
import {
  addRestTime,
  formatMmSs,
  isRestOver,
  restProgress,
  restRemainingMs,
  restSecondsForReps,
  restSecondsLeft,
  startRestCountdown,
} from './restTime';

// Every exercise slot in the program with the rest it gets (documented here so changes are visible)
const EXPECTED_REST: Record<string, [reps: string, seconds: number]> = {
  'incline-db-press': ['6–8', 120],
  'lat-pulldown': ['8–10', 120],
  'machine-shoulder-press': ['8–10', 120],
  'one-arm-dumbbell-row': ['8–10', 120],
  'rope-cable-tricep-pushdown': ['10–12', 90],
  'incline-db-supinated-wrist-curl': ['8–10', 120],
  'leg-press': ['8–10', 120],
  rdl: ['8–10', 120],
  'bulgarian-split-squat': ['8–10/leg', 120],
  'seated-leg-curl': ['10–12', 90],
  'standing-calf-raises': ['12–15', 60],
  'flat-db-press': ['8–10', 120],
  'standing-cable-fly': ['10–12', 90],
  'btb-lateral-raise': ['12–15', 60],
  'cable-overhead-tricep-extension': ['10–12', 90],
  'reverse-crunch-abs-a': ['10–15', 60],
  'decline-ab-crunch': ['12–15', 60],
  'seated-cable-row': ['10–12', 90],
  'straight-arm-cable-pulldown': ['12–15', 60],
  'cable-facepull': ['12–15', 60],
  'db-hammer-curl': ['10–12', 90],
  'seated-db-supinated-wrist-curls': ['12–15', 60],
  'seated-db-pronated-wrist-curls': ['12–15', 60],
  'bicycle-crunches': ['12–16 total', 60],
  'reverse-crunch-abs-b': ['10–15', 60],
  'rdl-lower-b': ['8–10', 120],
  'seated-leg-curl-lower-b': ['10–12', 90],
  'leg-press-lower-b': ['8–10', 120],
  'seated-leg-extension': ['12–15', 60],
  '45-degree-back-extension': ['12–15', 60],
};

describe('restSecondsForReps', () => {
  it('gives the expected rest for every exercise in the program', () => {
    const slots = workoutProgram.flatMap((day) => day.exercises);
    expect(slots.map((slot) => slot.id).sort()).toEqual(Object.keys(EXPECTED_REST).sort());
    for (const slot of slots) {
      const [reps, seconds] = EXPECTED_REST[slot.id];
      expect(slot.reps).toBe(reps);
      expect(restSecondsForReps(slot.reps)).toBe(seconds);
    }
  });

  it('uses the last number as the upper bound: <= 10 -> 120s, 11-12 -> 90s, 13+ -> 60s', () => {
    expect(restSecondsForReps('10')).toBe(120);
    expect(restSecondsForReps('11')).toBe(90);
    expect(restSecondsForReps('12')).toBe(90);
    expect(restSecondsForReps('13')).toBe(60);
    expect(restSecondsForReps('15–8')).toBe(120); // last number wins, even if smaller
    expect(restSecondsForReps('8–10/leg')).toBe(120);
    expect(restSecondsForReps('12–16 total')).toBe(60);
  });

  it('gives 90s when there is no number to read', () => {
    expect(restSecondsForReps('')).toBe(90);
    expect(restSecondsForReps('AMRAP')).toBe(90);
    expect(restSecondsForReps('to failure')).toBe(90);
  });
});

describe('countdown maths', () => {
  const START = 1_700_000_000_000;

  it('starts with the full time and counts down from the end time', () => {
    const c = startRestCountdown(120, START);
    expect(restSecondsLeft(c, START)).toBe(120);
    expect(formatMmSs(restSecondsLeft(c, START))).toBe('02:00');
    expect(formatMmSs(restSecondsLeft(c, START + 30_000))).toBe('01:30');
    expect(formatMmSs(restSecondsLeft(c, START + 119_100))).toBe('00:01'); // rounds up until really over
    expect(isRestOver(c, START + 119_999)).toBe(false);
    expect(isRestOver(c, START + 120_000)).toBe(true);
    expect(formatMmSs(restSecondsLeft(c, START + 120_000))).toBe('00:00');
  });

  it('stays correct when time jumps while the page was hidden (no counter to fall behind)', () => {
    const c = startRestCountdown(90, START);
    // screen off for 40s, then back
    expect(restSecondsLeft(c, START + 40_000)).toBe(50);
    expect(restProgress(c, START + 40_000)).toBeCloseTo(40 / 90, 10);
    // screen off for 5 minutes: over, nothing negative
    expect(isRestOver(c, START + 300_000)).toBe(true);
    expect(restRemainingMs(c, START + 300_000)).toBe(0);
    expect(restSecondsLeft(c, START + 300_000)).toBe(0);
    expect(restProgress(c, START + 300_000)).toBe(1);
  });

  it('+15s adds 15 seconds to what is left', () => {
    const c = startRestCountdown(60, START);
    const later = addRestTime(c, START + 20_000, 15);
    expect(restSecondsLeft(later, START + 20_000)).toBe(40 + 15);
    expect(later.durationMs).toBe(75_000);
    // pressed after the end: counts 15s from now
    const afterEnd = addRestTime(c, START + 70_000, 15);
    expect(restSecondsLeft(afterEnd, START + 70_000)).toBe(15);
  });

  it('progress goes from 0 to 1', () => {
    const c = startRestCountdown(60, START);
    expect(restProgress(c, START)).toBe(0);
    expect(restProgress(c, START + 30_000)).toBeCloseTo(0.5, 10);
    expect(restProgress(c, START + 60_000)).toBe(1);
  });

  it('formats mm:ss', () => {
    expect(formatMmSs(0)).toBe('00:00');
    expect(formatMmSs(59)).toBe('00:59');
    expect(formatMmSs(125)).toBe('02:05');
    expect(formatMmSs(-3)).toBe('00:00');
  });
});
