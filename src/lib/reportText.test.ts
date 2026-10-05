import { describe, expect, it } from 'vitest';
import { uiTranslations } from '../data/translations';
import { reportDayHeading, setResultText, topSetText, weekCaption } from './reportText';

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

  it('day tabs: "Day 1" / "6 Ex" in English (unchanged), "第 1 天" / "6 项" in 中文', () => {
    expect([en.dayPill(1), en.exerciseCountShort(6)]).toEqual(['Day 1', '6 Ex']);
    expect([zh.dayPill(1), zh.exerciseCountShort(6)]).toEqual(['第 1 天', '6 项']);
  });

  it('step 4 words: one set, last time, Max in the report, tag names and meanings', () => {
    expect([setResultText('60', '8', 'kg', en), setResultText('132.3', '', 'lbs', en), setResultText('', '12', 'kg', zh), setResultText('', '', 'kg', en), setResultText('', '', 'kg', zh)]).toEqual([
      '60 kg × 8', '132.3 lbs', '自重 × 12', 'done', '已完成',
    ]);
    expect([en.lastTimeLine('28 Sept', '60 kg × 8'), en.lastTimeLine(null, '60 kg × 8')]).toEqual(['Last (28 Sept): 60 kg × 8', 'Last: 60 kg × 8']);
    expect([zh.lastTimeLine('9月28日', '60 kg × 8'), zh.lastTimeLine(null, '60 kg × 8')]).toEqual(['上次（9月28日）：60 kg × 8', '上次：60 kg × 8']);
    expect([en.reportMaxOnSets([2]), en.reportMaxOnSets([1, 3])]).toEqual(['Max on set 2', 'Max on sets 1, 3']);
    expect([zh.reportMaxOnSets([2]), zh.reportMaxOnSets([1, 3])]).toEqual(['第 2 组到达极限', '第 1、3 组到达极限']);
    expect([en.tagNames, zh.tagNames]).toEqual([{ easy: 'Easy', good: 'Good', max: 'Max' }, { easy: '轻松', good: '刚好', max: '极限' }]);
    expect(en.tagHelp).toEqual({
      easy: 'I could have done 3 or more extra reps',
      good: 'I had 1 to 2 reps left',
      max: 'I was at my limit, I could not do another rep / had to stop',
    });
    // the 中文 best-set badge no longer uses 上次 ("last time"), which the last-time lines use
    expect([en.prevBest('60', 'kg', '8'), zh.prevBest('60', 'kg', '8')]).toEqual(['Prev: 60 kg × 8', '最佳: 60 kg × 8次']);
  });

  it('week captions', () => {
    const local = (d: number) => new Date(2026, 9, d, 12).toISOString();
    expect(weekCaption({ id: 'w', startedAt: local(2), slots: {} }, 1, 'zh', zh)).toBe('第 1 周 · 2026年10月2日 起');
    expect(weekCaption({ id: 'w', startedAt: local(2), endedAt: local(4), slots: {} }, 1, 'en', en)).toBe('Week 1 · 2 Oct – 4 Oct 2026');
    expect(weekCaption({ id: 'w', startedAt: 'bad', slots: {} }, 2, 'en', en)).toBe('Week 2 · dates unknown');
  });
});
