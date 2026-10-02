import React, { useEffect, useRef, useState } from 'react';
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
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const [edgeFades, setEdgeFades] = useState({ left: false, right: false });

  // Fade an edge when more tabs are hidden behind it, so it is clear the strip scrolls sideways
  const updateEdgeFades = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const left = scroller.scrollLeft > 1;
    const right = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
    setEdgeFades((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(updateEdgeFades);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  // Keep the active tab fully in view by scrolling the tab strip only (never the page)
  useEffect(() => {
    const scroller = scrollerRef.current;
    const tab = activeTabRef.current;
    if (scroller && tab) {
      const margin = 32; // room for the edge fade
      const tabLeft = tab.offsetLeft;
      const tabRight = tabLeft + tab.offsetWidth;
      if (tabLeft - margin < scroller.scrollLeft) {
        scroller.scrollTo({ left: tabLeft - margin, behavior: 'smooth' });
      } else if (tabRight + margin > scroller.scrollLeft + scroller.clientWidth) {
        scroller.scrollTo({ left: tabRight + margin - scroller.clientWidth, behavior: 'smooth' });
      }
    }
    updateEdgeFades();
  }, [activeDayId, lang]);

  return (
    <nav className="w-full bg-[#09090b] border-b border-[#18181b] py-0.5 sticky top-[var(--header-height,53px)] z-30 backdrop-blur-md bg-opacity-95">
      <div className="relative max-w-4xl mx-auto">
        <div ref={scrollerRef} onScroll={updateEdgeFades} className="relative flex gap-2 overflow-x-auto no-scrollbar px-3 sm:px-4 py-0.5">
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
                ref={isActive ? activeTabRef : undefined}
                onClick={() => onSelectDay(day.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`shrink-0 min-h-10 flex flex-col items-start px-3 py-1 rounded-xl border text-left transition-all duration-200 cursor-pointer relative group ${
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
                    className={`text-xs leading-4 font-extrabold uppercase tracking-wider px-1.5 rounded ${
                      isActive
                        ? 'bg-emerald-500 text-black'
                        : isDayDone
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    Day {day.dayNumber}
                  </span>
                  <span className="text-xs leading-4 text-zinc-400 font-medium ml-auto">
                    {day.exercises.length} {lang === 'zh' ? '项' : 'Ex'}
                  </span>
                </div>

                <div className="mt-0.5 font-bold text-sm leading-5 text-white tracking-tight whitespace-nowrap flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
                  {title}
                  {isDayDone && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />}
                </div>

                {/* Focus line only on wider screens; phones get a compact 2-line tab */}
                <div className="hidden sm:block mt-0.5 text-xs text-zinc-400 truncate max-w-[160px]">{focus}</div>
              </button>
            );
          })}
        </div>

        {/* Edge fades (decorative) */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#09090b] to-transparent transition-opacity ${
            edgeFades.left ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#09090b] to-transparent transition-opacity ${
            edgeFades.right ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </nav>
  );
};
