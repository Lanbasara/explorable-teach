'use strict';

/**
 * The Tutor's in-page drawer, mounted the way a Lesson mounts it.
 *
 *   const page = mount(ws.path('assets'), { html: lessonHtml('zh-CN') });
 *   await settle();                       // the health probe
 *   page.click(page.query('.tutor-fab'));
 *   page.type(page.query('.tutor-input'), 'why');
 *   page.click(page.query('.tutor-send'));
 *
 * The drawer is not a Component: it stores threads, probes a service and reads
 * a stream, so driving it needs a window wider than the bare one the fixture
 * DOM gives a Component — plus a clock and an interval the test advances by
 * hand, so an elapsed indication can be read off one and "nothing is left
 * ticking" is a claim rather than a hope.
 *
 * That is what this file is: the seams, named at the call site the way
 * `globals` is. `chunks`/`ends` replay a fixed transcript; `feed` hands the
 * test the stream itself, one event at a time, so a stage of the wait can be
 * observed while it is still that stage; `reply` takes over the response
 * entirely, for a request that has to fail or to differ from the one before
 * it; `health` is asked per probe, so the service can be started or stopped
 * while the page is already open; and `strings` is the Workspace's own table of
 * Learner-facing text, which is how a page is mounted in a language the plugin
 * does not ship.
 *
 * It lives here rather than in one suite because two ask different things of
 * it: `tutor-drawer.test.js` asks what the drawer does around an answer, and
 * `language.test.js` asks what language it does it in.
 */

const { Workspace } = require('./workspace.js');
const { Page } = require('./dom.js');

/** An answer with every piece of Markdown a Tutor actually writes. */
const ANSWER = [
  '## fork 与 exec',
  '',
  '`fork()` 返回**两次**:',
  '',
  '- 在父进程里返回子进程的 pid',
  '- 在子进程里返回 0',
  '',
  '```c',
  'pid_t pid = fork();',
  'if (pid == 0) exec("/bin/ls");',
  '```',
  '',
  '细节见 [Unit 2](../lessons/0002.html)。',
].join('\n');

/** One server-sent event, spelled the way `server.js` spells it. */
function event(name, data) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * The answer as the service delivers it: a few deltas, then `done`, cut into
 * three chunks that fall mid-event. The drawer reassembles across chunk
 * boundaries, and a stub that wrote one tidy chunk would leave that untested
 * while every assertion below went on passing — the same reason the service
 * fixture cuts its transcript awkwardly.
 */
function chunksFor(answer) {
  const half = Math.floor(answer.length / 2);
  const stream =
    event('tool', { name: 'Read', target: 'lessons/0003.html' }) +
    event('delta', { text: answer.slice(0, half) }) +
    event('delta', { text: answer.slice(half) }) +
    event('done', { answer, durationMs: 12 });

  const cut = Math.floor(stream.length / 3);
  return [stream.slice(0, cut), stream.slice(cut, cut * 2), stream.slice(cut * 2)];
}

/** A reader over a fixed transcript. `ends: false` leaves the answer in flight. */
function readerFor(chunks, ends = true) {
  let next = 0;
  return {
    read: () => {
      if (next < chunks.length) {
        return Promise.resolve({ done: false, value: Buffer.from(chunks[next++], 'utf8') });
      }
      // A stream that never ends is where a streamed answer spends most of its life.
      return ends ? Promise.resolve({ done: true, value: undefined }) : new Promise(() => {});
    },
    cancel: () => Promise.resolve(),
  };
}

/**
 * A stream the test feeds one event at a time, which is the only way to see a
 * stage of the wait while it is still that stage. `cancelled` is what the
 * drawer letting go of the stream looks like from the service's end.
 */
function fedStream() {
  const queued = [];
  let waiting = null;
  const deliver = (result) => {
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(result);
    } else {
      queued.push(result);
    }
  };

  const self = {
    cancelled: false,
    push: (text) => deliver({ done: false, value: Buffer.from(text, 'utf8') }),
    end: () => deliver({ done: true, value: undefined }),
    reader: () => ({
      read: () => (queued.length ? Promise.resolve(queued.shift()) : new Promise((r) => { waiting = r; })),
      cancel: () => {
        self.cancelled = true;
        deliver({ done: true, value: undefined });
        return Promise.resolve();
      },
    }),
  };
  return self;
}

/** Storage the drawer can keep its threads and pinned answers in. */
function storage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

/**
 * Repeating work the test drives by hand. The drawer sets two things going —
 * the clock beside an in-flight answer, and the health poll it runs while
 * offline — and both have to stop on their own, so `live` is asserted on as
 * much as `tick` is called.
 */
