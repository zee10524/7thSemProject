# LitSense frontend prototype

**A review-aware, explainable and conversational book recommendation system.**

This is a frontend-only prototype built with plain HTML, CSS and vanilla JavaScript.
It has no backend, no API calls, no database and no build step. Everything the
"recommendation engine" and the "chatbot" say comes from small, readable mock code.

The goal is a demo you can show to teammates and teachers, and a UI foundation you
can port to the MERN stack later.

- 7 pages: Discover, My Books, Recommendations, Recent Reads, Ask LitSense, Book Details, Reader DNA
- 3 visual directions on the same functionality: Dark Literary, Warm Editorial, Reader OS
- 40 books with real authors, genres, page counts, ratings and 12 literary aspect scores each

---

## 1. How to run

**Double-click `index.html`.** It opens straight from disk in any modern browser.
Scripts are classic scripts (not ES modules), so `file://` works without a server.

If you prefer a local server (any of these works):

```bash
python -m http.server 5173
```

```bash
npx serve .
```

Then open `http://localhost:5173`.

### Presenting tips

| Want to | Do this |
| --- | --- |
| Switch visual direction | Use **Prototype demo** at the top right, or add `?demo=1`, `?demo=2` or `?demo=3` to the URL |
| Play the example chat | Open **Ask LitSense** and click "Play the example conversation", or open `index.html?chatdemo=1#/chat` |
| Search from anywhere | Press `/` (or `Ctrl+K`) |
| Start from a clean state | Click **Reset** at the top right |
| Go to a page directly | `#/discover`, `#/my-books`, `#/recommendations`, `#/recent`, `#/chat`, `#/book/project-hail-mary`, `#/profile` |

The prototype saves your demo choice, shelves, ratings and reviews in `localStorage`
(key `litsense.prototype.v1`). If storage is blocked, it keeps working in memory.

### Requirements and notes

- Fonts load from Google Fonts. Offline, the page falls back to system serif and sans fonts.
- Real book covers load from Open Library when you are online. Every book also has a
  designed cover drawn in CSS and SVG, so the UI still looks right offline or if an image fails.
  To run fully offline, set `remoteCovers: false` in `js/data.js`.
- Ratings, page counts, match scores and review excerpts are **mock values**, not live data.

---

## 2. The three demos

All three share the same data, pages and interactions. Only the design layer changes.

| | Demo 1: Dark Literary | Demo 2: Warm Editorial | Demo 3: Reader OS |
| --- | --- | --- | --- |
| Feeling | Bookstore at night | Independent bookstore paper | Calm premium reading app |
| Palette | Dark chocolate, ivory, muted gold | Cream paper, terracotta, olive | Soft neutrals, one sage green |
| Type | Playfair Display italics, IBM Plex | Fraunces, DM Sans, Caveat notes | Inter with Instrument Serif accents |
| Navigation | Letter-spaced top bar | Newspaper masthead and ruled nav | Floating pill (bottom bar on phones) |
| Home hero | Large featured book, epigraph | Front page, "In this issue" index | Personal dashboard (bento tiles) |
| Bars and cards | Segmented gold blocks, hairline borders | Printed olive bars, hard shadows, stamps | Smooth gradients, soft shadows |
| Chat | A letter from the concierge | Interview column (Q and A) | Soft bubbles |

The visual language of Demo 1 follows the project deck: Playfair Display, IBM Plex Sans and Mono,
large faint section numerals, thin outlined circles, dark brown with cream and gold.

---

## 3. Project structure

```text
litsense-prototype/
  index.html            Page shell, prototype switcher, search and modal mounts
  README.md
  css/
    styles.css          Tokens, layout, components, motion, responsive rules (shared)
    demo1.css           Dark Literary skin   (scoped to [data-demo='1'])
    demo2.css           Warm Editorial skin  (scoped to [data-demo='2'])
    demo3.css           Reader OS skin       (scoped to [data-demo='3'])
  js/
    data.js             DATA: books, users, readerProfile, recommendations, reviews, lexicon, seed shelf
    util.js             Pure helpers (escape, hash, dates, lists)
    engine.js           ENGINE: mock recommender, explanations, search, review analysis
    components.js       UI: HTML template functions (cover, card, bars, tags, radar, icons)
    views.js            UI: one function per page, returns an HTML string
    overlays.js         UI: toasts, popover menu, modal, search overlay, review dialog
    navigation.js       Hash router (works on file://)
    chat.js             Mock chatbot: parser, brief memory, chooser, reply writer, chat UI
    app.js              STATE (store + localStorage), rendering, delegated INTERACTIONS, boot
  assets/
    covers/             Notes on using your own cover images
    icons/              favicon.svg, logo.svg
```

### Architecture in one paragraph

Scripts attach to a single global, `window.LitSense`, and load in this order:
`data`, `util`, `engine`, `components`, `views`, `overlays`, `navigation`, `chat`, `app`.
**Data** is plain objects. The **engine** is pure functions of `(data, state)`. **Views** and
**components** turn state into HTML strings. **app.js** owns state, re-renders after a change,
and routes every click through one handler using `data-action="name"` attributes.
Nothing else touches the DOM, which makes each layer easy to port.

