import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string; // id of the sheet's title
  children: React.ReactNode;
}

// The phone's back gesture: each open sheet adds one history entry, so "back" closes the newest sheet instead
// of leaving the page. The step back a sheet takes itself when closed with a button is counted and ignored.
// One listener for all sheets, never removed.
let ownBackSteps = 0;
const sheetClosers: (() => void)[] = [];
let listening = false;
const handlePopState = () => {
  if (ownBackSteps > 0) {
    ownBackSteps--;
    return;
  }
  sheetClosers.pop()?.();
};

// A small sheet for choices and short forms: slides up from the bottom on phones, a centred dialog on wider
// screens. Escape, a tap outside and the phone's back gesture close it (the back gesture never leaves the
// page). The page behind can't scroll, without a layout jump. It sits above the header but below the
// rest-timer bar (so +15s / Skip stay usable), starts just above that bar, and moves above the on-screen
// keyboard (iPhone shrinks only the visual viewport; Android resizes the page).
export const BottomSheet: React.FC<BottomSheetProps> = ({ open, onClose, labelledBy, children }) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState({ bottom: 0, maxHeight: 0 });

  // Focus moves into the sheet (unless a field inside already took it) and back to the opener afterwards
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, [open]);

  // Escape + page scroll lock (the scrollbar's width is kept as padding, so nothing jumps)
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    const previous = { overflow: body.style.overflow, htmlOverflow: documentElement.style.overflow, paddingRight: body.style.paddingRight };
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      body.style.overflow = previous.overflow;
      documentElement.style.overflow = previous.htmlOverflow;
      body.style.paddingRight = previous.paddingRight;
    };
  }, [open]);

  // Back gesture: one history entry while open (see handlePopState above)
  useEffect(() => {
    if (!open) return;
    if (!listening) {
      window.addEventListener('popstate', handlePopState);
      listening = true;
    }
    let closedByBack = false;
    let pushed = false;
    const close = () => {
      closedByBack = true;
      onCloseRef.current();
    };
    sheetClosers.push(close);
    // Added a moment later: React's double run of effects in development then cancels it before it exists
    const timer = window.setTimeout(() => {
      window.history.pushState({ ...window.history.state, bottomSheet: true }, '');
      pushed = true;
    }, 0);
    return () => {
      window.clearTimeout(timer);
      const index = sheetClosers.indexOf(close);
      if (index >= 0) sheetClosers.splice(index, 1);
      // Closed some other way: take the entry away again (that step back must not close anything)
      if (pushed && !closedByBack && window.history.state?.bottomSheet) {
        ownBackSteps++;
        window.history.back();
      }
    };
  }, [open]);

  // Stay above the rest-timer bar, or above the keyboard while it is open
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const update = () => {
      const visibleHeight = viewport ? viewport.height : window.innerHeight;
      const keyboard = viewport ? Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop)) : 0;
      const bar = document.querySelector('[data-rest-bar]')?.getBoundingClientRect().height ?? 0;
      const bottom = Math.round(keyboard > 0 ? keyboard : bar);
      setPlace({ bottom, maxHeight: Math.round(visibleHeight - (keyboard > 0 ? 0 : bar) - 16) });
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    const bar = document.querySelector('[data-rest-bar]');
    if (bar) observer.observe(bar);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[42] flex items-end sm:items-center justify-center sm:p-4">
      <div aria-hidden="true" onClick={() => onCloseRef.current()} className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-bottom-sheet
        style={{ marginBottom: place.bottom, maxHeight: place.maxHeight || undefined }}
        className="relative w-full sm:max-w-md bg-[#121215] border border-[#27272a] rounded-t-2xl sm:rounded-2xl p-4 pb-5 shadow-2xl overflow-y-auto overscroll-contain outline-none"
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
