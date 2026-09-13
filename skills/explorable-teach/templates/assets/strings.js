/* strings.js — Learner-facing text this workspace supplies for itself.
 *
 * The plugin ships tables for `en` and `zh-CN`. This file is where a workspace
 * overrides an entry it disagrees with, or adds a whole language the plugin has
 * not collected yet. It is yours: the scaffold places it once and never touches
 * it again.
 *
 * The language itself is not set here — it is set once, in assets/units.js, as
 * window.TEACH_COURSE.lang. This file only says what the words are.
 *
 * Keyed by the same BCP-47 tag the pages carry, then by the key the component
 * asks for. Anything absent falls back to the plugin's table, then to English,
 * so overriding one button is one line and costs nothing else.
 *
 *   window.TEACH_STRINGS = {
 *     'ja': {
 *       'tutor.send': '送信',
 *       'tutor.status.online': 'オンライン'
 *     }
 *   };
 *
 * The keys live at the head of the plugin's assets/lesson-boot.js — read that
 * file for the full list, and for which {name} slots each entry may use. They
 * cover everything a page puts on screen: the tutor drawer, the navigation bar,
 * and every component a lesson is built from.
 */

window.TEACH_STRINGS = {};
