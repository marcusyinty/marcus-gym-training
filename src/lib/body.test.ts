import { describe, expect, it } from 'vitest';
import {
  checkBodyEntryInput, checkBodyValue, cleanBody, displayBodyWeight, displayLength, isFutureDay, isValidDay, limitsIn,
  localDay, MAX_BODY_ENTRIES, parseBodyNumber, sameEntryValues,
} from './body';

describe('typing a number', () => {
  it('accepts "." and "," as the decimal mark, up to 2 decimals; rejects anything else', () => {
    expect(['72.4', '72,4', ' 72 ', '0,5', '72.45'].map(parseBodyNumber)).toEqual(['72.4', '72.4', '72', '0.5', '72.45']);
    expect(['', '72.', ',5', 'abc', '1e3', '-5', '72.456', '7 2', '72.4kg', '12345', '1,234.5'].map(parseBodyNumber)).toEqual(Array(11).fill(null));
  });
});

describe('ranges (the same limits in both units)', () => {
  const ok = (field: Parameters<typeof checkBodyValue>[0], text: string, unit: Parameters<typeof checkBodyValue>[2]) => checkBodyValue(field, text, unit).ok;
  it('weight 20-400 kg = 44.1-881.8 lbs', () => {
    expect([ok('weight', '20', 'kg'), ok('weight', '19.9', 'kg'), ok('weight', '400', 'kg'), ok('weight', '400.1', 'kg')]).toEqual([true, false, true, false]);
    expect([ok('weight', '44.1', 'lbs'), ok('weight', '44', 'lbs'), ok('weight', '881.8', 'lbs'), ok('weight', '881.9', 'lbs')]).toEqual([true, false, true, false]);
  });
  it('waist and hips 30-250 cm = 11.9-98.4 in; height 100-250 cm = 39.4-98.4 in', () => {
    expect([ok('waist', '30', 'cm'), ok('waist', '29.9', 'cm'), ok('hips', '250', 'cm'), ok('hips', '250.1', 'cm')]).toEqual([true, false, true, false]);
    expect([ok('waist', '11.9', 'in'), ok('waist', '11.8', 'in'), ok('hips', '98.4', 'in'), ok('hips', '98.5', 'in')]).toEqual([true, false, true, false]);
    expect([ok('height', '100', 'cm'), ok('height', '99.9', 'cm'), ok('height', '39.4', 'in'), ok('height', '39.3', 'in'), ok('height', '98.4', 'in'), ok('height', '98.5', 'in')]).toEqual([true, false, true, false, true, false]);
  });
  it('the limits as shown in each unit (rounded inwards, so every shown number is accepted)', () => {
    expect([limitsIn('weight', 'kg'), limitsIn('weight', 'lbs'), limitsIn('waist', 'cm'), limitsIn('waist', 'in'), limitsIn('height', 'in')]).toEqual([
      ['20', '400'], ['44.1', '881.8'], ['30', '250'], ['11.9', '98.4'], ['39.4', '98.4'],
    ]);
  });
  it('a problem says which kind: not a number or out of range', () => {
    expect([checkBodyValue('weight', 'abc', 'kg'), checkBodyValue('weight', '500', 'kg')]).toEqual([{ ok: false, problem: 'notNumber' }, { ok: false, problem: 'outOfRange' }]);
  });
});

describe('showing values', () => {
  it('as typed in the same unit; converted with 1 decimal, no trailing .0, in the other', () => {
    expect([displayBodyWeight({ value: '72.40', unit: 'kg' }, 'kg'), displayBodyWeight({ value: '72.4', unit: 'kg' }, 'lbs'), displayBodyWeight({ value: '160', unit: 'lbs' }, 'kg')]).toEqual(['72.40', '159.6', '72.6']);
    expect([displayLength({ value: '80', unit: 'cm' }, 'in'), displayLength({ value: '31.5', unit: 'in' }, 'cm'), displayLength({ value: '25.4', unit: 'cm' }, 'in')]).toEqual(['31.5', '80', '10']);
  });
  it('no drift: 5 unit switches show exactly the same numbers (the stored value never changes)', () => {
    const weight = { value: '72.4', unit: 'kg' as const };
    const seen = [];
    for (let i = 0; i < 6; i++) seen.push(displayBodyWeight(weight, i % 2 === 0 ? 'kg' : 'lbs'));
    expect(seen).toEqual(['72.4', '159.6', '72.4', '159.6', '72.4', '159.6']);
  });
});

