import React from 'react';
import { Language, uiTranslations } from '../data/translations';
import type { SetTag } from '../lib/store/reducer';
import { Flag, Tag, X } from 'lucide-react';
import { TAG_ORDER, tagOutline } from './tagLook';

interface TagPromptProps {
  lang: Language;
  setNumber: number;
  exerciseName: string;
  // The rest timer sits right below: keep a clear gap to its +15s / Skip buttons
  hasTimerBelow: boolean;
  onTag: (tag: SetTag) => void;
  onDismiss: () => void;
}

// "How did set 2 feel?" right after a tick: one tap on Easy / Good / Max saves the tag (it then shows on the
// tick button). Its own line above the rest timer, 12px apart, blue-tinted with outlined pills, so it never
// looks like the timer's grey +15s / Skip buttons. It never touches the timer.
export const TagPrompt: React.FC<TagPromptProps> = ({ lang, setNumber, exerciseName, hasTimerBelow, onTag, onDismiss }) => {
  const t = uiTranslations[lang];
  return (
    <div className={`max-w-4xl mx-auto px-3 pt-2 ${hasTimerBelow ? 'pb-1' : 'pb-2'} pointer-events-auto`}>
      <div
        role="group"
        aria-labelledby="tag-prompt-question"
        data-tag-prompt
        className="rounded-2xl border border-sky-400/30 bg-[#0e141b]/95 backdrop-blur-md shadow-2xl shadow-black/60 pl-2.5 pr-1.5 py-1.5"
      >
        <p id="tag-prompt-question" className="h-5 flex items-center gap-1.5 text-xs min-w-0">
          <Tag aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-sky-300" />
          <span className="shrink-0 font-bold text-sky-50">{t.tagPromptQuestion(setNumber)}</span>
          <span className="min-w-0 truncate text-sky-200/60">· {exerciseName}</span>
        </p>
        <div className="mt-1 flex items-center gap-2">
          {TAG_ORDER.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTag(tag)}
              data-tag-prompt-choice={tag}
              className={`flex-1 min-w-0 h-11 px-1 rounded-full border-2 bg-transparent text-sm font-bold flex items-center justify-center gap-1 cursor-pointer ${tagOutline[tag]}`}
            >
              {tag === 'max' && <Flag aria-hidden="true" className="w-4 h-4 shrink-0" />}
              <span className="truncate">{t.tagNames[tag]}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t.tagPromptDismiss}
            title={t.tagPromptDismiss}
            data-tag-prompt-dismiss
            className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-sky-200/70 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
