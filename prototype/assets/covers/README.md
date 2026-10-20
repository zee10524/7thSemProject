# Book covers

The prototype draws a designed cover for every book in CSS and SVG, so it works offline.
When you are online it layers the real cover on top, loaded from Open Library by cover id
(see `cover.id` in `js/data.js`). If an image fails, the designed cover stays visible.

To use your own images instead:

1. Drop files here, for example `assets/covers/project-hail-mary.jpg`.
2. In `js/components.js`, change `coverUrl(book, size)` to return that path.
3. Keep a 2:3 aspect ratio. About 400 by 600 px is enough.

To run fully offline, set `remoteCovers: false` in `js/data.js`.
