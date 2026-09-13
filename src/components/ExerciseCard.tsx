import React, { useRef, useEffect, useState } from 'react';
import { EnrichedExercise, SetDetail } from '../types/workout';
import { AnatomyMap } from './AnatomyMap';
import { Play, Pause, Maximize2, Check, Sparkles, VolumeX, Target, Activity, Video, Award, ChevronDown, ChevronUp, Save } from 'lucide-react';

interface ExerciseCardProps {
  exercise: EnrichedExercise;
  index: number;
  completedSetIndexes: number[];
  setDetails: Record<number, SetDetail>;
  previousBest?: { weight: string; reps: string; unit: 'kg' | 'lbs' };
  onToggleSet: (exerciseId: string, setIndex: number) => void;
  onUpdateSetDetail: (exerciseId: string, setIndex: number, weight: string, reps: string, unit: 'kg' | 'lbs') => void;
  onOpenVideoModal: (videoUrl: string, posterUrl: string, title: string) => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  index,
  completedSetIndexes,
  setDetails,
  previousBest,
  onToggleSet,
  onUpdateSetDetail,
  onOpenVideoModal,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Requirement 1: Default active tab is strictly "video" (Form Demo)
  const [activeMediaTab, setActiveMediaTab] = useState<'video' | 'anatomy'>('video');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [isLogExpanded, setIsLogExpanded] = useState(true);

  // Derive total sets count
  const parseSetsCount = (setsStr: string): number => {
    if (setsStr.includes('–')) {
      const parts = setsStr.split('–');
      return parseInt(parts[1], 10) || 3;
    }
    return parseInt(setsStr, 10) || 3;
  };

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
  }, [exercise.media?.videoUrl, activeMediaTab]);

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

  return (
    <div
      ref={containerRef}
      className="bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl hover:border-zinc-700 transition-all duration-300 group flex flex-col md:flex-row"
    >
      {/* Media / Visualizer Area (Left on desktop, Top on mobile) */}
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
              <Video className="w-3 h-3" /> Form Demo
            </button>
            <button
              onClick={() => setActiveMediaTab('anatomy')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                activeMediaTab === 'anatomy' ? 'bg-emerald-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Activity className="w-3 h-3" /> Muscle Map
            </button>
          </div>

          {media && activeMediaTab === 'video' && (
            <button
              onClick={() => onOpenVideoModal(media.videoUrl, media.posterUrl, exercise.name)}
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
                    <VolumeX className="w-3 h-3" /> Muted Loop
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

      {/* Content Details Area (Right on desktop, Bottom on mobile) */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Header & Exercise Title */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-extrabold text-emerald-400 tracking-wider">
                  #{String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans']">
                  {exercise.name}
                </h3>
              </div>
            </div>

            {/* Target Volume Pill & Previous Best Badge */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-2 bg-[#1a1a20] border border-[#2e2e35] px-3 py-1.5 rounded-xl">
                <div className="text-center">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-semibold">Volume</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
                    {exercise.sets} SETS <span className="text-zinc-500">|</span> {exercise.reps} REPS
                  </span>
                </div>
              </div>

              {/* Requirement 2: Previous Best Reference Badge */}
              {previousBest && (previousBest.weight || previousBest.reps) && (
                <div className="flex items-center gap-1 text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                  <Award className="w-3 h-3 text-cyan-400" />
                  <span>Prev: {previousBest.weight || '0'} {previousBest.unit} × {previousBest.reps || '0'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Muscle Target Badges */}
          <div className="flex flex-wrap items-center gap-1.5 my-3">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Target className="w-3 h-3 text-emerald-400" /> Targets:
            </span>
            {exercise.primaryMuscles.map((muscle) => (
              <span
                key={muscle}
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
              >
                {muscle}
              </span>
            ))}
            {exercise.secondaryMuscles.map((muscle) => (
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
              <span>COACHING CUE</span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed italic font-sans">
              "{exercise.coachingCue}"
            </p>
          </div>
        </div>

        {/* Client-Side Workout Tracker & Performance Logger */}
        <div className="mt-4 pt-3 border-t border-[#1f1f24] space-y-3">
          {/* Top Bar: Progress & Unit Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Log Session ({completedSetIndexes.length}/{totalSets} Sets)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* kg / lbs Unit Switcher */}
              <div className="flex items-center bg-[#18181c] border border-zinc-800 rounded-md p-0.5 text-[10px] font-bold">
                <button
                  onClick={() => setWeightUnit('kg')}
                  className={`px-1.5 py-0.5 rounded ${weightUnit === 'kg' ? 'bg-emerald-500 text-black' : 'text-zinc-400'}`}
                >
                  kg
                </button>
                <button
                  onClick={() => setWeightUnit('lbs')}
                  className={`px-1.5 py-0.5 rounded ${weightUnit === 'lbs' ? 'bg-emerald-500 text-black' : 'text-zinc-400'}`}
                >
                  lbs
                </button>
              </div>

              <button
                onClick={() => setIsLogExpanded(!isLogExpanded)}
                className="text-zinc-400 hover:text-white p-1 rounded-md"
              >
                {isLogExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Quick Input Rows for Each Set */}
          {isLogExpanded && (
            <div className="space-y-2 bg-[#09090b] border border-[#1a1a20] p-3 rounded-xl">
              {Array.from({ length: totalSets }).map((_, sIdx) => {
                const isCompleted = completedSetIndexes.includes(sIdx);
                const detail = setDetails[sIdx] || { weight: '', reps: '', unit: weightUnit, completed: false };

                return (
                  <div
                    key={sIdx}
                    className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${
                      isCompleted ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-[#121215] border-[#222227]'
                    }`}
                  >
                    {/* Completion Button */}
                    <button
                      onClick={() => onToggleSet(exercise.id, sIdx)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-xs transition-all ${
                        isCompleted
                          ? 'bg-emerald-500 text-black shadow-sm shadow-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${isCompleted ? 'stroke-[3]' : 'opacity-40'}`} />
                      <span>Set {sIdx + 1}</span>
                    </button>

                    {/* Inputs: Weight & Reps */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="0"
                          value={detail.weight || ''}
                          onChange={(e) =>
                            onUpdateSetDetail(exercise.id, sIdx, e.target.value, detail.reps, weightUnit)
                          }
                          className="w-14 sm:w-16 bg-[#18181c] border border-zinc-700 rounded-md px-2 py-1 text-xs text-white text-center font-mono focus:outline-none focus:border-emerald-500"
                        />
                        <span className="text-[10px] text-zinc-400 font-bold uppercase">{weightUnit}</span>
                      </div>

                      <span className="text-zinc-600 text-xs">×</span>

                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="0"
                          value={detail.reps || ''}
                          onChange={(e) =>
                            onUpdateSetDetail(exercise.id, sIdx, detail.weight, e.target.value, weightUnit)
                          }
                          className="w-12 sm:w-14 bg-[#18181c] border border-zinc-700 rounded-md px-2 py-1 text-xs text-white text-center font-mono focus:outline-none focus:border-emerald-500"
                        />
                        <span className="text-[10px] text-zinc-400 font-bold uppercase">reps</span>
                      </div>
                    </div>
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