function timers() {
  const live = new Map();
  let next = 0;
  return {
    live,
    setInterval(fn) {
      live.set((next += 1), fn);
      return next;
    },
    clearInterval(id) {
      live.delete(id);
    },
    tick(times = 1) {
      for (let i = 0; i < times; i++) for (const fn of [...live.values()]) fn();
    },
  };
}

/** A clock the test advances, so an elapsed indication can be read off it. */
function clock() {
  let at = Date.now();
  class Advanced extends Date {
    constructor(...args) {
      super(...(args.length ? args : [at]));
    }
    static now() {
      return at;
    }
  }
  return { Date: Advanced, advance: (ms) => { at += ms; } };
}

/** Somewhere for a copied answer or a copied prompt to land. */
function clipboard() {
  const pad = { text: null };
  pad.navigator = { clipboard: { writeText: (text) => { pad.text = text; return Promise.resolve(); } } };
  return pad;
}

/**
 * The page the drawer would mount into, with nothing run in it yet.
 *
 * Split out from `mount` for the tests that load the page the way a browser
 * does — through `assets/lesson-boot.js` — because those have to be the only
 * thing that runs the drawer. A page carrying two drawers answers every
 * assertion from whichever one the selector reached first, which is a test
 * passing for a reason nobody chose.
 *
 * `withRenderer: false` stages the one failure lesson-boot.js tolerates by
 * design — a component script that did not load — because a learner must still
 * be able to read the answer when that happens. `store` is passed in rather
 * than made here so that a second mount can be given the first one's storage,
 * which is what a reload is. `health` is asked per probe rather than fixed, so
 * a test can start the service after the page is already open, and `reply`
 * takes over `/api/ask` entirely when a test needs a second request to differ
 * from the first. `strings` is put on the window under the name a Workspace's
 * own `assets/strings.js` puts it under, so the lookup reaches it exactly as it
 * would on a real page.
 */
function pageFor(assetsDir, options = {}) {
  const {
    html,
    at = '/lessons/0003-fork-exec.html',
    chunks = chunksFor(ANSWER),
    ends = true,
    store = storage(),
    feed = null,
    health = () => true,
    reply = null,
    strings = null,
  } = options;

  const asked = [];
  const time = clock();
  const clocks = timers();
  const pad = clipboard();

  const page = Page.load(html, assetsDir, {
    globals: {
      location: { protocol: 'http:', pathname: at },
      localStorage: store,
      ...(strings ? { TEACH_STRINGS: strings } : {}),
      setTimeout,
      setInterval: clocks.setInterval,
      clearInterval: clocks.clearInterval,
      Date: time.Date,
      navigator: pad.navigator,
      TextDecoder,
      fetch(url, init) {
        if (url === '/api/health') {
          return health()
            ? Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
            : Promise.reject(new Error('service is not running'));
        }
        asked.push(JSON.parse(init.body));
        if (reply) return reply(asked.length);
        return Promise.resolve({
          ok: true,
          body: { getReader: () => (feed ? feed.reader() : readerFor(chunks, ends)) },
        });
      },
    },
  });

  page.asked = asked;
  page.store = store;
  page.clock = time;
  page.timers = clocks;
  page.tick = clocks.tick;
  page.clipboard = pad;
  return page;
}

/**
 * That page with the drawer running in it, in the order lesson-boot.js loads
 * them: the string table first, because everything after it renders a word out
 * of it, then the renderer, then the drawer.
 *
 * `withRenderer: false` stages the one failure lesson-boot.js tolerates by
 * design — a component script that did not load — because a learner must still
 * be able to read the answer when that happens. `before` names the Components
 * that load *after* the drawer, which is where a real page loads them: one
 * looking for `window.Tutor` at mount would find nothing there either.
 */
function mount(assetsDir, options = {}) {
  const { withRenderer = true, before = [] } = options;
  const page = pageFor(assetsDir, options);

  page.script('learner-text.js');
  if (withRenderer) page.script('rich-text.js');
  page.script('tutor.js');
  for (const file of before) page.script(file);

  return page;
}

/** Let the drawer's promise chain run to the end of the stream. */
async function settle(rounds = 12) {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setImmediate(resolve));
}

/** The drawer mounted in a Workspace scaffolded the way a learner's is. */
function drawerIn(t, html, options) {
  const ws = Workspace.create(t);
  ws.scaffold();
  return mount(ws.path('assets'), { html, ...options });
}

module.exports = {
  ANSWER,
  drawerIn,
  pageFor,
  event,
  chunksFor,
  readerFor,
  fedStream,
  storage,
  timers,
  clock,
  clipboard,
  mount,
  settle,
};
