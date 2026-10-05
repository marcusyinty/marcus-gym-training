import React from 'react';
import { Language, uiTranslations } from '../data/translations';
import { updateLogs } from '../data/updates';
import { APP_VERSION, formatLogDate } from '../lib/appInfo';
import { AppDataV3 } from '../lib/model';
import { RestoreResult } from '../lib/store/appDataStore';
import { DataBackupSection } from './DataBackupSection';
import { X, Dumbbell, Flame, Heart, Code, Sparkles, Clock, Rocket } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  lang: Language;
  onClose: () => void;
  // For "Your data" (backup / restore)
  data: AppDataV3;
  savingDisabled: boolean;
  onRestore: (data: AppDataV3) => RestoreResult;
  onOpenHistory: () => void;
  onOpenBody: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, lang, onClose, data, savingDisabled, onRestore, onOpenHistory, onOpenBody }) => {
  if (!isOpen) return null;

  const t = uiTranslations[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl p-5 sm:p-6 max-h-[90vh] flex flex-col">
        {/* Top Close Button */}
        {/* 44px tap area; the visible 32px square stays where it always was (the title never runs under it) */}
        <button
          onClick={onClose}
          aria-label={t.close}
          className="group absolute top-2.5 right-2.5 w-11 h-11 flex items-center justify-center z-10 cursor-pointer"
        >
          <span className="p-1.5 rounded-xl bg-zinc-800/80 text-zinc-400 group-hover:text-white group-hover:bg-zinc-700 transition-colors">
            <X className="w-5 h-5" />
          </span>
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
          {/* Your data: backup file / restore */}
          <DataBackupSection lang={lang} data={data} savingDisabled={savingDisabled} onRestore={onRestore} onOpenHistory={onOpenHistory} onOpenBody={onOpenBody} />

          {/* Core Marcus Bio Hero Card */}
          <div className="bg-[#09090b] border border-[#222227] rounded-xl p-4 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed italic font-sans">
              "{t.aboutContent}"
            </p>
          </div>

          {/* Dev Log / Updates Section Header */}
          <div className="pt-2 border-t border-[#1f1f24]">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Rocket className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">{t.devLogTitle}</h4>
              </div>
              {/* The app's real version (from package.json) */}
              <span data-app-version className="text-[11px] text-zinc-400 font-mono shrink-0">v{APP_VERSION}</span>
            </div>

            {/* Updates Timeline */}
            <div className="space-y-3">
              {updateLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#18181c] border border-[#27272a] rounded-xl p-3.5 relative overflow-hidden group hover:border-zinc-700 transition-colors"
                >
                  {/* Phones: tag and date on the first row, the title on its own full-width row below (no squeezed
                      title, no cut-off date). From sm up: tag, title and date in one row, as before. */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
                    {log.version && (
                      <span data-log-version className="order-1 text-[11px] font-extrabold font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {log.version}
                      </span>
                    )}
                    {log.tag && (
                      <span className="order-1 text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {log.tag}
                      </span>
                    )}
                    {log.title && (
                      <h5 className="order-3 basis-full sm:order-2 sm:basis-auto sm:flex-1 min-w-0 text-xs sm:text-sm font-bold text-white font-['Plus_Jakarta_Sans']">
                        {log.title[lang]}
                      </h5>
                    )}
                    <div className="order-2 sm:order-3 ml-auto flex items-center gap-1 text-[11px] text-zinc-400 font-mono shrink-0">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      <span>{formatLogDate(log, lang)}</span>
                    </div>
                  </div>

                  {log.content && (
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans mt-1">
                      {log.content[lang]}
                    </p>
                  )}
                  {/* A release's changes */}
                  {log.bullets && (
                    <ul data-log-bullets className="mt-1 space-y-1 pl-4 list-disc marker:text-emerald-500 text-xs text-zinc-300 leading-relaxed font-sans">
                      {log.bullets[lang].map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Footer Tags */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 gap-2 border-t border-[#1f1f24] pt-3 shrink-0">
          <span className="flex items-center gap-1.5 font-medium">
            <Heart className="w-3.5 h-3.5 text-rose-400" /> {t.builtForOverload}
          </span>
          <span className="flex items-center gap-1.5 font-medium text-zinc-500">
            <Code className="w-3.5 h-3.5 text-cyan-400" /> Vercel & Cloudinary
          </span>
        </div>

        {/* Bottom Close Action */}
        <button
          onClick={onClose}
          className="w-full mt-3 min-h-11 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-950/40 cursor-pointer shrink-0"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
};
