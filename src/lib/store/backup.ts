// Backup files: the whole AppDataV3 object saved to, and read back from, a JSON file on the phone.
// No login, no server. The download and the file picker live in the UI; everything here is plain logic.
// Settings (language, unit, rest sound) are not part of a backup.
import { AppDataV3 } from '../model';
import { StorageLike } from '../storage';
import { validateV3 } from './dataV3';
import { tickedSetCount } from './selectors';

export const BACKUP_APP = 'aesthetic-recomp-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  schemaVersion: 3;
  data: AppDataV3;
}

export interface DataSummary {
  weeks: number;
  tickedSets: number;
}

export type BackupError = 'tooLarge' | 'notJson' | 'wrongApp' | 'wrongVersion' | 'missingData' | 'invalidData';

export type ParsedBackup =
  // keepsCurrentRemarks: the file has no remarks field (made before remarks existed), so restoring it keeps
  // the phone's remarks; otherwise its remarks (maybe none) replace them. keepsCurrentBody: the same for body
  // measurements (backups made before step 6 have no body field).
  | { ok: true; data: AppDataV3; exportedAt: string | null; droppedAny: boolean; summary: DataSummary; keepsCurrentRemarks: boolean; keepsCurrentBody: boolean }
  | { ok: false; error: BackupError };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pad = (n: number) => String(n).padStart(2, '0');

// Uses the phone's local calendar day, e.g. aesthetic-recomp-backup-2026-10-04.json
export const backupFileName = (now: Date): string =>
  `aesthetic-recomp-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;

// A backup always has a remarks field and a body field (empty when there is nothing), so a restore can tell it
// apart from a backup made before they existed
export const createBackupFile = (data: AppDataV3, now: Date): { fileName: string; text: string } => {
  const file: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    schemaVersion: 3,
    data: { ...data, remarks: data.remarks ?? {}, body: data.body ?? { entries: {} } },
  };
  return { fileName: backupFileName(now), text: JSON.stringify(file, null, 2) };
};

// Weeks = the current week plus archived ones; ticked sets counted across all of them
export const summarizeData = (data: AppDataV3): DataSummary => ({
  weeks: 1 + data.archivedCycles.length,
  tickedSets: [data.currentCycle, ...data.archivedCycles].reduce((count, cycle) => count + tickedSetCount(cycle), 0),
});

// Reads a backup file's text. Never throws: any problem comes back as an error code and nothing else happens.
export const parseBackupFile = (text: string): ParsedBackup => {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) return { ok: false, error: 'tooLarge' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'notJson' };
  }
  if (!isPlainObject(raw) || raw.app !== BACKUP_APP) return { ok: false, error: 'wrongApp' };
  if (raw.version !== BACKUP_VERSION || raw.schemaVersion !== 3) return { ok: false, error: 'wrongVersion' };
  if (raw.data === undefined || raw.data === null) return { ok: false, error: 'missingData' };
  // The same shape check as for saved data: odd keys (e.g. "__proto__") stay plain keys, bad pieces are dropped
  const { data, droppedAny } = validateV3(raw.data);
  if (!data) return { ok: false, error: 'invalidData' };
  const exportedAt = typeof raw.exportedAt === 'string' && !Number.isNaN(Date.parse(raw.exportedAt)) ? raw.exportedAt : null;
  return { ok: true, data, exportedAt, droppedAny, summary: summarizeData(data), keepsCurrentRemarks: data.remarks === undefined, keepsCurrentBody: data.body === undefined };
};

// ---------- safety copies before a restore ----------

export const PRE_RESTORE_PREFIX = 'aesthetic_recomp_backup_before_restore_';
export const PRE_RESTORE_KEEP = 3;

// Real localStorage has key/length/removeItem; tests may leave them out (then nothing is pruned)
export type KeyedStorage = StorageLike & Partial<Pick<Storage, 'key' | 'length' | 'removeItem'>>;

// Removes all but the newest PRE_RESTORE_KEEP safety copies. Only keys with exactly this prefix are touched.
// Called only after a restore has been saved, so a failed restore never removes an older copy.
export const pruneSafetyCopies = (storage: KeyedStorage) => {
  try {
    if (typeof storage.key !== 'function' || typeof storage.removeItem !== 'function' || typeof storage.length !== 'number') return;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null && key.startsWith(PRE_RESTORE_PREFIX)) keys.push(key);
    }
    keys.sort(); // the ISO time in the key sorts oldest first
    for (const key of keys.slice(0, Math.max(0, keys.length - PRE_RESTORE_KEEP))) storage.removeItem(key);
  } catch (e) {
    // keeping an extra copy is harmless
  }
};

// Saves the current v3 text under aesthetic_recomp_backup_before_restore_<ISO time>.
// Nothing saved yet (null) means there is nothing to copy. Returns false if the copy could not be saved.
export const saveSafetyCopy = (storage: StorageLike, currentText: string | null, now: Date): boolean => {
  if (currentText === null) return true;
  try {
    storage.setItem(PRE_RESTORE_PREFIX + now.toISOString(), currentText);
  } catch (e) {
    return false;
  }
  return true;
};
