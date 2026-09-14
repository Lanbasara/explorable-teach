/* ============================================================
   page-checks.js — the pass a Teacher runs over a Lesson it has just written
   Deps: none. The page, the window and the session's own records are arguments.
   Used by: the Teacher, from a browser session. Never installed into a Workspace.
   ============================================================ */

/**
 * A Lesson is handed over having been *looked at*, and this is what looking at
 * it means. Seven checks, cheap enough to run on every Lesson, each answering
 * one question a broken page answers wrongly: did anything complain, did
 * anything fail to load, is there something in the canvas, is the animation
 * moving, is anything off the page, is any label covered, can the text be read.
 *
 *   Teacher, in a browser session, on the *served* address:
 *
 *     1. evaluate this file in the page, then `await PageChecks.run({
 *        messages: <the session's console record>,
 *        requests: <the session's network record> })`
 *     2. read `ok` first, then every `findings` entry, then the `examined`
 *        field each check below names as the one that reveals it misreading
 *     3. take the screenshot last, and judge *appearance* from it — never
 *        correctness, which is what the seven checks above are for
 *
 * **This is light, and it is not a gate.** It catches a Lesson that is
 * *broken*. It does not catch a Lesson that is *wrong*, and it must not grow
 * into something that tries to: a Learner who hits something subtler has a
 * Tutor sitting in the page to ask, which is what the Tutor is for. Keep the
 * pass to what a browser session can do cheaply.
 *
 * **Every result is the same shape**, and everything in it is a string, a
 * number, a boolean, or a list or object of those — the whole report has to
 * cross out of the page as JSON, so nothing here ever hands back a node:
 *
 *     { check:    'canvasHasContent',   // the check's own name
 *       ok:       true | false | null,  // null: nothing here to judge
 *       summary:  'one line to read first',
 *       findings: [ … ],                // what failed; empty otherwise
 *       examined: [ … ],                // what it has something to say about,
 *                                       // one entry each, carrying the fields
 *                                       // that reveal a misread
 *       notes:    { … } }               // facts about the page, not about one thing
 *
 * `examined` is usually wider than `findings` — every canvas, every label,
 * every message. `nothingOffPage` is the one check where the two are the same
 * list, because the only thing it has to say about an element that is on the
 * page is that it is on the page; `notes.walked` and `notes.considered` are
 * how much it went through to find the ones that are not.
 *
 * `ok: null` is the answer that keeps this honest. A page with no canvas has
 * not *passed* the canvas check, and a check handed no console record has not
 * *passed* the console check — both have declined to answer, and a pass
 * reported for an absence is the failure mode a Teacher would act on.
 *
 * `run()` hands back `{ ok, summary, checks }` over all seven, and its `ok` is
 * three-valued for the same reason: `false` if any check found something,
 * `true` if at least one looked and was happy, and `null` if every one of them
 * declined — which is a page nothing here judged rather than a page that is fine.
 *
 * ## Where each check misleads
 *
 * Several of these report confidently and wrongly under a condition that is
 * known, and a check trusted while wrong is worse than no check: it sends the
 * Teacher to fix a defect that does not exist, or signs off a page that is
 * broken. So each one carries the condition, the direction it misleads in, and
 * the field in its own output that reveals it.
 *
 *   consoleErrors — did anything the page ran complain?
 *     Misleads when  the session was never asked for its console record, or
 *                    hands messages in with no level on them, so the level has
 *                    to be read out of the text.
 *     Direction      passes falsely — an empty record and a clean page are the
 *                    same answer here, and a real error printed without the
 *                    word in it is missed.
 *     Revealed by    `notes.handedIn`, and `examined[].level` reading
 *                    `'unknown'`.
 *
 *   failedRequests — did everything the page asked for arrive?
 *     Misleads when  the session started recording after the page loaded, or
 *                    the browser carries the operator's own extensions, whose
 *                    injected requests are recorded as the page's.
 *     Direction      both — a short record passes falsely, an extension's own
 *                    failure fails falsely.
 *     Revealed by    `notes.count` against the number of files the page loads,
 *                    and `examined[].url`, whose host says whose request it was.
 *
 *   canvasHasContent — is there anything in each `<canvas>`?
 *     Misleads when  a WebGL context was created without
 *                    `preserveDrawingBuffer`, which is the default. Reading the
 *                    canvas after the frame has been composited then yields a
 *                    *cleared* buffer rather than what was drawn, and a clear
 *                    colour with any opacity to it reads exactly like content.
 *     Direction      passes falsely — a page drawing nothing at all reports a
 *                    canvas full of one flat colour. The same cause fails the
 *                    animation check falsely, from the other end.
 *     Revealed by    `examined[].contextAttributes.preserveDrawingBuffer`
 *                    reading `false`, beside `examined[].distinctSamples`
 *                    reading `1`.
 *
 *   animationMoves — is the animation actually moving?
 *     Misleads when  the same missing drawing-buffer flag: both samples come
 *                    back cleared, so they are identical however hard the page
 *                    is animating.
 *     Direction      fails falsely — a working animation is reported still.
 *     Revealed by    `examined[].contextAttributes.preserveDrawingBuffer`
 *                    reading `false` while `notes.framesRequested` climbs,
 *                    which is a page that is plainly running and plainly not
 *                    being read. What it cannot read at all it declines on
 *                    rather than failing: an explorable animating the DOM or an
 *                    SVG leaves `examined` empty, and `notes.framesRequested`
 *                    is then the only sign the page was moving.
 *
 *   nothingOffPage — is anything sitting where it cannot be seen?
 *     Misleads when  something is parked off-screen on purpose: a panel that
 *                    slides in, a heading kept for a screen reader, anything
 *                    positioned against the viewport rather than the document.
 *     Direction      fails falsely.
 *     Revealed by    `findings[].position` reading `'fixed'` or `'absolute'`,
 *                    and `findings[].rect`, where a box a pixel or two across
 *                    is a screen-reader helper rather than lost content.
 *
 *   labelsVisible — is any label covered, or overlapping another?
 *     Misleads when  the thing on top ignores pointer events. The hit test
 *                    walks straight through an overlay with `pointer-events:
 *                    none` and hands back the label underneath, which is the
 *                    answer a clear page gives. Also when the page carries more
 *                    text than the sample reaches.
 *     Direction      passes falsely — and it is exactly the case that matters,
 *                    because the text underneath is genuinely invisible.
 *     Revealed by    `examined[].coveredBy` being non-empty while
 *                    `examined[].hit` reads `'self'`, and
 *                    `examined[].ignoringPointerEvents` naming the overlay.
 *                    `notes.truncated` is the other one: text past the sample
 *                    was never looked at.
 *
 *   textContrast — can the text be read against what is behind it?
 *     Misleads when  what is behind the text is not something a computed style
 *                    can report: a canvas painted underneath, a background
 *                    image, a gradient, a half-transparent stack. The check
 *                    then assumes the page is white, because it has to assume
 *                    something.
 *     Direction      both — light text on a dark canvas is reported
 *                    unreadable, dark text on a dark canvas is reported fine.
 *                    This is worst on exactly the dark-themed and canvas-backed
 *                    pages a Lesson is now free to be.
 *     Revealed by    `examined[].assumed` reading `true`, with
 *                    `examined[].assumedBecause` saying which of the four it
 *                    was — and `backgroundFrom` reading `null` in the case
 *                    where nothing in the page declared a background at all.
 *                    `notes.assumed` counts them, and `notes.truncated` says
 *                    when the page carried more text than the sample reached.
 *
 * ## Two hazards that belong to the browser rather than to the page
 *
 * **`--disable-gpu`** is pasted into headless invocations as a matter of habit.
 * It disables the graphics stack, so `getContext('webgl')` hands back nothing
 * at all and every canvas reads blank — which is indistinguishable here from a
 * Lesson that draws nothing. A canvas check failing on every canvas at once is
 * the shape of it; run the pass in a browser that has its graphics stack.
 *
 * **A browser carrying the operator's own extensions** injects requests and
 * mutates the markup of every page it opens. Those show up as the Lesson's
 * failed requests and the Lesson's stray elements, and none of them are the
 * Lesson's. Run the pass in a clean profile, and read the host on anything
 * `failedRequests` reports.
 *
 * ## What this file does to the page
 *
 * `animationMoves` wraps `requestAnimationFrame` for as long as it watches, to
 * find out whether the page is driving frames at all, and puts the original
 * back afterwards. Nothing else here writes to the page.
 *
 * A canvas is read with `toDataURL`, which does not bind a context type. Asking
 * for the context *does* — a canvas that has taken none is given a 2d one by
 * the asking, and a Lesson that binds WebGL when the learner presses play would
 * then never get it. So the context is asked for only once something is in the
 * canvas, which is the one cheap proof that a context is already there. An
 * empty canvas says so in `examined[].unread` rather than reporting a context
 * it was never allowed to look for.
 */
