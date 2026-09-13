/**
 * lesson-boot.js — the only infrastructure line a lesson needs, and the text
 * every page in the workspace is written in.
 *
 *   <script src="../assets/lesson-boot.js" data-unit="0003"></script>
 *
 * Two things in one file, in two parts.
 *
 * The first is every string a page puts in front of the learner, and the lookup
 * that picks the right one. It is here rather than in a file of its own for one
 * reason: a workspace holds symlinks at the plugin, so a *new* file does not
 * exist in a workspace until the scaffold next runs, while a file that is
 * already linked follows the plugin the moment it updates. A table nobody can
 * reach renders keys on a learner's screen. This file is linked in every
 * workspace there is, so putting the table in it is what makes an upgrade need
 * no migration step.
 *
 * The second is the bootstrap proper, below: the nav bar, the tutor widget and
 * the unit manifest, loaded in the right order with paths resolved relative to
 * this file rather than to the page.
 *
 * `<html lang>` is the single authority for which language that is. A workspace
 * states it once in the course manifest; the bootstrap applies it to any page
 * that did not declare its own, and scripts/wire-lessons.sh fills it into the
 * pages it rewrites. So nothing below reads a language from anywhere but the
 * document, and in particular never from the browser: what decides is the
 * preference the learner recorded, not a setting their machine happens to
 * carry.
 *
 * Lookup, for a page in `zh-CN`:
 *
 *   TEACH_STRINGS['zh-CN']  the workspace's own table, when it has one
 *   TABLES['zh-CN']         the table this plugin ships for that exact tag
 *   TEACH_STRINGS['zh']     …then the same pair for the base language
 *   TABLES['zh']
 *   TEACH_STRINGS['en']     …then the same pair for English
 *   TABLES['en']
 *   the key itself
 *
 * The workspace is asked first at every rung, because a workspace supplying a
 * language the plugin does not ship should not have to guess which rung its
 * table will be consulted at. Truncation is the only cleverness: `zh-TW` falls
 * back to `zh` and then to English, never sideways to `zh-CN`, because handing
 * someone the wrong script is worse than handing them English.
 *
 * This file is maintainer-facing and therefore English, table values aside: the
 * tables *are* the learner-facing half, and they are data rather than prose.
 *
 * ============================================================================
 * Part one — what a page says
 * ============================================================================
 */
