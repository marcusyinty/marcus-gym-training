import { useEffect, useState, useSyncExternalStore } from 'react';
import { getDefaultStorage, onPageHide } from '../lib/storage';
import { createAppDataStore } from '../lib/store/appDataStore';
import { STORAGE_KEY_V3 } from '../lib/store/dataV3';

// Ids for new weeks. crypto.randomUUID is missing on non-secure pages (e.g. http://<LAN-IP> on a phone).
const makeId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (e) {
    // fall through
  }
  return `cycle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

// The app's workout data (one AppDataV3 object). Loaded once; changes go through dispatch and are saved
// to the v3 key 300ms after the last change, and right away when the page is hidden or closed.
// Data saved by another open tab is adopted without writing it back, also when this page missed the news
// (it checks again whenever it is shown). `restore` replaces everything with a backup's data (keeping a
// safety copy of the current data first); `startNewWeek` archives the week and `swapExercise` picks the
// exercise a slot does this week, both saved right away.
// `replacedCount` goes up whenever the data is replaced as a whole, so the weekly report doesn't pop up for
// it; `droppedChangeCount` goes up when an unsaved change here lost to another tab's newer save.
export function useAppData() {
  const [store] = useState(() => createAppDataStore({ storage: getDefaultStorage(), now: () => new Date(), makeId }));
  const data = useSyncExternalStore(store.subscribe, store.getState);
  const savingDisabled = useSyncExternalStore(store.subscribe, store.isSavingDisabled);
  const replacedCount = useSyncExternalStore(store.subscribe, store.getReplacedCount);
  const droppedChangeCount = useSyncExternalStore(store.subscribe, store.getDroppedChangeCount);

  useEffect(() => {
    store.saveMigrated();
    const stopListeningForPageHide = onPageHide(store.flush);
    const handleStorageChange = (e: StorageEvent) => {
      // e.key is null when another tab cleared all storage: keep what we have
      if (e.key !== STORAGE_KEY_V3 || e.storageArea !== getDefaultStorage()) return;
      store.receiveExternal(e.newValue);
    };
    // Back on screen (tab switch, or a page restored from the browser's cache): pick up what others saved
    const handleVisible = () => {
      if (document.visibilityState === 'visible') store.syncFromStorage();
    };
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('pageshow', store.syncFromStorage);
    return () => {
      stopListeningForPageHide();
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('pageshow', store.syncFromStorage);
      store.flush();
    };
  }, [store]);

  return {
    data,
    savingDisabled,
    replacedCount,
    droppedChangeCount,
    dispatch: store.dispatch,
    restore: store.restore,
    startNewWeek: store.startNewWeek,
    swapExercise: store.swapExercise,
  };
}
