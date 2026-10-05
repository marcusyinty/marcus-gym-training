// The Body screen's weight chart and summary, as pure functions (no React, no storage). Weights are shown in
// the app's unit: as typed when they were typed in it, otherwise converted (1 decimal), like everywhere else.
import { BodyData, displayBodyWeight, localDay } from './body';
import { convertWeight, WeightUnit } from './units';

export type ChartRange = '30' | '90' | 'all';
export const CHART_RANGES: ChartRange[] = ['30', '90', 'all'];
export const AVERAGE_WINDOW = 7;

export interface WeightPoint {
  day: string; // "2026-10-06"
  value: number; // in the unit shown, unrounded (for drawing)
  text: string; // as shown, e.g. "72.4"
}

// Every entry's weight, oldest first
export const weightSeries = (body: BodyData | undefined, unit: WeightUnit): WeightPoint[] =>
  Object.keys(body?.entries ?? {})
    .sort()
    .map((day) => {
      const weight = body!.entries[day].weight;
      return { day, value: convertWeight(Number(weight.value), weight.unit, unit), text: displayBodyWeight(weight, unit) };
    });

// The trailing average of the last 7 entries (not days); null until there are 7 entries
export const movingAverage = (values: number[], window = AVERAGE_WINDOW): (number | null)[] =>
  values.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += values[j];
    return sum / window;
  });

// "Last N days" means today and the N-1 days before it (local calendar days); this is the first of them
export const rangeStartDay = (days: number, now: Date): string =>
  localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));

export const inChartRange = <P extends { day: string }>(points: P[], range: ChartRange, now: Date): P[] => {
  if (range === 'all') return points;
  const start = rangeStartDay(Number(range), now);
  return points.filter((p) => p.day >= start);
};

export interface WeightChange {
  from: WeightPoint;
  to: WeightPoint;
  change: string; // "+0.6", "−0.7" or "0", from the two weights as shown
}

const decimals = (text: string) => (text.split('.')[1] ?? '').length;

// The difference between two weights as shown, at the precision they are shown with (no float noise)
export const changeBetween = (from: WeightPoint, to: WeightPoint): WeightChange => {
  const scale = 10 ** Math.max(decimals(from.text), decimals(to.text));
  const diff = Math.round((Number(to.text) - Number(from.text)) * scale) / scale;
  const change = diff === 0 ? '0' : `${diff > 0 ? '+' : '−'}${String(Math.abs(diff))}`;
  return { from, to, change };
};

export interface BodySummary {
  latest: WeightPoint | null;
  sinceFirst: WeightChange | null; // first entry ever vs the latest; needs 2 entries
  last30: WeightChange | null; // first vs last entry within the last 30 days; needs 2 there
}

export const bodySummary = (series: WeightPoint[], now: Date): BodySummary => {
  const latest = series.length > 0 ? series[series.length - 1] : null;
  const sinceFirst = series.length >= 2 ? changeBetween(series[0], series[series.length - 1]) : null;
  const recent = inChartRange(series, '30', now);
  const last30 = recent.length >= 2 ? changeBetween(recent[0], recent[recent.length - 1]) : null;
  return { latest, sinceFirst, last30 };
};

// Round axis numbers around the values (at most ~5 steps): 72.4–73.1 gives 72, 72.5, 73, 73.5
export const niceScale = (low: number, high: number): { min: number; max: number; ticks: number[] } => {
  const span = Math.max(high - low, 1);
  const step = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200].find((s) => span / s <= 4) ?? 200;
  let min = Math.floor(low / step) * step;
  let max = Math.ceil(high / step) * step;
  if (max - min < step) {
    min -= step;
    max += step;
  }
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 1000; v += step) ticks.push(Math.round(v * 100) / 100);
  return { min, max, ticks };
};

// Days as numbers for the time axis (local calendar days, never shifted by the time zone)
export const dayNumber = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
