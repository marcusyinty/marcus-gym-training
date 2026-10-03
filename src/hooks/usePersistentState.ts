import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { createDebouncedWriter, getDefaultStorage, onPageHide, safeRead, StoredItem } from '../lib/storage';

// Like useState, but loaded from and saved to localStorage. Saves are debounced (300ms) and flushed
// right away when the page is hidden or closed. Changes saved by another open tab are picked up too.
// `item` must be defined outside components so it is the same object on every render.
export function usePersistentState<T>(item: StoredItem<T>): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => safeRead(item));
  const [writer] = useState(() => createDebouncedWriter(item));
  // Last value that is already in storage or scheduled to be saved. Starts as the loaded value,
  // so a page load never triggers a save.
  const handledValueRef = useRef<T>(value);

  useEffect(() => {
    if (value === handledValueRef.current) return;
    handledValueRef.current = value;
    writer.schedule(value);
  }, [value, writer]);

  useEffect(() => {
    const stopListeningForPageHide = onPageHide(writer.flush);

    const handleStorageChange = (e: StorageEvent) => {
      // e.key is null when another tab cleared all of localStorage
      if (e.key !== item.key && e.key !== null) return;
      if (e.storageArea !== getDefaultStorage()) return;
      // The other tab's save is newer, so it replaces anything still waiting to be saved here
      writer.cancel();
      const next = safeRead(item);
      handledValueRef.current = next;
      setValue(next);
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      stopListeningForPageHide();
      window.removeEventListener('storage', handleStorageChange);
      writer.flush();
    };
  }, [item, writer]);

  return [value, setValue];
}
