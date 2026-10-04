import React, { useEffect, useState } from 'react';
import { Language, uiTranslations } from '../data/translations';
import { performedExerciseName } from '../lib/exerciseVariants';
import { SwapResult } from '../lib/store/appDataStore';
import { SwapOptions } from '../lib/store/swap';
import { EnrichedExercise } from '../types/workout';
import { AlertTriangle, Check, X } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

interface SwapSheetProps {
  open: boolean;
  lang: Language;
  slot: EnrichedExercise; // the program's exercise for this slot
  options: SwapOptions; // from swapOptions() on the newest data
  onSwap: (to: string) => SwapResult;
  onClose: () => void;
}

// Chooser for the exercise a slot does this week: the program exercise first, then its alternative(s), the
// current one marked. Ticked sets block a swap; typed values are cleared only after a confirm. When another
// tab changed things meanwhile the sheet closes and the page shows the newest data (with a notice).
export const SwapSheet: React.FC<SwapSheetProps> = ({ open, lang, slot, options, onSwap, onClose }) => {
  const t = uiTranslations[lang];
  const [confirmTo, setConfirmTo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // A fresh start every time it opens
  useEffect(() => {
    if (open) {
      setConfirmTo(null);
      setMessage(null);
    }
  }, [open, slot.id]);

  const blocked = options.blockedBy === 'hasTickedSets';
  const nameOf = (exerciseId: string) => performedExerciseName(slot, exerciseId, lang);

  const swapTo = (to: string) => {
    const result = onSwap(to);
    if (result.ok || result.reason === 'weekChanged' || result.reason === 'changedElsewhere') {
      onClose();
      return;
    }
    setConfirmTo(null);
    setMessage(
      result.reason === 'hasTickedSets'
        ? t.swapBlockedTicked
        : result.reason === 'savingOff'
          ? t.swapSavingOff
          : result.reason === 'notAllowed'
            ? t.swapNotAllowed
            : result.reason === 'sameExercise'
              ? t.swapSame
              : t.changeSaveFailed
    );
  };

  const choose = (to: string) => {
    setMessage(null);
    if (options.hasTypedValues) setConfirmTo(to);
    else swapTo(to);
  };

  const notice = blocked ? t.swapBlockedTicked : message;

  return (
    <BottomSheet open={open} onClose={onClose} labelledBy="swap-sheet-title">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 pt-1">
          <h3 id="swap-sheet-title" className="text-base font-bold text-white">
            {t.swapTitle}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400">
            {slot.sets} {t.sets} · {slot.reps} {t.reps}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="-mt-1 -mr-1 w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {notice && (
        <p role="alert" data-swap-message className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-amber-400" />
          <span>{notice}</span>
        </p>
      )}

      {confirmTo ? (
        <div data-swap-confirm className="space-y-3">
          <p className="text-sm text-zinc-200 leading-relaxed">{t.swapConfirmClear}</p>
          <p className="text-xs text-zinc-400">{nameOf(options.current)} → {nameOf(confirmTo)}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmTo(null)}
              className="min-h-[44px] px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => swapTo(confirmTo)}
              className="min-h-[44px] px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold leading-tight cursor-pointer"
            >
              {t.swapConfirmButton}
            </button>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {options.choices.map((exerciseId, index) => {
            const isCurrent = exerciseId === options.current;
            const isProgram = index === 0;
            const name = nameOf(exerciseId);
            return (
              <li key={exerciseId}>
                <button
                  type="button"
                  onClick={() => choose(exerciseId)}
                  disabled={isCurrent || blocked}
                  aria-current={isCurrent ? 'true' : undefined}
                  data-swap-choice={exerciseId}
                  className={`w-full min-h-[52px] px-3 py-2 flex items-center gap-3 rounded-xl border text-left cursor-pointer disabled:cursor-default ${
                    isCurrent
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-[#2e2e35] bg-[#18181c] hover:border-zinc-500 disabled:opacity-50'
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-white leading-snug">
                      {isProgram && !isCurrent ? t.swapBackTo(name) : name}
                    </span>
                    <span className="block text-xs text-zinc-400">{isProgram ? t.swapProgramExercise : t.swapAlternative}</span>
                  </span>
                  {isCurrent && (
                    <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-emerald-400">
                      <Check className="w-4 h-4" /> {t.swapCurrent}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
};
