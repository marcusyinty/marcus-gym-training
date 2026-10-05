// "Last time" on a card: how the exercise actually done in a slot this week (its performed id, so a swapped-in
// alternative only sees its own history) went the most recent past week it was done in. A week counts only if
// it has at least one ticked set of that exercise; weeks without one are skipped, so an older week is found.
// Within that week the same slot is preferred (Day 5 Leg Press shows Day 5's sets), otherwise another slot that
// did the same exercise (Day 2's). Only ticked sets are shown. Pure, so the cards and the tests agree.
import { workoutProgram } from '../data/workoutProgram';
import { performedExerciseIdIn } from './exerciseVariants';
import { AppDataV3, Cycle, LoggedSet, LoggedSlot } from './model';
import { displayWeight, WeightUnit } from './units';

export interface LastTimeSet {
  weight: string; // in the unit asked for (converted like the report); '' when none was typed
  reps: string; // as typed; '' when none
  tag?: LoggedSet['tag'];
}

export interface LastTime {
  cycleId: string;
  slotId: string; // where it was found: this slot, or another slot of the same exercise that week
  date: string; // ISO: when those sets were last saved, or the week's start when they were only ticked
  sets: Record<number, LastTimeSet>; // ticked sets only, by set index
}

const programOrder = new Map(workoutProgram.flatMap((day) => day.exercises.map((slot) => slot.id)).map((id, index) => [id, index]));

const tickedEntries = (slot: LoggedSlot): [number, LoggedSet][] =>
  Object.entries(slot.sets)
    .filter(([, set]) => set.done)
    .map(([index, set]) => [Number(index), set]);

// The slot of `cycle` that did `exerciseId` with at least one ticked set: `slotId` itself first, then program order
const slotThatDid = (cycle: Cycle, slotId: string, exerciseId: string): LoggedSlot | undefined => {
  const candidates = Object.values(cycle.slots).filter((slot) => slot.performedExerciseId === exerciseId && tickedEntries(slot).length > 0);
  const rank = (slot: LoggedSlot) => (slot.slotId === slotId ? -1 : programOrder.get(slot.slotId) ?? Number.MAX_SAFE_INTEGER);
  return candidates.sort((a, b) => rank(a) - rank(b))[0];
};

const latestSaveTime = (sets: LoggedSet[]): string | undefined => {
  let latest: { time: number; text: string } | undefined;
  for (const set of sets) {
    const time = typeof set.updatedAt === 'string' ? Date.parse(set.updatedAt) : NaN;
    if (!Number.isNaN(time) && (!latest || time > latest.time)) latest = { time, text: set.updatedAt as string };
  }
  return latest?.text;
};

export const lastTimeFor = (data: AppDataV3, slotId: string, unit: WeightUnit): LastTime | null => {
  const exerciseId = performedExerciseIdIn(data.currentCycle, slotId);
  for (let i = data.archivedCycles.length - 1; i >= 0; i--) {
    const cycle = data.archivedCycles[i];
    const slot = slotThatDid(cycle, slotId, exerciseId);
    if (!slot) continue;
    const ticked = tickedEntries(slot);
    const sets: Record<number, LastTimeSet> = {};
    for (const [index, set] of ticked) {
      const entry: LastTimeSet = { weight: displayWeight(set.weight.trim(), set.unit, unit), reps: set.reps.trim() };
      if (set.tag) entry.tag = set.tag;
      sets[index] = entry;
    }
    const date = latestSaveTime(ticked.map(([, set]) => set)) ?? cycle.startedAt;
    return { cycleId: cycle.id, slotId: slot.slotId, date, sets };
  }
  return null;
};
