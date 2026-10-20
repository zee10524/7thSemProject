/* ==========================================================================
   LitSense prototype - MOCK RECOMMENDATION ENGINE
   --------------------------------------------------------------------------
   Pure functions: (data, state) -> recommendations + explanations.
   No DOM. This whole file is the piece you replace with API calls later.

   How a match is computed
   ----------------------
   1. Interpretable score (live, from the 12 literary aspects)
        quality aspect:  c = ((bookScore - 65) / 35) * (profile / 100) * wmax
        dial aspect:     c = 3 - 0.3 * |bookScore - preferredLevel|
        I = 55 + sum(c)                      (clamped)
      Each c is the "+9 / -3" evidence shown in the UI.
   2. Collaborative + semantic signals (precomputed per book in data.js,
      standing in for LightGCN and MiniLM).
   3. match = 0.5 * I + 0.25 * collaborative + 0.25 * semantic

   Rails (rows) then apply the post-processing ideas from the project deck:
   seen filter, dedupe across rails, MMR diversification (lambda 0.75).
   ========================================================================== */
(function (global) {
  'use strict';

  var LS = global.LitSense;
  var D = LS.data;
  var U = LS.util;

  var ASPECTS = D.aspects;
  var KEYS = ASPECTS.map(function (a) { return a.key; });
  var ASPECT = {};
  ASPECTS.forEach(function (a) { ASPECT[a.key] = a; });
  var COPY = D.aspectCopy;
  var BASE = 55;
  var MMR_LAMBDA = 0.75;

  var BY_ID = {};
  D.books.forEach(function (b) { BY_ID[b.id] = b; });
  var SIGNALS = {};
  D.recommendations.forEach(function (r) { SIGNALS[r.bookId] = r; });

  function book(id) { return BY_ID[id] || null; }

  /* ------------------------------------------------------------------ */
  /* Shelf helpers (state.shelf[id] = { status, progress, rating, ... })  */
  /* ------------------------------------------------------------------ */
  function entry(state, id) { return (state.shelf && state.shelf[id]) || null; }
  function statusOf(state, id) { var e = entry(state, id); return e ? e.status : null; }
  function isSeen(state, id) { var s = statusOf(state, id); return s === 'read' || s === 'reading'; }

  function booksWithStatus(state, status) {
    return Object.keys(state.shelf || {})
      .filter(function (id) { return state.shelf[id].status === status && BY_ID[id]; })
      .map(function (id) { return { book: BY_ID[id], entry: state.shelf[id] }; });
  }

  function recentlyFinished(state, n) {
    return booksWithStatus(state, 'read')
      .sort(function (a, b) { return (b.entry.finishedAt || 0) - (a.entry.finishedAt || 0); })
      .slice(0, n || 6);
  }

  /** Read books the reader loved, newest first. Used as "Because you liked" anchors. */
  function likedAnchors(state, n) {
    return booksWithStatus(state, 'read')
      .filter(function (x) { return (x.entry.rating || 0) >= 4.5; })
      .sort(function (a, b) { return (b.entry.finishedAt || 0) - (a.entry.finishedAt || 0); })
      .slice(0, n || 3)
      .map(function (x) { return x.book; });
  }

  /* ------------------------------------------------------------------ */
  /* Reader profile (base + small nudges from ratings made in the demo)   */
  /* ------------------------------------------------------------------ */
  function learnedOffsets(state) {
    var off = {};
    KEYS.forEach(function (k) { off[k] = 0; });
    var ur = state.userRatings || {};
    Object.keys(ur).forEach(function (id) {
      var b = BY_ID[id];
      if (!b) { return; }
      var w = (ur[id] - 3) / 2; // -1 .. +1
      KEYS.forEach(function (k) { off[k] += (b.aspects[k] - D.readerProfile.aspects[k]) * 0.06 * w; });
    });
    KEYS.forEach(function (k) { off[k] = U.clamp(off[k], -8, 8); });
    return off;
  }

  function profile(state) {
    var base = D.readerProfile.aspects;
    var off = learnedOffsets(state);
    var out = {};
    KEYS.forEach(function (k) { out[k] = U.clamp(Math.round(base[k] + off[k]), 0, 100); });
    return out;
  }

  /** Largest visible change between two profiles, for the "Reader DNA updated" toast. */
  function profileShift(before, after) {
    var best = null;
    KEYS.forEach(function (k) {
      var d = after[k] - before[k];
      if (d !== 0 && (!best || Math.abs(d) > Math.abs(best.delta))) { best = { key: k, label: ASPECT[k].label, delta: d }; }
    });
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* Scoring                                                             */
  /* ------------------------------------------------------------------ */
  function contributions(b, prof) {
    return ASPECTS.map(function (a) {
      var bs = b.aspects[a.key];
      var ps = prof[a.key];
      var d;
      if (a.kind === 'dial') { d = Math.round(3 - 0.3 * Math.abs(bs - ps)); }
      else { d = Math.round(((bs - 65) / 35) * (ps / 100) * a.wmax); }
      d = U.clamp(d, -9, 12);
      return { key: a.key, no: a.no, label: a.label, kind: a.kind, delta: d, book: bs, pref: ps, dir: bs < ps ? 'low' : 'high' };
    });
  }

  function match(b, state) {
    var prof = profile(state);
    var cs = contributions(b, prof);
    var sum = cs.reduce(function (s, c) { return s + c.delta; }, 0);
    var interpretable = U.clamp(BASE + sum, 35, 99);
    var sg = SIGNALS[b.id] || { collaborative: 70, semantic: 70 };
    var score = U.clamp(Math.round(0.5 * interpretable + 0.25 * sg.collaborative + 0.25 * sg.semantic), 35, 99);
    var pos = cs.filter(function (c) { return c.delta >= 3; }).sort(function (a, z) { return z.delta - a.delta; });
    var neg = cs.filter(function (c) { return c.delta <= -2; }).sort(function (a, z) { return a.delta - z.delta; });
    return {
      score: score, interpretable: interpretable, collaborative: sg.collaborative, semantic: sg.semantic,
      contributions: cs, pos: pos, neg: neg
    };
  }

  /* ------------------------------------------------------------------ */
  /* Similarity between books (mean absolute aspect difference)           */
  /* ------------------------------------------------------------------ */
  function similarity(a, b) {
    var tot = 0;
    KEYS.forEach(function (k) { tot += Math.abs(a.aspects[k] - b.aspects[k]); });
    return U.clamp(1 - (tot / KEYS.length) / 50, 0, 1);
  }

  /** Aspects both books are strong on, ordered by how much the reader cares. */
  function sharedAspects(a, b, prof, n) {
    return KEYS.filter(function (k) {
      return a.aspects[k] >= 78 && b.aspects[k] >= 78 && Math.abs(a.aspects[k] - b.aspects[k]) <= 15 && ASPECT[k].kind === 'quality';
    }).sort(function (x, y) { return prof[y] - prof[x]; }).slice(0, n || 2);
  }

  /* ------------------------------------------------------------------ */
  /* Explanations                                                        */
  /* ------------------------------------------------------------------ */
  var SHORT_TEMPLATES = [
    function (a, b) { return 'You consistently enjoy ' + COPY[a].love + ' and ' + COPY[b].love + '.'; },
    function (a, b) { return 'Matches your high ratings for ' + COPY[a].rated + ' and ' + COPY[b].rated + '.'; },
    function (a, b) { return 'A natural fit for your taste in ' + COPY[a].love + ' and ' + COPY[b].love + '.'; }
  ];

  function explain(b, state, opts) {
    opts = opts || {};
    var m = opts.m || match(b, state);
    var pos = m.pos.slice(0, 3);
    var neg = m.neg.slice(0, 2);
    var variant = opts.variant != null ? opts.variant : U.hash(b.id);
    var p1 = pos[0];
    var p2 = pos[1];
    var short;
    var headline;

    if (p1 && p2) {
      short = SHORT_TEMPLATES[variant % SHORT_TEMPLATES.length](p1.key, p2.key);
      headline = 'Recommended because you rated books highly for ' + COPY[p1.key].rated + ' and ' + COPY[p2.key].rated + '.';
    } else if (p1) {
      short = 'A strong fit for your taste in ' + COPY[p1.key].love + '.';
      headline = 'Recommended because you rated books highly for ' + COPY[p1.key].rated + '.';
    } else {
      short = 'A broader pick, chosen to stretch your taste a little.';
      headline = 'Recommended to widen your reading, not narrow it.';
    }

    var reasons = pos.map(function (c) { return { key: c.key, label: c.label, text: COPY[c.key].reason, delta: c.delta }; });
    var mismatches = neg.map(function (c) { return { key: c.key, label: c.label, text: COPY[c.key][c.dir], delta: c.delta }; });

    var tags = pos.map(function (c) { return { kind: 'pos', key: c.key, label: c.label, delta: c.delta }; });
    if (mismatches[0]) { tags.push({ kind: 'neg', key: mismatches[0].key, label: mismatches[0].label, delta: mismatches[0].delta }); }

    // Four aspects to chart: the best matches plus the biggest mismatch.
    var chart = pos.slice(0, 3).map(function (c) { return c.key; });
    if (neg[0] && chart.indexOf(neg[0].key) < 0) { chart.push(neg[0].key); }
    m.contributions.slice().sort(function (a, z) { return z.delta - a.delta; }).forEach(function (c) {
      if (chart.length < 4 && chart.indexOf(c.key) < 0) { chart.push(c.key); }
    });
    chart.sort(function (a, z) { return KEYS.indexOf(a) - KEYS.indexOf(z); });

    return { short: short, headline: headline, reasons: reasons, mismatches: mismatches, tags: tags, chart: chart };
  }

  function rec(b, state, ctx) {
    ctx = ctx || {};
    var m = match(b, state);
    return {
      book: b, m: m, status: statusOf(state, b.id), kind: ctx.kind || 'pick',
      why: explain(b, state, { m: m, variant: ctx.variant }),
      bridge: ctx.bridge || '', anchor: ctx.anchor || null, shared: ctx.shared || []
    };
  }

  /* ------------------------------------------------------------------ */
  /* Filters and sorting (Recommendations page)                          */
  /* ------------------------------------------------------------------ */
  function applyFilters(list, f) {
    f = f || {};
    return list.filter(function (b) {
      if (f.genre && f.genre !== 'all') {
        var g = D.genreFilters.filter(function (x) { return x.id === f.genre; })[0];
        if (g && !b.genres.some(function (x) { return g.genres.indexOf(x) > -1; })) { return false; }
      }
      if (f.mood && f.mood !== 'any' && b.moods.indexOf(f.mood) < 0) { return false; }
      if (f.length && f.length !== 'any') {
        if (f.length === 'short' && b.pages >= 300) { return false; }
        if (f.length === 'medium' && (b.pages < 300 || b.pages > 420)) { return false; }
        if (f.length === 'long' && b.pages <= 420) { return false; }
      }
      return true;
    });
  }

  function sortRecs(list, sort) {
    var out = list.slice();
    if (sort === 'rating') { out.sort(function (a, z) { return z.book.rating - a.book.rating || z.m.score - a.m.score; }); }
    else if (sort === 'short') { out.sort(function (a, z) { return a.book.pages - z.book.pages; }); }
    return out;
  }

  function candidates(state, f) {
    return applyFilters(D.books.filter(function (b) { return !isSeen(state, b.id); }), f);
  }

  /* ------------------------------------------------------------------ */
  /* Rails                                                               */
  /* ------------------------------------------------------------------ */
  function claim(list, used) {
    list.forEach(function (r) { used[r.book.id] = true; });
    return list;
  }

  function byScoreDesc(a, z) { return z.score - a.score; }

  /** Maximal marginal relevance: balance score against redundancy. */
  function mmr(items, n) {
    var sel = [];
    var rest = items.slice();
    while (sel.length < n && rest.length) {
      var bestIdx = 0;
      var bestVal = -Infinity;
      for (var i = 0; i < rest.length; i++) {
        var sim = 0;
        for (var j = 0; j < sel.length; j++) { sim = Math.max(sim, similarity(sel[j].book, rest[i].book)); }
        var val = MMR_LAMBDA * rest[i].score - (1 - MMR_LAMBDA) * 100 * sim;
        if (val > bestVal) { bestVal = val; bestIdx = i; }
      }
      sel.push(rest.splice(bestIdx, 1)[0]);
    }
    return sel;
  }

  function topPicks(state, n, used, f) {
    var items = candidates(state, f)
      .filter(function (b) { return !used[b.id]; })
      .map(function (b) { return { book: b, score: match(b, state).score }; })
      .sort(byScoreDesc);
    // MMR chooses the set; show it best match first.
    var chosen = mmr(items, n).sort(byScoreDesc);
    return claim(chosen.map(function (it, i) { return rec(it.book, state, { kind: 'top', variant: i }); }), used);
  }

  function becauseYouLiked(state, anchorId, n, used, f) {
    var anchor = book(anchorId);
    if (!anchor) { return []; }
    var prof = profile(state);
    var neigh = D.neighbors[anchorId] || [];
    var items = candidates(state, f)
      .filter(function (b) { return !used[b.id]; })
      .map(function (b) {
        var idx = neigh.indexOf(b.id);
        var score = 0.5 * match(b, state).score + 0.5 * similarity(anchor, b) * 100 + (idx > -1 ? Math.max(6, 22 - idx * 3) : 0);
        return { book: b, score: score };
      })
      .sort(byScoreDesc)
      .slice(0, n);
    return claim(items.map(function (it, i) {
      var shared = sharedAspects(anchor, it.book, prof, 2);
      var bridge = shared.length
        ? 'Shares ' + anchor.title + "'s " + U.listJoin(shared.map(function (k) { return ASPECT[k].label.toLowerCase(); })) + '.'
        : 'Readers who loved ' + anchor.title + ' often pick this next.';
      return rec(it.book, state, { kind: 'because', variant: i + 1, anchor: anchor, bridge: bridge, shared: shared });
    }), used);
  }

  function hiddenGems(state, n, used, f) {
    var pool = candidates(state, f).filter(function (b) { return !used[b.id]; });
    var gems = pool.filter(function (b) { return b.gem; });
    if (gems.length < n) {
      gems = gems.concat(pool.filter(function (b) { return !b.gem && b.ratingsK <= 350; }));
    }
    var items = gems.map(function (b) { return { book: b, score: match(b, state).score }; }).sort(byScoreDesc).slice(0, n);
    return claim(items.map(function (it, i) {
      return rec(it.book, state, {
        kind: 'gem', variant: i + 2,
        bridge: 'Only ' + U.fmtK(it.book.ratingsK) + ' ratings, yet a ' + it.score + '% match for your taste.'
      });
    }), used);
  }

  function authorsYouLove(state, n, used, f) {
    var loved = {};
    booksWithStatus(state, 'read').forEach(function (x) {
      if ((x.entry.rating || 0) >= 4) { setLoved(loved, x.book, x.entry.rating, 'rated'); }
    });
    booksWithStatus(state, 'reading').forEach(function (x) {
      if ((x.entry.progress || 0) >= 50) { setLoved(loved, x.book, 4 + (x.entry.progress || 0) / 1000, 'reading'); }
    });
    function setLoved(map, b, weight, how) {
      if (!map[b.author] || map[b.author].weight < weight) { map[b.author] = { anchor: b, weight: weight, how: how, rating: weight }; }
    }
    var authors = Object.keys(loved).sort(function (a, z) { return loved[z].weight - loved[a].weight; });
    var out = [];
    authors.forEach(function (author) {
      candidates(state, f)
        .filter(function (b) { return b.author === author && !used[b.id]; })
        .map(function (b) { return { book: b, score: match(b, state).score }; })
        .sort(byScoreDesc)
        .forEach(function (it) {
          var l = loved[author];
          var bridge = l.how === 'rated'
            ? 'More from ' + author + ', whose ' + l.anchor.title + ' you rated ' + l.rating.toFixed(1) + '.'
            : 'More from ' + author + ', whose ' + l.anchor.title + ' you are reading now.';
          out.push({ item: it, anchor: l.anchor, bridge: bridge });
        });
    });
    out = out.sort(function (a, z) { return z.item.score - a.item.score; }).slice(0, n);
    return claim(out.map(function (o, i) {
      return rec(o.item.book, state, { kind: 'author', variant: i, anchor: o.anchor, bridge: o.bridge });
    }), used);
  }

  function readersLikeYou(state, n, used, f) {
    var peers = D.users.filter(function (u) { return u.overlap; });
    var items = candidates(state, f)
      .filter(function (b) { return !used[b.id]; })
      .map(function (b) { return { book: b, score: (SIGNALS[b.id] || { collaborative: 0 }).collaborative * 1.0 + match(b, state).score * 0.2 }; })
      .sort(byScoreDesc)
      .slice(0, n);
    return claim(items.map(function (it, i) {
      var peer = U.pick(peers, it.book.id);
      return rec(it.book, state, {
        kind: 'peers', variant: i,
        bridge: peer.name + ' and ' + (peer.shared - 1) + ' readers with ' + peer.overlap + '% taste overlap loved this.'
      });
    }), used);
  }

  function moreLikeFavorites(state, n, used, f) {
    var favs = booksWithStatus(state, 'read').filter(function (x) { return (x.entry.rating || 0) >= 4.5; }).map(function (x) { return x.book; });
    if (!favs.length) { return []; }
    var centroid = {};
    KEYS.forEach(function (k) { centroid[k] = favs.reduce(function (s, b) { return s + b.aspects[k]; }, 0) / favs.length; });
    var items = candidates(state, f)
      .filter(function (b) { return !used[b.id]; })
      .map(function (b) {
        var mad = KEYS.reduce(function (s, k) { return s + Math.abs(b.aspects[k] - centroid[k]); }, 0) / KEYS.length;
        return { book: b, score: 0.5 * (100 - mad * 1.8) + 0.5 * match(b, state).score };
      })
      .sort(byScoreDesc)
      .slice(0, n);
    return claim(items.map(function (it, i) {
      var near = favs.slice().sort(function (a, z) { return similarity(z, it.book) - similarity(a, it.book); }).slice(0, 2);
      return rec(it.book, state, {
        kind: 'favorites', variant: i + 1,
        bridge: 'Close to your five-star reads: ' + U.listJoin(near.map(function (b) { return b.title; })) + '.'
      });
    }), used);
  }

  function outsideComfortZone(state, n, used, f) {
    var items = candidates(state, f)
      .filter(function (b) { return !used[b.id] && b.rating >= 4.0; })
      .map(function (b) {
        var m = match(b, state);
        // A real stretch: darker, more complex or slower than the reader's usual.
        var dial = m.contributions.filter(function (c) {
          var heavier = (c.key === 'darkness' || c.key === 'complexity') ? c.dir === 'high' : c.dir === 'low';
          return c.kind === 'dial' && c.delta <= -4 && heavier;
        }).sort(function (a, z) { return a.delta - z.delta; })[0];
        return { book: b, m: m, dial: dial, score: b.rating * 10 + m.score * 0.4 };
      })
      .filter(function (x) { return x.dial; })
      .sort(byScoreDesc)
      .slice(0, n);
    return claim(items.map(function (it, i) {
      var strength = it.m.pos[0];
      var bridge = 'A stretch: ' + U.lowerFirst(COPY[it.dial.key][it.dial.dir]) +
        (strength ? ', but ' + U.lowerFirst(COPY[strength.key].reason) + '.' : '.');
      return rec(it.book, state, { kind: 'comfort', variant: i, bridge: bridge });
    }), used);
  }

  /** "Because you just finished X": the next reads after one book. */
  function nextReads(state, anchorId, n) {
    var anchor = book(anchorId);
    if (!anchor) { return []; }
    var prof = profile(state);
    var neigh = D.neighbors[anchorId] || [];
    var items = candidates(state)
      .map(function (b) {
        var idx = neigh.indexOf(b.id);
        var score = 0.6 * match(b, state).score + 0.4 * similarity(anchor, b) * 100 + (idx > -1 ? Math.max(5, 20 - idx * 3) : 0);
        return { book: b, score: score };
      })
      .sort(byScoreDesc)
      .slice(0, n);
    return items.map(function (it, i) {
      var shared = sharedAspects(anchor, it.book, prof, 3);
      var bridge = shared.length
        ? 'Like ' + anchor.title + ', it is strong on ' + U.listJoin(shared.map(function (k) { return ASPECT[k].label.toLowerCase(); })) + '.'
        : 'Readers who finished ' + anchor.title + ' often pick this next.';
      return rec(it.book, state, { kind: 'next', variant: i, anchor: anchor, bridge: bridge, shared: shared });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Page-level aggregators                                              */
  /* ------------------------------------------------------------------ */
  function homeSections(state, ui) {
    var used = {};
    var anchors = likedAnchors(state, 3);
    var anchorId = ui.homeAnchor && book(ui.homeAnchor) ? ui.homeAnchor : (anchors[0] && anchors[0].id);
    // Claim order matters: scarce, specific rails go first so they keep their best books.
    var top = topPicks(state, 3, used);
    var authors = authorsYouLove(state, 4, used);
    var because = becauseYouLiked(state, anchorId, 4, used);
    var gems = hiddenGems(state, 4, used);
    var peers = readersLikeYou(state, 4, used);
    return { top: top, authors: authors, because: because, gems: gems, peers: peers, anchors: anchors, anchor: book(anchorId), recent: recentlyFinished(state, 6) };
  }

  function recSections(state, ui) {
    var f = ui.recFilters || {};
    var used = {};
    var anchors = likedAnchors(state, 3);
    var anchorId = ui.recAnchor && book(ui.recAnchor) ? ui.recAnchor : (anchors[0] && anchors[0].id);
    var top = topPicks(state, 4, used, f);
    var because = becauseYouLiked(state, anchorId, 4, used, f);
    var favs = moreLikeFavorites(state, 4, used, f);
    var gems = hiddenGems(state, 4, used, f);
    var comfort = outsideComfortZone(state, 4, used, f);
    var sort = f.sort || 'match';
    return {
      top: sortRecs(top, sort), because: sortRecs(because, sort), gems: sortRecs(gems, sort),
      favorites: sortRecs(favs, sort), comfort: sortRecs(comfort, sort),
      anchors: anchors, anchor: book(anchorId),
      count: top.length + because.length + gems.length + favs.length + comfort.length
    };
  }

  /* ------------------------------------------------------------------ */
  /* Search                                                              */
  /* ------------------------------------------------------------------ */
  function norm(s) {
    s = String(s || '').toLowerCase();
    if (s.normalize) { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    return s;
  }

  function search(query, limit) {
    var tokens = norm(query).split(/[^a-z0-9&']+/).filter(Boolean);
    if (!tokens.length) { return []; }
    var scored = [];
    D.books.forEach(function (b) {
      var title = norm(b.title);
      var author = norm(b.author);
      var genres = norm(b.genres.join(' '));
      var moods = norm(b.moods.join(' '));
      var total = 0;
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        var s = 0;
        if (title.indexOf(t) === 0 || title.indexOf(' ' + t) > -1) { s = Math.max(s, 6); }
        else if (title.indexOf(t) > -1) { s = Math.max(s, 4); }
        if (author.indexOf(t) === 0 || author.indexOf(' ' + t) > -1) { s = Math.max(s, 5); }
        else if (author.indexOf(t) > -1) { s = Math.max(s, 3); }
        if (genres.indexOf(t) > -1) { s = Math.max(s, 3); }
        if (moods.indexOf(t) > -1) { s = Math.max(s, 2); }
        if (!s) { return; }
        total += s;
      }
      scored.push({ book: b, score: total + b.rating / 10 });
    });
    scored.sort(byScoreDesc);
    return scored.slice(0, limit || 8).map(function (x) { return x.book; });
  }

  /* ------------------------------------------------------------------ */
  /* Review analysis: unstructured review -> aspect sentiment            */
  /* ------------------------------------------------------------------ */
  var LEX = {};
  KEYS.forEach(function (k) {
    LEX[k] = {};
    (D.lexicon.aspects[k] || []).forEach(function (w) { LEX[k][w] = true; });
  });
  var POS = {};
  D.lexicon.positive.forEach(function (w) { POS[w] = true; });
  var NEG = {};
  D.lexicon.negative.forEach(function (w) { NEG[w] = true; });

  function tokens(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9'\- ]+/g, ' ').split(/\s+/).filter(Boolean);
  }

  /**
   * @param {string} text   review text
   * @param {number} [rating] optional star rating, used to resolve neutral mentions
   * @returns {Array<{key,label,no,sentiment}>} sentiment is +1, 0 or -1
   */
  function analyzeReview(text, rating) {
    var clauses = String(text || '').toLowerCase()
      .split(/[.;!?]|,|\bbut\b|\bthough\b|\byet\b|\bwhile\b|\balthough\b/)
      .map(function (c) { return c.trim(); })
      .filter(Boolean);
    var found = {};
    clauses.forEach(function (cl) {
      var toks = tokens(cl);
      var pos = toks.filter(function (t) { return POS[t]; }).length;
      var neg = toks.filter(function (t) { return NEG[t]; }).length;
      KEYS.forEach(function (k) {
        var hit = toks.some(function (t) { return LEX[k][t]; });
        if (!hit) { return; }
        var f = found[k] || (found[k] = { pos: 0, neg: 0 });
        f.pos += pos;
        f.neg += neg;
      });
    });
    return KEYS.filter(function (k) { return found[k]; }).map(function (k) {
      var f = found[k];
      var s = f.neg > f.pos ? -1 : (f.pos > f.neg ? 1 : 0);
      if (s === 0 && rating) { s = rating >= 4 ? 1 : (rating <= 2.5 ? -1 : 0); }
      return { key: k, no: ASPECT[k].no, label: ASPECT[k].label, sentiment: s };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Stats for profile and dashboard                                     */
  /* ------------------------------------------------------------------ */
  function stats(state) {
    var read = booksWithStatus(state, 'read');
    var reading = booksWithStatus(state, 'reading');
    var want = booksWithStatus(state, 'want');
    // Weight every genre of every finished book by the rating the reader gave it.
    var counts = {};
    var total = 0;
    read.forEach(function (x) {
      var w = x.entry.rating || 3;
      x.book.genres.forEach(function (g) { counts[g] = (counts[g] || 0) + w; total += w; });
    });
    var bookCount = {};
    read.forEach(function (x) { x.book.genres.forEach(function (g) { bookCount[g] = (bookCount[g] || 0) + 1; }); });
    var names = Object.keys(counts).sort(function (a, z) { return counts[z] - counts[a]; });
    var top = names.length ? counts[names[0]] : 1;
    var genres = names.map(function (g) {
      return { genre: g, count: counts[g], books: bookCount[g], pct: total ? Math.round(counts[g] / total * 100) : 0, bar: Math.round(counts[g] / top * 100) };
    });
    var rated = read.filter(function (x) { return x.entry.rating; });
    var avg = rated.length ? rated.reduce(function (s, x) { return s + x.entry.rating; }, 0) / rated.length : 0;
    return {
      read: read.length, reading: reading.length, want: want.length,
      pages: read.reduce(function (s, x) { return s + x.book.pages; }, 0),
      avgRating: avg, genres: genres, favoriteGenre: genres[0] ? genres[0].genre : 'Not enough data'
    };
  }

  LS.engine = {
    BASE: BASE, MMR_LAMBDA: MMR_LAMBDA, KEYS: KEYS, ASPECT: ASPECT,
    book: book, entry: entry, statusOf: statusOf, isSeen: isSeen, booksWithStatus: booksWithStatus,
    recentlyFinished: recentlyFinished, likedAnchors: likedAnchors,
    profile: profile, profileShift: profileShift, contributions: contributions, match: match,
    similarity: similarity, sharedAspects: sharedAspects, explain: explain, rec: rec,
    applyFilters: applyFilters, sortRecs: sortRecs, candidates: candidates,
    topPicks: topPicks, becauseYouLiked: becauseYouLiked, hiddenGems: hiddenGems, authorsYouLove: authorsYouLove,
    readersLikeYou: readersLikeYou, moreLikeFavorites: moreLikeFavorites, outsideComfortZone: outsideComfortZone,
    nextReads: nextReads, homeSections: homeSections, recSections: recSections,
    search: search, analyzeReview: analyzeReview, stats: stats
  };
})(window);
