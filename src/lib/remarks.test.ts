import { describe, expect, it } from 'vitest';
import { workoutProgram } from '../data/workoutProgram';
import { AppDataV3 } from './model';
import { cleanRemarks, limitRemarkInput, MAX_REMARKS, normalizeRemark, remarkLength } from './remarks';
import { createBackupFile, parseBackupFile } from './store/backup';
import { validateV3 } from './store/dataV3';
import { reduce, StoreAction } from './store/reducer';
import { remarkFor, remarkForSlot } from './store/selectors';

const ctx = { now: new Date('2026-10-05T08:00:00.000Z') };
const run = (state: AppDataV3, ...actions: StoreAction[]) => actions.reduce((s, a) => reduce(s, a, ctx), state);
const remark = (exerciseId: string, text: string): StoreAction => ({ type: 'setRemark', exerciseId, text });
const empty = (): AppDataV3 => ({
  schemaVersion: 3,
  currentCycle: { id: 'w1', startedAt: '2026-10-05T06:00:00.000Z', slots: {} },
  archivedCycles: [],
  bests: {},
  reportShownCycleIds: [],
});

describe('remark text', () => {
  it('trimmed; empty or only spaces means no remark', () => {
    expect([normalizeRemark('  incline bench: 3 holes up  '), normalizeRemark('   \n  '), normalizeRemark('')]).toEqual(['incline bench: 3 holes up', '', '']);
  });

  it('at most 200 characters; Chinese and emoji count as one and are never cut in half', () => {
    expect(normalizeRemark('a'.repeat(250))).toHaveLength(200);
    expect(normalizeRemark('座椅'.repeat(150))).toBe('座椅'.repeat(100));
    const emoji = normalizeRemark('💪🏽'.repeat(250)); // each one is 4 code units
    expect([emoji, emoji.length]).toEqual(['💪🏽'.repeat(200), 800]);
  });

  it('at most 3 lines: extra line breaks become spaces (no words lost); Windows line breaks too', () => {
    expect(normalizeRemark('seat 4\npulley 5\nbench 30°\nhandle\nrope')).toBe('seat 4\npulley 5\nbench 30° handle rope');
    expect(normalizeRemark('a\r\nb\r\nc\r\nd')).toBe('a\nb\nc d');
  });
});

describe('typing in the note editor', () => {
  it('limits lines and length while typing, but keeps spaces (nothing is trimmed until saved)', () => {
    expect(limitRemarkInput('seat 4 ')).toBe('seat 4 ');
    expect(limitRemarkInput('a\nb\nc\nd')).toBe('a\nb\nc d');
    expect(limitRemarkInput('x'.repeat(250))).toHaveLength(200);
    expect(limitRemarkInput('💪🏽'.repeat(210))).toBe('💪🏽'.repeat(200));
  });

  it('counts characters as people do (an emoji or a Chinese character is one)', () => {
    expect([remarkLength('座椅 4'), remarkLength('💪🏽💪🏽'), remarkLength('')]).toEqual([4, 2, 0]);
  });
});

describe('setting remarks', () => {
  it('set, edit, delete (empty text); deleting the last one removes the field again', () => {
    let state = run(empty(), remark('incline-db-press', 'bench 3 holes up'));
    expect(remarkFor(state, 'incline-db-press')).toBe('bench 3 holes up');
    state = run(state, remark('incline-db-press', 'bench 4 holes up'));
    expect(state.remarks).toEqual({ 'incline-db-press': 'bench 4 holes up' });
    const same = run(state, remark('incline-db-press', '  bench 4 holes up '));
    expect(same).toBe(state); // nothing changed, nothing to save
    state = run(state, remark('incline-db-press', '   '));
    expect(['remarks' in state, remarkFor(state, 'incline-db-press')]).toEqual([false, '']);
  });

  it('only for exercise ids the app knows (slot-only ids and made-up ids are refused)', () => {
    const state = empty();
    for (const id of ['made-up', 'leg-press-lower-b', '__proto__', 'constructor']) expect(run(state, remark(id, 'x'))).toBe(state);
  });

  it('Day 2 and Day 5 Leg Press share one remark; a swapped-in Hack Squat has its own (nothing copied or lost)', () => {
    let state = run(empty(), remark('leg-press', 'seat 4'), remark('hack-squat', 'shoulder pads 2'));
    expect([remarkForSlot(state, 'leg-press'), remarkForSlot(state, 'leg-press-lower-b')]).toEqual(['seat 4', 'seat 4']);
    state = run(state, { type: 'swapExercise', cycleId: 'w1', slotId: 'leg-press', from: 'leg-press', to: 'hack-squat' });
    expect([remarkForSlot(state, 'leg-press'), remarkForSlot(state, 'leg-press-lower-b')]).toEqual(['shoulder pads 2', 'seat 4']);
    state = run(state, { type: 'swapExercise', cycleId: 'w1', slotId: 'leg-press', from: 'hack-squat', to: 'leg-press' });
    expect(state.remarks).toEqual({ 'leg-press': 'seat 4', 'hack-squat': 'shoulder pads 2' });
  });

  it('never touched by Start new week, Reset day or Reset all', () => {
    const start = run(empty(), remark('leg-press', 'seat 4'), { type: 'toggleSet', slotId: 'leg-press', setIndex: 0, unit: 'kg' });
    const after = run(start, { type: 'resetDay', slotIds: workoutProgram[1].exercises.map((e) => e.id) }, { type: 'toggleSet', slotId: 'rdl', setIndex: 0, unit: 'kg' },
      { type: 'startNewWeek', cycleId: 'w1', newId: 'w2' }, { type: 'resetAll' });
    expect(after.remarks).toEqual({ 'leg-press': 'seat 4' });
  });
});

