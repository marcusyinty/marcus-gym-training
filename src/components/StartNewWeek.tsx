import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Language, uiTranslations } from '../data/translations';
import { StartWeekResult } from '../lib/store/appDataStore';
import { AlertTriangle, CalendarPlus, Lock, X } from 'lucide-react';

// ready: can start; empty: no ticked set this week; savingOff: nothing can be saved this session;
// pastWeek: an archived week shown read-only
export type StartNewWeekAvailability = 'ready' | 'empty' | 'savingOff' | 'pastWeek';

interface StartNewWeekProps {
  lang: Language;
  availability: StartNewWeekAvailability;
  weekNumber: number;
  tickedSets: number;
  onConfirm: () => StartWeekResult;
}

// "Start new week" at the bottom of the weekly report, with its confirm dialog. When it can't be used it
// looks clearly disabled (dashed, lock) and says why.
export const StartNewWeek: React.FC<StartNewWeekProps> = ({ lang, availability, weekNumber, tickedSets, onConfirm }) => {
  const t = uiTranslations[lang];
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const reason =
    availability === 'empty'
      ? t.startNewWeekEmpty
      : availability === 'savingOff'
        ? t.startNewWeekSavingOff
        : availability === 'pastWeek'
          ? t.startNewWeekPastWeek
          : null;

  const close = () => {
    setIsConfirmOpen(false);
    setError(null);
    requestAnimationFrame(() => openButtonRef.current?.focus());
  };

  // Cancel gets the focus (the safe choice); Escape closes the dialog
  useEffect(() => {
    if (!isConfirmOpen) return;
    cancelButtonRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isConfirmOpen]);

  const handleConfirm = () => {
    const result = onConfirm();
    if (result.ok || result.reason === 'alreadyStarted') {
      setIsConfirmOpen(false); // the app moves on to the new week
      return;
    }
    setError(result.reason === 'empty' ? t.startNewWeekEmpty : result.reason === 'savingOff' ? t.startNewWeekSavingOff : t.startNewWeekFailed);
  };

  return (
    <div className="mt-2">
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        disabled={reason !== null}
        aria-describedby={reason ? 'start-new-week-reason' : undefined}
        className="w-full min-h-[44px] px-3 flex items-center justify-center gap-2 rounded-xl text-xs font-extrabold border cursor-pointer bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-zinc-100 disabled:cursor-not-allowed disabled:bg-transparent disabled:border-dashed disabled:border-zinc-700 disabled:text-zinc-500"
      >
        {reason ? <Lock className="w-4 h-4 shrink-0" /> : <CalendarPlus className="w-4 h-4 shrink-0 text-emerald-400" />}
        {t.startNewWeekButton}
      </button>
      {reason && (
        <p id="start-new-week-reason" className="mt-1.5 text-xs text-zinc-300 leading-relaxed text-center">
          {reason}
        </p>
      )}

      {isConfirmOpen &&
        createPortal(
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="start-week-title"
            aria-describedby="start-week-text"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          >
            <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-5 max-w-sm w-full shadow-2xl relative">
              <button
                type="button"
                onClick={close}
                className="absolute top-1.5 right-1.5 w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                aria-label={t.cancel}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-3 text-emerald-400 pr-8">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CalendarPlus className="w-5 h-5" />
                </div>
                <h3 id="start-week-title" className="text-base font-bold text-white">
                  {t.startNewWeekTitle}
                </h3>
              </div>

              <p id="start-week-text" className="text-xs text-zinc-300 leading-relaxed">
                {t.startNewWeekText}
              </p>
              <p className="mt-2 text-xs font-semibold text-white">{t.startNewWeekSummary(weekNumber, tickedSets)}</p>

              {error && (
                <p role="alert" className="mt-3 flex items-start gap-2 text-xs text-rose-300 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-rose-400" />
                  <span>{error}</span>
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  ref={cancelButtonRef}
                  type="button"
                  onClick={close}
                  className="min-h-[44px] px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold leading-tight cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={error !== null}
                  className="min-h-[44px] px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold leading-tight cursor-pointer disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
                >
                  {t.startNewWeekButton}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