(function () {
  'use strict';

  /**
   * What the plugin ships. `en` is the floor every other table falls back to,
   * so a key missing here is a key that can reach a Learner raw — which is why
   * the suite derives the keys the Components ask for and checks them against
   * this, rather than anyone remembering to.
   *
   * `{name}` is a value the page fills in at the moment it renders: a file
   * path, a count, an elapsed time. A translation may move one or drop one; it
   * may not invent one, because nothing would fill it.
   */
  var TABLES = {
    en: {
      /* the drawer, as furniture */
      'tutor.aria.drawer': 'AI tutor',
      'tutor.fab': '🎓 Ask the tutor',
      'tutor.status.checking': 'checking',
      'tutor.status.online': 'online',
      'tutor.status.offline': 'offline',
      'tutor.history': 'History',
      'tutor.history.title': 'Go back to a topic you asked about before',
      'tutor.history.empty': 'Nothing asked yet.',
      'tutor.newtopic': 'New topic',
      'tutor.newtopic.title':
        'Put this conversation away and start another one (nothing is lost — it is under History)',
      'tutor.close': '×',
      'tutor.close.title': 'Close',
      'tutor.input.placeholder': 'Ask something… (⌘/Ctrl + Enter to send)',
      'tutor.send': 'Send',
      'tutor.send.copy': '📋 Copy the question',
      'tutor.offline.hint':
        'The tutor service is not running. Run {command} in the workspace directory, '
        + 'and this will connect itself once it is up.',
      'tutor.you': 'You',

      /* the history panel */
      'tutor.thread.untitled': '(empty topic)',
      'tutor.thread.truncated': '{text}…',
      'tutor.thread.meta': '{asked} asked · {when}',
      'tutor.time.now': 'just now',
      'tutor.time.minutes': '{n} min ago',
      'tutor.time.hours': '{n} h ago',
      'tutor.time.days': '{n} d ago',

      /* what a Learner can do with an answer */
      'tutor.act.pin': '📌 Pin',
      'tutor.act.pinned': '✓ Pinned',
      'tutor.act.copy': '📋 Copy',
      'tutor.act.copied': '✓ Copied',
      'tutor.act.regen': '↻ Answer again',
      'tutor.act.regen.title': 'Ask the tutor to put it another way',
      'tutor.act.retry': '↻ Try again',
      'tutor.act.offline': 'service not running',

      /* the wait, and the two ways it can end without an answer */
      'tutor.stage.sending': 'Sending…',
      'tutor.stage.accepted': 'The tutor has the question, and is starting up…',
      'tutor.stage.reading': 'The tutor is reading the workspace…',
      'tutor.stage.reading.at': 'The tutor is reading {target}',
      'tutor.stage.answering': 'The tutor is writing an answer…',
      'tutor.stop': 'Stop',
      'tutor.stop.title': 'Stop this question',
      'tutor.stopped': 'Stopped.',
      'tutor.elapsed.seconds': '{seconds} s',
      'tutor.elapsed.minutes': '{minutes} min {seconds} s',
      'tutor.tool': '📖 {name} · {target}',
      'tutor.tool.bare': '📖 {name}',
      'tutor.fail.connect': 'Could not reach the tutor service.',
      'tutor.fail.answer': 'The tutor could not answer this one.',
      'tutor.recorded': 'The verdict went into {record}; your teacher will read it next session.',

      /* answers pinned into the lesson */
      'tutor.notes.heading': '📌 What I pinned',
      'tutor.notes.answer': 'The tutor answered',
      'tutor.notes.delete': '×',
      'tutor.notes.delete.title': 'Delete this one',
      'tutor.notes.question': 'Q: {question}',

      /* the prompt the Learner copies when there is no service to ask */
      'tutor.copy.me': 'Me',
      'tutor.copy.turn': '{who}: {text}',
      'tutor.copy.selection': 'The passage I selected:\n"""\n{text}\n"""',
      'tutor.copy.history': 'What we have already said:\n{turns}',
      'tutor.copy.submission': 'This is the assignment I am handing in:\n"""\n{text}\n"""',
      'tutor.copy.question': 'My question: {text}',

      /* the two roles the drawer carries */
      'tutor.role.tutor.title': '🎓 Tutor',
      'tutor.role.tutor.reply': 'Tutor',
      'tutor.role.tutor.ask.1': 'What does this passage mean',
      'tutor.role.tutor.ask.2': 'Give me a different analogy',
      'tutor.role.tutor.ask.3': 'Why is it not the other way round',
      'tutor.role.tutor.ask.4': 'Which earlier lesson does this build on',
      'tutor.role.tutor.lead': 'I am reading this lesson: {page}',
      'tutor.role.tutor.brief':
        '(Please answer as the tutor: read NOTES.md and MISSION.md first for my preferences '
        + 'and my goal, disclose progressively, and cover only the point I asked about.)',
      'tutor.role.grader.title': '📝 Grading',
      'tutor.role.grader.reply': 'Grader',
      'tutor.role.grader.ask.1': 'Why did this point not pass',
      'tutor.role.grader.ask.2': 'I disagree with this verdict',
      'tutor.role.grader.ask.3': 'What should I do differently next time',
      'tutor.role.grader.ask.4': 'Show me an example that got it right',
      'tutor.role.grader.lead': 'I am working on this assignment: {page}',
      'tutor.role.grader.brief':
        '(Please judge this with the grader subagent — it is at .claude/agents/grader.md, '
        + 'in this workspace directory. Do not judge it yourself: the teacher who set the '
        + 'assignment does not grade it.)'
    },

    'zh-CN': {
      'tutor.aria.drawer': 'AI 问答助教',
      'tutor.fab': '🎓 问老师',
      'tutor.status.checking': '检测中',
      'tutor.status.online': '在线',
      'tutor.status.offline': '离线',
      'tutor.history': '历史',
      'tutor.history.title': '回到之前问过的话题',
      'tutor.history.empty': '还没有问过什么。',
      'tutor.newtopic': '新话题',
      'tutor.newtopic.title': '收起这段对话，另起一个话题（不会丢，可在「历史」里找回）',
      'tutor.close': '×',
      'tutor.close.title': '关闭',
      'tutor.input.placeholder': '问点什么…（⌘/Ctrl + Enter 发送）',
      'tutor.send': '发送',
      'tutor.send.copy': '📋 复制提问',
      'tutor.offline.hint': '老师服务未启动。在教案目录运行 {command}，启动后这里会自己连上。',
      'tutor.you': '你',

      'tutor.thread.untitled': '（空话题）',
      'tutor.thread.truncated': '{text}…',
      'tutor.thread.meta': '{asked} 问 · {when}',
      'tutor.time.now': '刚刚',
      'tutor.time.minutes': '{n} 分钟前',
      'tutor.time.hours': '{n} 小时前',
      'tutor.time.days': '{n} 天前',

      'tutor.act.pin': '📌 钉住',
      'tutor.act.pinned': '✓ 已钉住',
      'tutor.act.copy': '📋 复制',
      'tutor.act.copied': '✓ 已复制',
      'tutor.act.regen': '↻ 重答',
      'tutor.act.regen.title': '让老师换一种说法重答',
      'tutor.act.retry': '↻ 再试一次',
      'tutor.act.offline': '服务未启动',

      'tutor.stage.sending': '正在发送…',
      'tutor.stage.accepted': '老师已接到问题，正在启动…',
      'tutor.stage.reading': '老师正在读教案…',
      'tutor.stage.reading.at': '老师正在读 {target}',
      'tutor.stage.answering': '老师正在作答…',
      'tutor.stop': '停止',
      'tutor.stop.title': '停止这次提问',
      'tutor.stopped': '已停止。',
      'tutor.elapsed.seconds': '{seconds} 秒',
      'tutor.elapsed.minutes': '{minutes} 分 {seconds} 秒',
      'tutor.tool': '📖 {name} · {target}',
      'tutor.tool.bare': '📖 {name}',
      'tutor.fail.connect': '没能连上老师服务。',
      'tutor.fail.answer': '老师这次没能答上来。',
      'tutor.recorded': '判定已记进 {record}，下次上课老师会读到。',

      'tutor.notes.heading': '📌 我钉住的问答',
      'tutor.notes.answer': '助教回答',
      'tutor.notes.delete': '×',
      'tutor.notes.delete.title': '删除这条',
      'tutor.notes.question': 'Q: {question}',

      'tutor.copy.me': '我',
      'tutor.copy.turn': '{who}：{text}',
      'tutor.copy.selection': '选中的原文：\n"""\n{text}\n"""',
      'tutor.copy.history': '我们前面已经聊过：\n{turns}',
      'tutor.copy.submission': '这是我交上来的作业：\n"""\n{text}\n"""',
      'tutor.copy.question': '我的问题：{text}',

      'tutor.role.tutor.title': '🎓 问答助教',
      'tutor.role.tutor.reply': '助教',
      'tutor.role.tutor.ask.1': '这段什么意思',
      'tutor.role.tutor.ask.2': '换个类比讲',
      'tutor.role.tutor.ask.3': '为什么不是这样',
      'tutor.role.tutor.ask.4': '和前面哪节课有关',
      'tutor.role.tutor.lead': '我正在读这一课：{page}',
      'tutor.role.tutor.brief':
        '（请以问答助教的身份回答：先读 NOTES.md 和 MISSION.md 了解我的偏好和目标，'
        + '渐进式披露，只讲我问的这一点。）',
      'tutor.role.grader.title': '📝 作业评分',
      'tutor.role.grader.reply': '评分',
      'tutor.role.grader.ask.1': '这一条为什么没过',
      'tutor.role.grader.ask.2': '我不同意这个判定',
      'tutor.role.grader.ask.3': '下次该怎么改',
      'tutor.role.grader.ask.4': '举个做对了的例子',
      'tutor.role.grader.lead': '我在做这份作业：{page}',
      'tutor.role.grader.brief':
        '（请用 grader 子 agent 判这份作业——它在 .claude/agents/grader.md，就在这个教案目录里。'
        + '不要自己判：出题的老师不判自己出的作业。）'
    }
  };

  /** The language the page declares, which is the only place one is read from. */
  function documentLang() {
    var root = document.documentElement;
    var declared = root && root.getAttribute ? root.getAttribute('lang') : '';
    return (declared || '').trim();
  }

  /** The tags to try, most specific first: `zh-CN`, then `zh`, then English. */
  function candidates(tag) {
    var order = tag ? [tag] : [];
    var base = tag.split('-')[0];
    if (base && base !== tag) order.push(base);
    if (order.indexOf('en') === -1) order.push('en');
    return order;
  }

  /**
   * One rung of the chain: what this tag has for this key, Workspace first.
   * `hasOwnProperty` rather than a truth test, so that a table may deliberately
   * blank a string — and so that a `lang` of `__proto__` finds nothing rather
   * than reaching up an inherited chain.
   */
  function entry(key, tag) {
    var own = window.TEACH_STRINGS;
    var overridden = own && Object.prototype.hasOwnProperty.call(own, tag) ? own[tag] : null;
    if (overridden && Object.prototype.hasOwnProperty.call(overridden, key)) return overridden[key];

    var shipped = Object.prototype.hasOwnProperty.call(TABLES, tag) ? TABLES[tag] : null;
    if (shipped && Object.prototype.hasOwnProperty.call(shipped, key)) return shipped[key];

    return null;
  }

  /** Put the page's own values into a table entry's `{name}` slots. */
  function fill(text, values) {
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole;
    });
  }

  /**
   * What this page says for `key`, in the Learner's language.
   *
   * A key with no entry anywhere answers with the key. That is deliberately
   * legible rather than empty: a Learner seeing `tutor.send` on a button can
   * report it, and the suite fails on it long before they do.
   */
  function say(key, values) {
    var tags = candidates(documentLang());
    for (var i = 0; i < tags.length; i++) {
      var found = entry(key, tags[i]);
      if (found !== null) return fill(found, values);
    }
    return key;
  }

  window.LearnerText = { say: say, TABLES: TABLES };
})();

