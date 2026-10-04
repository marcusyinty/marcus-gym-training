import { describe, expect, it } from 'vitest';
import { workoutProgram } from '../../data/workoutProgram';
import { AppDataV3, Cycle } from '../model';
import { WeightUnit } from '../units';
import { buildWeeklyReport } from '../weeklyReport';
import { currentWeekNumber, formatDayRange, pastWeeks } from '../weeks';
import { reduce, StoreAction } from './reducer';
import { previousBest } from './selectors';

const ctx = { now: new Date('2026-10-04T18:00:00.000Z') };
const run = (state: AppDataV3, ...actions: StoreAction[]) => actions.reduce((s, a) => reduce(s, a, ctx), state);
const tick = (slotId: string, setIndex: number, unit: WeightUnit = 'kg'): StoreAction => ({ type: 'toggleSet', slotId, setIndex, unit });
const weight = (slotId: string, setIndex: number, value: string, unit: WeightUnit = 'kg'): StoreAction => ({ type: 'editWeight', slotId, setIndex, weight: value, unit });
const reps = (slotId: string, setIndex: number, value: string, unit: WeightUnit = 'kg'): StoreAction => ({ type: 'editReps', slotId, setIndex, reps: value, unit });
const newWeek = (cycleId: string, newId: string): StoreAction => ({ type: 'startNewWeek', cycleId, newId });
const snapshot = (value: unknown) => JSON.parse(JSON.stringify(value));

const OLD_WEEK: Cycle = {
  id: 'week-1',
  startedAt: '2026-09-21T06:00:00.000Z',
  endedAt: '2026-09-27T20:00:00.000Z',
  slots: { squat: { slotId: 'squat', exerciseId: 'squat', performedExerciseId: 'squat', sets: { 0: { weight: '80', reps: '8', unit: 'kg', done: true } } } },
};
const start = (): AppDataV3 => ({
  schemaVersion: 3,
  currentCycle: { id: 'week-2', startedAt: '2026-09-28T06:00:00.000Z', slots: {} },
  archivedCycles: [OLD_WEEK],
  bests: { squat: { weight: '80', reps: '8', unit: 'kg' } },
  reportShownCycleIds: ['week-1'],
});
// Week 2 with real work in it: 60 x 8 and 62.5 x 6 on the incline press, a tick-only lat pulldown set
const trained = () => run(start(), weight('incline-db-press', 0, '60'), reps('incline-db-press', 0, '8'), tick('incline-db-press', 0),
  weight('incline-db-press', 1, '62.5'), reps('incline-db-press', 1, '6'), tick('incline-db-press', 1), tick('lat-pulldown', 0));

describe('start new week', () => {
  it('archives the current week with an end time and starts an empty one; bests and "shown" stay', () => {
    const before = trained();
    const after = reduce(before, newWeek('week-2', 'week-3'), ctx);
    expect(after.archivedCycles).toEqual([OLD_WEEK, { ...before.currentCycle, endedAt: '2026-10-04T18:00:00.000Z' }]);
    expect(after.currentCycle).toEqual({ id: 'week-3', startedAt: '2026-10-04T18:00:00.000Z', slots: {} });
    expect(after.bests).toBe(before.bests);
    expect(after.reportShownCycleIds).toBe(before.reportShownCycleIds);
  });

  it('is blocked when the week has no ticked set (typed values alone do not count)', () => {
    const typedOnly = run(start(), weight('incline-db-press', 0, '60'), reps('incline-db-press', 0, '8'));
    for (const state of [start(), typedOnly]) expect(reduce(state, newWeek('week-2', 'week-3'), ctx)).toBe(state);
  });

  it('does nothing when another tab already moved on (stale week id) or the new id is already used', () => {
    const state = trained();
    for (const action of [newWeek('week-1', 'week-3'), newWeek('some-old-id', 'week-3'), newWeek('week-2', 'week-1'), newWeek('week-2', 'week-2')]) {
      expect(reduce(state, action, ctx)).toBe(state);
    }
  });

  it('weeks are numbered by their order in history; the current week comes next', () => {
    let state = trained();
    state = run(state, newWeek('week-2', 'week-3'), tick('leg-press', 0), newWeek('week-3', 'week-4'));
    expect(pastWeeks(state).map((w) => [w.number, w.cycle.id])).toEqual([[1, 'week-1'], [2, 'week-2'], [3, 'week-3']]);
    expect(currentWeekNumber(state)).toBe(4);
    // a week missing from the list (e.g. dropped as damaged): later weeks move up one number, dates stay
    const withoutFirst = { ...state, archivedCycles: state.archivedCycles.slice(1) };
    expect(pastWeeks(withoutFirst).map((w) => [w.number, w.cycle.id])).toEqual([[1, 'week-2'], [2, 'week-3']]);
  });

  it('bests are never lowered by a new week, and lighter sets later do not lower them', () => {
    const state = run(trained(), newWeek('week-2', 'week-3'), weight('incline-db-press', 0, '40'), reps('incline-db-press', 0, '5'), tick('incline-db-press', 0));
    expect(previousBest(state, 'incline-db-press')).toEqual({ weight: '60', reps: '8', unit: 'kg' });
    expect(state.bests.squat).toEqual({ weight: '80', reps: '8', unit: 'kg' });
  });
});

