// Holds the app's single AppDataV3 object: loads it once, applies every change through the reducer and
// saves it to the v3 key 300ms after the last change (right away for a new week, a restore, or when the page
// is hidden). Framework-free so it can be tested without a browser; the React hook useAppData connects it to
// the page (page hide/return, other tabs).
// Several tabs: before every save the store checks whether another tab saved since this page last looked
// (a page can miss that news, e.g. while the phone kept it asleep). If so, the other tab's newer data wins
// and is adopted instead of being written over; an unsaved change made here on the older data is dropped
// and counted, so the page can say so. That way a stale tab can never wipe out a week saved elsewhere.
// The old v2 keys are never written here: they are only read once, by loadAppData, to migrate.
import { AppDataV3 } from '../model';
import { KeyedStorage, pruneSafetyCopies, saveSafetyCopy } from './backup';
import { loadAppData, LoadSource, STORAGE_KEY_V3, validateV3 } from './dataV3';
import { reduce, StoreAction } from './reducer';
import { tickedSetCount } from './selectors';
import { checkSwap, SwapBlockReason, SwapRequest } from './swap';

export interface AppDataStoreOptions {
  storage: KeyedStorage | null;
  now: () => Date;
  makeId: () => string;
  delay?: number;
}

export type RestoreError = 'noStorage' | 'safetyCopyFailed' | 'saveFailed';
export type RestoreResult = { ok: true } | { ok: false; error: RestoreError };

// empty: no ticked set this week; alreadyStarted: another tab started a new week first (now shown here);
// savingOff: nothing can be saved this session; saveFailed: storage refused, nothing changed
export type StartWeekResult = { ok: true } | { ok: false; reason: 'empty' | 'alreadyStarted' | 'savingOff' | 'saveFailed' };

// updatedFromOtherTab: another tab had saved newer data, which is now shown (the page can say so)
export type SwapResult =
  | { ok: true; clearedTypedValues: boolean; updatedFromOtherTab: boolean }
  | { ok: false; reason: SwapBlockReason | 'savingOff' | 'saveFailed'; updatedFromOtherTab: boolean };

export interface AppDataStore {
  readonly source: LoadSource;
  getState: () => AppDataV3;
  // True after an 'error' load until a restore saves successfully
  isSavingDisabled: () => boolean;
  // Goes up each time the data is replaced as a whole (restore, or another tab's save)
  getReplacedCount: () => number;
  // Goes up each time an unsaved change here was dropped because another tab had saved newer data
  getDroppedChangeCount: () => number;
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: StoreAction) => void;
  // The one save on load: only for freshly migrated data, only once
  saveMigrated: () => void;
  // v3 text that another tab just saved (the "storage" event's newValue)
  receiveExternal: (raw: string | null) => void;
  // Adopts data another tab saved while this page wasn't told (call when the page is shown again)
  syncFromStorage: () => void;
  // Archives the week the user was looking at and starts an empty one, saved right away
  startNewWeek: (cycleId: string) => StartWeekResult;
  // Which exercise a slot does this week (see swap.ts), saved right away
  swapExercise: (request: SwapRequest) => SwapResult;
  // Replaces everything with a backup's data (already checked with validateV3) and saves it right away
  restore: (data: AppDataV3) => RestoreResult;
  flush: () => void;
}

