'use strict';

/**
 * What a browser does with a request, rather than what a service would do with
 * it — the one rule, in one place.
 *
 *   reachable('http:', '/api/health')   // true
 *   reachable('file:', '/api/health')   // false, and so is every other address
 *   reachable('http:', 'http://127.0.0.1:4173/api/health')  // false
 *
 * Two fixtures stand in for the service — the Lesson drawer's and the Dossier's
 * — and both have to refuse the same set, or one of them answers a request the
 * browser would never have let out. That is the defect decision 33 is about:
 * the cover asked the service across origins, the browser blocked it, and the
 * cover read the block as an answer from the service.
 *
 * A page may ask its own origin and nothing else. A relative address from a
 * served page stays home; an absolute one names an origin, and a page opened
 * from disk has no origin a service can be on, so every address from one is
 * refused.
 */
function reachable(protocol, url) {
  return /^https?:$/.test(protocol) && url.startsWith('/');
}

/** What a refused request fails with, so both fixtures fail it the same way. */
const BLOCKED = 'blocked: this page is not served by that origin';

module.exports = { BLOCKED, reachable };
