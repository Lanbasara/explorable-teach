/* ============================================================
   assignment.js — handing an Assignment in from the page it is written on,
   and getting the judgement back in the same place. Measures transfer, which
   is the one thing the page cannot judge for itself: the verdict comes from a
   Grader reading the Rubric stored on this page.
   Deps: tutor.js (the drawer it hands the Submission to — loaded by
         lesson-boot.js, so it is looked up when the button is pressed rather
         than at mount), style.css (design tokens), assignment.css. No library,
         no network: this file never talks to the service itself.

   Markup the author writes, on the Assignment's own page:

     <div class="assignment" data-assignment>
       <p class="assignment-task">把你自己项目里的一条管道拆开,说清楚每一段的
          输入从哪来。</p>

       <p class="assignment-fallback">做完之后把东西放进 submissions/,
          下次上课时告诉老师。</p>

       <script type="application/x-rubric">
       算做完了:
       - 指出了每一段的 stdin 是谁的 stdout
       - 说清楚了为什么中间那段不需要文件
       常见的错法:
       - 只把命令抄了一遍,没说数据怎么流
       </script>
     </div>

   Three things are required, and the page refuses to offer a hand-in without
   any of them:

     .assignment-task      what to do. A hand-in form above no task is a form.
     .assignment-fallback  what to do without this page's help. It is what the
                           form replaces, so it is also what a learner with
                           scripting off is left reading.
     the Rubric            a <script type="application/x-rubric"> block. It is
                           never rendered and never executed, so the learner
                           does not read it — and the Grader extracts it from
                           this file rather than being sent it, which is what
                           makes a judgement reproducible from the page alone.
                           No Rubric means nothing to judge against, and a
                           verdict reached without one is reached from memory.

   A Submission is evidence of the work, not necessarily the work: short
   answers go in the box, and anything larger goes into the workspace, named
   here by path. The Grader reads those paths itself with the read-only tools
   it already has, so nothing is uploaded and no boundary widens.

   Scripting off: the task and the fallback are plain paragraphs, and nothing
   is hidden until this file has taken the page over.
   ============================================================ */
