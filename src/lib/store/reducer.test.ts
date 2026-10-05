import { describe, expect, it } from 'vitest';
import { workoutProgram } from '../../data/workoutProgram';
import { AppDataV3, Cycle } from '../model';
import { WeightUnit } from '../units';
import { reduce, StoreAction } from './reducer';
import { completedIndexes, cycleProgress, previousBest, setDetails } from './selectors';
import { buildWeeklyReport } from '../weeklyReport';

const ctx = { now: new Date('2026-10-03T10:00:00.000Z') };
const empty = (): AppDataV3 => ({
  schemaVersion: 3,
  currentCycle: { id: 'current', startedAt: '2026-10-01T00:00:00.000Z', slots: {} },
  archivedCycles: [],
  bests: {},
  reportShownCycleIds: [],
});
const run = (state: AppDataV3, ...actions: StoreAction[]) => actions.reduce((s, a) => reduce(s, a, ctx), state);
// Small action helpers, like the app's handlers
const tick = (slotId: string, setIndex: number, unit: WeightUnit = 'kg'): StoreAction => ({ type: 'toggleSet', slotId, setIndex, unit });
const weight = (slotId: string, setIndex: number, value: string, unit: WeightUnit = 'kg'): StoreAction => ({ type: 'editWeight', slotId, setIndex, weight: value, unit });
const reps = (slotId: string, setIndex: number, value: string, unit: WeightUnit = 'kg'): StoreAction => ({ type: 'editReps', slotId, setIndex, reps: value, unit });
const best = (s: AppDataV3, slotId: string) => previousBest(s, slotId);

const deepFreeze = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

describe('best sequence from step 1C, replayed through the reducer', () => {
  it('only done sets count, ranked by estimated 1RM, never lowered', () => {
    const B = 'incline-db-press';
    let s = run(empty(), weight(B, 0, '60'), reps(B, 0, '8'));
    expect(best(s, B)).toBeUndefined(); // 60 x 8 typed, not ticked

    s = run(s, tick(B, 0));
    expect(best(s, B)).toEqual({ weight: '60', reps: '8', unit: 'kg' }); // ticked -> 60 x 8 (76.0)

    s = run(s, weight(B, 1, '62.5'), reps(B, 1, '6'), tick(B, 1));
    expect(best(s, B)).toEqual({ weight: '60', reps: '8', unit: 'kg' }); // 62.5 x 6 (75.0) ticked -> stays

    s = run(s, weight(B, 2, '65'), reps(B, 2, '6'));
    expect(best(s, B)).toEqual({ weight: '60', reps: '8', unit: 'kg' }); // 65 x 6 typed, not ticked -> stays

    s = run(s, tick(B, 2));
    expect(best(s, B)).toEqual({ weight: '65', reps: '6', unit: 'kg' }); // ticked (78.0) -> 65 x 6

    s = run(s, tick(B, 2));
    expect(best(s, B)).toEqual({ weight: '65', reps: '6', unit: 'kg' }); // untick -> stays

    s = run(s, tick(B, 2), weight(B, 2, '50'));
    expect(best(s, B)).toEqual({ weight: '65', reps: '6', unit: 'kg' }); // edit a done set lower -> stays

    s = run(s, reps(B, 1, '12'));
    expect(best(s, B)).toEqual({ weight: '62.5', reps: '12', unit: 'kg' }); // edit a done set higher (87.5) -> updates
    expect(completedIndexes(s, B)).toEqual([0, 1, 2]);
  });

  it('an unchanged edit does not re-check a done set (old bests stay, as today)', () => {
    // migrated week: 60 x 8 done, stored best 62.5 x 6 (old weight-only rule)
    const s0: AppDataV3 = {
      ...empty(),
      currentCycle: { id: 'c', startedAt: 't', slots: { bench: { slotId: 'bench', exerciseId: 'bench', performedExerciseId: 'bench', sets: { 0: { weight: '60', reps: '8', unit: 'kg', done: true } } } } },
      bests: { bench: { weight: '62.5', reps: '6', unit: 'kg' } },
    };
    expect(best(run(s0, weight('bench', 0, '60')), 'bench')).toEqual({ weight: '62.5', reps: '6', unit: 'kg' });
  });
});