(function (root) {
  'use strict';

  /** How long `animationMoves` watches before sampling again. */
  var SAMPLE_MS = 600;

  /** Sample points across a canvas, per axis. */
  var GRID = 5;

  /** The bound on any walk over the page, so a check stays cheap. */
  var MAX_ELEMENTS = 600;

  /** The most labels a check will look at, and compare against each other. */
  var MAX_LABELS = 60;

  /** A box smaller than this is a screen-reader helper, not visible content. */
  var MIN_BOX = 2;

  /** WCAG AA, for ordinary text and for large text. */
  var AA_TEXT = 4.5;
  var AA_LARGE = 3;

  /* --------------------------------------------------------------- the shape */

  function result(name, ok, summary, findings, examined, notes) {
    return {
      check: name,
      ok: ok,
      summary: summary,
      findings: findings || [],
      examined: examined || [],
      notes: notes || {}
    };
  }

  /** Nothing here to judge, which is never the same answer as "fine". */
  function declined(name, why, notes) {
    return result(name, null, why, [], [], notes);
  }

  /**
   * The view a check reads, filled in from the page when a Teacher calls
   * `run()` bare. `messages` and `requests` stay null when nobody handed them
   * in, because an empty list and an unasked session have to be told apart.
   */
  function viewOf(view) {
    var given = view || {};
    return {
      document: given.document || (typeof document !== 'undefined' ? document : null),
      window: given.window || (typeof window !== 'undefined' ? window : null),
      messages: given.messages || null,
      requests: given.requests || null,
      sampleMs: typeof given.sampleMs === 'number' ? given.sampleMs : SAMPLE_MS
    };
  }

  /** A call into the browser that is documented to throw, made safe to make. */
  function attempt(fn) {
    try {
      return fn();
    } catch (e) {
      return null;
    }
  }

  function queryAll(doc, selector) {
    if (!doc || typeof doc.querySelectorAll !== 'function') return [];
    var found = attempt(function () { return doc.querySelectorAll(selector); });
    return found ? Array.prototype.slice.call(found) : [];
  }

  /** Every element on the page, bounded. `notes.truncated` says when it was. */
  function elementsIn(doc) {
    return queryAll(doc, '*').slice(0, MAX_ELEMENTS);
  }

  /** Something short enough to read and specific enough to find again. */
  function selectorFor(el) {
    if (!el || !el.tagName) return String(el);
    var name = String(el.tagName).toLowerCase();
    var id = el.getAttribute ? el.getAttribute('id') : null;
    if (id) return name + '#' + id;
    var classes = (el.getAttribute ? el.getAttribute('class') || '' : '').split(/\s+/);
    var used = [];
    for (var i = 0; i < classes.length && used.length < 3; i++) {
      if (classes[i]) used.push(classes[i]);
    }
    return used.length ? name + '.' + used.join('.') : name;
  }

  function styleOf(win, el) {
    if (!win || typeof win.getComputedStyle !== 'function') return null;
    return attempt(function () { return win.getComputedStyle(el); });
  }

  function num(value) {
    return typeof value === 'number' && isFinite(value) ? value : 0;
  }

  /** One element's box, in viewport coordinates, or null if it has none. */
  function boxOf(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    var rect = attempt(function () { return el.getBoundingClientRect(); });
    if (!rect) return null;
    var box = {
      top: num(rect.top),
      left: num(rect.left),
      width: num(rect.width),
      height: num(rect.height)
    };
    box.right = box.left + box.width;
    box.bottom = box.top + box.height;
    return box;
  }

  function isAncestor(maybe, el) {
    for (var at = el && el.parentNode; at; at = at.parentNode) {
      if (at === maybe) return true;
    }
    return false;
  }

  function related(a, b) {
    return a === b || isAncestor(a, b) || isAncestor(b, a);
  }

  function covers(box, x, y) {
    return box.left <= x && x <= box.right && box.top <= y && y <= box.bottom;
  }

  function overlap(a, b) {
    var wide = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    var tall = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return wide > MIN_BOX && tall > MIN_BOX;
  }

  /** Elements carrying text of their own, which is what a label is. */
  var NOT_TEXT = ['script', 'style', 'title', 'template', 'noscript'];

  function hasOwnText(el) {
    if (!el || !el.tagName) return false;
    if (NOT_TEXT.indexOf(String(el.tagName).toLowerCase()) !== -1) return false;
    var kids = el.childNodes || [];
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].nodeType === 3 && String(kids[i].nodeValue || '').trim()) return true;
    }
    return false;
  }

  /**
   * The labels on a page, up to the bound. The bound is part of the answer:
   * text past it is text neither check below ever looked at, so both report
   * `notes.truncated` rather than letting a sample read as the whole page.
   */
  function labelsIn(doc) {
    var found = [];
    var all = elementsIn(doc);
    for (var i = 0; i < all.length && found.length < MAX_LABELS; i++) {
      if (!hasOwnText(all[i])) continue;
      var box = boxOf(all[i]);
      if (box && box.width >= MIN_BOX && box.height >= MIN_BOX) {
        found.push({ el: all[i], box: box });
      }
    }
    return found;
  }

  /* ------------------------------------------------------- console, requests */

  var ERROR_LEVEL = /error|severe|exception|fatal/i;
  var ERROR_TEXT = /^\s*(uncaught|unhandled|error\b|failed to)/i;

  /** One message, however the session spells one. */
  function messageOf(entry) {
    if (entry == null) return { level: 'unknown', text: '' };
    if (typeof entry === 'string') return { level: 'unknown', text: entry };
    var level = entry.level || entry.type || entry.severity || entry.kind || 'unknown';
    var text = entry.text || entry.message || entry.value || '';
    if (!text && entry.args) text = [].concat(entry.args).join(' ');
    return { level: String(level), text: String(text) };
  }

  function consoleErrors(view) {
    var name = 'consoleErrors';
    view = viewOf(view);
    if (!view.messages) {
      return declined(name, 'no console record was handed in — ask the session for one', {
        handedIn: false,
        count: 0
      });
    }

    var examined = [].concat(view.messages).map(messageOf);
    var notes = { handedIn: true, count: examined.length };
    var findings = examined.filter(function (m) {
      return ERROR_LEVEL.test(m.level) || (m.level === 'unknown' && ERROR_TEXT.test(m.text));
    });

    return result(
      name,
      findings.length === 0,
      findings.length
        ? findings.length + ' of ' + examined.length + ' console messages are errors'
        : 'nothing the page ran complained',
      findings,
      examined,
      notes
    );
  }

  /** One request, however the session spells one. */
  function requestOf(entry) {
    if (entry == null) return { url: '', status: 0, failed: false, error: '' };
    if (typeof entry === 'string') return { url: entry, status: 0, failed: false, error: '' };
    return {
      url: String(entry.url || entry.request || ''),
      status: num(entry.status || entry.statusCode),
      failed: entry.failed === true || entry.success === false,
      error: String(entry.errorText || entry.error || '')
    };
  }

  function failedRequests(view) {
    var name = 'failedRequests';
    view = viewOf(view);
    if (!view.requests) {
      return declined(name, 'no network record was handed in — ask the session for one', {
        handedIn: false,
        count: 0
      });
    }

    var examined = [].concat(view.requests).map(requestOf);
    var notes = { handedIn: true, count: examined.length };
    var findings = examined.filter(function (r) {
      return r.failed || r.error !== '' || r.status >= 400;
    });

    return result(
      name,
      findings.length === 0,
      findings.length
        ? findings.length + ' of ' + examined.length + ' requests did not arrive'
        : 'every one of ' + examined.length + ' requests arrived',
      findings,
      examined,
      notes
    );
  }

  /* ------------------------------------------------------------------ canvas */

  /**
   * What a canvas holds, without binding it to a context type: `toDataURL`
   * works on a canvas that has never taken a context, and a canvas that has
   * never taken one is blank by definition.
   */
  function drawingOf(canvas) {
    return attempt(function () { return canvas.toDataURL(); });
  }

  function blankLike(doc, canvas) {
    return attempt(function () {
      var blank = doc.createElement('canvas');
      blank.width = canvas.width;
      blank.height = canvas.height;
      return blank.toDataURL();
    });
  }

  /**
   * The context a canvas is already using.
   *
   * **Only ever called on a canvas with something in it**, and that is a rule
   * rather than an optimisation: a canvas that has taken a context hands back
   * null for every *other* type, so asking is free — but a canvas that has
   * taken none is given a 2d one by the asking, and a Lesson that binds WebGL
   * when the learner presses play would then never get it. Something drawn is
   * the one cheap proof that a context is already there.
   */
  function contextOf(canvas) {
    var two = attempt(function () { return canvas.getContext('2d'); });
    if (two) return { kind: '2d', handle: two };
    var gl = attempt(function () {
      return canvas.getContext('webgl2') || canvas.getContext('webgl');
    });
    return gl ? { kind: 'webgl', handle: gl } : null;
  }

  /** What a canvas that refuses to be read is reported as, in either check. */
  var UNREADABLE = 'the canvas could not be read — it may be holding a cross-origin image';

  /**
   * Fill an entry's `context` and `contextAttributes` in, if there is anything
   * in the canvas to prove a context already exists. Hands the context back so
   * a caller that wants to sample it does not ask twice.
   */
  function describeContext(entry, canvas, drawn) {
    if (!drawn) {
      entry.unread = entry.unread || 'nothing is in this canvas, so its context was left alone';
      return null;
    }
    var context = contextOf(canvas);
    if (!context) return null;
    entry.context = context.kind;
    if (context.kind === 'webgl') entry.contextAttributes = attributesOf(context.handle);
    return context;
  }

  /** The attributes a WebGL context was created with, as plain values. */
  function attributesOf(gl) {
    var attrs = attempt(function () { return gl.getContextAttributes(); });
    if (!attrs) return null;
    return {
      alpha: attrs.alpha === true,
      antialias: attrs.antialias === true,
      premultipliedAlpha: attrs.premultipliedAlpha === true,
      preserveDrawingBuffer: attrs.preserveDrawingBuffer === true
    };
  }

  /** How many distinct colours a grid of sample points finds. */
  function distinctSamples(canvas, context) {
    var width = num(canvas.width);
    var height = num(canvas.height);
    if (!width || !height || !context) return null;

    var seen = {};
    var count = 0;
    for (var row = 0; row < GRID; row++) {
      for (var col = 0; col < GRID; col++) {
        var x = Math.floor(((col + 0.5) / GRID) * width);
        var y = Math.floor(((row + 0.5) / GRID) * height);
        var pixel = pixelAt(context, x, y);
        if (!pixel) return null;
        if (!seen[pixel]) { seen[pixel] = true; count++; }
      }
    }
    return count;
  }

  function pixelAt(context, x, y) {
    if (context.kind === '2d') {
      var data = attempt(function () { return context.handle.getImageData(x, y, 1, 1).data; });
      return data ? [data[0], data[1], data[2], data[3]].join(',') : null;
    }
    // The GL framebuffer's origin is bottom-left and a canvas's is top-left, so
    // this reads the mirrored row. That is deliberate: the only question asked
    // of these samples is how many distinct colours they are, and a grid read
    // upside down holds the same set.
    var gl = context.handle;
    var buffer = attempt(function () {
      var out = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
      return out;
    });
    return buffer ? [buffer[0], buffer[1], buffer[2], buffer[3]].join(',') : null;
  }

  function canvasHasContent(view) {
    var name = 'canvasHasContent';
    view = viewOf(view);
    var doc = view.document;
    var canvases = queryAll(doc, 'canvas');
    if (!canvases.length) return declined(name, 'this page has no canvas on it', { count: 0 });

    var examined = canvases.map(function (canvas) {
      var entry = {
        selector: selectorFor(canvas),
        width: num(canvas.width),
        height: num(canvas.height),
        drawn: null,
        distinctSamples: null,
        context: null,
        contextAttributes: null,
        unread: ''
      };

      var drawing = drawingOf(canvas);
      var blank = blankLike(doc, canvas);
      if (drawing == null || blank == null) {
        entry.unread = UNREADABLE;
        return entry;
      }
      entry.drawn = drawing !== blank;

      var context = describeContext(entry, canvas, entry.drawn);
      if (context) entry.distinctSamples = distinctSamples(canvas, context);
      return entry;
    });

    var findings = examined.filter(function (e) { return e.drawn === false; });
    var drew = examined.filter(function (e) { return e.drawn === true; });
    var ok = findings.length ? false : (drew.length ? true : null);

    return result(
      name,
      ok,
      findings.length
        ? findings.length + ' of ' + examined.length + ' canvases have nothing in them'
        : drew.length
          ? 'every one of ' + examined.length + ' canvases has something in it'
          : 'no canvas here could be read',
      findings,
      examined,
      { count: examined.length }
    );
  }

  /* --------------------------------------------------------------- animation */

  function waitFor(win, ms) {
    return new Promise(function (resolve) {
      if (!ms) return resolve(false);
      if (win && typeof win.setTimeout === 'function') {
        win.setTimeout(function () { resolve(true); }, ms);
        return;
      }
      if (typeof setTimeout === 'function') {
        setTimeout(function () { resolve(true); }, ms);
        return;
      }
      resolve(false);
    });
  }

  /** The animations the page itself says are running, where the browser says. */
  function runningAnimations(doc) {
    if (!doc || typeof doc.getAnimations !== 'function') return [];
    var found = attempt(function () { return doc.getAnimations(); });
    if (!found) return [];
    return Array.prototype.slice.call(found).filter(function (a) {
      return a && a.playState === 'running';
    });
  }

  function animationMoves(view) {
    var name = 'animationMoves';
    view = viewOf(view);
    var doc = view.document;
    var win = view.window;
    var canvases = queryAll(doc, 'canvas');
    var animations = runningAnimations(doc);

    // Wrapped rather than counted after the fact: whether the page is driving
    // frames at all is the difference between a still canvas that is a defect
    // and a still canvas that is a diagram.
    var frames = 0;
    var original = win && typeof win.requestAnimationFrame === 'function'
      ? win.requestAnimationFrame
      : null;
    if (original) {
      win.requestAnimationFrame = function (callback) {
        frames++;
        return original.call(win, callback);
      };
    }

    var before = canvases.map(drawingOf);
    var clocks = animations.map(function (a) { return num(a.currentTime); });

    return waitFor(win, view.sampleMs).then(function (waited) {
      if (original) win.requestAnimationFrame = original;

      var notes = {
        framesRequested: frames,
        watchedMs: waited ? view.sampleMs : 0,
        looping: frames > 1,
        animations: animations.length
      };

      if (!waited) {
        return declined(name, 'there was no clock here to watch the page with', notes);
      }

      var examined = canvases.map(function (canvas, i) {
        var entry = {
          kind: 'canvas',
          selector: selectorFor(canvas),
          moved: null,
          context: null,
          contextAttributes: null,
          unread: ''
        };
        var after = drawingOf(canvas);
        if (before[i] == null || after == null) {
          entry.unread = UNREADABLE;
          return entry;
        }
        entry.moved = before[i] !== after;
        describeContext(entry, canvas, blankLike(doc, canvas) !== after);
        return entry;
      });

      animations.forEach(function (animation, i) {
        examined.push({
          kind: 'animation',
          selector: selectorFor(animation.effect && animation.effect.target),
          moved: num(animation.currentTime) !== clocks[i],
          context: null,
          contextAttributes: null,
          unread: ''
        });
      });

      var moved = examined.filter(function (e) { return e.moved === true; });
      var still = examined.filter(function (e) { return e.moved === false; });

      // A page that never asked for a frame and declares no running animation
      // is a page with nothing to be still: a diagram drawn once is not a
      // defect, and reporting one is how this check starts costing more than
      // it is worth.
      if (!notes.looping && !animations.length) {
        return declined(name, 'nothing on this page claims to be animating', notes);
      }

      // A page driving frames with nothing this check can sample — an
      // explorable animating the DOM or an SVG rather than a canvas, and not
      // through the animation API. There is something happening and no way to
      // read it, which is not the same as reading it and finding it still.
      if (!examined.length) {
        return declined(name, 'the page is running frames, and none of what it moves is readable here', notes);
      }

      return result(
        name,
        moved.length > 0,
        moved.length
          ? moved.length + ' of ' + examined.length + ' things moved while the page ran frames'
          : 'the page is running frames and nothing changed',
        still,
        examined,
        notes
      );
    });
  }

  /* ------------------------------------------------------------------ layout */

  /** Where the page is scrolled to, however the window spells it. */
  function scrollOf(win) {
    if (!win) return { x: 0, y: 0 };
    return {
      x: num(typeof win.scrollX === 'number' ? win.scrollX : win.pageXOffset),
      y: num(typeof win.scrollY === 'number' ? win.scrollY : win.pageYOffset)
    };
  }

  function nothingOffPage(view) {
    var name = 'nothingOffPage';
    view = viewOf(view);
    var doc = view.document;
    var win = view.window;
    var root = doc && doc.documentElement;
    if (!root) return declined(name, 'there is no document here to lay out', {});

    var viewport = {
      width: num(root.clientWidth) || num(win && win.innerWidth),
      height: num(root.clientHeight) || num(win && win.innerHeight)
    };
    var scroll = scrollOf(win);
    var all = elementsIn(doc);
    var notes = {
      walked: all.length,
      considered: 0,
      truncated: all.length >= MAX_ELEMENTS,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height
    };

    if (!viewport.width) {
      return declined(name, 'this page has no viewport to be off the edge of', notes);
    }

    var examined = [];
    var findings = [];
    all.forEach(function (el) {
      var box = boxOf(el);
      if (!box || box.width < MIN_BOX || box.height < MIN_BOX) return;
      notes.considered++;

      // Every edge in one space — the document's — because a box read off a
      // scrolled page is in the viewport's, and two branches disagreeing about
      // which space they are in is a check that answers differently depending
      // on where the reader happened to have scrolled to.
      var left = box.left + scroll.x;
      var right = box.right + scroll.x;
      var bottom = box.bottom + scroll.y;

      var why = '';
      if (right <= 0) why = 'left of the page';
      else if (left >= viewport.width) why = 'right of the viewport';
      else if (right > viewport.width) why = 'wider than the viewport';
      else if (bottom <= 0) why = 'above the page';
      if (!why) return;

      var style = styleOf(win, el);
      var entry = {
        selector: selectorFor(el),
        reason: why,
        position: style ? String(style.position || '') : '',
        rect: { top: box.top, left: box.left, width: box.width, height: box.height }
      };
      examined.push(entry);
      findings.push(entry);
    });

    // Nothing with a box on it is nothing to have judged — a page whose
    // elements are all unlaid-out has not passed this check, it has escaped it.
    if (!notes.considered) {
      return declined(name, 'nothing on this page has a box to be inside or outside', notes);
    }

    return result(
      name,
      findings.length === 0,
      findings.length
        ? findings.length + ' elements sit off the page, or past the edge of it'
        : 'every element is inside the page',
      findings,
      examined,
      notes
    );
  }

  /* --------------------------------------------------------------- occlusion */

  function labelsVisible(view) {
    var name = 'labelsVisible';
    view = viewOf(view);
    var doc = view.document;
    var win = view.window;
    var labels = labelsIn(doc);
    var notes = {
      sampled: labels.length,
      truncated: labels.length >= MAX_LABELS,
      hitTested: typeof (doc && doc.elementFromPoint) === 'function'
    };

    if (!labels.length) return declined(name, 'this page has no laid-out text on it', notes);

    var all = elementsIn(doc).map(function (el) { return { el: el, box: boxOf(el) }; });

    var examined = labels.map(function (label) {
      var x = label.box.left + label.box.width / 2;
      var y = label.box.top + label.box.height / 2;

      var hitEl = notes.hitTested
        ? attempt(function () { return doc.elementFromPoint(x, y); })
        : null;

      // Geometry as well as the hit test, because the hit test is the half an
      // overlay can opt out of. What covers the label is what covers it,
      // whether or not a pointer would have found out.
      var coveredBy = [];
      var ignoring = [];
      all.forEach(function (other) {
        if (!other.box || related(other.el, label.el)) return;
        if (other.box.width < MIN_BOX || other.box.height < MIN_BOX) return;
        if (!covers(other.box, x, y)) return;
        coveredBy.push(selectorFor(other.el));
        var style = styleOf(win, other.el);
        if (style && String(style.pointerEvents) === 'none') ignoring.push(selectorFor(other.el));
      });

      return {
        selector: selectorFor(label.el),
        hit: hitEl == null ? 'untested' : (related(hitEl, label.el) ? 'self' : 'covered'),
        hitBy: hitEl != null && !related(hitEl, label.el) ? selectorFor(hitEl) : '',
        coveredBy: coveredBy,
        ignoringPointerEvents: ignoring,
        overlaps: []
      };
    });

    // Two labels sharing space is the other way text becomes unreadable, and
    // neither of them has to be on top for it.
    for (var i = 0; i < labels.length; i++) {
      for (var j = i + 1; j < labels.length; j++) {
        if (related(labels[i].el, labels[j].el)) continue;
        if (!overlap(labels[i].box, labels[j].box)) continue;
        examined[i].overlaps.push(examined[j].selector);
        examined[j].overlaps.push(examined[i].selector);
      }
    }

    var findings = examined.filter(function (e) {
      return e.hit === 'covered' || e.overlaps.length > 0;
    });

    return result(
      name,
      findings.length === 0,
      findings.length
        ? findings.length + ' of ' + examined.length + ' labels are covered or overlapping'
        : 'every one of ' + examined.length + ' labels is clear',
      findings,
      examined,
      notes
    );
  }

  /* ---------------------------------------------------------------- contrast */

  var RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/i;
  var HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

  function parseColor(value) {
    if (!value) return null;
    var text = String(value).trim();
    if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

    var rgb = RGB.exec(text);
    if (rgb) {
      return {
        r: Number(rgb[1]),
        g: Number(rgb[2]),
        b: Number(rgb[3]),
        a: rgb[4] == null ? 1 : (/%$/.test(rgb[4]) ? parseFloat(rgb[4]) / 100 : Number(rgb[4]))
      };
    }

    var hex = HEX.exec(text);
    if (!hex) return null;
    var digits = hex[1].length === 3
      ? hex[1].replace(/(.)/g, '$1$1')
      : hex[1];
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: 1
    };
  }

  function over(top, bottom) {
    return {
      r: top.r * top.a + bottom.r * (1 - top.a),
      g: top.g * top.a + bottom.g * (1 - top.a),
      b: top.b * top.a + bottom.b * (1 - top.a),
      a: 1
    };
  }

  function channel(value) {
    var c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function luminance(colour) {
    return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
  }

  function contrastRatio(a, b) {
    var high = Math.max(luminance(a), luminance(b));
    var low = Math.min(luminance(a), luminance(b));
    return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100;
  }

  var WHITE = { r: 255, g: 255, b: 255, a: 1 };

  /** A colour as the page would have written it, so a finding can be read. */
  function colourText(colour) {
    return 'rgb(' + Math.round(colour.r) + ', ' + Math.round(colour.g) + ', ' + Math.round(colour.b) + ')';
  }

  /**
   * What is behind an element, and whether the page actually said so. An
   * assumed background is the field the contrast check misleads through, so it
   * is reported rather than quietly used.
   */
  function backgroundBehind(win, el) {
    for (var at = el; at && at.tagName; at = at.parentNode) {
      var style = styleOf(win, at);
      if (!style) break;

      var image = String(style.backgroundImage || 'none');
      if (image !== 'none' && image !== '') {
        return { colour: WHITE, from: null, assumed: true, why: 'a background image or gradient' };
      }

      var colour = parseColor(style.backgroundColor);
      if (colour && colour.a === 1) {
        return { colour: colour, from: selectorFor(at), assumed: false, why: '' };
      }
      if (colour && colour.a > 0) {
        return { colour: WHITE, from: selectorFor(at), assumed: true, why: 'a half-transparent background' };
      }
      if (!colour && style.backgroundColor) {
        return { colour: WHITE, from: selectorFor(at), assumed: true, why: 'a colour this check cannot parse' };
      }
    }
    return { colour: WHITE, from: null, assumed: true, why: 'nothing here declares an opaque background' };
  }

  function isLarge(style) {
    var size = parseFloat(style && style.fontSize) || 0;
    var weight = parseFloat(style && style.fontWeight) || 400;
    return size >= 24 || (size >= 18.66 && weight >= 700);
  }

  function textContrast(view) {
    var name = 'textContrast';
    view = viewOf(view);
    var doc = view.document;
    var win = view.window;
    if (!win || typeof win.getComputedStyle !== 'function') {
      return declined(name, 'nothing here computes styles, so no colour can be read', {});
    }

    var labels = labelsIn(doc);
    var notes = {
      sampled: labels.length,
      truncated: labels.length >= MAX_LABELS,
      threshold: AA_TEXT,
      largeThreshold: AA_LARGE,
      assumed: 0
    };
    if (!labels.length) return declined(name, 'this page has no laid-out text on it', notes);

    var examined = [];
    labels.forEach(function (label) {
      var style = styleOf(win, label.el);
      var foreground = style ? parseColor(style.color) : null;
      var behind = backgroundBehind(win, label.el);
      if (behind.assumed) notes.assumed++;

      var entry = {
        selector: selectorFor(label.el),
        foreground: style ? String(style.color || '') : '',
        background: colourText(behind.colour),
        assumedBecause: behind.why,
        backgroundFrom: behind.from,
        assumed: behind.assumed,
        large: style ? isLarge(style) : false,
        ratio: null
      };

      if (foreground) {
        var front = foreground.a < 1 ? over(foreground, behind.colour) : foreground;
        entry.ratio = contrastRatio(front, behind.colour);
      }
      examined.push(entry);
    });

    var findings = examined.filter(function (e) {
      return e.ratio != null && e.ratio < (e.large ? AA_LARGE : AA_TEXT);
    });

    return result(
      name,
      findings.length === 0,
      findings.length
        ? findings.length + ' of ' + examined.length + ' pieces of text are below the contrast floor'
        : 'every one of ' + examined.length + ' pieces of text clears the contrast floor',
      findings,
      examined,
      notes
    );
  }

  /* -------------------------------------------------------------- the pass */

  /**
   * The checks, in the order a Teacher reads them: what the page said, what it
   * loaded, what it drew, whether the drawing moves, and then the three that
   * are about what a Learner can actually see.
   */
  var CHECKS = [
    { name: 'consoleErrors', run: consoleErrors },
    { name: 'failedRequests', run: failedRequests },
    { name: 'canvasHasContent', run: canvasHasContent },
    { name: 'animationMoves', run: animationMoves },
    { name: 'nothingOffPage', run: nothingOffPage },
    { name: 'labelsVisible', run: labelsVisible },
    { name: 'textContrast', run: textContrast }
  ];

  /**
   * Every check, against one page. A check that throws is reported as one that
   * threw rather than taken as a verdict, and the other six still run: a defect
   * in this file is a thing to fix here, not a reason a Lesson goes unlooked at.
   */
  function run(view) {
    // Normalised once here and again inside each check, which is free: a check
    // has to stand on its own, because re-running the one a finding sent the
    // Teacher back to is how this file is used after the first pass.
    var seen = viewOf(view);
    var ran = [];

    var next = function (i) {
      if (i >= CHECKS.length) return Promise.resolve(ran);
      var check = CHECKS[i];
      var outcome;
      try {
        outcome = Promise.resolve(check.run(seen));
      } catch (e) {
        outcome = Promise.resolve(threw(check.name, e));
      }
      return outcome.catch(function (e) { return threw(check.name, e); }).then(function (report) {
        ran.push(report);
        return next(i + 1);
      });
    };

    return next(0).then(function (reports) {
      var failed = reports.filter(function (r) { return r.ok === false; });
      var judged = reports.filter(function (r) { return r.ok === true; });

      // Three-valued here for the reason each check is: a pass in which every
      // check declined has judged nothing, and reporting that as `ok` is the
      // one answer a Teacher would act on wrongly.
      return {
        ok: failed.length ? false : (judged.length ? true : null),
        summary: failed.length
          ? failed.length + ' of ' + reports.length + ' checks found something'
          : judged.length
            ? judged.length + ' of ' + reports.length + ' checks looked and were happy'
            : 'nothing on this page was in a state any check could judge',
        checks: reports
      };
    });
  }

  function threw(name, error) {
    return result(
      name,
      null,
      'this check threw, so it judged nothing: ' + (error && error.message ? error.message : error),
      [],
      [],
      { threw: true }
    );
  }

  root.PageChecks = {
    run: run,
    checks: CHECKS,
    consoleErrors: consoleErrors,
    failedRequests: failedRequests,
    canvasHasContent: canvasHasContent,
    animationMoves: animationMoves,
    nothingOffPage: nothingOffPage,
    labelsVisible: labelsVisible,
    textContrast: textContrast
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
