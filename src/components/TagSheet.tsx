import React from 'react';
import { Language, uiTranslations } from '../data/translations';
import { setResultText } from '../lib/reportText';
import type { SetTag } from '../lib/store/reducer';
import type { LastTimeSet } from '../lib/lastTime';
import { displayWeight, WeightUnit } from '../lib/units';
import { SetDetail } from '../types/workout';
import { Flag, X } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { TAG_ORDER, tagFilled, tagOutline, tagText } from './tagLook';

interface TagSheetProps {
  open: boolean;
  lang: Language;
  exerciseName: string; // the exercise actually done in the slot
  totalSets: number;
  completedSetIndexes: number[];
  setDetails: Record<number, SetDetail>;
  tags: Record<number, SetTag>;
  lastTime?: { date: string | null; sets: Record<number, LastTimeSet> };
  weightUnit: WeightUnit;
  onSetTag: (setIndex: number, tag: SetTag | null) => void;
  onClose: () => void;
}

// How each set of one exercise felt: Easy / Good / Max / No tag for every ticked set (2 taps from the card),
// with what the three tags mean. Each tap is saved like a tick; the sheet stays open for the other sets.
export const TagSheet: React.FC<TagSheetProps> = ({ open, lang, exerciseName, totalSets, completedSetIndexes, setDetails, tags, lastTime, weightUnit, onSetTag, onClose }) => {
  const t = uiTranslations[lang];
  const colon = lang === 'zh' ? '：' : ': ';
  // The date is written once: on the first set that has a "last time"
  const firstLastTimeIndex = Array.from({ length: totalSets }, (_, i) => i).find((i) => lastTime?.sets[i] !== undefined);

  return (
    <BottomSheet open={open} onClose={onClose} labelledBy="tag-sheet-title">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 pt-1">
          <h3 id="tag-sheet-title" className="text-base font-bold text-white">
            {t.tagSheetTitle}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400 truncate">{exerciseName}</p>
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

      {/* What the tags mean */}
      <dl data-tag-help className="mb-3 space-y-1 rounded-xl border border-[#27272a] bg-[#0d0d10] px-3 py-2 text-xs leading-snug">
        {TAG_ORDER.map((tag) => (
          <div key={tag}>
            <dt className={`inline font-bold ${tagText[tag]}`}>
              {tag === 'max' && <Flag aria-hidden="true" className="inline w-3 h-3 mr-0.5 -mt-0.5" />}
              {t.tagNames[tag]}
              {colon}
            </dt>
            <dd className="inline text-zinc-300">{t.tagHelp[tag]}</dd>
          </div>
        ))}
      </dl>

      <ul className="space-y-2.5">
        {Array.from({ length: totalSets }, (_, setIndex) => {
          const setNumber = setIndex + 1;
          const ticked = completedSetIndexes.includes(setIndex);
          const detail = setDetails[setIndex];
          const result = detail ? setResultText(displayWeight(detail.weight, detail.unit, weightUnit), detail.reps, weightUnit, t) : ticked ? t.setResultTicked : '';
          const current = ticked ? tags[setIndex] : undefined;
          const last = lastTime?.sets[setIndex];
          return (
            <li key={setIndex} data-tag-set={setIndex}>
              <p className="flex items-baseline gap-2 text-xs leading-4">
                <span className="shrink-0 font-extrabold text-zinc-200">{t.setBtn(setNumber)}</span>
                <span className="min-w-0 truncate font-mono text-zinc-400">{result}</span>
              </p>
              {last && (
                <p data-last-time className="mt-0.5 flex items-center gap-1 text-[11px] leading-4 text-zinc-500 min-w-0">
                  <span className="min-w-0 truncate">
                    {t.lastTimeLine(setIndex === firstLastTimeIndex ? lastTime?.date ?? null : null, setResultText(last.weight, last.reps, weightUnit, t))}
                  </span>
                  {last.tag === 'max' ? (
                    <span className="shrink-0 flex items-center gap-0.5 font-bold text-amber-300">
                      <span aria-hidden="true" className="text-zinc-500 font-normal">·</span>
                      <Flag aria-hidden="true" className="w-3 h-3" />
                      {t.tagNames.max}
                    </span>
                  ) : (
                    last.tag && <span className="shrink-0">· {t.tagNames[last.tag]}</span>
                  )}
                </p>
              )}
              {ticked ? (
                <div role="group" aria-label={t.setBtn(setNumber)} className="mt-1 grid grid-cols-4 gap-1.5">
                  {TAG_ORDER.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onSetTag(setIndex, tag)}
                      aria-pressed={current === tag}
                      data-tag-choice={tag}
                      className={`h-11 min-w-0 px-1 rounded-full border-2 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${current === tag ? tagFilled[tag] : tagOutline[tag]}`}
                    >
                      {tag === 'max' && <Flag aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{t.tagNames[tag]}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onSetTag(setIndex, null)}
                    aria-pressed={current === undefined}
                    data-tag-choice="none"
                    className={`h-11 min-w-0 px-1 rounded-full border-2 text-xs font-bold cursor-pointer ${
                      current === undefined ? 'border-zinc-500 bg-zinc-700 text-white' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <span className="block truncate">{t.tagNone}</span>
                  </button>
                </div>
              ) : (
                <p data-tag-not-ticked className="mt-1 h-11 flex items-center justify-center rounded-full border border-dashed border-zinc-700 text-xs text-zinc-500">
                  {t.tagSheetNotTicked}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onClose}
        data-tag-sheet-done
        className="mt-4 w-full min-h-[44px] px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-extrabold cursor-pointer"
      >
        {t.tagSheetDone}
      </button>
    </BottomSheet>
  );
};
