import { describe, expect, it } from 'vitest';
import { uiTranslations } from '../data/translations';
import { updateLogs } from '../data/updates';
import { version as packageVersion } from '../../package.json';
import { APP_VERSION, formatLogDate } from './appInfo';

describe('About modal facts', () => {
  it('the version shown is the one in package.json (1.2.0)', () => {
    expect([APP_VERSION, packageVersion]).toEqual(['1.2.0', '1.2.0']);
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
