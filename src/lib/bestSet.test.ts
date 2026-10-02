import { describe, expect, it } from 'vitest';
import { estimateOneRepMaxKg, isNewBest, nextPreviousBests, WorkoutLog } from './bestSet';
import { KG_PER_LB } from './units';
import { PreviousBest, PreviousBests } from './savedData';

const kg = (weight: string, reps: string): PreviousBest => ({ weight, reps, unit: 'kg' });
const lbs = (weight: string, reps: string): PreviousBest => ({ weight, reps, unit: 'lbs' });

// Builds a log where `done` lists the ticked set indexes and `sets` the typed weight/reps per set index
const log = (done: number[], sets: Record<number, PreviousBest>): WorkoutLog => ({
  completedSets: { bench: done },
  setDetails: {
    bench: Object.fromEntries(
      Object.entries(sets).map(([i, s]) => [i, { setNumber: Number(i) + 1, ...s }])
    ),
  },
});

describe('estimateOneRepMaxKg (Epley)', () => {
  it('computes weight * (1 + reps / 30)', () => {
    expect(estimateOneRepMaxKg(kg('60', '8'))).toBeCloseTo(76.0, 10);
    expect(estimateOneRepMaxKg(kg('62.5', '6'))).toBeCloseTo(75.0, 10);
    expect(estimateOneRepMaxKg(kg('65', '6'))).toBeCloseTo(78.0, 10);
    expect(estimateOneRepMaxKg(kg('100', '1'))).toBeCloseTo(103.333333, 5);
  });

  it('converts lbs to kg (1 lb = 0.45359237 kg)', () => {
    expect(estimateOneRepMaxKg(lbs('100', '30'))).toBeCloseTo(100 * KG_PER_LB * 2, 10);
    expect(estimateOneRepMaxKg(lbs('135', '10'))).toBeCloseTo(81.6466266, 6);
  });

  it('ignores invalid values: empty, unfinished, not a number, zero or negative', () => {
    for (const bad of ['', ' ', '62.', 'abc', '1e3', '0', '0.0', '-5', 'NaN', '60kg']) {
      expect(estimateOneRepMaxKg(kg(bad, '8'))).toBeNull();
      expect(estimateOneRepMaxKg(kg('60', bad))).toBeNull();
    }
  });
});

describe('isNewBest', () => {
  it('ranks by estimate, not by weight alone', () => {
    expect(isNewBest(kg('62.5', '6'), kg('60', '8'))).toBe(false); // heavier, but 75.0 < 76.0
    expect(isNewBest(kg('65', '6'), kg('60', '8'))).toBe(true); // 78.0 > 76.0
  });

  it('compares kg and lbs correctly even when the raw numbers mislead', () => {
    expect(isNewBest(lbs('200', '5'), kg('100', '5'))).toBe(false); // 200 lbs = 90.7 kg
    expect(isNewBest(lbs('225', '5'), kg('100', '5'))).toBe(true); // 225 lbs = 102.1 kg
    expect(isNewBest(kg('100', '5'), lbs('225', '5'))).toBe(false);
  });

  it('keeps the existing best on a tie', () => {
    expect(isNewBest(kg('60', '8'), kg('60', '8'))).toBe(false);
    expect(isNewBest(kg('75', '2'), kg('60', '10'))).toBe(false); // both exactly 80.0
    expect(isNewBest(lbs(String(100 / KG_PER_LB), '5'), kg('100', '5'))).toBe(false); // same load in lbs
  });

  it('never picks an invalid set, but lets a valid set replace an invalid stored best', () => {
    expect(isNewBest(kg('', '8'), undefined)).toBe(false);
    expect(isNewBest(kg('60', '0'), kg('10', '1'))).toBe(false);
    expect(isNewBest(kg('20', '5'), undefined)).toBe(true);
    expect(isNewBest(kg('20', '5'), kg('abc', '5'))).toBe(true);
  });
});

