/* ==========================================================================
   LitSense prototype - UI COMPONENTS
   --------------------------------------------------------------------------
   Pure template functions: (data) -> HTML string. No state, no listeners.
   Interactions are wired once in app.js through data-action attributes.
   When you move to React, each function here becomes a component.
   ========================================================================== */
(function (global) {
  'use strict';

  var LS = global.LitSense;
  var U = LS.util;
  var D = LS.data;
  var E = LS.engine;
  var esc = U.esc;

  var STATUS = {
    want:    { label: 'Want to Read',      short: 'Want',    icon: 'bookmark' },
    reading: { label: 'Currently Reading', short: 'Reading', icon: 'book-open' },
    read:    { label: 'Read',              short: 'Read',    icon: 'check' }
  };

  /* ------------------------------------------------------------------ */
  /* Icons (24px grid, stroke based)                                     */
  /* ------------------------------------------------------------------ */
  var ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    'book-open': '<path d="M2 5.5C4.5 4 8 4 12 6c4-2 7.5-2 10-.5V19c-2.5-1.5-6-1.5-10 .5-4-2-7.5-2-10-.5z"/><path d="M12 6v13.5"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    'arrow-right': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    'arrow-left': '<path d="M19 12H5m6-6-6 6 6 6"/>',
    'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    sparkle: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/><path d="M19 15.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2.2 1.4.8 2.2 1.8 2.7C10.3 9 11 6 12 3z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.6 3.5 6"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-.9-.6-1.4-.6-2.2 0-.9.7-1.5 1.7-1.5H17a4 4 0 0 0 4-4C21 6.9 17 3 12 3z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/><circle cx="15" cy="7.5" r="1" fill="currentColor"/>',
    quote: '<path d="M7 17c-2 0-3-1.3-3-3.5C4 10 6 7.5 9 6.5M17 17c-2 0-3-1.3-3-3.5 0-3.5 2-6 5-7"/>',
    'book-closed': '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>'
  };

  function icon(name, size, stroke) {
    var s = size || 20;
    return '<svg class="icon icon--' + name + '" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="' +
      (stroke || 1.6) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* Cover art motifs (viewBox 0 0 100 100, drawn in currentColor)       */
  /* They only show when the real cover image is missing or offline.     */
  /* ------------------------------------------------------------------ */
  function star4(x, y, r) {
    return 'M' + x + ' ' + (y - r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) +
      'Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + 'Z';
  }

  function pineTree(x, y, h, w) {
    return '<path d="M' + x + ' ' + (y - h) + 'L' + (x + w / 2) + ' ' + (y - h * 0.38) + 'H' + (x + w / 4) + 'L' + (x + w * 0.6) + ' ' + y +
      'H' + (x - w * 0.6) + 'L' + (x - w / 4) + ' ' + (y - h * 0.38) + 'H' + (x - w / 2) + 'Z"/>';
  }

  var MOTIFS = {
    orbit: function () {
      return '<circle cx="50" cy="50" r="16" fill="currentColor"/>' +
        '<ellipse cx="50" cy="50" rx="40" ry="12" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(-24 50 50)"/>' +
        '<circle cx="86" cy="34" r="2.6" fill="currentColor"/>' +
        '<g fill="currentColor" opacity=".8"><circle cx="14" cy="16" r="1.3"/><circle cx="30" cy="86" r="1.1"/><circle cx="88" cy="80" r="1.5"/><circle cx="70" cy="10" r="1"/><circle cx="10" cy="60" r="1"/></g>';
    },
    sun: function () {
      return '<circle cx="50" cy="50" r="17" fill="currentColor"/><g stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' +
        '<path d="M50 22V10M50 78v12M22 50H10M78 50h12M30.2 30.2l-8.5-8.5M78.3 78.3l-8.5-8.5M69.8 30.2l8.5-8.5M21.7 78.3l8.5-8.5"/></g>';
    },
    meander: function () {
      var d = 'M8 92H92';
      for (var x = 8; x < 84; x += 12) { d += 'M' + x + ' 92V78H' + (x + 9) + 'V87H' + (x + 4) + 'V83H' + (x + 6); }
      return '<circle cx="50" cy="40" r="23" fill="currentColor"/><circle cx="50" cy="40" r="30" fill="none" stroke="currentColor" stroke-width="1.1"/>' +
        '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.6"/>';
    },
    arches: function () {
      return '<g fill="none" stroke="currentColor" stroke-width="2"><path d="M12 92V56a14 14 0 0 1 28 0v36"/><path d="M36 92V46a14 14 0 0 1 28 0v46"/><path d="M60 92V56a14 14 0 0 1 28 0v36"/></g>' +
        '<path d="M78 14a11 11 0 1 0 8 18 9 9 0 0 1-8-18z" fill="currentColor"/>' +
        '<g fill="currentColor"><circle cx="20" cy="18" r="1.2"/><circle cx="40" cy="10" r="1"/><circle cx="58" cy="22" r="1.1"/></g>';
    },
    pixels: function () {
      var rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
      var s = 12; var g = 1.4; var ox = 50 - (7 * s) / 2; var oy = 16; var out = '';
      rows.forEach(function (r, y) {
        r.split('').forEach(function (c, x) {
          if (c === 'X') { out += '<rect x="' + (ox + x * s) + '" y="' + (oy + y * s) + '" width="' + (s - g) + '" height="' + (s - g) + '"/>'; }
        });
      });
      return '<g fill="currentColor">' + out + '</g>';
    },
    eye: function () {
      return '<path d="M6 50C22 26 78 26 94 50 78 74 22 74 6 50z" fill="none" stroke="currentColor" stroke-width="2.4"/>' +
        '<circle cx="50" cy="50" r="13" fill="currentColor"/><circle cx="50" cy="50" r="5.5" fill="var(--c1)"/>' +
        '<path d="M50 14v8M26 20l4 7M74 20l-4 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
    },
    atom: function () {
      return '<g fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="50" cy="50" rx="40" ry="14"/>' +
        '<ellipse cx="50" cy="50" rx="40" ry="14" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="40" ry="14" transform="rotate(120 50 50)"/></g>' +
        '<circle cx="50" cy="50" r="7" fill="currentColor"/>';
    },
    pines: function () {
      return '<circle cx="76" cy="20" r="8" fill="currentColor"/><g fill="currentColor">' + pineTree(24, 92, 56, 26) + pineTree(50, 92, 72, 30) + pineTree(76, 92, 46, 22) + '</g>' +
        '<path d="M6 92h88" stroke="currentColor" stroke-width="1.6"/>';
    },
    pyramid: function () {
      return '<circle cx="72" cy="24" r="11" fill="currentColor"/><path d="M16 78 50 28l34 50z" fill="currentColor" opacity=".92"/>' +
        '<path d="M50 28 42 78" stroke="var(--c1)" stroke-width="1.4" opacity=".5" fill="none"/>' +
        '<path d="M2 82c18-8 30 6 48-2s32-6 48 0V96H2z" fill="currentColor" opacity=".55"/>';
    },
    fan: function () {
      return '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M50 88 12 44M50 88 26 30M50 88V20M50 88 74 30M50 88 88 44"/>' +
        '<path d="M12 44A46 46 0 0 1 88 44"/><path d="M27 61A30 30 0 0 1 73 61"/></g><circle cx="50" cy="88" r="4" fill="currentColor"/>';
    },
    house: function () {
      return '<path d="M18 52 50 24l32 28" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>' +
        '<path d="M26 48v38h48V48" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="43" y="62" width="14" height="24" fill="currentColor"/>' +
        '<rect x="31" y="56" width="8" height="8" fill="currentColor" opacity=".7"/><rect x="61" y="56" width="8" height="8" fill="currentColor" opacity=".7"/>' +
        '<path d="M8 88h84" stroke="currentColor" stroke-width="1.6"/>' +
        '<g fill="currentColor" opacity=".7"><circle cx="14" cy="22" r="1.4"/><circle cx="86" cy="18" r="1.2"/><circle cx="76" cy="36" r="1"/></g>';
    },
    planet: function () {
      return '<circle cx="52" cy="50" r="30" fill="currentColor"/><g fill="var(--c1)" opacity=".28"><circle cx="42" cy="40" r="6"/><circle cx="62" cy="58" r="8"/><circle cx="48" cy="64" r="3.5"/></g>' +
        '<g fill="currentColor" opacity=".85"><circle cx="14" cy="18" r="1.4"/><circle cx="84" cy="14" r="1.2"/><circle cx="90" cy="80" r="1.6"/><circle cx="12" cy="78" r="1.1"/></g>';
    },
    waves: function () {
      return '<circle cx="70" cy="26" r="11" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
        '<path d="M6 56q11-10 22 0t22 0 22 0 22 0"/><path d="M6 70q11-10 22 0t22 0 22 0 22 0"/><path d="M6 84q11-10 22 0t22 0 22 0 22 0"/></g>';
    },
    horizon: function () {
      return '<path d="M10 62h80" stroke="currentColor" stroke-width="2"/><path d="M30 62a20 20 0 0 1 40 0z" fill="currentColor" opacity=".9"/>' +
        '<g stroke="currentColor" stroke-width="1.4" opacity=".6"><path d="M18 72h64M28 80h44M38 88h24"/></g>';
    },
    windows: function () {
      var out = '';
      for (var i = 0; i < 9; i++) {
        var x = 16 + (i % 3) * 24; var y = 12 + Math.floor(i / 3) * 28;
        out += '<rect x="' + x + '" y="' + y + '" width="18" height="22" rx="1.5" fill="' + (i === 4 ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"/>';
      }
      return out;
    },
    stripes: function () {
      return '<g fill="none" stroke="currentColor" stroke-width="5"><path d="M10 82A72 72 0 0 1 82 10"/><path d="M10 68A58 58 0 0 1 68 10" opacity=".85"/>' +
        '<path d="M10 54A44 44 0 0 1 54 10" opacity=".7"/><path d="M10 40A30 30 0 0 1 40 10" opacity=".55"/></g><circle cx="76" cy="76" r="12" fill="currentColor"/>';
    },
    halls: function () {
      return '<g fill="none" stroke="currentColor" stroke-width="2"><path d="M14 90V46a36 36 0 0 1 72 0v44"/><path d="M26 90V50a24 24 0 0 1 48 0v40"/><path d="M38 90V54a12 12 0 0 1 24 0v36"/></g>' +
        '<path d="M8 90h84" stroke="currentColor" stroke-width="2"/><path d="M16 95h68" stroke="currentColor" stroke-width="1" opacity=".5"/>';
    },
    mug: function () {
      return '<path d="M24 42h42v24a18 18 0 0 1-18 18H42a18 18 0 0 1-18-18z" fill="currentColor"/><path d="M66 50h6a10 10 0 0 1 0 20h-8" fill="none" stroke="currentColor" stroke-width="4"/>' +
        '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M36 32c-4-5 4-8 0-14"/><path d="M48 32c-4-5 4-8 0-14"/><path d="M60 32c-4-5 4-8 0-14"/></g>';
    },
    isle: function () {
      return '<circle cx="74" cy="24" r="10" fill="currentColor"/><path d="M14 72Q50 40 86 72Z" fill="currentColor" opacity=".9"/>' +
        '<path d="M40 58l10-12 10 12zM43 58v10h14V58" fill="var(--c1)" opacity=".9"/>' +
        '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 80q11-8 22 0t22 0 22 0 22 0"/><path d="M6 92q11-8 22 0t22 0 22 0 22 0"/></g>';
    },
    stars: function () {
      return '<path d="M62 22a22 22 0 1 0 14 38 18 18 0 0 1-14-38z" fill="currentColor"/><g fill="currentColor">' +
        '<path d="' + star4(24, 26, 7) + '"/><path d="' + star4(82, 70, 5) + '"/><path d="' + star4(30, 70, 4) + '"/><path d="' + star4(88, 24, 3.5) + '"/></g>' +
        '<g stroke="currentColor" stroke-width="1.6" opacity=".7"><path d="M6 92h88M14 92V84M30 92V84M70 92V84M86 92V84"/></g>';
    },
    dome: function () {
      return '<path d="M50 6v10M45 11h10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M50 16C66 30 76 42 76 58a26 26 0 0 1-52 0C24 42 34 30 50 16z" fill="currentColor"/>' +
        '<path d="M28 72h44v6H28zM24 80h52v12H24z" fill="currentColor" opacity=".85"/>' +
        '<g stroke="var(--c1)" stroke-width="1.6" opacity=".45" fill="none"><path d="M50 20C40 34 36 48 38 62M50 20C60 34 64 48 62 62M50 20V64"/></g>';
    },
    tent: function () {
      var out = ''; var i; var x0; var x1;
      for (i = 0; i < 6; i++) {
        x0 = 12 + i * (76 / 6); x1 = 12 + (i + 1) * (76 / 6);
        out += '<path d="M50 16L' + x0.toFixed(1) + ' 52H' + x1.toFixed(1) + 'Z" fill="currentColor" opacity="' + (i % 2 ? '.5' : '1') + '"/>';
      }
      return out + '<path d="M12 52h76v34H12z" fill="currentColor" opacity=".85"/><path d="M41 86 50 62l9 24z" fill="var(--c1)"/>' +
        '<path d="M50 16V6l9 3-9 3" fill="currentColor"/>';
    },
    laurel: function () {
      var out = ''; var i; var a; var x; var y;
      for (i = 0; i < 14; i++) {
        a = (i / 14) * Math.PI * 2; x = 50 + Math.cos(a) * 32; y = 50 + Math.sin(a) * 32;
        out += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="3.4" ry="8.5" transform="rotate(' + (a * 180 / Math.PI + 90).toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"/>';
      }
      return '<g fill="currentColor">' + out + '</g><circle cx="50" cy="50" r="14" fill="none" stroke="currentColor" stroke-width="1.6"/>';
    },
    dunes: function () {
      return '<circle cx="68" cy="26" r="11" fill="currentColor"/><circle cx="34" cy="38" r="6" fill="currentColor" opacity=".7"/>' +
        '<path d="M0 70C20 52 36 56 52 66S84 76 100 62V100H0z" fill="currentColor" opacity=".9"/><path d="M0 86C22 74 40 80 60 86S86 92 100 84V100H0z" fill="var(--c1)" opacity=".35"/>';
    },
    road: function () {
      return '<path d="M44 34 12 92h76L56 34z" fill="currentColor" opacity=".85"/><path d="M50 36V92" stroke="var(--c1)" stroke-width="2.2" stroke-dasharray="6 5" fill="none"/>' +
        '<path d="M6 34h88" stroke="currentColor" stroke-width="1.6"/><circle cx="50" cy="20" r="6" fill="currentColor" opacity=".6"/>';
    },
    dots: function () {
      var out = ''; var i; var a;
      for (i = 0; i < 12; i++) { a = (i / 12) * Math.PI * 2; out += '<circle cx="' + (50 + Math.cos(a) * 38).toFixed(1) + '" cy="' + (50 + Math.sin(a) * 38).toFixed(1) + '" r="3.6"/>'; }
      return '<g fill="currentColor" opacity=".75">' + out + '</g><circle cx="50" cy="50" r="22" fill="currentColor"/>';
    },
    awning: function () {
      var out = ''; var i;
      for (i = 0; i < 6; i++) { out += '<path d="M' + (10 + i * 13.3).toFixed(1) + ' 24h13.3l-1.6 24h-10.1z" fill="currentColor" opacity="' + (i % 2 ? '.5' : '1') + '"/>'; }
      return out + '<rect x="14" y="52" width="72" height="36" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="42" y="62" width="16" height="26" fill="currentColor"/>' +
        '<rect x="20" y="58" width="16" height="12" fill="currentColor" opacity=".6"/><rect x="64" y="58" width="16" height="12" fill="currentColor" opacity=".6"/>';
    },
    books: function () {
      return '<g fill="currentColor"><rect x="14" y="30" width="12" height="58" rx="1.5"/><rect x="28" y="22" width="14" height="66" rx="1.5" opacity=".8"/>' +
        '<rect x="44" y="34" width="11" height="54" rx="1.5"/><rect x="57" y="26" width="15" height="62" rx="1.5" opacity=".8"/><path d="M76 88 84 32l11 2-8 54z"/></g>' +
        '<path d="M8 90h86" stroke="currentColor" stroke-width="2"/><g stroke="var(--c1)" stroke-width="1.6" opacity=".6"><path d="M14 44h12M28 38h14M57 42h15M44 50h11"/></g>';
    },
    sprout: function () {
      return '<path d="M50 90V46" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M50 52C50 32 32 24 16 28c0 20 14 28 34 24z" fill="currentColor"/>' +
        '<path d="M50 44C50 26 66 16 84 20c0 20-16 28-34 24z" fill="currentColor" opacity=".8"/><path d="M30 90h40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>';
    },
    quill: function () {
      return '<path d="M80 12C48 16 24 40 20 86c26-8 52-26 60-74z" fill="currentColor"/><path d="M20 86 64 38" stroke="var(--c1)" stroke-width="1.8" opacity=".6" fill="none"/>' +
        '<path d="M10 92h30" stroke="currentColor" stroke-width="1.6"/>';
    },
    rings: function () {
      return '<g fill="none" stroke="currentColor" stroke-width="3"><circle cx="38" cy="50" r="24"/><circle cx="62" cy="50" r="24"/></g>';
    },
    towers: function () {
      var specs = [[10, 46, 18], [30, 28, 20], [52, 14, 18], [72, 38, 20]]; var out = '';
      specs.forEach(function (s) {
        out += '<rect x="' + s[0] + '" y="' + s[1] + '" width="' + s[2] + '" height="' + (90 - s[1]) + '" fill="currentColor" opacity=".9"/>';
        for (var y = s[1] + 6; y < 82; y += 9) {
          out += '<rect x="' + (s[0] + 3) + '" y="' + y + '" width="3.2" height="4" fill="var(--c1)" opacity=".55"/><rect x="' + (s[0] + s[2] - 7) + '" y="' + y + '" width="3.2" height="4" fill="var(--c1)" opacity=".55"/>';
        }
      });
      return out + '<path d="M4 90h92" stroke="currentColor" stroke-width="2"/>';
    }
  };

  function motif(name) {
    var m = MOTIFS[name] || MOTIFS.stars;
    return '<svg class="cover__svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">' + m() + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* Cover                                                               */
  /* ------------------------------------------------------------------ */
  function coverUrl(b, size) {
    var c = b.cover || {};
    if (!D.config.remoteCovers || !c.id) { return ''; }
    if (global.navigator && global.navigator.onLine === false) { return ''; }
    return D.config.coverBase + c.id + '-' + (size === 'xs' || size === 'sm' || size === 'md' ? 'M' : 'L') + '.jpg';
  }

  function cover(b, o) {
    o = o || {};
    var c = b.cover || {};
    var size = o.size || 'md';
    var len = b.title.length;
    var lenKey = len <= 12 ? 's' : (len <= 22 ? 'm' : (len <= 32 ? 'l' : 'xl'));
    var url = coverUrl(b, size);
    var img = url
      ? '<img class="cover__img" src="' + url + '" alt="" ' + (o.eager ? 'loading="eager"' : 'loading="lazy"') + ' decoding="async" referrerpolicy="no-referrer">'
      : '';
    return '<span class="cover cover--' + size + '" role="img" aria-label="Cover of ' + esc(b.title) + '" data-layout="' + esc(c.layout || 'center') + '" data-font="' + esc(c.font || 'serif') +
      '" data-len="' + lenKey + '" style="--c1:' + c.c1 + ';--c2:' + c.c2 + ';--ci:' + c.ink + ';--ca:' + c.accent + '">' +
      '<span class="cover__art">' + motif(c.motif) + '</span><span class="cover__band"></span>' +
      '<span class="cover__title">' + esc(b.title) + '</span>' +
      '<span class="cover__author">' + esc(b.author) + '</span>' + img + '</span>';
  }

  /* ------------------------------------------------------------------ */
  /* Small atoms                                                         */
  /* ------------------------------------------------------------------ */
  function stars(value, cls) {
    value = value || 0;
    return '<span class="stars' + (cls ? ' ' + cls : '') + '" style="--r:' + value + '" role="img" aria-label="' + value + ' out of 5 stars"></span>';
  }

  function rateWidget(bookId, value) {
    var hits = '';
    for (var i = 1; i <= 10; i++) {
      var v = i / 2;
      hits += '<button type="button" class="rate__hit" data-action="rate" data-book="' + bookId + '" data-rating="' + v + '" aria-label="' + v + ' stars"></button>';
    }
    return '<div class="rate" data-value="' + (value || 0) + '" style="--r:' + (value || 0) + '">' +
      '<span class="rate__stars"><span class="stars stars--lg"></span><span class="rate__hits" role="group" aria-label="Rate this book">' + hits + '</span></span>' +
      '<span class="rate__label">' + (value ? Number(value).toFixed(1) : 'Rate this book') + '</span></div>';
  }

  function match(score, o) {
    o = o || {};
    return '<span class="match' + (o.cls ? ' ' + o.cls : '') + '" style="--v:' + score + '" title="' + score + '% match">' +
      '<span class="match__dial"><span class="match__ring"></span><span class="match__num">' + score + '<small>%</small></span></span>' +
      '<span class="match__label">match</span></span>';
  }

  function bar(value, pref, cls) {
    return '<span class="bar' + (cls ? ' ' + cls : '') + '" style="--v:' + value + (pref != null ? ';--pref:' + pref : '') + '"><span class="bar__track"><i></i></span>' +
      (pref != null ? '<b class="bar__pref" title="Your preference"></b>' : '') + '</span>';
  }

  function aspectRow(a, value, pref, o) {
    o = o || {};
    return '<div class="aspect' + (o.cls ? ' ' + o.cls : '') + '">' +
      (o.no === false ? '' : '<span class="aspect__no">' + a.no + '</span>') +
      '<span class="aspect__name">' + esc(a.label) + '</span>' + bar(value, pref) + '<span class="aspect__val">' + value + '</span></div>';
  }

  function aspectChart(b, keys, o) {
    return '<div class="aspects">' + keys.map(function (k) { return aspectRow(E.ASPECT[k], b.aspects[k], o && o.pref ? o.pref[k] : null, o); }).join('') + '</div>';
  }

  function sign(n) { return (n > 0 ? '+' : '') + n; }

  function tag(kind, label, delta) {
    var ic = kind === 'pos' ? 'plus' : 'minus';
    return '<li class="tag tag--' + kind + '"><span class="tag__sign">' + icon(ic, 12, 2.4) + '</span><span class="tag__text">' + esc(label) + '</span>' +
      (delta != null ? '<span class="tag__delta">' + sign(delta) + '</span>' : '') + '</li>';
  }

  function tags(why, o) {
    o = o || {};
    var items = why.tags.map(function (t) { return tag(t.kind, t.label, o.delta ? t.delta : null); }).join('');
    return items ? '<ul class="evidence">' + items + '</ul>' : '';
  }

  function why(r, o) {
    o = o || {};
    return '<div class="why"><span class="why__label">' + (o.label || 'Why this book?') + '</span>' +
      '<p class="why__text">' + esc(r.why.short) + '</p>' + tags(r.why, o) + '</div>';
  }

  function statusPill(status) {
    var s = STATUS[status];
    return s ? '<span class="pill pill--' + status + '">' + icon(s.icon, 13, 2) + '<span>' + s.label + '</span></span>' : '';
  }

  function shelfControl(b, state, o) {
    o = o || {};
    var entry = E.entry(state, b.id);
    var st = entry && entry.status;
    var wantLabel = o.short ? 'Want to Read' : 'Add to Want to Read';
    if (!st) {
      return '<div class="shelf-ctl">' +
        '<button type="button" class="btn btn--primary btn--sm" data-action="status" data-book="' + b.id + '" data-status="want">' + icon('plus', 15, 2) + '<span>' + wantLabel + '</span></button>' +
        '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-action="status-menu" data-book="' + b.id + '" aria-haspopup="menu" aria-label="More shelf options for ' + esc(b.title) + '">' + icon('chevron-down', 16) + '</button>' +
        '</div>';
    }
    var label = STATUS[st].label + (st === 'reading' ? ' · ' + Math.round(entry.progress || 0) + '%' : '');
    return '<div class="shelf-ctl is-set"><button type="button" class="btn btn--soft btn--sm is-' + st + '" data-action="status-menu" data-book="' + b.id + '" aria-haspopup="menu">' +
      icon(STATUS[st].icon, 15, 2) + '<span>' + label + '</span>' + icon('chevron-down', 14) + '</button></div>';
  }

  function progress(value, o) {
    o = o || {};
    value = Math.round(value || 0);
    return '<div class="progress' + (o.cls ? ' ' + o.cls : '') + '">' + bar(value, null, 'bar--progress') + '<span class="progress__val">' + value + '%</span></div>';
  }

  function avatar(user, o) {
    o = o || {};
    return '<span class="avatar' + (o.cls ? ' ' + o.cls : '') + '" aria-hidden="true">' + esc(user.initials) + '</span>';
  }

  function sectionHead(o) {
    return '<header class="shead">' +
      '<div class="shead__text">' +
      (o.no ? '<span class="shead__no" aria-hidden="true">' + o.no + '</span>' : '') +
      (o.kicker ? '<p class="shead__kicker">' + o.kicker + '</p>' : '') +
      '<h2 class="shead__title">' + o.title + '</h2>' +
      (o.sub ? '<p class="shead__sub">' + o.sub + '</p>' : '') +
      '</div>' +
      (o.extra ? '<div class="shead__extra">' + o.extra + '</div>' : '') +
      (o.href ? '<a class="shead__more link-arrow" href="' + o.href + '"><span>' + esc(o.more || 'See all') + '</span>' + icon('arrow-right', 16) + '</a>' : '') +
      '</header>';
  }

  function chips(list, activeId, action, o) {
    o = o || {};
    return '<div class="chips' + (o.cls ? ' ' + o.cls : '') + '" role="group"' + (o.label ? ' aria-label="' + esc(o.label) + '"' : '') + '>' +
      list.map(function (c) {
        var on = c.id === activeId;
        return '<button type="button" class="chip' + (on ? ' is-active' : '') + '" data-action="' + action + '"' + (o.key ? ' data-key="' + o.key + '"' : '') +
          ' data-value="' + esc(c.id) + '" aria-pressed="' + on + '">' + (c.html || esc(c.label)) + '</button>';
      }).join('') + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Signals: the three intelligence spaces                              */
  /* ------------------------------------------------------------------ */
  function signalMix(m, o) {
    o = o || {};
    var rows = [
      { key: 'collaborative', name: 'Collaborative', note: 'Readers with similar shelves loved it', val: m.collaborative },
      { key: 'semantic', name: 'Semantic', note: 'Its reviews echo books you rated highly', val: m.semantic },
      { key: 'interpretable', name: 'Interpretable', note: 'It fits your 12 literary aspects', val: m.interpretable }
    ];
    return '<div class="signals' + (o.cls ? ' ' + o.cls : '') + '">' + rows.map(function (r, i) {
      return '<div class="signal signal--' + r.key + '"><span class="signal__no">0' + (i + 1) + '</span><span class="signal__name">' + r.name + '</span>' +
        bar(r.val) + '<span class="signal__val">' + r.val + '</span>' + (o.notes === false ? '' : '<span class="signal__note">' + r.note + '</span>') + '</div>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Cards                                                               */
  /* ------------------------------------------------------------------ */
  function bookHref(b) { return '#/book/' + b.id; }

  function cardMeta(b) {
    return '<p class="card__meta"><span>' + esc(b.genres[0]) + '</span></p>';
  }

  function pagesLabel(b) { return '<span class="card__pages">' + b.pages + ' pages</span>'; }

  /** Vertical recommendation card (Home rails). */
  function recCard(r, state, o) {
    o = o || {};
    var b = r.book;
    var full = o.density !== 'compact';
    return '<article class="card card--rec' + (full ? '' : ' card--compact') + (o.cls ? ' ' + o.cls : '') + '" data-book="' + b.id + '" data-kind="' + r.kind + '" style="--i:' + (o.i || 0) + '">' +
      '<a class="card__cover" href="' + bookHref(b) + '" aria-label="Open ' + esc(b.title) + '">' + cover(b, { size: o.coverSize || 'md' }) + match(r.m.score, { cls: 'match--badge' }) + '</a>' +
      '<div class="card__body">' + cardMeta(b) +
      '<h3 class="card__title"><a href="' + bookHref(b) + '">' + esc(b.title) + '</a></h3>' +
      '<p class="card__author">' + esc(b.author) + '</p>' +
      '<p class="card__rating">' + stars(b.rating) + '<b>' + b.rating.toFixed(1) + '</b>' + pagesLabel(b) + '</p>' +
      (full ? why(r) : '<p class="card__bridge">' + esc(r.bridge || r.why.short) + '</p>' + tags(r.why)) +
      '<div class="card__actions">' + shelfControl(b, state, { short: !full }) + '</div></div></article>';
  }

  /** Wide card with aspect bars (Recommendations page). */
  function recWide(r, state, o) {
    o = o || {};
    var b = r.book;
    return '<article class="card card--wide" data-book="' + b.id + '" data-kind="' + r.kind + '" style="--i:' + (o.i || 0) + '">' +
      '<a class="card__cover" href="' + bookHref(b) + '" aria-label="Open ' + esc(b.title) + '">' + cover(b, { size: 'md' }) + '</a>' +
      '<div class="card__body">' +
      '<div class="card__head"><div>' + cardMeta(b) + '<h3 class="card__title"><a href="' + bookHref(b) + '">' + esc(b.title) + '</a></h3>' +
      '<p class="card__author">' + esc(b.author) + '</p>' +
      '<p class="card__rating">' + stars(b.rating) + '<b>' + b.rating.toFixed(1) + '</b>' + pagesLabel(b) + '<span class="card__genres">' + esc(b.genres.join(' · ')) + '</span></p></div>' +
      match(r.m.score, { cls: 'match--lg' }) + '</div>' +
      (r.bridge ? '<p class="card__bridge">' + esc(r.bridge) + '</p>' : '') +
      '<div class="card__split"><div class="card__aspects"><span class="label">Literary aspects</span>' + aspectChart(b, r.why.chart) + '</div>' +
      '<div class="card__why">' + why(r) + '</div></div>' +
      '<div class="card__actions">' + shelfControl(b, state) + '<a class="btn btn--ghost btn--sm" href="' + bookHref(b) + '"><span>Details</span>' + icon('arrow-right', 15) + '</a></div>' +
      '</div></article>';
  }

  /** Large explainable card (next reads, top pick #1). */
  function featureRec(r, state, o) {
    o = o || {};
    var b = r.book;
    var reasons = r.why.reasons.map(function (x) {
      return '<li class="plus"><span class="plus__icon">' + icon('plus', 14, 2.4) + '</span><span class="plus__text">' + esc(x.text) + '</span><b>' + sign(x.delta) + '</b></li>';
    }).join('');
    var mism = r.why.mismatches.map(function (x) {
      return '<li class="minus"><span class="minus__icon">' + icon('minus', 14, 2.4) + '</span><span class="minus__text">' + esc(x.text) + '</span><b>' + sign(x.delta) + '</b></li>';
    }).join('');
    return '<article class="card card--feature" data-book="' + b.id + '" data-kind="' + r.kind + '" style="--i:' + (o.i || 0) + '">' +
      (o.rank ? '<span class="card__rank" aria-hidden="true">' + o.rank.replace(/^0/, '0') + '</span>' : '') +
      '<a class="card__cover" href="' + bookHref(b) + '" aria-label="Open ' + esc(b.title) + '">' + cover(b, { size: 'lg' }) + '</a>' +
      '<div class="card__body">' +
      '<div class="card__head"><div>' + cardMeta(b) + '<h3 class="card__title"><a href="' + bookHref(b) + '">' + esc(b.title) + '</a></h3>' +
      '<p class="card__author">' + esc(b.author) + '</p>' +
      '<p class="card__rating">' + stars(b.rating) + '<b>' + b.rating.toFixed(1) + '</b>' + pagesLabel(b) + '<span class="card__genres">' + esc(b.genres.join(' · ')) + '</span></p></div>' +
      match(r.m.score, { cls: 'match--lg' }) + '</div>' +
      (r.bridge ? '<p class="card__bridge">' + esc(r.bridge) + '</p>' : '') +
      '<div class="card__split">' +
      '<div class="card__reasons"><span class="label">Why it matches</span><ul class="plus-list">' + reasons + '</ul>' +
      (mism ? '<span class="label label--neg">Potential mismatch</span><ul class="minus-list">' + mism + '</ul>' : '') + '</div>' +
      '<div class="card__aspects"><span class="label">Literary aspects</span>' + aspectChart(b, r.why.chart) + '</div></div>' +
      '<p class="card__spoiler">' + icon('shield', 14) + '<span>Spoiler-safe explanation, built only from your shelves and reader reviews.</span></p>' +
      '<div class="card__actions">' + shelfControl(b, state) + '<a class="btn btn--ghost btn--sm" href="' + bookHref(b) + '"><span>See the full breakdown</span>' + icon('arrow-right', 15) + '</a></div>' +
      '</div></article>';
  }

  /** Small card for finished books and search-like lists. */
  function miniCard(b, state, o) {
    o = o || {};
    var entry = E.entry(state, b.id);
    var rated = entry && entry.rating;
    return '<article class="mini" data-book="' + b.id + '" style="--i:' + (o.i || 0) + '">' +
      '<a class="mini__cover" href="' + bookHref(b) + '" aria-label="Open ' + esc(b.title) + '">' + cover(b, { size: 'md' }) + '</a>' +
      '<div class="mini__body"><h3 class="mini__title"><a href="' + bookHref(b) + '">' + esc(b.title) + '</a></h3><p class="mini__author">' + esc(b.author) + '</p>' +
      (rated ? '<p class="mini__rating">' + stars(rated) + '<b>' + Number(rated).toFixed(1) + '</b></p>' : '') +
      (o.note ? '<p class="mini__note">' + esc(o.note) + '</p>' : '') + '</div></article>';
  }

  /** Reading tracker card (My Books). */
  function shelfCard(b, entry, state, o) {
    o = o || {};
    var st = entry.status;
    var rating = entry.rating || 0;
    var body;
    if (st === 'reading') {
      body = '<div class="book__status">' + statusPill('reading') + '<span class="book__when">Started ' + U.ago(entry.startedAt || Date.now()) + '</span></div>' +
        progress(entry.progress || 0) +
        '<div class="book__actions"><button type="button" class="btn btn--primary btn--sm" data-action="progress" data-book="' + b.id + '">' + icon('book-open', 15, 2) + '<span>Continue Reading</span></button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-action="review" data-book="' + b.id + '">' + icon('pen', 15, 2) + '<span>Add Review</span></button>' +
        '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-action="status-menu" data-book="' + b.id + '" aria-label="Change status for ' + esc(b.title) + '">' + icon('more', 18) + '</button></div>';
    } else if (st === 'read') {
      body = '<div class="book__status">' + statusPill('read') + '<span class="book__when">Finished ' + U.ago(entry.finishedAt || Date.now()) + '</span></div>' +
        '<div class="book__rating">' + rateWidget(b.id, rating) + '</div>' +
        '<div class="book__actions"><button type="button" class="btn btn--ghost btn--sm" data-action="review" data-book="' + b.id + '">' + icon('pen', 15, 2) + '<span>' + (state.reviews && state.reviews[b.id] ? 'Edit Review' : 'Add Review') + '</span></button>' +
        '<a class="btn btn--ghost btn--sm" href="' + bookHref(b) + '"><span>Book DNA</span>' + icon('arrow-right', 15) + '</a>' +
        '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-action="status-menu" data-book="' + b.id + '" aria-label="Change status for ' + esc(b.title) + '">' + icon('more', 18) + '</button></div>';
    } else {
      body = '<div class="book__status">' + statusPill('want') + '<span class="book__when">Added ' + U.ago(entry.addedAt || Date.now()) + '</span></div>' +
        '<p class="book__hook">' + esc(b.tagline) + '</p>' +
        '<div class="book__actions"><button type="button" class="btn btn--primary btn--sm" data-action="status" data-book="' + b.id + '" data-status="reading">' + icon('book-open', 15, 2) + '<span>Start Reading</span></button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-action="status" data-book="' + b.id + '" data-status="none">' + icon('x', 15, 2) + '<span>Remove</span></button>' +
        '<button type="button" class="btn btn--ghost btn--icon btn--sm" data-action="status-menu" data-book="' + b.id + '" aria-label="Change status for ' + esc(b.title) + '">' + icon('more', 18) + '</button></div>';
    }
    return '<article class="book book--' + st + '" data-book="' + b.id + '" style="--i:' + (o.i || 0) + '">' +
      '<a class="book__cover" href="' + bookHref(b) + '" aria-label="Open ' + esc(b.title) + '">' + cover(b, { size: 'md' }) + '</a>' +
      '<div class="book__body"><div class="book__top"><h3 class="book__title"><a href="' + bookHref(b) + '">' + esc(b.title) + '</a></h3>' +
      '<p class="book__author">' + esc(b.author) + '</p></div>' + body + '</div></article>';
  }

  /* ------------------------------------------------------------------ */
  /* Radar and ring                                                      */
  /* ------------------------------------------------------------------ */
  function radar(values, o) {
    o = o || {};
    var W = 480; var H = 420; var cx = 240; var cy = 210; var R = o.r || 128;
    var n = E.KEYS.length;
    function pt(i, v, k) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      var r = R * (v / 100) * (k || 1);
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }
    function poly(vals) {
      return E.KEYS.map(function (key, i) { var p = pt(i, vals[key]); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    }
    var rings = [25, 50, 75, 100].map(function (lvl) {
      var ring = E.KEYS.map(function (key, i) { var p = pt(i, lvl); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
      return '<polygon class="radar__ring" points="' + ring + '"/>';
    }).join('');
    var axes = E.KEYS.map(function (key, i) { var p = pt(i, 100); return '<line class="radar__axis" x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>'; }).join('');
    var labels = o.labels === false ? '' : E.KEYS.map(function (key, i) {
      var p = pt(i, 100, 1.13);
      var anchor = p[0] < cx - 8 ? 'end' : (p[0] > cx + 8 ? 'start' : 'middle');
      return '<text class="radar__label" x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(E.ASPECT[key].label) + '</text>';
    }).join('');
    var dots = E.KEYS.map(function (key, i) { var p = pt(i, values[key]); return '<circle class="radar__dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.4"/>'; }).join('');
    var vb = o.labels === false ? '86 56 308 308' : '0 0 ' + W + ' ' + H;
    return '<svg class="radar' + (o.cls ? ' ' + o.cls : '') + '" viewBox="' + vb + '" role="img" aria-label="' + esc(o.label || 'Reader DNA radar chart') + '">' +
      rings + axes + (o.overlay ? '<polygon class="radar__poly radar__poly--overlay" points="' + poly(o.overlay) + '"/>' : '') +
      '<polygon class="radar__poly" points="' + poly(values) + '"/>' + dots + labels + '</svg>';
  }

  function ring(value, o) {
    o = o || {};
    return '<span class="ring' + (o.cls ? ' ' + o.cls : '') + '" style="--v:' + value + '"><span class="ring__track"></span><span class="ring__num">' + (o.text || Math.round(value)) +
      (o.unit ? '<small>' + o.unit + '</small>' : '') + '</span></span>';
  }

  LS.ui = {
    STATUS: STATUS, ICONS: ICONS, icon: icon, motif: motif, cover: cover, coverUrl: coverUrl,
    stars: stars, rateWidget: rateWidget, match: match, bar: bar, aspectRow: aspectRow, aspectChart: aspectChart,
    tag: tag, tags: tags, why: why, statusPill: statusPill, shelfControl: shelfControl, progress: progress,
    avatar: avatar, sectionHead: sectionHead, chips: chips, signalMix: signalMix, bookHref: bookHref, sign: sign,
    recCard: recCard, recWide: recWide, featureRec: featureRec, miniCard: miniCard, shelfCard: shelfCard,
    radar: radar, ring: ring
  };
})(window);
