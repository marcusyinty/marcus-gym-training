import { describe, expect, it } from 'vitest';
import { uiTranslations } from '../data/translations';
import { reportDayHeading, topSetText, weekCaption } from './reportText';

const en = uiTranslations.en;
const zh = uiTranslations.zh;

describe('weekly report words, EN and 中文', () => {
  it('best set texts', () => {
    expect(topSetText({ kind: 'none' }, 'kg', en)).toBe('—');
    expect(topSetText({ kind: 'weight', weightText: '62.5', reps: 6 }, 'kg', zh)).toBe('62.5 kg × 6');
    expect(topSetText({ kind: 'weight', weightText: '135', reps: 0 }, 'lbs', en)).toBe('135 lbs');
    expect([topSetText({ kind: 'bodyweight', reps: 12 }, 'kg', en), topSetText({ kind: 'bodyweight', reps: 12 }, 'kg', zh)]).toEqual(['BW × 12', '自重 × 12']);
    expect([topSetText({ kind: 'ticked', sets: 1 }, 'kg', en), topSetText({ kind: 'ticked', sets: 3 }, 'kg', zh)]).toEqual(['1 set ✓', '3 组 ✓']);
  });

  it('day headings: the day number is not repeated in 中文 (its title already names the day)', () => {
    expect(reportDayHeading(1, 'Upper A', 'en', en)).toBe('Day 1: Upper A');
    expect(reportDayHeading(1, '第一天：上肢 A', 'zh', zh)).toBe('第一天：上肢 A');
  });

  it('labels that used to be English only', () => {
    expect([en.reportBrand, zh.reportBrand]).toEqual(['MARCUS HYPERTROPHY', 'MARCUS 增肌站']);
    expect([en.reportCleared(4), zh.reportCleared(4)]).toEqual(['4% Cleared', '完成 4%']);
    expect([en.exerciseCount(6), zh.exerciseCount(6)]).toEqual(['6 Exercises', '6 项动作']);
  });

  it('week captions', () => {
    const local = (d: number) => new Date(2026, 9, d, 12).toISOString();
    expect(weekCaption({ id: 'w', startedAt: local(2), slots: {} }, 1, 'zh', zh)).toBe('第 1 周 · 2026年10月2日 起');
    expect(weekCaption({ id: 'w', startedAt: local(2), endedAt: local(4), slots: {} }, 1, 'en', en)).toBe('Week 1 · 2 Oct – 4 Oct 2026');
    expect(weekCaption({ id: 'w', startedAt: 'bad', slots: {} }, 2, 'en', en)).toBe('Week 2 · dates unknown');
  });
});
