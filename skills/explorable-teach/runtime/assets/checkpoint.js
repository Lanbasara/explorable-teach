/* ============================================================
   checkpoint.js — the gate at the end of a Unit, judged by the page before
   the Unit closes. Measures whether the Unit may be closed, which is a
   different question from whether any one idea landed.
   Deps: exercise.js (the questions it counts — anywhere on the page; the order
         the two scripts load in does not matter, for the reason at the foot of
         this comment), style.css (design tokens), checkpoint.css, lesson-boot.js
         (the text it renders, and the word that its tables have all arrived). No
         library, no network, no server: works from file://.

   Markup the author writes, on a page of its own at the Unit's end:

     <div class="checkpoint" data-checkpoint>
       <p class="checkpoint-lead">Answer from memory. An answer you can look
          up in the lesson is not one you have learnt.</p>

       <div class="exercise" data-exercise>…</div>   <!-- 2-5 of them -->

       <p class="checkpoint-pass">You may close this one. Tell your teacher how it went.</p>
       <p class="checkpoint-again">Go back to <a href="0003-fork-exec.html">the lesson</a> and read it again.</p>
     </div>

   Every question has to be right. A gate with a pass mark is a score, and a
   score does not answer *may we move on?* — so a question that may be got
   wrong while the Unit still closes is a question that does not belong here.

   Scripting off: the questions are plain text, and both outcomes are there to
   read as the two halves of one sentence — right, and you are done; wrong, and
   here is where to go back to. Nothing is hidden until this file has taken the
   page over.

   The verdict is read off the questions rather than reported by them. An
   Exercise marks its own root the instant it is answered, in a handler on the
   option; this listens on the container, where the same event arrives on its
   way up — so by the time it looks, the answer is already recorded, whichever
   of the two scripts ran first. Nothing here reaches into exercise.js, and
   exercise.js knows nothing about this.
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

  function each(nodes, fn) {
    for (var i = 0; i < nodes.length; i++) fn(nodes[i], i);
  }

  function mount(root) {
    var questions = root.querySelectorAll('.exercise');
    // A gate with nothing to judge judges nothing, and must not say otherwise.
    if (!questions.length) return;

    var pass = root.querySelector('.checkpoint-pass');
    var again = root.querySelector('.checkpoint-again');
    // Same rule as the questions: a gate that cannot give its verdict has
    // nothing to take over. Both outcomes are required, not one — a page that
    // can say "you are done" but not "go back", or the reverse, counts answers
    // and then goes quiet on half the Learners who reach the end of it.
    if (!pass || !again) return;

    pass.hidden = true;
    again.hidden = true;

    var progress = document.createElement('p');
    progress.className = 'checkpoint-progress';
    progress.setAttribute('role', 'status');
    // Above the outcome it will be replaced by. Only a direct child is a legal
    // insertion point, so an author who wrapped their outcomes means "put it at
    // the end" rather than a thrown error.
    var before = [pass, again].filter(function (node) {
      return node.parentNode === root;
    })[0];
    root.insertBefore(progress, before || null);

    var judged = false;

    function counting(state) {
      var n = 0;
      each(questions, function (question) {
        if (question.classList.contains(state)) n++;
      });
      return n;
    }

    function review() {
      if (judged) return;

      var answered = counting('is-answered');
      if (answered < questions.length) {
        progress.textContent = say('checkpoint.answered', { n: answered, of: questions.length });
        return;
      }

      judged = true;
      var right = counting('is-correct');
      var passed = right === questions.length;

      root.classList.add('is-judged', passed ? 'is-passed' : 'is-failed');
      var outcome = passed ? pass : again;
      outcome.hidden = false;

      // The score, not just the verdict: it is what the learner reports to the
      // Teacher, and what the Learning Record is written from.
      progress.textContent = say('checkpoint.right', { n: right, of: questions.length });
    }

    root.addEventListener('click', review);
    root.addEventListener('keydown', review);

    root.classList.add('is-live');
    review();
  }

  function mountAll() {
    each(document.querySelectorAll('[data-checkpoint]'), mount);
  }

  whenTextArrives(mountAll);
})();
