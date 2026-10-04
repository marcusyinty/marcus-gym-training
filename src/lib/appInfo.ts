// About-modal facts: the app's version and the developer-log dates.
import type { Language } from '../data/translations';
// Only this one field of package.json ends up in the app
import { version } from '../../package.json';

export const APP_VERSION: string = version;

// A developer-log date: as written in English ("September 13, 2026"), or "2026年9月13日" in 中文
export const formatLogDate = (entry: { date: string; isoDate: string }, lang: Language): string => {
  if (lang !== 'zh') return entry.date;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entry.isoDate);
  return match ? `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日` : entry.date;
};
