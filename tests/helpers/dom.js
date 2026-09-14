'use strict';

/**
 * A DOM small enough to read, real enough to mount a Component in.
 *
 *   const page = Page.load(html, ws.path('assets'));
 *   page.script('exercise.js');                 // run a shipped Component
 *   page.click(page.query('.exercise-option')); // drive it
 *   assert.ok(page.query('.exercise.is-correct'));
 *
 * Why this exists: the suite takes no third-party dependencies, so there is no
 * browser and no jsdom. A Component that only ever gets read by a test is not
 * under test at all — "it renders" has to mean something ran. This is the
 * smallest thing that lets a test answer "does clicking the right option mark
 * it right?" rather than "does the file contain the word click?".
 *
 * It is deliberately a subset, and it fails loudly rather than silently when a
 * Component reaches past that subset: unsupported selector syntax throws, and
 * `innerHTML` throws on assignment, because shipped Components are required to
 * build nodes instead of splicing markup. A Component that needs something this
 * lacks should either be written in the subset or grow the subset on purpose.
 *
 * The one way to widen it per test is `Page.load(html, dir, { globals })`,
 * which the Tutor's in-page drawer needs and no Component does — storage, a
 * service to probe, a stream to read. Naming them at the call site keeps the
 * default set bare, so a Component that starts reaching for one still throws.
 *
 * `page.script(file, attrs)` writes the attributes a page writes on the tag,
 * for the scripts that read their own — `data-unit` on the nav bar.
 * `page.inline()` runs a script the page carries rather than loads, which the
 * Dossier is the one page to need.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ------------------------------------------------------------------ parsing */

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** Elements whose content is text, not markup — never parsed as children. */
const RAW_TEXT = new Set(['script', 'style']);

