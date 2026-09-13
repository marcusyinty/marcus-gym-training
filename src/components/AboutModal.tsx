import React from 'react';
import { Language, uiTranslations } from '../data/translations';
import { updateLogs } from '../data/updates';
import { X, Dumbbell, Flame, Heart, Code, Sparkles, Clock, Rocket } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  lang: Language;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, lang, onClose }) => {
  if (!isOpen) return null;

  const t = uiTranslations[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl p-5 sm:p-6 max-h-[90vh] flex flex-col">
        {/* Top Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="flex items-center gap-3 shrink-0 mb-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/50 shrink-0">
            <div className="w-full h-full bg-[#09090b] rounded-[14px] flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white font-['Plus_Jakarta_Sans']">{t.aboutTitle}</h3>
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> Marcus Recomp System
            </span>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar my-2">
          {/* Core Marcus Bio Hero Card */}
          <div className="bg-[#09090b] border border-[#222227] rounded-xl p-4 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed italic font-sans">
              "{t.aboutContent}"
            </p>
          </div>

          {/* Dev Log / Updates Section Header */}
          <div className="pt-2 border-t border-[#1f1f24]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  {lang === 'zh' ? '开发者日志与更新' : 'Developer Log & Updates'}
                </h4>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">v1.0.0</span>
            </div>

            {/* Updates Timeline */}
            <div className="space-y-3">
              {updateLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#18181c] border border-[#27272a] rounded-xl p-3.5 relative overflow-hidden group hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {log.tag && (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {log.tag}
                        </span>
                      )}
                      <h5 className="text-xs sm:text-sm font-bold text-white font-['Plus_Jakarta_Sans']">
                        {log.title[lang]}
                      </h5>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono shrink-0">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      <span>{log.date}</span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed font-sans mt-1">
                    {log.content[lang]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Footer Tags */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 gap-2 border-t border-[#1f1f24] pt-3 shrink-0">
          <span className="flex items-center gap-1.5 font-medium">
            <Heart className="w-3.5 h-3.5 text-rose-400" /> Built for Progressive Overload
          </span>
          <span className="flex items-center gap-1.5 font-medium text-zinc-500">
            <Code className="w-3.5 h-3.5 text-cyan-400" /> Vercel & Cloudinary
          </span>
        </div>

        {/* Bottom Close Action */}
        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-950/40 cursor-pointer shrink-0"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
};
