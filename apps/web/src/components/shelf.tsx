import { useState } from 'react';
import type { BookDto, ListStatus } from '@litsense/shared';
import { useDismiss, useSetStatus } from '../api/hooks';
import { STATUS, useShelf } from '../lib/shelfState';
import { toast } from '../store/ui';
import { Icon, type IconName } from './Icon';
import { Menu, type MenuItem } from './overlays';

export function StatusPill({ status }: { status: ListStatus }) {
  const s = STATUS[status];
  return (
    <span className={`pill pill--${s.pill}`}>
      <Icon name={s.icon} size={13} stroke={2} />
      <span>{s.label}</span>
    </span>
  );
}

/** Shelf menu: every status, take off the shelves, and "not for me" (a contract dismissal). */
export function ShelfControl({ book, short = false }: { book: BookDto; short?: boolean }) {
  const { status, progress } = useShelf(book.bookId);
  const setStatus = useSetStatus();
  const dismiss = useDismiss();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const choose = (next: ListStatus | null) => {
    setStatus.mutate(
      { bookId: book.bookId, status: next },
      {
        onSuccess: () =>
          toast(next ? `${book.title} is on ${STATUS[next].label}` : `${book.title} left your shelves`),
      },
    );
  };

  const items: MenuItem[] = [
    ...(Object.keys(STATUS) as ListStatus[]).map((s) => ({
      label: STATUS[s].label,
      icon: STATUS[s].icon,
      active: status === s,
      onSelect: () => choose(s),
    })),
    { label: '', separator: true },
    ...(status
      ? [{ label: 'Remove from shelves', icon: 'trash' as IconName, onSelect: () => choose(null) }]
      : []),
    { label: 'Not for me', icon: 'eye-off', danger: true, onSelect: () => dismiss.mutate(book.bookId) },
  ];

  const menu = anchor && (
    <Menu anchor={anchor} title={book.title} items={items} onClose={() => setAnchor(null)} />
  );

  if (!status) {
    return (
      <div className="shelf-ctl">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={setStatus.isPending}
          onClick={() => choose('want_to_read')}
        >
          <Icon name="plus" size={15} stroke={2} />
          <span>{short ? 'Want to Read' : 'Add to Want to Read'}</span>
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--icon btn--sm"
          aria-haspopup="menu"
          aria-label={`More shelf options for ${book.title}`}
          onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        >
          <Icon name="chevron-down" size={16} />
        </button>
        {menu}
      </div>
    );
  }
  const s = STATUS[status];
  return (
    <div className="shelf-ctl is-set">
      <button
        type="button"
        className={`btn btn--soft btn--sm is-${s.pill}`}
        aria-haspopup="menu"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <Icon name={s.icon} size={15} stroke={2} />
        <span>
          {s.label}
          {status === 'currently_reading' && progress !== null ? ` · ${progress}%` : ''}
        </span>
        <Icon name="chevron-down" size={14} />
      </button>
      {menu}
    </div>
  );
}

export function DismissButton({ book }: { book: BookDto }) {
  const dismiss = useDismiss();
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm btn--dismiss"
      onClick={() => dismiss.mutate(book.bookId)}
      disabled={dismiss.isPending}
      aria-label={`Not for me: hide ${book.title} from recommendations`}
      title="Not for me"
    >
      <Icon name="eye-off" size={15} />
      <span>Not for me</span>
    </button>
  );
}