describe('loading saved remarks', () => {
  it('unknown ids and non-text values are dropped, long text is cut, the rest kept (original backed up)', () => {
    const raw = { ...empty(), remarks: { 'leg-press': 'seat 4', 'made-up': 'x', rdl: 42, 'hack-squat': { text: 'x' }, 'pec-deck': 'p'.repeat(300), __proto__: 'x' } };
    const { data, droppedAny } = validateV3(JSON.parse(JSON.stringify(raw)));
    expect([data?.remarks, droppedAny]).toEqual([{ 'leg-press': 'seat 4', 'pec-deck': 'p'.repeat(200) }, true]);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('a remarks field that is not an object is dropped as if never there; no field stays no field', () => {
    expect(validateV3({ ...empty(), remarks: 'seat 4' })).toMatchObject({ droppedAny: true });
    expect('remarks' in validateV3({ ...empty(), remarks: 'seat 4' }).data!).toBe(false);
    const old = validateV3(JSON.parse(JSON.stringify(empty())));
    expect(['remarks' in old.data!, old.droppedAny, JSON.stringify(old.data) === JSON.stringify(empty())]).toEqual([false, false, true]);
  });

  it('at most 100 remarks', () => {
    const many = Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`exercise-${i}`, `note ${i}`]));
    const { remarks, dropped } = cleanRemarks(many, () => true);
    expect([Object.keys(remarks).length, dropped, MAX_REMARKS]).toEqual([100, true, 100]);
  });
});

describe('backups and restores', () => {
  const restore = (state: AppDataV3, file: string) => {
    const parsed = parseBackupFile(file);
    if (!parsed.ok) throw new Error('expected ok');
    return { parsed, after: reduce(state, { type: 'replaceAll', data: parsed.data }, ctx) };
  };
  const phone = () => run(empty(), remark('leg-press', 'seat 4'), remark('btb-lateral-raise', 'pulley at hole 5'));

  it('a backup carries the remarks; restoring it replaces the phone\'s remarks', () => {
    const backup = run(empty(), remark('hack-squat', 'pads 2'));
    const { parsed, after } = restore(phone(), createBackupFile(backup, ctx.now).text);
    expect([parsed.keepsCurrentRemarks, after.remarks]).toEqual([false, { 'hack-squat': 'pads 2' }]);
  });

  it('a backup with an empty remarks field (made after this step, no remarks) also replaces: none afterwards', () => {
    const { parsed, after } = restore(phone(), createBackupFile(empty(), ctx.now).text);
    expect([parsed.keepsCurrentRemarks, 'remarks' in after]).toEqual([false, false]);
  });

  it('a backup made before remarks existed (no field at all) keeps the phone\'s remarks', () => {
    const oldFile = JSON.stringify({ app: 'aesthetic-recomp-backup', version: 1, exportedAt: ctx.now.toISOString(), schemaVersion: 3, data: empty() });
    const { parsed, after } = restore(phone(), oldFile);
    expect([parsed.keepsCurrentRemarks, after.remarks]).toEqual([true, phone().remarks]);
  });
});
