/* ============================================================
   AI 问答助教 — in-page tutor widget
   Requires: assets/tutor.css
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

  var online = false;
  var busy = false;
  var currentSelection = '';

  // One thread = one line of questioning. Turns ride along in each request
  // (bounded replay), so the server stays stateless and never resumes a session.
  var convo = { id: null, selection: null, turns: [] };
  var SEND_LAST_TURNS = 8; // server caps to 6; this just keeps the body small

  function newThreadId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'th-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function startThread(sel) {
    convo.id = newThreadId();
    convo.selection = sel;
    convo.turns = [];
    while (thread.firstChild) thread.removeChild(thread.firstChild);
  }

  // ---------------------------------------------------------------- utils

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
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
  var newTopicBtn = el('button', 'tutor-newtopic', '新话题');
  newTopicBtn.title = '清空这段对话，重新开始问';
  var closeBtn = el('button', 'tutor-close', '×');
  closeBtn.setAttribute('aria-label', '关闭');
  head.appendChild(title);
  head.appendChild(newTopicBtn);
  head.appendChild(closeBtn);

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
  drawer.appendChild(quote);
  drawer.appendChild(thread);
  drawer.appendChild(foot);

  var fab = el('button', 'tutor-fab');
  fab.appendChild(document.createTextNode('🎓 问老师'));

  var chip = el('div', 'tutor-chip');
  chip.appendChild(document.createTextNode('🎓 问老师'));

  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    document.body.appendChild(fab);
    document.body.appendChild(chip);
    renderNotes();
    probe();
  });

  // ---------------------------------------------------------------- health

  function probe() {
    if (!/^https?:$/.test(location.protocol)) return setOffline();
    fetch('/api/health', { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (j) { if (j && j.ok) setOnline(); else setOffline(); })
      .catch(setOffline);
  }

  function setOnline() {
    online = true;
    status.textContent = '在线';
    status.className = 'tutor-status live';
    sendBtn.textContent = '发送';
    hint.textContent = '';
  }

  function setOffline() {
    online = false;
    status.textContent = '离线';
    status.className = 'tutor-status off';
    sendBtn.textContent = '📋 复制提问';
    hint.textContent = '';
    hint.appendChild(document.createTextNode('老师服务未启动。在教案目录运行 '));
    var c = el('code', null, START_CMD);
    hint.appendChild(c);
    hint.appendChild(document.createTextNode(' 后刷新，即可在页面内直接问答。'));
  }

  // ---------------------------------------------------------------- open/close

  function open(selText) {
    currentSelection = selText || '';
    // Same passage reopened -> continue. Different passage -> fresh thread.
    if (!convo.id || currentSelection !== convo.selection) startThread(currentSelection);
    if (currentSelection) {
      quote.textContent = currentSelection;
      quote.classList.remove('hidden');
    } else {
      quote.textContent = '';
      quote.classList.add('hidden');
    }
    backdrop.classList.add('open');
    drawer.classList.add('open');
    fab.classList.add('hidden');
    hideChip();
    setTimeout(function () { input.focus(); }, 260);
  }

  function close() {
    backdrop.classList.remove('open');
    drawer.classList.remove('open');
    fab.classList.remove('hidden');
  }

  newTopicBtn.addEventListener('click', function () {
    startThread(currentSelection);
    input.focus();
  });
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  fab.addEventListener('click', function () { open(''); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('open')) close();
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
    wrap.appendChild(el('div', 'tutor-msg-role', role === 'user' ? '你' : role === 'error' ? '出错' : '助教'));
    var body = el('div', 'tutor-msg-body');
    body.textContent = text || '';
    wrap.appendChild(body);
    thread.appendChild(wrap);
    thread.scrollTop = thread.scrollHeight;
    return { wrap: wrap, body: body };
  }

  function addPin(wrap, question, getAnswer) {
    var btn = el('button', 'tutor-pin', '📌 钉住');
    btn.addEventListener('click', function () {
      if (btn.classList.contains('pinned')) return;
      var notes = loadNotes();
      notes.push({ q: question, a: getAnswer(), at: new Date().toISOString() });
      saveNotes(notes);
      btn.classList.add('pinned');
      btn.textContent = '✓ 已钉住';
      renderNotes();
    });
    wrap.appendChild(btn);
  }

  // ---------------------------------------------------------------- send

  function buildCopyPrompt(question) {
    var parts = ['我正在读这一课：lessons/' + lessonPath];
    if (currentSelection) parts.push('选中的原文：\n"""\n' + currentSelection + '\n"""');
    if (convo.turns.length) {
      parts.push('我们前面已经聊过：\n' + convo.turns.slice(-SEND_LAST_TURNS).map(function (t) {
        return (t.role === 'user' ? '我：' : '助教：') + t.content;
      }).join('\n\n'));
    }
    parts.push('我的问题：' + question);
    parts.push('（请以问答助教的身份回答：先读 NOTES.md 和 MISSION.md 了解我的偏好和目标，渐进式披露，只讲我问的这一点。）');
    return parts.join('\n\n');
  }

  function send() {
    var question = input.value.trim();
    if (!question || busy) return;

    if (!online) {
      var prompt = buildCopyPrompt(question);
      var done = function () {
        sendBtn.textContent = '✓ 已复制';
        setTimeout(function () { sendBtn.textContent = '📋 复制提问'; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(prompt).then(done, function () { fallbackCopy(prompt, done); });
      } else {
        fallbackCopy(prompt, done);
      }
      addMsg('user', question);
      convo.turns.push({ role: 'user', content: question });
      input.value = '';
      return;
    }

    busy = true;
    sendBtn.disabled = true;
    addMsg('user', question);
    input.value = '';

    var out = addMsg('tutor', '');
    var caret = el('span', 'tutor-caret');
    out.body.appendChild(caret);
    var tools = null;
    var acc = '';
    var askedSelection = currentSelection;

    fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'tutor',
        threadId: convo.id,
        lesson: 'lessons/' + lessonPath,
        selection: askedSelection,
        question: question,
        history: convo.turns.slice(-SEND_LAST_TURNS)
      })
    }).then(function (res) {
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      var reader = res.body.getReader();
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
      caret.remove();
      out.wrap.className = 'tutor-msg error';
      out.body.textContent = '连接老师服务失败：' + err.message;
    }).then(function () {
      busy = false;
      sendBtn.disabled = false;
      if (caret.parentNode) caret.remove();
    });

    function handleEvent(block) {
      var name = '', dataLine = '';
      block.split('\n').forEach(function (line) {
        if (line.indexOf('event: ') === 0) name = line.slice(7).trim();
        else if (line.indexOf('data: ') === 0) dataLine += line.slice(6);
      });
      if (!name) return;
      var data;
      try { data = JSON.parse(dataLine || '{}'); } catch (e) { return; }

      if (name === 'delta') {
        acc += data.text || '';
        out.body.textContent = acc;
        out.body.appendChild(caret);
        thread.scrollTop = thread.scrollHeight;
      } else if (name === 'tool') {
        if (!tools) {
          tools = el('div', 'tutor-tools');
          out.wrap.insertBefore(tools, out.body);
        }
        var label = data.target ? '📖 ' + data.name + ' · ' + data.target : '📖 ' + data.name;
        tools.appendChild(el('span', 'tutor-tool', label));
      } else if (name === 'done') {
        caret.remove();
        acc = data.answer || acc;
        out.body.textContent = acc;
        // Recorded as a pair only on success, so history never holds a dangling turn.
        convo.turns.push({ role: 'user', content: question });
        convo.turns.push({ role: 'assistant', content: acc });
        addPin(out.wrap, question, function () { return acc; });
        thread.scrollTop = thread.scrollHeight;
      } else if (name === 'error') {
        caret.remove();
        out.wrap.className = 'tutor-msg error';
        out.body.textContent = data.message || '出错了';
      }
    }
  }

  function fallbackCopy(text, cb) {
    var ta = el('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) { /* noop */ }
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
      card.appendChild(el('div', 'tutor-note-a', n.a));
      sec.appendChild(card);
    });

    host.appendChild(sec);
  }
})();
