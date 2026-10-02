import React, { useRef, useEffect, useState } from 'react';
import { EnrichedExercise, SetDetail } from '../types/workout';
import { Language, uiTranslations, exerciseTranslationsZh } from '../data/translations';
import { AnatomyMap } from './AnatomyMap';
import { displayWeight, WeightUnit } from '../lib/units';
import { parseSetsCount } from '../utils/parseSetsCount';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Play, Pause, Maximize2, Check, Sparkles, VolumeX, Target, Activity, Video, Award, ChevronDown, ChevronUp } from 'lucide-react';

interface ExerciseCardProps {
  exercise: EnrichedExercise;
  index: number;
  lang: Language;
  completedSetIndexes: number[];
  setDetails: Record<number, SetDetail>;
  previousBest?: { weight: string; reps: string; unit: 'kg' | 'lbs' };
  weightUnit: WeightUnit;
  onChangeWeightUnit: (unit: WeightUnit) => void;
  onToggleSet: (exerciseId: string, setIndex: number) => void;
  onUpdateWeight: (exerciseId: string, setIndex: number, weight: string) => void;
  onUpdateReps: (exerciseId: string, setIndex: number, reps: string) => void;
  onOpenVideoModal: (videoUrl: string, posterUrl: string, title: string) => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  index,
  lang,
  completedSetIndexes,
  setDetails,
  previousBest,
  weightUnit,
  onChangeWeightUnit,
  onToggleSet,
  onUpdateWeight,
  onUpdateReps,
  onOpenVideoModal,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'video' | 'anatomy'>('video');
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [isCueExpanded, setIsCueExpanded] = useState(false);
  const [isMuscleMapOpen, setIsMuscleMapOpen] = useState(false);

  // Phones (below md) get a compact card that never creates a <video>, so no video loads in the list.
  // md and wider keep the original side-by-side layout with the autoplaying video.
  const isWide = useMediaQuery('(min-width: 768px)');

  const t = uiTranslations[lang];
  const zhEx = exerciseTranslationsZh[exercise.id];

  const exerciseName = lang === 'zh' && zhEx ? zhEx.name : exercise.name;
  const primaryMuscles = lang === 'zh' && zhEx ? zhEx.primaryMuscles : exercise.primaryMuscles;
  const secondaryMuscles = lang === 'zh' && zhEx ? zhEx.secondaryMuscles : exercise.secondaryMuscles;
  const coachingCue = lang === 'zh' && zhEx ? zhEx.coachingCue : exercise.coachingCue;

  // Derive total sets count
  const totalSets = parseSetsCount(exercise.sets);

