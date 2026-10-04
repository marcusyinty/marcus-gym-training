// Holds the app's single AppDataV3 object: loads it once, applies every change through the reducer and
// saves it to the v3 key with the existing debounced writer. Framework-free so it can be tested without a
// browser; the React hook useAppData connects it to the page (page hide, other tabs).
// The old v2 keys are never written here: they are only read once, by loadAppData, to migrate.
import { AppDataV3 } from '../model';
import { createDebouncedWriter, StoredItem } from '../storage';
import { KeyedStorage, pruneSafetyCopies, saveSafetyCopy } from './backup';
import { loadAppData, LoadSource, STORAGE_KEY_V3, validateV3 } from './dataV3';
import { reduce, StoreAction } from './reducer';

const EMPTY_DATA: AppDataV3 = {
  schemaVersion: 3,
  currentCycle: { id: 'empty', startedAt: new Date(0).toISOString(), slots: {} },
  archivedCycles: [],
  bests: {},
  reportShownCycleIds: [],
};

// The v3 key in the shape the debounced writer expects (it only uses key + serialize)
const appDataItem: StoredItem<AppDataV3> = {
  key: STORAGE_KEY_V3,
  fallback: EMPTY_DATA,
  parse: (raw) => {
    const { data, droppedAny } = validateV3(JSON.parse(raw));
    return { value: data ?? EMPTY_DATA, dropped: droppedAny };
  },
  serialize: (data) => JSON.stringify(data),
};

export interface AppDataStoreOptions {
  storage: KeyedStorage | null;
  now: () => Date;
  makeId: () => string;
  delay?: number;
}

export type RestoreError = 'noStorage' | 'safetyCopyFailed' | 'saveFailed';
export type RestoreResult = { ok: true } | { ok: false; error: RestoreError };

export interface AppDataStore {
  readonly source: LoadSource;
  getState: () => AppDataV3;
  // True after an 'error' load until a restore saves successfully
  isSavingDisabled: () => boolean;
  // Goes up each time the data is replaced as a whole (restore, or another tab's save)
  getReplacedCount: () => number;
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: StoreAction) => void;
  // The one save on load: only for freshly migrated data, only once
  saveMigrated: () => void;
  // v3 text that another tab just saved (the "storage" event's newValue)
  receiveExternal: (raw: string | null) => void;
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
  const writer = createDebouncedWriter(appDataItem, { delay, storage });
  const listeners = new Set<() => void>();
  let migratedSaved = false;
  let replacedCount = 0;

  const emit = () => listeners.forEach((listener) => listener());

  return {
    source: loaded.source,
    getState: () => state,
    isSavingDisabled: () => !canSave,
    getReplacedCount: () => replacedCount,
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
      if (canSave) writer.schedule(state);
      emit();
    },
    saveMigrated() {
      if (loaded.source !== 'migrated' || migratedSaved) return;
      migratedSaved = true;
      writer.schedule(state);
      writer.flush();
    },
    receiveExternal(raw) {
      // Removed key, unreadable text or an error session: keep what we have and write nothing
      if (!canSave || raw === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return;
      }
      const { data } = validateV3(parsed);
      if (!data) return;
      // The other tab's save is newer than anything still waiting here. Adopting it writes nothing back,
      // so two tabs never keep re-saving each other's data.
      writer.cancel();
      state = data;
      replacedCount++;
      emit();
    },
    restore(data) {
      if (!storage) return { ok: false, error: 'noStorage' };
      // Save any change still waiting, so the safety copy holds the very latest data (never in an error session)
      if (canSave) writer.flush();
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
      try {
        storage.setItem(STORAGE_KEY_V3, JSON.stringify(next));
      } catch (e) {
        return { ok: false, error: 'saveFailed' }; // the v3 key still holds the old data
      }
      // Only now that the restore is saved: keep the newest 3 safety copies
      pruneSafetyCopies(storage);
      writer.cancel();
      state = next;
      canSave = true;
      replacedCount++;
      emit();
      return { ok: true };
    },
    flush: () => writer.flush(),
  };
};
