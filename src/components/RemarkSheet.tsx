import React, { useEffect, useRef, useState } from 'react';
import { Language, uiTranslations } from '../data/translations';
import { limitRemarkInput, REMARK_MAX_LENGTH, REMARK_MAX_LINES, remarkLength } from '../lib/remarks';
import { RemarkResult } from '../lib/store/appDataStore';
import { AlertTriangle, X } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

interface RemarkSheetProps {
  open: boolean;
  lang: Language;
  exerciseName: string; // the exercise actually done (its note is shown and saved)
  initialText: string;
  onSave: (text: string) => RemarkResult;
  onClose: () => void;
}

// The note editor: a text box with a "n/200" counter, Save and Cancel. Typing or pasting can't go past
// 3 lines or 200 characters. Saving empty text deletes the note (no extra confirm). Saved right away.
export const RemarkSheet: React.FC<RemarkSheetProps> = ({ open, lang, exerciseName, initialText, onSave, onClose }) => {
  const t = uiTranslations[lang];
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Start from the saved note each time it opens (only then: typing is never reset), cursor at the end
  useEffect(() => {
    if (!open) return;
    setText(initialText);
    setError(null);
    requestAnimationFrame(() => {
      const box = textareaRef.current;
      if (!box) return;
      box.focus({ preventScroll: true });
      box.setSelectionRange(box.value.length, box.value.length);
    });
  }, [open]);

  const lineCount = text.split('\n').length;
  const length = remarkLength(text);

  const save = () => {
    const result = onSave(text);
    if (result.ok) {
      onClose();
      return;
    }
    setError(result.reason === 'savingOff' ? t.swapSavingOff : t.changeSaveFailed);
  };

  return (
    <BottomSheet open={open} onClose={onClose} labelledBy="remark-sheet-title">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 id="remark-sheet-title" className="min-w-0 pt-2 text-base font-bold text-white leading-snug">
          {t.remarkTitle(exerciseName)}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="-mt-1 -mr-1 w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        rows={REMARK_MAX_LINES}
        onChange={(e) => setText(limitRemarkInput(e.target.value))}
        onKeyDown={(e) => {
          // A 4th line is not allowed: Enter does nothing once there are 3
          if (e.key === 'Enter' && lineCount >= REMARK_MAX_LINES) e.preventDefault();
        }}
        placeholder={t.remarkPlaceholder}
        aria-describedby="remark-sheet-hint"
        data-remark-input
        // 16px text: iPhone zooms the page into smaller text fields
        className="w-full resize-none rounded-xl border border-zinc-700 bg-[#18181c] px-3 py-2 text-base leading-6 text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
      />
      <div className="mt-1 flex items-start justify-between gap-3 text-xs">
        <p id="remark-sheet-hint" className="text-zinc-400 leading-snug">
          {t.remarkHint}
        </p>
        <span data-remark-counter aria-live="polite" className={`shrink-0 font-mono ${length >= REMARK_MAX_LENGTH - 10 ? 'text-amber-300' : 'text-zinc-400'}`}>
          {length}/{REMARK_MAX_LENGTH}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-rose-400" />
          <span>{error}</span>
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-bold cursor-pointer"
        >
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={save}
          data-remark-save
          className="min-h-[44px] px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-extrabold cursor-pointer"
        >
          {t.remarkSave}
        </button>
      </div>
    </BottomSheet>
  );
};