describe('unit rules from step 1C-2', () => {
  it('editing only reps while the app shows lbs keeps a 60 kg set as 60 kg', () => {
    const s = run(empty(), weight('bench', 0, '60', 'kg'), reps('bench', 0, '8', 'kg'), reps('bench', 0, '10', 'lbs'));
    expect(setDetails(s, 'bench')[0]).toMatchObject({ weight: '60', reps: '10', unit: 'kg' });
  });

  it('a new weight is saved in the current unit', () => {
    const s = run(empty(), weight('bench', 0, '60', 'kg'), weight('bench', 0, '135', 'lbs'));
    expect(setDetails(s, 'bench')[0]).toMatchObject({ weight: '135', unit: 'lbs' });
  });

  it('reps on a set that was only ticked use the current unit (nothing stored yet, as in v2)', () => {
    const s = run(empty(), tick('bench', 0, 'kg'), reps('bench', 0, '8', 'lbs'));
    expect(setDetails(s, 'bench')[0]).toMatchObject({ weight: '', reps: '8', unit: 'lbs' });
  });

  it('bests compare kg and lbs in kg and keep their own unit', () => {
    const s = run(empty(), weight('bench', 0, '100', 'kg'), reps('bench', 0, '5'), tick('bench', 0),
      weight('bench', 1, '225', 'lbs'), reps('bench', 1, '5', 'lbs'), tick('bench', 1, 'lbs'));
    expect(best(s, 'bench')).toEqual({ weight: '225', reps: '5', unit: 'lbs' }); // 102.1 kg beats 100 kg
  });
});

describe('shared best across rdl and rdl-lower-b', () => {
  it('both slots update and read one best', () => {
    let s = run(empty(), weight('rdl', 0, '100'), reps('rdl', 0, '5'), tick('rdl', 0));
    s = run(s, weight('rdl-lower-b', 0, '90'), reps('rdl-lower-b', 0, '5'), tick('rdl-lower-b', 0));
    expect([best(s, 'rdl'), best(s, 'rdl-lower-b')]).toEqual([{ weight: '100', reps: '5', unit: 'kg' }, { weight: '100', reps: '5', unit: 'kg' }]);
    s = run(s, weight('rdl-lower-b', 0, '110'));
    expect(s.bests).toEqual({ rdl: { weight: '110', reps: '5', unit: 'kg' } });
    expect(best(s, 'rdl')).toEqual({ weight: '110', reps: '5', unit: 'kg' });
    // the slots themselves stay separate
    expect([completedIndexes(s, 'rdl'), completedIndexes(s, 'rdl-lower-b')]).toEqual([[0], [0]]);
  });
});

describe('ticks', () => {
  it('a tick creates the set; untick of a tick-only set removes it again (like v2)', () => {
    const s1 = run(empty(), tick('bench', 1));
    expect([completedIndexes(s1, 'bench'), setDetails(s1, 'bench')]).toEqual([[1], {}]);
    const s2 = run(s1, tick('bench', 1));
    expect(s2.currentCycle.slots.bench.sets).toEqual({});
  });

  it('untick keeps typed values', () => {
    const s = run(empty(), weight('bench', 0, '60'), tick('bench', 0), tick('bench', 0));
    expect(completedIndexes(s, 'bench')).toEqual([]);
    expect(setDetails(s, 'bench')[0]).toMatchObject({ weight: '60' });
  });

  it('ticks beyond the set count are stored, and count exactly like today (capped)', () => {
    const s = run(empty(), tick('incline-db-press', 0), tick('incline-db-press', 1), tick('incline-db-press', 5));
    expect(completedIndexes(s, 'incline-db-press')).toEqual([0, 1, 5]);
    expect(cycleProgress(s, workoutProgram).perDay['day-1'].completed).toBe(3);
  });
});

