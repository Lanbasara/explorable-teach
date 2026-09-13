/* nav.js — thin cross-page navigation bar.
 *
 * Deps: units.js (must load first), nav.css, and the string table at the head
 * of lesson-boot.js, which loads this file after both. No server, no fetch:
 * works identically from file:// and http://.
 *
 * Usage — the page declares only its own unit id:
 *   <link rel="stylesheet" href="../assets/nav.css">
 *   <script src="../assets/units.js"></script>
 *   <script src="../assets/nav.js" data-unit="0000"></script>
 *
 * Everything else (root path, prev/next, sibling artifacts, which one is the
 * current page) is derived. Authors never write a link list.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  /** What this page says for `key`, in the learner's language. */
  function say(key, values) {
    return window.LearnerText.say(key, values);
  }

  var unitId = script.getAttribute('data-unit') || '';
  var units = window.TEACH_UNITS || [];
  if (!units.length) return;

  // Root prefix comes from how this script was referenced:
  //   "../assets/nav.js" -> "../"   |   "assets/nav.js" -> ""
  var root = (script.getAttribute('src') || '').replace(/assets\/nav\.js.*$/, '');

  var idx = -1;
  for (var i = 0; i < units.length; i++) {
    if (units[i].id === unitId) { idx = i; break; }
  }
  if (idx < 0) return;
  var unit = units[idx];

  function basename(p) { return String(p || '').split('/').pop().split('?')[0]; }
  var here = decodeURIComponent(basename(location.pathname));

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function link(href, cls, text, title) {
    var a = el('a', cls, text);
    a.href = root + href;
    if (title) a.title = title;
    return a;
  }

  // Nearest unit in `dir` that actually has a lesson file written.
  function neighbour(dir) {
    for (var j = idx + dir; j >= 0 && j < units.length; j += dir) {
      if (units[j].lesson) return units[j];
    }
    return null;
  }

  var bar = el('nav', 'tnav');
  bar.setAttribute('aria-label', say('nav.aria'));
  var inner = el('div', 'tnav-inner');
  bar.appendChild(inner);

  inner.appendChild(link('index.html', 'tnav-home', say('nav.dossier'), say('nav.dossier.title')));
  inner.appendChild(el('span', 'tnav-unit', unit.num));

  // Sibling artifacts of this unit. Present -> link (or mark as current);
  // absent -> show greyed so the learner knows it simply does not exist yet.
  var sibs = el('div', 'tnav-sibs');
  ['lesson', 'checkpoint', 'assignment'].forEach(function (key) {
    var label = say('nav.' + key);
    var path = unit[key];
    if (!path) {
      sibs.appendChild(el('span', 'tnav-off', label)).title = say('nav.missing', { artifact: label });
      return;
    }
    if (basename(path) === here) {
      var cur = el('span', 'tnav-here', label);
      cur.setAttribute('aria-current', 'page');
      sibs.appendChild(cur);
    } else {
      sibs.appendChild(link(path, '', label, say('nav.sibling.title', { unit: unit.num, artifact: label })));
    }
  });
  inner.appendChild(sibs);

  inner.appendChild(el('div', 'tnav-spacer'));

  var prev = neighbour(-1), next = neighbour(1);
  if (prev) {
    inner.appendChild(link(prev.lesson, 'tnav-step', say('nav.prev', { unit: prev.num }), prev.title));
  } else {
    inner.appendChild(el('span', 'tnav-step disabled', say('nav.start')));
  }
  if (next) {
    inner.appendChild(link(next.lesson, 'tnav-step', say('nav.next', { unit: next.num }), next.title));
  } else {
    inner.appendChild(el('span', 'tnav-step disabled', say('nav.unwritten')));
  }

  function mount() {
    if (document.body.firstChild) document.body.insertBefore(bar, document.body.firstChild);
    else document.body.appendChild(bar);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
