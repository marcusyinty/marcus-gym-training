import React, { useState } from 'react';
import { Language, uiTranslations } from '../data/translations';
import { Dumbbell, ShieldCheck, CheckCircle2, RotateCcw, AlertTriangle, X, Info, Globe } from 'lucide-react';

interface HeaderBannerProps {
  lang: Language;
  onToggleLanguage: (newLang: Language) => void;
  onOpenAbout: () => void;
  completedSetsCount: number;
  totalSetsCount: number;
  activeDayTitle: string;
  onResetActiveDay: () => void;
  onResetAll: () => void;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  lang,
  onToggleLanguage,
  onOpenAbout,
  completedSetsCount,
  totalSetsCount,
  activeDayTitle,
  onResetActiveDay,
  onResetAll,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const t = uiTranslations[lang];
  const progressPercent = totalSetsCount > 0 ? Math.round((completedSetsCount / totalSetsCount) * 100) : 0;

  return (
    <header className="w-full bg-[#0c0c0e] border-b border-[#1f1f23] sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
      <div className="max-w-4xl mx-auto px-4 py-3.5 sm:px-6">
        {/* Top Brand & Language Bar */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
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

          {/* Right Top Controls: Language Switcher & About & Progress */}
          <div className="flex items-center gap-2">
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

            {/* Progress Tracker Pill */}
            <div className="hidden sm:flex flex-col items-end shrink-0 ml-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{completedSetsCount}/{totalSetsCount} {t.setsCompleted}</span>
              </div>
              <div className="w-24 bg-zinc-800 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Beginner Notice & Reset Control */}
        <div className="bg-[#141417] border border-[#27272a] rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 relative overflow-hidden">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs text-zinc-300 leading-tight">
              <span className="font-semibold text-white block mb-0.5">{t.beginnerStandardTitle}</span>
              <span className="text-zinc-400 text-[11px]">{t.beginnerStandardText}</span>
            </div>
          </div>

          {/* Reset Day Button */}
          <button
            onClick={() => setShowConfirmModal(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-rose-400 bg-zinc-800/80 hover:bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-zinc-700 hover:border-rose-500/40 transition-all shrink-0 cursor-pointer"
            title="Clear or Reset Workout Progress"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.resetDay}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-5 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="absolute top-3 right-3 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">{t.resetModalTitle}</h3>
            </div>

            <p className="text-xs text-zinc-300 mb-4 leading-relaxed">{t.resetModalText}</p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  onResetActiveDay();
                  setShowConfirmModal(false);
                }}
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                {t.resetCurrentDayBtn}
              </button>
              <button
                onClick={() => {
                  onResetAll();
                  setShowConfirmModal(false);
                }}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                {t.resetAllDaysBtn}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full py-1.5 text-xs text-zinc-400 hover:text-white font-medium"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
