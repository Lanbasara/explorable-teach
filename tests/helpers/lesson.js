'use strict';

/**
 * The fixture Lesson: one page written the way the Lesson template in
 * `SKILL.md` says to write one, using every Component the plugin ships.
 *
 * It is the shared subject of two different questions:
 *
 *   - assets.test.js  — does everything this page points at exist in a freshly
 *                       scaffolded Workspace?
 *   - components.test.js — mounted in the fixture DOM, does each Component
 *                       actually do what it promises, and does the page still
 *                       read as text before any of them run?
 *
 * `COMPONENTS` is the list both suites iterate. Adding a Component means adding
 * one entry and its markup here; every check below then covers it without being
 * told about it separately.
 */

/** Every Component this plugin ships, as the Lesson author meets it. */
const COMPONENTS = [
  {
    name: 'exercise',
    css: 'exercise.css',
    js: 'exercise.js',
    root: '.exercise',
  },
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

/** Shared styles are not a Component, but no Lesson renders without them. */
const SHARED_STYLES = 'style.css';

const LESSON_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Lesson 03: fork 与 exec</title>
<link rel="stylesheet" href="../assets/${SHARED_STYLES}">
${COMPONENTS.map((c) => `<link rel="stylesheet" href="../assets/${c.css}">`).join('\n')}
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

<div class="steps" data-steps>
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

</div>

${COMPONENTS.map((c) => `<script src="../assets/${c.js}"></script>`).join('\n')}

<script src="../assets/lesson-boot.js" data-unit="0003"></script>
</body>
</html>
`;

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

module.exports = { COMPONENTS, SHARED_STYLES, LESSON_HTML, assetRefs };
