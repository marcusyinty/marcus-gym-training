// The words of the weekly report in the chosen language (EN or 中文). Pure, so both languages are tested.
import type { Language, UiTranslations } from '../data/translations';
import { Cycle } from './model';
import { WeightUnit } from './units';
import { TopSet } from './weeklyReport';
import { formatDay, formatDayRange } from './weeks';

// "Week 3 · 28 Sept – 4 Oct 2026" for a finished week, "Week 3 · since 28 Sept 2026" for the current one
export const weekCaption = (cycle: Cycle, weekNumber: number, lang: Language, t: UiTranslations): string => {
  const dates = cycle.endedAt
    ? formatDayRange(cycle.startedAt, cycle.endedAt, lang)
    : (() => {
        const start = formatDay(cycle.startedAt, lang);
        return start ? t.weekSince(start) : null;
      })();
  return `${t.weekLabel(weekNumber)} · ${dates ?? t.weekDatesUnknown}`;
};

// The best ticked set as text: "62.5 kg × 6", "BW × 12" / "自重 × 12", "3 sets ✓", or "—" when nothing was ticked
export const topSetText = (top: TopSet, unit: WeightUnit, t: UiTranslations): string => {
  switch (top.kind) {
    case 'none':
      return '—';
    case 'ticked':
      return t.reportSetsTicked(top.sets);
    case 'bodyweight':
      return `${t.bodyweightShort} × ${top.reps}`;
    case 'weight':
      return top.reps > 0 ? `${top.weightText} ${unit} × ${top.reps}` : `${top.weightText} ${unit}`;
  }
};

// A day's heading in the report: "Day 1: Upper A"; in 中文 just "第一天：上肢 A" (that title already names the day)
export const reportDayHeading = (dayNumber: number, title: string, lang: Language, t: UiTranslations): string =>
  lang === 'zh' ? title : `${t.dayPill(dayNumber)}: ${title}`;
