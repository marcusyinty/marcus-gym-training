import React, { useRef, useLayoutEffect } from 'react';
import { Language, uiTranslations } from '../data/translations';
import { Dumbbell, CheckCircle2, Info, Trophy, Award } from 'lucide-react';

interface HeaderBannerProps {
  lang: Language;
  onToggleLanguage: (newLang: Language) => void;
  onOpenAbout: () => void;
  onOpenWeeklyReport: () => void;
  completedSetsCount: number;
  totalSetsCount: number;
  activeDayTitle: string;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  lang,
  onToggleLanguage,
  onOpenAbout,
  onOpenWeeklyReport,
  completedSetsCount,
  totalSetsCount,
  activeDayTitle,
}) => {
  const t = uiTranslations[lang];
  const progressPercent = totalSetsCount > 0 ? Math.round((completedSetsCount / totalSetsCount) * 100) : 0;
  const headerRef = useRef<HTMLElement | null>(null);

  // Publish the real header height as --header-height so the sticky day tabs sit right below it
  useLayoutEffect(() => {
    const headerElem = headerRef.current;
    if (!headerElem) return;

    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty('--header-height', `${headerElem.getBoundingClientRect().height}px`);
    };

    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(headerElem, { box: 'border-box' });

    return () => observer.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="w-full bg-[#0c0c0e] border-b border-[#1f1f23] sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
      {/* One slim row: logo + title, then weekly report, EN | 中文 and About (all 40px tap targets) */}
      <div className="max-w-4xl mx-auto px-2.5 max-[359px]:px-2 sm:px-6 py-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Logo hidden below 360px wide so the full title fits */}
          <div className="max-[359px]:hidden w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/40 shrink-0">
            <div className="w-full h-full bg-[#09090b] rounded-md flex items-center justify-center">
              <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-[13px] sm:text-xl font-extrabold tracking-tight text-white font-['Plus_Jakarta_Sans'] truncate">
                {t.appTitle}
              </h1>
              {/* Badge and subtitle only on wider screens, so the row never wraps on phones */}
              <span className="hidden sm:inline-block shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {t.programBadge}
              </span>
            </div>
            <p className="hidden sm:block text-xs text-zinc-400 font-medium truncate">{t.appSubTitle}</p>
          </div>
        </div>

        {/* Right Top Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Weekly Report Button */}
          <button
            onClick={onOpenWeeklyReport}
            className="h-10 min-w-10 flex items-center justify-center gap-1.5 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-extrabold transition-all cursor-pointer"
            title="View Weekly Report Card"
            aria-label={t.weeklyReportBtn}
          >
            <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">{t.weeklyReportBtn}</span>
          </button>

          {/* Language Switcher Button [ EN | 中文 ] (ring instead of border keeps the buttons a full 40px) */}
          <div className="flex items-center h-10 bg-[#18181c] ring-1 ring-zinc-800 rounded-lg overflow-hidden text-xs font-bold">
            <button
              onClick={() => onToggleLanguage('en')}
              aria-pressed={lang === 'en'}
              className={`h-10 min-w-10 px-2 transition-all cursor-pointer ${
                lang === 'en' ? 'bg-emerald-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => onToggleLanguage('zh')}
              aria-pressed={lang === 'zh'}
              className={`h-10 min-w-10 px-2 transition-all cursor-pointer ${
                lang === 'zh' ? 'bg-emerald-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              中文
            </button>
          </div>

          {/* About Button */}
          <button
            onClick={onOpenAbout}
            className="h-10 w-10 flex items-center justify-center rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
            title="About Marcus' Hypertrophy Hub"
            aria-label={t.aboutTitle}
          >
            <Info className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </div>
    </header>
  );
};
