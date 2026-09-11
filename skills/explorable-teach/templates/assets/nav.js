/* nav.js — thin cross-page navigation bar.
 *
 * Deps: units.js (must load first), nav.css. No server, no fetch: works
 * identically from file:// and http://.
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
  bar.setAttribute('aria-label', '课程导航');
  var inner = el('div', 'tnav-inner');
  bar.appendChild(inner);

  inner.appendChild(link('index.html', 'tnav-home', '← 卷宗', '回到课程总览'));
  inner.appendChild(el('span', 'tnav-unit', unit.num));

  // Sibling artifacts of this unit. Present -> link (or mark as current);
  // absent -> show greyed so the learner knows it simply does not exist yet.
  var sibs = el('div', 'tnav-sibs');
  [
    { key: 'lesson',     label: '正文' },
    { key: 'checkpoint', label: '验收' },
    { key: 'assignment', label: '作业' }
  ].forEach(function (s) {
    var path = unit[s.key];
    if (!path) {
      sibs.appendChild(el('span', 'tnav-off', s.label)).title = '这一课还没有' + s.label;
      return;
    }
    if (basename(path) === here) {
      var cur = el('span', 'tnav-here', s.label);
      cur.setAttribute('aria-current', 'page');
      sibs.appendChild(cur);
    } else {
      sibs.appendChild(link(path, '', s.label, unit.num + ' · ' + s.label));
    }
  });
  inner.appendChild(sibs);

  inner.appendChild(el('div', 'tnav-spacer'));

  var prev = neighbour(-1), next = neighbour(1);
  if (prev) {
    inner.appendChild(link(prev.lesson, 'tnav-step', '← ' + prev.num, prev.title));
  } else {
    inner.appendChild(el('span', 'tnav-step disabled', '← ' + '起点'));
  }
  if (next) {
    inner.appendChild(link(next.lesson, 'tnav-step', next.num + ' →', next.title));
  } else {
    inner.appendChild(el('span', 'tnav-step disabled', '下一课待写 →'));
  }

  function mount() {
    if (document.body.firstChild) document.body.insertBefore(bar, document.body.firstChild);
    else document.body.appendChild(bar);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
