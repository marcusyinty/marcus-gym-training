import React, { useEffect, useRef, useState } from 'react';
import { Language, uiTranslations } from '../data/translations';
import { AppDataV3 } from '../lib/model';
import { RestoreResult } from '../lib/store/appDataStore';
import { createBackupFile, MAX_BACKUP_BYTES, ParsedBackup, parseBackupFile, summarizeData } from '../lib/store/backup';
import { AlertTriangle, CheckCircle2, Database, Download, History, Ruler, Upload } from 'lucide-react';

type ReadyBackup = Extract<ParsedBackup, { ok: true }>;
type Message = { tone: 'ok' | 'error'; text: string };

interface DataBackupSectionProps {
  lang: Language;
  data: AppDataV3;
  savingDisabled: boolean;
  onRestore: (data: AppDataV3) => RestoreResult;
  onOpenHistory: () => void;
  onOpenBody: () => void;
}

// Reads a picked file as text (File.text() is missing on older phones)
const readFileText = (file: File): Promise<string> =>
  typeof file.text === 'function'
    ? file.text()
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });

// A normal browser download: Downloads on Android, Files > Downloads on iPhone
const downloadTextFile = (fileName: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some phones start the download a moment later, so the file's address is freed only after a while
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const formatDate = (iso: string, lang: Language) => {
  try {
    return new Date(iso).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) {
    return iso;
  }
};

// "Your data" in the About modal: save all workout data to a backup file, or replace it with one.
// Nothing changes until the user confirms in the comparison panel; settings are not part of a backup.
export const DataBackupSection: React.FC<DataBackupSectionProps> = ({ lang, data, savingDisabled, onRestore, onOpenHistory, onOpenBody }) => {
  const t = uiTranslations[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreButtonRef = useRef<HTMLButtonElement>(null);
  const confirmTitleRef = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState<ReadyBackup | null>(null);

  // Screen readers and keyboards land on the question when it opens
  useEffect(() => {
    if (pending) confirmTitleRef.current?.focus();
  }, [pending]);

  const handleBackup = () => {
    try {
      const { fileName, text } = createBackupFile(data, new Date());
      downloadTextFile(fileName, text);
      setMessage({ tone: 'ok', text: t.backupSaved(fileName) });
    } catch (e) {
      setMessage({ tone: 'error', text: t.backupFailed });
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so picking the same file again still works
    if (!file) return;
    setPending(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setMessage({ tone: 'error', text: t.restoreErrors.tooLarge });
      return;
    }
    let text: string;
    try {
      text = await readFileText(file);
    } catch (err) {
      setMessage({ tone: 'error', text: t.restoreErrors.readFailed });
      return;
    }
    const parsed = parseBackupFile(text);
    if (!parsed.ok) {
      setMessage({ tone: 'error', text: t.restoreErrors[parsed.error] });
      return;
    }
    setMessage(null);
    setPending(parsed);
  };

  const handleCancel = () => {
    setPending(null);
    requestAnimationFrame(() => restoreButtonRef.current?.focus());
  };

  const handleConfirm = () => {
    if (!pending) return;
    const result = onRestore(pending.data);
    setPending(null);
    setMessage(result.ok ? { tone: 'ok', text: t.restoreDone } : { tone: 'error', text: t.restoreErrors[result.error] });
  };

  const current = summarizeData(data);
  const cardClass = 'rounded-lg bg-[#18181c] border border-[#27272a] p-2.5';

  return (
    // `relative` keeps the visually hidden file input inside the scroll area, so it never makes the box scrollable
    <section aria-labelledby="data-section-title" className="relative bg-[#09090b] border border-[#222227] rounded-xl p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-emerald-400 shrink-0" />
        <h4 id="data-section-title" className="text-xs font-extrabold uppercase tracking-wider text-white">
          {t.dataSectionTitle}
        </h4>
      </div>
      <p className="text-xs text-zinc-300 leading-relaxed">{t.dataSectionText}</p>

      {pending ? (
        <div role="group" aria-labelledby="restore-confirm-title" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
          <h5 id="restore-confirm-title" ref={confirmTitleRef} tabIndex={-1} className="text-sm font-bold text-white outline-none">
            {t.restoreConfirmTitle}
          </h5>
          <dl className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
            <div className={cardClass}>
              <dt className="text-xs font-bold text-emerald-400">{t.restoreFromFile}</dt>
              <dd className="text-xs text-zinc-400 mt-1">
                {pending.exportedAt ? t.restoreBackupDate(formatDate(pending.exportedAt, lang)) : t.restoreUnknownDate}
              </dd>
              <dd className="text-xs font-semibold text-white mt-0.5">
                {t.restoreCounts(pending.summary.weeks, pending.summary.tickedSets)}
              </dd>
            </div>
            <div className={cardClass}>
              <dt className="text-xs font-bold text-zinc-300">{t.restoreOnPhone}</dt>
              <dd className="text-xs font-semibold text-white mt-1">
                {savingDisabled ? t.restoreOnPhoneUnreadable : t.restoreCounts(current.weeks, current.tickedSets)}
              </dd>
            </div>
          </dl>
          {pending.droppedAny && <p className="text-xs text-zinc-300 leading-relaxed">{t.restoreDropped}</p>}
          {/* Notes: a backup made before notes existed keeps this phone's notes; any other replaces them */}
          <p data-restore-remarks className="text-xs text-zinc-300 leading-relaxed">
            {pending.keepsCurrentRemarks ? t.restoreRemarksKept : t.restoreRemarksReplaced}
          </p>
          {/* Body measurements: the same rule (a backup made before they existed keeps this phone's) */}
          <p data-restore-body className="text-xs text-zinc-300 leading-relaxed">
            {pending.keepsCurrentBody ? t.restoreBodyKept : t.restoreBodyReplaced}
          </p>
          <p className="flex items-start gap-2 text-xs text-amber-200 leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-amber-400" />
            <span>{t.restoreWarning}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="min-h-[44px] px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold leading-tight cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="min-h-[44px] px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold leading-tight cursor-pointer"
            >
              {t.restoreConfirmButton}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleBackup}
            disabled={savingDisabled}
            aria-describedby={savingDisabled ? 'backup-unavailable' : undefined}
            className="w-full min-h-[44px] px-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold cursor-pointer disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 shrink-0" />
            {t.backupButton}
          </button>
          {savingDisabled && (
            <p id="backup-unavailable" className="text-xs text-amber-200 leading-relaxed">
              {t.backupUnavailable}
            </p>
          )}
          <button
            type="button"
            ref={restoreButtonRef}
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[44px] px-3 flex items-center justify-center gap-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer"
          >
            <Upload className="w-4 h-4 shrink-0" />
            {t.restoreButton}
          </button>
          {/* Past weeks and body measurements: side by side from 360px, stacked below (the 中文 labels would wrap) */}
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenHistory}
              className="w-full min-h-[44px] px-2 flex items-center justify-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer"
            >
              <History className="w-4 h-4 shrink-0" />
              {t.pastWeeksButton(data.archivedCycles.length)}
            </button>
            <button
              type="button"
              onClick={onOpenBody}
              aria-haspopup="dialog"
              data-body-open-about
              className="w-full min-h-[44px] px-2 flex items-center justify-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-bold cursor-pointer"
            >
              <Ruler className="w-4 h-4 shrink-0" />
              {t.bodyButton(Object.keys(data.body?.entries ?? {}).length)}
            </button>
          </div>
        </div>
      )}

      <div aria-live="polite" aria-atomic="true">
        {message && (
          <p
            className={`flex items-start gap-2 text-xs leading-relaxed ${message.tone === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}
          >
            {message.tone === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-px text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-rose-400" />
            )}
            <span>{message.text}</span>
          </p>
        )}
      </div>

      {/* Opened by the Restore button; visually hidden but still in the page so every phone opens it */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFilePicked}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
    </section>
  );
};