/**
 * ============================================================================
 * Part two — the bootstrap
 * ============================================================================
 *
 * The point is that lesson authors never wire infrastructure by hand. Adding a
 * future page-wide component means editing this file — not every lesson.
 *
 * data-unit is the one genuinely per-page value. Omit it on pages that are not
 * part of a unit; the nav bar degrades to just the dossier link.
 *
 * Separate from the part above, and deliberately: that one has to run in a page
 * too old to have `document.currentScript`, and in a page that loaded this file
 * for the text alone. This one returns at once when there is no way to find out
 * where it was loaded from.
 */
(function () {
  'use strict';

  var self = document.currentScript;
  if (!self) return; // No currentScript => ancient browser; lesson still reads fine.

  var unit = self.getAttribute('data-unit') || '';
  var root = self.src.replace(/assets\/lesson-boot\.js.*$/, ''); // "../" from lessons/

  function css(href) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = root + href;
    document.head.appendChild(l);
  }

  /**
   * Give the page the workspace's language, when the page did not state one.
   *
   * `<html lang>` stays the single authority — components read it, and so does
   * the browser. But a per-page attribute is a discipline, and a forgotten
   * discipline fails silently: a learner would get a screen in somebody else's
   * language with nothing erroring. The manifest is the one file every page
   * already loads, so it is where the workspace says this once.
   */
  function applyLanguage() {
    var page = document.documentElement;
    if (!page || page.getAttribute('lang')) return; // the page declared its own
    var course = window.TEACH_COURSE;
    if (course && course.lang) page.setAttribute('lang', course.lang);
  }

  // Sequential: units.js defines the manifest nav.js reads, it also carries the
  // language every later script renders in, and tutor.js renders its answers
  // with rich-text.js. So order matters, and `then` is how a step that has to
  // happen *between* two files gets to.
  function chain(specs) {
    var spec = specs.shift();
    if (!spec) return;
    var s = document.createElement('script');
    s.src = root + spec.src;
    if (spec.unit && unit) s.setAttribute('data-unit', unit);
    var next = function () {
      if (spec.then) spec.then();
      chain(specs);
    };
    s.onload = next;
    s.onerror = next; // One missing component must not block the rest.
    document.body.appendChild(s);
  }

  css('assets/nav.css');
  css('assets/tutor.css');

  // strings.js is the workspace's own table and may not exist yet — an older
  // workspace simply has not been scaffolded since it was introduced. `onerror`
  // carries on, and the lookup above falls back to the tables shipped with it.
  chain([
    { src: 'assets/units.js', then: applyLanguage },
    { src: 'assets/strings.js' },
    { src: 'assets/nav.js', unit: true },
    { src: 'assets/rich-text.js' },
    { src: 'assets/tutor.js' },
  ]);
})();
