import React, { useRef, useState } from 'react';
import { EnrichedWorkoutDay, SetDetail } from '../types/workout';
import { Language, uiTranslations, dayTranslationsZh, exerciseTranslationsZh } from '../data/translations';
import { toPng } from 'html-to-image';
import { X, Dumbbell, Download, Sparkles, CheckCircle2, ShieldCheck, Flame, Scale, Dumbbell as WeightIcon } from 'lucide-react';

interface WeeklyReportModalProps {
  isOpen: boolean;
  lang: Language;
  days: EnrichedWorkoutDay[];
  setDetailsState: Record<string, Record<number, SetDetail>>;
  completedSetsCount: number;
  totalSetsCount: number;
  completedDaysCount: number;
  totalDaysCount: number;
  onClose: () => void;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({
  isOpen,
  lang,
  days,
  setDetailsState,
  completedSetsCount,
  totalSetsCount,
  completedDaysCount,
  totalDaysCount,
  onClose,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const t = uiTranslations[lang];
  const currentDate = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const progressPercent = totalSetsCount > 0 ? Math.round((completedSetsCount / totalSetsCount) * 100) : 0;

  // Calculate total tonnage and extract exercise load summaries
  let grandTotalTonnage = 0;
  let defaultUnit = 'kg';

  const dayExerciseSummaries = days.map((day) => {
    const zhDay = dayTranslationsZh[day.id];
    const dayTitle = lang === 'zh' && zhDay ? zhDay.title : day.title;

    const exercises = day.exercises.map((ex) => {
      const zhEx = exerciseTranslationsZh[ex.id];
      const name = lang === 'zh' && zhEx ? zhEx.name : ex.name;

      const detailsMap = setDetailsState[ex.id] || {};
      const setKeys = Object.keys(detailsMap);

      let maxWeight = 0;
      let maxReps = 0;
      let exerciseTonnage = 0;
      let unit = 'kg';

      if (setKeys.length > 0) {
        setKeys.forEach((key) => {
          const detail = detailsMap[parseInt(key, 10)];
          if (detail) {
            const w = parseFloat(detail.weight || '0') || 0;
            const r = parseFloat(detail.reps || '0') || 0;
            if (detail.unit) unit = detail.unit;

            if (w > maxWeight) {
              maxWeight = w;
              maxReps = r;
            } else if (w === maxWeight && r > maxReps) {
              maxReps = r;
            }

            exerciseTonnage += w * r;
          }
        });
      }

      defaultUnit = unit;
      grandTotalTonnage += exerciseTonnage;

      const isBodyweight = maxWeight === 0;

      return {
        id: ex.id,
        name,
        maxWeight,
        maxReps: maxReps || 12,
        unit,
        exerciseTonnage,
        isBodyweight,
      };
    });

    return {
      dayId: day.id,
      dayNumber: day.dayNumber,
      dayTitle,
      exercises,
    };
  });

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 150));

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#09090b',
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `marcus-weekly-summary-${dateStr}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();

      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export report image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-5 flex flex-col max-h-[94vh]">
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-1">
          {/* Exportable Report Card Canvas */}
          <div
            ref={cardRef}
            className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-5 text-white relative overflow-hidden shadow-2xl font-sans min-w-[340px]"
          >
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header Branding */}
            <div className="flex items-center justify-between border-b border-[#1a1a20] pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/50 shrink-0">
                  <div className="w-full h-full bg-[#09090b] rounded-[10px] flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300 font-['Plus_Jakarta_Sans']">
                    MARCUS HYPERTROPHY
                  </h3>
                  <span className="text-[10px] text-zinc-500 font-semibold">{t.appSubTitle}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[9px] font-mono text-zinc-500 block">{currentDate}</span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {progressPercent}% Cleared
                </span>
              </div>
            </div>

            {/* Main Report Banner */}
            <div className="bg-gradient-to-br from-[#121216] to-[#18181f] border border-[#27272a] rounded-xl p-3.5 mb-3 text-center relative overflow-hidden">
              <Sparkles className="w-5 h-5 text-emerald-400 mx-auto mb-1 animate-pulse" />
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight font-['Plus_Jakarta_Sans']">
                {t.weeklyReportTitle}
              </h2>
              <p className="text-xs text-emerald-400 font-semibold mt-0.5">{t.weeklyReportSub}</p>
            </div>

            {/* Performance Metrics Grid (Including Total Tonnage) */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-[#121215] border border-[#222227] p-2.5 rounded-xl text-center">
                <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 block">
                  {t.daysCleared}
                </span>
                <span className="text-base font-black text-white font-mono mt-0.5 block">
                  {completedDaysCount}/{totalDaysCount}
                </span>
              </div>

              <div className="bg-[#121215] border border-[#222227] p-2.5 rounded-xl text-center">
                <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 block">
                  {t.totalSetsLogged}
                </span>
                <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
                  {completedSetsCount}/{totalSetsCount}
                </span>
              </div>

              <div className="bg-[#121215] border border-[#222227] p-2.5 rounded-xl text-center">
                <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 block">
                  {t.movementsMastered}
                </span>
                <span className="text-base font-black text-cyan-400 font-mono mt-0.5 block">
                  26 Ex
                </span>
              </div>

              {/* Total Tonnage Metric Callout */}
              <div className="bg-[#121215] border border-emerald-500/30 bg-emerald-950/20 p-2.5 rounded-xl text-center">
                <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400 block">
                  {t.totalVolumeLifted}
                </span>
                <span className="text-base font-black text-white font-mono mt-0.5 block">
                  {grandTotalTonnage > 0 ? `${Math.round(grandTotalTonnage).toLocaleString()} ${defaultUnit}` : '89 Sets'}
                </span>
              </div>
            </div>

            {/* High-Density 26-Exercise Peak Load Breakdown */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-emerald-400" /> {t.peakLoadPerExercise}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">26 Movements</span>
              </div>

              <div className="space-y-2.5">
                {dayExerciseSummaries.map((day) => (
                  <div key={day.dayId} className="bg-[#111114] border border-[#222227] rounded-xl p-2.5">
                    <div className="flex items-center justify-between border-b border-[#1f1f25] pb-1 mb-1.5">
                      <span className="text-[10px] font-extrabold text-emerald-400 font-['Plus_Jakarta_Sans']">
                        Day {day.dayNumber}: {day.dayTitle}
                      </span>
                      <span className="text-[9px] text-zinc-500">{day.exercises.length} Exercises</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      {day.exercises.map((ex) => (
                        <div key={ex.id} className="flex items-center justify-between py-0.5 border-b border-zinc-900/60">
                          <span className="text-zinc-300 font-medium truncate max-w-[170px]" title={ex.name}>
                            {ex.name}
                          </span>
                          <span className="font-mono font-bold text-emerald-300 shrink-0 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {ex.isBodyweight
                              ? `BW × ${ex.maxReps}`
                              : `${ex.maxWeight} ${ex.unit} × ${ex.maxReps}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quote / Coaching Note */}
            <div className="bg-[#0e0e12] border border-[#1f1f25] rounded-xl p-3 mb-3 italic text-xs text-zinc-300 leading-relaxed">
              "{t.weeklyQuote}"
            </div>

            {/* Marcus Verification Signature Badge */}
            <div className="flex items-center justify-between border-t border-[#1a1a20] pt-2.5 text-[10px]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{t.verifiedBadge}</span>
              </div>
              <span className="text-zinc-500 font-mono">marcus-gym-training</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-3 border-t border-[#1f1f24] shrink-0">
          <button
            onClick={handleDownloadImage}
            disabled={isExporting}
            className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isSuccess
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-950/50'
                : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black shadow-lg shadow-emerald-950/40'
            }`}
          >
            {isExporting ? (
              <>
                <Flame className="w-4 h-4 animate-spin" />
                <span>{t.downloading}</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                <span>{t.shareSuccess}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>{t.downloadReportImage}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
