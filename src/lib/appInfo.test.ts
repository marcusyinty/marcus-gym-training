import { describe, expect, it } from 'vitest';
import { uiTranslations } from '../data/translations';
import { updateLogs } from '../data/updates';
import { version as packageVersion } from '../../package.json';
import { APP_VERSION, formatLogDate } from './appInfo';

describe('About modal facts', () => {
  it('the version shown is the one in package.json (1.4.0)', () => {
    expect([APP_VERSION, packageVersion]).toEqual(['1.4.0', '1.4.0']);
  });

  it('developer log: releases newest first, then the launch entry; at most 5 bullets, same count in both languages', () => {
    expect(updateLogs.map((log) => [log.version ?? log.tag, log.date, formatLogDate(log, 'zh')])).toEqual([
      ['v1.4.0', 'October 6, 2026', '2026年10月6日'],
      ['v1.3.0', 'October 5, 2026', '2026年10月5日'],
      ['v1.2.0', 'October 4, 2026', '2026年10月4日'],
      ['v1.1.0', 'October 3, 2026', '2026年10月3日'],
      ['Launch', 'September 13, 2026', '2026年9月13日'],
    ]);
    for (const log of updateLogs.filter((entry) => entry.bullets)) {
      expect(log.bullets!.en.length).toBeLessThanOrEqual(5);
      expect(log.bullets!.zh.length).toBe(log.bullets!.en.length);
    }
    expect(updateLogs[0].bullets!.en[0]).toBe('Body measurements: record weight, waist and hips with a date, see a chart and your changes over time');
    expect(updateLogs[0].bullets!.zh[0]).toBe('身体数据：记录体重、腰围和臀围及日期，查看图表与变化趋势');
    const v130 = updateLogs.find((log) => log.version === 'v1.3.0')!;
    expect(v130.bullets!.en[2]).toBe('Mark each set Easy / Good / Max, and see what you did last time');
    expect(v130.bullets!.zh[2]).toBe('每组可标记 轻松 / 刚好 / 极限，并显示上次的表现');
  });

  it('developer-log dates: as written in English, Chinese date in 中文', () => {
    const launch = updateLogs.find((log) => log.id === 'v1-launch')!;
    expect([formatLogDate(launch, 'en'), formatLogDate(launch, 'zh')]).toEqual(['September 13, 2026', '2026年9月13日']);
    expect(formatLogDate({ date: 'Someday', isoDate: 'bad' }, 'zh')).toBe('Someday');
    for (const log of updateLogs) expect(log.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('About texts in both languages', () => {
    expect([uiTranslations.en.devLogTitle, uiTranslations.zh.devLogTitle]).toEqual(['Developer Log & Updates', '开发者日志与更新']);
    expect([uiTranslations.en.builtForOverload, uiTranslations.zh.builtForOverload]).toEqual(['Built for Progressive Overload', '为渐进超负荷而生']);
  });
});
