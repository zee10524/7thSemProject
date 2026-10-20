/* ==========================================================================
   LitSense prototype - APP (state, rendering, interactions)
   --------------------------------------------------------------------------
   STATE        LS.store     one plain object, persisted to localStorage
   RENDER       renderView() builds a view string and swaps #view
   INTERACTIONS one delegated click handler routes data-action="name" to actions{}
   Migration: state -> Redux/Zustand + API calls, actions -> thunks or handlers.
   ========================================================================== */
(function (global) {
  'use strict';

  var LS = global.LitSense;
  var D = LS.data;
  var U = LS.util;
  var E = LS.engine;
  var ui = LS.ui;
  var V = LS.views;
  var O = LS.overlays;
  var N = LS.nav;
  var doc = global.document;
  var KEY = D.config.storageKey;
  var THEME_COLORS = { 1: '#231c17', 2: '#f5eee2', 3: '#eef0ee' };

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  /* ====================================================================== */
  /* STATE                                                                   */
  /* ====================================================================== */
  var state;

  function defaultUi() {
    return {
      booksTab: 'reading', booksView: 'grid',
      recFilters: { genre: 'all', mood: 'any', length: 'any', sort: 'match' },
      homeAnchor: 'the-seven-husbands-of-evelyn-hugo', recAnchor: 'project-hail-mary', recentBook: null
    };
  }

  function seed() {
    var now = Date.now();
    var shelf = {};
    Object.keys(D.seedShelf).forEach(function (id) {
      var s = D.seedShelf[id];
      var e = { status: s.status, progress: s.progress || (s.status === 'read' ? 100 : 0), rating: s.rating || 0 };
      if (s.startedDaysAgo != null) { e.startedAt = now - s.startedDaysAgo * U.DAY; }
      if (s.finishedDaysAgo != null) { e.finishedAt = now - s.finishedDaysAgo * U.DAY; }
      if (s.addedDaysAgo != null) { e.addedAt = now - s.addedDaysAgo * U.DAY; }
      shelf[id] = e;
    });
    var reviews = {};
    D.reviews.filter(function (r) { return r.user === 'u_me'; }).forEach(function (r) {
      reviews[r.bookId] = { text: r.text, rating: r.rating, createdAt: now - r.daysAgo * U.DAY };
    });
    var activity = D.seedActivity.map(function (a) { return { type: a.type, bookId: a.bookId, text: a.text, at: now - a.daysAgo * U.DAY }; });
    return { v: 1, demo: 1, shelf: shelf, userRatings: {}, reviews: reviews, activity: activity, ui: defaultUi() };
  }

  function load() {
    var base = seed();
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.v === 1 && saved.shelf) {
          saved.ui = Object.assign(defaultUi(), saved.ui || {});
          saved.ui.recFilters = Object.assign(defaultUi().recFilters, saved.ui.recFilters || {});
          return Object.assign(base, saved);
        }
      }
    } catch (e) { /* storage blocked: run in memory */ }
    return base;
  }

  function save() {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function mutate(fn, o) {
    fn(state);
    save();
    if (!o || !o.silent) { refresh(); }
  }

  function pushActivity(type, bookId, text) {
    state.activity.unshift({ type: type, bookId: bookId, text: text, at: Date.now() });
    state.activity = state.activity.slice(0, 12);
  }

  LS.store = { get: function () { return state; }, mutate: mutate, KEY: KEY };

  /* ====================================================================== */
  /* DOMAIN ACTIONS                                                          */
  /* ====================================================================== */
  function clone(x) { return x ? JSON.parse(JSON.stringify(x)) : x; }

  function setStatus(id, status, o) {
    o = o || {};
    var b = E.book(id);
    if (!b) { return; }
    var prev = clone(state.shelf[id]);
    var now = Date.now();
    mutate(function (s) {
      if (status === 'none') { delete s.shelf[id]; return; }
      var e = s.shelf[id] || { status: status, progress: 0, rating: 0 };
      var was = e.status;
      e.status = status;
      if (status === 'want') { e.addedAt = e.addedAt || now; e.progress = 0; }
      if (status === 'reading') { e.startedAt = now; if (was !== 'reading') { e.progress = 0; } }
      if (status === 'read') { e.progress = 100; e.finishedAt = now; e.startedAt = e.startedAt || now; }
      s.shelf[id] = e;
      if (status === 'want' && was !== 'want') { pushActivity('want', id, 'Added ' + b.title + ' to Want to Read'); }
      if (status === 'reading' && was !== 'reading') { pushActivity('started', id, 'Started ' + b.title); }
      if (status === 'read' && was !== 'read') { pushActivity('finished', id, 'Finished ' + b.title); }
    });
    if (o.quiet) { return; }
    var msg = { want: 'Added to your reading list', reading: 'Started ' + b.title, read: 'Marked as read', none: 'Removed from your books' }[status];
    var action = { label: 'Undo', run: function () { restoreEntry(id, prev); } };
    if (status === 'read' && !(prev && prev.rating)) {
      action = { label: 'Rate it', run: function () { O.reviewModal(id); } };
      msg = 'Marked as read. Rate it to sharpen your picks';
    }
    O.toast(msg, { action: action, icon: status === 'none' ? 'trash' : 'check' });
  }

  function restoreEntry(id, prev) {
    mutate(function (s) { if (prev) { s.shelf[id] = prev; } else { delete s.shelf[id]; } });
  }

  function advance(id) {
    var e = state.shelf[id];
    var b = E.book(id);
    if (!e || e.status !== 'reading' || !b) { return; }
    var step = 5 + (U.hash(id + Math.round(e.progress || 0)) % 8);
    var next = Math.min(100, Math.round((e.progress || 0) + step));
    if (next >= 100) {
      mutate(function (s) {
        var en = s.shelf[id]; en.status = 'read'; en.progress = 100; en.finishedAt = Date.now();
        pushActivity('finished', id, 'Finished ' + b.title);
      });
      O.toast('Finished ' + b.title + '. Rate it to sharpen your picks', { action: { label: 'Rate it', run: function () { O.reviewModal(id); } }, icon: 'check' });
      return;
    }
    mutate(function (s) { s.shelf[id].progress = next; });
    O.toast('Progress updated to ' + next + '%', { icon: 'book-open' });
  }

  function applyRating(s, id, rating) {
    var now = Date.now();
    var e = s.shelf[id] || { status: 'read', progress: 100, rating: 0 };
    if (e.status !== 'read') { e.status = 'read'; e.progress = 100; e.finishedAt = now; e.startedAt = e.startedAt || now; }
    e.rating = rating;
    s.shelf[id] = e;
    if (rating > 0) { s.userRatings[id] = rating; } else { delete s.userRatings[id]; }
  }

  function setRating(id, rating) {
    var b = E.book(id);
    if (!b) { return; }
    var before = E.profile(state);
    var wasRead = state.shelf[id] && state.shelf[id].status === 'read';
    mutate(function (s) { applyRating(s, id, rating); pushActivity('rated', id, 'Rated ' + b.title + ' ' + rating.toFixed(1)); });
    var shift = E.profileShift(before, E.profile(state));
    var msg = 'Rated ' + b.title + ' ' + rating.toFixed(1) + (wasRead ? '' : ' and added to Read');
    if (shift) {
      mutate(function (s) { pushActivity('dna', id, 'LitSense refreshed your Reader DNA: ' + shift.label + ' ' + (shift.delta > 0 ? '+' : '') + shift.delta); }, { silent: true });
      msg += '. Reader DNA: ' + shift.label + ' ' + (shift.delta > 0 ? '+' : '') + shift.delta;
    }
    O.toast(msg, { icon: 'star' });
  }

  function saveReview(id, p) {
    var b = E.book(id);
    if (!b) { return; }
    var found = E.analyzeReview(p.text, p.rating);
    mutate(function (s) {
      if (p.markRead) {
        applyRating(s, id, p.rating || 0);
      } else if (s.shelf[id] && p.rating > 0) {
        s.shelf[id].rating = p.rating;
        s.userRatings[id] = p.rating;
      }
      if (p.text) { s.reviews[id] = { text: p.text, rating: p.rating, createdAt: Date.now() }; }
      pushActivity('review', id, 'Reviewed ' + b.title);
    });
    var heard = found.slice(0, 3).map(function (a) { return a.label; });
    O.toast(heard.length ? 'Review saved. LitSense heard: ' + heard.join(', ') : 'Review saved', { icon: 'pen' });
  }

  function reset() {
    try { global.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    var demo = state.demo;
    state = seed();
    state.demo = demo;
    save();
    LS.chat.reset();
    O.closeMenu();
    renderView(N.current, { quiet: true });
    O.toast('Demo data reset', { icon: 'refresh' });
  }

  /* ====================================================================== */
  /* RENDER                                                                  */
  /* ====================================================================== */
  var main;
  var io = null;
  var pendingAsk = null;

  function revealAll(root) {
    $$('[data-reveal]', root).forEach(function (el) { el.classList.add('is-in'); });
  }

  function observe(root, instant) {
    if (io) { io.disconnect(); io = null; }
    var targets = $$('[data-reveal]', root);
    if (instant || !('IntersectionObserver' in global) || U.reducedMotion()) { revealAll(root); return; }
    io = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    targets.forEach(function (t) { io.observe(t); });
    // Safety net: never leave content hidden if the observer is slow.
    setTimeout(function () { revealAll(root); }, 2600);
  }

  function settleImages(root) {
    $$('img.cover__img', root).forEach(function (img) {
      if (img.complete) {
        if (img.naturalWidth > 0) { img.classList.add('is-loaded'); if (img.parentNode) { img.parentNode.classList.add('has-img'); } } else { img.remove(); }
      }
    });
  }

  function pageTitle(route) {
    if (route.name === 'book') {
      var b = E.book(route.params.id);
      return (b ? b.title : 'Book');
    }
    return route.title;
  }

  function renderView(route, o) {
    o = o || {};
    var fn = V[route.name] || V.notFound;
    var html = fn({ state: state, demo: state.demo, params: route.params, route: route });
    main.classList.toggle('no-anim', !!o.quiet);
    main.innerHTML = html;
    doc.body.setAttribute('data-page', route.name);
    doc.title = pageTitle(route) + ' | LitSense';
    if (!o.quiet) {
      main.classList.remove('view--enter');
      void main.offsetWidth;
      main.classList.add('view--enter');
      global.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    observe(main, !!o.quiet);
    settleImages(main);
    if (route.name === 'chat') {
      LS.chat.scrollDown(false);
      var chatInput = $('#chatInput');
      if (!o.quiet && chatInput && !(global.matchMedia && global.matchMedia('(pointer: coarse)').matches)) { chatInput.focus({ preventScroll: true }); }
      // index.html?chatdemo=1#/chat plays the example conversation on load (handy for screenshots and talks).
      if (!o.quiet && /[?&]chatdemo=1/.test(global.location.search) && !LS.chat.state().messages.some(function (m) { return m.role === 'user'; })) {
        setTimeout(function () { LS.chat.playDemo(); }, 400);
      }
      if (pendingAsk) {
        var p = pendingAsk;
        pendingAsk = null;
        setTimeout(function () { LS.chat.send(p); }, 650);
      }
    }
    if (!o.quiet && main.focus) { main.focus({ preventScroll: true }); }
  }

  /** A CSS selector that finds "the same control" again after the view is re-rendered. */
  function focusKey(el) {
    if (!el || !el.getAttribute || !el.closest('#view')) { return ''; }
    var action = el.getAttribute('data-action');
    if (!action) { return ''; }
    var sel = '[data-action="' + action + '"]';
    ['data-book', 'data-status', 'data-tab', 'data-mode', 'data-key', 'data-value', 'data-scope', 'data-rating'].forEach(function (a) {
      var v = el.getAttribute(a);
      if (v != null) { sel += '[' + a + '="' + v.replace(/"/g, '\\"') + '"]'; }
    });
    return sel;
  }

  function refresh() {
    var y = global.scrollY;
    var input = $('#chatInput');
    var draft = input ? input.value : '';
    var hadFocus = input && doc.activeElement === input;
    var key = hadFocus ? '' : focusKey(doc.activeElement);
    renderView(N.current, { quiet: true });
    global.scrollTo({ top: y, left: 0, behavior: 'instant' });
    var again = $('#chatInput');
    if (again) { again.value = draft; if (hadFocus) { again.focus(); } }
    if (key) {
      var next = null;
      try { next = $(key, main); } catch (e) { next = null; }
      if (next) { next.focus({ preventScroll: true }); }
    }
  }

  /* ====================================================================== */
  /* CHROME (header, bottom bar, demo switcher)                              */
  /* ====================================================================== */
  function buildChrome() {
    var links = $('#navLinks');
    links.innerHTML = N.LINKS.map(function (l) {
      return '<li><a class="nav__link" href="' + l.href + '" data-nav="' + l.id + '"><span>' + l.label + '</span></a></li>';
    }).join('');
    var tabs = $('#bottomNav');
    tabs.innerHTML = N.TABS.map(function (t) {
      return '<a class="tabbar__item" href="' + t.href + '" data-nav="' + t.id + '">' + ui.icon(t.icon, 22, 1.7) + '<span>' + t.label + '</span></a>';
    }).join('');
    var date = $('#mastDate');
    if (date) { date.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    $$('[data-icon]').forEach(function (n) { n.innerHTML = ui.icon(n.getAttribute('data-icon'), Number(n.getAttribute('data-size')) || 20, 1.7); });
  }

  function applyDemoAttrs() {
    doc.documentElement.setAttribute('data-demo', String(state.demo));
    $$('[data-action="switch-demo"]').forEach(function (b) {
      var on = Number(b.getAttribute('data-demo')) === state.demo;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
    var meta = $('meta[name="theme-color"]');
    if (meta) { meta.setAttribute('content', THEME_COLORS[state.demo]); }
  }

  function setDemo(n) {
    n = Number(n);
    if ([1, 2, 3].indexOf(n) < 0 || n === state.demo) { return; }
    O.closeMenu();
    var root = doc.documentElement;
    var apply = function () {
      state.demo = n;
      save();
      applyDemoAttrs();
      renderView(N.current, { quiet: true });
      root.classList.remove('is-switching');
    };
    // A short fade out, swap the skin, fade back in. Timer based, so it never stalls.
    if (U.reducedMotion()) { apply(); return; }
    root.classList.add('is-switching');
    setTimeout(apply, 170);
  }

  /* ====================================================================== */
  /* INTERACTIONS                                                            */
  /* ====================================================================== */
  function openStatusMenu(anchor) {
    var id = anchor.getAttribute('data-book');
    var b = E.book(id);
    var cur = state.shelf[id] && state.shelf[id].status;
    var items = [
      { label: 'Want to Read', icon: 'bookmark', active: cur === 'want', run: function () { setStatus(id, 'want'); } },
      { label: 'Currently Reading', icon: 'book-open', active: cur === 'reading', run: function () { setStatus(id, 'reading'); } },
      { label: 'Read', icon: 'check', active: cur === 'read', run: function () { setStatus(id, 'read'); } }
    ];
    if (cur) { items.push({ sep: true }); items.push({ label: 'Remove from my books', icon: 'trash', danger: true, run: function () { setStatus(id, 'none'); } }); }
    O.menu(anchor, items, { title: b ? b.title : '' });
  }

  var actions = {
    'switch-demo': function (el) { setDemo(el.getAttribute('data-demo')); },
    'reset-demo': function () { reset(); },
    'open-search': function () { O.openSearch(''); },
    'close-search': function () { O.closeSearch(); },
    'search': function (el) { O.openSearch(el.getAttribute('data-query')); },
    'search-suggest': function (el) {
      var input = $('#searchInput');
      input.value = el.getAttribute('data-query');
      input.dispatchEvent(new global.Event('input'));
      input.focus();
    },
    status: function (el) { setStatus(el.getAttribute('data-book'), el.getAttribute('data-status')); },
    'status-menu': function (el) { openStatusMenu(el); },
    progress: function (el) { advance(el.getAttribute('data-book')); },
    rate: function (el) { setRating(el.getAttribute('data-book'), Number(el.getAttribute('data-rating'))); },
    review: function (el) { O.reviewModal(el.getAttribute('data-book')); },
    'modal-rate': function (el) { O.modalRate(Number(el.getAttribute('data-rating'))); },
    'modal-sample': function () { O.modalSample(); },
    'modal-save': function () { O.modalSave(); },
    'close-modal': function () { O.closeModal(); },
    tab: function (el) { mutate(function (s) { s.ui.booksTab = el.getAttribute('data-tab'); }); },
    'view-mode': function (el) { mutate(function (s) { s.ui.booksView = el.getAttribute('data-mode'); }); },
    filter: function (el) { mutate(function (s) { s.ui.recFilters[el.getAttribute('data-key')] = el.getAttribute('data-value'); }); },
    'clear-filters': function () { mutate(function (s) { s.ui.recFilters = Object.assign(s.ui.recFilters, { genre: 'all', mood: 'any', length: 'any' }); }); },
    anchor: function (el) {
      var scope = el.getAttribute('data-scope');
      mutate(function (s) { if (scope === 'home') { s.ui.homeAnchor = el.getAttribute('data-value'); } else { s.ui.recAnchor = el.getAttribute('data-value'); } });
    },
    'recent-pick': function (el) { mutate(function (s) { s.ui.recentBook = el.getAttribute('data-book'); }); },
    scroll: function (el) {
      var t = doc.getElementById(el.getAttribute('data-target'));
      if (t) { t.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'start' }); }
    },
    ask: function (el) { pendingAsk = el.getAttribute('data-prompt'); N.go('/chat'); },
    'chat-chip': function (el) {
      var text = el.getAttribute('data-text');
      if (N.current.name !== 'chat') { pendingAsk = text; N.go('/chat'); } else { LS.chat.send(text); }
    },
    'brief-drop': function (el) { LS.chat.dropTag(el.getAttribute('data-key')); },
    'chat-demo': function () { LS.chat.playDemo(); }
  };

  function bind() {
    doc.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action]');
      if (!t) { return; }
      var fn = actions[t.getAttribute('data-action')];
      if (fn) { fn(t, e); }
    });

    doc.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-action') === 'sort') {
        mutate(function (s) { s.ui.recFilters.sort = t.value; });
      }
    });

    doc.addEventListener('submit', function (e) {
      if (e.target && e.target.id === 'chatForm') {
        e.preventDefault();
        var input = $('#chatInput');
        if (input && input.value.trim()) { LS.chat.send(input.value); }
      }
    });

    // Star rating hover preview (works for page widgets and the review dialog).
    doc.addEventListener('mouseover', function (e) {
      var hit = e.target.closest && e.target.closest('.rate__hit');
      if (!hit) { return; }
      var rate = hit.closest('.rate');
      rate.style.setProperty('--r', hit.getAttribute('data-rating'));
      var label = $('.rate__label', rate);
      if (label) { label.textContent = Number(hit.getAttribute('data-rating')).toFixed(1); }
    });
    doc.addEventListener('mouseout', function (e) {
      var rate = e.target.closest && e.target.closest('.rate');
      if (!rate || (e.relatedTarget && rate.contains(e.relatedTarget))) { return; }
      var v = Number(rate.getAttribute('data-value')) || 0;
      rate.style.setProperty('--r', v);
      var label = $('.rate__label', rate);
      if (label) { label.textContent = v ? v.toFixed(1) : 'Rate this book'; }
    });

    // Cover images: fade in when loaded, drop silently when they fail.
    doc.addEventListener('load', function (e) {
      var t = e.target;
      if (t && t.tagName === 'IMG' && t.classList.contains('cover__img')) {
        t.classList.add('is-loaded');
        if (t.parentNode) { t.parentNode.classList.add('has-img'); }
      }
    }, true);
    doc.addEventListener('error', function (e) {
      var t = e.target;
      if (t && t.tagName === 'IMG' && t.classList.contains('cover__img') && t.parentNode) { t.parentNode.removeChild(t); }
    }, true);

    // Header gets a hairline once the page scrolls.
    var header = $('#siteHeader');
    var onScroll = function () { header.classList.toggle('is-scrolled', global.scrollY > 8); };
    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ====================================================================== */
  /* BOOT                                                                    */
  /* ====================================================================== */
  function init() {
    state = load();
    var fromUrl = /[?&]demo=([123])\b/.exec(global.location.search);
    if (fromUrl) { state.demo = Number(fromUrl[1]); }
    main = $('#view');
    buildChrome();
    applyDemoAttrs();
    O.init();
    bind();
    N.onChange(function (route) {
      O.closeMenu();
      if (O.searchOpen) { O.closeSearch(); }
      renderView(route);
      N.syncActive(route);
    });
    N.start();
  }

  LS.app = {
    init: init, refresh: refresh, renderView: renderView, setDemo: setDemo, setStatus: setStatus, setRating: setRating,
    saveReview: saveReview, advance: advance, reset: reset
  };

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { init(); }
})(window);
