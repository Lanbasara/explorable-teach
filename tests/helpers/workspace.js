'use strict';

/**
 * A fixture Workspace: a throwaway directory standing in for a learner's
 * Workspace, so the repo's scripts can be run against something real.
 *
 *   const ws = Workspace.create(t);          // removed when the test ends
 *   ws.write('lessons/0001-intro.html', html);
 *   const before = ws.snapshot();
 *   ws.wire();
 *   assert.deepEqual(ws.snapshot(), before); // nothing changed
 *
 * snapshot() is the load-bearing part: it hashes content and records modes, so
 * "running this twice changed nothing" is a real claim rather than a timestamp
 * comparison.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

class Workspace {
  /**
   * Bind a fresh Workspace to a test's lifetime. `t` is a node:test
   * TestContext; the directory is removed when that test finishes, pass or fail.
   */
  static create(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explorable-teach-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    // macOS hands out /var/folders paths that are symlinks into /private; the
    // scripts resolve them, so resolve here too or every path comparison lies.
    return new Workspace(fs.realpathSync(dir));
  }

  constructor(dir) {
    this.dir = dir;
  }

  path(rel) {
    return path.resolve(this.dir, rel);
  }

  exists(rel) {
    return fs.existsSync(this.path(rel));
  }

  read(rel) {
    return fs.readFileSync(this.path(rel), 'utf8');
  }

  write(rel, contents) {
    const dest = this.path(rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, contents, 'utf8');
    return dest;
  }

  /**
   * Every entry under the Workspace, as `relative path -> fingerprint`.
   * Directories are included so that creating an empty one counts as a change.
   * Two snapshots compare equal exactly when the tree is byte-for-byte and
   * mode-for-mode identical.
   */
  snapshot() {
    const entries = {};

    const walk = (dir) => {
      const children = fs.readdirSync(dir, { withFileTypes: true });
      children.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

      for (const child of children) {
        const abs = path.join(dir, child.name);
        const rel = path.relative(this.dir, abs);
        const mode = (fs.lstatSync(abs).mode & 0o7777).toString(8);

        if (child.isDirectory()) {
          entries[rel + '/'] = `dir ${mode}`;
          walk(abs);
        } else if (child.isSymbolicLink()) {
          entries[rel] = `link ${fs.readlinkSync(abs)}`;
        } else {
          const digest = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
          entries[rel] = `file ${mode} ${digest}`;
        }
      }
    };

    walk(this.dir);
    return entries;
  }

  /**
   * Run a script to completion with the Workspace as its working directory.
   * `script` is either a path relative to the repo root or an absolute path.
   * The script is executed directly, so its shebang and executable bit are
   * under test too.
   *
   * The timeout is a backstop, not a tuning knob: a script that hangs should
   * fail one test rather than wedge the whole suite. This runs a command that
   * exits — starting the tutor server, which does not, needs a different
   * method than this one.
   */
  run(script, args = [], { timeout = 30_000 } = {}) {
    const bin = path.isAbsolute(script) ? script : path.join(REPO_ROOT, script);
    const result = spawnSync(bin, args, {
      cwd: this.dir,
      encoding: 'utf8',
      timeout,
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: REPO_ROOT },
    });

    if (result.error) throw result.error;

    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  /** Scaffold this Workspace, the way the Boot sequence's first step does. */
  scaffold() {
    return this.run('scripts/init-workspace.sh', [this.dir]);
  }

  /** Inject the bootstrap tag into any page missing it. */
  wire() {
    return this.run('scripts/wire-lessons.sh', [this.dir]);
  }
}

module.exports = { Workspace, REPO_ROOT };
