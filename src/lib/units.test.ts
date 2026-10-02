import { describe, expect, it } from 'vitest';
import {
  convertWeight,
  displayWeight,
  formatWeight,
  KG_PER_LB,
  pickDefaultUnit,
  toKg,
  WeightedSet,
  withRepsEdit,
  withWeightEdit,
} from './units';

describe('convertWeight', () => {
  it('converts kg to lbs and back', () => {
    expect(convertWeight(60, 'kg', 'lbs')).toBeCloseTo(132.2773573, 6);
    expect(convertWeight(convertWeight(60, 'kg', 'lbs'), 'lbs', 'kg')).toBeCloseTo(60, 10);
    expect(convertWeight(135, 'lbs', 'kg')).toBeCloseTo(61.2349700, 6);
    expect(toKg(1, 'lbs')).toBe(KG_PER_LB);
  });

  it('leaves the value alone for the same unit', () => {
    expect(convertWeight(62.5, 'kg', 'kg')).toBe(62.5);
    expect(toKg(62.5, 'kg')).toBe(62.5);
  });
});

describe('formatWeight', () => {
  it('rounds to 1 decimal', () => {
    expect(formatWeight(132.2773573)).toBe('132.3');
    expect(formatWeight(61.23497)).toBe('61.2');
    expect(formatWeight(45.359237)).toBe('45.4');
  });

  it('drops a trailing ".0"', () => {
    expect(formatWeight(60)).toBe('60');
    expect(formatWeight(60.0101)).toBe('60');
    expect(formatWeight(59.96)).toBe('60');
    expect(formatWeight(0)).toBe('0');
  });
});

describe('displayWeight', () => {
  it('shows the stored text exactly as typed when the unit matches', () => {
    expect(displayWeight('60', 'kg', 'kg')).toBe('60');
    expect(displayWeight('62.50', 'kg', 'kg')).toBe('62.50');
    expect(displayWeight('132.27', 'lbs', 'lbs')).toBe('132.27');
  });

  it('converts and formats when the unit differs: 60 kg -> 132.3 lbs, 132.3 lbs -> 60 kg', () => {
    expect(displayWeight('60', 'kg', 'lbs')).toBe('132.3');
    expect(displayWeight('132.3', 'lbs', 'kg')).toBe('60');
    expect(displayWeight('135', 'lbs', 'kg')).toBe('61.2');
    expect(displayWeight('100', 'lbs', 'kg')).toBe('45.4');
  });

  it('shows empty for empty or invalid input in another unit', () => {
    for (const bad of ['', ' ', 'abc', '-5', '1e3', '62.']) {
      expect(displayWeight(bad, 'kg', 'lbs')).toBe('');
    }
  });
});

describe('pickDefaultUnit', () => {
  const set = (weight: string, unit: 'kg' | 'lbs') => ({ setNumber: 1, weight, reps: '8', unit });

  it('uses kg when there is no data or a tie', () => {
    expect(pickDefaultUnit({})).toBe('kg');
    expect(pickDefaultUnit({ a: { 0: set('60', 'kg'), 1: set('135', 'lbs') } })).toBe('kg');
  });

  it('uses the unit that most sets with a weight were typed in', () => {
    expect(pickDefaultUnit({ a: { 0: set('135', 'lbs'), 1: set('140', 'lbs') }, b: { 0: set('60', 'kg') } })).toBe('lbs');
    expect(pickDefaultUnit({ a: { 0: set('60', 'kg'), 1: set('62.5', 'kg') }, b: { 0: set('135', 'lbs') } })).toBe('kg');
  });

  it('ignores sets that have no weight typed', () => {
    expect(pickDefaultUnit({ a: { 0: set('135', 'lbs'), 1: set('', 'kg'), 2: set('', 'kg'), 3: set(' ', 'kg') } })).toBe('lbs');
  });
});

describe('editing a set', () => {
  const stored60kg: WeightedSet = { weight: '60', reps: '8', unit: 'kg' };

  it('a new weight is saved in the current unit and keeps the reps', () => {
    expect(withWeightEdit(stored60kg, '135', 'lbs')).toEqual({ weight: '135', reps: '8', unit: 'lbs' });
    expect(withWeightEdit(undefined, '135', 'lbs')).toEqual({ weight: '135', reps: '', unit: 'lbs' });
  });

  it('editing only the reps keeps the stored weight and unit (60 kg stays 60 kg while the app shows lbs)', () => {
    expect(withRepsEdit(stored60kg, '10', 'lbs')).toEqual({ weight: '60', reps: '10', unit: 'kg' });
  });

  it('reps typed on an empty set start in the current unit', () => {
    expect(withRepsEdit(undefined, '10', 'lbs')).toEqual({ weight: '', reps: '10', unit: 'lbs' });
  });
});
