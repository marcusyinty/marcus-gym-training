import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EnrichedWorkoutDay } from '../types/workout';
import { Language, uiTranslations, dayTranslationsZh, UiTranslations } from '../data/translations';
import { performedExerciseName } from '../lib/exerciseVariants';
import { toPng } from 'html-to-image';
import { Cycle } from '../lib/model';
import { StartWeekResult } from '../lib/store/appDataStore';
import { WeightUnit } from '../lib/units';
import { StartNewWeek, StartNewWeekAvailability } from './StartNewWeek';
import { buildWeeklyReport, WeeklyReport } from '../lib/weeklyReport';
import { localDateStamp } from '../lib/weeks';
import { reportDayHeading, topSetText, weekCaption } from '../lib/reportText';
import { X, Dumbbell, Download, Sparkles, CheckCircle2, ShieldCheck, Flame, Scale, Flag } from 'lucide-react';

interface WeeklyReportModalProps {
  isOpen: boolean;
  lang: Language;
  days: EnrichedWorkoutDay[];
  // The week to report on: the current one or an archived one
  cycle: Cycle;
  weekNumber: number;
  weightUnit: WeightUnit;
  startNewWeek: { availability: StartNewWeekAvailability; onConfirm: () => StartWeekResult };
  onClose: () => void;
}

// The downloaded image is never narrower than this (the card's old fixed width), so it keeps its layout
const EXPORT_MIN_WIDTH = 340;

// Resolves with the off-screen copy once React has mounted and laid it out (a few frames at most)
const waitForExportCopy = async (ref: React.RefObject<HTMLDivElement | null>): Promise<HTMLDivElement> => {
  for (let frame = 0; frame < 30; frame++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (ref.current) return ref.current;
  }
  throw new Error('The image copy of the report was not ready');
};

interface DaySummary {
  dayId: string;
  heading: string; // "Day 1: Upper A" / "第一天：上肢 A"
  // maxText: "Max on set 2" when ticked sets were tagged Max, else null (then the row is exactly as before)
  exercises: { id: string; name: string; topText: string; ticked: boolean; maxText: string | null }[];
}

interface ReportCardProps {
  cardRef?: React.Ref<HTMLDivElement>;
  t: UiTranslations;
  caption: string;
  report: WeeklyReport;
  progressPercent: number;
  isEmptyWeek: boolean;
  dayExerciseSummaries: DaySummary[];
  weightUnit: WeightUnit;
  // The off-screen copy for the image: the sparkle stays still instead of pulsing mid-capture
  forExport?: boolean;
}

