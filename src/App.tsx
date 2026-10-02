import React, { useState, useEffect, useRef } from 'react';
import { getEnrichedWorkoutProgram, workoutProgram } from './data/workoutProgram';
import { uiTranslations, dayTranslationsZh } from './data/translations';
import { HeaderBanner } from './components/HeaderBanner';
import { DayNavigation } from './components/DayNavigation';
import { ExerciseCard } from './components/ExerciseCard';
import { VideoModal } from './components/VideoModal';
import { AboutModal } from './components/AboutModal';
import { WeeklyReportModal } from './components/WeeklyReportModal';
import { SetDetail } from './types/workout';
import { parseSetsCount } from './utils/parseSetsCount';
import { usePersistentState } from './hooks/usePersistentState';
import { completedSetsItem, languageItem, previousBestsItem, setDetailsItem } from './lib/savedData';
import { Trophy, Sparkles, Flame } from 'lucide-react';

const enrichedDays = getEnrichedWorkoutProgram(workoutProgram);

export const App: React.FC = () => {
  // Saved to localStorage (see src/lib/savedData.ts for keys and formats)
  const [lang, setLang] = usePersistentState(languageItem);
  const [completedSetsState, setCompletedSetsState] = usePersistentState(completedSetsItem);
  const [setDetailsState, setSetDetailsState] = usePersistentState(setDetailsItem);
  const [previousBestsState, setPreviousBestsState] = usePersistentState(previousBestsItem);

  const [activeDayId, setActiveDayId] = useState<string>('day-1');
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isWeeklyReportOpen, setIsWeeklyReportOpen] = useState<boolean>(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    videoUrl: string;
    posterUrl: string;
    title: string;
  }>({
    isOpen: false,
    videoUrl: '',
    posterUrl: '',
    title: '',
  });

  const activeDay = enrichedDays.find((d) => d.id === activeDayId) || enrichedDays[0];
  const t = uiTranslations[lang];

  const zhDayTrans = dayTranslationsZh[activeDay.id];
  const activeDayTitle = lang === 'zh' && zhDayTrans ? zhDayTrans.title : activeDay.title;
  const activeDayDesc = lang === 'zh' && zhDayTrans ? zhDayTrans.description : activeDay.description;

  // Calculate session & day statistics
  let totalProgramSets = 0;
  let totalCompletedSets = 0;
  let completedDaysCount = 0;

  const dayStats: Record<string, { completed: number; total: number }> = {};

  enrichedDays.forEach((day) => {
    let dayTotal = 0;
    let dayCompleted = 0;

    day.exercises.forEach((ex) => {
      const totalSets = parseSetsCount(ex.sets);
      const done = (completedSetsState[ex.id] || []).length;

      dayTotal += totalSets;
      dayCompleted += Math.min(done, totalSets);
    });

    dayStats[day.id] = { completed: dayCompleted, total: dayTotal };
    if (dayTotal > 0 && dayCompleted === dayTotal) {
      completedDaysCount += 1;
    }
    totalProgramSets += dayTotal;
    totalCompletedSets += dayCompleted;
  });

  // Auto-open weekly report at most once per session, only when the week goes from incomplete to complete.
  // Refs start from the data loaded on first render, so a page load never counts as a change.
  const isWeekComplete = totalProgramSets > 0 && totalCompletedSets === totalProgramSets;
  const wasWeekCompleteRef = useRef(isWeekComplete);
  const hasAutoOpenedReportRef = useRef(false);

  useEffect(() => {
    if (isWeekComplete && !wasWeekCompleteRef.current && !hasAutoOpenedReportRef.current) {
      hasAutoOpenedReportRef.current = true;
      setIsWeeklyReportOpen(true);
    }
    wasWeekCompleteRef.current = isWeekComplete;
  }, [isWeekComplete]);

  // Handler: Toggle set completion
  const handleToggleSet = (exerciseId: string, setIndex: number) => {
    setCompletedSetsState((prev) => {
      const currentSets = prev[exerciseId] || [];
      const isAlreadyCompleted = currentSets.includes(setIndex);

      let updated: number[];
      if (isAlreadyCompleted) {
        updated = currentSets.filter((i) => i !== setIndex);
      } else {
        updated = [...currentSets, setIndex].sort((a, b) => a - b);
      }

      return {
        ...prev,
        [exerciseId]: updated,
      };
    });
  };

  // Handler: Update set weight/reps details & auto-update previous best
  const handleUpdateSetDetail = (
    exerciseId: string,
    setIndex: number,
    weight: string,
    reps: string,
    unit: 'kg' | 'lbs'
  ) => {
    setSetDetailsState((prev) => {
      const exDetails = prev[exerciseId] || {};
      const updatedDetail: SetDetail = {
        setNumber: setIndex + 1,
        weight,
        reps,
        unit,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        [exerciseId]: {
          ...exDetails,
          [setIndex]: updatedDetail,
        },
      };
    });

    if (weight && reps) {
      setPreviousBestsState((prev) => {
        const existing = prev[exerciseId];
        const newWeightNum = parseFloat(weight) || 0;
        const existingWeightNum = existing ? parseFloat(existing.weight) || 0 : 0;

        if (!existing || newWeightNum >= existingWeightNum) {
          return {
            ...prev,
            [exerciseId]: { weight, reps, unit },
          };
        }
        return prev;
      });
    }
  };

  // Reset active day's progress
  const handleResetActiveDay = () => {
    setCompletedSetsState((prev) => {
      const updated = { ...prev };
      activeDay.exercises.forEach((ex) => {
        delete updated[ex.id];
      });
      return updated;
    });

    setSetDetailsState((prev) => {
      const updated = { ...prev };
      activeDay.exercises.forEach((ex) => {
        delete updated[ex.id];
      });
      return updated;
    });
  };

  // Full reset (All 5 days)
  const handleResetAll = () => {
    setCompletedSetsState({});
    setSetDetailsState({});
  };

  const handleOpenVideoModal = (videoUrl: string, posterUrl: string, title: string) => {
    setModalState({
      isOpen: true,
      videoUrl,
      posterUrl,
      title,
    });
  };

  const handleCloseVideoModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const activeDayStats = dayStats[activeDay.id] || { completed: 0, total: 15 };
  const isCurrentDayComplete = activeDayStats.total > 0 && activeDayStats.completed === activeDayStats.total;

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col font-sans">
      {/* Header Banner */}
      <HeaderBanner
        lang={lang}
        onToggleLanguage={setLang}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenWeeklyReport={() => setIsWeeklyReportOpen(true)}
        completedSetsCount={totalCompletedSets}
        totalSetsCount={totalProgramSets}
        activeDayTitle={activeDayTitle}
        onResetActiveDay={handleResetActiveDay}
        onResetAll={handleResetAll}
      />

      {/* Day Navigation Tabs */}
      <DayNavigation
        days={enrichedDays}
        activeDayId={activeDayId}
        lang={lang}
        onSelectDay={setActiveDayId}
        dayCompletionStats={dayStats}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full">
        {/* Active Day Header */}
        <div className="mb-6 bg-[#121215] border border-[#27272a] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                  {t.dayRoutineTitle(activeDay.dayNumber)}
                </span>
                <span className="text-xs text-zinc-400 font-medium">
                  {t.exercisesPrescribed(activeDay.exercises.length)}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans']">
                {activeDayTitle}
              </h2>
              <p className="text-sm text-zinc-300 mt-1">{activeDayDesc}</p>
            </div>

            {/* Day Progress Indicator */}
            <div className="shrink-0 bg-[#09090b] border border-[#27272a] p-3 rounded-xl flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">{t.dayProgress}</span>
                <span className="text-sm font-extrabold text-white font-mono">
                  {activeDayStats.completed} / {activeDayStats.total} {t.sets}
                </span>
              </div>
              {isCurrentDayComplete ? (
                <div className="w-9 h-9 rounded-lg bg-emerald-500 text-black flex items-center justify-center font-bold">
                  <Trophy className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-emerald-400" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Exercise List Cards */}
        <div className="space-y-6">
          {activeDay.exercises.map((exercise, idx) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              index={idx}
              lang={lang}
              completedSetIndexes={completedSetsState[exercise.id] || []}
              setDetails={setDetailsState[exercise.id] || {}}
              previousBest={previousBestsState[exercise.id]}
              onToggleSet={handleToggleSet}
              onUpdateSetDetail={handleUpdateSetDetail}
              onOpenVideoModal={handleOpenVideoModal}
            />
          ))}
        </div>

        {/* Day Completion Celebration Banner */}
        {isCurrentDayComplete && (
          <div className="mt-8 bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-cyan-950/40 border border-emerald-500/40 rounded-2xl p-6 text-center relative overflow-hidden">
            <Sparkles className="w-8 h-8 text-emerald-400 mx-auto mb-2 animate-bounce" />
            <h3 className="text-xl font-extrabold text-white font-['Plus_Jakarta_Sans']">
              {t.dayCompleteTitle(activeDay.dayNumber)}
            </h3>
            <p className="text-sm text-zinc-300 mt-1 max-w-md mx-auto">
              {t.dayCompleteText(activeDayTitle)}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#09090b] border-t border-[#18181b] py-6 mt-12 text-center text-xs text-zinc-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center gap-1.5">
          <p className="font-medium text-zinc-400">{t.footerTitle}</p>
          <p className="text-zinc-600">{t.footerSub}</p>
          <div className="flex items-center gap-4 mt-1">
            <button
              onClick={() => setIsAboutOpen(true)}
              className="text-emerald-400 hover:underline font-semibold cursor-pointer"
            >
              {t.aboutTitle}
            </button>
            <span className="text-zinc-700">•</span>
            <button
              onClick={() => setIsWeeklyReportOpen(true)}
              className="text-cyan-400 hover:underline font-semibold cursor-pointer"
            >
              {t.weeklyReportBtn}
            </button>
          </div>
        </div>
      </footer>

      {/* Fullscreen Video Modal */}
      <VideoModal
        isOpen={modalState.isOpen}
        videoUrl={modalState.videoUrl}
        posterUrl={modalState.posterUrl}
        title={modalState.title}
        onClose={handleCloseVideoModal}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        lang={lang}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* Weekly Report Summary Modal with Load/Volume Breakdown & PNG Export */}
      <WeeklyReportModal
        isOpen={isWeeklyReportOpen}
        lang={lang}
        days={enrichedDays}
        setDetailsState={setDetailsState}
        completedSetsCount={totalCompletedSets}
        totalSetsCount={totalProgramSets}
        completedDaysCount={completedDaysCount}
        totalDaysCount={enrichedDays.length}
        onClose={() => setIsWeeklyReportOpen(false)}
      />
    </div>
  );
};

export default App;
