/* ============================================================
   assignment.js — handing an Assignment in from the page it is written on,
   and getting the judgement back in the same place. Measures transfer, which
   is the one thing the page cannot judge for itself: the verdict comes from a
   Grader reading the Rubric stored on this page.
   Deps: tutor.js (the drawer it hands the Submission to — loaded by
         lesson-boot.js, so it is looked up when the button is pressed rather
         than at mount), lesson-boot.js again for the text it renders and the
         word that its tables have all arrived, style.css (design tokens),
         assignment.css. No library, no network: this file never talks to the
         service itself.

   Markup the author writes, on the Assignment's own page:

     <div class="assignment" data-assignment>
       <p class="assignment-task">Take a pipeline out of one of your own projects
          and say where each stage's input comes from.</p>

       <p class="assignment-fallback">When you are done, put it in submissions/
          and tell your teacher next session.</p>

       <script type="application/x-rubric">
       Done means:
       - named whose stdout each stage's stdin is
       - said why the middle stage needs no file
       The usual way to get it wrong:
       - copied the command out again without saying how the data moves
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

  /**
   * The mount, handed over rather than run — see `release` in lesson-boot.js
   * for why it waits, and why the queue is a bare global.
   */
  function whenTextArrives(mount) {
    var text = window.LearnerText;
    if (text && text.ready) return mount();
    (window.TEACH_WAITING = window.TEACH_WAITING || []).push(mount);
  }

  /** What this page says for `key`, in the learner's language. */
  function say(key, values) {
    return window.LearnerText.say(key, values);
  }

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

  /**
   * What the page says back, one key per answer the drawer can give. It is also
   * the list of answers there are: anything else is a drawer that grew a fifth
   * one, and the page must not leave the button looking like it did nothing.
   * `assignment.unknown` is what it says then, and is deliberately not in here
   * — a drawer answering `unknown` is still an answer nobody designed.
   */
  var OUTCOME = {
    sent: 'assignment.sent',
    copied: 'assignment.copied',
    busy: 'assignment.busy'
  };

  /**
   * The answers that mean the Submission is somewhere a Grader will reach it —
   * handed to a running service, or on the clipboard for the learner to paste.
   * Everything else in `OUTCOME` is a reason it did not go, and the page has to
   * say so rather than mark the work as handed in.
   */
  var HANDED_OVER = ['sent', 'copied'];

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
      parts.push(say('assignment.compose.paths', {
        paths: paths.map(function (p) {
          return '- ' + p;
        }).join('\n')
      }));
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
      say('assignment.answer'),
      say('assignment.answer.placeholder'),
      6
    );
    answer.setAttribute('maxlength', String(MAX_ANSWER));

    var paths = field(
      form,
      id + '-paths',
      say('assignment.paths'),
      say('assignment.paths.placeholder'),
      3
    );

    var note = el('p', 'assignment-note', say('assignment.paths.note'));
    form.appendChild(note);

    var actions = el('div', 'assignment-actions');
    var send = el('button', 'assignment-send', say('assignment.send'));
    var status = el('span', 'assignment-say');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    actions.appendChild(send);
    actions.appendChild(status);
    form.appendChild(actions);

    function refuse(why) {
      root.classList.add('is-refused');
      status.textContent = why;
    }

    send.addEventListener('click', function () {
      root.classList.remove('is-refused');

      var found = readPaths(paths.value || '');
      if (found.bad.length) {
        return refuse(say('assignment.path.outside', { path: found.bad[0] }));
      }
      if (found.over) return refuse(say('assignment.path.many', { max: MAX_PATHS }));

      var text = compose((answer.value || '').trim(), found.keep);
      if (!text) return refuse(say('assignment.empty'));
      if (text.length > MAX_SUBMISSION) return refuse(say('assignment.toolong'));

      // Looked up now rather than at mount: lesson-boot.js loads the drawer
      // asynchronously, so at mount it is legitimately not there yet.
      var drawer = window.Tutor;
      if (!drawer || typeof drawer.grade !== 'function') {
        return refuse(say('assignment.nodrawer'));
      }
      // The drawer says what became of it, because only it knows: with the
      // service stopped the Submission goes to the clipboard instead of to a
      // Grader, and a page that reported those the same way would be telling
      // the learner their work had been judged when it has not been.
      var outcome = drawer.grade({ text: text });
      // `hasOwnProperty` rather than a truth test: an answer that happened to
      // name something off Object's prototype — `constructor`, `toString` —
      // would otherwise put that on a learner's screen instead of a sentence.
      if (!Object.prototype.hasOwnProperty.call(OUTCOME, outcome)) {
        return refuse(say('assignment.unknown'));
      }
      if (HANDED_OVER.indexOf(outcome) < 0) return refuse(say(OUTCOME[outcome]));

      root.classList.add('is-sent');
      status.textContent = say(OUTCOME[outcome]);
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

  whenTextArrives(mountAll);
})();
