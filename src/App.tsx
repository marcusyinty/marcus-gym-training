import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { getEnrichedWorkoutProgram, workoutProgram } from './data/workoutProgram';
import { uiTranslations, dayTranslationsZh } from './data/translations';
import { HeaderBanner } from './components/HeaderBanner';
import { DayNavigation } from './components/DayNavigation';
import { ExerciseCard } from './components/ExerciseCard';
import { VideoModal } from './components/VideoModal';
import { AboutModal } from './components/AboutModal';
import { ProgramNotice } from './components/ProgramNotice';
import { RestTimerBar } from './components/RestTimerBar';
import { WeeklyReportModal } from './components/WeeklyReportModal';
import { HistoryModal } from './components/HistoryModal';
import { BodyModal } from './components/BodyModal';
import { SwapSheet } from './components/SwapSheet';
import { alternativesForSlot, performedExercise, performedExerciseIdIn, performedExerciseName } from './lib/exerciseVariants';
import { exerciseIdForSlotId } from './lib/exerciseIds';
import { swapOptions } from './lib/store/swap';
import type { RemarkResult, SwapResult } from './lib/store/appDataStore';
import { RemarkSheet } from './components/RemarkSheet';
import { TagSheet } from './components/TagSheet';
import { TagPrompt } from './components/TagPrompt';
import type { SetTag } from './lib/store/reducer';
import { parseSetsCount } from './utils/parseSetsCount';
import { usePersistentState } from './hooks/usePersistentState';
import { useAppData } from './hooks/useAppData';
import { languageItem, restSoundItem, weightUnitItem } from './lib/savedData';
import { addRestTime, RestCountdown, restSecondsForReps, startRestCountdown } from './lib/restTime';
import { unlockRestSound } from './lib/restAlert';
import { completedIndexes, cycleProgress, previousBest, remarkForSlot, setDetails, setTags, tickedSetCount } from './lib/store/selectors';
import { shouldAutoOpenReport } from './lib/store/reportAutoOpen';
import { currentWeekNumber, formatShortDay } from './lib/weeks';
import { lastTimeFor } from './lib/lastTime';
import { useMediaQuery } from './hooks/useMediaQuery';
import { Trophy, Sparkles, Flame, ChevronDown, AlertTriangle, RefreshCw, X } from 'lucide-react';

const enrichedDays = getEnrichedWorkoutProgram(workoutProgram);

