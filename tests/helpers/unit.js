'use strict';

/**
 * The fixture Unit: the pages one Unit is made of, written the way the skill's
 * own authoring document says to write them, using every Component the plugin
 * ships.
 *
 * Three pages, because a Unit is more than one file. The Lesson is the body;
 * the Checkpoint is the gate at its end, on a page of its own, linking back to
 * the Lesson it closes; the Assignment is the task that goes out to the
 * learner's real work, carrying its own Rubric in a block the page never
 * renders.
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
 *
 * An entry carries a `drive` for the same reason. Putting a Component through
 * its states is the one thing about it nothing can derive — which option is the
 * wrong one, which button reveals — so it is written once, here, beside the
 * selector and the filenames. A check that held its own copy would cover a new
 * Component only on the day somebody remembered to extend it, and two suites
 * already need this: `components.test.js` drives each Component to see that
 * every class it reaches is styled, and `language.test.js` drives it to see
 * that every label it reaches comes from the table.
 *
 * `step` is called after each state, because a label replaced on the way — a
 * reveal button once it has revealed — is otherwise a state nothing looks at.
 * What a drive types is named above the drives, so a check can tell the
 * Learner's own words apart from the Component's.
 *
 * Every page is built for a language rather than in one. `<html lang>` is what
 * a Component reads to decide what a Learner sees, so a fixture that hardcoded
 * a tag could only ever mount one audience's page — and the check that matters
 * most, the pseudolocale one, is the one that needs a tag no Workspace has.
 * `pagesIn(lang)` and `lessonHtml(lang)` take it; `PAGES` and `LESSON_HTML` are
 * those at the fixture's own language, which is the pilot Workspace's, so that
 * the suite keeps observing the audience the prose below is written for.
 */

const { drawerAnswering } = require('./drawer.js');

/**
 * What a drive types in: a Learner's own words, and a Learner's own paths.
 *
 * Non-English on purpose, and not to be tidied away: `docs/agents/tests.md`
 * keeps a handful of non-ASCII inputs deliberately, because bytes that are not
 * ASCII are the class of defect the verdict slug's character range was. The
 * escaping path is the one exception, and it has to be — a hand-in refuses a
 * path by looking for a leading `/`, a `..` segment or a URL scheme, and there
 * is no fullwidth spelling of any of those.
 *
 * `GUESS` and `SUBMISSION` are exported because a check elsewhere asserts on
 * the very text a drive typed — that the guess is still in the box afterwards,
 * that the Submission handed over is the one written. The rest are the drives'
 * own and have no second reader, so they stay in here.
 */
const GUESS = '管道右边的先创建';
const SUBMISSION = '第一段的 stdout 就是第二段的 stdin。';
const TOO_LONG = 'х'.repeat(2100);
const SOME_PATH = 'submissions/0003b-audit/notes.md';
const ESCAPING_PATH = '/etc/passwd';

/**
 * The typed text a Component reads back *onto the screen* — which is the only
 * part of it a check reading a rendered tree can meet.
 *
 * Just the escaping path, because a refusal names the path it refused and
 * nothing else a drive types comes back: what goes into a box stays a `value`,
 * and reading a tree reads text and labels rather than what is typed into it.
 * So the rest of the constants above are deliberately not here — a list longer
 * than the truth is a list that forgives text nothing put on screen.
 *
 * `language.test.js` takes these out of a captured line before deciding whether
 * what is left is all sentinels, and asserts each one turned up first.
 */
const ECHOED_INPUT = [ESCAPING_PATH];

/**
 * The two boxes of a hand-in, reached through their labels the way a Learner
 * reaches them: `<label for>` is the contract the Component publishes, and the
 * id behind it is minted from a counter that no test owns.
 */
function handInBoxes(page) {
  const boxes = page
    .queryAll('.assignment-label')
    .map((label) => page.document.getElementById(label.getAttribute('for')));

  if (boxes.length !== 2 || boxes.some((box) => !box)) {
    throw new Error(`expected a hand-in with two labelled boxes, found ${boxes.length}`);
  }
  return { answer: boxes[0], paths: boxes[1] };
}

