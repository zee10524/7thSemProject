import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface Toast {
  id: number;
  message: string;
  kind?: 'ok' | 'warn';
  action?: { label: string; run: () => void };
}

interface UiState {
  toasts: Toast[];
  searchOpen: boolean;
  reviewBookId: number | null;
  evidenceFor: { bookId: number; source: 'feed' | 'chat' } | null;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dropToast: (id: number) => void;
  setSearchOpen: (open: boolean) => void;
  openReview: (bookId: number) => void;
  closeReview: () => void;
}

let nextId = 1;

export const useUi = create<UiState>((set) => ({
  toasts: [],
  searchOpen: false,
  reviewBookId: null,
  evidenceFor: null,
  pushToast: (t) => set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id: nextId++ }] })),
  dropToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setSearchOpen: (open) => set({ searchOpen: open }),
  openReview: (bookId) => set({ reviewBookId: bookId }),
  closeReview: () => set({ reviewBookId: null }),
}));

export const toast = (message: string, extra: Omit<Toast, 'id' | 'message'> = {}) =>
  useUi.getState().pushToast({ message, ...extra });

/** Storage that never throws (private windows, blocked site data): falls back to memory. */
const safeStorage = createJSONStorage(() => {
  const memory = new Map<string, string>();
  return {
    getItem: (k) => {
      try {
        return window.localStorage.getItem(k);
      } catch {
        return memory.get(k) ?? null;
      }
    },
    setItem: (k, v) => {
      try {
        window.localStorage.setItem(k, v);
      } catch {
        memory.set(k, v);
      }
    },
    removeItem: (k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        memory.delete(k);
      }
    },
  };
});

interface Prefs {
  shelfView: 'grid' | 'list';
  setShelfView: (v: 'grid' | 'list') => void;
}

/** Per-browser conveniences only; everything that matters lives on the server. */
export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      shelfView: 'grid',
      setShelfView: (shelfView) => set({ shelfView }),
    }),
    { name: 'litsense.prefs.v1', storage: safeStorage },
  ),
);