export const App: React.FC = () => {
  // Settings, each saved under its own key (see src/lib/savedData.ts)
  const [lang, setLang] = usePersistentState(languageItem);
  const [weightUnit, setWeightUnit] = usePersistentState(weightUnitItem);
  const [restSound, setRestSound] = usePersistentState(restSoundItem);
  // Workout data: one AppDataV3 object saved under the v3 key. The old v2 keys are only read once, to migrate.
  const { data: appData, savingDisabled, replacedCount, droppedChangeCount, dispatch, restore, startNewWeek, swapExercise, setRemark, saveBodyEntry, deleteBodyEntry, setHeight } = useAppData();
  // A short notice when another tab's newer save replaced something here (see appDataStore)
  // droppedChange: an unsaved change here lost; weekStartedElsewhere: Start new week happened there first;
  // updated: a swap or note found newer data from another tab (shown now)
  const [tabNotice, setTabNotice] = useState<'droppedChange' | 'weekStartedElsewhere' | 'updated' | null>(null);
  // The slot whose exercise chooser is open, or null
  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);
  // The slot whose note editor is open, or null
  const [remarkSlotId, setRemarkSlotId] = useState<string | null>(null);
  // The slot whose tag sheet ("how did each set feel?") is open, or null
  const [tagSlotId, setTagSlotId] = useState<string | null>(null);
  // The newest ticked set, asked about in the tag prompt above the rest timer (in memory only, like the timer).
  // One at a time: the next tick replaces it. It stays (also after the rest ends or is skipped) until a tag is
  // tapped, it is dismissed, or the set is no longer ticked or already has a tag.
  const [tagPrompt, setTagPrompt] = useState<{ slotId: string; setIndex: number } | null>(null);

  const [activeDayId, setActiveDayId] = useState<string>('day-1');
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  // Body measurements (opened from the notice row or About → Your data)
  const [isBodyOpen, setIsBodyOpen] = useState<boolean>(false);
  // The archived week whose report is open (index in archivedCycles), or null
  const [pastWeekIndex, setPastWeekIndex] = useState<number | null>(null);
  const [isWeeklyReportOpen, setIsWeeklyReportOpen] = useState<boolean>(false);
  const [isDayDescExpanded, setIsDayDescExpanded] = useState<boolean>(false);
  // Rest timer between sets: kept in memory only (a reload loses it); `id` gives every new rest its own bar
  const [restTimer, setRestTimer] = useState<(RestCountdown & { id: number }) | null>(null);
  const restTimerIdRef = useRef(0);
  // Phones (below md) get a compact Day card; md and wider keep the original one
  const isWide = useMediaQuery('(min-width: 768px)');

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
  // Another day starts with its description closed (it doesn't carry over from the previous day)
  const selectDay = (dayId: string) => {
    setActiveDayId(dayId);
    setIsDayDescExpanded(false);
  };
  const t = uiTranslations[lang];

  const zhDayTrans = dayTranslationsZh[activeDay.id];
  const activeDayTitle = lang === 'zh' && zhDayTrans ? zhDayTrans.title : activeDay.title;
  const activeDayDesc = lang === 'zh' && zhDayTrans ? zhDayTrans.description : activeDay.description;

  // Session & day statistics (counted exactly as before, see cycleProgress)
  const progress = cycleProgress(appData, enrichedDays);
  const dayStats = progress.perDay;
  const totalProgramSets = progress.totalSets;
  const totalCompletedSets = progress.completedSets;

  // Auto-open the weekly report once per week: only when the week goes from incomplete to complete during
  // this session and its report was not shown before (saved in reportShownCycleIds). The refs start from
  // the loaded data, so a page load never counts as a change; data replaced as a whole (restored backup,
  // another tab's save) never opens it either.
  const isWeekComplete = totalProgramSets > 0 && totalCompletedSets === totalProgramSets;
  const wasWeekCompleteRef = useRef(isWeekComplete);
  const lastReplacedCountRef = useRef(replacedCount);
  const currentCycleId = appData.currentCycle.id;
  const isReportAlreadyShown = appData.reportShownCycleIds.includes(currentCycleId);

  useEffect(() => {
    const open = shouldAutoOpenReport({
      wasComplete: wasWeekCompleteRef.current,
      isComplete: isWeekComplete,
      alreadyShown: isReportAlreadyShown,
      dataReplaced: replacedCount !== lastReplacedCountRef.current,
    });
    if (open) {
      setIsWeeklyReportOpen(true);
      dispatch({ type: 'markReportShown', cycleId: currentCycleId });
    }
    wasWeekCompleteRef.current = isWeekComplete;
    lastReplacedCountRef.current = replacedCount;
  }, [isWeekComplete, replacedCount]);

  // An unsaved change here lost to another tab's newer save: say so instead of letting it vanish silently
  const lastDroppedCountRef = useRef(droppedChangeCount);
  useEffect(() => {
    if (droppedChangeCount !== lastDroppedCountRef.current) setTabNotice('droppedChange');
    lastDroppedCountRef.current = droppedChangeCount;
  }, [droppedChangeCount]);

  // The notice goes away by itself after a while (or with its close button)
  useEffect(() => {
    if (!tabNotice) return;
    const timer = setTimeout(() => setTabNotice(null), 12000);
    return () => clearTimeout(timer);
  }, [tabNotice]);

  // Handler: Toggle set completion
  // Starts the rest after a tick. Only the user's tap reaches this, so loading, other-tab sync and
  // unticking never start it.
  const startRestAfterTick = (exerciseId: string, setIndex: number) => {
    // The tap that completes the whole day needs no rest: stop a running timer instead
    const completesDay = activeDay.exercises.every((ex) => {
      const done = new Set(completedIndexes(appData, ex.id));
      if (ex.id === exerciseId) done.add(setIndex);
      return done.size >= parseSetsCount(ex.sets);
    });
    if (completesDay) {
      setRestTimer(null);
      return;
    }
    const exercise = activeDay.exercises.find((ex) => ex.id === exerciseId);
    // Creating/resuming the audio inside this tap lets mobile browsers play the beep later
    if (restSound === 'on') unlockRestSound();
    restTimerIdRef.current += 1;
    setRestTimer({ id: restTimerIdRef.current, ...startRestCountdown(restSecondsForReps(exercise?.reps ?? ''), Date.now()) });
  };

  // Handlers: each change goes through the store's reducer (src/lib/store/reducer.ts), which also
  // updates "previous best". A new weight is saved in the current unit; editing only reps keeps the
  // set's stored weight and unit.
  const handleToggleSet = (exerciseId: string, setIndex: number) => {
    const wasDone = completedIndexes(appData, exerciseId).includes(setIndex);
    dispatch({ type: 'toggleSet', slotId: exerciseId, setIndex, unit: weightUnit });
    // Rest timer: only when this tap turns a not-done set into a done one
    if (!wasDone) startRestAfterTick(exerciseId, setIndex);
    // The tag prompt moves to the set just ticked; unticking the asked-about set closes it
    if (!wasDone) setTagPrompt({ slotId: exerciseId, setIndex });
    else if (tagPrompt?.slotId === exerciseId && tagPrompt.setIndex === setIndex) setTagPrompt(null);
  };

  // How a ticked set felt (Easy / Good / Max, or null to clear): saved like a tick, never touches the timer
  const handleSetTag = (slotId: string, setIndex: number, tag: SetTag | null) => dispatch({ type: 'setTag', slotId, setIndex, tag });

  const handleUpdateWeight = (exerciseId: string, setIndex: number, weight: string) =>
    dispatch({ type: 'editWeight', slotId: exerciseId, setIndex, weight, unit: weightUnit });

  const handleUpdateReps = (exerciseId: string, setIndex: number, reps: string) =>
    dispatch({ type: 'editReps', slotId: exerciseId, setIndex, reps, unit: weightUnit });

  // Reset the active day / all 5 days: current week only, bests stay (as before). Tags go with the sets.
  const handleResetActiveDay = () => {
    const slotIds = activeDay.exercises.map((ex) => ex.id);
    dispatch({ type: 'resetDay', slotIds });
    if (tagPrompt && slotIds.includes(tagPrompt.slotId)) setTagPrompt(null);
  };

  const handleResetAll = () => {
    dispatch({ type: 'resetAll' });
    setTagPrompt(null);
  };

  // Start new week (from the weekly report): archive this week, then a fresh Day 1 with no rest running.
  // Only for the week on screen; if another tab already started a new week, that one is shown instead.
  // The past week being viewed; gone if the history changed meanwhile (e.g. a restore in another tab)
  const pastWeek = pastWeekIndex !== null ? appData.archivedCycles[pastWeekIndex] ?? null : null;

  const startNewWeekAvailability = savingDisabled ? 'savingOff' : tickedSetCount(appData.currentCycle) === 0 ? 'empty' : 'ready';
  // Swap (the exercise chooser): saved right away by the store, which also checks the rule again on the
  // newest data. If another tab changed things meanwhile, the newest data is shown with a notice.
  const swapSlot = swapSlotId ? activeDay.exercises.find((exercise) => exercise.id === swapSlotId) ?? null : null;

  // Notes belong to the exercise actually done in the slot (Day 2 and Day 5 Leg Press share one; a
  // swapped-in alternative has its own). Saved right away; another tab's newer data is kept (notice).
  const remarkSlot = remarkSlotId ? activeDay.exercises.find((exercise) => exercise.id === remarkSlotId) ?? null : null;
  const remarkExercise = remarkSlot ? performedExercise(remarkSlot, performedExerciseIdIn(appData.currentCycle, remarkSlot.id)) : null;
  const handleSaveRemark = (text: string): RemarkResult => {
    if (!remarkExercise) return { ok: false, reason: 'unknownExercise', updatedFromOtherTab: false };
    const result = setRemark(remarkExercise.performedExerciseId, text);
    if (result.updatedFromOtherTab) setTabNotice('updated');
    return result;
  };
  const handleSwap = (to: string): SwapResult => {
    if (!swapSlot) return { ok: false, reason: 'notAllowed', updatedFromOtherTab: false };
    const from = swapOptions(appData, swapSlot.id).current;
    const result = swapExercise({ cycleId: appData.currentCycle.id, slotId: swapSlot.id, from, to });
    const otherTab = result.updatedFromOtherTab || (!result.ok && (result.reason === 'weekChanged' || result.reason === 'changedElsewhere'));
    if (otherTab) setTabNotice('updated');
    return result;
  };

  const handleStartNewWeek = () => {
    const result = startNewWeek(appData.currentCycle.id);
    if (result.ok || result.reason === 'alreadyStarted') {
      setIsWeeklyReportOpen(false);
      selectDay(enrichedDays[0].id);
      setRestTimer(null);
      setTagPrompt(null);
      if (!result.ok) setTabNotice('weekStartedElsewhere');
    }
    return result;
  };

  // "Last time" for a slot: the newest past week its exercise was done, weights in the current unit
  const lastTimeOf = (slotId: string) => {
    const found = lastTimeFor(appData, slotId, weightUnit);
    return found ? { date: formatShortDay(found.date, lang), sets: found.sets } : undefined;
  };

  // Tags: the sheet for one slot of the active day, and the prompt for the newest ticked set (any day)
  const tagSlot = tagSlotId ? activeDay.exercises.find((exercise) => exercise.id === tagSlotId) ?? null : null;
  const promptSlot = tagPrompt ? enrichedDays.flatMap((day) => day.exercises).find((exercise) => exercise.id === tagPrompt.slotId) ?? null : null;
  const showTagPrompt =
    tagPrompt !== null &&
    promptSlot !== null &&
    completedIndexes(appData, tagPrompt.slotId).includes(tagPrompt.setIndex) &&
    setTags(appData, tagPrompt.slotId)[tagPrompt.setIndex] === undefined;

  // The fixed bottom dock (tag prompt above the rest timer): the page gets as much room at the bottom as it
  // takes, so nothing stays hidden behind it (just the timer: 80px, as before)
  const showDock = restTimer !== null || showTagPrompt;
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [dockHeight, setDockHeight] = useState(0);
  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock) {
      setDockHeight(0);
      return;
    }
    const update = () => setDockHeight(Math.round(dock.getBoundingClientRect().height));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [showDock]);

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
    <div
      className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col font-sans"
      style={showDock && dockHeight > 0 ? { paddingBottom: dockHeight } : undefined}
    >
      {/* Header Banner */}
      <HeaderBanner
        lang={lang}
        onToggleLanguage={setLang}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenWeeklyReport={() => setIsWeeklyReportOpen(true)}
        completedSetsCount={totalCompletedSets}
        totalSetsCount={totalProgramSets}
        activeDayTitle={activeDayTitle}
      />

      {/* Day Navigation Tabs */}
      <DayNavigation
        days={enrichedDays}
        activeDayId={activeDayId}
        lang={lang}
        onSelectDay={selectDay}
        dayCompletionStats={dayStats}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto px-4 pt-3 pb-6 md:pt-6 w-full">
        {/* Saved workouts could not be read: the app runs in memory and saves nothing this session
            (until a backup is restored) */}
        {savingDisabled && (
          <div
            role="status"
            className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-200"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>{t.storageErrorBanner}</span>
          </div>
        )}

        {/* Another tab's newer save replaced something here (a dropped change, or a week started there) */}
        {tabNotice && (
          <div
            role="status"
            data-tab-notice
            className="mb-3 flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 pl-3 text-xs leading-snug text-sky-100"
          >
            <RefreshCw className="w-4 h-4 shrink-0 text-sky-300" />
            <span className="flex-1 py-2">
              {tabNotice === 'droppedChange' ? t.updatedFromOtherTab : tabNotice === 'weekStartedElsewhere' ? t.weekStartedElsewhere : t.updatedFromOtherTabNeutral}
            </span>
            <button
              type="button"
              onClick={() => setTabNotice(null)}
              aria-label={t.dismissNotice}
              className="w-11 h-11 shrink-0 flex items-center justify-center text-sky-200 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Beginner notice + Reset (scrolls away with the page) */}
        <ProgramNotice lang={lang} onResetActiveDay={handleResetActiveDay} onResetAll={handleResetAll} onOpenBody={() => setIsBodyOpen(true)} />

        {/* Active Day Header */}
        {isWide ? (
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
        ) : (
          /* Compact Day card (phones): same numbers as above, about 90px tall */
          <div className="mb-3 bg-[#121215] border border-[#27272a] rounded-2xl px-3 py-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs leading-4 font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 rounded border border-emerald-500/20 whitespace-nowrap">
                    {t.dayPill(activeDay.dayNumber)}
                  </span>
                  <span className="text-xs leading-4 text-zinc-400 font-medium whitespace-nowrap">
                    {t.exerciseCount(activeDay.exercises.length)}
                  </span>
                </div>
                <h2 className="mt-0.5 text-lg leading-6 font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans'] line-clamp-2">
                  {activeDayTitle}
                </h2>
              </div>

              {/* Day Progress */}
              <div className="shrink-0 flex items-center gap-2">
                <div className="text-right leading-none">
                  <span className="block text-sm font-extrabold text-white font-mono whitespace-nowrap">
                    {activeDayStats.completed} / {activeDayStats.total}
                  </span>
                  <span className="block mt-1 text-xs font-bold uppercase text-zinc-400">{t.sets}</span>
                </div>
                {isCurrentDayComplete ? (
                  <div className="w-7 h-7 rounded-lg bg-emerald-500 text-black flex items-center justify-center">
                    <Trophy className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Description: 1 line, tap to show all. Padding + negative margin give a 44px tap area without a taller card */}
            <button
              onClick={() => setIsDayDescExpanded((expanded) => !expanded)}
              aria-expanded={isDayDescExpanded}
              className="relative w-full -mt-3 pt-3.5 -mb-3.5 pb-3.5 flex items-start gap-1.5 text-left cursor-pointer"
            >
              <span className={`flex-1 min-w-0 text-xs leading-4 text-zinc-300 ${isDayDescExpanded ? 'block' : 'line-clamp-1'}`}>
                {activeDayDesc}
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 text-zinc-400 transition-transform ${isDayDescExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Completed / total sets of this day */}
            <div
              role="progressbar"
              aria-label={t.dayProgress}
              aria-valuemin={0}
              aria-valuemax={activeDayStats.total}
              aria-valuenow={activeDayStats.completed}
              className="relative mt-1.5 h-1.5 rounded-full bg-zinc-800 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-[width] duration-300"
                style={{ width: `${activeDayStats.total > 0 ? (activeDayStats.completed / activeDayStats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Exercise List Cards */}
        <div className="space-y-6">
          {activeDay.exercises.map((exercise, idx) => (
            <ExerciseCard
              key={exercise.id}
              exercise={performedExercise(exercise, performedExerciseIdIn(appData.currentCycle, exercise.id))}
              remark={{ text: remarkForSlot(appData, exercise.id), onEdit: () => setRemarkSlotId(exercise.id) }}
              tags={{ bySet: setTags(appData, exercise.id), onOpen: () => setTagSlotId(exercise.id) }}
              lastTime={lastTimeOf(exercise.id)}
              swap={
                alternativesForSlot(exercise.id).length > 0
                  ? { isSwapped: performedExerciseIdIn(appData.currentCycle, exercise.id) !== exerciseIdForSlotId(exercise.id), onOpen: () => setSwapSlotId(exercise.id) }
                  : undefined
              }
              index={idx}
              lang={lang}
              completedSetIndexes={completedIndexes(appData, exercise.id)}
              setDetails={setDetails(appData, exercise.id)}
              previousBest={previousBest(appData, exercise.id)}
              weightUnit={weightUnit}
              onChangeWeightUnit={setWeightUnit}
              onToggleSet={handleToggleSet}
              onUpdateWeight={handleUpdateWeight}
              onUpdateReps={handleUpdateReps}
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
          {/* Text links: padding + negative margin give a 44px tap area without a taller footer */}
          <div className="flex items-center gap-4 mt-1">
            <button
              onClick={() => setIsAboutOpen(true)}
              className="py-3.5 -my-3.5 text-emerald-400 hover:underline font-semibold cursor-pointer"
            >
              {t.aboutTitle}
            </button>
            <span className="text-zinc-700">•</span>
            <button
              onClick={() => setIsWeeklyReportOpen(true)}
              className="py-3.5 -my-3.5 text-cyan-400 hover:underline font-semibold cursor-pointer"
            >
              {t.weeklyReportBtn}
            </button>
          </div>
        </div>
      </footer>

      {/* Bottom dock: the tag prompt on its own line above the rest timer bar. z-45, above the header (z-40)
          and the small sheets (z-42, which sit above it), below the dialogs (z-50) */}
      {showDock && (
        <div ref={dockRef} data-rest-bar className="fixed inset-x-0 bottom-0 z-[45] pb-[env(safe-area-inset-bottom)] pointer-events-none">
          {showTagPrompt && tagPrompt && promptSlot && (
            <TagPrompt
              lang={lang}
              setNumber={tagPrompt.setIndex + 1}
              exerciseName={performedExerciseName(promptSlot, performedExerciseIdIn(appData.currentCycle, promptSlot.id), lang)}
              hasTimerBelow={restTimer !== null}
              onTag={(tag) => {
                handleSetTag(tagPrompt.slotId, tagPrompt.setIndex, tag);
                setTagPrompt(null);
              }}
              onDismiss={() => setTagPrompt(null)}
            />
          )}
          {restTimer && (
            <RestTimerBar
              key={restTimer.id}
              lang={lang}
              countdown={restTimer}
              soundOn={restSound === 'on'}
              onToggleSound={() => {
                if (restSound === 'off') unlockRestSound();
                setRestSound(restSound === 'on' ? 'off' : 'on');
              }}
              onAddTime={() => setRestTimer((timer) => timer && { ...timer, ...addRestTime(timer, Date.now(), 15) })}
              onClose={() => setRestTimer(null)}
            />
          )}
        </div>
      )}

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
        data={appData}
        savingDisabled={savingDisabled}
        onRestore={restore}
        onOpenBody={() => {
          setIsAboutOpen(false);
          setIsBodyOpen(true);
        }}
        onOpenHistory={() => {
          setIsAboutOpen(false);
          setIsHistoryOpen(true);
        }}
      />

      {/* Body measurements: saved right away on the newest data (newer data from another tab: the notice) */}
      <BodyModal
        isOpen={isBodyOpen}
        lang={lang}
        data={appData}
        weightUnit={weightUnit}
        onSaveEntry={saveBodyEntry}
        onDeleteEntry={deleteBodyEntry}
        onSetHeight={(text) => setHeight(text, weightUnit)}
        onUpdatedFromOtherTab={() => setTabNotice('updated')}
        onClose={() => setIsBodyOpen(false)}
      />

      {/* Past weeks (opened from About → Your data) */}
      <HistoryModal
        isOpen={isHistoryOpen}
        lang={lang}
        data={appData}
        days={enrichedDays}
        weightUnit={weightUnit}
        savingDisabled={savingDisabled}
        onOpenWeek={setPastWeekIndex}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Weekly Report Summary Modal with Load/Volume Breakdown & PNG Export */}
      <WeeklyReportModal
        isOpen={isWeeklyReportOpen}
        lang={lang}
        days={enrichedDays}
        cycle={appData.currentCycle}
        weekNumber={currentWeekNumber(appData)}
        weightUnit={weightUnit}
        startNewWeek={{ availability: startNewWeekAvailability, onConfirm: handleStartNewWeek }}
        onClose={() => setIsWeeklyReportOpen(false)}
      />

      {/* Note editor for the exercise actually done in one slot */}
      {remarkSlot && remarkExercise && (
        <RemarkSheet
          open
          lang={lang}
          exerciseName={performedExerciseName(remarkSlot, remarkExercise.performedExerciseId, lang)}
          initialText={remarkForSlot(appData, remarkSlot.id)}
          onSave={handleSaveRemark}
          onClose={() => setRemarkSlotId(null)}
        />
      )}

      {/* How each set of one exercise felt (from the card's tag button) */}
      {tagSlot && (
        <TagSheet
          open
          lang={lang}
          exerciseName={performedExerciseName(tagSlot, performedExerciseIdIn(appData.currentCycle, tagSlot.id), lang)}
          totalSets={parseSetsCount(tagSlot.sets)}
          completedSetIndexes={completedIndexes(appData, tagSlot.id)}
          setDetails={setDetails(appData, tagSlot.id)}
          tags={setTags(appData, tagSlot.id)}
          lastTime={lastTimeOf(tagSlot.id)}
          weightUnit={weightUnit}
          onSetTag={(setIndex, tag) => handleSetTag(tagSlot.id, setIndex, tag)}
          onClose={() => setTagSlotId(null)}
        />
      )}

      {/* Exercise chooser for one slot (only slots with an alternative have a swap button) */}
      {swapSlot && (
        <SwapSheet
          open
          lang={lang}
          slot={swapSlot}
          options={swapOptions(appData, swapSlot.id)}
          onSwap={handleSwap}
          onClose={() => setSwapSlotId(null)}
        />
      )}

      {/* A past week's report, read-only, on top of the history list (closing it goes back to the list) */}
      {pastWeek && (
        <WeeklyReportModal
          isOpen
          lang={lang}
          days={enrichedDays}
          cycle={pastWeek}
          weekNumber={(pastWeekIndex ?? 0) + 1}
          weightUnit={weightUnit}
          startNewWeek={{ availability: 'pastWeek', onConfirm: () => ({ ok: false, reason: 'savingOff' }) }}
          onClose={() => setPastWeekIndex(null)}
        />
      )}
    </div>
  );
};

export default App;