const ATTR = /([^\s"'>/=]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g;

function parseAttributes(source) {
  const attrs = new Map();
  for (const m of source.matchAll(ATTR)) {
    const value = m[3] ?? m[4] ?? m[5] ?? '';
    if (!attrs.has(m[1])) attrs.set(m[1].toLowerCase(), value);
  }
  return attrs;
}

/* ------------------------------------------------------------------- nodes */

class ClassList {
  constructor(el) {
    this.el = el;
  }

  get _tokens() {
    return (this.el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  }

  _write(tokens) {
    this.el.setAttribute('class', tokens.join(' '));
  }

  contains(token) {
    return this._tokens.includes(token);
  }

  add(...tokens) {
    for (const token of tokens) assertToken(token);
    const next = this._tokens;
    for (const token of tokens) if (!next.includes(token)) next.push(token);
    this._write(next);
  }

  remove(...tokens) {
    for (const token of tokens) assertToken(token);
    this._write(this._tokens.filter((t) => !tokens.includes(t)));
  }

  toggle(token, force) {
    assertToken(token);
    const on = force === undefined ? !this.contains(token) : Boolean(force);
    if (on) this.add(token);
    else this.remove(token);
    return on;
  }

  get length() {
    return this._tokens.length;
  }

  toString() {
    return this._tokens.join(' ');
  }
}

/** The real DOM throws on a token with whitespace; so does this one. */
function assertToken(token) {
  if (typeof token !== 'string' || token === '' || /\s/.test(token)) {
    throw new Error(`classList takes one token at a time, got ${JSON.stringify(token)}`);
  }
}

class Node {
  constructor(doc) {
    this.ownerDocument = doc;
    this.parentNode = null;
    this.childNodes = [];
    this._listeners = new Map();
  }

  get children() {
    return this.childNodes.filter((n) => n instanceof Element);
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const kids = this.parentNode.childNodes;
    return kids[kids.indexOf(this) + 1] || null;
  }

  appendChild(child) {
    return this.insertBefore(child, null);
  }

  insertBefore(child, before) {
    if (child.parentNode) child.parentNode.removeChild(child);
    const at = before ? this.childNodes.indexOf(before) : this.childNodes.length;
    if (at < 0) throw new Error('insertBefore: reference node is not a child');
    this.childNodes.splice(at, 0, child);
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const at = this.childNodes.indexOf(child);
    if (at < 0) throw new Error('removeChild: not a child of this node');
    this.childNodes.splice(at, 1);
    child.parentNode = null;
    return child;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  get textContent() {
    return this.childNodes.map((n) => n.textContent).join('');
  }

  set textContent(value) {
    this.childNodes.forEach((n) => {
      n.parentNode = null;
    });
    this.childNodes = [];
    if (value !== '' && value !== null && value !== undefined) {
      this.appendChild(this.ownerDocument.createTextNode(String(value)));
    }
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    const handlers = this._listeners.get(type);
    if (!handlers.includes(handler)) handlers.push(handler);
  }

  removeEventListener(type, handler) {
    const handlers = this._listeners.get(type);
    if (handlers) this._listeners.set(type, handlers.filter((h) => h !== handler));
  }

  /** Fires on this node, then up every ancestor — enough for delegation. */
  dispatchEvent(event) {
    event.target = event.target || this;
    for (let node = this; node; node = node.parentNode) {
      event.currentTarget = node;
      for (const handler of [...(node._listeners.get(event.type) || [])]) {
        handler.call(node, event);
      }
      if (!event.bubbles) break;
    }
    return !event.defaultPrevented;
  }
}

class TextNode extends Node {
  constructor(doc, text) {
    super(doc);
    this.nodeType = 3;
    this.data = String(text);
  }

  get textContent() {
    return this.data;
  }

  set textContent(value) {
    this.data = String(value);
  }
}

class Element extends Node {
  constructor(doc, tagName) {
    super(doc);
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.classList = new ClassList(this);
    this.style = {};
    this._value = null;
  }

  get localName() {
    return this.tagName.toLowerCase();
  }

  getAttribute(name) {
    const value = this.attributes.get(name.toLowerCase());
    return value === undefined ? null : value;
  }

  setAttribute(name, value) {
    this.attributes.set(name.toLowerCase(), String(value));
  }

  hasAttribute(name) {
    return this.attributes.has(name.toLowerCase());
  }

  removeAttribute(name) {
    this.attributes.delete(name.toLowerCase());
  }

  get className() {
    return this.getAttribute('class') || '';
  }

  set className(value) {
    this.setAttribute('class', value);
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  get hidden() {
    return this.hasAttribute('hidden');
  }

  set hidden(on) {
    if (on) this.setAttribute('hidden', '');
    else this.removeAttribute('hidden');
  }

  /** Backed by the attribute, like `hidden`: assigning false must clear it,
   *  and reading it before anything assigned one must be `false` rather than
   *  the `undefined` an expando would give. */
  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(on) {
    if (on) this.setAttribute('disabled', '');
    else this.removeAttribute('disabled');
  }

  /**
   * Backed by the attribute for the same reason `hidden` and `disabled` are:
   * a script that assigns one — the nav bar builds every link by assigning
   * `href` and `title` — would otherwise set an expando, and a test reading
   * the attribute back would see nothing and report a bar with no links in it.
   *
   * A browser's `href` getter answers with an absolute URL resolved against
   * the document; there is no base URL here, so this answers with what was
   * written. Assert on `getAttribute` when the distinction matters.
   */
  get href() {
    return this.getAttribute('href') || '';
  }

  set href(value) {
    this.setAttribute('href', value);
  }

  get title() {
    return this.getAttribute('title') || '';
  }

  set title(value) {
    this.setAttribute('title', value);
  }

  /**
   * Backed by the attribute for a third reason: a script that resolves paths
   * relative to itself reads its own `src` off `document.currentScript`, and
   * writes one onto each script it goes on to load. That is how the bootstrap
   * finds `assets/` from a page in `lessons/`, so a DOM leaving `src` an
   * expando could not mount the bootstrap at all.
   */
  get src() {
    return this.getAttribute('src') || '';
  }

  set src(value) {
    this.setAttribute('src', value);
  }

  /**
   * Backed by the attribute for the reason `title` is: the drawer labels its
   * composer by assigning one, and that label is Learner-facing text. A DOM
   * leaving it an expando would report an unlabelled composer to a check
   * reading the attribute — and the check that reads it is the one asserting
   * no Component hardcoded a word.
   */
  get placeholder() {
    return this.getAttribute('placeholder') || '';
  }

  set placeholder(value) {
    this.setAttribute('placeholder', value);
  }

  /** Form-ish value: an authored `value=` until something assigns one. */
  get value() {
    if (this._value !== null) return this._value;
    if (this.localName === 'textarea') return this.textContent;
    return this.getAttribute('value') || '';
  }

  set value(next) {
    this._value = String(next);
  }

  get innerHTML() {
    throw new Error('innerHTML is not available here — build nodes and set textContent');
  }

  set innerHTML(_) {
    throw new Error(
      'innerHTML is not available here — a shipped Component must build nodes, ' +
        'so that learner-visible text can never be parsed as markup',
    );
  }

  matches(selector) {
    return parseSelector(selector).some((seq) => matchSequence(this, seq));
  }

  closest(selector) {
    for (let node = this; node instanceof Element; node = node.parentNode) {
      if (node.matches(selector)) return node;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const sequences = parseSelector(selector);
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (sequences.some((seq) => matchSequence(child, seq) && isWithin(child, this))) {
          found.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return found;
  }

  /* Present so a Component can call them; a text-only DOM has nothing to do. */
  focus() {}
  scrollIntoView() {}
}

function isWithin(node, ancestor) {
  for (let p = node.parentNode; p; p = p.parentNode) if (p === ancestor) return true;
  return false;
}

/* ---------------------------------------------------------------- selectors */

/**
 * `.a .b, #c[data-x]` → [[compound, compound], [compound]]. Descendant
 * combinators only: anything else throws rather than quietly matching wrong.
 */
function parseSelector(selector) {
  return selector.split(',').map((group) => {
    const trimmed = group.trim();
    if (/[>~+]/.test(trimmed)) {
      throw new Error(`selector "${trimmed}" uses a combinator this DOM does not implement`);
    }
    return trimmed.split(/\s+/).filter(Boolean).map(parseCompound);
  });
}

const COMPOUND = /^(\*|[a-zA-Z][\w-]*)?((?:[#.][\w-]+|\[[^\]]+\])*)$/;
const SIMPLE = /[#.][\w-]+|\[[^\]]+\]/g;

function parseCompound(text) {
  const m = COMPOUND.exec(text);
  if (!m) throw new Error(`selector "${text}" is beyond what this DOM implements`);

  const test = { tag: m[1] && m[1] !== '*' ? m[1].toUpperCase() : null, classes: [], id: null, attrs: [] };

  for (const [piece] of (m[2] || '').matchAll(SIMPLE)) {
    if (piece[0] === '.') test.classes.push(piece.slice(1));
    else if (piece[0] === '#') test.id = piece.slice(1);
    else {
      const body = piece.slice(1, -1);
      const eq = body.indexOf('=');
      if (eq < 0) test.attrs.push({ name: body.trim(), value: null });
      else {
        test.attrs.push({
          name: body.slice(0, eq).trim(),
          value: body.slice(eq + 1).trim().replace(/^["']|["']$/g, ''),
        });
      }
    }
  }
  return test;
}

function matchCompound(el, test) {
  if (test.tag && el.tagName !== test.tag) return false;
  if (test.id && el.id !== test.id) return false;
  if (!test.classes.every((c) => el.classList.contains(c))) return false;
  return test.attrs.every(({ name, value }) =>
    value === null ? el.hasAttribute(name) : el.getAttribute(name) === value,
  );
}

/** Right-to-left, the way a browser does it: cheapest test first. */
function matchSequence(el, sequence) {
  if (!matchCompound(el, sequence[sequence.length - 1])) return false;

  let node = el.parentNode;
  for (let i = sequence.length - 2; i >= 0; i--) {
    while (node instanceof Element && !matchCompound(node, sequence[i])) node = node.parentNode;
    if (!(node instanceof Element)) return false;
    node = node.parentNode;
  }
  return true;
}

/* ----------------------------------------------------------------- document */

class Document extends Node {
  constructor() {
    super(null);
    this.ownerDocument = this;
    this.nodeType = 9;
    this.currentScript = null;
    this.title = '';
    this.readyState = 'loading';
  }

  createElement(tagName) {
    return new Element(this, tagName);
  }

  createTextNode(text) {
    return new TextNode(this, text);
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const root = this.documentElement;
    if (!root) return [];
    const found = root.matches(selector) ? [root] : [];
    return found.concat(root.querySelectorAll(selector));
  }
}

/**
 * Parse a document. Tolerant of stray close tags the way a browser is, because
 * the input here is hand-written fixture HTML, and a fixture typo should fail
 * the assertion it was written for rather than explode in the parser.
 */
function parseHTML(html) {
  const doc = new Document();
  const root = doc.createElement('html');
  root.parentNode = doc;
  doc.childNodes = [root];
  doc.documentElement = root;

  let open = [root];
  const top = () => open[open.length - 1];
  let i = 0;

  const text = (raw) => {
    if (raw) top().appendChild(doc.createTextNode(raw));
  };

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) {
      text(html.slice(i));
      break;
    }
    text(html.slice(i, lt));

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith('<!', lt)) {
      const end = html.indexOf('>', lt);
      i = end < 0 ? html.length : end + 1;
      continue;
    }

    const end = html.indexOf('>', lt);
    if (end < 0) {
      text(html.slice(lt));
      break;
    }
    const inner = html.slice(lt + 1, end);
    i = end + 1;

    if (inner.startsWith('/')) {
      const name = inner.slice(1).trim().toLowerCase();
      for (let depth = open.length - 1; depth > 0; depth--) {
        if (open[depth].localName === name) {
          open = open.slice(0, depth);
          break;
        }
      }
      continue;
    }

    const space = inner.search(/[\s/]/);
    const name = (space < 0 ? inner : inner.slice(0, space)).toLowerCase();
    if (!name) continue;

    const el = doc.createElement(name);
    for (const [key, value] of parseAttributes(space < 0 ? '' : inner.slice(space))) {
      el.setAttribute(key, value);
    }
    // `<html>` is the root we already made; whitespace after the doctype may
    // have landed in it, so absence of *elements* is what makes it still bare.
    if (name === 'html' && top() === root && root.children.length === 0) {
      for (const [key, value] of el.attributes) root.setAttribute(key, value);
      continue;
    }
    top().appendChild(el);

    if (VOID.has(name) || inner.endsWith('/')) continue;

    if (RAW_TEXT.has(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, i);
      const stop = close < 0 ? html.length : close;
      el.appendChild(doc.createTextNode(html.slice(i, stop)));
      const after = html.indexOf('>', stop);
      i = after < 0 ? html.length : after + 1;
      continue;
    }

    open.push(el);
  }

  doc.head = root.querySelector('head') || root.appendChild(doc.createElement('head'));
  doc.body = root.querySelector('body') || root.appendChild(doc.createElement('body'));
  doc.readyState = 'complete';
  const title = doc.head.querySelector('title');
  if (title) doc.title = title.textContent;
  return doc;
}

/* --------------------------------------------------------------------- page */

class DomEvent {
  constructor(type, props = {}) {
    this.type = type;
    this.bubbles = props.bubbles !== false;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    Object.assign(this, props);
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.bubbles = false;
  }
}

/**
 * A parsed page plus the sandbox its scripts run in. `assetsDir` is where
 * `script()` reads Component files from — a scaffolded Workspace's `assets/`,
 * so what runs is what a learner would actually be served.
 */
class Page {
  static load(html, assetsDir, options) {
    return new Page(html, assetsDir, options);
  }

  constructor(html, assetsDir, { globals = {} } = {}) {
    this.assetsDir = assetsDir;
    this.document = parseHTML(html);

    const doc = this.document;
    const win = {
      document: doc,
      location: { protocol: 'file:', pathname: '/lessons/fixture.html', href: 'file:///lessons/fixture.html' },
      // Deliberately bare. No shipped Component schedules work or stores
      // anything, and an absent global throws loudly the moment one starts to
      // — which is the signal to add it here on purpose, with a test.
      // Deliberately absent: getComputedStyle. Nothing here lays anything out,
      // so any answer it gave would be a lie a Component could act on.
      addEventListener: doc.addEventListener.bind(doc),
      removeEventListener: doc.removeEventListener.bind(doc),
      console,
      // `globals` is how that "on purpose" is spelled. The Tutor's in-page
      // drawer is not a Component: it stores threads, probes a service and
      // reads a stream,
      // so a test driving it has to supply those and say which ones it gave.
      // Supplying one here rather than in the bare set above keeps the default
      // honest — a Component that started reaching for storage still throws.
      ...globals,
    };
    win.window = win;
    win.globalThis = win;
    win.self = win;
    this.window = win;
    this.context = vm.createContext(win);
  }

  /**
   * Run a shipped Component the way a Lesson's own `<script src>` would.
   *
   * `attrs` are the attributes the page writes on the tag. The nav bar reads
   * `data-unit` off its own tag to find out which Unit it is rendering, so a
   * test that could not write one would be driving a bar that never mounted.
   */
  script(file, attrs = {}) {
    const source = fs.readFileSync(path.join(this.assetsDir, file), 'utf8');
    const tag = this.document.createElement('script');
    tag.setAttribute('src', `../assets/${file}`);
    for (const [name, value] of Object.entries(attrs)) tag.setAttribute(name, value);
    this.document.body.appendChild(tag);
    this.document.currentScript = tag;
    try {
      new vm.Script(source, { filename: file }).runInContext(this.context);
    } finally {
      this.document.currentScript = null;
    }
    return this;
  }

  /**
   * Run the page's own inline `<script>`, the way a browser runs one.
   *
   * `script(file)` is for the tags a page *loads*, which is every Component the
   * plugin ships. The Dossier is the one page whose script is written into it,
   * so without this the cover could only ever be read as text — and a page a
   * test only reads is not under test at all.
   *
   * A tag carrying a `type` is not one of these: an Assignment stores its
   * Rubric in `<script type="application/x-rubric">`, and a browser runs none
   * of it.
   *
   * Exactly one, or this throws. A page that grew a second would quietly change
   * what running "the page's script" means, and a fixture that ran the first of
   * two would go on passing while half the page never ran.
   */
  inline() {
    const tags = this.document
      .querySelectorAll('script')
      .filter((tag) => !tag.hasAttribute('src') && !tag.hasAttribute('type'));

    if (tags.length !== 1) {
      throw new Error(`expected the page to carry one inline script, found ${tags.length}`);
    }

    const [tag] = tags;
    this.document.currentScript = tag;
    try {
      new vm.Script(tag.textContent, { filename: 'the page\'s own script' }).runInContext(this.context);
    } finally {
      this.document.currentScript = null;
    }
    return this;
  }

  query(selector) {
    return this.document.querySelector(selector);
  }

  queryAll(selector) {
    return this.document.querySelectorAll(selector);
  }

  /** Text as a reader sees it: collapsed whitespace, no markup. */
  text(selector) {
    const node = selector ? this.query(selector) : this.document.body;
    return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  fire(el, type, props) {
    el.dispatchEvent(new DomEvent(type, props));
    return this;
  }

  click(el) {
    return this.fire(el, 'click');
  }

  press(el, key) {
    return this.fire(el, 'keydown', { key });
  }

  type(el, value) {
    el.value = value;
    return this.fire(el, 'input');
  }
}

module.exports = { Page, DomEvent, parseHTML };
