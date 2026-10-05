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

// A calendar day saved as "2026-10-05" (body entries): read as a local day, never shifted by the time zone.
// e.g. "5 Oct 2026" / "2026年10月5日"; short: "5 Oct" / "10月5日". The text itself when it isn't a day.
export const formatLocalDay = (day: string, lang: Language, short = false): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(LOCALES[lang], short ? { day: 'numeric', month: 'short' } : DAY_FORMAT);
};

// e.g. "28 Sept" / "9月28日" (no year, for short lines); null when the saved text isn't a readable date
export const formatShortDay = (iso: string | undefined, lang: Language): string | null => {
  const date = readDate(iso);
  return date ? date.toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'short' }) : null;
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// "2026-09-28" (local calendar day), e.g. for file names; null when the saved text isn't a readable date
export const localDateStamp = (iso: string | undefined): string | null => {
  const date = readDate(iso);
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

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
