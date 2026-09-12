/* ============================================================
   predict-reveal.js — ask for a prediction, then show what actually
   happens. The strongest teaching signal in the catalog: a wrong guess
   followed by the real answer is what makes the real answer stick.
   Deps: predict-reveal.css, style.css (design tokens). No library, no
         network, no server: works from file://.

   Markup the Lesson author writes:

     <div class="predict" data-predict>
       <p class="predict-question">管道两端的进程,是谁先被创建的?</p>
       <div class="predict-answer">
         <p>shell 先 fork 出两个子进程,再把它们用管道接起来。</p>
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

  var PLACEHOLDER = '先写下你的猜测——猜错比不猜有用';
  var LABEL = '揭晓';
  var LABEL_ANYWAY = '还是直接看答案';
  var LABEL_DONE = '已揭晓';
  var NUDGE = '先猜一下。哪怕猜错,答案也会记得更牢。';

  function mount(root) {
    var answer = root.querySelector('.predict-answer');
    if (!answer) return;

    answer.hidden = true;

    var controls = document.createElement('div');
    controls.className = 'predict-controls';

    var guess = document.createElement('textarea');
    guess.className = 'predict-guess';
    guess.setAttribute('rows', '2');
    guess.setAttribute('placeholder', PLACEHOLDER);
    guess.setAttribute('aria-label', '你的猜测');

    var button = document.createElement('button');
    button.className = 't-btn predict-reveal';
    button.setAttribute('type', 'button');
    button.textContent = LABEL;

    controls.appendChild(guess);
    controls.appendChild(button);
    // Only a direct child is a legal insertion point; an author who wrapped the
    // answer in a <div> gets the controls at the end rather than an exception.
    root.insertBefore(controls, answer.parentNode === root ? answer : null);

    var nudge = null;
    var nudged = false;

    function warn() {
      nudged = true;
      root.classList.add('is-nudged');
      if (!nudge) {
        nudge = document.createElement('p');
        nudge.className = 'predict-nudge';
        nudge.setAttribute('role', 'status');
        nudge.textContent = NUDGE;
        controls.appendChild(nudge);
      }
      button.textContent = LABEL_ANYWAY;
    }

    function reveal() {
      answer.hidden = false;
      root.classList.add('is-revealed');
      // The guess stays on screen next to the answer: comparing the two is
      // the whole exercise. Read-only so it cannot be quietly corrected.
      guess.setAttribute('readonly', '');
      button.setAttribute('disabled', '');
      button.textContent = LABEL_DONE;
      if (nudge) nudge.hidden = true;
    }

    button.addEventListener('click', function () {
      if (!guess.value.trim() && !nudged) return warn();
      reveal();
    });

    root.classList.add('is-live');
  }

  function mountAll() {
    var roots = document.querySelectorAll('[data-predict]');
    for (var i = 0; i < roots.length; i++) mount(roots[i]);
  }

  // Lessons put component scripts at the end of <body>, but lesson-boot.js
  // loads scripts dynamically, by which time DOMContentLoaded has passed.
  if (document.body) mountAll();
  else document.addEventListener('DOMContentLoaded', mountAll);
})();
