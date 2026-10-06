/* ==========================================================================
   LitSense prototype - MOCK CHATBOT
   --------------------------------------------------------------------------
   No API, no LLM. A small predefined response engine with conversation memory:

     1. parse()    turns a message into constraints (anchor book, length, mood, traits)
     2. brief      the running list of constraints; refinements edit it
     3. choose()   scores unseen books: engine match + anchor neighbours +
                   mood "ladders" (ordered picks per mood) + trait bonuses
     4. compose()  writes the reply from templates, then a card with evidence

   In the real system the recommender still decides WHAT to recommend and an LLM
   only decides HOW to say it (see README, "Replacing the chatbot").
   ========================================================================== */
(function (global) {
  'use strict';

  var LS = global.LitSense;
  var U = LS.util;
  var D = LS.data;
  var E = LS.engine;
  var ui = LS.ui;
  var esc = U.esc;
  var icon = ui.icon;
  var doc = global.document;

  /* ------------------------------------------------------------------ */
  /* Predefined knowledge                                                */
  /* ------------------------------------------------------------------ */
  // Ordered preferences per mood. The first unseen, unshelved book wins.
  var LADDERS = {
    cozy:    ['klara-and-the-sun', 'the-house-in-the-cerulean-sea', 'legends-and-lattes', 'a-psalm-for-the-wild-built', 'the-long-way-to-a-small-angry-planet', 'eleanor-oliphant-is-completely-fine'],
    cry:     ['the-song-of-achilles', 'never-let-me-go', 'hamnet', 'the-book-thief', 'small-things-like-these', 'pachinko', 'a-little-life'],
    dark:    ['piranesi', 'station-eleven', 'the-secret-history', 'the-night-circus', 'the-road'],
    funny:   ['anxious-people', 'the-martian', 'eleanor-oliphant-is-completely-fine', 'convenience-store-woman', 'the-house-in-the-cerulean-sea', 'legends-and-lattes'],
    hopeful: ['legends-and-lattes', 'a-psalm-for-the-wild-built', 'the-house-in-the-cerulean-sea', 'station-eleven', 'klara-and-the-sun']
  };
  var SHORT_LADDER = ['small-things-like-these', 'never-let-me-go', 'a-psalm-for-the-wild-built', 'piranesi', 'stoner', 'convenience-store-woman'];
  var SURPRISE_LADDER = ['convenience-store-woman', 'the-night-circus', 'kafka-on-the-shore', 'stoner', 'dune', 'a-little-life', 'the-long-way-to-a-small-angry-planet'];

  var MOODS = {
    cozy:    { rx: /\b(cozy|cosy|cozier|cosier|comfort|comforting|gentle|gentler|wholesome|heartwarming|feel[- ]good|softer|warmer|relaxing|lighter)\b/, adj: 'gentler', phrase: 'cozy, gentle stories', tag: 'Cozier' },
    cry:     { rx: /\b(cry|crying|sad|sadder|tears?|tearjerker|heartbreak\w*|devastat\w+|emotional|weep|moving)\b/, adj: 'more emotional', phrase: 'stories that move you', tag: 'Emotional' },
    dark:    { rx: /\b(dark|darker|atmospheric|moody|gothic|eerie|haunting|bleak|brooding|creepy|spooky|noir)\b/, adj: 'darker', phrase: 'dark, atmospheric stories', tag: 'Dark & atmospheric' },
    funny:   { rx: /\b(funny|funnier|humou?r\w*|laugh\w*|witty|hilarious|comic)\b/, adj: 'funnier', phrase: 'warm humor', tag: 'Funny' },
    hopeful: { rx: /\b(hopeful|uplifting|inspiring|optimistic)\b/, adj: 'more hopeful', phrase: 'hopeful stories', tag: 'Hopeful' }
  };

  var TRAITS = {
    characters: { rx: /\b(character[- ]driven|characters?|relationships?|friendships?|found family)\b/, adj: 'character-driven', phrase: 'strong character relationships', tag: 'Character-driven', aspect: 'characters' },
    lyrical:    { rx: /\b(lyrical|poetic|beautiful(?:ly)? written|beautiful prose|gorgeous writing|prose)\b/, adj: 'more lyrical', phrase: 'lyrical prose', tag: 'Lyrical prose', aspect: 'writing' },
    world:      { rx: /\b(world[- ]?building|immersive|magical|epic world)\b/, adj: 'more immersive', phrase: 'immersive worlds', tag: 'Immersive world', aspect: 'world' },
    fast:       { rx: /\b(fast|faster|page[- ]turner|gripping|thrilling|pacey|fast[- ]paced)\b/, adj: 'faster', phrase: 'a brisk pace', tag: 'Fast-paced', aspect: 'pacing' }
  };

  var ALIASES = {
    'project-hail-mary': ['hail mary', 'phm'],
    'a-man-called-ove': ['ove'],
    'tomorrow-and-tomorrow-and-tomorrow': ['tomorrow and tomorrow', 'tomorrow, and tomorrow'],
    'the-seven-husbands-of-evelyn-hugo': ['evelyn hugo', 'seven husbands'],
    'klara-and-the-sun': ['klara'],
    'the-midnight-library': ['midnight library'],
    'the-house-in-the-cerulean-sea': ['cerulean sea'],
    'daisy-jones-and-the-six': ['daisy jones'],
    'the-long-way-to-a-small-angry-planet': ['small angry planet', 'long way to a small'],
    'eleanor-oliphant-is-completely-fine': ['eleanor oliphant'],
    'all-the-light-we-cannot-see': ['all the light']
  };

  var state = { messages: [], brief: newBrief(), shown: [], path: [], busy: false, typing: false, surprise: 0, counter: 0 };

  function newBrief() { return { anchor: null, maxPages: null, shorter: false, long: false, mood: null, traits: [], tags: [] }; }

  /* ------------------------------------------------------------------ */
  /* Parsing                                                             */
  /* ------------------------------------------------------------------ */
  function norm(s) { return String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ,&]+/g, ' ').replace(/\s+/g, ' ').trim(); }

  /** Lowercase letters and digits only, so "Mary," and "Legends & Lattes" still match. */
  function slug(s) { return norm(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }

  function findBook(text) {
    var t = ' ' + slug(text) + ' ';
    var best = null;
    var bestLen = 0;
    D.books.forEach(function (b) {
      var keys = [slug(b.title), slug(b.title).replace(/^(the|a|an) /, '')].concat((ALIASES[b.id] || []).map(slug));
      keys.forEach(function (k) {
        if (k.length < 3) { return; }
        if (t.indexOf(' ' + k + ' ') > -1 || t.indexOf(' ' + k + 's ') > -1) {
          if (k.length > bestLen) { best = b; bestLen = k.length; }
        }
      });
    });
    return best;
  }

  function lastRead() {
    var x = E.recentlyFinished(LS.store.get(), 1)[0];
    return x ? x.book : null;
  }

  function parse(text) {
    var t = norm(text);
    var out = { any: false, mood: null, traits: [], shorter: false, long: false, maxPages: null, anchor: null, surprise: false, lastRead: false, another: false };
    var m;

    if (/\b(surprise|random|wildcard|dealer'?s choice|anything|pick for me)\b/.test(t)) { out.surprise = true; out.any = true; }
    if (/\b(like|similar to) (my )?(last|latest|recent|previous) (read|book)\b/.test(t) || /\bmy (last|latest|recent) (read|book)\b/.test(t)) { out.lastRead = true; out.any = true; }
    if (/\b(another|something else|different one|next one|one more|not that)\b/.test(t)) { out.another = true; out.any = true; }

    var found = findBook(text);
    if (found) { out.anchor = found; out.any = true; }

    Object.keys(MOODS).forEach(function (id) {
      var rx = MOODS[id].rx;
      // "darker" etc. also count; "moving" and "lighter" are weak signals, so require no stronger mood already.
      if (rx.test(t) && !out.mood) { out.mood = id; out.any = true; }
    });
    Object.keys(TRAITS).forEach(function (id) {
      if (TRAITS[id].rx.test(t)) { out.traits.push(id); out.any = true; }
    });

    if ((m = /\bunder\s*(\d{2,4})\b/.exec(t)) || (m = /\b(?:less|fewer) than\s*(\d{2,4})\b/.exec(t)) || (m = /\bat most\s*(\d{2,4})\b/.exec(t))) {
      out.maxPages = parseInt(m[1], 10); out.any = true;
    } else if (/\b(short|shorter|quick|brief|novella|slim|slimmer)\b/.test(t)) { out.shorter = true; out.any = true; }
    if (/\b(long|longer|doorstopper|sprawling|chunky|big book)\b/.test(t)) { out.long = true; out.any = true; }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Brief (conversation memory)                                         */
  /* ------------------------------------------------------------------ */
  function setTag(brief, key, label) {
    brief.tags = brief.tags.filter(function (t) { return t.key !== key; });
    brief.tags.forEach(function (t) { t.fresh = false; });
    brief.tags.push({ key: key, label: label, fresh: true });
  }

  function applyToBrief(brief, p) {
    brief.tags.forEach(function (t) { t.fresh = false; });
    if (p.anchor) {
      brief.anchor = p.anchor.id;
      setTag(brief, 'anchor', 'Like ' + p.anchor.title);
    }
    if (p.lastRead) {
      var lr = lastRead();
      if (lr) { brief.anchor = lr.id; setTag(brief, 'anchor', 'Like ' + lr.title); }
    }
    if (p.maxPages) {
      brief.maxPages = p.maxPages; brief.shorter = false; brief.long = false;
      setTag(brief, 'length', 'Under ' + p.maxPages + ' pages');
    } else if (p.shorter) {
      var a = brief.anchor && E.book(brief.anchor);
      brief.shorter = true; brief.long = false; brief.maxPages = a ? a.pages - 1 : 300;
      setTag(brief, 'length', a ? 'Shorter than ' + a.title : 'Under 300 pages');
    } else if (p.long) {
      brief.long = true; brief.shorter = false; brief.maxPages = null;
      setTag(brief, 'length', 'Longer read');
    }
    p.traits.forEach(function (id) {
      if (brief.traits.indexOf(id) < 0) { brief.traits.push(id); }
      setTag(brief, 'trait:' + id, TRAITS[id].tag);
    });
    if (p.mood) {
      brief.mood = p.mood;
      setTag(brief, 'mood', MOODS[p.mood].tag);
    }
  }

  function dropFromBrief(key) {
    var b = state.brief;
    b.tags = b.tags.filter(function (t) { return t.key !== key; });
    if (key === 'anchor') { b.anchor = null; }
    if (key === 'length') { b.maxPages = null; b.shorter = false; b.long = false; }
    if (key === 'mood') { b.mood = null; }
    if (key.indexOf('trait:') === 0) { var id = key.slice(6); b.traits = b.traits.filter(function (x) { return x !== id; }); }
    b.tags.forEach(function (t) { t.fresh = false; });
  }

  /* ------------------------------------------------------------------ */
  /* Choosing a book                                                     */
  /* ------------------------------------------------------------------ */
  function moodBonus(mood, b) {
    var a = b.aspects;
    var has = function (m) { return b.moods.indexOf(m) > -1 ? 1 : 0; };
    switch (mood) {
      case 'cozy': return (100 - a.darkness) * 0.15 + a.humor * 0.08 - a.complexity * 0.05 + has('cozy') * 8;
      case 'cry': return a.emotion * 0.2 + has('emotional') * 6;
      case 'dark': return a.darkness * 0.2 + has('atmospheric') * 5 + has('dark') * 5;
      case 'funny': return a.humor * 0.22 + has('funny') * 6;
      case 'hopeful': return has('hopeful') * 8 + (100 - a.darkness) * 0.08;
      default: return 0;
    }
  }

  function choose(brief, o) {
    o = o || {};
    var s = LS.store.get();
    // Never recommend the book the reader is asking to be "like".
    var pool = E.candidates(s).filter(function (b) { return b.id !== brief.anchor; });
    var fresh = pool.filter(function (b) { return state.shown.indexOf(b.id) < 0; });
    if (!fresh.length) { fresh = pool; }
    var relaxed = false;
    var sized = fresh;
    if (brief.maxPages) { sized = fresh.filter(function (b) { return b.pages <= brief.maxPages; }); }
    if (brief.long) { sized = fresh.filter(function (b) { return b.pages >= 420; }); }
    if (!sized.length) { sized = fresh; relaxed = true; }

    var anchor = brief.anchor && E.book(brief.anchor);
    var neigh = anchor ? (D.neighbors[anchor.id] || []) : [];
    var ladder = o.surprise ? SURPRISE_LADDER : (brief.mood ? LADDERS[brief.mood] : null);
    var shortLadder = (brief.shorter || brief.maxPages) && !brief.mood && !anchor ? SHORT_LADDER : null;

    var scored = sized.map(function (b) {
      var score = E.match(b, s).score;
      if (anchor) {
        var idx = neigh.indexOf(b.id);
        score += (idx > -1 ? Math.max(6, 28 - idx * 5) : 0) + E.similarity(anchor, b) * 18;
      }
      if (ladder) {
        var li = ladder.indexOf(b.id);
        if (li > -1) { score += Math.max(12, 56 - li * 10); }
        if (!o.surprise) { score += moodBonus(brief.mood, b); }
      }
      if (shortLadder) {
        var si = shortLadder.indexOf(b.id);
        if (si > -1) { score += Math.max(10, 40 - si * 7); }
      }
      brief.traits.forEach(function (id) { score += b.aspects[TRAITS[id].aspect] * 0.2; });
      return { book: b, score: score };
    }).sort(function (a, z) { return z.score - a.score; });

    return { book: scored[0].book, relaxed: relaxed };
  }

  /* ------------------------------------------------------------------ */
  /* Writing the reply                                                   */
  /* ------------------------------------------------------------------ */
  function checksFor(brief, b) {
    var s = LS.store.get();
    var anchor = brief.anchor && E.book(brief.anchor);
    var list = [];
    var a = b.aspects;
    if (anchor && (brief.shorter || brief.maxPages) && brief.shorter) { list.push({ ok: b.pages < anchor.pages, text: 'Shorter than ' + anchor.title + ' (' + b.pages + ' vs ' + anchor.pages + ' pages)' }); }
    else if (brief.maxPages) { list.push({ ok: b.pages <= brief.maxPages, text: 'Under ' + brief.maxPages + ' pages (' + b.pages + ')' }); }
    if (brief.long) { list.push({ ok: b.pages >= 420, text: 'A longer read (' + b.pages + ' pages)' }); }
    brief.traits.forEach(function (id) {
      var asp = TRAITS[id].aspect;
      list.push({ ok: a[asp] >= 78, text: TRAITS[id].tag + ' (' + E.ASPECT[asp].label + ' ' + a[asp] + ' of 100)' });
    });
    if (brief.mood === 'cozy') { list.push({ ok: a.darkness <= 45, text: 'Gentle tone (Tone / darkness ' + a.darkness + ' of 100)' }); }
    if (brief.mood === 'cry') { list.push({ ok: a.emotion >= 85, text: 'Emotional impact ' + a.emotion + ' of 100' }); }
    if (brief.mood === 'dark') { list.push({ ok: a.darkness >= 50 || b.moods.indexOf('atmospheric') > -1, text: 'Atmospheric (Tone / darkness ' + a.darkness + ' of 100)' }); }
    if (brief.mood === 'funny') { list.push({ ok: a.humor >= 70, text: 'Humor ' + a.humor + ' of 100' }); }
    if (brief.mood === 'hopeful') { list.push({ ok: b.moods.indexOf('hopeful') > -1, text: 'A hopeful note, even in hard moments' }); }
    if (anchor && list.length < 4) {
      var shared = E.sharedAspects(anchor, b, E.profile(s), 2);
      if (shared.length) {
        // Put the echo first when it is the only reason, otherwise right after the length check.
        list.splice(Math.min(1, list.length), 0, { ok: true, text: 'Echoes ' + anchor.title + ': ' + shared.map(function (k) { return E.ASPECT[k].label.toLowerCase(); }).join(' and ') });
      }
    }
    var mm = E.match(b, s).neg[0];
    if (mm) { list.push({ ok: false, text: 'Potential mismatch: ' + U.lowerFirst(D.aspectCopy[mm.key][mm.dir]) + ' (' + ui.sign(mm.delta) + ')' }); }
    return list.slice(0, 5);
  }

  function reasonPhrases(brief) {
    var out = [];
    brief.traits.forEach(function (id) { out.push(TRAITS[id].phrase); });
    if (brief.shorter) { out.push('shorter reads'); }
    else if (brief.maxPages) { out.push('books under ' + brief.maxPages + ' pages'); }
    if (brief.long) { out.push('longer, immersive reads'); }
    if (brief.mood) { out.push(MOODS[brief.mood].phrase); }
    return out;
  }

  function refineAdjectives(p, brief) {
    var adj = [];
    if (p.mood) { adj.push(MOODS[p.mood].adj); }
    p.traits.forEach(function (id) { adj.push(TRAITS[id].adj); });
    if (p.shorter || p.maxPages) { adj.push('shorter'); }
    if (p.long) { adj.push('longer'); }
    brief.traits.forEach(function (id) { if (adj.indexOf(TRAITS[id].adj) < 0) { adj.push(TRAITS[id].adj); } });
    return adj.slice(0, 2);
  }

  function parts(arr) { return arr; }

  function composeReply(kind, p, brief, pick, extra) {
    var b = pick.book;
    var B = { b: b.title };
    var s = LS.store.get();
    var reasons = reasonPhrases(brief);
    var anchor = brief.anchor && E.book(brief.anchor);
    var note = pick.relaxed ? ' I could not find an exact length match, so I relaxed that part.' : '';

    if (kind === 'surprise') {
      var m = E.match(b, s).score;
      return parts(['Here is a wildcard: ', B, '. It is a ' + m + '% match for your taste, but it comes at you from an unexpected angle. ' + b.tagline]);
    }
    if (kind === 'another') {
      return parts(['Sure, another angle on the same brief: ', B, '.' + note]);
    }
    if (kind === 'refine') {
      var adj = refineAdjectives(p, brief);
      var adjText = adj.length ? U.listJoin(adj).replace(' and ', ', ') : 'fresh';
      return parts(["Got it. Here's a " + adjText + ' pick instead: ', B, '.' + note]);
    }
    if (kind === 'lastread') {
      var rt = anchor ? E.entry(s, anchor.id) : null;
      return parts(['Your last read was ' + (anchor ? anchor.title : 'a great one') + (rt && rt.rating ? ' (you gave it ' + Number(rt.rating).toFixed(1) + ')' : '') + '. If you loved it, try ', B, '. ' + b.tagline]);
    }
    // fresh
    if (reasons.length) { return parts(['Based on your preference for ' + U.listJoin(reasons) + ", I'd suggest ", B, '.' + note]); }
    if (anchor) { return parts(['Since you loved ' + anchor.title + ", I'd suggest ", B, '.' + note]); }
    return parts(["I'd suggest ", B, '.']);
  }

  function addMessage(msg) {
    msg.id = 'm' + (++state.counter);
    state.messages.push(msg);
    return msg;
  }

  function lastPick() {
    for (var i = state.messages.length - 1; i >= 0; i--) { if (state.messages[i].bookId) { return E.book(state.messages[i].bookId); } }
    return null;
  }

  function recommendation(kind, p, o) {
    o = o || {};
    var brief = state.brief;
    var pick = choose(brief, { surprise: kind === 'surprise' });
    var b = pick.book;
    var s = LS.store.get();
    var r = E.rec(b, s, { variant: 0 });
    state.shown.push(b.id);
    var freshTags = brief.tags.filter(function (t) { return t.fresh; }).map(function (t) { return t.label; });
    state.path.push({ bookId: b.id, note: state.path.length === 0 ? 'Opening pick' : (freshTags.length ? freshTags.join(' + ') : 'Another angle') });
    // A wildcard ignores the brief, so it should not be judged against it.
    var checks = kind === 'surprise'
      ? [{ ok: true, text: 'A wildcard: it sits outside the shape of your recent picks' }].concat(checksFor(newBrief(), b))
      : checksFor(brief, b);
    return {
      role: 'ai', parts: composeReply(kind, p || {}, brief, pick, o), bookId: b.id,
      checks: checks, trail: kind === 'surprise' ? [] : brief.tags.map(function (t) { return { label: t.label, fresh: t.fresh }; }), kind: kind, score: r.m.score
    };
  }

  function respond(text) {
    var t = norm(text);
    var s = LS.store.get();
    var last = lastPick();

    if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b[ !.]*$/.test(t)) {
      return { role: 'ai', parts: ['Hello again. Describe a mood, name a book you loved, or tap one of the ideas below.'] };
    }
    if (/\b(thanks|thank you|thx|cheers)\b/.test(t) && t.length < 40) {
      return { role: 'ai', parts: ['Anytime. Tell me if you want something shorter, cozier, darker or funnier, and I will adjust.'] };
    }
    if (/\b(start over|reset|clear|new search|begin again)\b/.test(t)) {
      state.brief = newBrief(); state.shown = []; state.path = [];
      return { role: 'ai', parts: ['Fresh page. What are you in the mood to read?'], reset: true };
    }
    if (/\b(add|save|shelve|put)\b/.test(t) && /\b(list|shelf|want|it|that|this|book)\b/.test(t) && last) {
      var st = E.statusOf(s, last.id);
      if (st) { return { role: 'ai', parts: [{ b: last.title }, ' is already on your shelves as ' + ui.STATUS[st].label + '.'] }; }
      LS.app.setStatus(last.id, 'want', { quiet: true });
      return { role: 'ai', parts: ['Done. I added ', { b: last.title }, ' to Want to Read.'] };
    }
    if (/\bwhy\b/.test(t) && last) {
      var r = E.rec(last, s, { variant: 0 });
      var pos = r.why.reasons.map(function (x) { return x.text.toLowerCase() + ' (' + ui.sign(x.delta) + ')'; });
      var neg = r.why.mismatches.map(function (x) { return x.text.toLowerCase() + ' (' + ui.sign(x.delta) + ')'; });
      return {
        role: 'ai', explain: true,
        parts: [{ b: last.title }, ' scores ' + r.m.score + '% for you. It leads on ' + U.listJoin(pos) + '.' + (neg.length ? ' The one thing to watch is ' + U.listJoin(neg) + '.' : '') +
          ' Collaborative ' + r.m.collaborative + ', semantic ' + r.m.semantic + ', interpretable ' + r.m.interpretable + '.']
      };
    }

    var p = parse(text);
    if (!p.any) {
      return { role: 'ai', parts: ["I could not map that to a mood or a book yet. Try 'something cozy', 'under 300 pages', 'make me cry', or name a book you loved."] };
    }

    // "Like my last read" starts a fresh brief on the last finished book (picks already shown stay excluded).
    if (p.lastRead) {
      state.brief = newBrief();
      applyToBrief(state.brief, p);
      return recommendation('lastread', p);
    }

    var hadBrief = state.brief.tags.length > 0 && state.shown.length > 0;
    var newAnchor = p.anchor && state.brief.anchor && p.anchor.id !== state.brief.anchor;
    if (newAnchor) { state.brief = newBrief(); state.shown = []; hadBrief = false; }

    if (p.surprise && !p.mood && !p.anchor) {
      state.surprise++;
      return recommendation('surprise', p);
    }
    if (p.another && !p.mood && !p.anchor && !p.traits.length && !p.shorter && !p.maxPages && !p.long) {
      return recommendation('another', p);
    }
    applyToBrief(state.brief, p);
    return recommendation(hadBrief ? 'refine' : 'fresh', p);
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */
  function textHtml(partsArr, animate) {
    var n = 0;
    return partsArr.map(function (p) {
      var bold = typeof p === 'object';
      var str = bold ? p.b : p;
      return str.split(/(\s+)/).map(function (tok) {
        if (!tok) { return ''; }
        if (/^\s+$/.test(tok)) { return tok; }
        var span = '<span class="w"' + (animate ? ' style="--n:' + Math.min(n++, 70) + '"' : '') + '>' + esc(tok) + '</span>';
        return bold ? '<strong>' + span + '</strong>' : span;
      }).join('');
    }).join('');
  }

  function wordCount(partsArr) {
    return partsArr.reduce(function (t, p) { return t + String(typeof p === 'object' ? p.b : p).split(/\s+/).filter(Boolean).length; }, 0);
  }

  function checksHtml(checks) {
    if (!checks || !checks.length) { return ''; }
    return '<ul class="checks">' + checks.map(function (c) {
      return '<li class="' + (c.ok ? 'is-ok' : 'is-warn') + '"><span class="checks__icon">' + icon(c.ok ? 'check' : 'minus', 14, 2.4) + '</span><span>' + esc(c.text) + '</span></li>';
    }).join('') + '</ul>';
  }

  function cardHtml(msg, s) {
    var b = E.book(msg.bookId);
    if (!b) { return ''; }
    var r = E.rec(b, s, { variant: 0 });
    return '<article class="chat-card" data-book="' + b.id + '">' +
      '<a class="chat-card__cover" href="' + ui.bookHref(b) + '" aria-label="Open ' + esc(b.title) + '">' + ui.cover(b, { size: 'md' }) + '</a>' +
      '<div class="chat-card__body"><div class="chat-card__head"><div><h3 class="chat-card__title"><a href="' + ui.bookHref(b) + '">' + esc(b.title) + '</a></h3>' +
      '<p class="chat-card__author">' + esc(b.author) + ' · ' + b.pages + ' pages</p>' +
      '<p class="chat-card__rating">' + ui.stars(b.rating) + '<b>' + b.rating.toFixed(1) + '</b></p></div>' + ui.match(r.m.score, { cls: 'match--md' }) + '</div>' +
      '<p class="chat-card__why">' + esc(r.why.short) + '</p>' + checksHtml(msg.checks) + ui.tags(r.why) +
      '<div class="chat-card__actions">' + ui.shelfControl(b, s, { short: true }) + '<a class="btn btn--ghost btn--sm" href="' + ui.bookHref(b) + '"><span>Details</span>' + icon('arrow-right', 15) + '</a></div></div></article>';
  }

  function trailHtml(trail) {
    if (!trail || trail.length < 2) { return ''; }
    return '<ol class="trail" aria-label="Your brief so far">' + trail.map(function (t) {
      return '<li class="trail__item' + (t.fresh ? ' is-fresh' : '') + '">' + esc(t.label) + '</li>';
    }).join('') + '</ol>';
  }

  function starterHtml() {
    var items = [
      'I want something like Project Hail Mary, but shorter and more character-driven.',
      'Something cozy for a rainy weekend',
      'A short book I can finish tonight'
    ];
    return '<div class="starters">' + items.map(function (t, i) {
      return '<button type="button" class="starter" data-action="chat-chip" data-text="' + esc(t) + '"><span class="starter__no">0' + (i + 1) + '</span><span>' + esc(t) + '</span></button>';
    }).join('') + '<button type="button" class="starters__play link-underline" data-action="chat-demo">' + icon('sparkle', 14, 1.8) + '<span>Play the example conversation</span></button></div>';
  }

  function messageHtml(msg, s, o) {
    o = o || {};
    if (msg.role === 'user') {
      return '<div class="msg msg--user' + (o.fresh ? ' msg--new' : '') + '" data-id="' + msg.id + '"><div class="msg__bubble"><span class="msg__who">You</span><p class="msg__text">' + esc(msg.text) + '</p></div></div>';
    }
    var delay = (wordCount(msg.parts) * 0.038 + 0.25).toFixed(2);
    return '<div class="msg msg--ai' + (o.fresh ? ' msg--new' : '') + '" data-id="' + msg.id + '" style="--card-delay:' + delay + 's">' +
      '<span class="msg__avatar" aria-hidden="true">' + icon('sparkle', 16, 1.8) + '</span><div class="msg__body"><div class="msg__bubble"><span class="msg__who">LitSense</span>' +
      '<p class="msg__text">' + textHtml(msg.parts, o.fresh) + '</p></div>' +
      (msg.starters ? starterHtml() : '') + (msg.bookId ? cardHtml(msg, s) + trailHtml(msg.trail) : '') + '</div></div>';
  }

  function typingHtml() {
    return '<div class="msg msg--ai msg--typing" id="chatTyping"><span class="msg__avatar" aria-hidden="true">' + icon('sparkle', 16, 1.8) + '</span>' +
      '<div class="msg__body"><div class="msg__bubble typing" role="status" aria-label="LitSense is thinking"><span class="typing__dots"><i></i><i></i><i></i></span><span class="typing__text">Reading your shelves</span></div></div></div>';
  }

  function ensureGreeting() {
    if (state.messages.length) { return; }
    addMessage({ role: 'ai', parts: ['Welcome back, Maya. Tell me what you are in the mood to read, or name a book you loved and I will look for its echoes.'], starters: true });
  }

  function messagesHtml(s) {
    ensureGreeting();
    var hasUser = state.messages.some(function (m) { return m.role === 'user'; });
    return state.messages.map(function (m) {
      var copy = m;
      if (m.starters && hasUser) { copy = { id: m.id, role: m.role, parts: m.parts }; }
      return messageHtml(copy, s || LS.store.get());
    }).join('') + (state.typing ? typingHtml() : '');
  }

  function chipsHtml() {
    var hasRec = state.shown.length > 0;
    var list = hasRec
      ? ['Make it cozier', 'Make it shorter', 'More emotional', 'Darker', 'Why this book?', 'Add it to my list']
      : LS.views.CHAT_STARTERS;
    return list.map(function (t) {
      return '<button type="button" class="chip chip--suggest" data-action="chat-chip" data-text="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
  }

  function asideHtml(s) {
    var tags = state.brief.tags;
    var briefHtml = tags.length
      ? '<ul class="brief">' + tags.map(function (t) {
        return '<li class="brief__tag' + (t.fresh ? ' is-fresh' : '') + '"><span>' + esc(t.label) + '</span><button type="button" class="brief__drop" data-action="brief-drop" data-key="' + esc(t.key) + '" aria-label="Remove ' + esc(t.label) + '">' + icon('x', 13, 2.4) + '</button></li>';
      }).join('') + '</ul>'
      : '<p class="aside__empty">Nothing yet. Say what you want and your brief builds here, one refinement at a time.</p>';
    var pathHtml = state.path.length
      ? '<ol class="path">' + state.path.map(function (p, i) {
        var b = E.book(p.bookId);
        return '<li class="path__item"><span class="path__thumb">' + ui.cover(b, { size: 'xs' }) + '</span><span class="path__text"><strong>' + esc(b.title) + '</strong><small>' + esc(p.note) + '</small></span></li>';
      }).join('') + '</ol>'
      : '<p class="aside__empty">Your picks appear here, in the order you refined them.</p>';
    return '<section class="aside__block"><h2 class="aside__title">Your brief</h2>' + briefHtml + '</section>' +
      '<section class="aside__block"><h2 class="aside__title">Refinement path</h2>' + pathHtml + '</section>' +
      '<section class="aside__block aside__block--note"><h2 class="aside__title">How it works</h2>' +
      '<p>The recommender decides <strong>what</strong> to suggest. The language layer only decides <strong>how</strong> to say it. Every pick is grounded in your shelves and reader reviews.</p></section>';
  }

  /* ------------------------------------------------------------------ */
  /* Live DOM updates                                                    */
  /* ------------------------------------------------------------------ */
  function el(id) { return doc.getElementById(id); }

  function scrollDown(smooth) {
    var sc = el('chatScroll');
    if (!sc) { return; }
    if (U.reducedMotion() || !smooth) { sc.scrollTop = sc.scrollHeight; return; }
    sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
  }

  function refreshSide() {
    var chips = el('chatChips');
    var aside = el('chatAside');
    if (chips) { chips.innerHTML = chipsHtml(); }
    if (aside) { aside.innerHTML = asideHtml(LS.store.get()); }
  }

  function append(html) {
    var sc = el('chatScroll');
    if (!sc) { return null; }
    var tmp = doc.createElement('div');
    tmp.innerHTML = html;
    var node = tmp.firstElementChild;
    sc.appendChild(node);
    return node;
  }

  function setBusy(on) {
    state.busy = on;
    var form = el('chatForm');
    if (form) { form.classList.toggle('is-busy', on); }
  }

  function send(text) {
    var t = String(text || '').trim();
    if (!t || state.busy) { return Promise.resolve(); }
    ensureGreeting();
    setBusy(true);
    var s = LS.store.get();
    var userMsg = addMessage({ role: 'user', text: t });
    var starters = doc.querySelector('#chatScroll .starters');
    if (starters && starters.parentNode) { starters.parentNode.removeChild(starters); }
    append(messageHtml(userMsg, s, { fresh: true }));
    state.typing = true;
    append(typingHtml());
    scrollDown(true);
    var input = el('chatInput');
    if (input) { input.value = ''; }

    var reply = respond(t);
    var wait = 900 + Math.min(1100, wordCount(reply.parts) * 14);
    return U.sleep(U.reducedMotion() ? 250 : wait).then(function () {
      state.typing = false;
      var typing = el('chatTyping');
      if (typing && typing.parentNode) { typing.parentNode.removeChild(typing); }
      var aiMsg = addMessage(reply);
      var node = append(messageHtml(aiMsg, LS.store.get(), { fresh: true }));
      refreshSide();
      scrollDown(true);
      var revealMs = (wordCount(reply.parts) * 38) + 300;
      if (node && aiMsg.bookId) { setTimeout(function () { scrollDown(true); }, U.reducedMotion() ? 0 : revealMs + 250); }
      setBusy(false);
      if (reply.reset) { var sc = el('chatScroll'); if (sc) { sc.innerHTML = messagesHtml(LS.store.get()); } }
    });
  }

  function dropTag(key) {
    if (state.busy) { return; }
    var tag = state.brief.tags.filter(function (t) { return t.key === key; })[0];
    if (!tag) { return; }
    dropFromBrief(key);
    if (!state.brief.tags.length) {
      state.shown = []; state.path = [];
      var s0 = LS.store.get();
      var m0 = addMessage({ role: 'ai', parts: ['Removed "' + tag.label + '". The brief is empty now, so tell me what you are in the mood for.'] });
      append(messageHtml(m0, s0, { fresh: true }));
      refreshSide(); scrollDown(true);
      return;
    }
    setBusy(true);
    var userMsg = addMessage({ role: 'user', text: 'Drop "' + tag.label + '"' });
    append(messageHtml(userMsg, LS.store.get(), { fresh: true }));
    state.typing = true;
    append(typingHtml());
    scrollDown(true);
    U.sleep(U.reducedMotion() ? 200 : 900).then(function () {
      state.typing = false;
      var typing = el('chatTyping');
      if (typing && typing.parentNode) { typing.parentNode.removeChild(typing); }
      var rec = recommendation('another', {});
      rec.parts = ['Okay, without "' + tag.label + '", try ', { b: E.book(rec.bookId).title }, '.'];
      var aiMsg = addMessage(rec);
      append(messageHtml(aiMsg, LS.store.get(), { fresh: true }));
      refreshSide(); scrollDown(true);
      setBusy(false);
    });
  }

  function reset() {
    state = { messages: [], brief: newBrief(), shown: [], path: [], busy: false, typing: false, surprise: 0, counter: 0 };
  }

  /** Plays the two-turn example from the project brief, for presenting. */
  function playDemo() {
    if (state.busy) { return Promise.resolve(); }
    reset();
    var sc = el('chatScroll');
    if (sc) { sc.innerHTML = messagesHtml(LS.store.get()); }
    refreshSide();
    return U.sleep(500)
      .then(function () { return send('I want something like Project Hail Mary, but shorter and more character-driven.'); })
      .then(function () { return U.sleep(1100); })
      .then(function () { return send('Make it cozier.'); });
  }

  LS.chat = {
    state: function () { return state; }, reset: reset, send: send, playDemo: playDemo, dropTag: dropTag, parse: parse, respond: respond,
    messagesHtml: messagesHtml, chipsHtml: chipsHtml, asideHtml: asideHtml, scrollDown: scrollDown,
    get busy() { return state.busy; }
  };
})(window);
