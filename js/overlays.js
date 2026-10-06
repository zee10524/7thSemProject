/* ==========================================================================
   LitSense prototype - OVERLAYS
   --------------------------------------------------------------------------
   Everything that floats above the page: toasts, popover menus, modals,
   the search overlay and the review dialog. No business logic lives here;
   results are handed back to app.js through LS.app.
   ========================================================================== */
(function (global) {
  'use strict';

  var LS = global.LitSense;
  var U = LS.util;
  var E = LS.engine;
  var ui = LS.ui;
  var doc = global.document;
  var esc = U.esc;

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function isNarrow() { return global.matchMedia && global.matchMedia('(max-width: 640px)').matches; }

  /* ------------------------------------------------------------------ */
  /* Toasts                                                              */
  /* ------------------------------------------------------------------ */
  function toast(message, o) {
    o = o || {};
    var root = $('#toasts');
    if (!root) { return; }
    var el = doc.createElement('div');
    el.className = 'toast' + (o.kind ? ' toast--' + o.kind : '');
    el.setAttribute('role', 'status');
    el.innerHTML = '<span class="toast__icon">' + ui.icon(o.icon || 'check', 18, 2.2) + '</span><span class="toast__text">' + esc(message) + '</span>' +
      (o.action ? '<button type="button" class="toast__action">' + esc(o.action.label) + '</button>' : '');
    root.appendChild(el);
    while (root.children.length > 3) { root.removeChild(root.firstChild); }
    void el.offsetWidth; // flush styles so the transition runs even when frames are throttled
    el.classList.add('is-in');

    var timer;
    function close() {
      clearTimeout(timer);
      el.classList.remove('is-in');
      el.classList.add('is-out');
      setTimeout(function () { if (el.parentNode) { el.parentNode.removeChild(el); } }, 360);
    }
    timer = setTimeout(close, o.duration || 3400);
    if (o.action) {
      $('.toast__action', el).addEventListener('click', function () { o.action.run(); close(); });
    }
    return close;
  }

  /* ------------------------------------------------------------------ */
  /* Popover menu (bottom sheet on phones)                                */
  /* ------------------------------------------------------------------ */
  var menuState = { el: null, backdrop: null, anchor: null };

  function closeMenu() {
    if (menuState.el && menuState.el.parentNode) { menuState.el.parentNode.removeChild(menuState.el); }
    if (menuState.backdrop && menuState.backdrop.parentNode) { menuState.backdrop.parentNode.removeChild(menuState.backdrop); }
    if (menuState.anchor) { menuState.anchor.setAttribute('aria-expanded', 'false'); }
    menuState = { el: null, backdrop: null, anchor: null };
  }

  function openMenu(anchor, items, o) {
    closeMenu();
    o = o || {};
    var el = doc.createElement('div');
    el.className = 'menu';
    el.setAttribute('role', 'menu');
    el.innerHTML = (o.title ? '<p class="menu__title">' + esc(o.title) + '</p>' : '') + items.map(function (it, i) {
      if (it.sep) { return '<hr class="menu__sep">'; }
      return '<button type="button" role="menuitem" class="menu__item' + (it.active ? ' is-active' : '') + (it.danger ? ' is-danger' : '') + '" data-i="' + i + '">' +
        (it.icon ? ui.icon(it.icon, 17, 1.9) : '') + '<span>' + esc(it.label) + '</span>' + (it.active ? ui.icon('check', 16, 2.2) : '') + '</button>';
    }).join('');

    var sheet = isNarrow();
    var backdrop = null;
    if (sheet) {
      el.classList.add('menu--sheet');
      backdrop = doc.createElement('div');
      backdrop.className = 'menu-backdrop';
      backdrop.addEventListener('click', closeMenu);
      doc.body.appendChild(backdrop);
    }
    doc.body.appendChild(el);

    if (!sheet) {
      var r = anchor.getBoundingClientRect();
      var w = el.offsetWidth;
      var h = el.offsetHeight;
      var left = Math.min(Math.max(8, r.left), global.innerWidth - w - 8);
      var top = r.bottom + 8;
      if (top + h > global.innerHeight - 8) { top = Math.max(8, r.top - h - 8); }
      el.style.left = left + 'px';
      el.style.top = top + 'px';
    }
    anchor.setAttribute('aria-expanded', 'true');
    menuState = { el: el, backdrop: backdrop, anchor: anchor, scrollY: global.scrollY };

    el.addEventListener('click', function (e) {
      var btn = e.target.closest('.menu__item');
      if (!btn) { return; }
      var it = items[Number(btn.getAttribute('data-i'))];
      closeMenu();
      if (it && it.run) { it.run(); }
    });
    void el.offsetWidth;
    el.classList.add('is-in');
    var first = $('.menu__item', el);
    if (first) { first.focus({ preventScroll: true }); }
  }

  /* ------------------------------------------------------------------ */
  /* Modal                                                               */
  /* ------------------------------------------------------------------ */
  var modalState = { open: false, lastFocus: null, onClose: null, data: null };

  function openModal(o) {
    closeModal(true);
    var root = $('#modal');
    modalState.lastFocus = doc.activeElement;
    modalState.onClose = o.onClose || null;
    modalState.data = o.data || null;
    root.hidden = false;
    root.innerHTML = '<div class="modal__backdrop" data-action="close-modal"></div>' +
      '<div class="modal__panel ' + (o.cls || '') + '" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' +
      '<button type="button" class="modal__close" data-action="close-modal" aria-label="Close dialog">' + ui.icon('x', 20) + '</button>' + o.html + '</div>';
    doc.body.classList.add('is-locked');
    modalState.open = true;
    void root.offsetWidth;
    root.classList.add('is-open');
    var focusEl = $(o.focus || 'textarea, input, button:not(.modal__close)', root);
    if (focusEl) { focusEl.focus({ preventScroll: true }); }
    if (o.onMount) { o.onMount(root); }
  }

  function closeModal(silent) {
    var root = $('#modal');
    if (!root || !modalState.open) { return; }
    modalState.open = false;
    root.classList.remove('is-open');
    var cb = modalState.onClose;
    var last = modalState.lastFocus;
    setTimeout(function () { if (!modalState.open) { root.hidden = true; root.innerHTML = ''; } }, 220);
    if (!doc.querySelector('#search.is-open')) { doc.body.classList.remove('is-locked'); }
    if (!silent && last && last.focus && doc.contains(last)) { last.focus({ preventScroll: true }); }
    if (cb && !silent) { cb(); }
  }

  /** Keeps Tab inside the open modal. */
  function trapFocus(e) {
    if (e.key !== 'Tab' || !modalState.open) { return; }
    var nodes = doc.querySelectorAll('#modal button:not([disabled]), #modal input, #modal textarea, #modal a[href]');
    if (!nodes.length) { return; }
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ------------------------------------------------------------------ */
  /* Review dialog                                                       */
  /* ------------------------------------------------------------------ */
  function analysisHtml(text, rating) {
    if (!text.trim()) {
      return '<p class="analysis__empty">Write a few words. LitSense reads which aspects you mention and how you feel about each one.</p>';
    }
    var found = E.analyzeReview(text, rating);
    if (!found.length) {
      return '<p class="analysis__empty">No aspects detected yet. Try mentioning the characters, the pacing, the prose or the ending.</p>';
    }
    return '<ul class="evidence">' + found.map(function (a) {
      var kind = a.sentiment > 0 ? 'pos' : (a.sentiment < 0 ? 'neg' : 'neutral');
      if (kind === 'neutral') { return '<li class="tag tag--neutral"><span class="tag__text">' + esc(a.label) + '</span></li>'; }
      return ui.tag(kind, a.label);
    }).join('') + '</ul>';
  }

  function reviewModal(bookId) {
    var b = E.book(bookId);
    if (!b) { return; }
    var s = LS.store.get();
    var existing = s.reviews && s.reviews[bookId];
    var entry = s.shelf[bookId];
    // The shelf rating is the live one; a stored review only remembers what it was when written.
    var rating = (entry && entry.rating) || (existing && existing.rating) || 0;
    var text = existing ? existing.text : '';
    var needsRead = !entry || entry.status !== 'read';
    var data = { bookId: bookId, rating: rating };

    openModal({
      cls: 'modal__panel--review', data: data,
      html: '<div class="review-modal"><header class="review-modal__head"><div class="review-modal__cover">' + ui.cover(b, { size: 'sm' }) + '</div>' +
        '<div><p class="eyebrow">Your review</p><h2 id="modalTitle">' + esc(b.title) + '</h2><p class="review-modal__author">' + esc(b.author) + '</p></div></header>' +
        '<div class="review-modal__rate"><span class="label">Your rating</span>' + ui.rateWidget(bookId, rating).replace(/data-action="rate"/g, 'data-action="modal-rate"') + '</div>' +
        '<label class="field"><span class="label">What stayed with you?</span>' +
        '<textarea id="reviewText" rows="5" maxlength="900" placeholder="The prose, the characters, the pacing. Say it your way.">' + esc(text) + '</textarea></label>' +
        '<div class="review-modal__tools"><button type="button" class="link-underline" data-action="modal-sample">Try the example from the project deck</button><span class="count" id="reviewCount">' + text.length + ' / 900</span></div>' +
        '<section class="analysis" aria-live="polite"><p class="analysis__title">' + ui.icon('sparkle', 15, 1.8) + '<span>What LitSense hears</span></p><div id="reviewAnalysis">' + analysisHtml(text, rating) + '</div></section>' +
        (needsRead ? '<label class="check"><input type="checkbox" id="reviewMarkRead" checked><span>Also mark this book as read</span></label>' : '') +
        '<footer class="review-modal__foot"><button type="button" class="btn btn--ghost" data-action="close-modal">Cancel</button>' +
        '<button type="button" class="btn btn--primary" data-action="modal-save">Save review</button></footer></div>',
      onMount: function (root) {
        var ta = $('#reviewText', root);
        var refresh = U.debounce(function () {
          $('#reviewAnalysis', root).innerHTML = analysisHtml(ta.value, data.rating);
        }, 120);
        ta.addEventListener('input', function () {
          $('#reviewCount', root).textContent = ta.value.length + ' / 900';
          refresh();
        });
      }
    });
  }

  function modalRate(value) {
    if (!modalState.data) { return; }
    modalState.data.rating = value;
    var rate = $('#modal .rate');
    if (rate) {
      rate.setAttribute('data-value', value);
      rate.style.setProperty('--r', value);
      $('.rate__label', rate).textContent = Number(value).toFixed(1);
    }
    var ta = $('#reviewText');
    if (ta) { $('#reviewAnalysis').innerHTML = analysisHtml(ta.value, value); }
  }

  function modalSample() {
    var ta = $('#reviewText');
    if (!ta) { return; }
    ta.value = LS.data.sampleReview;
    ta.dispatchEvent(new global.Event('input', { bubbles: true }));
    if (modalState.data && !modalState.data.rating) { modalRate(4); }
    ta.focus();
  }

  function modalSave() {
    var ta = $('#reviewText');
    if (!modalState.data) { return; }
    var mark = $('#reviewMarkRead');
    var payload = { text: ta ? ta.value.trim() : '', rating: modalState.data.rating, markRead: mark ? mark.checked : false };
    var bookId = modalState.data.bookId;
    if (!payload.text && !payload.rating) {
      toast('Add a rating or a few words first', { icon: 'info', kind: 'warn' });
      return;
    }
    closeModal();
    LS.app.saveReview(bookId, payload);
  }

  /* ------------------------------------------------------------------ */
  /* Search overlay                                                      */
  /* ------------------------------------------------------------------ */
  var search = { open: false, active: 0, results: [], lastFocus: null };
  var SUGGESTIONS = ['Andy Weir', 'Madeline Miller', 'Fantasy', 'Cozy', 'Historical', 'Humor'];

  function highlight(text, tokens) {
    var safe = esc(text);
    tokens.forEach(function (t) {
      if (!t) { return; }
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      safe = safe.replace(re, '<mark>$1</mark>');
    });
    return safe;
  }

  function searchItem(b, i, tokens, s) {
    var e = E.entry(s, b.id);
    var score = E.match(b, s).score;
    return '<li role="option" id="result-' + i + '" class="result' + (i === search.active ? ' is-active' : '') + '" data-i="' + i + '">' +
      '<a class="result__link" href="' + ui.bookHref(b) + '" data-action="close-search"><span class="result__cover">' + ui.cover(b, { size: 'xs' }) + '</span>' +
      '<span class="result__main"><strong>' + highlight(b.title, tokens) + '</strong><small>' + highlight(b.author, tokens) + ' · ' + highlight(b.genres.join(', '), tokens) + '</small></span>' +
      '<span class="result__meta">' + (e ? ui.statusPill(e.status) : '') + '<b class="result__match">' + score + '%</b></span></a></li>';
  }

  function renderSearch() {
    var input = $('#searchInput');
    var list = $('#searchResults');
    var hint = $('#searchHint');
    var q = input.value.trim();
    var s = LS.store.get();
    search.active = 0;
    if (!q) {
      search.results = [];
      list.innerHTML = '';
      hint.innerHTML = '<p class="search__label">Try searching for</p><div class="chips">' + SUGGESTIONS.map(function (t) {
        return '<button type="button" class="chip" data-action="search-suggest" data-query="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div>';
      return;
    }
    search.results = E.search(q, 8);
    var tokens = q.toLowerCase().split(/[^a-z0-9&']+/).filter(Boolean);
    if (!search.results.length) {
      list.innerHTML = '';
      hint.innerHTML = '<p class="search__none">No books match &ldquo;' + esc(q) + '&rdquo;. Try an author, a title or a genre such as fantasy.</p>';
      return;
    }
    hint.innerHTML = '<p class="search__label">' + search.results.length + (search.results.length === 1 ? ' result' : ' results') + '</p>';
    list.innerHTML = search.results.map(function (b, i) { return searchItem(b, i, tokens, s); }).join('');
  }

  function setActive(i) {
    var items = doc.querySelectorAll('#searchResults .result');
    if (!items.length) { return; }
    search.active = (i + items.length) % items.length;
    for (var k = 0; k < items.length; k++) { items[k].classList.toggle('is-active', k === search.active); }
    var el = items[search.active];
    if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'nearest' }); }
    $('#searchInput').setAttribute('aria-activedescendant', 'result-' + search.active);
  }

  function openSearch(query) {
    var root = $('#search');
    if (!root) { return; }
    search.lastFocus = doc.activeElement;
    closeMenu();
    root.hidden = false;
    doc.body.classList.add('is-locked');
    var input = $('#searchInput');
    input.value = query || '';
    renderSearch();
    search.open = true;
    void root.offsetWidth;
    root.classList.add('is-open');
    input.focus();
  }

  function closeSearch() {
    var root = $('#search');
    if (!root || !search.open) { return; }
    search.open = false;
    root.classList.remove('is-open');
    setTimeout(function () { if (!search.open) { root.hidden = true; } }, 200);
    if (!modalState.open) { doc.body.classList.remove('is-locked'); }
    if (search.lastFocus && search.lastFocus.focus) { search.lastFocus.focus({ preventScroll: true }); }
  }

  function bindSearch() {
    var input = $('#searchInput');
    if (!input) { return; }
    input.addEventListener('input', U.debounce(renderSearch, 90));
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(search.active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(search.active - 1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var b = search.results[search.active];
        if (b) { closeSearch(); LS.nav.go('/book/' + b.id); }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Global keys                                                         */
  /* ------------------------------------------------------------------ */
  function onKey(e) {
    if (e.key === 'Escape') {
      if (menuState.el) { closeMenu(); return; }
      if (modalState.open) { closeModal(); return; }
      if (search.open) { closeSearch(); return; }
    }
    trapFocus(e);
    var tag = (e.target && e.target.tagName) || '';
    var typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
    if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === '/' )) { e.preventDefault(); openSearch(''); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(''); }
  }

  function init() {
    bindSearch();
    doc.addEventListener('keydown', onKey);
    doc.addEventListener('mousedown', function (e) {
      if (menuState.el && !menuState.el.contains(e.target) && !(menuState.anchor && menuState.anchor.contains(e.target))) { closeMenu(); }
    });
    global.addEventListener('resize', closeMenu);
    // A floating menu follows nothing, so a real scroll closes it. Tiny shifts (late layout) do not.
    global.addEventListener('scroll', function () {
      if (menuState.el && !menuState.el.classList.contains('menu--sheet') && Math.abs(global.scrollY - menuState.scrollY) > 24) { closeMenu(); }
    }, { passive: true });
  }

  LS.overlays = {
    init: init, toast: toast, menu: openMenu, closeMenu: closeMenu,
    modal: openModal, closeModal: closeModal, reviewModal: reviewModal, modalRate: modalRate, modalSample: modalSample, modalSave: modalSave,
    openSearch: openSearch, closeSearch: closeSearch, setActive: setActive,
    get searchOpen() { return search.open; }
  };
})(window);
