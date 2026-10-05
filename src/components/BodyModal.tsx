import React, { useEffect, useRef, useState } from 'react';
import { Language, uiTranslations, UiTranslations } from '../data/translations';
import {
  BodyEntry, BodyProblem, displayBodyWeight, displayLength, lengthUnitFor, limitsIn, localDay, sortedDays,
} from '../lib/body';
import { AppDataV3 } from '../lib/model';
import type { BodyEntryRequest, BodyResult, HeightResult } from '../lib/store/appDataStore';
import { WeightUnit } from '../lib/units';
import { formatLocalDay } from '../lib/weeks';
import { AlertTriangle, CheckCircle2, PencilLine, RefreshCw, Ruler, Trash2, X } from 'lucide-react';

interface BodyModalProps {
  isOpen: boolean;
  lang: Language;
  data: AppDataV3;
  weightUnit: WeightUnit;
  onSaveEntry: (request: BodyEntryRequest) => BodyResult;
  onDeleteEntry: (day: string) => { ok: boolean; reason?: 'savingOff' | 'saveFailed'; updatedFromOtherTab: boolean };
  onSetHeight: (text: string) => HeightResult;
  // another tab's newer data was taken in first (the page shows its notice too)
  onUpdatedFromOtherTab: () => void;
  onClose: () => void;
}

type Field = 'weight' | 'waist' | 'hips';
const FIELDS: Field[] = ['weight', 'waist', 'hips'];
const PAGE = 30;

// "72.4 kg · waist 80 cm · hips 95 cm" in the unit shown now
export const entryText = (entry: BodyEntry, unit: WeightUnit, t: UiTranslations): string => {
  const length = lengthUnitFor(unit);
  const parts = [`${displayBodyWeight(entry.weight, unit)} ${unit}`];
  if (entry.waist) parts.push(t.bodyWaistShort(`${displayLength(entry.waist, length)} ${length}`));
  if (entry.hips) parts.push(t.bodyHipsShort(`${displayLength(entry.hips, length)} ${length}`));
  return parts.join(' · ');
};

const inputClass =
  'w-full h-11 rounded-xl border bg-[#18181c] pl-3 pr-12 text-base text-white placeholder:text-zinc-600 focus:outline-none';