export const createAppDataStore = ({ storage, now, makeId, delay = 300 }: AppDataStoreOptions): AppDataStore => {
  const loaded = loadAppData(storage, { now: now(), makeId });
  let state = loaded.data;
  // After an 'error' load nothing at all is saved this session, so whatever is stored stays untouched.
  // Only a successful restore turns saving back on.
  let canSave = loaded.source !== 'error';
  const listeners = new Set<() => void>();
  let migratedSaved = false;
  let replacedCount = 0;
  let droppedChangeCount = 0;
  let pending = false; // a change not saved yet
  let timer: ReturnType<typeof setTimeout> | null = null;
  let warned = false;

  // Reads the saved v3 text; ok: false when there is no storage or reading it fails
  const readStored = (): { ok: true; text: string | null } | { ok: false } => {
    if (!storage) return { ok: false };
    try {
      return { ok: true, text: storage.getItem(STORAGE_KEY_V3) };
    } catch (e) {
      return { ok: false };
    }
  };
  // The v3 text this page last loaded, saved or adopted. Different text in storage was saved by another tab.
  const initial = readStored();
  let lastSeenText: string | null = initial.ok ? initial.text : null;

  const emit = () => listeners.forEach((listener) => listener());
  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  // Takes over another tab's saved text if it is valid v3; otherwise changes nothing and returns false.
  // Writes nothing back, so two tabs never keep re-saving each other's data.
  const adopt = (raw: string | null): boolean => {
    if (raw === null) return false; // a removed key: keep what we have
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return false;
    }
    const { data } = validateV3(parsed);
    if (!data) return false;
    if (pending) droppedChangeCount++;
    pending = false;
    clearTimer();
    state = data;
    lastSeenText = raw;
    replacedCount++;
    emit();
    return true;
  };

  // True when another tab saved since this page last looked, and its data was adopted
  const adoptNewerFromStorage = (): boolean => {
    const stored = readStored();
    return stored.ok && stored.text !== lastSeenText && adopt(stored.text);
  };

  // Saves `state` now, unless another tab saved newer data meanwhile (then that data is adopted instead)
  const writeState = () => {
    clearTimer();
    if (!canSave || !storage) {
      pending = false;
      return;
    }
    if (adoptNewerFromStorage()) return;
    pending = false;
    const text = JSON.stringify(state);
    try {
      if (storage.getItem(STORAGE_KEY_V3) !== text) storage.setItem(STORAGE_KEY_V3, text);
      lastSeenText = text;
      warned = false;
    } catch (e) {
      // The app keeps working from memory; the next change tries again
      if (!warned) console.warn(`[storage] Could not save "${STORAGE_KEY_V3}". Changes are kept in memory only.`, e);
      warned = true;
    }
  };

  const flush = () => {
    if (pending) writeState();
  };

  // Before a deliberate action (new week, swap, remark): save the change still waiting, then continue from
  // the newest saved data. True when another tab's newer data was adopted (the page can say so).
  const catchUp = (): boolean => {
    const before = replacedCount;
    flush();
    adoptNewerFromStorage();
    return replacedCount !== before;
  };

  // Saves `next` right away (a phone may close the page straight after a deliberate tap). False when
  // storage refuses: then nothing changed, the v3 key still holds the old data.
  const writeNow = (next: AppDataV3): boolean => {
    if (!storage) return false;
    const text = JSON.stringify(next);
    try {
      storage.setItem(STORAGE_KEY_V3, text);
    } catch (e) {
      return false;
    }
    pending = false;
    clearTimer();
    state = next;
    lastSeenText = text;
    emit();
    return true;
  };

  // A new id that no week uses yet (makeId may fail, e.g. no crypto on an old phone)
  const newWeekId = (): string => {
    const taken = new Set([state.currentCycle.id, ...state.archivedCycles.map((cycle) => cycle.id)]);
    for (let attempt = 0; attempt < 5; attempt++) {
      let id: string;
      try {
        id = makeId();
      } catch (e) {
        id = `cycle-${now().getTime().toString(36)}-${attempt}`;
      }
      if (!taken.has(id)) return id;
    }
    return `cycle-${now().getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };

  return {
    source: loaded.source,
    getState: () => state,
    isSavingDisabled: () => !canSave,
    getReplacedCount: () => replacedCount,
    getDroppedChangeCount: () => droppedChangeCount,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action) {
      const next = reduce(state, action, { now: now() });
      if (next === state) return;
      state = next;
      if (canSave) {
        pending = true;
        clearTimer();
        timer = setTimeout(writeState, delay);
      }
      emit();
    },
    saveMigrated() {
      if (loaded.source !== 'migrated' || migratedSaved) return;
      migratedSaved = true;
      writeState();
    },
    receiveExternal(raw) {
      // An error session keeps what it has and writes nothing
      if (!canSave) return;
      adopt(raw);
    },
    syncFromStorage() {
      if (canSave) adoptNewerFromStorage();
    },
    startNewWeek(cycleId) {
      if (!canSave || !storage) return { ok: false, reason: 'savingOff' };
      // The change still waiting goes into the archived week; another tab may have started a week meanwhile
      catchUp();
      if (state.currentCycle.id !== cycleId) return { ok: false, reason: 'alreadyStarted' };
      if (tickedSetCount(state.currentCycle) === 0) return { ok: false, reason: 'empty' };
      const next = reduce(state, { type: 'startNewWeek', cycleId, newId: newWeekId() }, { now: now() });
      if (next === state || !writeNow(next)) return { ok: false, reason: 'saveFailed' }; // nothing changed
      return { ok: true };
    },
    swapExercise(request) {
      if (!canSave || !storage) return { ok: false, reason: 'savingOff', updatedFromOtherTab: false };
      const updatedFromOtherTab = catchUp();
      // The rule is checked again on the newest data: another tab may have ticked, swapped or started a week
      const check = checkSwap(state, request);
      if (!check.ok) return { ok: false, reason: check.reason, updatedFromOtherTab };
      const next = reduce(state, { type: 'swapExercise', ...request }, { now: now() });
      if (!writeNow(next)) return { ok: false, reason: 'saveFailed', updatedFromOtherTab };
      return { ok: true, clearedTypedValues: check.clearsTypedValues, updatedFromOtherTab };
    },
    restore(data) {
      if (!storage) return { ok: false, error: 'noStorage' };
      // Save any change still waiting, so the safety copy holds the very latest data (never in an error session)
      if (canSave) flush();
      const time = now();
      let currentText: string | null;
      try {
        currentText = storage.getItem(STORAGE_KEY_V3);
      } catch (e) {
        return { ok: false, error: 'safetyCopyFailed' };
      }
      // Keep what is saved now under aesthetic_recomp_backup_before_restore_<time>
      if (!saveSafetyCopy(storage, currentText, time)) return { ok: false, error: 'safetyCopyFailed' };
      const next = reduce(state, { type: 'replaceAll', data }, { now: time });
      const text = JSON.stringify(next);
      try {
        storage.setItem(STORAGE_KEY_V3, text);
      } catch (e) {
        return { ok: false, error: 'saveFailed' }; // the v3 key still holds the old data
      }
      // Only now that the restore is saved: keep the newest 3 safety copies
      pruneSafetyCopies(storage);
      pending = false;
      clearTimer();
      state = next;
      lastSeenText = text;
      canSave = true;
      replacedCount++;
      emit();
      return { ok: true };
    },
    flush,
  };
};
