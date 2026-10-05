import { describe, expect, it } from 'vitest';
import { BodyData, BodyEntry } from './body';
import {
  bodySummary, changeBetween, dayNumber, inChartRange, movingAverage, niceScale, rangeStartDay, weightSeries, WeightPoint,
} from './bodyChart';

const kg = (value: string): BodyEntry => ({ weight: { value, unit: 'kg' } });
const lbs = (value: string): BodyEntry => ({ weight: { value, unit: 'lbs' } });
const point = (day: string, text: string): WeightPoint => ({ day, value: Number(text), text });
const NOW = new Date(2026, 9, 6, 9, 30); // 6 Oct 2026, local

describe('the weight series', () => {
  it('is oldest first, in the unit shown: as typed in that unit, converted otherwise', () => {
    const body: BodyData = { entries: { '2026-10-05': kg('72.4'), '2026-09-01': lbs('165'), '2026-10-01': kg('73') } };
    const series = weightSeries(body, 'kg');
    expect(series.map((p) => [p.day, p.text])).toEqual([['2026-09-01', '74.8'], ['2026-10-01', '73'], ['2026-10-05', '72.4']]);
    expect(series[0].value).toBeCloseTo(74.8427, 3);
    expect(weightSeries(body, 'lbs').map((p) => p.text)).toEqual(['165', '160.9', '159.6']);
    expect(weightSeries(undefined, 'kg')).toEqual([]);
  });
});

describe('the 7-entry average', () => {
  it('is empty until there are 7 entries, then the mean of the last 7 entries', () => {
    const values = [70, 71, 72, 73, 74, 75, 76, 77, 84];
    const avg = movingAverage(values);
    expect(avg.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(avg[6]).toBeCloseTo(73, 10);
    expect(avg[7]).toBeCloseTo(74, 10);
    expect(avg[8]).toBeCloseTo((72 + 73 + 74 + 75 + 76 + 77 + 84) / 7, 10);
    expect(movingAverage([70, 71])).toEqual([null, null]);
  });
});

describe('ranges', () => {
  it('"last 30 days" is today and the 29 days before it; month and year ends work', () => {
    expect(rangeStartDay(30, NOW)).toBe('2026-09-07');
    expect(rangeStartDay(90, NOW)).toBe('2026-07-09');
    expect(rangeStartDay(30, new Date(2026, 0, 10))).toBe('2025-12-12');
    const points = [point('2026-09-06', '75'), point('2026-09-07', '74'), point('2026-10-06', '73')];
    expect(inChartRange(points, '30', NOW).map((p) => p.day)).toEqual(['2026-09-07', '2026-10-06']);
    expect(inChartRange(points, 'all', NOW)).toHaveLength(3);
  });
  it('time axis: one step per calendar day, also over a clock change', () => {
    expect(dayNumber('2026-10-26') - dayNumber('2026-10-24')).toBe(2);
    expect(dayNumber('2026-03-30') - dayNumber('2026-03-28')).toBe(2);
  });
});

describe('the summary', () => {
  it('nothing for no entries; only "latest" for one', () => {
    expect(bodySummary([], NOW)).toEqual({ latest: null, sinceFirst: null, last30: null });
    const one = bodySummary([point('2026-10-05', '72.4')], NOW);
    expect(one.latest?.text).toBe('72.4');
    expect([one.sinceFirst, one.last30]).toEqual([null, null]);
  });
  it('since the first entry, and first vs last within the last 30 days', () => {
    const series = [point('2026-06-01', '80'), point('2026-09-10', '74.5'), point('2026-09-20', '73.6'), point('2026-10-05', '73.1')];
    const s = bodySummary(series, NOW);
    expect([s.sinceFirst?.from.day, s.sinceFirst?.to.day, s.sinceFirst?.change]).toEqual(['2026-06-01', '2026-10-05', '−6.9']);
    expect([s.last30?.from.day, s.last30?.to.day, s.last30?.change]).toEqual(['2026-09-10', '2026-10-05', '−1.4']);
  });
  it('"last 30 days" needs 2 entries inside the window', () => {
    const s = bodySummary([point('2026-08-01', '75'), point('2026-10-01', '74')], NOW);
    expect(s.sinceFirst?.change).toBe('−1');
    expect(s.last30).toBeNull();
  });
  it('changes use the precision shown, with no float noise: +, − or 0', () => {
    expect(changeBetween(point('a', '72.4'), point('b', '73.1')).change).toBe('+0.7');
    expect(changeBetween(point('a', '73.1'), point('b', '72.4')).change).toBe('−0.7');
    expect(changeBetween(point('a', '72.4'), point('b', '72.45')).change).toBe('+0.05');
    expect(changeBetween(point('a', '72'), point('b', '74')).change).toBe('+2');
    expect(changeBetween(point('a', '72.40'), point('b', '72.4')).change).toBe('0');
  });
});

describe('the axis', () => {
  it('round numbers around the values', () => {
    expect(niceScale(72.4, 73.1)).toEqual({ min: 72, max: 73.5, ticks: [72, 72.5, 73, 73.5] });
    expect(niceScale(72, 72)).toEqual({ min: 71.5, max: 72.5, ticks: [71.5, 72, 72.5] });
    expect(niceScale(61, 118).ticks).toEqual([60, 80, 100, 120]);
    expect(niceScale(150.2, 171.9).ticks).toEqual([150, 160, 170, 180]);
  });
});
