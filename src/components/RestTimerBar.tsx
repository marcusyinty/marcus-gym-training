import React, { useEffect, useRef, useState } from 'react';
import { Language, uiTranslations } from '../data/translations';
import { formatMmSs, isRestOver, RestCountdown, restProgress, restSecondsLeft } from '../lib/restTime';
import { playRestBeep, vibrateRestOver } from '../lib/restAlert';
import { CheckCircle2, Timer, Volume2, VolumeX } from 'lucide-react';

interface RestTimerBarProps {
  lang: Language;
  countdown: RestCountdown;
  soundOn: boolean;
  onToggleSound: () => void;
  onAddTime: () => void;
  onClose: () => void;
}

// The end alert only fires if the tab is visible within this long after the rest is over (no late beep)
const LATE_ALERT_MS = 2000;
// How long the green "rest over" state stays after it was first seen
const FINISHED_VISIBLE_MS = 10_000;

// Bottom bar for the rest between sets. It is remounted for every new rest (see the key in App). It sits in
// App's fixed bottom dock, under the tag prompt when that is showing.
export const RestTimerBar: React.FC<RestTimerBarProps> = ({ lang, countdown, soundOn, onToggleSound, onAddTime, onClose }) => {
  const t = uiTranslations[lang];
  const [now, setNow] = useState(() => Date.now());
  const [finishedSeenAt, setFinishedSeenAt] = useState<number | null>(null);
  const hasAlertedRef = useRef(false);
  // Announced once at the start; +15s does not re-announce
  const [startAnnouncement] = useState(() => t.restStarted(formatMmSs(Math.round(countdown.durationMs / 1000))));

  // Recompute from the end time (not a counter) every 250ms and as soon as the page is visible again
  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = window.setInterval(update, 250);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') update();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const isOver = isRestOver(countdown, now);

  useEffect(() => {
    if (!isOver) return;
    const isVisible = document.visibilityState === 'visible';
    if (!hasAlertedRef.current) {
      hasAlertedRef.current = true;
      // Only the tab that is on screen when the rest ends alerts; coming back later shows green without a beep
      if (isVisible && now - countdown.endsAt < LATE_ALERT_MS) {
        vibrateRestOver();
        if (soundOn) playRestBeep();
      }
    }
    if (isVisible && finishedSeenAt === null) setFinishedSeenAt(now);
  }, [isOver, now, countdown.endsAt, soundOn, finishedSeenAt]);

  useEffect(() => {
    if (finishedSeenAt !== null && now >= finishedSeenAt + FINISHED_VISIBLE_MS) onClose();
  }, [now, finishedSeenAt, onClose]);

  const progress = restProgress(countdown, now);

  return (
    <div data-rest-timer>
      {/* Screen readers: announced only when the rest starts and when it ends, not every second */}
      <p className="sr-only" aria-live="polite">
        {isOver ? t.restOver : startAnnouncement}
      </p>

      <div className="max-w-4xl mx-auto px-3 py-2 pointer-events-auto">
        {isOver ? (
          <button
            onClick={onClose}
            className="w-full h-16 rounded-2xl bg-emerald-500 text-black shadow-2xl shadow-emerald-950/60 flex items-center justify-center gap-2 text-base font-extrabold cursor-pointer"
          >
            <CheckCircle2 className="w-6 h-6 shrink-0 motion-safe:animate-pulse" />
            <span>{t.restOver}</span>
          </button>
        ) : (
          <div className="relative h-16 rounded-2xl overflow-hidden bg-[#121215]/95 border border-[#27272a] backdrop-blur-md shadow-2xl shadow-black/60 flex items-center gap-2 pl-3 pr-2">
            {/* Thin progress bar along the top edge */}
            <div className="absolute inset-x-0 top-0 h-1 bg-zinc-800" aria-hidden="true">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <Timer className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <span className="block text-xs leading-4 font-bold uppercase tracking-wider text-zinc-400">{t.restLabel}</span>
              <span role="timer" aria-label={t.restLabel} className="block text-[28px] leading-8 font-extrabold font-mono tabular-nums text-white">
                {formatMmSs(restSecondsLeft(countdown, now))}
              </span>
            </div>

            <button
              onClick={onAddTime}
              aria-label={t.addRestTime}
              className="h-11 min-w-11 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-bold cursor-pointer"
            >
              {t.addRestTimeShort}
            </button>
            <button
              onClick={onClose}
              className="h-11 min-w-11 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-bold cursor-pointer"
            >
              {t.skipRest}
            </button>
            <button
              onClick={onToggleSound}
              aria-pressed={soundOn}
              aria-label={t.restSound}
              title={soundOn ? t.soundOn : t.soundOff}
              className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center cursor-pointer ${
                soundOn ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              {soundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
