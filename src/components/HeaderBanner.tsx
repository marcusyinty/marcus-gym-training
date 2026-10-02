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
      <div className="max-w-4xl mx-auto px-4 py-3.5 sm:px-6">
        {/* Top Brand & Language Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/40 shrink-0">
              <div className="w-full h-full bg-[#09090b] rounded-[10px] flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white font-['Plus_Jakarta_Sans']">
                  {t.appTitle}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {t.programBadge}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium">{t.appSubTitle}</p>
            </div>
          </div>

          {/* Right Top Controls */}
          <div className="flex items-center gap-2">
            {/* Weekly Report Button */}
            <button
              onClick={onOpenWeeklyReport}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-extrabold transition-all cursor-pointer shrink-0"
              title="View Weekly Report Card"
            >
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">{t.weeklyReportBtn}</span>
            </button>

            {/* Language Switcher Button [ EN | 中文 ] */}
            <div className="flex items-center bg-[#18181c] border border-zinc-800 rounded-lg p-0.5 text-xs font-bold shrink-0">
              <button
                onClick={() => onToggleLanguage('en')}
                className={`px-2 py-1 rounded-md transition-all ${
                  lang === 'en' ? 'bg-emerald-500 text-black font-extrabold shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => onToggleLanguage('zh')}
                className={`px-2 py-1 rounded-md transition-all ${
                  lang === 'zh' ? 'bg-emerald-500 text-black font-extrabold shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                中文
              </button>
            </div>

            {/* About Button */}
            <button
              onClick={onOpenAbout}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors shrink-0 cursor-pointer"
              title="About Marcus' Hypertrophy Hub"
            >
              <Info className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
