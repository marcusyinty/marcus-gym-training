// End-of-rest alerts: a short beep (Web Audio) and a vibration. Every call is guarded and never throws.

let audioContext: AudioContext | null = null;

// Call from a user tap (e.g. ticking a set): creates or resumes the audio context, which mobile
// browsers only allow during a user gesture, so the beep can play when the rest is over.
export const unlockRestSound = () => {
  try {
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ??= new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch (e) {
    audioContext = null;
  }
};

// A short 880 Hz beep (about 0.35s) with a soft fade in and out.
export const playRestBeep = () => {
  try {
    if (!audioContext) return;
    const ctx = audioContext;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // no sound is fine
  }
};

export const vibrateRestOver = () => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([200, 100, 200]);
  } catch (e) {
    // not supported (e.g. iPhone Safari)
  }
};
