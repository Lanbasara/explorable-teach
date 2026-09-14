/* ============================================================
   predict-reveal.js — ask for a prediction, then show what actually
   happens. Reach for it where you can write down the wrong answer this Learner
   is likely to give: that wrong guess meeting the real answer is what makes the
   real answer stick, and a question whose wrong answer nobody can name collects
   a guess instead of confronting anything.
   Deps: predict-reveal.css, style.css (design tokens), lesson-boot.js (the
         text it renders, and the word that its tables have all arrived). No
         library, no network, no server: works from file://.

   Markup the Lesson author writes:

     <div class="predict" data-predict>
       <p class="predict-question">Which end of a pipe gets created first?</p>
       <div class="predict-answer">
         <p>The shell forks both children first, then joins them with the pipe.</p>
       </div>
     </div>

   The guess box and the reveal button are built here, so the author writes
   only the question and the answer.

   Scripting off: question and answer are both plain text, in that order.
   The answer is hidden by this file, never by the stylesheet.

   Guessing is nudged, not enforced. One nudge, then the answer — a learner
   who is genuinely stuck learns nothing from a locked button, and being
   stuck is exactly when they need to see it.
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

  function mount(root) {
    var answer = root.querySelector('.predict-answer');
    if (!answer) return;

    answer.hidden = true;

    var controls = document.createElement('div');
    controls.className = 'predict-controls';

    var guess = document.createElement('textarea');
    guess.className = 'predict-guess';
    guess.setAttribute('rows', '2');
    guess.setAttribute('placeholder', say('predict.guess.placeholder'));
    guess.setAttribute('aria-label', say('predict.guess.label'));

    var button = document.createElement('button');
    button.className = 't-btn predict-reveal';
    button.setAttribute('type', 'button');
    button.textContent = say('predict.reveal');

    controls.appendChild(guess);
    controls.appendChild(button);
    // Only a direct child is a legal insertion point; an author who wrapped the
    // answer in a <div> gets the controls at the end rather than an exception.
    root.insertBefore(controls, answer.parentNode === root ? answer : null);

    var nudge = null;
    var nudged = false;

    function showNudge() {
      nudged = true;
      root.classList.add('is-nudged');
      if (!nudge) {
        nudge = document.createElement('p');
        nudge.className = 'predict-nudge';
        nudge.setAttribute('role', 'status');
        nudge.textContent = say('predict.nudge');
        controls.appendChild(nudge);
      }
      button.textContent = say('predict.reveal.anyway');
    }

    function reveal() {
      answer.hidden = false;
      root.classList.add('is-revealed');
      // The guess stays on screen next to the answer: comparing the two is
      // the whole exercise. Read-only so it cannot be quietly corrected.
      guess.setAttribute('readonly', '');
      button.setAttribute('disabled', '');
      button.textContent = say('predict.revealed');
      if (nudge) nudge.hidden = true;
    }

    button.addEventListener('click', function () {
      if (!guess.value.trim() && !nudged) return showNudge();
      reveal();
    });

    root.classList.add('is-live');
  }

  function mountAll() {
    var roots = document.querySelectorAll('[data-predict]');
    for (var i = 0; i < roots.length; i++) mount(roots[i]);
  }

  whenTextArrives(mountAll);
})();
