import { describe, expect, it } from 'vitest';
import { workoutProgram } from '../../data/workoutProgram';
import { performedExerciseIdIn, performedExerciseName } from '../exerciseVariants';
import { AppDataV3 } from '../model';
import { WeightUnit } from '../units';
import { buildWeeklyReport } from '../weeklyReport';
import { createBackupFile, parseBackupFile } from './backup';
import { validateV3 } from './dataV3';
import { reduce, StoreAction } from './reducer';
import { previousBest } from './selectors';
import { checkSwap, swapOptions } from './swap';

const ctx = { now: new Date('2026-10-05T08:00:00.000Z') };
const run = (state: AppDataV3, ...actions: StoreAction[]) => actions.reduce((s, a) => reduce(s, a, ctx), state);
const tick = (slotId: string, setIndex: number, unit: WeightUnit = 'kg'): StoreAction => ({ type: 'toggleSet', slotId, setIndex, unit });
const weight = (slotId: string, setIndex: number, value: string): StoreAction => ({ type: 'editWeight', slotId, setIndex, weight: value, unit: 'kg' });
const reps = (slotId: string, setIndex: number, value: string): StoreAction => ({ type: 'editReps', slotId, setIndex, reps: value, unit: 'kg' });
const swap = (slotId: string, from: string, to: string, cycleId = 'w1'): StoreAction => ({ type: 'swapExercise', cycleId, slotId, from, to });
const logged = (slotId: string, setIndex: number, w: string, r: string) => [weight(slotId, setIndex, w), reps(slotId, setIndex, r), tick(slotId, setIndex)];
const empty = (): AppDataV3 => ({
  schemaVersion: 3,
  currentCycle: { id: 'w1', startedAt: '2026-10-05T06:00:00.000Z', slots: {} },
  archivedCycles: [],
  bests: { 'leg-press': { weight: '200', reps: '8', unit: 'kg' } },
  reportShownCycleIds: [],
});

describe('swapping a slot this week', () => {
  it('by default nothing changes: every slot does its own exercise', () => {
    expect(swapOptions(empty(), 'leg-press')).toEqual({ current: 'leg-press', choices: ['leg-press', 'hack-squat'], blockedBy: null, hasTypedValues: false });
    expect(swapOptions(empty(), 'rdl').choices).toEqual(['rdl']);
  });

  it('allowed with no data: the slot does the alternative this week, nothing else changes', () => {
    const before = empty();
    expect(checkSwap(before, { cycleId: 'w1', slotId: 'leg-press', from: 'leg-press', to: 'hack-squat' })).toEqual({ ok: true, clearsTypedValues: false });
    const after = reduce(before, swap('leg-press', 'leg-press', 'hack-squat'), ctx);
    expect(after.currentCycle.slots['leg-press']).toEqual({ slotId: 'leg-press', exerciseId: 'leg-press', performedExerciseId: 'hack-squat', sets: {} });
    expect([after.bests, swapOptions(after, 'leg-press').current]).toEqual([before.bests, 'hack-squat']);
  });

  it('blocked by a ticked set (either version counts, never both in one week)', () => {
    const state = run(empty(), tick('leg-press', 0));
    expect(checkSwap(state, { cycleId: 'w1', slotId: 'leg-press', from: 'leg-press', to: 'hack-squat' })).toEqual({ ok: false, reason: 'hasTickedSets' });
    expect(reduce(state, swap('leg-press', 'leg-press', 'hack-squat'), ctx)).toBe(state);
    expect(swapOptions(state, 'leg-press').blockedBy).toBe('hasTickedSets');
  });

  it('typed values without a tick are cleared by the swap (they belong to the other exercise)', () => {
    const state = run(empty(), weight('leg-press', 0, '220'), reps('leg-press', 0, '6'));
    expect(swapOptions(state, 'leg-press').hasTypedValues).toBe(true);
    expect(checkSwap(state, { cycleId: 'w1', slotId: 'leg-press', from: 'leg-press', to: 'hack-squat' })).toEqual({ ok: true, clearsTypedValues: true });
    expect(reduce(state, swap('leg-press', 'leg-press', 'hack-squat'), ctx).currentCycle.slots['leg-press'].sets).toEqual({});
  });

  it('swapping back follows the same rule; with no data the slot is as if never touched', () => {
    const swapped = run(empty(), swap('leg-press', 'leg-press', 'hack-squat'));
    expect(run(swapped, swap('leg-press', 'hack-squat', 'leg-press')).currentCycle.slots).toEqual({});
    const ticked = run(swapped, tick('leg-press', 0));
    expect(checkSwap(ticked, { cycleId: 'w1', slotId: 'leg-press', from: 'hack-squat', to: 'leg-press' })).toEqual({ ok: false, reason: 'hasTickedSets' });
  });

  it('other reasons: another week, not allowed, changed elsewhere, same exercise', () => {
    const state = empty();
    const check = (slotId: string, from: string, to: string, cycleId = 'w1') => checkSwap(state, { cycleId, slotId, from, to });
    expect(check('leg-press', 'leg-press', 'hack-squat', 'old-week')).toEqual({ ok: false, reason: 'weekChanged' });
    expect([check('rdl', 'rdl', 'hack-squat'), check('leg-press', 'leg-press', 'pec-deck'), check('not-a-slot', 'x', 'hack-squat')].map((c) => c.ok || c.reason)).toEqual(['notAllowed', 'notAllowed', 'notAllowed']);
    expect(check('leg-press', 'hack-squat', 'leg-press')).toEqual({ ok: false, reason: 'changedElsewhere' });
    expect(check('leg-press', 'leg-press', 'leg-press')).toEqual({ ok: false, reason: 'sameExercise' });
  });
});

