import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Language, uiTranslations } from '../data/translations';
import { ShieldCheck, RotateCcw, AlertTriangle, X, ChevronDown } from 'lucide-react';

interface ProgramNoticeProps {
  lang: Language;
  onResetActiveDay: () => void;
  onResetAll: () => void;
}

// Beginner form notice + Reset button. Shown once at the top of the page content (it scrolls away),
// not in the sticky header. The notice is clamped to 2 lines; tapping it shows the full text.
export const ProgramNotice: React.FC<ProgramNoticeProps> = ({ lang, onResetActiveDay, onResetAll }) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const t = uiTranslations[lang];

  return (
    <div className="mb-3 md:mb-4 bg-[#141417] border border-[#27272a] rounded-xl pl-3 pr-1.5 py-1 flex items-center gap-2">
      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />

      <button
        onClick={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
        className="flex-1 min-w-0 min-h-10 flex items-center gap-1.5 text-left cursor-pointer"
      >
        <span className={`text-xs leading-snug text-zinc-400 ${isExpanded ? 'block' : 'line-clamp-2'}`}>
          <span className="font-semibold text-white">{t.beginnerStandardTitle}</span>
          {' · '}
          {t.beginnerStandardText}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Reset Day Button */}
      <button
        onClick={() => setShowConfirmModal(true)}
        className="h-10 min-w-10 flex items-center justify-center gap-1 text-xs font-bold text-zinc-400 hover:text-rose-400 bg-zinc-800/80 hover:bg-rose-950/40 px-2.5 rounded-lg border border-zinc-700 hover:border-rose-500/40 transition-all shrink-0 cursor-pointer"
        title="Clear or Reset Workout Progress"
        aria-label={t.resetDay}
      >
        <RotateCcw className="w-4 h-4" />
        <span className="hidden sm:inline">{t.resetDay}</span>
      </button>

      {/* Confirmation Modal: rendered into <body> so no parent effect (e.g. blur) can trap it in a smaller box */}
      {showConfirmModal &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          >
            <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-5 max-w-sm w-full shadow-2xl relative">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="absolute top-1.5 right-1.5 w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                aria-label={t.cancel}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-3 text-rose-400">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 id="reset-modal-title" className="text-base font-bold text-white">{t.resetModalTitle}</h3>
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
          </div>,
          document.body
        )}
    </div>
  );
};
