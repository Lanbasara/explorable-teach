/* ============================================================
   AI 问答助教 — in-page tutor widget
   Requires: assets/tutor.css, assets/rich-text.js
   Backend : tutor/server.js   ->  node tutor/server.js
   Degrades: if the server is unreachable (e.g. opened via file://),
             the send button becomes "copy a well-formed prompt".
   ============================================================ */

(function () {
  'use strict';

  var SUGGESTIONS = ['这段什么意思', '换个类比讲', '为什么不是这样', '和前面哪节课有关'];
  var START_CMD = 'node tutor/server.js';

  var lessonPath = (function () {
    var m = location.pathname.match(/[^/]+$/);
    return m ? decodeURIComponent(m[0]) : 'lesson';
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
    accepted: '老师已接到问题，正在启动…',
    reading: '老师正在读教案…',
    answering: '老师正在作答…'
  };
  // What the row says before the service has said anything. It is the same
  // stage — the question is away — but the claim that the service *has* it
  // waits for the service to say so, which is what the `open` event is.
  var SENDING = '正在发送…';

  // One thread = one line of questioning. Turns ride along in each request
  // (bounded replay), so the server stays stateless and never resumes a session.
  var convo = { id: null, selection: null, turns: [] };
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
    var rec = { id: convo.id, selection: convo.selection || '', turns: convo.turns, at: Date.now() };
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
  function startThread(sel) {
    persistConvo();
    convo.id = newThreadId();
    convo.selection = sel || '';
    convo.turns = [];
    renderThread();
    renderHistory();
  }

  function loadThread(rec) {
    persistConvo();
    convo.id = rec.id;
    convo.selection = rec.selection || '';
    convo.turns = (rec.turns || []).slice();
    currentSelection = convo.selection;
    setActive(convo.id);
    renderThread();
    renderQuote();
    renderHistory();
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

  // The one place an answer becomes nodes. Every path that shows one — the
  // stream, the thread restored from storage, a pinned answer read back into
  // the lesson — goes through here, so none of them is a degraded version of
  // the others.
  //
  // rich-text.js is loaded by lesson-boot.js, which carries on past a script
  // that failed to load. If that happened, the answer is still shown, as the
  // text it already was: a legible answer beats no answer.
  function showRich(host, text) {
    while (host.firstChild) host.removeChild(host.firstChild);
    if (!window.RichText) return showPlain(host, text);

    window.RichText.render(text, NODES).forEach(function (node) { host.appendChild(node); });
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
  drawer.setAttribute('aria-label', 'AI 问答助教');

  var head = el('div', 'tutor-head');
  var title = el('div', 'tutor-title');
  title.appendChild(document.createTextNode('🎓 问答助教'));
  var status = el('span', 'tutor-status', '检测中');
  title.appendChild(status);
  var histBtn = el('button', 'tutor-newtopic tutor-hist-btn', '历史');
  histBtn.title = '回到之前问过的话题';
  var newTopicBtn = el('button', 'tutor-newtopic', '新话题');
  newTopicBtn.title = '收起这段对话，另起一个话题（不会丢，可在「历史」里找回）';
  var closeBtn = el('button', 'tutor-close', '×');
  closeBtn.setAttribute('aria-label', '关闭');
  head.appendChild(title);
  head.appendChild(histBtn);
  head.appendChild(newTopicBtn);
  head.appendChild(closeBtn);

  var histPanel = el('div', 'tutor-histpanel');

  var quote = el('div', 'tutor-quote hidden');
  var thread = el('div', 'tutor-thread');

  var foot = el('div', 'tutor-foot');
  var suggestions = el('div', 'tutor-suggestions');
  SUGGESTIONS.forEach(function (s) {
    var b = el('button', 'tutor-suggest', s);
    b.addEventListener('click', function () { input.value = s; send(); });
    suggestions.appendChild(b);
  });

  var inputRow = el('div', 'tutor-input-row');
  var input = el('textarea', 'tutor-input');
  input.placeholder = '问点什么…（⌘/Ctrl + Enter 发送）';
  input.rows = 1;
  var sendBtn = el('button', 'tutor-send', '发送');
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
  fab.appendChild(document.createTextNode('🎓 问老师'));

  var chip = el('div', 'tutor-chip');
  chip.appendChild(document.createTextNode('🎓 问老师'));

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
    convo.selection = rec.selection || '';
    convo.turns = (rec.turns || []).slice();
    currentSelection = convo.selection;
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

  function probe() {
    if (!/^https?:$/.test(location.protocol)) return setOffline();
    fetch('/api/health', { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (j) { if (j && j.ok) setOnline(); else setOffline(); })
      .catch(function () { setOffline(); });
  }

  // Nothing to wait for on file:// — there is no service that could come up,
  // so the offline state there is final rather than pending.
  function watchHealth() {
    if (healthTimer || !/^https?:$/.test(location.protocol)) return;
    healthTimer = setInterval(probe, HEALTH_POLL_MS);
  }

  function unwatchHealth() {
    if (!healthTimer) return;
    clearInterval(healthTimer);
    healthTimer = null;
  }

  // Both are written idempotently, because once it is polling they are called
  // every few seconds: a header rebuilt on every probe would stomp the "✓ 已复制"
  // the learner is still reading.
  var shown = '';

  function setOnline() {
    unwatchHealth();
    online = true;
    if (shown === 'online') return;
    shown = 'online';
    status.textContent = '在线';
    status.className = 'tutor-status live';
    sendBtn.textContent = '发送';
    hint.textContent = '';
  }

  function setOffline() {
    online = false;
    watchHealth();
    if (shown === 'offline') return;
    shown = 'offline';
    status.textContent = '离线';
    status.className = 'tutor-status off';
    sendBtn.textContent = '📋 复制提问';
    hint.textContent = '';
    hint.appendChild(document.createTextNode('老师服务未启动。在教案目录运行 '));
    var c = el('code', null, START_CMD);
    hint.appendChild(c);
    hint.appendChild(document.createTextNode('，启动后这里会自己连上。'));
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
  // page was the exact accident that lost conversations. Use × or Esc.
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
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    return Math.floor(s / 86400) + ' 天前';
  }

  function threadLabel(rec) {
    var first = '';
    for (var i = 0; i < rec.turns.length; i++) {
      if (rec.turns[i].role === 'user') { first = rec.turns[i].content; break; }
    }
    if (!first) first = rec.selection || '（空话题）';
    return first.length > 42 ? first.slice(0, 42) + '…' : first;
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
      histPanel.appendChild(el('div', 'tutor-histempty', '还没有问过什么。'));
      return;
    }

    list.forEach(function (rec) {
      var item = el('button', 'tutor-histitem');
      if (rec.id === convo.id) item.classList.add('current');
      item.appendChild(el('div', 'tutor-histq', threadLabel(rec)));
      var meta = el('div', 'tutor-histmeta');
      var n = rec.turns.filter(function (t) { return t.role === 'user'; }).length;
      meta.textContent = n + ' 问 · ' + relTime(rec.at);
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

  function addMsg(role, text) {
    var wrap = el('div', 'tutor-msg ' + role);
    wrap.appendChild(el('div', 'tutor-msg-role', role === 'user' ? '你' : '助教'));
    var body = el('div', 'tutor-msg-body');
    if (role === 'tutor') showRich(body, text);
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
    row.appendChild(copyButton('tutor-copy', '📋 复制', getAnswer));

    var again = againButton('tutor-regen', '↻ 重答', wrap, asked, function () {
      dropTurn(asked.question, getAnswer());
    });
    again.title = '让老师换一种说法重答';

    // Regenerating belongs to the answer at the end of the thread and to no
    // other: replacing one with answers already below it would leave those
    // answering a question that is no longer above them.
    var earlier = thread.querySelectorAll('.tutor-regen');
    for (var i = 0; i < earlier.length; i++) earlier[i].remove();

    row.appendChild(again);
    wrap.appendChild(row);
  }

  function pinButton(question, getAnswer) {
    var btn = el('button', 'tutor-act tutor-pin', '📌 钉住');
    btn.addEventListener('click', function () {
      if (btn.classList.contains('pinned')) return;
      var notes = loadNotes();
      notes.push({ q: question, a: getAnswer(), at: new Date().toISOString() });
      saveNotes(notes);
      btn.classList.add('pinned');
      btn.textContent = '✓ 已钉住';
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
      if (!online) return flash(btn, '服务未启动', label);
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
      copyText(getText(), function () { flash(btn, '✓ 已复制', label); });
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

  function buildCopyPrompt(asked) {
    var parts = ['我正在读这一课：lessons/' + lessonPath];
    if (asked.selection) parts.push('选中的原文：\n"""\n' + asked.selection + '\n"""');
    if (convo.turns.length) {
      parts.push('我们前面已经聊过：\n' + convo.turns.slice(-SEND_LAST_TURNS).map(function (t) {
        return (t.role === 'user' ? '我：' : '助教：') + t.content;
      }).join('\n\n'));
    }
    parts.push('我的问题：' + asked.question);
    parts.push('（请以问答助教的身份回答：先读 NOTES.md 和 MISSION.md 了解我的偏好和目标，渐进式披露，只讲我问的这一点。）');
    return parts.join('\n\n');
  }

  function send() {
    var question = input.value.trim();
    if (!question || busy) return;

    if (!online) {
      copyText(buildCopyPrompt(askedAbout(question, currentSelection)), function () {
        flash(sendBtn, '✓ 已复制', '📋 复制提问');
      });
      addMsg('user', question);
      convo.turns.push({ role: 'user', content: question });
      persistConvo();
      renderHistory();
      input.value = '';
      return;
    }

    input.value = '';
    ask(askedAbout(question, currentSelection), {});
  }

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
      offerRecovery(out.wrap, '已停止。', '', asked);
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
        role: 'tutor',
        threadId: convo.id,
        lesson: 'lessons/' + lessonPath,
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
      fail('没能连上老师服务。', err && err.message);
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
        progress.stage('reading', data.target ? '老师正在读 ' + data.target : '');
        if (!tools) {
          tools = el('div', 'tutor-tools');
          out.wrap.insertBefore(tools, out.body);
        }
        var label = data.target ? '📖 ' + data.name + ' · ' + data.target : '📖 ' + data.name;
        tools.appendChild(el('span', 'tutor-tool', label));
      } else if (name === 'done') {
        endRequest();
        acc = data.answer || acc;
        showRich(out.body, acc);
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
        fail('老师这次没能答上来。', data.message);
      }
    }
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

    var label = el('span', 'tutor-stage', SENDING);
    var elapsed = el('span', 'tutor-elapsed', fmtElapsed(0));
    var stopBtn = el('button', 'tutor-cancel', '停止');
    stopBtn.title = '停止这次提问';
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
        label.textContent = detail || STAGES[name];
      },
      end: function () {
        clearInterval(tick);
        row.remove();
      }
    };
  }

  function fmtElapsed(ms) {
    var s = Math.round(ms / 1000);
    if (s < 60) return s + ' 秒';
    return Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒';
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
    row.appendChild(againButton('tutor-retry', '↻ 再试一次', wrap, asked, null));
    row.appendChild(copyButton('tutor-copyprompt', '📋 复制提问', function () {
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
    var h = el('h2', null, '📌 我钉住的问答');
    sec.appendChild(h);

    notes.forEach(function (n, i) {
      var card = el('div', 'tutor-note');
      var hd = el('div', 'tutor-note-head');
      hd.appendChild(el('span', null, '助教回答'));
      var del = el('button', 'tutor-note-del', '×');
      del.title = '删除这条';
      del.addEventListener('click', function () {
        var cur = loadNotes();
        cur.splice(i, 1);
        saveNotes(cur);
        renderNotes();
      });
      hd.appendChild(del);
      card.appendChild(hd);
      card.appendChild(el('div', 'tutor-note-q', 'Q: ' + n.q));
      // Pinned answers render exactly as the live one did: saving an answer
      // must not cost the learner the code blocks in it.
      card.appendChild(showRich(el('div', 'tutor-note-a'), n.a));
      sec.appendChild(card);
    });

    host.appendChild(sec);
  }
})();
