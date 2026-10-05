// Body measurements: weight (plus optional waist and hips) per calendar day, and a height. A private record:
// it lives only in the saved data on this phone and in backup files. Not weekly data: new weeks and resets
// never touch it. Values are stored as typed (with "." as the decimal mark) together with their unit, and
// converted only for display, so switching kg/lbs back and forth never changes them.
import { convertWeight, formatWeight, WeightUnit } from './units';

export type LengthUnit = 'cm' | 'in';

export interface WeightValue {
  value: string; // e.g. "72.4"
  unit: WeightUnit;
}

export interface LengthValue {
  value: string;
  unit: LengthUnit;
}

export interface BodyEntry {
  weight: WeightValue;
  waist?: LengthValue;
  hips?: LengthValue;
  updatedAt?: string;
}

export interface BodyData {
  height?: LengthValue;
  entries: Record<string, BodyEntry>; // keyed by the local calendar day, "2026-10-06": one entry per day
}

export const MAX_BODY_ENTRIES = 2000;
export const CM_PER_INCH = 2.54;

// Lengths follow the app's kg/lbs setting: cm with kg, inches with lbs
export const lengthUnitFor = (unit: WeightUnit): LengthUnit => (unit === 'kg' ? 'cm' : 'in');

export type BodyField = 'weight' | 'waist' | 'hips' | 'height';

// Accepted ranges in kg / cm (the same limits apply in lbs / in, converted)
export const BODY_LIMITS: Record<BodyField, [number, number]> = {
  weight: [20, 400],
  waist: [30, 250],
  hips: [30, 250],
  height: [100, 250],
};

export const convertLength = (value: number, from: LengthUnit, to: LengthUnit): number => {
  if (from === to) return value;
  return from === 'in' ? value * CM_PER_INCH : value / CM_PER_INCH;
};

// As typed when the unit matches; otherwise converted, 1 decimal, no trailing ".0"
export const displayLength = (value: LengthValue, to: LengthUnit): string =>
  value.unit === to ? value.value : formatWeight(convertLength(Number(value.value), value.unit, to));

export const displayBodyWeight = (value: WeightValue, to: WeightUnit): string =>
  value.unit === to ? value.value : formatWeight(convertWeight(Number(value.value), value.unit, to));

// A number as typed: digits, then optionally "." or "," and 1-2 decimals. Returns it with "." or null.
export const parseBodyNumber = (text: string): string | null => {
  const trimmed = text.trim();
  return /^\d{1,4}([.,]\d{1,2})?$/.test(trimmed) ? trimmed.replace(',', '.') : null;
};

const toBase = (field: BodyField, value: number, unit: WeightUnit | LengthUnit): number =>
  field === 'weight' ? convertWeight(value, unit as WeightUnit, 'kg') : convertLength(value, unit as LengthUnit, 'cm');

const fromBase = (field: BodyField, value: number, unit: WeightUnit | LengthUnit): number =>
  field === 'weight' ? convertWeight(value, 'kg', unit as WeightUnit) : convertLength(value, 'cm', unit as LengthUnit);

const EPSILON = 1e-9;

export const isInRange = (field: BodyField, value: string, unit: WeightUnit | LengthUnit): boolean => {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  const base = toBase(field, n, unit);
  const [min, max] = BODY_LIMITS[field];
  return base >= min - EPSILON && base <= max + EPSILON;
};

// The limits as shown in a unit, rounded inwards so that every number between them is accepted
export const limitsIn = (field: BodyField, unit: WeightUnit | LengthUnit): [string, string] => {
  const [min, max] = BODY_LIMITS[field];
  const low = Math.ceil(fromBase(field, min, unit) * 10 - EPSILON) / 10;
  const high = Math.floor(fromBase(field, max, unit) * 10 + EPSILON) / 10;
  return [formatWeight(low), formatWeight(high)];
};

export type FieldCheck = { ok: true; value: string } | { ok: false; problem: 'notNumber' | 'outOfRange' };

// One typed value: a number in the accepted range (the unit is the one shown next to the box)
export const checkBodyValue = (field: BodyField, text: string, unit: WeightUnit | LengthUnit): FieldCheck => {
  const value = parseBodyNumber(text);
  if (value === null) return { ok: false, problem: 'notNumber' };
  return isInRange(field, value, unit) ? { ok: true, value } : { ok: false, problem: 'outOfRange' };
};

// "2026-10-06": a real calendar day from 1900 on
export const isValidDay = (day: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y < 1900) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

const pad = (n: number) => String(n).padStart(2, '0');
// The phone's local calendar day
export const localDay = (now: Date): string => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

// Days are compared as text: "YYYY-MM-DD" sorts by date
export const isFutureDay = (day: string, now: Date): boolean => day > localDay(now);

// Newest first
export const sortedDays = (body: BodyData | undefined): string[] => Object.keys(body?.entries ?? {}).sort().reverse();

export const sameEntryValues = (a: BodyEntry | undefined, b: BodyEntry | undefined): boolean => {
  const key = (e: BodyEntry | undefined) => (e ? JSON.stringify([e.weight, e.waist ?? null, e.hips ?? null]) : 'none');
  return key(a) === key(b);
};

