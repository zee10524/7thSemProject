/* ==========================================================================
   LitSense prototype - NAVIGATION
   --------------------------------------------------------------------------
   Hash router that works from file:// (no server, no History API needed).
     #/discover   #/my-books   #/recommendations   #/recent[/:bookId]
     #/chat       #/book/:id   #/profile
   When you move to React, swap this for react-router and keep the route table.
   ========================================================================== */
(function (global) {
  'use strict';

  var LS = global.LitSense;

  var ROUTES = [
    { name: 'discover',        re: /^\/(?:discover)?$/,            title: 'Discover',         nav: 'discover' },
    { name: 'my-books',        re: /^\/my-books$/,                 title: 'My Books',         nav: 'my-books' },
    { name: 'recommendations', re: /^\/recommendations$/,          title: 'Recommendations',  nav: 'recommendations' },
    { name: 'recent',          re: /^\/recent(?:\/([\w-]+))?$/,    title: 'Recent Reads',     nav: 'recent' },
    { name: 'chat',            re: /^\/chat$/,                     title: 'Ask LitSense',     nav: 'chat' },
    { name: 'book',            re: /^\/book\/([\w-]+)$/,           title: 'Book',             nav: 'discover' },
    { name: 'profile',         re: /^\/profile$/,                  title: 'Reader DNA',       nav: 'profile' }
  ];

  /* Desktop header links, in order. */
  var LINKS = [
    { id: 'discover',        label: 'Discover',        href: '#/discover' },
    { id: 'my-books',        label: 'My Books',        href: '#/my-books' },
    { id: 'recommendations', label: 'Recommendations', href: '#/recommendations' },
    { id: 'recent',          label: 'Recent Reads',    href: '#/recent' },
    { id: 'chat',            label: 'Ask LitSense',    href: '#/chat' }
  ];

  /* Mobile bottom navigation: Home, Books, Discover, Chat, Profile. */
  var TABS = [
    { id: 'discover',        label: 'Home',     href: '#/discover',        icon: 'home' },
    { id: 'my-books',        label: 'Books',    href: '#/my-books',        icon: 'book-open' },
    { id: 'recommendations', label: 'Discover', href: '#/recommendations', icon: 'compass' },
    { id: 'chat',            label: 'Chat',     href: '#/chat',            icon: 'chat' },
    { id: 'profile',         label: 'Profile',  href: '#/profile',         icon: 'user' }
  ];

  var listeners = [];
  var current = null;

  function parse(hash) {
    var h = String(hash == null ? global.location.hash : hash).replace(/^#/, '');
    if (!h || h === '/') { h = '/discover'; }
    var q = h.indexOf('?');
    var path = q > -1 ? h.slice(0, q) : h;
    for (var i = 0; i < ROUTES.length; i++) {
      var m = ROUTES[i].re.exec(path);
      if (m) {
        return { name: ROUTES[i].name, title: ROUTES[i].title, nav: ROUTES[i].nav, path: path, params: { id: m[1] || null } };
      }
    }
    return { name: 'notFound', title: 'Not found', nav: null, path: path, params: {} };
  }

  function go(path) {
    var next = '#' + path;
    if (global.location.hash === next) { emit(parse(next)); } else { global.location.hash = next; }
  }

  function emit(route) {
    var prev = current;
    current = route;
    listeners.forEach(function (fn) { fn(route, prev); });
  }

  function onChange(fn) { listeners.push(fn); }

  function start() {
    global.addEventListener('hashchange', function () { emit(parse()); });
    emit(parse());
  }

  /** Marks the active link in the header and the bottom bar. */
  function syncActive(route) {
    var id = route && route.nav;
    var nodes = global.document.querySelectorAll('[data-nav]');
    for (var i = 0; i < nodes.length; i++) {
      var on = nodes[i].getAttribute('data-nav') === id;
      nodes[i].classList.toggle('is-active', on);
      if (on) { nodes[i].setAttribute('aria-current', 'page'); } else { nodes[i].removeAttribute('aria-current'); }
    }
  }

  LS.nav = {
    ROUTES: ROUTES, LINKS: LINKS, TABS: TABS,
    parse: parse, go: go, start: start, onChange: onChange, syncActive: syncActive,
    get current() { return current || parse(); }
  };
})(window);