describe('bests follow the exercise actually done', () => {
  it('an alternative has its own best; it never touches the default\'s best, and the reverse', () => {
    const state = run(empty(), swap('leg-press', 'leg-press', 'hack-squat'), ...logged('leg-press', 0, '300', '10'));
    expect(state.bests['hack-squat']).toEqual({ weight: '300', reps: '10', unit: 'kg' });
    expect(state.bests['leg-press']).toEqual({ weight: '200', reps: '8', unit: 'kg' }); // 300 x 10 did not raise it
    expect(previousBest(state, 'leg-press')).toEqual({ weight: '300', reps: '10', unit: 'kg' }); // the slot now shows Hack Squat's best
    const other = run(empty(), ...logged('leg-press', 0, '250', '8'));
    expect([other.bests['leg-press'].weight, other.bests['hack-squat']]).toEqual(['250', undefined]);
  });

  it('Hack Squat on Day 2 and Day 5 shares one best', () => {
    let state = run(empty(), swap('leg-press', 'leg-press', 'hack-squat'), swap('leg-press-lower-b', 'leg-press', 'hack-squat'));
    state = run(state, ...logged('leg-press', 0, '100', '8'), ...logged('leg-press-lower-b', 0, '120', '8'));
    expect(state.bests['hack-squat']).toEqual({ weight: '120', reps: '8', unit: 'kg' });
    expect([previousBest(state, 'leg-press'), previousBest(state, 'leg-press-lower-b')]).toEqual([state.bests['hack-squat'], state.bests['hack-squat']]);
  });
});

