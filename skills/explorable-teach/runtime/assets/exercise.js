/* ============================================================
   exercise.js — an in-Lesson check, judged by the page the instant it is
   answered. Measures whether understanding just happened.
   Deps: exercise.css, style.css (design tokens), lesson-boot.js (the text it
         renders, and the word that its tables have all arrived). No library, no
         network, no server: works from file://.

   Markup the Lesson author writes:

     <div class="exercise" data-exercise>
       <p class="exercise-prompt">Where does the child resume after fork()?</p>
       <ol class="exercise-options">
         <li>At the first line of main()</li>
         <li data-correct>At the line fork() returned on</li>
       </ol>
       <p class="exercise-why">The child carries on from fork()'s return.</p>   <!-- optional -->
     </div>

   Scripting off: the prompt, the options and the reason are all ordinary
   text. Nothing here is hidden by the stylesheet — only by this file, and
   only once it has taken over.

   The first answer is the verdict. A question you can re-answer until it
   goes green measures persistence, not understanding.
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
    var list = root.querySelector('.exercise-options');
    if (!list) return;

    var options = list.querySelectorAll('li');
    if (!options.length) return;

    var why = root.querySelector('.exercise-why');
    if (why) why.hidden = true;

    var verdict = document.createElement('p');
    verdict.className = 'exercise-verdict';
    verdict.setAttribute('role', 'status');
    verdict.hidden = true;
    // `why` is optional, and an author may have wrapped it; only a direct child
    // is a legal insertion point, so anything else means "put it at the end".
    root.insertBefore(verdict, why && why.parentNode === root ? why : null);

    var answered = false;

    function answer(option) {
      if (answered) return;
      answered = true;

      var right = option.hasAttribute('data-correct');
      option.classList.add('is-chosen', right ? 'is-correct' : 'is-wrong');
      root.classList.add('is-answered', right ? 'is-correct' : 'is-wrong');

      each(options, function (other) {
        other.setAttribute('tabindex', '-1');
        other.setAttribute('aria-disabled', 'true');
        // Being told you were wrong without being told what was right is the
        // one outcome that teaches nothing.
        if (other.hasAttribute('data-correct')) other.classList.add('is-answer');
      });

      verdict.textContent = say(right ? 'exercise.right' : 'exercise.wrong');
      verdict.hidden = false;
      if (why) why.hidden = false;
    }

    each(options, function (option) {
      option.classList.add('exercise-option');
      option.setAttribute('role', 'button');
      option.setAttribute('tabindex', '0');

      option.addEventListener('click', function () {
        answer(option);
      });
      option.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          answer(option);
        }
      });
    });

    root.classList.add('is-live');
  }

  function mountAll() {
    each(document.querySelectorAll('[data-exercise]'), mount);
  }

  whenTextArrives(mountAll);
})();
