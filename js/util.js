/* ==========================================================================
   LitSense prototype - UTIL
   Small pure helpers shared by every module. No DOM state, no app state.
   ========================================================================== */
(function (global) {
  'use strict';

  var LS = (global.LitSense = global.LitSense || {});

  var HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var DAY = 86400000;

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /** Stable string hash (djb2). Keeps "random" choices deterministic. */
  function hash(str) {
    var h = 5381;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h = ((h << 5) + h + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  function pick(list, seed) { return list[hash(seed) % list.length]; }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return HTML_ESC[c]; });
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  /** 1500 -> "1.5M", 220 -> "220K" (input is thousands). */
  function fmtK(thousands) {
    if (thousands >= 1000) {
      var m = thousands / 1000;
      return (m >= 10 ? Math.round(m) : Math.round(m * 10) / 10) + 'M';
    }
    return Math.round(thousands) + 'K';
  }

  /** Relative day label from a timestamp. */
  function ago(ts, now) {
    now = now || Date.now();
    var days = Math.floor((now - ts) / DAY);
    if (days <= 0) { return 'today'; }
    if (days === 1) { return 'yesterday'; }
    if (days < 7) { return days + ' days ago'; }
    if (days < 14) { return 'last week'; }
    if (days < 60) { return Math.round(days / 7) + ' weeks ago'; }
    if (days < 365) { return Math.round(days / 30) + ' months ago'; }
    return Math.round(days / 365) + ' years ago';
  }

  function dateLabel(ts) {
    try {
      return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function greeting(date) {
    var h = (date || new Date()).getHours();
    if (h < 5) { return 'Still up'; }
    if (h < 12) { return 'Good morning'; }
    if (h < 18) { return 'Good afternoon'; }
    return 'Good evening';
  }

  /** "a, b and c" */
  function listJoin(items) {
    if (items.length <= 1) { return items.join(''); }
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function lowerFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function upperFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  LS.util = {
    DAY: DAY, clamp: clamp, hash: hash, pick: pick, esc: esc, plural: plural, fmtK: fmtK, ago: ago,
    dateLabel: dateLabel, greeting: greeting, listJoin: listJoin, lowerFirst: lowerFirst, upperFirst: upperFirst,
    debounce: debounce, sleep: sleep, reducedMotion: reducedMotion
  };
})(window);