describe('resets and other actions', () => {
  const archived: Cycle = {
    id: 'old',
    startedAt: '2026-09-20T00:00:00.000Z',
    endedAt: '2026-09-27T00:00:00.000Z',
    slots: { bench: { slotId: 'bench', exerciseId: 'bench', performedExerciseId: 'bench', sets: { 0: { weight: '50', reps: '5', unit: 'kg', done: true } } } },
  };
  const filled = () =>
    run({ ...empty(), archivedCycles: [archived] }, weight('bench', 0, '60'), reps('bench', 0, '8'), tick('bench', 0), tick('rdl', 0), tick('squat', 0));

  it('resetDay removes only those slots from the current cycle', () => {
    const before = filled();
    const s = run(before, { type: 'resetDay', slotIds: ['bench', 'rdl'] });
    expect(Object.keys(s.currentCycle.slots)).toEqual(['squat']);
    expect(s.archivedCycles).toEqual([archived]);
    expect(s.bests).toEqual(before.bests);
    expect(s.bests.bench).toEqual({ weight: '60', reps: '8', unit: 'kg' });
  });

  it('resetAll clears the current cycle only; archived cycles and bests stay', () => {
    const before = filled();
    const s = run(before, { type: 'resetAll' });
    expect(s.currentCycle).toEqual({ ...before.currentCycle, slots: {} });
    expect(s.archivedCycles).toEqual([archived]);
    expect(s.bests).toEqual(before.bests);
  });

  it('setTag stores and removes a tag; a missing set is left alone', () => {
    const s1 = run(filled(), { type: 'setTag', slotId: 'bench', setIndex: 0, tag: 'max' });
    expect(s1.currentCycle.slots.bench.sets[0].tag).toBe('max');
    const s2 = run(s1, { type: 'setTag', slotId: 'bench', setIndex: 0, tag: null });
    expect('tag' in s2.currentCycle.slots.bench.sets[0]).toBe(false);
    const same = filled();
    expect(reduce(same, { type: 'setTag', slotId: 'bench', setIndex: 9, tag: 'easy' }, ctx)).toBe(same);
  });

  it('resets remove tags with the rest of the set data; a new week archives them', () => {
    const tagged = run(filled(), { type: 'setTag', slotId: 'bench', setIndex: 0, tag: 'max' }, { type: 'setTag', slotId: 'rdl', setIndex: 0, tag: 'easy' });
    expect(run(tagged, { type: 'resetDay', slotIds: ['bench'] }).currentCycle.slots.bench).toBeUndefined();
    expect(run(tagged, { type: 'resetAll' }).currentCycle.slots).toEqual({});
    const next = run(tagged, { type: 'startNewWeek', cycleId: 'current', newId: 'week-2' });
    expect(next.archivedCycles[1].slots.bench.sets[0].tag).toBe('max');
    expect(next.archivedCycles[1].slots.rdl.sets[0].tag).toBe('easy');
    expect(next.currentCycle.slots).toEqual({});
  });
});

