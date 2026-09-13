import React from 'react';
import { Language, uiTranslations } from '../data/translations';
import { X, Dumbbell, Flame, Heart, Code } from 'lucide-react';

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
      <div className="relative w-full max-w-md bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl p-6">
        {/* Top Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/50 shrink-0">
            <div className="w-full h-full bg-[#09090b] rounded-[14px] flex items-center justify-center">
              <Dumbbell className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white font-['Plus_Jakarta_Sans']">{t.aboutTitle}</h3>
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> Marcus Recomp System
            </span>
          </div>
        </div>

        {/* Personal Message Card */}
        <div className="bg-[#09090b] border border-[#222227] rounded-xl p-4 my-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <p className="text-sm text-zinc-300 leading-relaxed italic">
            "{t.aboutContent}"
          </p>
        </div>

        {/* Info Tags */}
        <div className="flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2 border-t border-[#1f1f24] pt-4">
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
          className="w-full mt-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
};
