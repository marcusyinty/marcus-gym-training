// Week numbers and dates for the history list and the report. Weeks are numbered by their order in
// history: the oldest archived week is Week 1 and the current week comes after the last archived one.
// Nothing about this is saved, so if a week is ever missing, the weeks after it simply move up one number
// (their dates stay correct). Dates are the phone's local calendar days.
import type { Language } from '../data/translations';
import { AppDataV3, Cycle } from './model';

export interface WeekEntry {
  cycle: Cycle;
  number: number;
}

export const pastWeeks = (data: AppDataV3): WeekEntry[] => data.archivedCycles.map((cycle, index) => ({ cycle, number: index + 1 }));

export const currentWeekNumber = (data: AppDataV3): number => data.archivedCycles.length + 1;

const LOCALES: Record<Language, string> = { en: 'en-GB', zh: 'zh-CN' };
const DAY_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

const readDate = (iso: string | undefined): Date | null => {
  if (typeof iso !== 'string') return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

// e.g. "28 Sept 2026" / "2026年9月28日"; null when the saved text isn't a readable date
export const formatDay = (iso: string | undefined, lang: Language): string | null => {
  const date = readDate(iso);
  return date ? date.toLocaleDateString(LOCALES[lang], DAY_FORMAT) : null;
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// e.g. "28 Sept – 4 Oct 2026" / "2026年9月28日 – 10月4日" (the year is written once when both days share it);
// null when either date is unreadable
export const formatDayRange = (startIso: string | undefined, endIso: string | undefined, lang: Language): string | null => {
  const start = readDate(startIso);
  const end = readDate(endIso);
  if (!start || !end) return null;
  const full = (date: Date) => date.toLocaleDateString(LOCALES[lang], DAY_FORMAT);
  const short = (date: Date) => date.toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'short' });
  if (sameDay(start, end)) return full(start);
  if (start.getFullYear() !== end.getFullYear()) return `${full(start)} – ${full(end)}`;
  return lang === 'zh' ? `${full(start)} – ${short(end)}` : `${short(start)} – ${full(end)}`;
};