describe('tags (how a ticked set felt)', () => {
  const setTag = (slotId: string, setIndex: number, tag: 'easy' | 'good' | 'max' | null): StoreAction => ({ type: 'setTag', slotId, setIndex, tag });
  const setOf = (s: AppDataV3, slotId: string, setIndex: number) => s.currentCycle.slots[slotId]?.sets[setIndex];

  it('set, change and clear a tag on a ticked set', () => {
    const s = run(empty(), weight('bench', 0, '60'), reps('bench', 0, '8'), tick('bench', 0));
    expect(setOf(run(s, setTag('bench', 0, 'easy')), 'bench', 0)?.tag).toBe('easy');
    expect(setOf(run(s, setTag('bench', 0, 'easy'), setTag('bench', 0, 'max')), 'bench', 0)?.tag).toBe('max');
    const cleared = run(s, setTag('bench', 0, 'good'), setTag('bench', 0, null));
    expect(setOf(cleared, 'bench', 0)).toEqual(setOf(s, 'bench', 0)); // exactly as before the tag
  });

  it('no tag on a set that is not ticked (typed only, or missing): nothing changes', () => {
    const typed = run(empty(), weight('bench', 0, '60'));
    expect(reduce(typed, setTag('bench', 0, 'max'), ctx)).toBe(typed);
    expect(reduce(typed, setTag('bench', 1, 'max'), ctx)).toBe(typed);
    expect(reduce(typed, setTag('squat', 0, 'max'), ctx)).toBe(typed);
  });

  it('the same tag again, or clearing no tag, changes nothing (no save)', () => {
    const s = run(empty(), tick('bench', 0), setTag('bench', 0, 'good'));
    expect(reduce(s, setTag('bench', 0, 'good'), ctx)).toBe(s);
    const untagged = run(empty(), tick('bench', 0));
    expect(reduce(untagged, setTag('bench', 0, null), ctx)).toBe(untagged);
  });

  it('untick clears the tag: typed values stay, a tick-only set disappears', () => {
    const typed = run(empty(), weight('bench', 0, '60'), reps('bench', 0, '8'), tick('bench', 0), setTag('bench', 0, 'max'), tick('bench', 0));
    expect(setOf(typed, 'bench', 0)).toEqual({ weight: '60', reps: '8', unit: 'kg', done: false, updatedAt: ctx.now.toISOString() });
    const tickOnly = run(empty(), tick('bench', 0), setTag('bench', 0, 'max'), tick('bench', 0));
    expect(tickOnly.currentCycle.slots.bench.sets).toEqual({});
  });

  it('ticking again starts with no tag, also when an older version left one on the unticked set', () => {
    const s = run(empty(), weight('bench', 0, '60'), tick('bench', 0), setTag('bench', 0, 'max'), tick('bench', 0), tick('bench', 0));
    expect(setOf(s, 'bench', 0)?.tag).toBeUndefined();
    // v1.2.0 kept the tag when unticking: { done: false, tag: 'max' }
    const old: AppDataV3 = {
      ...empty(),
      currentCycle: { id: 'c', startedAt: 't', slots: { bench: { slotId: 'bench', exerciseId: 'bench', performedExerciseId: 'bench', sets: { 0: { weight: '', reps: '', unit: 'kg', done: false, tag: 'max' } } } } },
    };
    expect(setOf(run(old, tick('bench', 0)), 'bench', 0)).toEqual({ weight: '', reps: '', unit: 'kg', done: true });
    // and an edit of that unticked set drops it too
    expect(setOf(run(old, reps('bench', 0, '8')), 'bench', 0)?.tag).toBeUndefined();
  });

  it('editing weight or reps of a ticked set keeps its tag', () => {
    const s = run(empty(), weight('bench', 0, '60'), reps('bench', 0, '8'), tick('bench', 0), setTag('bench', 0, 'max'), weight('bench', 0, '62.5'), reps('bench', 0, '6', 'lbs'));
    expect(setOf(s, 'bench', 0)).toMatchObject({ weight: '62.5', reps: '6', unit: 'kg', done: true, tag: 'max' });
  });

  it('tags never change bests, progress or the report numbers', () => {
    const base = run(empty(), weight('incline-db-press', 0, '60'), reps('incline-db-press', 0, '8'), tick('incline-db-press', 0), tick('incline-db-press', 1));
    const tagged = run(base, setTag('incline-db-press', 0, 'max'), setTag('incline-db-press', 1, 'easy'));
    expect(tagged.bests).toBe(base.bests);
    expect(cycleProgress(tagged, workoutProgram)).toEqual(cycleProgress(base, workoutProgram));
    const strip = (r: ReturnType<typeof buildWeeklyReport>) => ({ ...r, days: r.days.map((d) => ({ ...d, exercises: d.exercises.map(({ maxSets: _m, ...e }) => e) })) });
    for (const unit of ['kg', 'lbs'] as const) {
      expect(strip(buildWeeklyReport(tagged.currentCycle, workoutProgram, unit))).toEqual(strip(buildWeeklyReport(base.currentCycle, workoutProgram, unit)));
    }
    expect(buildWeeklyReport(tagged.currentCycle, workoutProgram, 'kg').days[0].exercises[0].maxSets).toEqual([1]);
  });

  it('markReportShown adds the cycle id once', () => {
    const s = run(empty(), { type: 'markReportShown', cycleId: 'current' }, { type: 'markReportShown', cycleId: 'current' });
    expect(s.reportShownCycleIds).toEqual(['current']);
  });

  it('edits record the time', () => {
    const s = run(empty(), weight('bench', 0, '60'));
    expect(setDetails(s, 'bench')[0].timestamp).toBe('2026-10-03T10:00:00.000Z');
  });
});

describe('purity', () => {
  const allActions: StoreAction[] = [
    weight('bench', 0, '60'), reps('bench', 0, '8'), tick('bench', 0), tick('bench', 1), tick('bench', 1),
    reps('bench', 0, '10', 'lbs'), weight('rdl-lower-b', 0, '100'), tick('rdl-lower-b', 0),
    { type: 'setTag', slotId: 'bench', setIndex: 0, tag: 'good' }, { type: 'markReportShown', cycleId: 'x' },
    { type: 'resetDay', slotIds: ['bench'] }, { type: 'resetAll' },
  ];

  it('never mutates the input (frozen state passes through every action)', () => {
    let state = deepFreeze({ ...empty(), archivedCycles: [{ id: 'a', startedAt: 't', slots: {} }] });
    for (const action of allActions) {
      const before = JSON.stringify(state);
      const next = reduce(state, action, ctx);
      expect(JSON.stringify(state)).toBe(before);
      state = deepFreeze(next);
    }
  });

  it('every change returns a new object', () => {
    const s0 = empty();
    expect(reduce(s0, tick('bench', 0), ctx)).not.toBe(s0);
    expect(reduce(s0, weight('bench', 0, '1'), ctx)).not.toBe(s0);
    expect(reduce(s0, { type: 'resetAll' }, ctx)).not.toBe(s0);
  });

  it('same input + same ctx gives the same output', () => {
    const a = run(empty(), ...allActions.slice(0, 9));
    const b = run(empty(), ...allActions.slice(0, 9));
    expect(b).toStrictEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});
