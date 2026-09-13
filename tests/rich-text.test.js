'use strict';

// The complaint this closes: "every answer is inserted as plain text, which
// makes the Tutor close to useless for any subject involving code."
//
// The renderer is the one piece of security-relevant client code this plugin
// ships, so it is built the way that makes it checkable: it takes a node
// factory and never reaches for a global `document`. That is what lets the
// whole of it run here, in a context that has no browser in it at all — the
// sandbox below holds nothing but what the file puts there.
//
// Two claims are held. **Shape**: a heading is a heading, a fence is a block of
// literal code, a list is a list. **Inertness**: nothing a Tutor could be
// talked into writing reaches a position a browser would execute. The second
// is the reason the first is not done with a Markdown library and an
// `innerHTML` assignment.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const { SKILL_DIR } = require('./helpers/docs.js');

const SOURCE_FILE = path.join(SKILL_DIR, 'runtime', 'assets', 'rich-text.js');

/**
 * The renderer, loaded into a context with no browser in it.
 *
 * Not `require`: this ships as a `<script>`, and running it the way a page
 * would is what proves the claim. A sandbox holding only what the file defines
 * means any reach for `document`, `window` or `location` throws here rather
 * than in a learner's page.
 */
function renderer() {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(SOURCE_FILE, 'utf8'), sandbox, { filename: 'rich-text.js' });
  assert.equal(typeof sandbox.RichText, 'object', 'the file should define RichText on its global');
  return sandbox.RichText;
}

/**
 * The node factory, as small as the renderer's contract allows: something to
 * make an element with, something to make text with. A node has to accept
 * children and attributes and nothing else.
 */
function factory() {
  return {
    element(tagName) {
      return {
        tag: tagName,
        attrs: {},
        children: [],
        appendChild(child) {
          this.children.push(child);
          return child;
        },
        setAttribute(name, value) {
          this.attrs[name] = String(value);
        },
      };
    },
    text(value) {
      return { text: String(value) };
    },
  };
}

/**
 * Render source into the plain-object tree the factory above builds.
 *
 * `Array.from` is not decoration: the renderer runs in its own context, so the
 * array it hands back is that context's Array, and a strict deep-equal against
 * one of ours fails on the prototype while the contents match. Everything
 * below this line is ours.
 */
function render(source) {
  return Array.from(renderer().render(source, factory()));
}

/** Every node in a rendered tree, in document order, roots included. */
function walk(nodes) {
  return nodes.flatMap((node) => (node.tag ? [node, ...walk(node.children)] : [node]));
}

/** Just the elements. */
function elements(nodes) {
  return walk(nodes).filter((node) => node.tag);
}

/** The tag of each top-level block, which is what block parsing decides. */
function blocks(nodes) {
  return nodes.map((node) => node.tag || '#text');
}

/** Text as a reader sees it. */
function textOf(nodes) {
  return walk(nodes)
    .map((node) => (node.tag ? '' : node.text))
    .join('');
}

/** The first element with this tag, anywhere in the tree. */
function first(nodes, tag) {
  return elements(nodes).find((node) => node.tag === tag) || null;
}

/** Every element with this tag, anywhere in the tree. */
function all(nodes, tag) {
  return elements(nodes).filter((node) => node.tag === tag);
}

/* ------------------------------------------------------------------- shape */

test('a blank line separates one paragraph from the next', () => {
  const nodes = render('First thought.\n\nSecond thought.');

  assert.deepEqual(blocks(nodes), ['p', 'p']);
  assert.equal(textOf([nodes[0]]), 'First thought.');
  assert.equal(textOf([nodes[1]]), 'Second thought.');
});

test('a line break inside a paragraph is kept, because the Tutor meant it', () => {
  // A Tutor writes one point per line far more often than it writes a wrapped
  // paragraph, and collapsing those into one run is most of the defect this
  // renderer exists to fix.
  const nodes = render('One point.\nAnother point.');

  assert.deepEqual(blocks(nodes), ['p']);
  assert.equal(all(nodes, 'br').length, 1);
  assert.equal(textOf(nodes), 'One point.Another point.');
});

