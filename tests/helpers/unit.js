'use strict';

/**
 * The fixture Unit: the pages one Unit is made of, written the way the skill's
 * own authoring document says to write them, using every Component the plugin
 * ships.
 *
 * Two pages, because a Unit is more than one file. The Lesson is the body; the
 * Checkpoint is the gate at its end, on a page of its own, linking back to the
 * Lesson it closes.
 *
 * It is the shared subject of three different questions:
 *
 *   - assets.test.js  — does everything these pages point at exist in a freshly
 *                       scaffolded Workspace?
 *   - components.test.js — mounted in the fixture DOM, does each Component
 *                       actually do what it promises, and does the page still
 *                       read as text before any of them run?
 *   - nav.test.js     — is each page of this Unit reachable from the others?
 *
 * `PAGES` is the list the generic checks iterate, and each page names the
 * Components it is built from. Adding a Component means adding one entry and
 * its markup to the page it belongs on; every check below then covers it
 * without being told about it separately.
 */

/**
 * The Exercise, named on its own because two pages are built from it: a Lesson
 * uses it to check an idea as it lands, and a Checkpoint is built out of a run
 * of them. Reaching for it positionally — `LESSON_COMPONENTS[0]` — would let a
 * reordering of that list silently change what the Checkpoint page claims to
 * run, with nothing failing.
 */
const EXERCISE = {
  name: 'exercise',
  css: 'exercise.css',
  js: 'exercise.js',
  root: '.exercise',
};

/** The Components a Lesson is built from, as the Lesson author meets them. */
const LESSON_COMPONENTS = [
  EXERCISE,
  {
    name: 'predict-reveal',
    css: 'predict-reveal.css',
    js: 'predict-reveal.js',
    root: '.predict',
  },
  {
    name: 'step-animation',
    css: 'step-animation.css',
    js: 'step-animation.js',
    root: '.steps',
  },
  {
    name: 'drag-order',
    css: 'drag-order.css',
    js: 'drag-order.js',
    root: '.drag-order',
  },
];

/**
 * The one Component that is not built into a Lesson. It gates the Unit from a
 * page of its own, and it is built out of the Exercises it counts — so the
 * Checkpoint page runs two Components rather than one.
 */
const CHECKPOINT = {
  name: 'checkpoint',
  css: 'checkpoint.css',
  js: 'checkpoint.js',
  root: '.checkpoint',
};

/** Every Component the plugin ships, wherever on a Unit's pages it is used. */
const ALL_COMPONENTS = [...LESSON_COMPONENTS, CHECKPOINT];

/** Shared styles are not a Component, but no page renders without them. */
const SHARED_STYLES = 'style.css';

/**
 * The Unit these pages belong to, as the course manifest records it. The file
 * names are the flat, sibling-linked convention the authoring document states —
 * `0003-slug.html` and `0003b-checkpoint.html`, one Unit, one directory.
 */
const UNIT = {
  id: '0003',
  num: 'L03',
  title: 'fork 与 exec',
  lesson: 'lessons/0003-fork-exec.html',
  checkpoint: 'lessons/0003b-checkpoint.html',
};

const LESSON_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Lesson 03: fork 与 exec</title>
<link rel="stylesheet" href="../assets/${SHARED_STYLES}">
${LESSON_COMPONENTS.map((c) => `<link rel="stylesheet" href="../assets/${c.css}">`).join('\n')}
</head>
<body>
<div class="lesson">

<header class="lesson-header">
  <div class="lesson-num">Unit 03</div>
  <h1>fork 与 exec</h1>
  <p class="lesson-sub">一个进程是怎么变成另一个程序的</p>
</header>

<div class="predict" data-predict>
  <p class="predict-question">管道两端的进程,是谁先被创建的?</p>
  <div class="predict-answer">
    <p>shell 先 fork 出两个子进程,再把它们用管道接起来。</p>
  </div>
</div>

<div class="steps" id="exec" data-steps>
  <p class="steps-caption">shell 执行一条外部命令</p>
  <ol class="steps-list">
    <li>shell 读到一行命令</li>
    <li>fork() 复制出子进程</li>
    <li>exec() 把子进程替换成新程序</li>
    <li>父进程 wait() 收尸</li>
  </ol>
  <div class="steps-stage">
    <p data-step="2">此刻内存里有两个一模一样的 shell。</p>
    <p data-step="3">子进程的代码段被整个换掉,pid 不变。</p>
  </div>
</div>

