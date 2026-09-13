import React from 'react';
import { EnrichedWorkoutDay } from '../types/workout';
import { Language, dayTranslationsZh } from '../data/translations';

interface DayNavigationProps {
  days: EnrichedWorkoutDay[];
  activeDayId: string;
  lang: Language;
  onSelectDay: (dayId: string) => void;
  dayCompletionStats: Record<string, { completed: number; total: number }>;
}

export const DayNavigation: React.FC<DayNavigationProps> = ({
  days,
  activeDayId,
  lang,
  onSelectDay,
  dayCompletionStats,
}) => {
  return (
    <nav className="w-full bg-[#09090b] border-b border-[#18181b] py-3 sticky top-[125px] sm:top-[129px] z-30 backdrop-blur-md bg-opacity-95">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5 scroll-smooth">
          {days.map((day) => {
            const isActive = day.id === activeDayId;
            const stats = dayCompletionStats[day.id] || { completed: 0, total: day.exercises.length * 3 };
            const isDayDone = stats.total > 0 && stats.completed === stats.total;

            const zhTranslation = dayTranslationsZh[day.id];
            const title = lang === 'zh' && zhTranslation ? zhTranslation.title : day.title;
            const focus = lang === 'zh' && zhTranslation ? zhTranslation.focus : day.focus;

            return (
              <button
                key={day.id}
                onClick={() => onSelectDay(day.id)}
                className={`flex-shrink-0 flex flex-col items-start px-4 py-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer relative group ${
                  isActive
                    ? 'bg-gradient-to-br from-[#16161a] to-[#1a1a20] border-emerald-500/60 shadow-lg shadow-emerald-950/30'
                    : 'bg-[#121215]/80 border-[#27272a]/60 hover:bg-[#18181c] hover:border-zinc-700'
                }`}
              >
                {/* Active Top Glow Line */}
                {isActive && (
                  <div className="absolute -top-[1px] left-3 right-3 h-[2px] bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" />
                )}

                <div className="flex items-center gap-2 w-full">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-emerald-500 text-black'
                        : isDayDone
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    Day {day.dayNumber}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium ml-auto">
                    {day.exercises.length} {lang === 'zh' ? '项' : 'Ex'}
                  </span>
                </div>

                <div className="mt-1 font-bold text-sm text-white tracking-tight flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
                  {title}
                  {isDayDone && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
                </div>

                <div className="mt-0.5 text-[11px] text-zinc-400 truncate max-w-[140px]">
                  {focus}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
