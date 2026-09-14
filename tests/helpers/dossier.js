'use strict';

/**
 * The Dossier, mounted the way a browser mounts it.
 *
 *   const page = dossierIn(t, { manifest: courseIn({ lang: 'pt-BR' }) });
 *   await settle();                        // the health probe, if it makes one
 *   page.text('.tutor-status');
 *
 * It is the one page in a Workspace the bootstrap does not load. The cover
 * reads the course manifest itself and carries its own script inline, so this
 * runs `assets/units.js` the way the page's own tag does and then the inline
 * script — against a scaffolded Workspace's `assets/`, which is what a Learner
 * would actually be served.
 *
 * `served` is the seam that matters, and it is the whole reason this exists
 * rather than the cover being read as text. Which requests a page in either
 * reading may make is `helpers/origin.js`'s answer rather than this file's, so
 * the two fixtures standing in for the service refuse the same set. A page the service is serving may
 * ask it whether it is up; a page opened from disk may not, because a request
 * from `file:` to the service's origin is one the browser refuses to make. So
 * the two readings are mounted separately, and `probes` — every address the
 * cover asked for — is what makes "it asked nothing at all" a claim.
 *
 * The port is deliberately not the one the cover used to hard-code. A relative
 * address is right on any port; an absolute one is right on exactly one, and
 * this fixture is where that difference shows up.
 */

const { Workspace } = require('./workspace.js');
const { Page } = require('./dom.js');
const { BLOCKED, reachable } = require('./origin.js');

/** A port nobody wrote down, which is the point of it. */
const PORT = 39117;

/** What the service answers a health probe with, as `server.js` shapes it. */
const HEALTHY = { ok: true, uptimeSec: 900, idleTimeoutSec: 7200 };

/**
 * What the fixture course calls itself, and the one document it lists. Named
 * here rather than written out again in a test: a check that retyped either
 * would be asserting against its own copy of the fixture instead of against
 * what the cover was handed.
 */
const TITLE = 'Shells, end to end';
const DOCS = [{ path: 'CURRICULUM.md', label: 'Curriculum', note: 'How far along' }];

/**
 * A course manifest, as `assets/units.js` states one.
 *
 * No subtitle and no thesis, and that is on purpose: those two are authored
 * HTML the cover splices into the page, and splicing markup is the one thing
 * the fixture DOM refuses — a shipped script must build nodes. Everything this
 * fixture is for is built out of nodes: the language, the Unit list, the
 * documents, and the line saying what the cover can and cannot see of the
 * service.
 */
function courseIn({ lang = 'en', title = TITLE, units = [] } = {}) {
  return (
    `window.TEACH_COURSE = ${JSON.stringify({ lang, title })};\n`
    + `window.TEACH_UNITS = ${JSON.stringify(units)};\n`
    + `window.TEACH_DOCS = ${JSON.stringify(DOCS)};\n`
    + 'window.TEACH_REFS = [];\n'
  );
}

/**
 * That cover, in a Workspace scaffolded the way a Learner's is.
 *
 * `health` is asked per probe and answers the way the service does — a body, or
 * `false` for a service that is not running and refuses the connection.
 */
function dossierIn(t, { manifest = courseIn(), health = () => HEALTHY, served = true } = {}) {
  const ws = Workspace.create(t);
  ws.scaffold();
  ws.write('assets/units.js', manifest);

  const probes = [];

  // The one statement of where this page is. What the browser would let it ask
  // for is then read off that, rather than decided a second time from `served`
  // — two answers to one question are two answers that can drift apart.
  const location = served
    ? { protocol: 'http:', pathname: '/index.html', href: `http://localhost:${PORT}/index.html` }
    : { protocol: 'file:', pathname: '/Workspaces/shells/index.html', href: 'file:///Workspaces/shells/index.html' };

  const page = Page.load(ws.read('index.html'), ws.path('assets'), {
    globals: {
      location,
      fetch(url) {
        probes.push(url);
        // The browser, not the service: a request it would refuse is refused
        // here, before anything on the far side of it is consulted.
        if (!reachable(location.protocol, url)) return Promise.reject(new Error(BLOCKED));
        const up = health();
        return up
          ? Promise.resolve({ ok: true, json: () => Promise.resolve(up) })
          : Promise.reject(new Error('service is not running'));
      },
    },
  });

  page.probes = probes;
  page.workspace = ws;
  page.script('units.js');
  page.inline();
  return page;
}

module.exports = { DOCS, HEALTHY, TITLE, courseIn, dossierIn };