/** The option of `question` that is not the one marked right. */
const wrongOption = (question) => {
  const options = question.querySelectorAll('.exercise-option');
  return options.find((option) => !option.hasAttribute('data-correct'));
};

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
  // Wrong on purpose: it is the verdict with something to say, and the one that
  // also has to show which answer was right.
  drive(page, root, step) {
    page.click(wrongOption(root));
    step();
  },
};

/** The Components a Lesson is built from, as the Lesson author meets them. */
const LESSON_COMPONENTS = [
  EXERCISE,
  {
    name: 'predict-reveal',
    css: 'predict-reveal.css',
    js: 'predict-reveal.js',
    root: '.predict',
    // Both ways through it: revealing with nothing written nudges, and a guess
    // written down reveals. The button says a different thing at each.
    drive(page, root, step) {
      page.click(root.querySelector('button.predict-reveal'));
      step();
      page.type(root.querySelector('textarea.predict-guess'), GUESS);
      page.click(root.querySelector('button.predict-reveal'));
      step();
    },
  },
  {
    name: 'step-animation',
    css: 'step-animation.css',
    js: 'step-animation.js',
    root: '.steps',
    // Off the first step, which is where the count moves and both buttons are
    // live at once.
    drive(page, root, step) {
      page.click(root.querySelector('.steps-next'));
      step();
    },
  },
  {
    name: 'drag-order',
    css: 'drag-order.css',
    js: 'drag-order.js',
    root: '.drag-order',
    // Wrong as authored, then right once an item has moved — the second verdict
    // has to clear the first, so both have to be reached.
    drive(page, root, step) {
      page.click(root.querySelector('.drag-order-check'));
      step();
      page.click(root.querySelectorAll('.drag-order-item')[1].querySelector('.drag-order-up'));
      page.click(root.querySelector('.drag-order-check'));
      step();
    },
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
  // Every question, so the gate reaches a verdict — and one of them wrong, so
  // the verdict it reaches is the one that holds the Unit open. Questions
  // already answered are left alone: on a Checkpoint page the Exercise's own
  // drive has run first, and an Exercise takes only its first answer.
  drive(page, root, step) {
    for (const question of root.querySelectorAll('.exercise')) {
      if (question.classList.contains('is-answered')) continue;
      page.click(question.querySelectorAll('.exercise-option[data-correct]')[0]);
      step();
    }
  },
};

/**
 * The other one that is not built into a Lesson: the hand-in on the
 * Assignment's own page, which is the only Component whose verdict does not
 * come from the page at all.
 */
const ASSIGNMENT = {
  name: 'assignment',
  css: 'assignment.css',
  js: 'assignment.js',
  root: '.assignment',
  // Every way a hand-in can end. The four refusals the page reaches on its own
  // come first, then a Submission it has no complaint about, then the two
  // answers only a drawer can give and the one it must not give — each of those
  // three staged by standing in for the drawer.
  drive(page, root, step) {
    const box = handInBoxes(page);
    const send = () => {
      page.click(root.querySelector('.assignment-send'));
      step();
    };

    send();                                             // nothing written yet
    page.type(box.paths, ESCAPING_PATH);
    send();                                             // a path out of the Workspace
    page.type(box.paths, new Array(12).fill(SOME_PATH).join('\n'));
    send();                                             // more paths than it takes
    page.type(box.paths, '');
    box.answer.value = TOO_LONG;
    send();                                             // more than the service holds

    // A Submission the page has no complaint about. Where it goes from here is
    // the drawer's: with one on the page it is handed over, and without one —
    // which is how `components.test.js` opens this page — it is refused for
    // the last reason there is.
    box.answer.value = SUBMISSION;
    send();

    const drawer = page.window.Tutor;
    for (const outcome of ['busy', 'nonsense-from-a-future-drawer']) {
      page.window.Tutor = drawerAnswering(outcome);
      send();
    }
    page.window.Tutor = undefined;                      // a drawer that never arrived
    send();
    page.window.Tutor = drawer;
  },
};

/** Every Component the plugin ships, wherever on a Unit's pages it is used. */
const ALL_COMPONENTS = [...LESSON_COMPONENTS, CHECKPOINT, ASSIGNMENT];

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
  assignment: 'assignments/0003-pipe-audit.html',
};