### How the three demos work

All three stylesheets are always loaded. `<html data-demo="1|2|3">` decides which one applies.
Each demo redefines the CSS variables (colors, fonts, radius, shadows) and then restructures
what a variable cannot change: the header, the hero, cards, bars, tabs and the chat.
Three views differ in markup too (the home hero is different in each), chosen in `views.js`.

---

## 4. How the mock recommendation engine works

The engine lives in `js/engine.js`. It is deterministic: the same shelves always give the
same picks. There is no randomness.

### Inputs

- `book.aspects`: 12 scores (0 to 100) per book, standing in for review-derived aspect scores:
  plot, writing style, characters, world building, pacing, editing quality, dialogue, humor,
  emotional impact, ending, complexity, tone / darkness.
- `readerProfile.aspects`: the same 12 numbers for the reader.
  For most aspects it means "how much I value this". For pacing, complexity and darkness it means
  "the level I prefer".
- `recommendations`: precomputed collaborative and semantic signals for each book.

### The match score

```text
Quality aspects:  c = ((bookScore - 65) / 35) * (profile / 100) * weight
Level aspects:    c = 3 - 0.3 * |bookScore - preferredLevel|     (pacing, complexity, darkness)

interpretable = 55 + sum(c)
match         = 0.5 * interpretable + 0.25 * collaborative + 0.25 * semantic
```

Each `c` is rounded and shown as the `+9` or `-3` evidence in the UI.
This mirrors the three spaces from the project:

| Space | In the prototype | In the real system |
| --- | --- | --- |
| Collaborative | `recommendations[].collaborative` | LightGCN over the rating graph |
| Semantic | `recommendations[].semantic` | MiniLM embeddings of descriptions and reviews |
| Interpretable | Computed live from the 12 aspects | Aspect-level sentiment from reviews, then a ranker |

### Worked example: The Song of Achilles

With the demo profile (characters 92, writing 88, emotional impact 91, pacing 61):

```text
Characters         +9     book 97 vs profile 92
Emotional impact   +9     book 98 vs profile 91
Writing style      +8     book 95 vs profile 88
Pacing             -3     book 40 vs preferred 61   (potential mismatch)
...
interpretable 92, collaborative 95, semantic 97  ->  94% match
```

The explanation text is built from templates in `engine.explain()`: the top three positive
contributions become reasons ("Strong character relationships"), and any contribution of -2 or worse
becomes a "Potential mismatch" ("Slower pacing").

### Rails (the rows you see)

| Rail | Rule |
| --- | --- |
| Top picks | Highest match among unread books, then MMR (lambda 0.75) so picks are not all the same |
| Because you liked X | Match, plus similarity to X, plus a boost from the hand-written neighbour list |
| Hidden gems | Books flagged as under-the-radar, ranked by match |
| More from authors you love | Authors of books you rated 4 or more (or are 50% through), ranked by match |
| Readers with your taste | Highest collaborative signal |
| More like your favorites | Closest to the average aspect profile of your five-star reads |
| Outside your comfort zone | Darker, slower or more complex than you like, with the stretch explained |

Rails claim books in order so one book does not appear twice on a page.

### The reader learns

Rating a book in the demo nudges the profile (by at most 8 points per aspect), so Reader DNA and
rankings change a little. Reviews are scanned with a small lexicon (`data.lexicon`) that finds aspect
words and the sentiment near them. Paste the example review from the deck into the review dialog to see it.

---

## 5. How the chatbot mock works

`js/chat.js` is a small response engine with conversation memory. No API and no LLM.

1. **parse(text)** extracts constraints: a book you named (even with punctuation), a mood, length
   ("short", "under 300 pages"), traits ("character-driven"), or intents like "surprise me" and "like my last read".
2. **brief** keeps the running constraints. Each refinement edits it, so "Make it cozier" keeps
   everything else. You can remove a constraint with the x on its tag in the side panel.
3. **choose()** scores unseen, unshelved books: engine match, plus closeness to the anchor book,
   plus an ordered "ladder" per mood (the first unseen book wins), plus trait bonuses.
4. **compose()** writes the reply from templates, then the card shows checks that prove each
   constraint ("Shorter than Project Hail Mary: 303 vs 476 pages") and one honest mismatch.

The rules from the brief hold:

| You say | You get |
| --- | --- |
| "Like Project Hail Mary, shorter and more character-driven" | The Song of Achilles (94%) |
| ...then "Make it cozier" | Klara and the Sun (92%), "a gentler, character-driven pick" |
| "cozy" | Klara and the Sun, then The House in the Cerulean Sea, then Legends & Lattes |
| "short" or "under 300 pages" | Small Things Like These (116 pages), then Never Let Me Go |
| "make me cry" | The Song of Achilles, then Hamnet, then Never Let Me Go |
| "dark and atmospheric" | Piranesi, then Station Eleven, then The Secret History |
| "like my last read" | A pick like your most recent finished book |
| "surprise me" | A wildcard from a fixed list |
| "why?" | The score breakdown for the last pick |
| "add it to my list" | Adds the last pick to Want to Read |

