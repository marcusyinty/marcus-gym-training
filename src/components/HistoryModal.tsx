import React from 'react';
import { Language, uiTranslations } from '../data/translations';
import { AppDataV3 } from '../lib/model';
import { ProgramDay } from '../lib/store/selectors';
import { WeightUnit } from '../lib/units';
import { buildWeeklyReport } from '../lib/weeklyReport';
import { formatDayRange, pastWeeks } from '../lib/weeks';
import { ChevronRight, History, X } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  lang: Language;
  data: AppDataV3;
  days: ProgramDay[];
  weightUnit: WeightUnit;
  // Saved data couldn't be read this session, so the list can't show the real history
  savingDisabled: boolean;
  // Index in data.archivedCycles of the week to open
  onOpenWeek: (index: number) => void;
  onClose: () => void;
}

// Past weeks, newest first. Each row shows the same numbers as that week's report (ticked sets, volume in
// the unit shown now) and opens it read-only.
export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, lang, data, days, weightUnit, savingDisabled, onOpenWeek, onClose }) => {
  if (!isOpen) return null;

  const t = uiTranslations[lang];
  const weeks = pastWeeks(data)
    .map((week, index) => ({ ...week, index }))
    .reverse();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl p-5 max-h-[90vh] flex flex-col">
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 shrink-0 mb-3 pr-12">
          <History className="w-5 h-5 text-emerald-400 shrink-0" />
          <h3 id="history-title" className="text-lg font-extrabold text-white font-['Plus_Jakarta_Sans']">
            {t.historyTitle}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar -mx-1 px-1">
          {savingDisabled ? (
            <p className="py-8 text-center text-xs text-amber-200 leading-relaxed">{t.historyUnreadable}</p>
          ) : weeks.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-bold text-white">{t.historyEmpty}</p>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{t.historyEmptyHint}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {weeks.map(({ cycle, number, index }) => {
                const report = buildWeeklyReport(cycle, days, weightUnit);
                const dates = formatDayRange(cycle.startedAt, cycle.endedAt, lang) ?? t.weekDatesUnknown;
                return (
                  <li key={`${index}-${cycle.id}`}>
                    <button
                      type="button"
                      onClick={() => onOpenWeek(index)}
                      data-history-row={number}
                      className="w-full min-h-[56px] px-3 py-2.5 flex items-center gap-3 rounded-xl bg-[#18181c] hover:bg-[#1f1f24] border border-[#27272a] text-left cursor-pointer"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-white">{t.weekLabel(number)}</span>
                        <span className="block text-xs text-zinc-400">{dates}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-semibold text-emerald-300">{t.historyRowSets(report.completedSets)}</span>
                        <span className="block text-xs font-mono text-zinc-300">
                          {report.totalVolume > 0 ? `${Math.round(report.totalVolume).toLocaleString()} ${weightUnit}` : '—'}
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 shrink-0 text-zinc-500" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 min-h-[44px] bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl cursor-pointer shrink-0"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
};
