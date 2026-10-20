import type { ListStatus } from '@litsense/shared';
import { useLibrary } from '../api/hooks';
import type { IconName } from '../components/Icon';

export const STATUS: Record<ListStatus, { label: string; short: string; icon: IconName; pill: string }> = {
  want_to_read: { label: 'Want to Read', short: 'Want', icon: 'bookmark', pill: 'want' },
  currently_reading: { label: 'Currently Reading', short: 'Reading', icon: 'book-open', pill: 'reading' },
  read: { label: 'Read', short: 'Read', icon: 'check', pill: 'read' },
  dropped: { label: 'Did not finish', short: 'Dropped', icon: 'x', pill: 'want' },
};

/** The reader's relation to one book, from the cached library index. */
export function useShelf(bookId: number) {
  const lib = useLibrary();
  const entry = lib.data?.statuses[String(bookId)];
  return {
    status: entry?.status ?? null,
    progress: entry?.progress ?? null,
    stars: lib.data?.ratings[String(bookId)] ?? 0,
    dismissed: lib.data?.dismissed.includes(bookId) ?? false,
    reviewed: lib.data?.reviewed.includes(bookId) ?? false,
  };
}
