/**
 * lesson-boot.js — the only infrastructure line a lesson needs.
 *
 *   <script src="../assets/lesson-boot.js" data-unit="0003"></script>
 *
 * Loads the nav bar, the tutor widget, the string tables and the unit manifest,
 * in the right order, with paths resolved relative to this file rather than to
 * the page. Put it last in <body>.
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

  /**
   * Give the page the workspace's language, when the page did not state one.
   *
   * `<html lang>` stays the single authority — components read it, and so does
   * the browser. But a per-page attribute is a discipline, and a forgotten
   * discipline fails silently: a learner would get a screen in somebody else's
   * language with nothing erroring. The manifest is the one file every page
   * already loads, so it is where the workspace says this once.
   */
  function applyLanguage() {
    var page = document.documentElement;
    if (!page || page.getAttribute('lang')) return; // the page declared its own
    var course = window.TEACH_COURSE;
    if (course && course.lang) page.setAttribute('lang', course.lang);
  }

  // Sequential: units.js defines the manifest nav.js reads, it also carries the
  // language every later script renders in, and tutor.js renders its answers
  // with rich-text.js. So order matters, and `then` is how a step that has to
  // happen *between* two files gets to.
  function chain(specs) {
    var spec = specs.shift();
    if (!spec) return;
    var s = document.createElement('script');
    s.src = root + spec.src;
    if (spec.unit && unit) s.setAttribute('data-unit', unit);
    var next = function () {
      if (spec.then) spec.then();
      chain(specs);
    };
    s.onload = next;
    s.onerror = next; // One missing component must not block the rest.
    document.body.appendChild(s);
  }

  css('assets/nav.css');
  css('assets/tutor.css');

  // strings.js is the workspace's own table and may not exist yet — an older
  // workspace simply has not been scaffolded since it was introduced. `onerror`
  // carries on, and learner-text.js falls back to the tables it ships.
  chain([
    { src: 'assets/units.js', then: applyLanguage },
    { src: 'assets/strings.js' },
    { src: 'assets/learner-text.js' },
    { src: 'assets/nav.js', unit: true },
    { src: 'assets/rich-text.js' },
    { src: 'assets/tutor.js' },
  ]);
})();