<div class="exercise" data-exercise>
  <p class="exercise-prompt">fork() 之后,子进程从哪一行开始执行?</p>
  <ol class="exercise-options">
    <li>从 main() 的第一行</li>
    <li data-correct>从 fork() 返回的那一行</li>
    <li>从 exec() 那一行</li>
  </ol>
  <p class="exercise-why">子进程从 fork() 的返回处继续,不是从 main 开头。</p>
</div>

<div class="drag-order" data-drag-order>
  <p class="drag-order-prompt">把 shell 执行一条命令的步骤排成正确顺序</p>
  <ol class="drag-order-items">
    <li data-order="2">fork() 复制出子进程</li>
    <li data-order="1">shell 读到一行命令</li>
    <li data-order="3">exec() 把子进程替换成新程序</li>
  </ol>
</div>

<p><a href="0003b-checkpoint.html">做一下这一课的验收 →</a></p>

</div>

${LESSON_COMPONENTS.map((c) => `<script src="../assets/${c.js}"></script>`).join('\n')}

<script src="../assets/lesson-boot.js" data-unit="${UNIT.id}"></script>
</body>
</html>
`;

const CHECKPOINT_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Checkpoint 03: fork 与 exec</title>
<link rel="stylesheet" href="../assets/${SHARED_STYLES}">
<link rel="stylesheet" href="../assets/exercise.css">
<link rel="stylesheet" href="../assets/${CHECKPOINT.css}">
</head>
<body>
<div class="lesson">

<header class="lesson-header">
  <div class="lesson-num">Unit 03 · 验收</div>
  <h1>这一课可以合上了吗?</h1>
  <p class="lesson-sub">三道题,全对才算过。</p>
</header>

<div class="checkpoint" data-checkpoint>
  <p class="checkpoint-lead">凭记忆答。翻回正文找得到的答案,不算学会了。</p>

  <div class="exercise" data-exercise>
    <p class="exercise-prompt">fork() 在父进程里返回什么?</p>
    <ol class="exercise-options">
      <li>0</li>
      <li data-correct>子进程的 pid</li>
      <li>自己的 pid</li>
    </ol>
  </div>

  <div class="exercise" data-exercise>
    <p class="exercise-prompt">exec() 成功之后,原来那段代码还在吗?</p>
    <ol class="exercise-options">
      <li data-correct>不在,整个被换掉了</li>
      <li>在,跟新程序并存</li>
      <li>在,但再也不会执行</li>
    </ol>
  </div>

  <div class="exercise" data-exercise>
    <p class="exercise-prompt">父进程不 wait(),子进程结束后会怎样?</p>
    <ol class="exercise-options">
      <li>立刻从进程表里消失</li>
      <li data-correct>留成僵尸,占着一个表项</li>
      <li>把父进程一起带走</li>
    </ol>
  </div>

  <p class="checkpoint-pass">三道全对,这一课可以合上了。把结果告诉老师,下一课从管道开始;想复习随时回<a href="0003-fork-exec.html">正文</a>。</p>
  <p class="checkpoint-again">还有答错的。回到<a href="0003-fork-exec.html#exec">正文讲 exec 的那一段</a>重读一遍,再来一次。</p>
</div>

</div>

<script src="../assets/exercise.js"></script>
<script src="../assets/${CHECKPOINT.js}"></script>

<script src="../assets/lesson-boot.js" data-unit="${UNIT.id}"></script>
</body>
</html>
`;

/**
 * The pages of the fixture Unit, each with the Components it is built from.
 * The Checkpoint runs the Exercise Component too: its questions are Exercises,
 * and what the Checkpoint adds is the verdict over them.
 */
const PAGES = [
  {
    key: 'lesson',
    name: 'the fixture Lesson',
    file: UNIT.lesson,
    html: LESSON_HTML,
    components: LESSON_COMPONENTS,
  },
  {
    key: 'checkpoint',
    name: 'the fixture Checkpoint',
    file: UNIT.checkpoint,
    html: CHECKPOINT_HTML,
    components: [EXERCISE, CHECKPOINT],
  },
];

/**
 * Every asset a page or script points at, as a Workspace-relative path.
 * `../assets/x.css` in a Lesson and `assets/x.css` in the dossier name the same
 * file; both land here as `assets/x.css`.
 */
function assetRefs(text) {
  const found = new Set();
  for (const [, file] of text.matchAll(/(?:\.\.\/)?assets\/([\w.-]+\.(?:css|js))/g)) {
    found.add(`assets/${file}`);
  }
  return [...found].sort();
}

module.exports = { ALL_COMPONENTS, SHARED_STYLES, UNIT, LESSON_HTML, PAGES, assetRefs };
