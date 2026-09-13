import React, { useState } from 'react';
import { Dumbbell, ShieldCheck, CheckCircle2, RotateCcw, AlertTriangle, X } from 'lucide-react';

interface HeaderBannerProps {
  completedSetsCount: number;
  totalSetsCount: number;
  activeDayTitle: string;
  onResetActiveDay: () => void;
  onResetAll: () => void;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  completedSetsCount,
  totalSetsCount,
  activeDayTitle,
  onResetActiveDay,
  onResetAll,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const progressPercent = totalSetsCount > 0 ? Math.round((completedSetsCount / totalSetsCount) * 100) : 0;

  return (
    <header className="w-full bg-[#0c0c0e] border-b border-[#1f1f23] sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
      <div className="max-w-4xl mx-auto px-4 py-3.5 sm:px-6">
        {/* Top Brand & Badge Bar */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <div className="w-full h-full bg-[#09090b] rounded-[10px] flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white font-['Plus_Jakarta_Sans']">
                  AESTHETIC <span className="text-emerald-400">RECOMP</span>
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  5-Day Hypertrophy
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium">Physique Recomposition Guide</p>
            </div>
          </div>

          {/* Progress Tracker Pill */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{completedSetsCount}/{totalSetsCount} Sets</span>
            </div>
            <div className="w-24 sm:w-32 bg-zinc-800 rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Beginner Notice & Reset Control */}
        <div className="bg-[#141417] border border-[#27272a] rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 relative overflow-hidden">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs text-zinc-300 leading-tight">
              <span className="font-semibold text-white block mb-0.5">Beginner Form & Progression Standard</span>
              <span className="text-zinc-400 text-[11px]">
                Follow prescribed workout day-by-day. Complete all sets & reps with strict tempo as demonstrated in videos.
              </span>
            </div>
          </div>

          {/* Clear Today's Workout Button */}
          <button
            onClick={() => setShowConfirmModal(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-rose-400 bg-zinc-800/80 hover:bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-zinc-700 hover:border-rose-500/40 transition-all shrink-0 cursor-pointer"
            title="Clear or Reset Workout Progress"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Day</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#121215] border border-[#27272a] rounded-2xl p-5 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="absolute top-3 right-3 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Reset Workout Memory?</h3>
            </div>

            <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
              Choose to reset completed sets for <strong className="text-white">{activeDayTitle}</strong> or clear all program logs to start a new training week.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  onResetActiveDay();
                  setShowConfirmModal(false);
                }}
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Clear {activeDayTitle} Progress
              </button>
              <button
                onClick={() => {
                  onResetAll();
                  setShowConfirmModal(false);
                }}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Clear All 5 Days (Full Program Reset)
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full py-1.5 text-xs text-zinc-400 hover:text-white font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
