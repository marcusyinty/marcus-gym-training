import React from 'react';
import { X, Volume2, VolumeX, RefreshCw } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  videoUrl: string;
  posterUrl: string;
  title: string;
  onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  videoUrl,
  posterUrl,
  title,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#27272a] bg-[#09090b]">
          <div>
            <h4 className="text-sm uppercase tracking-wider font-extrabold text-emerald-400">HD Form Guide</h4>
            <h3 className="text-base font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Large Video Display */}
        <div className="relative aspect-[9/14] w-full bg-black">
          <video
            src={videoUrl}
            poster={posterUrl}
            autoPlay
            loop
            controls
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        {/* Footer Note */}
        <div className="p-3 bg-[#09090b] text-center border-t border-[#27272a] text-xs text-zinc-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Looping form demo. Study path of motion and joint angles.</span>
        </div>
      </div>
    </div>
  );
};
