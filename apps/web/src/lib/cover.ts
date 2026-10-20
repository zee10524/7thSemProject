import type { BookDto, CoverStyle } from '@litsense/shared';

// Palettes in the spirit of the prototype's hand-made covers, for catalogue books that have none.
const PALETTES: [string, string, string, string][] = [
  ['#14283a', '#2f6f8f', '#f6efe3', '#f0b955'],
  ['#3b1f2b', '#8c3b4a', '#f7eadf', '#e9b38a'],
  ['#1f3326', '#4f7a55', '#f2efe2', '#d8c27a'],
  ['#2a231d', '#6b5b45', '#f5eee2', '#c98a2b'],
  ['#232a4a', '#55609a', '#f1edf7', '#f2c46b'],
  ['#4a2a12', '#a8532f', '#fbf1e4', '#f2d29b'],
  ['#102a2e', '#2f6e6a', '#eef5f1', '#e7b75f'],
  ['#2e1e3b', '#6d4a8c', '#f5eefa', '#e8b4c8'],
];
const MOTIFS = [
  'orbit',
  'sun',
  'arches',
  'pines',
  'waves',
  'stars',
  'dome',
  'books',
  'quill',
  'rings',
  'horizon',
  'laurel',
];
const LAYOUTS = ['center', 'top', 'frame', 'band', 'bold'];

function hash(n: number): number {
  let x = (n + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export function coverStyleFor(book: Pick<BookDto, 'bookId' | 'cover'>): CoverStyle {
  if (book.cover) return book.cover;
  const h = hash(book.bookId);
  const [c1, c2, ink, accent] = PALETTES[h % PALETTES.length] ?? PALETTES[0]!;
  return {
    c1,
    c2,
    ink,
    accent,
    motif: MOTIFS[(h >>> 4) % MOTIFS.length] ?? 'stars',
    layout: LAYOUTS[(h >>> 9) % LAYOUTS.length] ?? 'center',
    font: (h >>> 13) % 3 === 0 ? 'sans' : 'serif',
  };
}

/** Open Library serves -S/-M/-L sizes; small covers do not need the large file. */
export function coverUrl(image: string | null, size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): string | null {
  if (!image) return null;
  if (size === 'xs' || size === 'sm' || size === 'md') return image.replace(/-L\.jpg$/, '-M.jpg');
  return image;
}