  // IntersectionObserver for video lazy playback
  useEffect(() => {
    const videoElem = videoRef.current;
    if (!videoElem) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && activeMediaTab === 'video') {
            videoElem.play().then(() => setIsPlaying(true)).catch(() => {});
          } else {
            videoElem.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.35 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [exercise.media?.videoUrl, activeMediaTab, isWide]);

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const media = exercise.media;

  // Number boxes in the set rows: 48px tall, 18px digits, desktop spinner arrows hidden
  const setInputClass =
    'w-full h-12 bg-[#18181c] border border-zinc-700 rounded-lg px-1 pt-0.5 pb-3.5 text-[18px] leading-none font-semibold tabular-nums text-white text-center placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
  // Keyboard helpers for the set rows: typing replaces the value; Enter goes weight -> reps -> keyboard closed
  const selectAllOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select();
  const moveToRepsOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.currentTarget.closest('[data-set-row]')?.querySelector<HTMLInputElement>('input[data-field="reps"]')?.focus();
  };
  const closeKeyboardOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.currentTarget.blur();
  };
  const setInputLabelClass =
    'pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs leading-none font-bold text-zinc-400';

  const prevBestText =
    previousBest && (previousBest.weight || previousBest.reps)
      ? t.prevBest(displayWeight(previousBest.weight, previousBest.unit, weightUnit) || '0', weightUnit, previousBest.reps || '0')
      : null;

  return (
    <div
      ref={containerRef}
      className="bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl hover:border-zinc-700 transition-all duration-300 group flex flex-col md:flex-row"
    >
      {/* Media / Visualizer Area (md and wider only) */}
      {isWide && (
      <div className="relative w-full md:w-[280px] lg:w-[320px] shrink-0 bg-[#09090b] flex flex-col">
        {/* Top Tab Selector for Video vs Anatomy */}
        <div className="flex items-center justify-between p-2 bg-[#0d0d10] border-b border-[#222227] z-10">
          <div className="flex items-center gap-1 bg-[#18181c] p-0.5 rounded-lg text-[11px] font-bold">
            <button
              onClick={() => setActiveMediaTab('video')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                activeMediaTab === 'video' ? 'bg-emerald-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Video className="w-3 h-3" /> {t.formDemoTab}
            </button>
            <button
              onClick={() => setActiveMediaTab('anatomy')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                activeMediaTab === 'anatomy' ? 'bg-emerald-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Activity className="w-3 h-3" /> {t.muscleMapTab}
            </button>
          </div>

          {media && activeMediaTab === 'video' && (
            <button
              onClick={() => onOpenVideoModal(media.videoUrl, media.posterUrl, exerciseName)}
              className="p-1 rounded-md bg-zinc-800 text-zinc-300 hover:bg-emerald-500 hover:text-black transition-colors"
              title="Fullscreen Form Demo"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Media Content Display */}
        <div className="relative aspect-[9/12] sm:aspect-video md:aspect-[9/12] w-full overflow-hidden flex items-center justify-center">
          {activeMediaTab === 'video' && media ? (
            <div className="relative w-full h-full group/video">
              <video
                ref={videoRef}
                src={media.videoUrl}
                poster={media.posterUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Video Overlay Controls */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-90 sm:opacity-0 group-hover/video:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded border border-emerald-500/30">
                    <VolumeX className="w-3 h-3" /> {t.mutedLoop}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={togglePlayPause}
                    className="p-2 rounded-full bg-emerald-500 text-black hover:scale-105 transition-transform font-bold"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>
                  <span className="text-[10px] text-zinc-300 font-medium bg-black/60 px-2 py-0.5 rounded backdrop-blur-md">
                    {media.duration ? `${media.duration.toFixed(1)}s` : 'HD Form'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full p-2 flex items-center justify-center bg-[#09090b]">
              <AnatomyMap
                primaryMuscles={exercise.primaryMuscleGroupIds || []}
                secondaryMuscles={exercise.secondaryMuscleGroupIds || []}
                size="md"
              />
            </div>
          )}
        </div>
      </div>
      )}

      {/* Content Details Area */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {isWide ? (
          <>
          {/* Header & Exercise Title */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-extrabold text-emerald-400 tracking-wider">
                  #{String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans']">
                  {exerciseName}
                </h3>
              </div>
            </div>

            {/* Target Volume Pill & Previous Best Badge */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-2 bg-[#1a1a20] border border-[#2e2e35] px-3 py-1.5 rounded-xl">
                <div className="text-center">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-semibold">{t.volumeLabel}</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
                    {exercise.sets} {t.sets} <span className="text-zinc-500">|</span> {exercise.reps} {t.reps}
                  </span>
                </div>
              </div>

              {prevBestText && (
                <div className="flex items-center gap-1 text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                  <Award className="w-3 h-3 text-cyan-400" />
                  <span>{prevBestText}</span>
                </div>
              )}
            </div>
          </div>

          {/* Muscle Target Badges */}
          <div className="flex flex-wrap items-center gap-1.5 my-3">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Target className="w-3 h-3 text-emerald-400" /> {t.targetsLabel}
            </span>
            {primaryMuscles.map((muscle) => (
              <span
                key={muscle}
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              >
                {muscle}
              </span>
            ))}
            {secondaryMuscles.map((muscle) => (
              <span
                key={muscle}
                className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/60"
              >
                {muscle}
              </span>
            ))}
          </div>

          {/* Coaching Cue Box */}
          <div className="mt-3 bg-[#0d0d10] border border-[#222227] rounded-xl p-3 relative overflow-hidden">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.coachingCueLabel}</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed italic font-sans">
              "{coachingCue}"
            </p>
          </div>
          </>
          ) : (
          <>
          {/* Compact header (phones): poster thumbnail + name, volume, primary muscles, previous best */}
          <div className="flex gap-3">
            {media ? (
              <button
                onClick={() => onOpenVideoModal(media.videoUrl, media.posterUrl, exerciseName)}
                aria-label={`${t.formDemoTab}: ${exerciseName}`}
                className="relative w-[72px] h-24 shrink-0 rounded-xl overflow-hidden border border-[#27272a] bg-[#09090b] cursor-pointer"
              >
                <img src={media.posterUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <span className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </span>
                </span>
              </button>
            ) : (
              <div
                aria-hidden="true"
                className="w-[72px] h-24 shrink-0 rounded-xl border border-[#27272a] bg-[#09090b] flex items-center justify-center text-zinc-400"
              >
                <Video className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1.5">
                <span className="text-xs leading-6 font-extrabold text-emerald-400 tracking-wider shrink-0">
                  #{String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-base leading-6 font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] line-clamp-2">
                  {exerciseName}
                </h3>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-black text-emerald-400 font-mono bg-[#1a1a20] border border-[#2e2e35] px-2 py-0.5 rounded-lg whitespace-nowrap">
                  {exercise.sets} {t.sets} <span className="text-zinc-500">|</span> {exercise.reps} {t.reps}
                </span>
                {primaryMuscles.map((muscle) => (
                  <span
                    key={muscle}
                    className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  >
                    {muscle}
                  </span>
                ))}
                {prevBestText && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                    <Award className="w-3 h-3 text-cyan-400" />
                    {prevBestText}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Coaching cue: 2 lines, tap to show all */}
          <button
            onClick={() => setIsCueExpanded((expanded) => !expanded)}
            aria-expanded={isCueExpanded}
            className="mt-3 w-full min-h-10 flex items-start gap-2 text-left bg-[#0d0d10] border border-[#222227] rounded-xl px-3 py-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span className={`flex-1 min-w-0 text-xs leading-snug text-zinc-300 ${isCueExpanded ? 'block' : 'line-clamp-2'}`}>
              <span className="font-bold text-emerald-400">{t.coachingCueLabel}</span>
              {' · '}
              <span className="italic">"{coachingCue}"</span>
            </span>
            <ChevronDown className={`w-4 h-4 shrink-0 text-zinc-400 transition-transform ${isCueExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Muscle map + secondary muscles, collapsed by default */}
          <button
            onClick={() => setIsMuscleMapOpen((open) => !open)}
            aria-expanded={isMuscleMapOpen}
            className="mt-2 w-full min-h-10 flex items-center gap-2 px-3 rounded-xl border border-[#222227] bg-[#0d0d10] text-xs font-bold text-zinc-300 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.muscleMapTab}</span>
            <ChevronDown className={`ml-auto w-4 h-4 text-zinc-400 transition-transform ${isMuscleMapOpen ? 'rotate-180' : ''}`} />
          </button>
          {isMuscleMapOpen && (
            <div className="mt-2 bg-[#09090b] border border-[#222227] rounded-xl p-3">
              <div className="flex justify-center">
                <AnatomyMap
                  primaryMuscles={exercise.primaryMuscleGroupIds || []}
                  secondaryMuscles={exercise.secondaryMuscleGroupIds || []}
                  size="md"
                  lang={lang}
                />
              </div>
              {secondaryMuscles.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {secondaryMuscles.map((muscle) => (
                    <span
                      key={muscle}
                      className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/60"
                    >
                      {muscle}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>

        {/* Client-Side Workout Tracker & Performance Logger */}
        <div className="mt-4 pt-3 border-t border-[#1f1f24] space-y-3">
          {/* Top Bar: Progress & Unit Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                {t.logSessionLabel(completedSetIndexes.length, totalSets)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* kg / lbs Unit Switcher */}
              <div className="flex items-center h-10 bg-[#18181c] ring-1 ring-zinc-800 rounded-lg overflow-hidden text-xs font-bold">
                <button
                  onClick={() => onChangeWeightUnit('kg')}
                  aria-pressed={weightUnit === 'kg'}
                  className={`h-10 min-w-10 px-2 cursor-pointer ${weightUnit === 'kg' ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white'}`}
                >
                  kg
                </button>
                <button
                  onClick={() => onChangeWeightUnit('lbs')}
                  aria-pressed={weightUnit === 'lbs'}
                  className={`h-10 min-w-10 px-2 cursor-pointer ${weightUnit === 'lbs' ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white'}`}
                >
                  lbs
                </button>
              </div>

              <button
                onClick={() => setIsLogExpanded(!isLogExpanded)}
                aria-expanded={isLogExpanded}
                aria-label={t.logSessionLabel(completedSetIndexes.length, totalSets)}
                className="h-10 w-10 flex items-center justify-center text-zinc-400 hover:text-white rounded-lg cursor-pointer"
              >
                {isLogExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Set rows: [set number] [weight] x [reps] [tick] on one line, even at 320px */}
          {isLogExpanded && (
            <div className="space-y-1.5 bg-[#09090b] border border-[#1a1a20] p-1.5 sm:p-3 rounded-xl">
              {Array.from({ length: totalSets }).map((_, sIdx) => {
                const isCompleted = completedSetIndexes.includes(sIdx);
                const detail = setDetails[sIdx] || { weight: '', reps: '', unit: weightUnit };
                const setNumber = sIdx + 1;

                return (
                  <div
                    key={sIdx}
                    data-set-row
                    className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg border transition-colors ${
                      isCompleted ? 'bg-emerald-500/15 border-emerald-500' : 'bg-[#121215] border-[#222227]'
                    }`}
                  >
                    {/* Set number ("Set 1" for screen readers) */}
                    <span
                      className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-xs font-extrabold ${
                        isCompleted ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      <span aria-hidden="true">{setNumber}</span>
                      <span className="sr-only">{t.setBtn(setNumber)}</span>
                    </span>

                    {/* Weight and reps: 18px digits (never below 16px, or iPhone Safari zooms in); unit label inside the box */}
                    <div className="flex-1 min-w-0 flex items-center gap-1">
                      <div className="relative flex-1 min-w-0 max-w-28">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          enterKeyHint="next"
                          data-field="weight"
                          onFocus={selectAllOnFocus}
                          onKeyDown={moveToRepsOnEnter}
                          placeholder={t.weightPlaceholder}
                          aria-label={t.weightInputLabel(setNumber, weightUnit)}
                          value={displayWeight(detail.weight || '', detail.unit, weightUnit)}
                          onChange={(e) => onUpdateWeight(exercise.id, sIdx, e.target.value)}
                          className={setInputClass}
                        />
                        <span className={setInputLabelClass}>{weightUnit}</span>
                      </div>

                      <span aria-hidden="true" className="text-xs text-zinc-500">×</span>

                      <div className="relative w-[3.75rem] shrink-0">
                        <input
                          type="number"
                          inputMode="numeric"
                          step="any"
                          enterKeyHint="done"
                          data-field="reps"
                          onFocus={selectAllOnFocus}
                          onKeyDown={closeKeyboardOnEnter}
                          placeholder={t.repsPlaceholder}
                          aria-label={t.repsInputLabel(setNumber)}
                          value={detail.reps || ''}
                          onChange={(e) => onUpdateReps(exercise.id, sIdx, e.target.value)}
                          className={setInputClass}
                        />
                        <span className={setInputLabelClass}>{t.reps.toLowerCase()}</span>
                      </div>
                    </div>

                    {/* Done / not done (same handler as before) */}
                    <button
                      onClick={() => onToggleSet(exercise.id, sIdx)}
                      aria-pressed={isCompleted}
                      aria-label={t.setDoneLabel(setNumber)}
                      className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isCompleted
                          ? 'bg-emerald-500 text-black shadow-sm shadow-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      <Check className={`w-6 h-6 ${isCompleted ? 'stroke-[3]' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
