/* units.js — the single source of truth for what this course contains.
 *
 * index.html (the dossier cover) and nav.js both read this. A lesson page
 * declares only its own unit id; prev/next/sibling links are derived here,
 * so no page ever hand-writes a link list.
 *
 * Keep in sync with CURRICULUM.md — the cover shows whatever is here.
 *
 *   status: 'done'     completed and verified
 *           'teaching' taught, awaiting verification
 *           'todo'     not started
 *
 * Omit lesson/checkpoint/assignment when that artifact does not exist yet;
 * the cover and the nav bar both handle absence gracefully.
 */

/* Course identity — rendered on the dossier cover.
   subtitle/thesis may contain inline HTML (authored content, not user input).

   `lang` is the learner's language, stated once for the whole workspace as a
   BCP-47 tag ('en', 'zh-CN', 'ja', 'pt-BR'). Every page picks it up from here:
   lesson-boot.js writes it onto any page that did not declare its own, and
   scripts/wire-lessons.sh fills it in on the pages it rewrites. Nothing else in
   the workspace names a language, so changing it here changes all of it.

   Components render in it from the tables the plugin ships; assets/strings.js
   is where this workspace overrides one or supplies a language the plugin does
   not ship. Left empty, everything the learner reads is English. */
window.TEACH_COURSE = {
  lang:     'en',
  title:    '',
  subtitle: '',
  thesisLabel: '主命题',
  thesis:   ''
};

window.TEACH_UNITS = [
  // {
  //   id: '01', num: 'L01', status: 'todo',
  //   title: '',
  //   claim: '',
  //   lesson:     'lessons/0001-slug.html',
  //   checkpoint: 'lessons/0001b-checkpoint.html',
  //   assignment: 'assignments/0001-slug.html',
  //   assignmentNote: ''
  // }
];

/* Quick-reference sheets in reference/. Rendered on the cover when non-empty. */
window.TEACH_REFS = [];

/* Course-level documents shown on the dossier cover. */
window.TEACH_DOCS = [
  { path: 'CURRICULUM.md', label: '课程地图', note: '知识层级与完整序列' },
  { path: 'RESOURCES.md',  label: '资源清单', note: '可信来源，以及每一份适合查什么' },
  { path: 'MISSION.md',    label: '学习目标', note: '为什么学这个——所有课都要追溯到这里' }
];
