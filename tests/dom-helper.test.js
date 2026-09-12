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

test('a throwing script fails the test rather than passing quietly', (t) => {
  const dir = assetsWith(t, 'broken.js', 'nope.this.is.not.defined();');
  const page = Page.load('<body></body>', dir);

  assert.throws(() => page.script('broken.js'), /nope/);
});
