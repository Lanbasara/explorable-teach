/* ============================================================
   step-animation.js — walk a process one stage at a time, so the learner
   sees *how* it happens rather than what it ended up as.
   Deps: step-animation.css, style.css (design tokens). No library, no
         network, no server: works from file://. (The catalog once listed
         GSAP here; the transitions are CSS, so there is nothing to load.)

   Markup the Lesson author writes:

     <div class="steps" data-steps>
       <p class="steps-caption">shell 执行一条外部命令</p>
       <ol class="steps-list">
         <li>shell 读到一行命令</li>
         <li>fork() 复制出子进程</li>
       </ol>
       <div class="steps-stage">
         <p data-step="2">此刻内存里有两个一模一样的 shell。</p>
       </div>
     </div>

   Anything carrying `data-step="N"` — a paragraph, a diagram, an <svg> —
   is on screen only while step N is current. The controls are built here.

   Scripting off: an ordered list of every stage, with every stage note
   after it. The whole process is still readable, just not animated.

   Past steps stay visible and dimmed rather than disappearing: the point of
   a process diagram is seeing where you are in it.
   ============================================================ */
(function () {
  'use strict';

  var PREV = '上一步';
  var NEXT = '下一步';

  function each(nodes, fn) {
    for (var i = 0; i < nodes.length; i++) fn(nodes[i], i);
  }

  function button(cls, label) {
    var b = document.createElement('button');
    b.className = 't-btn ' + cls;
    b.setAttribute('type', 'button');
    b.textContent = label;
    return b;
  }

  function mount(root) {
    var list = root.querySelector('.steps-list');
    if (!list) return;

    var steps = list.querySelectorAll('li');
    if (steps.length < 2) return; // one step is not a process

    var stages = root.querySelectorAll('[data-step]');
    var stage = root.querySelector('.steps-stage');

    var controls = document.createElement('div');
    controls.className = 'steps-controls';

    var prev = button('steps-prev', PREV);
    var next = button('steps-next', NEXT);
    var count = document.createElement('span');
    count.className = 'steps-count';
    count.setAttribute('role', 'status');

    controls.appendChild(prev);
    controls.appendChild(count);
    controls.appendChild(next);
    root.appendChild(controls);

    var at = 0;

    function toggle(node, disabled) {
      if (disabled) node.setAttribute('disabled', '');
      else node.removeAttribute('disabled');
    }

    function render() {
      each(steps, function (step, i) {
        step.classList.remove('is-current', 'is-past', 'is-ahead');
        step.classList.add(i === at ? 'is-current' : i < at ? 'is-past' : 'is-ahead');
        step.setAttribute('aria-current', i === at ? 'step' : 'false');
      });

      var showing = 0;
      each(stages, function (node) {
        var mine = Number(node.getAttribute('data-step')) === at + 1;
        node.hidden = !mine;
        if (mine) showing++;
      });

      // Not every step needs a stage. An empty framed box reads as a broken
      // image rather than as "nothing to show here".
      if (stage) stage.classList.toggle('is-empty', showing === 0);

      count.textContent = at + 1 + ' / ' + steps.length;
      toggle(prev, at === 0);
      toggle(next, at === steps.length - 1);
    }

    function go(to) {
      var clamped = Math.max(0, Math.min(steps.length - 1, to));
      if (clamped === at) return;
      at = clamped;
      render();
    }

    prev.addEventListener('click', function () {
      go(at - 1);
    });
    next.addEventListener('click', function () {
      go(at + 1);
    });

    // Jumping straight to a stage the learner is puzzling over beats clicking
    // through four of them to get back to it.
    each(steps, function (step, i) {
      step.classList.add('steps-step');
      step.setAttribute('role', 'button');
      step.setAttribute('tabindex', '0');

      step.addEventListener('click', function () {
        go(i);
      });
      step.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          event.stopPropagation();
          go(i);
        }
      });
    });

    root.setAttribute('tabindex', '0');
    root.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        go(at + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        go(at - 1);
      }
    });

    root.classList.add('is-live');
    render();
  }

  function mountAll() {
    each(document.querySelectorAll('[data-steps]'), mount);
  }

  // Lessons put component scripts at the end of <body>, but lesson-boot.js
  // loads scripts dynamically, by which time DOMContentLoaded has passed.
  if (document.body) mountAll();
  else document.addEventListener('DOMContentLoaded', mountAll);
})();
