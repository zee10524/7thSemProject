export function ago(iso: string | number | Date): string {
  const t = new Date(iso).getTime();
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)} min ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)} h ago`;
  const d = h / 24;
  if (d < 2) return 'yesterday';
  if (d < 30) return `${Math.floor(d)} days ago`;
  const mo = d / 30;
  if (mo < 12) return `${Math.floor(mo)} month${Math.floor(mo) === 1 ? '' : 's'} ago`;
  return `${Math.floor(mo / 12)} year${Math.floor(mo / 12) === 1 ? '' : 's'} ago`;
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export function fmtCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

export function mastheadDate(d = new Date()): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export const pct = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 100);