describe('weeks, resets, reports, backups', () => {
  const swappedWeek = () => run(empty(), swap('leg-press', 'leg-press', 'hack-squat'), ...logged('leg-press', 0, '150', '10'), ...logged('leg-press', 1, '150', '10'), ...logged('leg-press', 2, '150', '10'));

  it('a new week goes back to the defaults; the archived week keeps the swap', () => {
    const state = run(swappedWeek(), { type: 'startNewWeek', cycleId: 'w1', newId: 'w2' });
    expect([performedExerciseIdIn(state.currentCycle, 'leg-press'), performedExerciseIdIn(state.archivedCycles[0], 'leg-press')]).toEqual(['leg-press', 'hack-squat']);
  });

  it('reset day and reset all put swaps back to the default', () => {
    const day2 = workoutProgram[1].exercises.map((e) => e.id);
    const withSwap = run(empty(), swap('leg-press', 'leg-press', 'hack-squat'), swap('flat-db-press', 'flat-db-press', 'machine-chest-press'));
    const afterDay = run(withSwap, { type: 'resetDay', slotIds: day2 });
    expect([performedExerciseIdIn(afterDay.currentCycle, 'leg-press'), performedExerciseIdIn(afterDay.currentCycle, 'flat-db-press')]).toEqual(['leg-press', 'machine-chest-press']);
    expect(run(withSwap, { type: 'resetAll' }).currentCycle.slots).toEqual({});
  });

  it('reports (also a past week from history) show the exercise done; numbers and done/30 work the same', () => {
    const state = run(swappedWeek(), { type: 'startNewWeek', cycleId: 'w1', newId: 'w2' });
    const report = buildWeeklyReport(state.archivedCycles[0], workoutProgram, 'kg');
    const row = report.days[1].exercises.find((e) => e.id === 'leg-press')!;
    expect([row.performedExerciseId, row.volume, row.complete, report.doneExercises, report.completedSets]).toEqual(['hack-squat', 4500, true, 1, 3]);
    const slot = workoutProgram[1].exercises.find((e) => e.id === 'leg-press')!;
    expect([performedExerciseName(slot, row.performedExerciseId, 'en'), performedExerciseName(slot, row.performedExerciseId, 'zh')]).toEqual(['Hack Squat', '哈克深蹲']);
  });

  it('backup and restore keep swapped slots exactly', () => {
    const data = run(swappedWeek(), { type: 'startNewWeek', cycleId: 'w1', newId: 'w2' }, swap('cable-facepull', 'cable-facepull', 'reverse-pec-deck', 'w2'));
    const parsed = parseBackupFile(createBackupFile(data, ctx.now).text);
    if (!parsed.ok) throw new Error('expected ok');
    expect([parsed.data.currentCycle, parsed.data.archivedCycles, parsed.droppedAny]).toEqual([data.currentCycle, data.archivedCycles, false]);
  });
});

describe('loading saved data with a swap', () => {
  const withSlot = (performedExerciseId: unknown) => ({
    ...empty(),
    currentCycle: { id: 'w1', startedAt: 't', slots: { 'leg-press': { slotId: 'leg-press', exerciseId: 'leg-press', performedExerciseId, sets: { 0: { weight: '150', reps: '10', unit: 'kg', done: true } } } } },
  });

  it('an allowed swap loads as it is', () => {
    expect(validateV3(withSlot('hack-squat'))).toMatchObject({ droppedAny: false, data: { currentCycle: { slots: { 'leg-press': { performedExerciseId: 'hack-squat' } } } } });
  });

  it('unknown, not allowed or broken ids fall back to the default; the sets are kept; nothing throws', () => {
    for (const bad of ['made-up', 'pec-deck', 'leg-press-lower-b', '', 42, null, { id: 'hack-squat' }, '__proto__', 'constructor']) {
      const { data, droppedAny } = validateV3(withSlot(bad));
      expect([data?.currentCycle.slots['leg-press'].performedExerciseId, droppedAny, data?.currentCycle.slots['leg-press'].sets[0].weight]).toEqual(['leg-press', true, '150']);
    }
    const archived = validateV3({ ...empty(), archivedCycles: [withSlot('pec-deck').currentCycle] });
    expect(archived.data?.archivedCycles[0].slots['leg-press'].performedExerciseId).toBe('leg-press');
  });

  it('data saved before this step loads exactly as it is (no field changes, nothing dropped)', () => {
    const saved = run(empty(), ...logged('leg-press-lower-b', 0, '180', '8'), tick('incline-db-press', 0), { type: 'startNewWeek', cycleId: 'w1', newId: 'w2' }, tick('rdl', 0));
    const text = JSON.stringify(saved);
    const { data, droppedAny } = validateV3(JSON.parse(text));
    expect([JSON.stringify(data) === text, droppedAny]).toEqual([true, false]);
  });
});