describe('reset rules: this week only', () => {
  const withHistory = () => run(trained(), newWeek('week-2', 'week-3'), weight('leg-press', 0, '100'), reps('leg-press', 0, '10'), tick('leg-press', 0), tick('incline-db-press', 0));

  it('reset day clears only those slots of the current week; history and bests untouched', () => {
    const before = withHistory();
    const archived = snapshot(before.archivedCycles);
    const bests = snapshot(before.bests);
    const after = reduce(before, { type: 'resetDay', slotIds: workoutProgram[1].exercises.map((e) => e.id) }, ctx); // Day 2 (leg press)
    expect(Object.keys(after.currentCycle.slots)).toEqual(['incline-db-press']);
    expect([after.archivedCycles, after.bests]).toEqual([archived, bests]);
  });

  it('reset all clears only the current week; history and bests untouched', () => {
    const before = withHistory();
    const archived = snapshot(before.archivedCycles);
    const bests = snapshot(before.bests);
    const after = reduce(before, { type: 'resetAll' }, ctx);
    expect(after.currentCycle).toEqual({ ...before.currentCycle, slots: {} });
    expect([after.archivedCycles, after.bests]).toEqual([archived, bests]);
    expect(previousBest(after, 'leg-press')).toEqual({ weight: '100', reps: '10', unit: 'kg' }); // bests never go down
  });
});

describe('weekly report from any week', () => {
  it('builds the report of an archived week, in the unit shown now', () => {
    const state = run(trained(), weight('lat-pulldown', 1, '135', 'lbs'), reps('lat-pulldown', 1, '10', 'lbs'), tick('lat-pulldown', 1, 'lbs'),
      reps('one-arm-dumbbell-row', 0, '12'), tick('one-arm-dumbbell-row', 0), newWeek('week-2', 'week-3'));
    const archived = state.archivedCycles[1];
    const kg = buildWeeklyReport(archived, workoutProgram, 'kg');
    const exercise = (id: string) => kg.days.flatMap((d) => d.exercises).find((e) => e.id === id)!;
    expect(exercise('incline-db-press').top).toEqual({ kind: 'weight', weightText: '62.5', reps: 6 });
    expect(exercise('lat-pulldown').top).toEqual({ kind: 'weight', weightText: '61.2', reps: 10 }); // 135 lbs shown in kg
    expect(exercise('one-arm-dumbbell-row').top).toEqual({ kind: 'bodyweight', reps: 12 });
    expect(exercise('machine-shoulder-press').top).toEqual({ kind: 'none' });
    // 60x8 + 62.5x6 + 135 lbs x 10 (= 612.35 kg)
    expect(kg.totalVolume).toBeCloseTo(480 + 375 + 612.35, 1);
    expect([kg.tickedSets, kg.completedSets, kg.totalSets, kg.totalExercises, kg.doneExercises, kg.totalDays]).toEqual([5, 5, 89, 30, 0, 5]);
    const lbs = buildWeeklyReport(archived, workoutProgram, 'lbs');
    expect(lbs.totalVolume).toBeCloseTo((480 + 375) * 2.20462 + 1350, 0);
  });

  it('a tick without typed values shows the ticked count, never a made-up "BW x 12"', () => {
    const report = buildWeeklyReport(trained().currentCycle, workoutProgram, 'kg');
    const lat = report.days[0].exercises.find((e) => e.id === 'lat-pulldown')!;
    expect(lat.top).toEqual({ kind: 'ticked', sets: 1 });
  });

  it('an empty week reports zero everywhere', () => {
    const report = buildWeeklyReport(start().currentCycle, workoutProgram, 'kg');
    expect([report.tickedSets, report.totalVolume, report.doneExercises, report.totalExercises]).toEqual([0, 0, 0, 30]);
    expect(report.days.flatMap((d) => d.exercises).every((e) => e.top.kind === 'none')).toBe(true);
  });

  it('counts an exercise as done only when every set is ticked', () => {
    const state = run(start(), tick('incline-db-press', 0), tick('incline-db-press', 1), tick('incline-db-press', 2), tick('lat-pulldown', 0));
    expect(buildWeeklyReport(state.currentCycle, workoutProgram, 'kg').doneExercises).toBe(1);
  });
});

describe('week dates (local calendar days)', () => {
  const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
  it('writes the year once when both days share it', () => {
    expect(formatDayRange(local(2026, 9, 28), local(2026, 10, 4), 'en')).toMatch(/^28 Sept? – 4 Oct 2026$/);
    expect(formatDayRange(local(2026, 9, 28), local(2026, 10, 4), 'zh')).toBe('2026年9月28日 – 10月4日');
    expect(formatDayRange(local(2026, 12, 28), local(2027, 1, 3), 'en')).toMatch(/^28 Dec 2026 – 3 Jan 2027$/);
  });
  it('unreadable dates give null instead of "Invalid Date"', () => {
    expect(formatDayRange('t', local(2026, 10, 4), 'en')).toBeNull();
    expect(formatDayRange(local(2026, 10, 4), undefined, 'zh')).toBeNull();
  });
});