// ---------- the form ----------

export interface BodyEntryInput {
  day: string;
  weight: string; // as typed
  waist: string; // as typed; '' = not measured
  hips: string;
  unit: WeightUnit; // the app's unit while typing (lengths: cm with kg, inches with lbs)
}

export type BodyProblem =
  | { field: 'day'; problem: 'badDay' | 'future' }
  | { field: 'weight' | 'waist' | 'hips'; problem: 'required' | 'notNumber' | 'outOfRange' };

export type CheckedEntry = { ok: true; day: string; entry: { weight: WeightValue; waist?: LengthValue; hips?: LengthValue } } | { ok: false; problems: BodyProblem[] };

// Checks a whole entry as typed. Weight is required; waist and hips are optional. No day in the future.
export const checkBodyEntryInput = (input: BodyEntryInput, now: Date): CheckedEntry => {
  const problems: BodyProblem[] = [];
  if (!isValidDay(input.day)) problems.push({ field: 'day', problem: 'badDay' });
  else if (isFutureDay(input.day, now)) problems.push({ field: 'day', problem: 'future' });
  const lengthUnit = lengthUnitFor(input.unit);
  const entry: { weight?: WeightValue; waist?: LengthValue; hips?: LengthValue } = {};
  if (input.weight.trim() === '') problems.push({ field: 'weight', problem: 'required' });
  else {
    const weight = checkBodyValue('weight', input.weight, input.unit);
    if (weight.ok) entry.weight = { value: weight.value, unit: input.unit };
    else problems.push({ field: 'weight', problem: weight.problem });
  }
  for (const field of ['waist', 'hips'] as const) {
    if (input[field].trim() === '') continue;
    const length = checkBodyValue(field, input[field], lengthUnit);
    if (length.ok) entry[field] = { value: length.value, unit: lengthUnit };
    else problems.push({ field, problem: length.problem });
  }
  if (problems.length > 0 || !entry.weight) return { ok: false, problems };
  return { ok: true, day: input.day, entry: { weight: entry.weight, ...(entry.waist && { waist: entry.waist }), ...(entry.hips && { hips: entry.hips }) } };
};

// ---------- loading ----------

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A stored value: "72.4" (digits, "." and decimals, as saved) with a known unit, in range
const storedValue = <U extends WeightUnit | LengthUnit>(raw: unknown, field: BodyField, units: readonly U[]): { value: string; unit: U } | null => {
  if (!isPlainObject(raw) || typeof raw.value !== 'string' || !units.includes(raw.unit as U)) return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(raw.value)) return null;
  return isInRange(field, raw.value, raw.unit as U) ? { ...raw, value: raw.value, unit: raw.unit as U } : null;
};

// Body data as loaded (saved data or a backup). Entries with a bad day or a bad weight are dropped; a bad waist
// or hips value drops just that value; a bad height is dropped; above the cap only the newest entries stay.
// `dropped` is true when anything was removed (then the original text is backed up once). Unknown extra
// fields are kept. Never throws.
export const cleanBody = (raw: unknown): { body: BodyData | undefined; dropped: boolean } => {
  if (!isPlainObject(raw)) return { body: undefined, dropped: true };
  let dropped = false;
  const body: BodyData = { ...(raw as object), entries: {} } as BodyData;
  if ('height' in raw) {
    const height = storedValue(raw.height, 'height', ['cm', 'in'] as const);
    if (height) body.height = height;
    else {
      delete body.height;
      dropped = true;
    }
  }
  if (raw.entries !== undefined && !isPlainObject(raw.entries)) dropped = true;
  const entries: [string, BodyEntry][] = [];
  for (const [day, value] of Object.entries(isPlainObject(raw.entries) ? raw.entries : {})) {
    const weight = isPlainObject(value) ? storedValue(value.weight, 'weight', ['kg', 'lbs'] as const) : null;
    if (!isValidDay(day) || !isPlainObject(value) || !weight) {
      dropped = true;
      continue;
    }
    const entry: BodyEntry = { ...(value as object), weight } as BodyEntry;
    for (const field of ['waist', 'hips'] as const) {
      if (!(field in value)) continue;
      const length = storedValue(value[field], field, ['cm', 'in'] as const);
      if (length) entry[field] = length;
      else {
        delete entry[field];
        dropped = true;
      }
    }
    if ('updatedAt' in entry && typeof entry.updatedAt !== 'string') {
      delete entry.updatedAt;
      dropped = true;
    }
    entries.push([day, entry]);
  }
  entries.sort(([a], [b]) => (a < b ? 1 : -1)); // newest first
  if (entries.length > MAX_BODY_ENTRIES) dropped = true;
  // Object.fromEntries keeps odd keys as plain keys (and only valid days get here anyway)
  body.entries = Object.fromEntries(entries.slice(0, MAX_BODY_ENTRIES));
  return { body, dropped };
};

export const hasBodyData = (body: BodyData | undefined): boolean => !!body && (body.height !== undefined || Object.keys(body.entries).length > 0);