test('a heading renders at the level it was written at', () => {
  const nodes = render('# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six');

  assert.deepEqual(blocks(nodes), ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  assert.equal(textOf([nodes[2]]), 'Three');
});

test('a run of bullets becomes one list, and the next paragraph is not in it', () => {
  const nodes = render('Two things:\n\n- first\n- second\n\nAnd then prose.');

  assert.deepEqual(blocks(nodes), ['p', 'ul', 'p']);
  assert.deepEqual(
    all(nodes, 'li').map((li) => textOf([li])),
    ['first', 'second'],
  );
});

test('a numbered list is ordered, and its numbers are the browser\'s to draw', () => {
  const nodes = render('1. fork\n2. exec\n3. wait');

  assert.deepEqual(blocks(nodes), ['ol']);
  assert.deepEqual(
    all(nodes, 'li').map((li) => textOf([li])),
    ['fork', 'exec', 'wait'],
  );
  assert.ok(!textOf(nodes).includes('1.'), 'the marker is the list\'s, not text inside the item');
});

test('a sub-point is a list inside its item, not five items in a row', () => {
  const nodes = render('1. shell reads the line\n2. it forks\n   - the child gets 0\n   - the parent gets a pid\n3. it waits');

  assert.deepEqual(blocks(nodes), ['ol']);

  const outer = first(nodes, 'ol');
  assert.equal(outer.children.length, 3, 'three steps, whatever hangs off them');

  const nested = first(nodes, 'ul');
  assert.ok(nested, 'the sub-points are a list of their own');
  assert.equal(outer.children[1].children.filter((n) => n.tag === 'ul').length, 1, 'hung off the step they belong to');
  assert.match(textOf([outer.children[1]]), /^it forks/, 'and the step still reads first');
  assert.deepEqual(nested.children.map((li) => textOf([li])), ['the child gets 0', 'the parent gets a pid']);
});

test('a blank line between two bullets does not start a second list', () => {
  const nodes = render('- first\n\n- second');

  assert.deepEqual(blocks(nodes), ['ul']);
  assert.equal(all(nodes, 'li').length, 2);
});

test('a marker of the other kind does start one', () => {
  const nodes = render('- a bullet\n1. a step');

  assert.deepEqual(blocks(nodes), ['ul', 'ol']);
});

test('a wrapped bullet stays one bullet', () => {
  const nodes = render('- a point long enough that the Tutor\n  wrapped it onto a second line\n- the next point');

  assert.equal(all(nodes, 'li').length, 2);
  assert.match(textOf([all(nodes, 'li')[0]]), /wrapped it onto a second line/);
});

test('a fenced block is code, and nothing inside it is Markdown', () => {
  const nodes = render('Try this:\n\n```c\nint *p = NULL; /* **not bold** */\n```\n\nThat is it.');

  assert.deepEqual(blocks(nodes), ['p', 'pre', 'p']);

  const pre = first(nodes, 'pre');
  assert.deepEqual(pre.children.map((n) => n.tag), ['code'], 'code is wrapped, the way a browser expects');
  assert.equal(textOf([pre]), 'int *p = NULL; /* **not bold** */\n');
  assert.equal(all(nodes, 'strong').length, 0, 'a fence is literal all the way through');
});

test('a fence carries its language, and only as a class a stylesheet can use', () => {
  const named = render('```js\nlet x = 1;\n```');
  assert.equal(first(named, 'code').attrs.class, 'language-js');

  const bare = render('```\nplain\n```');
  assert.equal(first(bare, 'code').attrs.class, undefined, 'no language, no class');

  // An info string is the Tutor's text, so it is checked rather than trusted.
  const hostile = render('```js" onload="alert(1)\nlet x = 1;\n```');
  assert.equal(first(hostile, 'code').attrs.class, undefined);
});

test('an unterminated fence still renders as code rather than swallowing the answer', () => {
  // Every streamed answer passes through this state on its way to being whole.
  const nodes = render('Here:\n\n```py\nprint("hi")');

  assert.deepEqual(blocks(nodes), ['p', 'pre']);
  assert.equal(textOf([first(nodes, 'pre')]), 'print("hi")\n');
});

test('inline code is literal, and survives inside anything else', () => {
  const nodes = render('Call `fork()` — note the `**` is not emphasis.');

  assert.deepEqual(
    all(nodes, 'code').map((c) => textOf([c])),
    ['fork()', '**'],
  );
  assert.equal(all(nodes, 'strong').length, 0);
});

test('emphasis renders as emphasis', () => {
  const nodes = render('**strong** and *slanted* and _also slanted_ and **inside `code` too**');

  assert.deepEqual(
    all(nodes, 'strong').map((n) => textOf([n])),
    ['strong', 'inside code too'],
  );
  assert.deepEqual(
    all(nodes, 'em').map((n) => textOf([n])),
    ['slanted', 'also slanted'],
  );
  assert.equal(all(nodes, 'code').length, 1, 'markup nests; code inside emphasis is still code');
});

test('a run of three markers is both, with neither left as text', () => {
  const nodes = render('***really*** matters');

  assert.equal(all(nodes, 'em').length, 1);
  assert.equal(all(nodes, 'strong').length, 1);
  assert.equal(textOf(nodes), 'really matters', 'no stray asterisk survives');
});

test('an unpaired marker is text, not an unclosed element', () => {
  const nodes = render('2 * 3 * 4 is not emphasis, and a lone ` is just a backtick');

  assert.equal(all(nodes, 'em').length, 0);
  assert.equal(all(nodes, 'code').length, 0);
  assert.match(textOf(nodes), /2 \* 3 \* 4/);
});

test('a link keeps its label and its destination', () => {
  const nodes = render('See [the manual](https://example.org/fork) and [Unit 3](../lessons/0003.html).');

  const links = all(nodes, 'a');
  assert.deepEqual(links.map((a) => textOf([a])), ['the manual', 'Unit 3']);
  assert.deepEqual(links.map((a) => a.attrs.href), ['https://example.org/fork', '../lessons/0003.html']);

  // Leaving the page would cost the learner the drawer they were reading in.
  assert.equal(links[0].attrs.target, '_blank');
  assert.match(links[0].attrs.rel, /noopener/);
  assert.match(links[0].attrs.rel, /noreferrer/);
  assert.equal(links[1].attrs.target, undefined, 'a page in this Workspace opens in place');
});

/* ---------------------------------------------------------------- inertness */

/**
 * What the renderer is allowed to build. Anything outside this is either a
 * mistake or an escape, and the difference is not worth arguing about at
 * review time — so the set is asserted rather than described.
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'pre', 'code', 'strong', 'em', 'a',
]);

/** And what it is allowed to put on one. */
const ALLOWED_ATTRS = new Set(['class', 'href', 'rel', 'target']);

/** A scheme a browser will run code from, seen through the browser's own eyes. */
const SCRIPTED = /^(?:javascript|data|vbscript):/i;

/**
 * Sources a Tutor could be talked into producing, each paired with what a
 * learner must see instead of whatever it was trying to do. Answers are
 * generated text: the model that writes them reads the Lesson, the learner's
 * notes and the passage they selected, so "the source is trusted" is not a
 * position this renderer gets to take.
 */
const HOSTILE = [
  { source: '<script>alert(1)</script>', shows: 'alert(1)' },
  { source: '<img src=x onerror="alert(1)">', shows: 'onerror' },
  { source: '<div onmouseover="alert(1)">hover</div>', shows: 'hover' },
  { source: '<a href="javascript:alert(1)">x</a>', shows: 'javascript:alert(1)' },
  { source: '[run me](javascript:alert(1))', shows: 'run me' },
  { source: '[run me](JaVaScRiPt:alert(1))', shows: 'run me' },
  { source: '[run me](java\tscript:alert(1))', shows: 'run me' },
  { source: '[run me](  javascript:alert(1)  )', shows: 'run me' },
  { source: '[run me](data:text/html;base64,PHNjcmlwdD4=)', shows: 'run me' },
  { source: '[run me](vbscript:msgbox(1))', shows: 'run me' },
  { source: '# <script>alert(1)</script>', shows: 'alert(1)' },
  { source: '- <img src=x onerror=alert(1)>', shows: 'onerror' },
  { source: '**<script>alert(1)</script>**', shows: 'alert(1)' },
  { source: '[<script>alert(1)</script>](#ok)', shows: 'alert(1)' },
  { source: '`<script>alert(1)</script>`', shows: 'alert(1)' },
  { source: '```html\n<script>alert(1)</script>\n```', shows: 'alert(1)' },
  { source: '![tracker](https://example.org/pixel.gif?who=me)', shows: 'tracker' },
];

test('markup in an answer is text a learner reads, never a node a browser runs', () => {
  for (const { source, shows } of HOSTILE) {
    const nodes = render(source);
    const where = JSON.stringify(source);

    assert.ok(textOf(nodes).includes(shows), `${where}: the learner should still see ${shows}`);

    for (const el of elements(nodes)) {
      assert.ok(ALLOWED_TAGS.has(el.tag), `${where}: built a <${el.tag}>`);

      for (const [name, value] of Object.entries(el.attrs)) {
        assert.ok(ALLOWED_ATTRS.has(name), `${where}: set ${name}= on <${el.tag}>`);
        assert.ok(!/^on/i.test(name), `${where}: ${name} is an event handler`);
        assert.doesNotMatch(
          value.replace(/[\x00-\x20\x7f]/g, ''),
          SCRIPTED,
          `${where}: ${name}= would run code`,
        );
      }
    }
  }
});

test('a title beside a destination is not part of the destination', () => {
  const nodes = render('See [the manual](https://example.org/fork "fork(2)") for the detail.');

  assert.equal(first(nodes, 'a').attrs.href, 'https://example.org/fork');
  assert.equal(textOf(nodes), 'See the manual for the detail.');
});

test('a destination is read the way the browser will read it', () => {
  // The same normalisation that rejects `java\tscript:` has to decide whether a
  // link is external, or an answer could smuggle one past `rel`/`target`.
  const nodes = render('[out](http\t://example.org/p)');
  const link = first(nodes, 'a');

  if (link) {
    assert.equal(link.attrs.href, 'http://example.org/p', 'the href is what the browser would resolve');
    assert.equal(link.attrs.target, '_blank');
    assert.match(link.attrs.rel, /noopener/);
  } else {
    assert.match(textOf(nodes), /example\.org/, 'or it stays as text, which is also fine');
  }
});

test('a destination the renderer will not vouch for stays as written, in text', () => {
  // Dropping it silently would be worse than useless: the learner would see a
  // label with no destination and no way to tell that anything was removed.
  const nodes = render('[run me](javascript:alert(1))');

  assert.equal(all(nodes, 'a').length, 0, 'nothing links anywhere');
  assert.equal(textOf(nodes), '[run me](javascript:alert(1))');
});

test('a destination the renderer does vouch for is passed through unchanged', () => {
  const safe = ['https://example.org/a?b=c#d', 'http://example.org/', 'mailto:teacher@example.org', '#anchor', '/index.html', '../lessons/0003.html'];

  for (const href of safe) {
    const nodes = render(`[label](${href})`);
    assert.equal(all(nodes, 'a').length, 1, `${href} should be a link`);
    assert.equal(first(nodes, 'a').attrs.href, href);
  }
});

/* ---------------------------------------------------------------- contract */

test('the renderer never reaches for a browser', () => {
  // The sandbox in renderer() is the real check — a reach for `document` at
  // load time throws there. This holds the half that only fires on some input,
  // and it is the interface claim the ticket makes: a node factory, passed in.
  const source = fs.readFileSync(SOURCE_FILE, 'utf8');

  for (const global of ['document', 'window', 'location', 'navigator']) {
    assert.doesNotMatch(
      source.replace(/^\s*(\/\/.*|\*.*)$/gm, ''),
      new RegExp(String.raw`\b${global}\b`),
      `rich-text.js names ${global}, so it can only be tested where one exists`,
    );
  }
});

test('an empty answer renders as nothing at all', () => {
  for (const empty of ['', '   ', '\n\n', null, undefined]) {
    assert.deepEqual(render(empty), [], `${JSON.stringify(empty)} should render no blocks`);
  }
});

test('the factory is the only way nodes are made', () => {
  // Guard the observer, and the contract with it: a renderer that made nodes
  // some other way would pass every check above while being untestable here.
  const made = [];
  const make = factory();
  const spy = {
    element: (tag) => {
      made.push(tag);
      return make.element(tag);
    },
    text: (value) => {
      made.push('#text');
      return make.text(value);
    },
  };

  renderer().render('# Title\n\n- `code`\n- [link](#a)\n\n```\nfenced\n```', spy);

  assert.ok(made.includes('h1'), 'the heading came from the factory');
  assert.ok(made.includes('pre'), 'the fence came from the factory');
  assert.ok(made.filter((m) => m === '#text').length >= 4, 'so did every run of text');
});
