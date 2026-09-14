/* ============================================================
   In-page tutor widget
   Requires: assets/tutor.css, assets/rich-text.js, assets/lesson-boot.js
   Backend : tutor/server.js   ->  node tutor/server.js
   Degrades: with no service to reach, the send button becomes "copy a
             well-formed prompt". There are two ways to have none, and the
             drawer tells them apart: the service is not running, or this page
             was not served by it and never could reach it (e.g. file://).

   Every string this file puts on screen is a key into the table at the head of
   assets/lesson-boot.js, looked up against the page's own <html lang>. There
   is no learner-facing text below — a literal here would be one learner's
   language written into every workspace, which is the defect this arrangement
   exists to have removed.

   Two roles reach the learner through this one drawer, because everything
   around an answer — the thread, the wait, the stop, the retry, the clipboard
   fallback — is the same work whoever wrote it. A thread carries the role it
   belongs to: a lesson question is the tutor's, and a submission handed in
   from an assignment page (assets/assignment.js, via window.Tutor.grade) is
   the grader's. Follow-ups stay with the role that answered, so questioning a
   verdict reaches the agent that gave it.
   ============================================================ */

(function () {
  'use strict';

  /**
   * What this page says, in the learner's language.
   *
   * Reached through `window` and defaulted, because lesson-boot.js carries on
   * past a script that failed to load. A drawer labelled with its own keys is
   * ugly and still usable; a drawer that threw on the first label is not there
   * at all. It is also the last rung of the lookup chain, so the two failures
   * look the same to whoever reports one.
   */
  var say = (window.LearnerText && window.LearnerText.say)
    || function (key) { return key; };

  // The roles this drawer carries, mirroring the service's own ROLES map — one
  // entry each rather than a `convo.role === 'grader'` test wherever the two
  // differ, so a third role is one entry here and not a fourth branch to find.
  //
  //   title    who the composer underneath is reaching, in the header
  //   reply    what that role is called above an answer it gave
  //   ask      the openings worth offering; a verdict is not a passage
  //   lead     how the clipboard prompt opens, when there is no service
  //   brief    what the clipboard prompt asks for at the end. It restates what
  //            the role file says because on this path nothing loads a role
  //            file: the learner is pasting into a session that has none.
  //
  // Each field is a key rather than a string, for the reason the whole file is:
  // what a role is called is the learner's language, and this map is shared by
  // every workspace.
  var ROLES = {
    tutor: {
      title: 'tutor.role.tutor.title',
      reply: 'tutor.role.tutor.reply',
      ask: [
        'tutor.role.tutor.ask.1',
        'tutor.role.tutor.ask.2',
        'tutor.role.tutor.ask.3',
        'tutor.role.tutor.ask.4',
      ],
      lead: 'tutor.role.tutor.lead',
      brief: 'tutor.role.tutor.brief'
    },
    grader: {
      title: 'tutor.role.grader.title',
      reply: 'tutor.role.grader.reply',
      ask: [
        'tutor.role.grader.ask.1',
        'tutor.role.grader.ask.2',
        'tutor.role.grader.ask.3',
        'tutor.role.grader.ask.4',
      ],
      lead: 'tutor.role.grader.lead',
      // The subagent, and nothing else. Offering "or answer as a grader
      // yourself" would invite whichever session this is pasted into to grade —
      // and the session most likely to be open is the one that wrote the
      // assignment, which is the one thing grading may never be. That is a
      // property of what the entry says, so it is a property of every
      // translation of it, which is what the suite holds it to.
      brief: 'tutor.role.grader.brief'
    }
  };

  // How a failure the *service* reports becomes words the learner can read. It
  // sends a code rather than a sentence — it holds no learner-facing string of
  // its own — and this is the one place a code turns into a key. A failure the
  // *agent* reported carries its own text instead, which is evidence about that
  // run rather than a string anybody chose, and is shown as it arrived.
  //
  // Key literals, like every other lookup in this file: the suite reads the
  // codes out of the service and these out of here, and holds the table to
  // having an entry for each.
  var FAILED = {
    'timeout': 'tutor.fail.timeout',
    'agent-missing': 'tutor.fail.agent.missing'
  };

  var START_CMD = 'node tutor/server.js';

  /**
   * The language this page declares, which is the same authority every label on
   * it is looked up against.
   *
   * It rides the request because the answer is the one learner-facing thing the
   * service produces, and nothing on that side of the socket can see a page.
   * Read off the document rather than kept in a variable so that it is the same
   * answer the lookup gets, from the same place, every time.
   */
  function pageLang() {
    var root = document.documentElement;
    var declared = root && root.getAttribute ? root.getAttribute('lang') : '';
    return (declared || '').trim();
  }

  var lessonPath = (function () {
    var m = location.pathname.match(/[^/]+$/);
    return m ? decodeURIComponent(m[0]) : 'lesson';
  })();

  // What the learner has open, as the service names it: the directory as well
  // as the file, because an assignment does not live in lessons/ and a grader
  // told to read the wrong path reads nothing. The storage keys stay on the
  // bare filename — they are this page's own, and rekeying them would orphan
  // every answer a learner had already pinned.
  var pagePath = (function () {
    var parts = location.pathname.split('/').filter(Boolean);
    parts.pop();
    var dir = parts.length ? decodeURIComponent(parts[parts.length - 1]) : '';
    return dir ? dir + '/' + lessonPath : lessonPath;
  })();

  var STORE_KEY = 'tutor-notes::' + lessonPath;
  var THREADS_KEY = 'tutor-threads::' + lessonPath;
  var MAX_THREADS = 20;

  var online = false;
  var busy = false;
  var currentSelection = '';

  // How often to ask again for a service that was not there. The learner starts
  // it by hand, usually after the Lesson is already open, so the question is
  // "how long does a start take to notice", not "how cheap is the request".
  var HEALTH_POLL_MS = 4000;

  // The wait, in the three stages a learner can tell apart: the service has the
  // question, the Tutor is reading the Workspace, the answer is arriving.
  // Without them a ten-second wait and a hang look identical, which is the
  // whole complaint.
  //
  // They are an order a request usually passes through, not one it is held to.
  // A Tutor writes a sentence, goes and reads another Lesson, then writes more
  // — the service emits that as open, delta, tool, delta — so the row reports
  // what is happening *now* rather than how far the request has got. Mid-answer
  // is where that earns its keep: the text stops growing, and the learner is
  // told it went to read something rather than left to guess at a stall.
  var STAGES = {
    accepted: 'tutor.stage.accepted',
    reading: 'tutor.stage.reading',
    answering: 'tutor.stage.answering'
  };
  // What the row says before the service has said anything. It is the same
  // stage — the question is away — but the claim that the service *has* it
  // waits for the service to say so, which is what the `open` event is.
  var SENDING = 'tutor.stage.sending';

  // One thread = one line of questioning, put to one role. Turns ride along in
  // each request (bounded replay), so the server stays stateless and never
  // resumes a session.
  var convo = { id: null, role: 'tutor', selection: null, turns: [] };
  var SEND_LAST_TURNS = 8; // server caps to 6; this just keeps the body small

  function newThreadId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'th-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // ---------------------------------------------------------------- thread store
  // Threads are the widget's own UI state. Losing them to a stray click is a bug,
  // so they persist per lesson and every thread stays reachable from the history.

  function loadStore() {
    try {
      var s = JSON.parse(localStorage.getItem(THREADS_KEY) || '{}');
      if (!s || !Array.isArray(s.threads)) return { active: null, threads: [] };
      return s;
    } catch (e) { return { active: null, threads: [] }; }
  }
  function saveStore(s) {
    try { localStorage.setItem(THREADS_KEY, JSON.stringify(s)); } catch (e) { /* quota */ }
  }

  // Persist the live thread. Empty threads are never stored — an opened-and-
  // abandoned drawer should not litter the history.
  function persistConvo() {
    if (!convo.id || !convo.turns.length) return;
    var s = loadStore();
    var rec = {
      id: convo.id,
      role: convo.role,
      selection: convo.selection || '',
      turns: convo.turns,
      at: Date.now()
    };
    var i = s.threads.map(function (t) { return t.id; }).indexOf(convo.id);
    if (i === -1) s.threads.push(rec); else s.threads[i] = rec;
    s.threads.sort(function (a, b) { return b.at - a.at; });
    if (s.threads.length > MAX_THREADS) s.threads.length = MAX_THREADS;
    s.active = convo.id;
    saveStore(s);
  }

  function setActive(id) {
    var s = loadStore();
    s.active = id;
    saveStore(s);
  }

  // Archives whatever is live, then opens a clean thread. Nothing is discarded.
  // `asRole` rather than `role`, which in here is the function naming whoever
  // answers the live thread — shadowing it once already cost an afternoon.
  function startThread(sel, asRole) {
    persistConvo();
    convo.id = newThreadId();
    convo.role = asRole || 'tutor';
    convo.selection = sel || '';
    convo.turns = [];
    renderRole();
    renderThread();
    renderHistory();
  }

  function loadThread(rec) {
    persistConvo();
    convo.id = rec.id;
    convo.role = rec.role || 'tutor';
    convo.selection = rec.selection || '';
    convo.turns = (rec.turns || []).slice();
    currentSelection = convo.selection;
    setActive(convo.id);
    renderRole();
    renderThread();
    renderQuote();
    renderHistory();
  }

  /** Whoever is answering the live thread. An unknown role reads as the Tutor. */
  function role() {
    return ROLES[convo.role] || ROLES.tutor;
  }

  function renderThread() {
    while (thread.firstChild) thread.removeChild(thread.firstChild);
    var lastQ = '';
    convo.turns.forEach(function (t) {
      if (t.role === 'user') {
        lastQ = t.content;
        addMsg('user', t.content);
      } else {
        var m = addMsg('tutor', t.content);
        (function (q, a) {
          addActions(m.wrap, askedAbout(q, convo.selection), function () { return a; });
        })(lastQ, t.content);
      }
    });
  }

  function renderQuote() {
    if (currentSelection) {
      quote.textContent = currentSelection;
      quote.classList.remove('hidden');
    } else {
      quote.textContent = '';
      quote.classList.add('hidden');
    }
  }

  // ---------------------------------------------------------------- utils

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // The nodes rich-text.js builds with. It never reaches for `document` itself,
  // which is what lets it be tested without a browser.
  var NODES = {
    element: function (tag) { return document.createElement(tag); },
    text: function (value) { return document.createTextNode(value); }
  };

  /**
   * The opening a Grader is told to refuse with, and the one piece of an answer
   * this drawer reads rather than renders.
   *
   * `tutor/GRADER.md` mandates it and `tutor/server.js` watches for it, which
   * is how a refusal is kept out of learning-records/. It is ASCII on purpose
   * — everything after it is the learner's language, and this is not — and it
   * is a marker addressed to the service, so the learner is owed the sentence
   * under it and not the marker itself. `language.test.js` reads the token out
   * of the role definition and holds this pattern and the service's to it.
   *
   * Deliberately narrow: one known opening, the blank it leaves behind, and
   * nothing else. The same text further down an answer is prose a Grader wrote,
   * and stripping there would eat a learner's words.
   *
   * Whitespace before it still counts as opening with it, for two reasons that
   * have to give the same answer: GRADER.md quotes the token as an indented
   * block, and this reads a stream as it accumulates while the service reads
   * the same answer trimmed. A refusal one of them recognised and the other did
   * not is a learner reading a marker meant for a service.
   */
  var REFUSAL = /^\s*CANNOT-GRADE:[ \t]*\r?\n?/;

  // The one place an answer becomes nodes. Every path that shows one — the
  // stream, the thread restored from storage, a pinned answer read back into
  // the lesson — goes through here, so none of them is a degraded version of
  // the others, and the refusal token is stripped once rather than at each of
  // them.
  //
  // rich-text.js is loaded by lesson-boot.js, which carries on past a script
  // that failed to load. If that happened, the answer is still shown, as the
  // text it already was: a legible answer beats no answer.
  function showRich(host, text) {
    var prose = (text || '').replace(REFUSAL, '');
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!window.RichText) return showPlain(host, prose);

    window.RichText.render(prose, NODES).forEach(function (node) { host.appendChild(node); });
    host.classList.add('tutor-rich');
    return host;
  }

  // Everything that is not an answer: the learner's own question, an error.
  function showPlain(host, text) {
    host.classList.remove('tutor-rich');
    host.textContent = text || '';
    return host;
  }

  // The caret says the answer is still arriving, so it belongs at the end of
  // the text rather than on a line of its own beneath it.
  function markInFlight(host, caret) {
    var last = host.childNodes[host.childNodes.length - 1];
    if (last && /^(p|h[1-6])$/.test(last.localName || '')) last.appendChild(caret);
    else host.appendChild(caret);
  }

  function loadNotes() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveNotes(notes) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(notes)); } catch (e) { /* quota */ }
  }

  // ---------------------------------------------------------------- DOM

  var backdrop = el('div', 'tutor-backdrop');

  var drawer = el('aside', 'tutor-drawer');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', say('tutor.aria.drawer'));

  var head = el('div', 'tutor-head');
  var title = el('div', 'tutor-title');
  // Who is on the other end, which changes under the learner: a Submission
  // opens a Grader thread, and a header still naming the Tutor over a verdict
  // would be the one confusion this whole arrangement exists to avoid.
  var titleText = document.createTextNode('');
  title.appendChild(titleText);
  var status = el('span', 'tutor-status', say('tutor.status.checking'));
  title.appendChild(status);
  var histBtn = el('button', 'tutor-newtopic tutor-hist-btn', say('tutor.history'));
  histBtn.title = say('tutor.history.title');
  var newTopicBtn = el('button', 'tutor-newtopic', say('tutor.newtopic'));
  newTopicBtn.title = say('tutor.newtopic.title');
  var closeBtn = el('button', 'tutor-close', say('tutor.close'));
  closeBtn.setAttribute('aria-label', say('tutor.close.title'));
  head.appendChild(title);
  head.appendChild(histBtn);
  head.appendChild(newTopicBtn);
  head.appendChild(closeBtn);

  var histPanel = el('div', 'tutor-histpanel');

  var quote = el('div', 'tutor-quote hidden');
  var thread = el('div', 'tutor-thread');

  var foot = el('div', 'tutor-foot');
  var suggestions = el('div', 'tutor-suggestions');

  // Rebuilt whenever the live thread changes role: the header says who is
  // answering, and the openings offered are the ones that make sense against
  // whoever is about to read them.
  function renderRole() {
    titleText.textContent = say(role().title);

    while (suggestions.firstChild) suggestions.removeChild(suggestions.firstChild);
    role().ask.forEach(function (key) {
      var opening = say(key);
      var b = el('button', 'tutor-suggest', opening);
      b.addEventListener('click', function () { input.value = opening; send(); });
      suggestions.appendChild(b);
    });
  }
  renderRole();

  var inputRow = el('div', 'tutor-input-row');
  var input = el('textarea', 'tutor-input');
  input.placeholder = say('tutor.input.placeholder');
  input.rows = 1;
  var sendBtn = el('button', 'tutor-send', say('tutor.send'));
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  var hint = el('div', 'tutor-hint');

  foot.appendChild(suggestions);
  foot.appendChild(inputRow);
  foot.appendChild(hint);

  drawer.appendChild(head);
  drawer.appendChild(histPanel);
  drawer.appendChild(quote);
  drawer.appendChild(thread);
  drawer.appendChild(foot);

  var fab = el('button', 'tutor-fab');
  fab.appendChild(document.createTextNode(say('tutor.fab')));

  var chip = el('div', 'tutor-chip');
  chip.appendChild(document.createTextNode(say('tutor.fab')));

  // Guarded rather than a bare DOMContentLoaded listener: lesson-boot.js loads
  // this file dynamically, by which time that event has usually already fired —
  // a plain listener would never run and the widget would silently never mount.
  function mountTutor() {
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    document.body.appendChild(fab);
    document.body.appendChild(chip);
    renderNotes();
    restoreActive();
    probe();
  }
  if (document.body) mountTutor();
  else document.addEventListener('DOMContentLoaded', mountTutor);

  // A reload should not cost the learner the thread they were in the middle of.
  function restoreActive() {
    var s = loadStore();
    if (!s.threads.length) return;
    var rec = null;
    if (s.active) {
      rec = s.threads.filter(function (t) { return t.id === s.active; })[0] || null;
    }
    if (!rec) rec = s.threads[0];
    convo.id = rec.id;
    convo.role = rec.role || 'tutor';
    convo.selection = rec.selection || '';
    convo.turns = (rec.turns || []).slice();
    currentSelection = convo.selection;
    renderRole();
    renderThread();
    renderQuote();
  }

  // ---------------------------------------------------------------- health

  // The service is started by hand, and usually after the Lesson is already
  // open. Probing once at mount meant the widget said "start it and reload" and
  // then stayed offline however long the learner looked at it — the one state
  // the page could not get itself out of. So it keeps asking while it is
  // offline, and stops the moment it is not.

  var healthTimer = null;

  // Whether this page could reach the service at all. The drawer talks to the
  // service that served the page, so a page opened off the disk is not one
  // request away from it — the request names another origin and the browser
  // refuses to make it. That is a different thing from a service being down,
  // and the learner is told which of the two this is: the one instruction that
  // would help on a served page is the one that cannot help here, and following
  // it twice is what the report behind this state actually did.
  function served() {
    return /^https?:$/.test(location.protocol);
  }

  function probe() {
    if (!served()) return setOnDisk();
    fetch('/api/health', { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (j) { if (j && j.ok) setOnline(); else setOffline(); })
      .catch(function () { setOffline(); });
  }

  // Nothing to wait for on a page the service did not serve: no service that
  // could come up would change anything here, so that state is final rather
  // than pending.
  function watchHealth() {
    if (healthTimer || !served()) return;
    healthTimer = setInterval(probe, HEALTH_POLL_MS);
  }

  function unwatchHealth() {
    if (!healthTimer) return;
    clearInterval(healthTimer);
    healthTimer = null;
  }

  // Both are written idempotently, because once it is polling they are called
  // every few seconds: a header rebuilt on every probe would stomp the "copied"
  // the learner is still reading.
  var shown = '';

  function setOnline() {
    unwatchHealth();
    online = true;
    if (shown === 'online') return;
    shown = 'online';
    status.textContent = say('tutor.status.online');
    status.className = 'tutor-status live';
    sendBtn.textContent = say('tutor.send');
    hint.textContent = '';
  }

  // A served page whose service is down is waiting for one command, and says so.
  function setOffline() {
    online = false;
    watchHealth();
    if (shown === 'offline') return;
    shown = 'offline';
    degrade('off', 'tutor.status.offline', 'tutor.offline.hint', START_CMD);
  }

  // A page the service did not serve is waiting for nothing, and says that
  // instead. It offers no command: the one that starts the service cannot make
  // this page reach it, and offering it is what sent the learner in the
  // originating report round the same loop twice.
  function setOnDisk() {
    online = false;
    if (shown === 'ondisk') return;
    shown = 'ondisk';
    degrade('unknown', 'tutor.status.ondisk', 'tutor.ondisk.hint', null);
  }

  // What the two share: the composer falls back to the clipboard, and one
  // sentence says why. The sentence is one entry in the table rather than two
  // halves, so that a translator sees the whole of what it says and may put the
  // command anywhere in it — or, with no command to place, nowhere.
  //
  // They do not share a chip. A service that is down is something the learner
  // can go and start; a page the service never served is not, and reading the
  // same warning for both is how the two came to be told apart by nothing.
  function degrade(cls, statusKey, hintKey, command) {
    status.textContent = say(statusKey);
    status.className = 'tutor-status ' + cls;
    sendBtn.textContent = say('tutor.send.copy');
    hint.textContent = '';
    var around = say(hintKey).split('{command}');
    hint.appendChild(document.createTextNode(around[0]));
    // The command itself is a command, and the same in every language.
    if (command) hint.appendChild(el('code', null, command));
    hint.appendChild(document.createTextNode(around.length > 1 ? around[1] : ''));
  }

  // ---------------------------------------------------------------- open/close

  function open(selText) {
    var sel = selText || '';
    if (sel && sel !== convo.selection) {
      // A different passage is a genuinely different line of questioning.
      // startThread archives the outgoing one rather than dropping it.
      startThread(sel);
    } else if (!convo.id) {
      startThread(sel);
    }
    // Empty selection (the FAB) or the same passage continues what is already
    // open. Reopening must never cost the learner a conversation.
    currentSelection = convo.selection || '';
    renderQuote();
    renderHistory();
    backdrop.classList.add('open');
    drawer.classList.add('open');
    fab.classList.add('hidden');
    hideChip();
    setTimeout(function () { input.focus(); }, 260);
  }

  function close() {
    persistConvo();
    closeHistory();
    backdrop.classList.remove('open');
    drawer.classList.remove('open');
    fab.classList.remove('hidden');
  }

  newTopicBtn.addEventListener('click', function () {
    startThread(currentSelection);
    closeHistory();
    input.focus();
  });
  closeBtn.addEventListener('click', close);
  // No backdrop-click-to-close: dismissing a half-read answer by clicking the
  // page was the exact accident that lost conversations. Use the close button
  // or Esc.
  fab.addEventListener('click', function () { open(''); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (histPanel.classList.contains('open')) return closeHistory();
    if (drawer.classList.contains('open')) close();
  });
  window.addEventListener('beforeunload', persistConvo);

  // ---------------------------------------------------------------- history

  function relTime(ts) {
    var s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return say('tutor.time.now');
    if (s < 3600) return say('tutor.time.minutes', { n: Math.floor(s / 60) });
    if (s < 86400) return say('tutor.time.hours', { n: Math.floor(s / 3600) });
    return say('tutor.time.days', { n: Math.floor(s / 86400) });
  }

  function threadLabel(rec) {
    var first = '';
    for (var i = 0; i < rec.turns.length; i++) {
      if (rec.turns[i].role === 'user') { first = rec.turns[i].content; break; }
    }
    if (!first) first = rec.selection || say('tutor.thread.untitled');
    return first.length > 42 ? say('tutor.thread.truncated', { text: first.slice(0, 42) }) : first;
  }

  function closeHistory() { histPanel.classList.remove('open'); }

  function renderHistory() {
    var s = loadStore();
    // The live thread may not be persisted yet; show it so "current" is visible.
    var list = s.threads.slice();
    if (convo.id && convo.turns.length && !list.some(function (t) { return t.id === convo.id; })) {
      list.unshift({ id: convo.id, selection: convo.selection, turns: convo.turns, at: Date.now() });
    }

    while (histPanel.firstChild) histPanel.removeChild(histPanel.firstChild);

    if (!list.length) {
      histPanel.appendChild(el('div', 'tutor-histempty', say('tutor.history.empty')));
      return;
    }

    list.forEach(function (rec) {
      var item = el('button', 'tutor-histitem');
      if (rec.id === convo.id) item.classList.add('current');
      item.appendChild(el('div', 'tutor-histq', threadLabel(rec)));
      var meta = el('div', 'tutor-histmeta');
      var n = rec.turns.filter(function (t) { return t.role === 'user'; }).length;
      meta.textContent = say('tutor.thread.meta', { asked: n, when: relTime(rec.at) });
      item.appendChild(meta);
      item.addEventListener('click', function () {
        if (rec.id !== convo.id) loadThread(rec);
        closeHistory();
        input.focus();
      });
      histPanel.appendChild(item);
    });
  }

  histBtn.addEventListener('click', function () {
    if (histPanel.classList.contains('open')) return closeHistory();
    renderHistory();
    histPanel.classList.add('open');
  });

  // ---------------------------------------------------------------- selection chip

  function hideChip() { chip.classList.remove('show'); }

  document.addEventListener('mouseup', function (e) {
    if (drawer.contains(e.target) || chip.contains(e.target)) return;
    setTimeout(function () {
      var sel = window.getSelection();
      var text = sel ? String(sel).trim() : '';
      if (!text || text.length < 2) return hideChip();
      var range = sel.getRangeAt(0);
      var r = range.getBoundingClientRect();
      if (!r.width && !r.height) return hideChip();
      chip.style.top = (window.scrollY + r.bottom + 9) + 'px';
      chip.style.left = (window.scrollX + r.left) + 'px';
      chip.classList.add('show');
      chip.__text = text;
    }, 10);
  });

  document.addEventListener('mousedown', function (e) {
    if (!chip.contains(e.target)) hideChip();
  });

  chip.addEventListener('click', function () { open(chip.__text || ''); });

  // ---------------------------------------------------------------- messages

  // `side` is which end of the thread this is — the learner or whoever is
  // answering — and deliberately not called `role`, which in here means the
  // agent on the other end. The answering side keeps the class name `tutor`
  // whoever fills it, so every rule written against the drawer still applies.
  function addMsg(side, text) {
    var wrap = el('div', 'tutor-msg ' + side);
    wrap.appendChild(el('div', 'tutor-msg-role', say(side === 'user' ? 'tutor.you' : role().reply)));
    var body = el('div', 'tutor-msg-body');
    if (side === 'tutor') showRich(body, text);
    else showPlain(body, text);
    wrap.appendChild(body);
    thread.appendChild(wrap);
    thread.scrollTop = thread.scrollHeight;
    return { wrap: wrap, body: body };
  }

  // ---------------------------------------------------------------- actions
  // What a learner can do with an answer once it has landed. Pinning keeps it
  // in the Lesson, copying takes it out of the Workspace, and regenerating says
  // the answer was understood and still did not help.

  function addActions(wrap, asked, getAnswer) {
    var row = el('div', 'tutor-actions');
    row.appendChild(pinButton(asked.question, getAnswer));
    // The answer as the Tutor wrote it — Markdown, not the nodes it became, so
    // what lands in the clipboard is what any other tool can read back.
    row.appendChild(copyButton('tutor-copy', say('tutor.act.copy'), getAnswer));

    var again = againButton('tutor-regen', say('tutor.act.regen'), wrap, asked, function () {
      dropTurn(asked.question, getAnswer());
    });
    again.title = say('tutor.act.regen.title');

    // Regenerating belongs to the answer at the end of the thread and to no
    // other: replacing one with answers already below it would leave those
    // answering a question that is no longer above them.
    var earlier = thread.querySelectorAll('.tutor-regen');
    for (var i = 0; i < earlier.length; i++) earlier[i].remove();

    row.appendChild(again);
    wrap.appendChild(row);
  }

  function pinButton(question, getAnswer) {
    var btn = el('button', 'tutor-act tutor-pin', say('tutor.act.pin'));
    btn.addEventListener('click', function () {
      if (btn.classList.contains('pinned')) return;
      var notes = loadNotes();
      notes.push({ q: question, a: getAnswer(), at: new Date().toISOString() });
      saveNotes(notes);
      btn.classList.add('pinned');
      btn.textContent = say('tutor.act.pinned');
      renderNotes();
    });
    return btn;
  }

  /**
   * Asking the same question a second time — an answer the learner turned down,
   * or a request that produced none. One button, because the two differ only in
   * what they are replacing.
   *
   * `discard` runs last of the checks and first of the work: what is being
   * replaced is given up only once the replacement is actually going. A service
   * that stopped between the answer and the click would otherwise cost the
   * learner the thing they still had — the answer, or the offline fallback
   * sitting in the same row as this button.
   */
  function againButton(cls, label, wrap, asked, discard) {
    var btn = el('button', 'tutor-act ' + cls, label);
    btn.addEventListener('click', function () {
      if (busy) return;
      if (!online) return flash(btn, say('tutor.act.offline'), label);
      if (discard) discard();
      wrap.remove();
      ask(asked, { quiet: true });
    });
    return btn;
  }

  // One clipboard path for everything the drawer copies: an answer, and the
  // well-formed prompt that both the offline composer and a failed request
  // offer.
  function copyButton(cls, label, getText) {
    var btn = el('button', 'tutor-act ' + cls, label);
    btn.addEventListener('click', function () {
      copyText(getText(), function () { flash(btn, say('tutor.act.copied'), label); });
    });
    return btn;
  }

  /** Say something on the button itself, then give it its name back. */
  function flash(btn, say, label) {
    btn.textContent = say;
    setTimeout(function () { btn.textContent = label; }, 1600);
  }

  // Reached through `window` rather than named bare, so a window without it is
  // a falsy value here rather than a ReferenceError — which is what the window
  // the suite mounts this in deliberately is.
  function copyText(text, done) {
    var nav = window.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  // Regenerating replaces an answer rather than adding one, so the pair it
  // replaces leaves the thread with it — otherwise the replay riding along with
  // the next question would carry the answer the learner just rejected.
  function dropTurn(question, answer) {
    var n = convo.turns.length;
    if (n < 2) return;
    var answered = convo.turns[n - 1];
    var wasAsked = convo.turns[n - 2];
    if (answered.role !== 'assistant' || answered.content !== answer) return;
    if (wasAsked.role !== 'user' || wasAsked.content !== question) return;
    convo.turns.length = n - 2;
    persistConvo();
    renderHistory();
  }

  // ---------------------------------------------------------------- send

  /**
   * A question and the passage it was about. The two travel together everywhere
   * a question can be asked a second time, because a retry has to ask about the
   * passage the question was about rather than about whatever happens to be
   * selected by the time it is clicked — and two bare strings side by side are
   * two strings a caller can swap.
   */
  function askedAbout(question, selection) {
    return { question: question, selection: selection || '' };
  }

  /**
   * The same question, written out for whatever tool the learner has instead.
   * Role-aware for the reason the request is: a submission taken to a Claude
   * Code session has to arrive as a submission, naming the page whose stored
   * Rubric is the only thing it may be judged against.
   */
  function buildCopyPrompt(asked) {
    var parts = [say(role().lead, { page: pagePath })];

    if (asked.selection) parts.push(say('tutor.copy.selection', { text: asked.selection }));
    if (convo.turns.length) {
      parts.push(say('tutor.copy.history', {
        turns: convo.turns.slice(-SEND_LAST_TURNS).map(function (t) {
          return say('tutor.copy.turn', {
            who: say(t.role === 'user' ? 'tutor.copy.me' : role().reply),
            text: t.content
          });
        }).join('\n\n')
      }));
    }

    // The one place the two prompts differ in shape rather than in wording: the
    // first thing handed to a Grader is work, and everything else is a question.
    if (convo.role === 'grader' && !convo.turns.length) {
      parts.push(say('tutor.copy.submission', { text: asked.question }));
    } else {
      parts.push(say('tutor.copy.question', { text: asked.question }));
    }

    parts.push(say(role().brief));
    return parts.join('\n\n');
  }

  /**
   * One thing the learner is handing over, online or not. `send` and a
   * submission from an assignment page both land here, so the clipboard
   * fallback is the same fallback rather than a second one written for grading.
   */
  function handIn(asked) {
    if (!online) {
      copyText(buildCopyPrompt(asked), function () {
        flash(sendBtn, say('tutor.act.copied'), say('tutor.send.copy'));
      });
      addMsg('user', asked.question);
      convo.turns.push({ role: 'user', content: asked.question });
      persistConvo();
      renderHistory();
      return;
    }
    ask(asked, {});
  }

  function send() {
    var question = input.value.trim();
    if (!question || busy) return;

    input.value = '';
    handIn(askedAbout(question, currentSelection));
  }

  /**
   * What an Assignment page hands in. The drawer owns everything past this
   * point — the thread, the transport, the wait, the fallback — so the
   * Component that collects a Submission never talks to the service itself.
   *
   * A submission always opens a thread of its own: it is the start of a line of
   * questioning, and folding it into whatever was open would leave a verdict
   * answering a lesson question.
   */
  window.Tutor = {
    /**
     * Hand in a Submission. Answers with what became of it, always as one of
     * these four words — never a boolean beside a string, because the caller
     * has something to say to the learner in each case and `false` says
     * nothing:
     *
     *   'sent'    it is with the Grader; the verdict is coming into the drawer
     *   'copied'  no service, so it went to the clipboard instead
     *   'busy'    a Submission is already in flight
     *   'empty'   there was nothing to hand in
     */
    grade: function (submission) {
      var text = ((submission && submission.text) || '').trim();
      if (!text) return 'empty';
      if (busy) return 'busy';

      startThread('', 'grader');
      open('');
      // Read before handing over, because that is the question the caller is
      // really asking: a Submission that went to the clipboard instead of to a
      // Grader has not been graded, and the page must not say it has.
      var reached = online;
      handIn(askedAbout(text, ''));
      return reached ? 'sent' : 'copied';
    }
  };

  /**
   * One question, from the request to whatever it ends in.
   *
   * `quiet` is set when the same question is being asked a second time — a
   * retry after a failure, or a regenerate. The learner asked once, so the
   * thread says so once.
   */
  function ask(asked, options) {
    var opts = options || {};
    if (busy || !online) return;

    busy = true;
    sendBtn.disabled = true;
    if (!opts.quiet) addMsg('user', asked.question);

    var out = addMsg('tutor', '');
    var caret = el('span', 'tutor-caret');
    markInFlight(out.body, caret);

    var tools = null;
    var acc = '';
    var settled = false;
    var stopped = false;
    var reader = null;
    // Shown at once, because the click has to have an effect immediately. What
    // it says until `open` arrives is only that the question was sent.
    var progress = addProgress(out.wrap, out.body, stop);

    // The request's hold on the drawer, given back: the clock stops, the caret
    // goes, the composer is free again. Not "the answer arrived" — a stop and a
    // failure both end here too.
    function endRequest() {
      if (settled) return;
      settled = true;
      progress.end();
      if (caret.parentNode) caret.remove();
      busy = false;
      sendBtn.disabled = false;
    }

    // Letting the stream go is what stops the work: the service kills its agent
    // when the request closes, so there is nothing to tell it here.
    function stop() {
      if (settled) return;
      stopped = true;
      if (reader && reader.cancel) { try { reader.cancel(); } catch (e) { /* already closed */ } }
      endRequest();
      out.wrap.classList.add('stopped');
      // Whatever arrived before the stop stays: half an answer is still an answer.
      offerRecovery(out.wrap, say('tutor.stopped'), '', asked);
    }

    function fail(headline, detail) {
      if (settled || stopped) return;
      endRequest();
      out.wrap.classList.add('failed');
      offerRecovery(out.wrap, headline, detail, asked);
    }

    fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: convo.role,
        threadId: convo.id,
        lang: pageLang(),
        lesson: pagePath,
        selection: asked.selection,
        question: asked.question,
        history: convo.turns.slice(-SEND_LAST_TURNS)
      })
    }).then(function (res) {
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      reader = res.body.getReader();
      // Stopped while the response was still on its way. The reader is taken
      // anyway, because cancelling it is what closes the connection — and that
      // connection closing is the only thing the service is watching.
      if (stopped) return reader.cancel();

      var decoder = new TextDecoder();
      var buf = '';

      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buf += decoder.decode(r.value, { stream: true });
          var idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            handleEvent(buf.slice(0, idx));
            buf = buf.slice(idx + 2);
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      if (stopped) return;
      // A transport failure is evidence about the service, so ask it rather
      // than guess: the answer is what puts the widget offline and starts it
      // watching for the service coming back.
      probe();
      fail(say('tutor.fail.connect'), err && err.message);
    }).then(endRequest);

    function handleEvent(block) {
      // Nothing more is rendered once this request has ended, whether it ended
      // in an answer, a failure or a stop — the tail of a stream must not write
      // over the thing the learner was left with.
      if (settled) return;

      var name = '', dataLine = '';
      block.split('\n').forEach(function (line) {
        if (line.indexOf('event: ') === 0) name = line.slice(7).trim();
        else if (line.indexOf('data: ') === 0) dataLine += line.slice(6);
      });
      if (!name) return;
      var data;
      try { data = JSON.parse(dataLine || '{}'); } catch (e) { return; }

      if (name === 'open') {
        progress.stage('accepted');
      } else if (name === 'delta') {
        acc += data.text || '';
        progress.stage('answering');
        // Re-rendered whole rather than appended to: a fence, a list or a link
        // only becomes what it is once the delta that closes it arrives. An
        // answer is a few thousand characters, so this is tens of rebuilds of a
        // small tree — cheap enough not to be worth a diffing scheme.
        showRich(out.body, acc);
        markInFlight(out.body, caret);
        thread.scrollTop = thread.scrollHeight;
      } else if (name === 'tool') {
        // The chips were decorative; the same events now also say what the wait
        // is for, which is the stage a learner reads as "it is working".
        progress.stage('reading', data.target ? say('tutor.stage.reading.at', { target: data.target }) : '');
        if (!tools) {
          tools = el('div', 'tutor-tools');
          out.wrap.insertBefore(tools, out.body);
        }
        var label = data.target
          ? say('tutor.tool', { name: data.name, target: data.target })
          : say('tutor.tool.bare', { name: data.name });
        tools.appendChild(el('span', 'tutor-tool', label));
      } else if (name === 'done') {
        endRequest();
        acc = data.answer || acc;
        showRich(out.body, acc);
        // A verdict is teaching signal, and the service has already written it
        // where the next Session reads. Saying so is what stops the learner
        // reporting it by hand, or assuming nobody will ever see it.
        if (data.record) {
          out.wrap.appendChild(el('div', 'tutor-recorded', say('tutor.recorded', { record: data.record })));
        }
        // Recorded as a pair only on success, so history never holds a dangling turn.
        convo.turns.push({ role: 'user', content: asked.question });
        convo.turns.push({ role: 'assistant', content: acc });
        addActions(out.wrap, asked, function () { return acc; });
        persistConvo();
        renderHistory();
        thread.scrollTop = thread.scrollHeight;
      } else if (name === 'error') {
        // The service is plainly up — it answered — so this is the Tutor
        // failing, and the widget stays online.
        fail(say('tutor.fail.answer'), failureWhy(data));
      }
    }
  }

  /**
   * Why a request ended with no answer: in the learner's language when the
   * service named a failure of its own, and in the agent's own words when the
   * agent is what failed. A code nothing has an entry for says nothing at all,
   * which leaves the headline — the same as a failure that came with no detail.
   *
   * `hasOwnProperty` rather than a truth test, so a code of `__proto__` finds
   * nothing rather than reaching up an inherited chain.
   */
  function failureWhy(data) {
    var code = data && typeof data.code === 'string' ? data.code : '';
    if (code && Object.prototype.hasOwnProperty.call(FAILED, code)) return say(FAILED[code]);
    return (data && data.message) || '';
  }

  /**
   * The row that reports the wait, which exists exactly as long as the request
   * does. That is what makes it the right home for the stop button: an
   * in-flight request always offers one, a finished one never does.
   */
  function addProgress(wrap, before, onStop) {
    var row = el('div', 'tutor-progress');
    row.setAttribute('data-stage', 'accepted');
    // Read out as it changes: a learner who cannot see the row is the one who
    // most needs to be told the difference between reading and answering.
    row.setAttribute('role', 'status');
    row.setAttribute('aria-live', 'polite');

    var label = el('span', 'tutor-stage', say(SENDING));
    var elapsed = el('span', 'tutor-elapsed', fmtElapsed(0));
    var stopBtn = el('button', 'tutor-cancel', say('tutor.stop'));
    stopBtn.title = say('tutor.stop.title');
    stopBtn.addEventListener('click', onStop);

    row.appendChild(label);
    row.appendChild(elapsed);
    row.appendChild(stopBtn);
    wrap.insertBefore(row, before);

    var started = Date.now();
    var tick = setInterval(function () {
      elapsed.textContent = fmtElapsed(Date.now() - started);
    }, 1000);

    return {
      stage: function (name, detail) {
        row.setAttribute('data-stage', name);
        label.textContent = detail || say(STAGES[name]);
      },
      end: function () {
        clearInterval(tick);
        row.remove();
      }
    };
  }

  function fmtElapsed(ms) {
    var s = Math.round(ms / 1000);
    if (s < 60) return say('tutor.elapsed.seconds', { seconds: s });
    return say('tutor.elapsed.minutes', { minutes: Math.floor(s / 60), seconds: s % 60 });
  }

  /**
   * How a request that produced no answer ends. A raw error string tells a
   * learner nothing they can act on, so a failure and a stop both end in the
   * two things they can do: ask again, or take the question elsewhere — the
   * same well-formed prompt the offline composer builds, since a request that
   * just failed to connect is a service that is, from here, down.
   */
  function offerRecovery(wrap, headline, detail, asked) {
    var box = el('div', 'tutor-recover');
    box.appendChild(el('div', 'tutor-recover-say', headline));
    // Kept, because it is the only thing that says *why* — just no longer the
    // whole of what the learner is given.
    if (detail) box.appendChild(el('div', 'tutor-recover-why', detail));

    var row = el('div', 'tutor-actions');
    row.appendChild(againButton('tutor-retry', say('tutor.act.retry'), wrap, asked, null));
    row.appendChild(copyButton('tutor-copyprompt', say('tutor.send.copy'), function () {
      return buildCopyPrompt(asked);
    }));

    box.appendChild(row);
    wrap.appendChild(box);
  }

  function fallbackCopy(text, cb) {
    var ta = el('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    try {
      ta.select();
      document.execCommand('copy');
      cb();
    } catch (e) { /* no clipboard here; the prompt is still in the thread */ }
    ta.remove();
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); }
  });
  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  });

  // ---------------------------------------------------------------- notes

  function renderNotes() {
    var host = document.querySelector('.lesson') || document.body;
    var existing = document.getElementById('tutor-notes');
    if (existing) existing.remove();

    var notes = loadNotes();
    if (!notes.length) return;

    var sec = el('section');
    sec.id = 'tutor-notes';
    var h = el('h2', null, say('tutor.notes.heading'));
    sec.appendChild(h);

    notes.forEach(function (n, i) {
      var card = el('div', 'tutor-note');
      var hd = el('div', 'tutor-note-head');
      hd.appendChild(el('span', null, say('tutor.notes.answer')));
      var del = el('button', 'tutor-note-del', say('tutor.notes.delete'));
      del.title = say('tutor.notes.delete.title');
      del.addEventListener('click', function () {
        var cur = loadNotes();
        cur.splice(i, 1);
        saveNotes(cur);
        renderNotes();
      });
      hd.appendChild(del);
      card.appendChild(hd);
      card.appendChild(el('div', 'tutor-note-q', say('tutor.notes.question', { question: n.q })));
      // Pinned answers render exactly as the live one did: saving an answer
      // must not cost the learner the code blocks in it.
      card.appendChild(showRich(el('div', 'tutor-note-a'), n.a));
      sec.appendChild(card);
    });

    host.appendChild(sec);
  }
})();
