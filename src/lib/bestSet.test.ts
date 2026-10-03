import { describe, expect, it } from 'vitest';
import { estimateOneRepMaxKg, isNewBest } from './bestSet';
import { KG_PER_LB } from './units';
import { PreviousBest } from './savedData';

const kg = (weight: string, reps: string): PreviousBest => ({ weight, reps, unit: 'kg' });
const lbs = (weight: string, reps: string): PreviousBest => ({ weight, reps, unit: 'lbs' });

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
