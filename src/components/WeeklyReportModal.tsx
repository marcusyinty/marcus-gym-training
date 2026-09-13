import React, { useRef, useState } from 'react';
import { Language, uiTranslations } from '../data/translations';
import { toPng } from 'html-to-image';
import { X, Dumbbell, Download, Sparkles, Trophy, CheckCircle2, ShieldCheck, Share2, Flame } from 'lucide-react';

interface WeeklyReportModalProps {
  isOpen: boolean;
  lang: Language;
  completedSetsCount: number;
  totalSetsCount: number;
  completedDaysCount: number;
  totalDaysCount: number;
  onClose: () => void;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({
  isOpen,
  lang,
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

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      // Small delay to ensure clean canvas rendering
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#09090b',
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `marcus-weekly-summary-${dateStr}.png`;

      // Trigger download
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl p-5 flex flex-col max-h-[92vh]">
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
            className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden shadow-2xl font-sans"
          >
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header Branding */}
            <div className="flex items-center justify-between border-b border-[#1a1a20] pb-4 mb-4">
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
            <div className="bg-gradient-to-br from-[#121216] to-[#18181f] border border-[#27272a] rounded-xl p-4 mb-4 text-center relative overflow-hidden">
              <Sparkles className="w-6 h-6 text-emerald-400 mx-auto mb-1 animate-pulse" />
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight font-['Plus_Jakarta_Sans']">
                {t.weeklyReportTitle}
              </h2>
              <p className="text-xs text-emerald-400 font-semibold mt-0.5">{t.weeklyReportSub}</p>
            </div>

            {/* Performance Metrics Grid */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              <div className="bg-[#121215] border border-[#222227] p-3 rounded-xl text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                  {t.daysCleared}
                </span>
                <span className="text-lg font-black text-white font-mono mt-0.5 block">
                  {completedDaysCount}/{totalDaysCount}
                </span>
              </div>
              <div className="bg-[#121215] border border-[#222227] p-3 rounded-xl text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                  {t.totalSetsLogged}
                </span>
                <span className="text-lg font-black text-emerald-400 font-mono mt-0.5 block">
                  {completedSetsCount}/{totalSetsCount}
                </span>
              </div>
              <div className="bg-[#121215] border border-[#222227] p-3 rounded-xl text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">
                  {t.movementsMastered}
                </span>
                <span className="text-lg font-black text-cyan-400 font-mono mt-0.5 block">
                  26 Ex
                </span>
              </div>
            </div>

            {/* Muscle Volume Breakdown Pills */}
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                {lang === 'zh' ? '本周训练部位覆盖:' : 'Target Muscle Breakdown:'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  lang === 'zh' ? '胸肌 Chest' : 'Chest',
                  lang === 'zh' ? '背阔肌 Back' : 'Back',
                  lang === 'zh' ? '三角肌 Shoulders' : 'Shoulders',
                  lang === 'zh' ? '股四/腘绳肌 Legs' : 'Legs',
                  lang === 'zh' ? '手臂 Arms' : 'Arms',
                  lang === 'zh' ? '核心 Core' : 'Core',
                ].map((item) => (
                  <span
                    key={item}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-[#141418] text-zinc-300 border border-zinc-800"
                  >
                    ✓ {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Quote / Coaching Note */}
            <div className="bg-[#0e0e12] border border-[#1f1f25] rounded-xl p-3.5 mb-4 italic text-xs text-zinc-300 leading-relaxed">
              "{t.weeklyQuote}"
            </div>

            {/* Marcus Verification Signature Badge */}
            <div className="flex items-center justify-between border-t border-[#1a1a20] pt-3 text-[10px]">
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