describe('days', () => {
  it('real calendar days from 1900 on', () => {
    expect(['2024-02-29', '2026-10-06', '1900-01-01'].map(isValidDay)).toEqual([true, true, true]);
    expect(['2026-02-29', '2026-13-01', '2026-10-32', '1899-12-31', '2026-1-5', 'today', ''].map(isValidDay)).toEqual(Array(7).fill(false));
  });
  it('the phone\'s local day; tomorrow is in the future', () => {
    const now = new Date(2026, 9, 6, 23, 30);
    expect([localDay(now), isFutureDay('2026-10-06', now), isFutureDay('2026-10-07', now), isFutureDay('2025-12-31', now)]).toEqual(['2026-10-06', false, true, false]);
  });
});

describe('checking a whole entry', () => {
  const now = new Date(2026, 9, 6, 9, 0);
  it('weight required, waist and hips optional, comma accepted, lengths in cm with kg / inches with lbs', () => {
    expect(checkBodyEntryInput({ day: '2026-10-06', weight: '72,4', waist: '', hips: '95', unit: 'kg' }, now)).toEqual({
      ok: true, day: '2026-10-06', entry: { weight: { value: '72.4', unit: 'kg' }, hips: { value: '95', unit: 'cm' } },
    });
    expect(checkBodyEntryInput({ day: '2026-10-06', weight: '160', waist: '31,5', hips: '', unit: 'lbs' }, now)).toEqual({
      ok: true, day: '2026-10-06', entry: { weight: { value: '160', unit: 'lbs' }, waist: { value: '31.5', unit: 'in' } },
    });
  });
  it('every problem is reported, nothing half-saved', () => {
    expect(checkBodyEntryInput({ day: '2026-10-07', weight: '', waist: 'abc', hips: '400', unit: 'kg' }, now)).toEqual({
      ok: false, problems: [{ field: 'day', problem: 'future' }, { field: 'weight', problem: 'required' }, { field: 'waist', problem: 'notNumber' }, { field: 'hips', problem: 'outOfRange' }],
    });
    expect(checkBodyEntryInput({ day: '2026-02-30', weight: '70', waist: '', hips: '', unit: 'kg' }, now)).toEqual({ ok: false, problems: [{ field: 'day', problem: 'badDay' }] });
  });
});

describe('loading body data', () => {
  const entry = (weight: string, extra: object = {}) => ({ weight: { value: weight, unit: 'kg' }, ...extra });
  it('valid data comes back unchanged (unknown extra fields kept)', () => {
    const raw = { height: { value: '178', unit: 'cm' }, note: 'future field', entries: { '2026-10-05': entry('72.4', { waist: { value: '80', unit: 'cm' }, updatedAt: 't', mood: 'x' }), '2026-10-01': entry('73') } };
    const { body, dropped } = cleanBody(JSON.parse(JSON.stringify(raw)));
    expect(dropped).toBe(false);
    expect(body).toStrictEqual(raw);
  });
  it('drops an entry with a bad day or a bad weight; a bad waist/hips drops just that value; a bad height goes', () => {
    const { body, dropped } = cleanBody({
      height: { value: '999', unit: 'cm' },
      entries: {
        '2026-10-05': entry('72.4', { waist: { value: 'eighty', unit: 'cm' }, hips: { value: '95', unit: 'cm' } }),
        '2026-02-30': entry('72'),
        '2026-10-04': entry('5000'),
        '2026-10-03': { weight: { value: 72, unit: 'kg' } },
        '2026-10-02': entry('71', { hips: { value: '95', unit: 'stone' } }),
        hello: entry('70'),
      },
    });
    expect(dropped).toBe(true);
    expect(body).toStrictEqual({ entries: { '2026-10-05': entry('72.4', { hips: { value: '95', unit: 'cm' } }), '2026-10-02': entry('71') } });
  });
  it('not an object at all: nothing loaded, counted as dropped', () => {
    for (const bad of ['text', 42, null, [1, 2]]) expect(cleanBody(bad)).toEqual({ body: undefined, dropped: true });
  });
  it('more than 2000 entries (only by hand): the newest 2000 stay', () => {
    const entries: Record<string, object> = {};
    const start = new Date(2015, 0, 1);
    for (let i = 0; i < MAX_BODY_ENTRIES + 5; i++) entries[localDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))] = entry('70');
    const { body, dropped } = cleanBody({ entries });
    const kept = Object.keys(body!.entries).sort();
    expect([dropped, kept.length, kept[0], kept[kept.length - 1]]).toEqual([true, MAX_BODY_ENTRIES, Object.keys(entries).sort()[5], Object.keys(entries).sort()[Object.keys(entries).length - 1]]);
  });
  it('compares entries by their values only', () => {
    expect(sameEntryValues(entry('70', { updatedAt: 'a' }) as never, entry('70', { updatedAt: 'b' }) as never)).toBe(true);
    expect(sameEntryValues(entry('70') as never, entry('70.0') as never)).toBe(false);
  });
});
