'use strict';

// Every Component assertion in this suite is only as true as the DOM it ran
// in. A parser that quietly dropped an element, or a selector that quietly
// matched nothing, would turn "the Component works" into a claim about
// nothing at all. So the harness is held to its own guard first.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { Page, parseHTML } = require('./helpers/dom.js');

/** A directory holding one throwaway script, for `page.script()` to load. */
function assetsWith(t, file, source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explorable-teach-dom-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, file), source, 'utf8');
  return dir;
}

test('parsing keeps structure, attributes and text', () => {
  const doc = parseHTML(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>Lesson</title></head>
<body>
<div class="exercise" data-exercise>
  <p class="exercise-prompt">fork() 返回几次?</p>
  <ol><li data-correct>两次</li><li>一次</li></ol>
</div>
</body>
</html>`);

  assert.equal(doc.title, 'Lesson');
  assert.equal(doc.documentElement.getAttribute('lang'), 'zh-CN');
  assert.equal(doc.body.querySelectorAll('li').length, 2);
  assert.equal(doc.querySelector('.exercise-prompt').textContent, 'fork() 返回几次?');
  assert.equal(doc.querySelector('[data-correct]').textContent, '两次');
  assert.equal(doc.querySelector('.exercise').getAttribute('data-exercise'), '');
});

test('void elements do not swallow the rest of the document', () => {
  const doc = parseHTML('<body><link rel="stylesheet" href="a.css"><p>after</p><br><p>end</p></body>');

  assert.equal(doc.body.children.length, 4);
  assert.equal(doc.querySelectorAll('p').length, 2);
  assert.equal(doc.querySelector('link').getAttribute('href'), 'a.css');
});

test('script and style content is text, not markup', () => {
  const doc = parseHTML('<body><style>.a > .b { color: red }</style><script>if (a < b) x();</script><p>real</p></body>');

  assert.equal(doc.querySelectorAll('p').length, 1, 'nothing inside script/style is an element');
  assert.match(doc.querySelector('script').textContent, /a < b/);
  assert.match(doc.querySelector('style').textContent, /color: red/);
});

test('selectors match by tag, class, id, attribute and descent', () => {
  const doc = parseHTML(`<body>
    <section id="unit"><ul class="list"><li class="item" data-order="2">b</li></ul></section>
    <li class="item">loose</li>
  </body>`);

  assert.equal(doc.querySelectorAll('li').length, 2);
  assert.equal(doc.querySelectorAll('.list .item').length, 1, 'descent should narrow the match');
  assert.equal(doc.querySelector('#unit .item[data-order="2"]').textContent, 'b');
  assert.equal(doc.querySelectorAll('[data-order]').length, 1);
  assert.equal(doc.querySelectorAll('li, section').length, 3, 'a comma group matches either side');
  assert.equal(doc.querySelector('.item').closest('section').id, 'unit');
});

test('a selector this DOM cannot honour throws instead of matching nothing', () => {
  const doc = parseHTML('<body><p>x</p></body>');

  assert.throws(() => doc.querySelectorAll('ul > li'), /combinator/);
  assert.throws(() => doc.querySelectorAll('p:nth-child(2)'), /beyond what this DOM implements/);
});

test('events fire on the target and bubble to ancestors', () => {
  const doc = parseHTML('<body><div class="box"><button>go</button></div></body>');
  const { DomEvent } = require('./helpers/dom.js');
  const seen = [];

  doc.querySelector('button').addEventListener('click', () => seen.push('button'));
  doc.querySelector('.box').addEventListener('click', (e) => seen.push('box:' + e.target.localName));
  doc.querySelector('button').dispatchEvent(new DomEvent('click'));

  assert.deepEqual(seen, ['button', 'box:button']);
});

test('textContent replaces children, and innerHTML is refused', () => {
  const doc = parseHTML('<body><p><em>old</em></p></body>');
  const p = doc.querySelector('p');

  p.textContent = 'new';
  assert.equal(p.querySelectorAll('em').length, 0);
  assert.equal(p.textContent, 'new');
  assert.throws(() => {
    p.innerHTML = '<script>x</script>';
  }, /build nodes/);
});

test('hidden and disabled are the attributes they are, not expandos', () => {
  // Both are read back by tests as booleans. Were they plain properties, an
  // element nothing had assigned one to would answer `undefined` — and an
  // assertion that a button is *not* disabled would pass on a button that is.
  const doc = parseHTML('<body><button>go</button><p hidden>gone</p></body>');
  const button = doc.querySelector('button');

  assert.equal(button.disabled, false, 'a button nobody disabled is enabled');
  button.disabled = true;
  assert.equal(button.getAttribute('disabled'), '');
  button.disabled = false;
  assert.equal(button.hasAttribute('disabled'), false, 'and false clears it, as in a browser');

  assert.equal(doc.querySelector('p').hidden, true, 'the authored attribute is read back');
});

test('classList takes one token at a time', () => {
  const doc = parseHTML('<body><p class="a">x</p></body>');
  const p = doc.querySelector('p');

  p.classList.add('b');
  assert.equal(p.className, 'a b');
  assert.equal(p.classList.contains('b'), true);
  p.classList.remove('a');
  assert.equal(p.className, 'b');
  assert.throws(() => p.classList.add('c d'), /one token/);
});

test('a script runs against the page and can change it', (t) => {
  const dir = assetsWith(t, 'toy.js', `
    (function () {
      var el = document.querySelector('[data-toy]');
      el.classList.add('is-mounted');
      el.addEventListener('click', function () { el.textContent = 'clicked'; });
    })();
  `);
  const page = Page.load('<body><div data-toy>idle</div></body>', dir);

  page.script('toy.js');
  assert.ok(page.query('[data-toy]').classList.contains('is-mounted'));

  page.click(page.query('[data-toy]'));
  assert.equal(page.text('[data-toy]'), 'clicked');
});

test('a script sees document.currentScript, as a Component relies on', (t) => {
  const dir = assetsWith(t, 'boot.js', `
    window.seenSrc = document.currentScript.getAttribute('src');
  `);
  const page = Page.load('<body></body>', dir);

  page.script('boot.js');

  assert.equal(page.window.seenSrc, '../assets/boot.js');
  assert.equal(page.document.currentScript, null, 'currentScript is cleared once the script ends');
});

test('a script is given the attributes its page writes on the tag', (t) => {
  const dir = assetsWith(t, 'bar.js', `
    window.seenUnit = document.currentScript.getAttribute('data-unit');
  `);
  const page = Page.load('<body></body>', dir);

  // The nav bar reads its own tag to find out which Unit it is rendering, so a
  // test that could not write one would be driving a bar that never mounted.
  page.script('bar.js', { 'data-unit': '0003' });

  assert.equal(page.window.seenUnit, '0003');
});

test('src is backed by the attribute, so a script can resolve paths from itself', () => {
  const doc = parseHTML('<body><script src="../assets/lesson-boot.js"></script></body>');
  const tag = doc.querySelector('script');

  // The bootstrap reads its own src to find assets/ from a page in lessons/,
  // then writes one onto each script it loads. Both ends have to be real.
  assert.equal(tag.src, '../assets/lesson-boot.js');

  const next = doc.createElement('script');
  next.src = '../assets/units.js';
  assert.equal(next.getAttribute('src'), '../assets/units.js');
});

test('placeholder is backed by the attribute too, being a label a Learner reads', () => {
  const doc = parseHTML('<body><textarea></textarea></body>');
  const box = doc.querySelector('textarea');

  assert.equal(box.getAttribute('placeholder'), null);
  assert.equal(box.placeholder, '', 'an unset attribute reads as empty, never undefined');

  box.placeholder = 'Ask something…';

  // The drawer labels its composer by assigning this, and that label is
  // Learner-facing text — so the check that asserts no Component hardcoded a
  // word reads it back off the attribute.
  assert.equal(box.getAttribute('placeholder'), 'Ask something…');
});

test('href and title are backed by the attribute, like hidden and disabled', () => {
  const doc = parseHTML('<body><a>bare</a></body>');
  const link = doc.querySelector('a');

  // The quiet way past this subset is a property nothing models: assigning one
  // succeeds as an expando, and a test reading the attribute back sees nothing
  // and reports a link that is really there as missing. The nav bar builds
  // every one of its links by assigning both of these.
  assert.equal(link.getAttribute('href'), null);
  assert.equal(link.href, '', 'an unset attribute reads as empty, never undefined');

  link.href = '../lessons/0003b-checkpoint.html';
  link.title = 'L03 · 验收';

  assert.equal(link.getAttribute('href'), '../lessons/0003b-checkpoint.html');
  assert.equal(link.getAttribute('title'), 'L03 · 验收');
  assert.equal(doc.querySelectorAll('[href]').length, 1, 'and a selector can find it by attribute');
});

test('a throwing script fails the test rather than passing quietly', (t) => {
  const dir = assetsWith(t, 'broken.js', 'nope.this.is.not.defined();');
  const page = Page.load('<body></body>', dir);

  assert.throws(() => page.script('broken.js'), /nope/);
});

test('a global reaches a script only when a test names it', (t) => {
  const dir = assetsWith(t, 'stores.js', `
    window.saw = typeof localStorage === 'undefined' ? 'nothing' : localStorage.getItem('k');
  `);

  // Bare by default, which is what keeps a Component honest about what it needs.
  const bare = Page.load('<body></body>', dir);
  bare.script('stores.js');
  assert.equal(bare.window.saw, 'nothing');

  const given = Page.load('<body></body>', dir, {
    globals: { localStorage: { getItem: () => 'v' } },
  });
  given.script('stores.js');
  assert.equal(given.window.saw, 'v');
});