Anything the parser cannot read gets a polite hint instead of a made-up answer.

---

## 6. Replacing mock data with a MERN backend

The frontend is split so each mock piece maps to one backend piece.

### Suggested MongoDB collections

| Collection | Replaces | Key fields |
| --- | --- | --- |
| `books` | `data.books` | `title`, `author`, `genres[]`, `pages`, `year`, `description`, `coverUrl`, `aspects{12}`, `ratingAvg`, `ratingsCount` |
| `users` | `data.users` | `name`, `handle`, `createdAt` |
| `shelfEntries` | `state.shelf` | `userId`, `bookId`, `status`, `progress`, `rating`, `startedAt`, `finishedAt` |
| `reviews` | `data.reviews`, `state.reviews` | `userId`, `bookId`, `rating`, `text`, `aspects[{key, sentiment}]` |
| `userProfiles` | `data.readerProfile` | `userId`, `aspects{12}`, `confidence`, `updatedAt` |
| `recommendations` | `data.recommendations` | `userId`, `bookId`, `collaborative`, `semantic`, `interpretable`, `reasons[]` |

### Suggested Express endpoints

| Endpoint | Replaces |
| --- | --- |
| `GET /api/books?query=&genre=` | `engine.search`, filters |
| `GET /api/books/:id` | `E.book(id)` on the detail page |
| `GET /api/me/shelves` and `PUT /api/me/shelves/:bookId` | `store.shelf`, `setStatus`, `setRating`, `advance` |
| `POST /api/me/reviews` | `saveReview` (server runs the aspect analysis) |
| `GET /api/me/profile` | `engine.profile`, Reader DNA page |
| `GET /api/me/recommendations?rail=...&anchor=...` (rails: top, because, gems, authors, peers, favorites, comfort) | `engine.homeSections`, `recSections` |
| `GET /api/me/recommendations/next?after=:bookId` | `engine.nextReads` |
| `POST /api/chat` | `chat.respond` |

Keep the recommendation payload shape the UI already uses:
`{ book, match: {score, collaborative, semantic, interpretable}, why: {reasons[], mismatches[], tags[]}, bridge }`.
If the API returns that, `components.js` and `views.js` need almost no change.

### Porting step by step

1. **Data**: delete `data.js` books and users. Fetch from the endpoints above instead.
2. **Engine**: keep `engine.js` only as a reference. Move scoring to the server (Node, or a Python service
   with LightGCN, MiniLM and LightGBM). Keep the explanation templates, they are already spoiler-safe.
3. **State**: `app.js` store becomes Redux, Zustand or React Query. `mutate(fn)` becomes an API call plus a cache update.
4. **Views**: `views.js` and `components.js` become React components. Each function already takes plain data and returns markup.
5. **Router**: `navigation.js` becomes `react-router` with the same route table.
6. **Styles**: `styles.css` and the three demo files carry over unchanged. Replace `data-demo` with a theme provider if you keep the three skins.
7. **Auth**: replace the demo persona with the signed-in user. Nothing in the UI assumes more than one user.

### Replacing the chatbot

Keep the split the prototype already shows: the **recommender decides what** to suggest, and the
language model only **says how**. A safe contract:

```json
POST /api/chat  { "message": "Make it cozier", "briefId": "..." }

{
  "reply": "Got it. Here's a gentler, character-driven pick instead.",
  "pick": { "bookId": "...", "match": 92, "reasons": [], "mismatches": [], "checks": [] },
  "brief": [{ "key": "mood", "label": "Cozier" }]
}
```

The server picks the book from the recommender, then asks the LLM to write only the reply from the
book facts it was given. It cannot invent a title, because the title is not its decision.

---

## 7. Design notes

- **Responsive**: desktop multi-column, tablet two-column, phone single column with a bottom bar
  (Home, Books, Discover, Chat, Profile). Book cards turn horizontal on phones. Chat fills the screen.
- **Motion** is calm: fade-up on scroll, segmented bars that fill, a ring that draws, a typing
  indicator, words that fade into replies. `prefers-reduced-motion` turns most of it off.
- **Accessibility**: skip link, labelled controls, focus rings, keyboard support in search and menus,
  focus trap in dialogs, `aria-live` for toasts and chat.
- **Explainability** is a first-class feature: every pick shows reasons, a potential mismatch,
  the three signals, and a spoiler-safe note.

## 8. Known limits

- The catalog has 40 books. The chatbot can only recommend from that list.
- Ratings, ratings counts and review excerpts are illustrative. Review excerpts are original text, not real reviews.
- No authentication, no multi-user data, no real learning. The reader profile only moves a few points.
- Cover images come from Open Library by cover id. A few editions may differ from the one you expect.

## 9. Credits

Cover images courtesy of [Open Library](https://openlibrary.org/). Fonts from Google Fonts:
Playfair Display, IBM Plex Sans and Mono, Fraunces, DM Sans, Caveat, Inter and Instrument Serif.