// The Body screen: add / edit an entry (weight, optional waist and hips) for a day, the weight chart, the
// height, and the list of entries (newest first, 30 at a time). Everything is saved right away on the
// newest data; an existing day is never overwritten without asking (again, if another tab changed it).
export const BodyModal: React.FC<BodyModalProps> = ({ isOpen, lang, data, weightUnit, onSaveEntry, onDeleteEntry, onSetHeight, onUpdatedFromOtherTab, onClose }) => {
  const t = uiTranslations[lang];
  const length = lengthUnitFor(weightUnit);
  const today = localDay(new Date());
  const emptyForm = () => ({ day: localDay(new Date()), weight: '', waist: '', hips: '' });
  const [form, setForm] = useState(emptyForm);
  // Editing an existing entry: its day and values as they were
  const [editing, setEditing] = useState<{ day: string; entry: BodyEntry; shown: Record<Field, string> } | null>(null);
  const [problems, setProblems] = useState<BodyProblem[]>([]);
  const [replace, setReplace] = useState<{ day: string; existing: BodyEntry } | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [otherTab, setOtherTab] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [heightEdit, setHeightEdit] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  // A fresh, empty screen every time it opens
  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyForm());
    setEditing(null);
    setProblems([]);
    setReplace(null);
    setMessage(null);
    setOtherTab(false);
    setDeleting(null);
    setShown(PAGE);
    setHeightEdit(null);
    setHeightError(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const entries = data.body?.entries ?? {};
  const days = sortedDays(data.body);
  const height = data.body?.height;

  const problemText = (problem: BodyProblem): string => {
    if (problem.field === 'day') return t.bodyProblem[problem.problem];
    if (problem.problem !== 'outOfRange') return t.bodyProblem[problem.problem];
    const unit = problem.field === 'weight' ? weightUnit : length;
    const [low, high] = limitsIn(problem.field, unit);
    return t.bodyProblem.outOfRange(problem.field, low, high, unit);
  };
  const problemFor = (field: 'day' | Field) => problems.find((p) => p.field === field);

  const tookNewerData = (result: { updatedFromOtherTab: boolean }) => {
    if (result.updatedFromOtherTab) {
      setOtherTab(true);
      onUpdatedFromOtherTab();
    }
  };

  const failure = (reason: string): string =>
    reason === 'atCap' ? t.bodyAtCap : reason === 'savingOff' ? t.swapSavingOff : t.changeSaveFailed;

  const save = (expected?: BodyEntry) => {
    setMessage(null);
    const request: BodyEntryRequest = { ...form, unit: weightUnit };
    if (editing) {
      request.previousDay = editing.day;
      request.original = editing.entry;
      request.unchanged = FIELDS.filter((field) => form[field] === editing.shown[field]);
      // Editing in place: what the person loaded is what they replace
      if (expected === undefined && form.day === editing.day) request.expected = editing.entry;
    }
    if (expected) request.expected = expected;
    const result = onSaveEntry(request);
    tookNewerData(result);
    if (result.ok) {
      setProblems([]);
      setReplace(null);
      setEditing(null);
      setForm(emptyForm());
      setMessage({ tone: 'ok', text: t.bodySaved });
      return;
    }
    if (result.reason === 'invalid') {
      setProblems(result.problems);
      setReplace(null);
      // focus the first field with a problem
      const first = result.problems[0]?.field;
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>(`[data-body-field="${first}"]`)?.focus());
      return;
    }
    setProblems([]);
    if (result.reason === 'exists') {
      setReplace({ day: form.day, existing: result.existing });
      return;
    }
    setReplace(null);
    setMessage({ tone: 'error', text: failure(result.reason) });
  };

  const startEdit = (day: string) => {
    const entry = entries[day];
    const shownValues: Record<Field, string> = {
      weight: displayBodyWeight(entry.weight, weightUnit),
      waist: entry.waist ? displayLength(entry.waist, length) : '',
      hips: entry.hips ? displayLength(entry.hips, length) : '',
    };
    setEditing({ day, entry, shown: shownValues });
    setForm({ day, ...shownValues });
    setProblems([]);
    setReplace(null);
    setMessage(null);
    setDeleting(null);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyForm());
    setProblems([]);
    setReplace(null);
  };

  const confirmDelete = (day: string) => {
    const result = onDeleteEntry(day);
    tookNewerData(result);
    setDeleting(null);
    if (result.ok) {
      if (editing?.day === day) cancelEdit();
      setMessage({ tone: 'ok', text: t.bodyDeleted });
    } else setMessage({ tone: 'error', text: failure(result.reason ?? 'saveFailed') });
  };

  const saveHeight = (text: string) => {
    const result = onSetHeight(text);
    tookNewerData(result);
    if (result.ok) {
      setHeightEdit(null);
      setHeightError(null);
      return;
    }
    const [low, high] = limitsIn('height', length);
    setHeightError(
      result.reason === 'notNumber' ? t.bodyProblem.notNumber : result.reason === 'outOfRange' ? t.bodyProblem.outOfRange('height', low, high, length) : failure(result.reason)
    );
  };

  const numberField = (field: Field, label: string, unit: string, optional: boolean) => {
    const problem = problemFor(field);
    const id = `body-${field}`;
    return (
      <div>
        <label htmlFor={id} className="block text-xs font-bold text-zinc-300 mb-1">
          {label}
          {optional && <span className="font-normal text-zinc-500"> · {t.bodyOptional}</span>}
        </label>
        <div className="relative">
          <input
            id={id}
            data-body-field={field}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={form[field]}
            onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `${id}-problem` : undefined}
            className={`${inputClass} ${problem ? 'border-rose-500' : 'border-zinc-700 focus:border-emerald-500'}`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">{unit}</span>
        </div>
        {problem && (
          <p id={`${id}-problem`} data-body-problem={field} className="mt-1 text-xs text-rose-300 leading-snug">
            {problemText(problem)}
          </p>
        )}
      </div>
    );
  };

  const dayProblem = problemFor('day');

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="body-title" data-body-screen className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#121215] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-5 max-h-[94vh] flex flex-col">
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="shrink-0 mb-3 pr-12">
          <div className="flex items-center gap-2.5">
            <Ruler className="w-5 h-5 text-emerald-400 shrink-0" />
            <h3 id="body-title" className="text-lg font-extrabold text-white font-['Plus_Jakarta_Sans']">
              {t.bodyTitle}
            </h3>
          </div>
          <p className="mt-1 text-xs text-zinc-400 leading-snug">{t.bodyPrivate}</p>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar -mx-1 px-1 space-y-4">
          {otherTab && (
            <p role="status" data-body-other-tab className="flex items-start gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs leading-snug text-sky-100">
              <RefreshCw className="w-4 h-4 shrink-0 mt-px text-sky-300" />
              <span>{t.updatedFromOtherTabNeutral}</span>
            </p>
          )}

          {/* Add / edit an entry */}
          <section ref={formRef} aria-labelledby="body-form-title" data-body-form className="rounded-xl border border-[#27272a] bg-[#0d0d10] p-3 space-y-3">
            <h4 id="body-form-title" className="text-xs font-extrabold uppercase tracking-wider text-white">
              {editing ? t.bodyEditEntry : t.bodyAddEntry}
            </h4>
            <div>
              <label htmlFor="body-day" className="block text-xs font-bold text-zinc-300 mb-1">
                {t.bodyDate}
              </label>
              <input
                id="body-day"
                data-body-field="day"
                type="date"
                max={today}
                value={form.day}
                onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}
                aria-invalid={dayProblem ? true : undefined}
                aria-describedby={dayProblem ? 'body-day-problem' : undefined}
                className={`${inputClass} pr-3 [color-scheme:dark] ${dayProblem ? 'border-rose-500' : 'border-zinc-700 focus:border-emerald-500'}`}
              />
              {dayProblem && (
                <p id="body-day-problem" data-body-problem="day" className="mt-1 text-xs text-rose-300 leading-snug">
                  {problemText(dayProblem)}
                </p>
              )}
            </div>
            {numberField('weight', t.bodyWeight, weightUnit, false)}
            <div className="grid grid-cols-2 gap-2">
              {numberField('waist', t.bodyWaist, length, true)}
              {numberField('hips', t.bodyHips, length, true)}
            </div>

            {replace ? (
              <div role="alertdialog" aria-labelledby="body-replace-q" data-body-replace className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <p id="body-replace-q" className="text-sm font-bold text-amber-100">
                  {t.bodyReplaceQuestion(formatLocalDay(replace.day, lang))}
                </p>
                <p data-body-replace-has className="text-xs text-amber-100/80">{t.bodyReplaceHas(entryText(replace.existing, weightUnit, t))}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setReplace(null)} className="min-h-[44px] px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer">
                    {t.cancel}
                  </button>
                  <button type="button" data-body-replace-confirm onClick={() => save(replace.existing)} className="min-h-[44px] px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold cursor-pointer">
                    {t.bodyReplace}
                  </button>
                </div>
              </div>
            ) : (
              <div className={editing ? 'grid grid-cols-2 gap-2' : ''}>
                {editing && (
                  <button type="button" onClick={cancelEdit} className="min-h-[44px] w-full px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer">
                    {t.cancel}
                  </button>
                )}
                <button type="button" data-body-save onClick={() => save()} className="min-h-[44px] w-full px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-extrabold cursor-pointer">
                  {t.bodySave}
                </button>
              </div>
            )}

            <div aria-live="polite">
              {message && (
                <p data-body-message className={`flex items-start gap-2 text-xs leading-relaxed ${message.tone === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {message.tone === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />}
                  <span>{message.text}</span>
                </p>
              )}
            </div>
          </section>

          {/* Height */}
          <section aria-labelledby="body-height-title" data-body-height className="rounded-xl border border-[#27272a] bg-[#0d0d10] p-3">
            {heightEdit === null ? (
              <div className="flex items-center gap-2">
                <h4 id="body-height-title" className="text-xs font-extrabold uppercase tracking-wider text-white">
                  {t.bodyHeight}
                </h4>
                <span data-body-height-value className="flex-1 min-w-0 text-sm text-zinc-200 font-mono">
                  {height ? `${displayLength(height, length)} ${length}` : <span className="font-sans text-zinc-500">{t.bodyHeightNotSet}</span>}
                </span>
                <button type="button" data-body-height-edit onClick={() => { setHeightEdit(height ? displayLength(height, length) : ''); setHeightError(null); }} className="min-h-[44px] px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer">
                  {t.bodyEdit}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="body-height" id="body-height-title" className="block text-xs font-extrabold uppercase tracking-wider text-white">
                  {t.bodyHeight}
                </label>
                <div className="relative">
                  <input
                    id="body-height"
                    data-body-field="height"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={heightEdit}
                    onChange={(e) => setHeightEdit(e.target.value)}
                    aria-invalid={heightError ? true : undefined}
                    aria-describedby={heightError ? 'body-height-problem' : undefined}
                    className={`${inputClass} ${heightError ? 'border-rose-500' : 'border-zinc-700 focus:border-emerald-500'}`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">{length}</span>
                </div>
                {heightError && (
                  <p id="body-height-problem" data-body-problem="height" className="text-xs text-rose-300 leading-snug">
                    {heightError}
                  </p>
                )}
                <div className={`grid gap-2 ${height ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <button type="button" onClick={() => { setHeightEdit(null); setHeightError(null); }} className="min-h-[44px] px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer">
                    {t.cancel}
                  </button>
                  {height && (
                    <button type="button" data-body-height-remove onClick={() => saveHeight('')} className="min-h-[44px] px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer">
                      {t.bodyRemove}
                    </button>
                  )}
                  <button type="button" data-body-height-save onClick={() => saveHeight(heightEdit)} className="min-h-[44px] px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold cursor-pointer">
                    {t.remarkSave}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Entries, newest first, 30 at a time */}
          <section aria-labelledby="body-list-title" data-body-list>
            <h4 id="body-list-title" className="text-xs font-extrabold uppercase tracking-wider text-white mb-2">
              {t.bodyEntries(days.length)}
            </h4>
            {days.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-400 leading-relaxed">{t.bodyNoEntries}</p>
            ) : (
              <ul className="space-y-2">
                {days.slice(0, shown).map((day) => {
                  const entry = entries[day];
                  const dayText = formatLocalDay(day, lang);
                  return (
                    <li key={day} data-body-row={day} className="rounded-xl border border-[#27272a] bg-[#18181c] px-3 py-1.5">
                      {deleting === day ? (
                        <div className="py-1.5 space-y-2">
                          <p className="text-sm font-bold text-white">{t.bodyDeleteQuestion(dayText)}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setDeleting(null)} className="min-h-[44px] px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer">
                              {t.cancel}
                            </button>
                            <button type="button" data-body-delete-confirm onClick={() => confirmDelete(day)} className="min-h-[44px] px-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer">
                              {t.bodyDelete}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white">{dayText}</p>
                            <p data-body-row-values className="text-xs text-zinc-300 font-mono break-words">{entryText(entry, weightUnit, t)}</p>
                          </div>
                          <button type="button" data-body-edit onClick={() => startEdit(day)} aria-label={t.bodyEditLabel(dayText)} title={t.bodyEdit} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 cursor-pointer">
                            <PencilLine className="w-4 h-4" />
                          </button>
                          <button type="button" data-body-delete onClick={() => { setDeleting(day); setMessage(null); }} aria-label={t.bodyDeleteLabel(dayText)} title={t.bodyDelete} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-zinc-300 hover:text-rose-300 hover:bg-zinc-800 cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {days.length > shown && (
              <button type="button" data-body-more onClick={() => setShown((n) => n + PAGE)} className="mt-2 w-full min-h-[44px] px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer">
                {t.bodyShowMore(Math.min(PAGE, days.length - shown))}
              </button>
            )}
          </section>
        </div>

        <button type="button" onClick={onClose} className="w-full mt-3 min-h-[44px] bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl cursor-pointer shrink-0">
          {t.close}
        </button>
      </div>
    </div>
  );
};
