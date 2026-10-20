// Builds the mock catalogue fixture from the prototype's data.js (40 real books) plus a three-book
// series, so the mock model service can exercise the series guard. Run once after editing data.js:
//   node apps/api/scripts/build-fixture.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const dataJs = resolve(here, '../../../prototype/js/data.js');
const out = resolve(here, '../src/modelService/mock/catalog.fixture.json');

const ctx = { window: {} };
ctx.window.window = ctx.window;
vm.createContext(ctx);
vm.runInContext(readFileSync(dataJs, 'utf8'), ctx);
const D = ctx.window.LitSense.data;

const ASPECT_MAP = {
  plot: 'plot',
  writing: 'writing_style',
  characters: 'characters',
  world: 'world_building',
  pacing: 'pacing',
  editing: 'editing_quality',
  dialogue: 'dialogue',
  humor: 'humor',
  emotion: 'emotional_impact',
  ending: 'ending',
  complexity: 'complexity',
  darkness: 'tone_dark',
};

const titleCase = (g) =>
  g
    .split(' ')
    .map((w) =>
      w
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('-'),
    )
    .join(' ');

const aspects = (a) => Object.fromEntries(Object.entries(ASPECT_MAP).map(([k, v]) => [v, a[k]]));

const books = D.books.map((b, i) => {
  const genres = b.genres.map(titleCase);
  return {
    book_id: i,
    canonical_id: `proto_${b.id}`,
    slug: b.id,
    title: b.title,
    author: b.author,
    genres,
    primary_genre: genres[0],
    year: b.year,
    pages: b.pages,
    description: b.desc,
    image: b.cover && b.cover.id ? `https://covers.openlibrary.org/b/id/${b.cover.id}-L.jpg` : null,
    isbn13: null,
    series_id: null,
    series_name: null,
    series_pos: null,
    avg_rating: b.rating,
    ratings_count: b.ratingsK * 1000,
    tagline: b.tagline,
    moods: b.moods,
    cover: {
      c1: b.cover.c1,
      c2: b.cover.c2,
      ink: b.cover.ink,
      accent: b.cover.accent,
      motif: b.cover.motif,
      layout: b.cover.layout || 'center',
      font: b.cover.font || 'serif',
    },
    aspects: aspects(b.aspects),
    reviews: D.reviews
      .filter((r) => r.bookId === b.id && r.user !== 'u_me')
      .map((r) => ({ text: r.text, rating: r.rating })),
    neighbors: (D.neighbors[b.id] || [])
      .map((slug) => D.books.findIndex((x) => x.id === slug))
      .filter((n) => n >= 0),
  };
});

const ring = [
  [
    'The Fellowship of the Ring',
    1954,
    423,
    'A quiet hobbit inherits a ring that the whole world wants, and leaves home with a few friends to carry it somewhere it can be unmade.',
    'One small burden, one very long road.',
  ],
  [
    'The Two Towers',
    1954,
    352,
    'The fellowship is broken. Its scattered members face war in the west while two hobbits press on toward the shadowed land.',
    'The company is scattered; the road goes on.',
  ],
  [
    'The Return of the King',
    1955,
    416,
    'Armies gather at the last free city while the ring-bearer makes his way through the land he has dreaded all along.',
    'Every road ends somewhere.',
  ],
];
ring.forEach(([title, year, pages, description, tagline], j) => {
  books.push({
    book_id: books.length,
    canonical_id: `proto_lotr_${j + 1}`,
    slug: title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    title,
    author: 'J.R.R. Tolkien',
    genres: ['Fantasy', 'Epic'],
    primary_genre: 'Fantasy',
    year,
    pages,
    description,
    image: null,
    isbn13: null,
    series_id: 'proto_s_lotr',
    series_name: 'The Lord of the Rings',
    series_pos: j + 1,
    avg_rating: [4.5, 4.5, 4.6][j],
    ratings_count: [3000000, 1200000, 1100000][j],
    tagline,
    moods: ['adventurous', 'atmospheric', 'hopeful'],
    cover: {
      c1: '#2b2a1f',
      c2: '#6b5b2e',
      ink: '#f3e9cf',
      accent: '#d9a441',
      motif: ['rings', 'towers', 'dome'][j],
      layout: 'center',
      font: 'serif',
    },
    aspects: {
      plot: 88,
      writing_style: 90,
      characters: 86,
      world_building: 99,
      pacing: 48 + 6 * j,
      editing_quality: 90,
      dialogue: 74,
      humor: 52 - 8 * j,
      emotional_impact: 84 + 4 * j,
      ending: 80 + 8 * j,
      complexity: 78,
      tone_dark: 50 + 10 * j,
    },
    reviews: [],
    neighbors: [],
  });
});

writeFileSync(out, JSON.stringify({ source: 'prototype', books }, null, 1) + '\n', 'utf8');
console.log(`wrote ${books.length} books to ${out}`);
