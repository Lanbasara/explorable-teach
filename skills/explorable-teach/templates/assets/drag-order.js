/* ============================================================
   drag-order.js — put the steps in the right order. For sequential
   knowledge, where knowing the pieces and knowing their order are two
   different things.
   Deps: drag-order.css, style.css (design tokens). No library, no network,
         no server: works from file://. (The catalog once listed SortableJS
         here; native drag events plus the move buttons cover it, and a
         Component that needs a CDN stops working on a train.)

   Markup the Lesson author writes — in a deliberately wrong order, with
   `data-order` giving the right one:

     <div class="drag-order" data-drag-order>
       <p class="drag-order-prompt">把这些步骤排成正确顺序</p>
       <ol class="drag-order-items">
         <li data-order="2">fork() 复制出子进程</li>
         <li data-order="1">shell 读到一行命令</li>
         <li data-order="3">exec() 把子进程替换成新程序</li>
       </ol>
     </div>

   Every item can be moved two ways: dragged, or moved with its ↑/↓
   buttons. The buttons are not a fallback — they are the only path that
   works on a touchscreen and the only one that works from a keyboard.

   Scripting off: the prompt and the steps are readable text. They are in
   the wrong order, which the prompt has already said they are.
   ============================================================ */
(function () {
  'use strict';

  var CHECK = '检查顺序';
  var RIGHT = '顺序正确。';
  var UP = '上移';
  var DOWN = '下移';

  function wrongMessage(n) {
    return '还有 ' + n + ' 处不在位置上,再看看。';
  }

  function each(nodes, fn) {
    for (var i = 0; i < nodes.length; i++) fn(nodes[i], i);
  }

  /** Element children, in document order. Recomputed after every move. */
  function items(list) {
    var out = [];
    for (var node = list.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === 1) out.push(node);
    }
    return out;
  }

  function rank(item) {
    return Number(item.getAttribute('data-order'));
  }

  function button(cls, glyph, label) {
    var b = document.createElement('button');
    b.className = 't-btn ' + cls;
    b.setAttribute('type', 'button');
    b.setAttribute('aria-label', label);
    b.textContent = glyph;
    return b;
  }

  function mount(root) {
    var list = root.querySelector('.drag-order-items');
    if (!list) return;

    var authored = list.querySelectorAll('li');
    if (authored.length < 2) return;

    var controls = document.createElement('div');
    controls.className = 'drag-order-controls';

    var check = document.createElement('button');
    check.className = 't-btn drag-order-check';
    check.setAttribute('type', 'button');
    check.textContent = CHECK;

    var verdict = document.createElement('p');
    verdict.className = 'drag-order-verdict';
    verdict.setAttribute('role', 'status');

    controls.appendChild(check);
    controls.appendChild(verdict);
    root.appendChild(controls);

    var dragging = null;

    /** Any move invalidates the last verdict; a stale one is worse than none. */
    function clearVerdict() {
      root.classList.remove('is-correct', 'is-wrong');
      verdict.textContent = '';
      each(items(list), function (item) {
        item.classList.remove('is-placed', 'is-misplaced');
      });
    }

    function move(item, by) {
      var current = items(list);
      var at = current.indexOf(item);
      var to = at + by;
      if (to < 0 || to >= current.length) return;

      if (by < 0) list.insertBefore(item, current[to]);
      else list.insertBefore(item, current[to].nextSibling);
      clearVerdict();
    }

    function drop(target) {
      if (!dragging || dragging === target) return;
      var current = items(list);
      // Dropping onto something above you puts you above it; onto something
      // below you puts you below it. Either way you land where you aimed.
      if (current.indexOf(dragging) > current.indexOf(target)) {
        list.insertBefore(dragging, target);
      } else {
        list.insertBefore(dragging, target.nextSibling);
      }
      clearVerdict();
    }

    each(authored, function (item) {
      item.classList.add('drag-order-item');
      item.setAttribute('draggable', 'true');

      var moves = document.createElement('span');
      moves.className = 'drag-order-move';
      var up = button('drag-order-up', '↑', UP);
      var down = button('drag-order-down', '↓', DOWN);
      moves.appendChild(up);
      moves.appendChild(down);
      item.appendChild(moves);

      up.addEventListener('click', function () {
        move(item, -1);
      });
      down.addEventListener('click', function () {
        move(item, 1);
      });

      item.addEventListener('dragstart', function (event) {
        dragging = item;
        item.classList.add('is-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          // Firefox will not start a drag until something is on the transfer.
          event.dataTransfer.setData('text/plain', '');
        }
      });
      item.addEventListener('dragover', function (event) {
        if (dragging) event.preventDefault();
      });
      item.addEventListener('drop', function (event) {
        event.preventDefault();
        drop(item);
      });
      item.addEventListener('dragend', function () {
        item.classList.remove('is-dragging');
        dragging = null;
      });
    });

    check.addEventListener('click', function () {
      clearVerdict();

      var current = items(list);
      var wanted = current.map(rank).sort(function (a, b) {
        return a - b;
      });

      var misplaced = 0;
      each(current, function (item, i) {
        var placed = rank(item) === wanted[i];
        item.classList.add(placed ? 'is-placed' : 'is-misplaced');
        if (!placed) misplaced++;
      });

      root.classList.add(misplaced ? 'is-wrong' : 'is-correct');
      verdict.textContent = misplaced ? wrongMessage(misplaced) : RIGHT;
    });

    root.classList.add('is-live');
  }

  function mountAll() {
    each(document.querySelectorAll('[data-drag-order]'), mount);
  }

  // Lessons put component scripts at the end of <body>, but lesson-boot.js
  // loads scripts dynamically, by which time DOMContentLoaded has passed.
  if (document.body) mountAll();
  else document.addEventListener('DOMContentLoaded', mountAll);
})();
