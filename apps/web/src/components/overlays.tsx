import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUi } from '../store/ui';
import { Icon, type IconName } from './Icon';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useBodyLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add('is-locked');
    return () => document.body.classList.remove('is-locked');
  }, [active]);
}

/** Accessible dialog: focus moves in, Tab stays inside, Escape or the backdrop closes, focus returns. */
export function Modal({
  open,
  onClose,
  labelledBy,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [shown, setShown] = useState(false);
  useBodyLock(open);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const last = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      setShown(true);
      const first = panel.current?.querySelector<HTMLElement>(
        'textarea, input, select, button:not(.modal__close)',
      );
      (first ?? panel.current)?.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab' || !panel.current) return;
      const nodes = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = nodes[0];
      const lastNode = nodes.at(-1);
      if (!first || !lastNode) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      last?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className={`modal${shown ? ' is-open' : ''}`}>
      <div className="modal__backdrop" onClick={onClose} />
      <div
        ref={panel}
        className={`modal__panel${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        <button type="button" className="modal__close" onClick={onClose} aria-label="Close dialog">
          <Icon name="x" size={20} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export interface MenuItem {
  label: string;
  icon?: IconName;
  active?: boolean;
  danger?: boolean;
  separator?: boolean;
  onSelect?: () => void;
}

/** Popover menu anchored to a button; a bottom sheet on phones. Arrow keys move, Escape closes. */
export function Menu({
  anchor,
  items,
  title,
  onClose,
}: {
  anchor: HTMLElement;
  items: MenuItem[];
  title?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [shown, setShown] = useState(false);
  const sheet = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches;

  useLayoutEffect(() => {
    if (sheet || !ref.current) return;
    const r = anchor.getBoundingClientRect();
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    setPos({ left, top });
  }, [anchor, sheet]);

  useEffect(() => {
    anchor.setAttribute('aria-expanded', 'true');
    const raf = requestAnimationFrame(() => {
      setShown(true);
      ref.current?.querySelector<HTMLElement>('.menu__item')?.focus({ preventScroll: true });
    });
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRef.current();
        anchor.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const nodes = [...(ref.current?.querySelectorAll<HTMLElement>('.menu__item') ?? [])];
        const i = nodes.indexOf(document.activeElement as HTMLElement);
        const next = nodes[(i + (e.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length];
        next?.focus();
      }
    };
    const onScroll = () => closeRef.current();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    if (!sheet) window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      anchor.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, [anchor, sheet]);

  return createPortal(
    <>
      {sheet && <div className="menu-backdrop" onClick={onClose} />}
      <div
        ref={ref}
        role="menu"
        className={`menu${sheet ? ' menu--sheet' : ''}${shown ? ' is-in' : ''}`}
        style={sheet ? undefined : { left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      >
        {title && <p className="menu__title">{title}</p>}
        {items.map((it, i) =>
          it.separator ? (
            <hr key={`sep-${i}`} className="menu__sep" />
          ) : (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={`menu__item${it.active ? ' is-active' : ''}${it.danger ? ' is-danger' : ''}`}
              onClick={() => {
                onClose();
                it.onSelect?.();
              }}
            >
              {it.icon && <Icon name={it.icon} size={17} stroke={1.9} />}
              <span>{it.label}</span>
              {it.active && <Icon name="check" size={16} stroke={2.2} />}
            </button>
          ),
        )}
      </div>
    </>,
    document.body,
  );
}

function ToastView({
  id,
  message,
  kind,
  action,
}: {
  id: number;
  message: string;
  kind?: 'ok' | 'warn';
  action?: { label: string; run: () => void };
}) {
  const drop = useUi((s) => s.dropToast);
  const [phase, setPhase] = useState<'enter' | 'in' | 'out'>('enter');
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase('in'));
    const t = setTimeout(() => setPhase('out'), action ? 6000 : 3400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [action]);
  useEffect(() => {
    if (phase !== 'out') return;
    const t = setTimeout(() => drop(id), 360);
    return () => clearTimeout(t);
  }, [phase, drop, id]);
  return (
    <div
      className={`toast${kind === 'warn' ? ' toast--warn' : ''}${phase === 'in' ? ' is-in' : ''}${phase === 'out' ? ' is-out' : ''}`}
      role="status"
    >
      <span className="toast__icon">
        <Icon name={kind === 'warn' ? 'info' : 'check'} size={18} stroke={2.2} />
      </span>
      <span className="toast__text">{message}</span>
      {action && (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            action.run();
            setPhase('out');
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <ToastView key={t.id} {...t} />
      ))}
    </div>
  );
}