(function () {
  'use strict';

  var RUBRIC = 'script[type="application/x-rubric"]';

  // The service's own cap on one question — `MAX_QUESTION` in tutor/server.js,
  // which this cannot read: a Component has no imports and has to work from
  // file://, where there is no service to ask. So it is a copy, and a copy that
  // drifts is a Submission refused by the service after the learner pressed the
  // button. `components.test.js` reads both numbers out of their own files and
  // holds them equal, which is the only thing that keeps them together.
  //
  // Enforced here at all because the learner has to find out while they can
  // still act on it — and the way to act on it is the paths box one line down.
  var MAX_SUBMISSION = 2000;
  var MAX_ANSWER = 1600;
  var MAX_PATHS = 8;

  var WHERE = 'submissions/';

  /**
   * What the page says back, one entry per thing the drawer can answer with —
   * plus the one it cannot, because a drawer that grew a fifth answer must not
   * leave the button looking like it did nothing.
   */
  var SAID = {
    sent: '已交出去了。判定会出现在右边的抽屉里，也会记进 learning-records/。',
    copied: '老师服务没开着。提问已经复制走了——贴进 Claude Code，让 grader 子 agent 判。',
    busy: '上一份还在判，等它答完了再交。',
    empty: '写点什么，或者写下你把做出来的东西放在哪了。',
    unknown: '这一份没交出去。再试一下。'
  };

  var seq = 0;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function field(host, id, label, hint, rows) {
    var tag = el('label', 'assignment-label', label);
    tag.setAttribute('for', id);
    host.appendChild(tag);

    var box = el('textarea', 'assignment-box');
    box.id = id;
    box.rows = rows;
    box.placeholder = hint;
    host.appendChild(box);
    return box;
  }

  /**
   * The lines of the paths box, split into what can be handed over and what
   * cannot. A path out of the workspace is refused rather than cleaned up: the
   * learner meant something by it, and silently rewriting it would hand the
   * Grader a file nobody asked it to read.
   */
  function readPaths(text) {
    var keep = [];
    var bad = [];
    text.split('\n').forEach(function (line) {
      var p = line.trim().replace(/^[-*]\s+/, '');
      if (!p) return;
      if (p.charAt(0) === '/' || /(^|\/)\.\.(\/|$)/.test(p) || /^[a-zA-Z][\w+.-]*:/.test(p)) bad.push(p);
      else keep.push(p);
    });
    return { keep: keep.slice(0, MAX_PATHS), bad: bad, over: keep.length > MAX_PATHS };
  }

  /** One Submission: the short answer, and where the rest of it is. */
  function compose(answer, paths) {
    var parts = [];
    if (answer) parts.push(answer);
    if (paths.length) {
      parts.push('做出来的东西我放在工作区里了，请自己读：\n' + paths.map(function (p) {
        return '- ' + p;
      }).join('\n'));
    }
    return parts.join('\n\n');
  }

  function mount(root) {
    var task = root.querySelector('.assignment-task');
    var fallback = root.querySelector('.assignment-fallback');
    var rubric = root.querySelector(RUBRIC);

    // Same rule as the two outcomes of a Checkpoint: a page that cannot do the
    // whole job does not take over half of it. Without a task there is nothing
    // to hand in against, without a fallback the learner whose scripts never
    // ran is left with nowhere to go, and without a Rubric the judgement would
    // have to come from somewhere other than this page — which is the one
    // thing grading is not allowed to do.
    if (!task || !fallback) return;
    if (!rubric || !rubric.textContent.trim()) return;

    var id = 'assignment-' + (seq += 1);

    var form = el('div', 'assignment-handin');

    var answer = field(
      form,
      id + '-answer',
      '短答',
      '直接写在这里。写不下的东西放进 ' + WHERE + '，路径填到下面一栏。',
      6
    );
    answer.setAttribute('maxlength', String(MAX_ANSWER));

    var paths = field(
      form,
      id + '-paths',
      '放在工作区里的东西',
      WHERE + '0003-pipes/notes.md\n' + WHERE + '0003-pipes/run.log',
      3
    );

    var note = el(
      'p',
      'assignment-note',
      '一行一个路径，从教案目录算起。评分老师会自己把它们读掉——不用上传，也不用贴进来。'
    );
    form.appendChild(note);

    var actions = el('div', 'assignment-actions');
    var send = el('button', 'assignment-send', '交上去');
    var say = el('span', 'assignment-say');
    say.setAttribute('role', 'status');
    say.setAttribute('aria-live', 'polite');
    actions.appendChild(send);
    actions.appendChild(say);
    form.appendChild(actions);

    function refuse(why) {
      root.classList.add('is-refused');
      say.textContent = why;
    }

    send.addEventListener('click', function () {
      root.classList.remove('is-refused');

      var found = readPaths(paths.value || '');
      if (found.bad.length) {
        return refuse('路径要写成教案目录里的相对路径，像 ' + WHERE + 'xxx.md 这样：' + found.bad[0] + ' 不行。');
      }
      if (found.over) return refuse('一次最多交 ' + MAX_PATHS + ' 个路径，挑要紧的。');

      var text = compose((answer.value || '').trim(), found.keep);
      if (!text) return refuse(SAID.empty);
      if (text.length > MAX_SUBMISSION) {
        return refuse('这一栏装不下了。把它放进 ' + WHERE + '，在下面写上路径。');
      }

      // Looked up now rather than at mount: lesson-boot.js loads the drawer
      // asynchronously, so at mount it is legitimately not there yet.
      var drawer = window.Tutor;
      if (!drawer || typeof drawer.grade !== 'function') {
        return refuse('问答助教还没就位，稍等一下再交。');
      }
      // The drawer says what became of it, because only it knows: with the
      // service stopped the Submission goes to the clipboard instead of to a
      // Grader, and a page that reported those the same way would be telling
      // the learner their work had been judged when it has not been.
      var outcome = drawer.grade({ text: text });
      if (outcome !== 'sent' && outcome !== 'copied') return refuse(SAID[outcome] || SAID.unknown);

      root.classList.add('is-sent');
      say.textContent = SAID[outcome];
    });

    // The form is what the fallback paragraph was standing in for, so it goes
    // in its place rather than beside it. Only a direct child is a legal
    // insertion point, so an author who wrapped their fallback means "put it at
    // the end" rather than a thrown error.
    root.insertBefore(form, fallback.parentNode === root ? fallback : null);
    fallback.hidden = true;

    root.classList.add('is-live');
  }

  function mountAll() {
    var roots = document.querySelectorAll('[data-assignment]');
    for (var i = 0; i < roots.length; i++) mount(roots[i]);
  }

  // Lessons put component scripts at the end of <body>, but lesson-boot.js
  // loads scripts dynamically, by which time DOMContentLoaded has passed.
  if (document.body) mountAll();
  else document.addEventListener('DOMContentLoaded', mountAll);
})();
