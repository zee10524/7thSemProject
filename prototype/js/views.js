/* ==========================================================================
   LitSense prototype - VIEWS (pages)
   --------------------------------------------------------------------------
   Each view is (ctx) -> HTML string, where ctx = { state, demo, params }.
   Views never touch the DOM and never mutate state. app.js renders them.
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

  /* Section titles differ slightly per demo (the deck wording vs the editorial wording). */
  var COPY = {
    1: { because: 'Because you liked&hellip;', recent: 'Recently read', gems: 'Hidden gems', authors: 'More from authors you love', peers: 'Readers with your taste also loved&hellip;' },
    2: { because: 'Because you loved&hellip;', recent: 'Recently read&hellip;', gems: 'Hidden gems', authors: 'More from authors you love', peers: 'Readers with your taste also loved&hellip;' },
    3: { because: 'Because you liked&hellip;', recent: 'Recently read', gems: 'Hidden gems', authors: 'More from authors you love', peers: 'Readers with your taste also loved&hellip;' }
  };

  var CHAT_STARTERS = ['Something cozy', 'Make me cry', 'Under 300 pages', 'Dark & atmospheric', 'Like my last read', 'Surprise me'];

  function container(inner, cls) { return '<div class="container' + (cls ? ' ' + cls : '') + '">' + inner + '</div>'; }

  function section(id, cls, inner) {
    return '<section class="section section--' + cls + '" id="sec-' + id + '" data-reveal>' + container(inner) + '</section>';
  }

  function pageHead(o) {
    return '<header class="page-head' + (o.cls ? ' ' + o.cls : '') + '" data-reveal>' + container(
      (o.eyebrow ? '<p class="eyebrow">' + o.eyebrow + '</p>' : '') +
      '<h1 class="page-title">' + o.title + '</h1>' +
      (o.sub ? '<p class="page-sub">' + o.sub + '</p>' : '') + (o.extra || '')) + '</header>';
  }

  function stat(label, value, note) {
    return '<div class="stat"><dt class="stat__label">' + label + '</dt><dd class="stat__value">' + value + '</dd>' + (note ? '<dd class="stat__note">' + note + '</dd>' : '') + '</div>';
  }

  function anchorChips(anchors, activeId, scope) {
    return '<div class="chips chips--anchor" role="group" aria-label="Choose a book">' + anchors.map(function (b) {
      var on = b.id === activeId;
      return '<button type="button" class="chip chip--book' + (on ? ' is-active' : '') + '" data-action="anchor" data-scope="' + scope + '" data-value="' + b.id + '" aria-pressed="' + on + '">' +
        '<span class="chip__thumb">' + ui.cover(b, { size: 'xs' }) + '</span><span>' + esc(b.title) + '</span></button>';
    }).join('') + '</div>';
  }

  function cardGrid(items, state, cls, o) {
    o = o || {};
    return '<div class="cards ' + cls + '">' + items.map(function (r, i) { return ui.recCard(r, state, { i: i, density: o.density, cls: o.cls }); }).join('') + '</div>';
  }

  /* ====================================================================== */
  /* DISCOVER (home)                                                         */
  /* ====================================================================== */
  function heroDark(ctx, H) {
    var f = H.top[0];
    var b = f.book;
    return '<section class="hero hero--dark" data-reveal><span class="hero__ring hero__ring--a" aria-hidden="true"></span><span class="hero__ring hero__ring--b" aria-hidden="true"></span>' +
      container(
        '<div class="hero__grid"><div class="hero__copy">' +
        '<p class="eyebrow eyebrow--rule">' + esc(D.config.tagline) + '</p>' +
        '<h1 class="hero__title">Find your next <em>favorite story.</em></h1>' +
        '<p class="hero__lede">LitSense understands not just what you read, but why you loved it.</p>' +
        '<p class="hero__sub">LitSense learns from what you read, what you rate, and what you say you loved.</p>' +
        '<div class="hero__cta"><a class="btn btn--primary btn--lg" href="#/recommendations"><span>Explore recommendations</span>' + icon('arrow-right', 18) + '</a>' +
        '<a class="btn btn--ghost btn--lg" href="#/chat">' + icon('sparkle', 18) + '<span>Ask LitSense</span></a></div></div>' +
        '<figure class="hero__feature"><a class="hero__cover" href="' + ui.bookHref(b) + '" aria-label="Open ' + esc(b.title) + '">' + ui.cover(b, { size: 'xl', eager: true }) + '</a>' +
        '<figcaption class="hero__caption"><span class="eyebrow">Featured for you</span><strong class="hero__book">' + esc(b.title) + '</strong><span class="hero__author">' + esc(b.author) + '</span>' +
        ui.match(f.m.score, { cls: 'match--inline' }) + '<p class="hero__why">&ldquo;' + esc(f.why.short) + '&rdquo;</p></figcaption></figure></div>') +
      '<p class="hero__epigraph">' + esc(D.config.epigraph) + '</p></section>';
  }

  function heroEditorial(ctx, H) {
    var f = H.top[0];
    var b = f.book;
    var idx = [
      ['top', 'Top picks for you'], ['because', COPY[2].because], ['recent', COPY[2].recent], ['gems', 'Hidden gems'], ['peers', COPY[2].peers], ['authors', 'More from authors you love']
    ];
    return '<section class="hero hero--editorial" data-reveal>' + container(
      '<div class="hero__strip"><span>The front page</span><span>Picked for Maya</span><span>Updated from your shelves, daily</span></div>' +
      '<div class="hero__grid"><div class="hero__copy"><p class="eyebrow">The Reader&rsquo;s Edition</p>' +
      '<h1 class="hero__title">Books you&rsquo;ll <span class="scribble">actually</span> want to finish.</h1>' +
      '<p class="hero__deck"><span class="dropcap">L</span>itSense learns from what you read, what you rate, and what you say you loved. Then it tells you, in plain words, why each book made the page.</p>' +
      '<div class="hero__cta"><a class="btn btn--primary btn--lg" href="#/recommendations"><span>Explore recommendations</span>' + icon('arrow-right', 18) + '</a>' +
      '<a class="link-underline" href="#/chat">Ask LitSense</a></div></div>' +
      '<figure class="hero__feature"><span class="hero__tape" aria-hidden="true"></span><a class="hero__cover" href="' + ui.bookHref(b) + '" aria-label="Open ' + esc(b.title) + '">' + ui.cover(b, { size: 'xl', eager: true }) + '</a>' +
      ui.match(f.m.score, { cls: 'match--stamp' }) +
      '<figcaption><span class="eyebrow">Editor&rsquo;s pick</span><strong>' + esc(b.title) + '</strong><span>' + esc(b.author) + '</span>' +
      '<em class="hand">start here, this one is yours</em></figcaption></figure>' +
      '<aside class="hero__index" aria-label="In this issue"><h2 class="hero__index-title">In this issue</h2><ol>' + idx.map(function (x, i) {
        return '<li><button type="button" data-action="scroll" data-target="sec-' + x[0] + '"><span class="num">0' + (i + 1) + '</span><span>' + x[1] + '</span></button></li>';
      }).join('') + '</ol></aside></div>') + '</section>';
  }

  function dashboard(ctx, H) {
    var s = ctx.state;
    var st = E.stats(s);
    var prof = E.profile(s);
    var reading = E.booksWithStatus(s, 'reading').sort(function (a, z) { return (z.entry.startedAt || 0) - (a.entry.startedAt || 0); })[0];
    var picks = E.topPicks(s, 5, {});
    var avg = picks.length ? Math.round(picks.reduce(function (t, r) { return t + r.m.score; }, 0) / picks.length) : 0;
    var today = (new Date().getDay() + 6) % 7;
    var week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (d, i) {
      return '<span class="dot' + (i <= today ? ' is-on' : '') + (i === today ? ' is-today' : '') + '"><i></i><small>' + d + '</small></span>';
    }).join('');
    var goal = D.readerProfile.goal;
    var top3 = E.KEYS.slice().sort(function (a, z) { return prof[z] - prof[a]; }).slice(0, 3);
    var genreRows = st.genres.slice(0, 4).map(function (g) {
      return '<li><span class="gname">' + esc(g.genre) + '</span>' + ui.bar(g.bar) + '<span class="gpct">' + U.plural(g.books, 'book') + '</span></li>';
    }).join('');
    var activity = (s.activity || []).slice(0, 5).map(function (a) {
      return '<li class="act act--' + a.type + '"><span class="act__dot"></span><span class="act__text">' + esc(a.text) + '</span><span class="act__when">' + U.ago(a.at) + '</span></li>';
    }).join('');
    var current = reading
      ? '<div class="current"><a class="current__cover" href="' + ui.bookHref(reading.book) + '">' + ui.cover(reading.book, { size: 'md' }) + '</a><div class="current__body">' +
        '<h3 class="current__title"><a href="' + ui.bookHref(reading.book) + '">' + esc(reading.book.title) + '</a></h3><p class="current__author">' + esc(reading.book.author) + '</p>' +
        '<div class="current__row">' + ui.ring(reading.entry.progress || 0, { unit: '%', cls: 'ring--sm' }) +
        '<button type="button" class="btn btn--primary btn--sm" data-action="progress" data-book="' + reading.book.id + '">Continue reading</button></div></div></div>'
      : '<p class="tile__empty">Nothing in progress. Pick your next book from your list.</p><a class="btn btn--primary btn--sm" href="#/my-books">Open My Books</a>';
    return '<div class="bento">' +
      '<article class="tile tile--current"><p class="tile__label">Currently reading</p>' + current + '</article>' +
      '<article class="tile tile--streak"><p class="tile__label">' + icon('flame', 16, 1.8) + ' Reading streak</p><p class="tile__big">' + D.readerProfile.streakDays + '<small>days</small></p><div class="week">' + week + '</div></article>' +
      '<article class="tile tile--read"><p class="tile__label">Books read</p><p class="tile__big">' + st.read + '<small>of ' + goal.target + '</small></p>' +
      ui.bar(Math.round(st.read / goal.target * 100)) + '<p class="tile__note">' + st.pages.toLocaleString('en-US') + ' pages so far, avg rating ' + st.avgRating.toFixed(1) + '</p></article>' +
      '<article class="tile tile--genres"><p class="tile__label">Favorite genres</p><ul class="genre-list">' + (genreRows || '<li>Finish a book to see your genres.</li>') + '</ul></article>' +
      '<article class="tile tile--dna"><p class="tile__label">Reading DNA</p>' + ui.radar(prof, { labels: false, cls: 'radar--mini' }) +
      '<p class="tile__note">Strongest: ' + top3.map(function (k) { return E.ASPECT[k].label.toLowerCase(); }).join(', ') + '</p><a class="link-arrow" href="#/profile"><span>See your Reader DNA</span>' + icon('arrow-right', 15) + '</a></article>' +
      '<article class="tile tile--score"><p class="tile__label">Recommendation score</p>' + ui.ring(avg, { unit: '%', cls: 'ring--lg' }) +
      '<p class="tile__note">Average match across your top picks. Profile confidence ' + D.readerProfile.confidence + '%.</p></article>' +
      '<article class="tile tile--activity"><p class="tile__label">Recent activity</p><ul class="activity">' + activity + '</ul></article></div>';
  }

  function heroOS(ctx, H) {
    return '<section class="hero hero--os" data-reveal>' + container(
      '<div class="hero__head"><p class="eyebrow">' + U.greeting() + ', Maya</p>' +
      '<h1 class="hero__title">Your reading taste, <em>understood.</em></h1>' +
      '<p class="hero__lede">LitSense learns from what you read, what you rate, and what you say you loved.</p>' +
      '<div class="hero__cta"><a class="btn btn--primary btn--lg" href="#/recommendations"><span>Explore recommendations</span>' + icon('arrow-right', 18) + '</a>' +
      '<a class="btn btn--soft btn--lg" href="#/chat">' + icon('sparkle', 18) + '<span>Ask LitSense</span></a></div></div>' + dashboard(ctx, H)) + '</section>';
  }

  function recentStrip(ctx, H) {
    var s = ctx.state;
    var latest = H.recent[0];
    var items = H.recent.slice(0, 5).map(function (x, i) {
      return ui.miniCard(x.book, s, { i: i, note: x.entry.finishedAt ? 'Finished ' + U.ago(x.entry.finishedAt) : '' });
    }).join('');
    var cta = latest
      ? '<a class="strip__cta" href="#/recent/' + latest.book.id + '"><span class="eyebrow">Just finished ' + esc(latest.book.title) + '?</span><strong>See what to read next</strong>' + icon('arrow-right', 20) + '</a>'
      : '';
    return '<div class="strip">' + items + cta + '</div>';
  }

  function discover(ctx) {
    var s = ctx.state;
    var demo = ctx.demo;
    var H = E.homeSections(s, s.ui);
    var C = COPY[demo] || COPY[1];
    var hero = demo === 2 ? heroEditorial(ctx, H) : (demo === 3 ? heroOS(ctx, H) : heroDark(ctx, H));

    var out = '<div class="page page--discover">' + hero;

    out += section('top', 'top', ui.sectionHead({
      no: '01', kicker: 'Your next great read is probably hiding here.', title: 'Top picks <em>for you</em>',
      sub: 'Chosen from your shelves, your ratings and what readers like you loved.', href: '#/recommendations', more: 'All recommendations'
    }) + cardGrid(H.top, s, 'cards--top'));

    out += section('because', 'because', ui.sectionHead({ no: '02', title: C.because, sub: H.anchor ? 'Books that share the strengths of <strong>' + esc(H.anchor.title) + '</strong>.' : '' }) +
      (H.anchors.length ? anchorChips(H.anchors, H.anchor && H.anchor.id, 'home') : '') + cardGrid(H.because, s, 'cards--4', { density: 'compact' }));

    out += section('recent', 'recent', ui.sectionHead({
      no: '03', title: C.recent, sub: 'Your latest finished books. Finished something new? Tell us what you loved.', href: '#/my-books', more: 'My Books'
    }) + recentStrip(ctx, H));

    out += section('gems', 'gems', ui.sectionHead({ no: '04', title: C.gems, sub: 'Loved by readers with your taste, and far less talked about.' }) + cardGrid(H.gems, s, 'cards--4', { density: 'compact' }));

    if (demo === 2) {
      out += section('peers', 'peers', ui.sectionHead({ no: '05', title: C.peers, sub: 'Readers whose shelves look like yours keep coming back to these.' }) + cardGrid(H.peers, s, 'cards--4', { density: 'compact' }));
    }

    out += section('authors', 'authors', ui.sectionHead({ no: demo === 2 ? '06' : '05', title: C.authors, sub: 'You rated their books highly, so we looked for more.' }) + cardGrid(H.authors, s, 'cards--4', { density: 'compact' }));

    out += '<section class="section section--ask" data-reveal>' + container(
      '<div class="ask"><div class="ask__text"><p class="eyebrow">Ask LitSense</p><h2 class="ask__title">Not sure what you are in the mood for?</h2>' +
      '<p class="ask__sub">Tell the concierge. It will find the book, and explain the choice.</p></div>' +
      '<div class="ask__chips">' + CHAT_STARTERS.map(function (t) { return '<button type="button" class="chip" data-action="ask" data-prompt="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div></div>') + '</section>';

    return out + '</div>';
  }

  /* ====================================================================== */
  /* MY BOOKS                                                                */
  /* ====================================================================== */
  function myBooks(ctx) {
    var s = ctx.state;
    var u = s.ui;
    var st = E.stats(s);
    var tab = u.booksTab || 'reading';
    var mode = u.booksView || 'grid';
    var lists = {
      reading: E.booksWithStatus(s, 'reading').sort(function (a, z) { return (z.entry.progress || 0) - (a.entry.progress || 0); }),
      want: E.booksWithStatus(s, 'want').sort(function (a, z) { return (z.entry.addedAt || 0) - (a.entry.addedAt || 0); }),
      read: E.booksWithStatus(s, 'read').sort(function (a, z) { return (z.entry.finishedAt || 0) - (a.entry.finishedAt || 0); })
    };
    var tabs = [['reading', 'Currently Reading'], ['want', 'Want to Read'], ['read', 'Read']];
    var empty = {
      reading: ['Nothing in progress', 'Start a book from your Want to Read list and it will show up here with its progress.'],
      want: ['Your list is empty', 'Add books from Discover or ask LitSense. They will wait here for you.'],
      read: ['No finished books yet', 'Mark a book as read and rate it. Your Reader DNA starts learning from it.']
    };
    var goal = D.readerProfile.goal;
    var list = lists[tab];
    var body = list.length
      ? '<div class="shelf shelf--' + mode + '">' + list.map(function (x, i) { return ui.shelfCard(x.book, x.entry, s, { i: i }); }).join('') + '</div>'
      : '<div class="empty"><span class="empty__icon">' + icon('book-open', 28, 1.4) + '</span><h3>' + empty[tab][0] + '</h3><p>' + empty[tab][1] + '</p><a class="btn btn--primary btn--sm" href="#/discover"><span>Browse Discover</span>' + icon('arrow-right', 15) + '</a></div>';

    return '<div class="page page--books">' + pageHead({
      eyebrow: 'Your shelves', title: 'My Reading Life',
      sub: 'Everything you are reading, planning to read and have finished. Rate and review as you go; LitSense listens.',
      extra: '<dl class="stats">' + stat('Read', st.read) + stat('Reading', st.reading) + stat('Want to read', st.want) + stat('Pages read', st.pages.toLocaleString('en-US')) +
        '<div class="stat stat--goal"><dt class="stat__label">' + esc(goal.label) + '</dt><dd class="stat__value">' + st.read + '<small> of ' + goal.target + '</small></dd><dd>' + ui.bar(Math.round(st.read / goal.target * 100)) + '</dd></div></dl>'
    }) + '<section class="section section--shelf">' + container(
      '<div class="tabs" role="tablist" aria-label="Shelves">' + tabs.map(function (t) {
        var on = t[0] === tab;
        return '<button type="button" role="tab" class="tab' + (on ? ' is-active' : '') + '" aria-selected="' + on + '" data-action="tab" data-tab="' + t[0] + '"><span>' + t[1] + '</span><span class="tab__count">' + lists[t[0]].length + '</span></button>';
      }).join('') + '<div class="tabs__tools seg" role="group" aria-label="View">' +
      '<button type="button" class="seg__btn' + (mode === 'grid' ? ' is-active' : '') + '" data-action="view-mode" data-mode="grid" aria-pressed="' + (mode === 'grid') + '" aria-label="Grid view">' + icon('grid', 17) + '</button>' +
      '<button type="button" class="seg__btn' + (mode === 'list' ? ' is-active' : '') + '" data-action="view-mode" data-mode="list" aria-pressed="' + (mode === 'list') + '" aria-label="List view">' + icon('list', 17) + '</button></div></div>' + body) + '</section></div>';
  }

  /* ====================================================================== */
  /* RECOMMENDATIONS                                                         */
  /* ====================================================================== */
  function filterBar(f) {
    var genres = [{ id: 'all', label: 'All genres' }].concat(D.genreFilters.map(function (g) { return { id: g.id, label: g.label }; }));
    var moods = [{ id: 'any', label: 'Any mood' }].concat(D.moodFilters);
    var lengths = [{ id: 'any', label: 'Any length' }, { id: 'short', label: 'Short, under 300' }, { id: 'medium', label: 'Medium' }, { id: 'long', label: 'Long, 420+' }];
    var sorts = [['match', 'Best match'], ['rating', 'Highest rated'], ['short', 'Shortest first']];
    var dirty = (f.genre && f.genre !== 'all') || (f.mood && f.mood !== 'any') || (f.length && f.length !== 'any');
    return '<div class="filters" data-reveal>' + container('<div class="filters__inner">' +
      '<div class="filters__row"><span class="filters__label">Genre</span>' + ui.chips(genres, f.genre || 'all', 'filter', { key: 'genre', label: 'Filter by genre' }) + '</div>' +
      '<div class="filters__row"><span class="filters__label">Mood</span>' + ui.chips(moods, f.mood || 'any', 'filter', { key: 'mood', label: 'Filter by mood' }) + '</div>' +
      '<div class="filters__row filters__row--split"><div class="filters__group"><span class="filters__label">Length</span>' + ui.chips(lengths, f.length || 'any', 'filter', { key: 'length', label: 'Filter by length' }) + '</div>' +
      '<div class="filters__group filters__group--end"><label class="select"><span class="filters__label">Sort</span><select data-action="sort" aria-label="Sort recommendations">' +
      sorts.map(function (o) { return '<option value="' + o[0] + '"' + ((f.sort || 'match') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      (dirty ? '<button type="button" class="btn btn--ghost btn--sm" data-action="clear-filters">' + icon('x', 15, 2) + '<span>Clear filters</span></button>' : '') + '</div></div></div>') + '</div>';
  }

  function recommendations(ctx) {
    var s = ctx.state;
    var f = s.ui.recFilters || {};
    var R = E.recSections(s, s.ui);
    var prof = D.readerProfile;
    var latest = E.recentlyFinished(s, 1)[0];
    var wide = function (items) { return '<div class="cards cards--wide">' + items.map(function (r, i) { return ui.recWide(r, s, { i: i }); }).join('') + '</div>'; };

    var out = '<div class="page page--recs">' + pageHead({
      eyebrow: 'Recommendations', title: 'Made for <em>your taste.</em>',
      sub: 'Every pick comes with the reasons behind it. Rate more books and the reasons get sharper.',
      extra: '<p class="page-meta"><span>' + R.count + ' picks</span><i></i><span>Learned from ' + prof.signals.ratings + ' ratings and ' + prof.signals.reviews + ' reviews</span>' +
        (latest ? '<i></i><a class="link-arrow" href="#/recent/' + latest.book.id + '"><span>Just finished ' + esc(latest.book.title) + '?</span>' + icon('arrow-right', 15) + '</a>' : '') + '</p>'
    }) + filterBar(f);

    if (!R.count) {
      return out + '<section class="section">' + container('<div class="empty"><span class="empty__icon">' + icon('search', 28, 1.4) + '</span><h3>No picks match these filters</h3>' +
        '<p>Try a wider genre or length. LitSense only shows books you have not read yet.</p><button type="button" class="btn btn--primary btn--sm" data-action="clear-filters"><span>Clear filters</span></button></div>') + '</section></div>';
    }

    if (R.top.length) {
      out += section('rtop', 'top', ui.sectionHead({ no: '01', title: 'Top picks', sub: 'The strongest overall matches, diversified so they do not all feel the same.' }) +
        ui.featureRec(R.top[0], s, { i: 0, rank: '01' }) + (R.top.length > 1 ? wide(R.top.slice(1)) : ''));
    }
    if (R.because.length) {
      out += section('rbecause', 'because', ui.sectionHead({ no: '02', title: 'Because you liked&hellip;', sub: R.anchor ? 'Books that share the strengths of <strong>' + esc(R.anchor.title) + '</strong>.' : '' }) +
        (R.anchors.length ? anchorChips(R.anchors, R.anchor && R.anchor.id, 'recs') : '') + wide(R.because));
    }
    if (R.gems.length) {
      out += section('rgems', 'gems', ui.sectionHead({ no: '03', title: 'Hidden gems', sub: 'Loved by readers with your taste, and far less talked about.' }) + wide(R.gems));
    }
    if (R.favorites.length) {
      out += section('rfav', 'favorites', ui.sectionHead({ no: '04', title: 'More like your favorites', sub: 'Closest in aspect profile to the books you rated five stars.' }) + wide(R.favorites));
    }
    if (R.comfort.length) {
      out += section('rcomfort', 'comfort', ui.sectionHead({ no: '05', title: 'Outside your comfort zone', sub: 'Heavier, slower or more complex than your usual. We say so up front.' }) + wide(R.comfort));
    }

    out += '<section class="section section--method" data-reveal>' + container(
      '<div class="method"><div class="method__head"><p class="eyebrow">How a match is made</p><h2>Three signals, <em>one personalized ranking.</em></h2>' +
      '<p>The score you see blends all three spaces: 50% interpretable, 25% collaborative, 25% semantic.</p></div>' +
      '<div class="method__cards">' + [
        ['01', 'Collaborative', 'Learns from shared reading patterns between readers.'],
        ['02', 'Semantic', 'Learns meaning from descriptions and reviews.'],
        ['03', 'Interpretable', 'Learns what readers praise or criticize across 12 aspects.']
      ].map(function (c) { return '<div class="method__card"><span class="method__no">' + c[0] + '</span><h3>' + c[1] + '</h3><p>' + c[2] + '</p></div>'; }).join('') + '</div></div>') + '</section>';

    return out + '</div>';
  }

  /* ====================================================================== */
  /* RECENT READS                                                            */
  /* ====================================================================== */
  function recent(ctx) {
    var s = ctx.state;
    var finished = E.recentlyFinished(s, 6);
    if (!finished.length) {
      return '<div class="page page--recent">' + pageHead({ eyebrow: 'Fresh off the shelf', title: 'Because you just finished&hellip;' }) +
        '<section class="section">' + container('<div class="empty"><span class="empty__icon">' + icon('book-open', 28, 1.4) + '</span><h3>Finish a book first</h3><p>When you mark a book as read, its next reads appear here.</p>' +
        '<a class="btn btn--primary btn--sm" href="#/my-books">Open My Books</a></div>') + '</section></div>';
    }
    var wanted = ctx.params && ctx.params.id ? ctx.params.id : s.ui.recentBook;
    var cur = finished.filter(function (x) { return x.book.id === wanted; })[0] || finished[0];
    var b = cur.book;
    var review = s.reviews && s.reviews[b.id];
    var rating = cur.entry.rating || 0;
    var loved = E.analyzeReview(review ? review.text : '', rating).filter(function (a) { return a.sentiment > 0; });
    if (!loved.length) {
      var prof = E.profile(s);
      loved = E.KEYS.filter(function (k) { return b.aspects[k] >= 85 && E.ASPECT[k].kind === 'quality'; })
        .sort(function (a, z) { return prof[z] - prof[a]; }).slice(0, 4).map(function (k) { return { key: k, label: E.ASPECT[k].label, no: E.ASPECT[k].no, sentiment: 1 }; });
    }
    var next = E.nextReads(s, b.id, 5);
    var switcher = finished.length > 1
      ? '<div class="switcher"><span class="switcher__label">Or start from another recent read</span><div class="switcher__list">' + finished.map(function (x) {
        var on = x.book.id === b.id;
        return '<button type="button" class="switcher__item' + (on ? ' is-active' : '') + '" data-action="recent-pick" data-book="' + x.book.id + '" aria-pressed="' + on + '" title="' + esc(x.book.title) + '">' + ui.cover(x.book, { size: 'sm' }) + '<span>' + esc(x.book.title) + '</span></button>';
      }).join('') + '</div></div>'
      : '';

    return '<div class="page page--recent">' + pageHead({ eyebrow: 'Fresh off the shelf', title: 'Because you just finished&hellip;' }) +
      section('finished', 'finished',
        '<div class="finished"><a class="finished__cover" href="' + ui.bookHref(b) + '" aria-label="Open ' + esc(b.title) + '">' + ui.cover(b, { size: 'xl', eager: true }) + '</a>' +
        '<div class="finished__body"><h2 class="finished__title">' + esc(b.title) + '</h2><p class="finished__author">' + esc(b.author) + '</p>' +
        '<p class="finished__meta">' + ui.stars(rating) + '<b>' + rating.toFixed(1) + '</b><i></i><span>Finished ' + U.ago(cur.entry.finishedAt || Date.now()) + '</span></p>' +
        (review ? '<blockquote class="finished__quote">&ldquo;' + esc(review.text) + '&rdquo;</blockquote>' : '<p class="finished__quote finished__quote--empty">You have not reviewed this yet. A few words sharpen the next picks.</p>') +
        '<div class="finished__loved"><span class="label">What LitSense heard you loved</span><ul class="evidence">' +
        (loved.length ? loved.map(function (a) { return ui.tag('pos', a.label); }).join('') : '<li class="tag">Nothing detected yet</li>') + '</ul></div>' +
        '<div class="finished__actions"><button type="button" class="btn btn--ghost btn--sm" data-action="review" data-book="' + b.id + '">' + icon('pen', 15, 2) + '<span>' + (review ? 'Edit review' : 'Add review') + '</span></button>' +
        '<a class="btn btn--ghost btn--sm" href="' + ui.bookHref(b) + '"><span>Book DNA</span>' + icon('arrow-right', 15) + '</a></div></div></div>' + switcher) +
      section('next', 'next', ui.sectionHead({ no: '', title: 'Your next reads', sub: 'Ranked by your taste profile, then by how closely each book echoes ' + esc(b.title) + '.' }) +
        '<div class="cards cards--feature">' + next.slice(0, 3).map(function (r, i) { return ui.featureRec(r, s, { i: i, rank: '0' + (i + 1) }); }).join('') + '</div>' +
        (next.length > 3 ? '<h3 class="subhead">More next reads</h3>' + cardGrid(next.slice(3), s, 'cards--4', { density: 'compact' }) : '')) + '</div>';
  }

  /* ====================================================================== */
  /* CHAT                                                                    */
  /* ====================================================================== */
  function chat(ctx) {
    var c = LS.chat;
    return '<div class="page page--chat">' + container(
      '<header class="chat__head"><p class="eyebrow">Your reading concierge</p><h1 class="page-title">Ask <em>LitSense</em></h1>' +
      '<p class="page-sub">Tell me what you&rsquo;re in the mood to read.</p></header>' +
      '<div class="chat" id="chat"><div class="chat__main"><div class="chat__scroll" id="chatScroll" role="log" aria-live="polite" aria-label="Conversation with LitSense">' + c.messagesHtml(ctx.state) + '</div>' +
      '<div class="chat__dock"><div class="chat__chips" id="chatChips">' + c.chipsHtml() + '</div>' +
      '<form class="composer" id="chatForm" autocomplete="off"><label class="sr-only" for="chatInput">Message LitSense</label>' +
      '<input class="composer__input" id="chatInput" type="text" placeholder="Describe a mood, a book you loved, or a length" maxlength="240" enterkeyhint="send">' +
      '<button class="composer__send" type="submit" aria-label="Send message">' + icon('send', 20) + '</button></form>' +
      '<p class="chat__foot">' + icon('shield', 13) + '<span>Picks come from the recommendation engine. The assistant only explains them, so it cannot invent books.</span></p></div></div>' +
      '<aside class="chat__aside" id="chatAside">' + c.asideHtml(ctx.state) + '</aside></div>', 'container--chat') + '</div>';
  }

  /* ====================================================================== */
  /* BOOK DETAILS                                                            */
  /* ====================================================================== */
  function reviewItem(rv, mine) {
    var user = D.users.filter(function (u) { return u.id === rv.user; })[0] || D.users[0];
    var asp = E.analyzeReview(rv.text, rv.rating).slice(0, 5);
    return '<article class="review' + (mine ? ' review--mine' : '') + '"><header class="review__head">' + ui.avatar(user) +
      '<div><strong class="review__name">' + (mine ? 'You' : esc(user.name)) + '</strong>' + (user.overlap ? '<span class="review__overlap">' + user.overlap + '% taste overlap</span>' : '') + '</div>' +
      ui.stars(rv.rating) + '</header><p class="review__text">&ldquo;' + esc(rv.text) + '&rdquo;</p>' +
      (asp.length ? '<ul class="evidence evidence--sm">' + asp.map(function (a) { return a.sentiment < 0 ? ui.tag('neg', a.label) : ui.tag('pos', a.label); }).join('') + '</ul>' : '') + '</article>';
  }

  function readHeadline(rating, r) {
    var tops = r.why.reasons.slice(0, 2).map(function (x) { return x.label.toLowerCase(); });
    return (rating ? 'You gave this ' + rating.toFixed(1) + ' stars. ' : 'You finished this. ') +
      (tops.length ? 'It lines up with your taste in ' + U.listJoin(tops) + '.' : 'It sits a little outside your usual taste.');
  }

  function book(ctx) {
    var s = ctx.state;
    var b = E.book(ctx.params && ctx.params.id);
    if (!b) {
      return '<div class="page page--book">' + container('<div class="empty"><span class="empty__icon">' + icon('search', 28, 1.4) + '</span><h3>We could not find that book</h3><p>It may have moved. Try searching for it.</p>' +
        '<button type="button" class="btn btn--primary btn--sm" data-action="open-search"><span>Search books</span></button></div>') + '</div>';
    }
    var entry = E.entry(s, b.id);
    var st = entry && entry.status;
    var r = E.rec(b, s, { variant: 0 });
    var prof = E.profile(s);
    var rating = entry && entry.rating ? entry.rating : 0;
    var mineReview = s.reviews && s.reviews[b.id];
    var others = D.reviews.filter(function (x) { return x.bookId === b.id && x.user !== 'u_me'; });
    var myText = mineReview ? { id: 'mine', bookId: b.id, user: 'u_me', rating: mineReview.rating || rating, text: mineReview.text } : null;
    var reviewHtml = (myText ? reviewItem(myText, true) : '') + others.map(function (x) { return reviewItem(x, false); }).join('');
    var neigh = (D.neighbors[b.id] || []).map(E.book).filter(Boolean);
    var similar = D.books.filter(function (x) { return x.id !== b.id; }).sort(function (a, z) { return E.similarity(z, b) - E.similarity(a, b); });
    var related = neigh.concat(similar).filter(function (x, i, arr) { return arr.indexOf(x) === i && x.id !== b.id; }).slice(0, 4);
    var authorBooks = D.books.filter(function (x) { return x.author === b.author && x.id !== b.id; });
    var loved = st === 'read';
    var reasons = r.why.reasons.map(function (x) {
      return '<li class="plus"><span class="plus__icon">' + icon('plus', 14, 2.4) + '</span><span class="plus__text">' + esc(x.text) + '</span><b>' + ui.sign(x.delta) + '</b></li>';
    }).join('');
    var mism = r.why.mismatches.map(function (x) {
      return '<li class="minus"><span class="minus__icon">' + icon('minus', 14, 2.4) + '</span><span class="minus__text">' + esc(x.text) + '</span><b>' + ui.sign(x.delta) + '</b></li>';
    }).join('');
    var dna = E.KEYS.map(function (k) { return ui.aspectRow(E.ASPECT[k], b.aspects[k], prof[k]); }).join('');
    var genreHref = '#/recommendations';

    return '<div class="page page--book"><article class="detail">' + container(
      '<nav class="crumbs" aria-label="Breadcrumb"><a href="#/discover">Discover</a>' + icon('chevron-right', 14) + '<a href="' + genreHref + '">' + esc(b.genres[0]) + '</a>' + icon('chevron-right', 14) + '<span>' + esc(b.title) + '</span></nav>' +
      '<div class="detail__grid"><aside class="detail__side"><div class="detail__cover">' + ui.cover(b, { size: 'xl', eager: true }) + '</div>' +
      '<div class="detail__shelf">' + ui.shelfControl(b, s) + (st === 'reading' ? ui.progress(entry.progress || 0) : '') + '</div>' +
      '<div class="detail__rate"><span class="label">Your rating</span>' + ui.rateWidget(b.id, rating) +
      '<button type="button" class="btn btn--ghost btn--sm" data-action="review" data-book="' + b.id + '">' + icon('pen', 15, 2) + '<span>' + (mineReview ? 'Edit your review' : 'Write a review') + '</span></button></div></aside>' +
      '<div class="detail__main"><p class="eyebrow">' + esc(b.genres.join(' · ')) + '</p><h1 class="detail__title">' + esc(b.title) + '</h1>' +
      '<p class="detail__author">by <button type="button" class="link-underline" data-action="search" data-query="' + esc(b.author) + '">' + esc(b.author) + '</button></p>' +
      '<p class="detail__rating">' + ui.stars(b.rating, 'stars--lg') + '<b>' + b.rating.toFixed(1) + '</b><span>' + U.fmtK(b.ratingsK) + ' ratings</span></p>' +
      '<dl class="facts"><div><dt>Genre</dt><dd>' + esc(b.genres[0]) + '</dd></div><div><dt>Pages</dt><dd>' + b.pages + '</dd></div><div><dt>Published</dt><dd>' + b.year + '</dd></div><div><dt>Rating</dt><dd>' + b.rating.toFixed(1) + ' / 5</dd></div></dl>' +
      '<p class="detail__desc">' + esc(b.desc) + '</p>' +
      '<section class="why-panel" data-reveal><div class="why-panel__head"><div><p class="eyebrow">' + (loved ? 'You read this' : 'Your match') + '</p><h2>' + (loved ? 'Why you loved it' : 'Why LitSense thinks you&rsquo;ll love it') + '</h2></div>' +
      ui.match(r.m.score, { cls: 'match--xl' }) + '</div><p class="why-panel__headline">' + esc(loved ? readHeadline(rating, r) : r.why.headline) + '</p>' +
      '<div class="why-panel__cols"><div><span class="label">Why it matches</span><ul class="plus-list">' + (reasons || '<li class="plus">A broad pick, chosen to widen your reading.</li>') + '</ul>' +
      (mism ? '<span class="label label--neg">Potential mismatch</span><ul class="minus-list">' + mism + '</ul>' : '') + '</div>' +
      '<div><span class="label">How LitSense decided</span>' + ui.signalMix(r.m) + '</div></div>' +
      '<p class="spoiler-note">' + icon('shield', 14) + '<span>Spoiler-safe. Built only from aspect scores and reader reviews, never from plot details.</span></p></section>' +
      '<section class="dna" data-reveal><div class="dna__head"><div><p class="eyebrow">Book DNA</p><h2>The 12 literary aspects</h2></div>' +
      '<ul class="legend"><li><i class="legend__book"></i>This book</li><li><i class="legend__pref"></i>Your preference</li></ul></div>' +
      '<div class="dna__grid">' + dna + '</div></section>' +
      '<section class="reviews" data-reveal><div class="dna__head"><div><p class="eyebrow">Readers say</p><h2>What reviews reveal</h2></div></div><div class="reviews__list">' +
      (reviewHtml || '<p class="muted">No reviews yet. Be the first to write one.</p>') + '</div></section>' +
      (authorBooks.length ? '<section class="related" data-reveal><h2>More by ' + esc(b.author) + '</h2><div class="strip strip--tight">' + authorBooks.map(function (x, i) { return ui.miniCard(x, s, { i: i }); }).join('') + '</div></section>' : '') +
      '<section class="related" data-reveal><h2>Readers like you also read</h2><div class="strip strip--tight">' + related.map(function (x, i) { return ui.miniCard(x, s, { i: i, note: E.match(x, s).score + '% match' }); }).join('') + '</div></section>' +
      '</div></div>') + '</article></div>';
  }

  /* ====================================================================== */
  /* PROFILE                                                                 */
  /* ====================================================================== */
  function profile(ctx) {
    var s = ctx.state;
    var st = E.stats(s);
    var prof = E.profile(s);
    var rp = D.readerProfile;
    var me = D.users[0];
    var order = E.KEYS.slice().sort(function (a, z) { return prof[z] - prof[a]; });
    var bars = order.map(function (k) { return ui.aspectRow(E.ASPECT[k], prof[k], null, { cls: 'aspect--profile' }); }).join('');
    var myReviews = Object.keys(s.reviews || {}).map(function (id) { return { book: E.book(id), rv: s.reviews[id] }; }).filter(function (x) { return x.book; })
      .sort(function (a, z) { return (z.rv.createdAt || 0) - (a.rv.createdAt || 0); }).slice(0, 4);
    var genres = st.genres.slice(0, 5).map(function (g) {
      return '<li><span class="gname">' + esc(g.genre) + '</span>' + ui.bar(g.bar) + '<span class="gpct">' + U.plural(g.books, 'book') + '</span></li>';
    }).join('');

    return '<div class="page page--profile">' + pageHead({
      cls: 'profile-head', eyebrow: 'Reader profile', title: 'Your Reader <em>DNA</em>', sub: esc(rp.summary),
      extra: '<div class="profile-card">' + ui.avatar(me, { cls: 'avatar--xl' }) + '<div><strong class="profile-card__name">' + esc(me.name) + '</strong><span class="profile-card__handle">' + esc(me.handle) + '</span>' +
        '<span class="profile-card__arch">' + icon('sparkle', 15, 1.8) + esc(rp.archetype) + '</span><span class="profile-card__since">Reading since ' + esc(me.joined) + '</span></div></div>' +
        '<dl class="stats">' + stat('Books read', st.read) + stat('Currently reading', st.reading) + stat('Want to read', st.want) + stat('Favorite genre', esc(st.favoriteGenre)) + '</dl>'
    }) +
      section('dna', 'dna', ui.sectionHead({ no: '01', title: 'What you value in a book', sub: 'Learned from ' + rp.signals.ratings + ' ratings and ' + rp.signals.reviews + ' reviews. Rate or review more and this updates.' }) +
        '<div class="dna-panel"><div class="dna-panel__bars"><div class="aspects">' + bars + '</div></div><div class="dna-panel__radar">' +
        ui.radar(prof, { label: 'Your Reader DNA across 12 literary aspects' }) +
        '<p class="dna-panel__caption">Pacing, complexity and tone show the level you prefer, not how much you like them.</p></div></div>') +
      section('tend', 'tend', '<div class="tend"><div class="tend__col tend__col--love"><h2>You tend to love&hellip;</h2><ul>' +
        rp.loves.map(function (x) { return '<li><span class="tend__icon">' + icon('plus', 16, 2.2) + '</span>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="tend__col tend__col--avoid"><h2>You tend to avoid&hellip;</h2><ul>' +
        rp.avoids.map(function (x) { return '<li><span class="tend__icon">' + icon('minus', 16, 2.2) + '</span>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>') +
      section('how', 'how', ui.sectionHead({ no: '02', title: 'Same rating, <em>different reason.</em>', sub: 'Two five-star ratings can mean two different tastes. LitSense reads the reason, not just the number.' }) +
        '<div class="twins"><article class="twin"><span class="twin__who">Reader A</span>' + ui.stars(5) + '<p>Loves scientific problem solving and puzzles.</p></article>' +
        '<span class="twins__neq" aria-label="is not the same as">&ne;</span>' +
        '<article class="twin"><span class="twin__who">Reader B</span>' + ui.stars(5) + '<p>Loves friendship and emotional connection.</p></article></div>' +
        '<div class="method__cards">' + [
          ['01', 'Collaborative', 'Learns from shared reading patterns between readers like you.'],
          ['02', 'Semantic', 'Learns meaning from book descriptions and reviews.'],
          ['03', 'Interpretable', 'Learns what readers praise or criticize across 12 aspects.']
        ].map(function (c) { return '<div class="method__card"><span class="method__no">' + c[0] + '</span><h3>' + c[1] + '</h3><p>' + c[2] + '</p></div>'; }).join('') + '</div>') +
      section('genres', 'genres', ui.sectionHead({ no: '03', title: 'Your genres', sub: 'Weighted by the rating you gave each finished book.' }) + '<ul class="genre-list genre-list--wide">' + (genres || '<li>Finish a book to see your genres.</li>') + '</ul>') +
      (myReviews.length ? section('reviews', 'myreviews', ui.sectionHead({ no: '04', title: 'What LitSense heard in your reviews' }) +
        '<div class="reviews__list reviews__list--grid">' + myReviews.map(function (x) {
          return '<div class="review-row"><a class="review-row__cover" href="' + ui.bookHref(x.book) + '">' + ui.cover(x.book, { size: 'sm' }) + '</a>' +
            reviewItem({ id: 'm', bookId: x.book.id, user: 'u_me', rating: x.rv.rating || (s.shelf[x.book.id] && s.shelf[x.book.id].rating) || 0, text: x.rv.text }, true) + '</div>';
        }).join('') + '</div>') : '') + '</div>';
  }

  /* ====================================================================== */
  /* Header and footer bits rendered by app.js                               */
  /* ====================================================================== */
  function notFound() {
    return '<div class="page">' + container('<div class="empty"><span class="empty__icon">' + icon('compass', 28, 1.4) + '</span><h3>That page is not in the library</h3><p>Head back to Discover.</p>' +
      '<a class="btn btn--primary btn--sm" href="#/discover">Go to Discover</a></div>') + '</div>';
  }

  LS.views = {
    COPY: COPY, CHAT_STARTERS: CHAT_STARTERS,
    discover: discover, 'my-books': myBooks, recommendations: recommendations, recent: recent,
    chat: chat, book: book, profile: profile, notFound: notFound
  };
})(window);