describe('nextPreviousBests', () => {
  const best = (b: PreviousBest): PreviousBests => ({ bench: b });

  it('does not count sets that are not done (typing without ticking)', () => {
    const bests: PreviousBests = {};
    expect(nextPreviousBests(bests, log([], {}), log([], { 0: kg('60', '8') }))).toBe(bests);
  });

  it('sets a best when a set becomes done', () => {
    const before = log([], { 0: kg('60', '8') });
    const after = log([0], { 0: kg('60', '8') });
    expect(nextPreviousBests({}, before, after)).toEqual(best(kg('60', '8')));
  });

  it('keeps the best when a set with a lower estimate is done, and updates it for a higher one', () => {
    const bests = best(kg('60', '8'));
    const lower = nextPreviousBests(bests, log([0], { 0: kg('60', '8'), 1: kg('62.5', '6') }), log([0, 1], { 0: kg('60', '8'), 1: kg('62.5', '6') }));
    expect(lower).toBe(bests);
    const higher = nextPreviousBests(bests, log([0], { 0: kg('60', '8'), 1: kg('65', '6') }), log([0, 1], { 0: kg('60', '8'), 1: kg('65', '6') }));
    expect(higher).toEqual(best(kg('65', '6')));
  });

  it('never lowers a best when a set is unticked', () => {
    const bests = best(kg('65', '6'));
    expect(nextPreviousBests(bests, log([0], { 0: kg('65', '6') }), log([], { 0: kg('65', '6') }))).toBe(bests);
  });

  it('never lowers a best when a done set is edited lower, but raises it when edited higher', () => {
    const bests = best(kg('65', '6'));
    expect(nextPreviousBests(bests, log([0], { 0: kg('65', '6') }), log([0], { 0: kg('50', '6') }))).toBe(bests);
    expect(nextPreviousBests(bests, log([0], { 0: kg('65', '6') }), log([0], { 0: kg('65', '9') }))).toEqual(best(kg('65', '9')));
  });

  it('keeps the existing best on a tie', () => {
    const bests = best(kg('60', '10'));
    expect(nextPreviousBests(bests, log([], { 0: kg('75', '2') }), log([0], { 0: kg('75', '2') }))).toBe(bests);
  });

  it('ignores invalid values on done sets', () => {
    const bests: PreviousBests = {};
    expect(nextPreviousBests(bests, log([], { 0: kg('60', '') }), log([0], { 0: kg('60', '') }))).toBe(bests);
  });

  it('stores the best in its own unit, exactly as typed', () => {
    const after = log([0], { 0: lbs('135', '10') });
    expect(nextPreviousBests({}, log([], {}), after)).toEqual(best(lbs('135', '10')));
  });

  it('leaves existing bests alone when unrelated sets change (no full recount)', () => {
    // Old data: 60 x 8 is done and beats the stored best, but nothing about it changed
    const bests = best(kg('62.5', '6'));
    const before = log([0, 1], { 0: kg('60', '8'), 1: kg('62.5', '6') });
    const after = log([0, 1, 2], { 0: kg('60', '8'), 1: kg('62.5', '6'), 2: kg('40', '5') });
    expect(nextPreviousBests(bests, before, after)).toBe(bests);
  });

  it('works when another tab delivers the tick before the weight/reps', () => {
    const tickArrives = nextPreviousBests({}, log([], {}), log([0], {}));
    expect(tickArrives).toEqual({});
    const detailsArrive = nextPreviousBests(tickArrives, log([0], {}), log([0], { 0: kg('65', '6') }));
    expect(detailsArrive).toEqual(best(kg('65', '6')));
  });

  it('returns the same object when nothing changed', () => {
    const bests = best(kg('60', '8'));
    const same = log([0], { 0: kg('60', '8') });
    expect(nextPreviousBests(bests, same, same)).toBe(bests);
  });
});
