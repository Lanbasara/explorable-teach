/**
 * lesson-boot.js — the only infrastructure line a lesson needs.
 *
 *   <script src="../assets/lesson-boot.js" data-unit="0003"></script>
 *
 * Loads the nav bar, the tutor widget, and the unit manifest, in the right
 * order, with paths resolved relative to this file rather than to the page.
 * Put it last in <body>.
 *
 * The point is that lesson authors never wire infrastructure by hand. Adding a
 * future page-wide component means editing this file — not every lesson.
 *
 * data-unit is the one genuinely per-page value. Omit it on pages that are not
 * part of a unit; the nav bar degrades to just the dossier link.
 */
(function () {
  'use strict';

  var self = document.currentScript;
  if (!self) return; // No currentScript => ancient browser; lesson still reads fine.

  var unit = self.getAttribute('data-unit') || '';
  var root = self.src.replace(/assets\/lesson-boot\.js.*$/, ''); // "../" from lessons/

  function css(href) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = root + href;
    document.head.appendChild(l);
  }

  // Sequential: units.js defines the manifest nav.js reads, and tutor.js
  // renders its answers with rich-text.js, so order matters.
  function chain(specs) {
    var spec = specs.shift();
    if (!spec) return;
    var s = document.createElement('script');
    s.src = root + spec.src;
    if (spec.unit && unit) s.setAttribute('data-unit', unit);
    s.onload = function () { chain(specs); };
    s.onerror = function () { chain(specs); }; // One missing component must not block the rest.
    document.body.appendChild(s);
  }

  css('assets/nav.css');
  css('assets/tutor.css');

  chain([
    { src: 'assets/units.js' },
    { src: 'assets/nav.js', unit: true },
    { src: 'assets/rich-text.js' },
    { src: 'assets/tutor.js' },
  ]);
})();