// The report card itself. It fills its parent; below 340px wide (phones) the 4 tiles become 2x2.
// The downloaded image is taken from an off-screen copy at least 340px wide, so it keeps 4 in a row.
const ReportCard: React.FC<ReportCardProps> = ({ cardRef, t, caption, report, progressPercent, isEmptyWeek, dayExerciseSummaries, weightUnit, forExport = false }) => (
  <div ref={cardRef} className="@container w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-5 text-white relative overflow-hidden shadow-2xl font-sans">
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
            {t.reportBrand}
          </h3>
          <span className="text-[10px] text-zinc-500 font-semibold">{t.appSubTitle}</span>
        </div>
      </div>

      <div className="text-right">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          {t.reportCleared(progressPercent)}
        </span>
      </div>
    </div>

    {/* Main Report Banner */}
    <div className="bg-gradient-to-br from-[#121216] to-[#18181f] border border-[#27272a] rounded-xl p-3.5 mb-3 text-center relative overflow-hidden">
      <Sparkles className={`w-5 h-5 text-emerald-400 mx-auto mb-1 ${forExport ? '' : 'animate-pulse'}`} />
      <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight font-['Plus_Jakarta_Sans']">
        {t.weeklyReportTitle}
      </h2>
      <p className="text-xs text-emerald-400 font-semibold mt-0.5">{t.weeklyReportSub}</p>
      {/* Which week this is (centred, so it is never cut off on a narrow phone) */}
      <p data-week-caption className="text-xs text-zinc-300 font-semibold mt-1.5">{caption}</p>
    </div>

    {/* Performance Metrics Grid (Including Total Tonnage): 4 in a row from the old 340px card width up (298px
        inside its 1px border and 20px padding, which is what container queries measure), 2x2 below */}
    <div className="grid grid-cols-2 @min-[298px]:grid-cols-4 gap-2 mb-4">
      <div className="bg-[#121215] border border-[#222227] p-2.5 rounded-xl text-center">
        <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 block">
          {t.daysCleared}
        </span>
        <span className="text-base font-black text-white font-mono mt-0.5 block">
          {report.completedDays}/{report.totalDays}
        </span>
      </div>

      <div className="bg-[#121215] border border-[#222227] p-2.5 rounded-xl text-center">
        <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 block">
          {t.totalSetsLogged}
        </span>
        <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
          {report.completedSets}/{report.totalSets}
        </span>
      </div>

      <div className="bg-[#121215] border border-[#222227] p-2.5 rounded-xl text-center">
        <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 block">
          {t.movementsMastered}
        </span>
        {/* Exercises with every set ticked, out of all exercises in the program */}
        <span className="text-base font-black text-cyan-400 font-mono mt-0.5 block">
          {report.doneExercises}/{report.totalExercises}
        </span>
      </div>

      {/* Total Tonnage Metric Callout */}
      <div className="bg-[#121215] border border-emerald-500/30 bg-emerald-950/20 p-2.5 rounded-xl text-center">
        <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400 block">
          {t.totalVolumeLifted}
        </span>
        <span className="text-base font-black text-white font-mono mt-0.5 block">
          {report.totalVolume > 0 ? `${Math.round(report.totalVolume).toLocaleString()} ${weightUnit}` : '—'}
        </span>
      </div>
    </div>

    {/* Peak load per exercise, for every exercise in the program */}
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1">
          <Scale className="w-3.5 h-3.5 text-emerald-400" /> {t.peakLoadPerExercise}
        </span>
        <span className="text-[9px] text-zinc-500 font-mono">{t.movementsCount(report.totalExercises)}</span>
      </div>

      {isEmptyWeek ? (
        <p className="bg-[#111114] border border-dashed border-[#2a2a31] rounded-xl px-3 py-6 text-center text-xs text-zinc-400 leading-relaxed">
          {t.reportEmpty}
        </p>
      ) : (
      <div className="space-y-2.5">
        {dayExerciseSummaries.map((day) => (
          <div key={day.dayId} className="bg-[#111114] border border-[#222227] rounded-xl p-2.5">
            <div className="flex items-center justify-between border-b border-[#1f1f25] pb-1 mb-1.5">
              <span className="text-[10px] font-extrabold text-emerald-400 font-['Plus_Jakarta_Sans']">
                {day.heading}
              </span>
              <span className="text-[9px] text-zinc-500">{t.exerciseCount(day.exercises.length)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              {day.exercises.map((ex) => {
                const nameAndTop = (
                  <>
                    <span className="text-zinc-300 font-medium truncate max-w-[170px]" title={ex.name}>
                      {ex.name}
                    </span>
                    <span
                      className={`font-mono font-bold shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${
                        ex.ticked ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 border-transparent'
                      }`}
                    >
                      {ex.topText}
                    </span>
                  </>
                );
                // Only an exercise with Max-tagged sets gets the extra line; every other row stays as it was
                return ex.maxText ? (
                  <div key={ex.id} className="py-0.5 border-b border-zinc-900/60">
                    <div className="flex items-center justify-between">{nameAndTop}</div>
                    <p data-report-max className="mt-0.5 flex items-center gap-1 text-[10px] leading-3 font-semibold text-amber-300">
                      <Flag aria-hidden="true" className="w-3 h-3 shrink-0" />
                      {ex.maxText}
                    </p>
                  </div>
                ) : (
                  <div key={ex.id} className="flex items-center justify-between py-0.5 border-b border-zinc-900/60">
                    {nameAndTop}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      )}
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
);

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ isOpen, lang, days, cycle, weekNumber, weightUnit, startNewWeek, onClose }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  // The off-screen copy used for the image; only mounted while an image is being made
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [exportWidth, setExportWidth] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const t = uiTranslations[lang];
  const caption = weekCaption(cycle, weekNumber, lang, t);

  // All numbers come from the shared report rules (only ticked sets; volume in the current unit)
  const report = buildWeeklyReport(cycle, days, weightUnit);
  const progressPercent = report.totalSets > 0 ? Math.round((report.completedSets / report.totalSets) * 100) : 0;
  const isEmptyWeek = report.tickedSets === 0;

  const dayExerciseSummaries = days.map((day, dayIndex) => {
    const zhDay = dayTranslationsZh[day.id];
    return {
      dayId: day.id,
      heading: reportDayHeading(day.dayNumber, lang === 'zh' && zhDay ? zhDay.title : day.title, lang, t),
      exercises: day.exercises.map((ex, exerciseIndex) => {
        // The name of the exercise actually done that week (a swapped-in alternative shows its own name)
        const { top, performedExerciseId, maxSets } = report.days[dayIndex].exercises[exerciseIndex];
        return {
          id: ex.id,
          name: performedExerciseName(ex, performedExerciseId, lang),
          topText: topSetText(top, weightUnit, t),
          ticked: top.kind !== 'none',
          maxText: maxSets.length > 0 ? t.reportMaxOnSets(maxSets) : null,
        };
      }),
    };
  });

  const cardProps = { t, caption, report, progressPercent, isEmptyWeek, dayExerciseSummaries, weightUnit };

  // The image keeps its old layout: it is taken from an off-screen copy of the card that is as wide as the
  // card on screen, but never narrower than 340px (so on phones: 340px, 4 tiles in a row, as before).
  const handleDownloadImage = async () => {
    if (!cardRef.current || isExporting) return;
    setIsExporting(true);
    setExportWidth(Math.max(EXPORT_MIN_WIDTH, Math.round(cardRef.current.getBoundingClientRect().width)));
    try {
      const node = await waitForExportCopy(exportRef);
      // Everything drawn must be ready first, or the image can come out blank (fonts, any images)
      await document.fonts?.ready;
      await Promise.all([...node.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)));
      await new Promise((resolve) => setTimeout(resolve, 150));

      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#09090b',
      });

      // A past week is named after its own start day; the current week after today (as before)
      const dateStr = (cycle.endedAt ? localDateStamp(cycle.startedAt) : null) ?? new Date().toISOString().split('T')[0];
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
      setExportWidth(null);
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
          {/* The report card as shown (it fits the screen) */}
          <ReportCard cardRef={cardRef} {...cardProps} />
        </div>

        {/* Off-screen copy for the image, only while exporting. Not display:none / visibility:hidden (those can
            give a blank image, e.g. on iPhone Safari): fixed far to the left, so it adds no scroll, can't be
            focused or tapped, and is hidden from screen readers. */}
        {exportWidth !== null &&
          createPortal(
            <div
              aria-hidden="true"
              inert
              style={{ position: 'fixed', top: 0, left: -(exportWidth + 10000), width: exportWidth, pointerEvents: 'none' }}
            >
              <ReportCard cardRef={exportRef} {...cardProps} forExport />
            </div>,
            document.body
          )}

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

          {/* Finish this week: archive it and start an empty one (or why that isn't possible here) */}
          <StartNewWeek
            lang={lang}
            availability={startNewWeek.availability}
            weekNumber={weekNumber}
            tickedSets={report.tickedSets}
            onConfirm={startNewWeek.onConfirm}
          />
        </div>
      </div>
    </div>
  );
};