/** The Rubric the fixture Assignment stores, and the Grader is meant to find. */
const RUBRIC = [
  '算做完了：',
  '- 指出了管道每一段的 stdin 是上一段的 stdout',
  '- 说清楚了中间那段为什么不需要临时文件',
  '常见的错法：',
  '- 只把命令抄了一遍，没说数据是怎么流的',
].join('\n');

/** The language the fixture Unit is authored in, when a test does not say. */
const FIXTURE_LANG = 'zh-CN';

const lessonHtml = (lang = FIXTURE_LANG) => `<!DOCTYPE html>
<html lang="${lang}">
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

<p><a href="../assignments/0003-pipe-audit.html">这一课的作业在这里 →</a></p>

</div>

${LESSON_COMPONENTS.map((c) => `<script src="../assets/${c.js}"></script>`).join('\n')}

<script src="../assets/lesson-boot.js" data-unit="${UNIT.id}"></script>
</body>
</html>
`;

const checkpointHtml = (lang = FIXTURE_LANG) => `<!DOCTYPE html>
<html lang="${lang}">
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

const assignmentHtml = (lang = FIXTURE_LANG) => `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Assignment 03: 拆一条自己的管道</title>
<link rel="stylesheet" href="../assets/${SHARED_STYLES}">
<link rel="stylesheet" href="../assets/${ASSIGNMENT.css}">
</head>
<body>
<div class="lesson">

<header class="lesson-header">
  <div class="lesson-num">Unit 03 · 作业</div>
  <h1>拆一条自己的管道</h1>
  <p class="lesson-sub">在你自己每天用的命令里找一条,把数据的走向说清楚。</p>
</header>

<div class="assignment" data-assignment>
  <p class="assignment-task">从你自己的 shell 历史里挑一条带管道的命令,逐段说清楚每一段的
     输入是从哪里来的,以及中间那一段为什么不需要落成临时文件。</p>

  <p class="assignment-fallback">写好之后放进 <code>submissions/</code>,下次上课时告诉老师
     放在哪了。</p>

  <script type="application/x-rubric">
${RUBRIC}
  </script>
</div>

<p>不确定管道怎么接的,回<a href="../lessons/0003-fork-exec.html#exec">正文讲 exec 的那一段</a>。</p>

</div>

<script src="../assets/${ASSIGNMENT.js}"></script>

<script src="../assets/lesson-boot.js" data-unit="${UNIT.id}"></script>
</body>
</html>
`;

/**
 * The pages of the fixture Unit, each with the Components it is built from.
 * The Checkpoint runs the Exercise Component too: its questions are Exercises,
 * and what the Checkpoint adds is the verdict over them.
 */
const pagesIn = (lang = FIXTURE_LANG) => [
  {
    key: 'lesson',
    name: 'the fixture Lesson',
    file: UNIT.lesson,
    html: lessonHtml(lang),
    components: LESSON_COMPONENTS,
  },
  {
    key: 'checkpoint',
    name: 'the fixture Checkpoint',
    file: UNIT.checkpoint,
    html: checkpointHtml(lang),
    components: [EXERCISE, CHECKPOINT],
  },
  {
    key: 'assignment',
    name: 'the fixture Assignment',
    file: UNIT.assignment,
    html: assignmentHtml(lang),
    components: [ASSIGNMENT],
  },
];

/** The fixture Unit at its own language, which is what most checks iterate. */
const PAGES = pagesIn();
const LESSON_HTML = lessonHtml();

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

module.exports = {
  ALL_COMPONENTS,
  SHARED_STYLES,
  UNIT,
  RUBRIC,
  FIXTURE_LANG,
  LESSON_HTML,
  PAGES,
  SUBMISSION,
  ECHOED_INPUT,
  GUESS,
  handInBoxes,
  lessonHtml,
  pagesIn,
  assetRefs,
};
