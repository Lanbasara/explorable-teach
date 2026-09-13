/* ============================================================
   rich-text.js — a Tutor answer, rendered as the rich text it was written as
   Deps: none. Nodes come from a factory the caller passes in.
   Used by: assets/tutor.js, for streamed answers and for pinned ones
   ============================================================ */

/**
 * A Tutor answers in Markdown: fenced code, bullets, inline code, the
 * occasional link. Inserted as plain text, all of that collapses into one run
 * of characters, which is most of a Tutor's usefulness gone on any subject
 * involving code.
 *
 *   RichText.render(answer, {
 *     element: function (tag) { return document.createElement(tag); },
 *     text:    function (s)   { return document.createTextNode(s); }
 *   });                                  // -> an array of block nodes
 *
 * **Why a factory rather than `document`.** An answer is generated text. The
 * model that writes it has read the Lesson, the learner's notes and whatever
 * passage they selected, so "the source is trusted" is not a position this file
 * gets to take — and a renderer that cannot be run without a browser is a
 * renderer whose inertness nobody checks. Taking the factory as an argument
 * makes the whole of it testable in a bare context, which is where
 * `tests/rich-text.test.js` runs it.
 *
 * **Nothing here parses markup.** Every node is built from a fixed tag, and
 * every piece of the source reaches the page as text. `<script>` in an answer
 * is four-and-a-bit words a learner reads; it is never a node. The only
 * attributes written are `class` on a fenced block, and `href`/`rel`/`target`
 * on a link whose destination passed `safeHref` — a destination that does not
 * is left in the text exactly as written, so the learner can see what was
 * offered and nothing acts on it.
 *
 * It is a deliberate subset of Markdown: headings, paragraphs, lists, fenced
 * and inline code, emphasis, links. Anything else is text. A single newline is
 * a line break rather than a space, because a Tutor writes one point per line
 * far more often than it writes a wrapped paragraph. Two known edges of the
 * subset: a table renders as the pipes it was written with, and an image is a
 * link to the image rather than an `<img>` — deliberately, because an answer
 * must not be able to make the Lesson fetch something. Widen it when an answer
 * in a real Workspace is hurt by one, not before.
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------ block rules */

  var BLANK = /^\s*$/;
  var FENCE = /^ {0,3}(`{3,}|~{3,})\s*(.*)$/;
  var FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;
  var HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  /** A list item: what it is indented by, which marker it used, what it says. */
  var ITEM = /^(\s*)(?:([-*+])|\d{1,9}[.)])\s+(.*)$/;

  /** A fence's info string, if it is plain enough to become a class. */
  var LANGUAGE = /^[\w+#.-]{1,20}$/;

  /* ----------------------------------------------------------- inline rules */

  var PUNCT = /[\\`*_{}[\]()#+\-.!>~|]/;
  var SCHEME = /^([a-z][a-z0-9+.-]*):/i;
  var DESTINATION = /^(\S+)(?:\s+["'(][\s\S]*)?$/;

  /** The only schemes a link may carry. Everything else stays in the text. */
  var VOUCHED = ['http', 'https', 'mailto'];

  /** A destination that leaves the Workspace, and so leaves the drawer behind. */
  var EXTERNAL = /^https?:/i;

  /* ---------------------------------------------------------------- blocks */

  /** Render `source` into an array of block nodes built by `make`. */
  function render(source, make) {
    var lines = String(source == null ? '' : source).split(/\r\n|\r|\n/);
    var blocks = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (BLANK.test(line)) {
        i++;
      } else if (FENCE.test(line)) {
        i = fencedCode(lines, i, blocks, make);
      } else if (HEADING.test(line)) {
        var heading = HEADING.exec(line);
        blocks.push(inline(make.element('h' + heading[1].length), heading[2], make));
        i++;
      } else if (ITEM.test(line)) {
        i = list(lines, i, blocks, make);
      } else {
        i = paragraph(lines, i, blocks, make);
      }
    }

    return blocks;
  }

  /** Does this line end whatever block is being gathered? */
  function startsABlock(line) {
    return BLANK.test(line) || FENCE.test(line) || HEADING.test(line) || ITEM.test(line);
  }

  /**
   * A fenced block, literal all the way through. An unclosed fence still
   * renders — every streamed answer passes through that state on its way to
   * being whole, and swallowing the rest of it would make the drawer look hung.
   */
  function fencedCode(lines, start, blocks, make) {
    var fence = FENCE.exec(lines[start]);
    var marker = fence[1].charAt(0);
    var width = fence[1].length;
    var info = fence[2].trim();
    var body = [];
    var i = start + 1;

    for (; i < lines.length; i++) {
      var close = FENCE_CLOSE.exec(lines[i]);
      if (close && close[1].charAt(0) === marker && close[1].length >= width) {
        i++;
        break;
      }
      body.push(lines[i]);
    }

    var pre = make.element('pre');
    var code = make.element('code');
    // The info string is the Tutor's text, so it is checked rather than
    // trusted: anything but a plain language name simply goes unlabelled.
    if (LANGUAGE.test(info)) code.setAttribute('class', 'language-' + info);
    code.appendChild(make.text(body.join('\n') + '\n'));
    pre.appendChild(code);
    blocks.push(pre);

    return i;
  }

  /** Which list a marker belongs to. */
  function kindOf(item) {
    return item[2] ? 'ul' : 'ol';
  }

  /** The next line with something on it, or -1. */
  function nextContent(lines, from) {
    for (var i = from; i < lines.length; i++) if (!BLANK.test(lines[i])) return i;
    return -1;
  }

  function list(lines, start, blocks, make) {
    var built = buildList(lines, start, ITEM.exec(lines[start])[1].length, make);
    blocks.push(built.node);
    return built.next;
  }

  /**
   * One list, plus any list nested inside one of its items.
   *
   * Three rules, each one a shape a Tutor actually writes. Indentation nests:
   * a step with two sub-points is a list inside an item, not five items in a
   * row. A blank line between two items does not end the list. A line that
   * continues an item rather than starting one is folded into it, so a bullet
   * the Tutor wrapped stays one bullet.
   */
  function buildList(lines, start, indent, make) {
    var kind = kindOf(ITEM.exec(lines[start]));
    var listEl = make.element(kind);
    var item = null;
    var text = [];
    var i = start;

    // An item's own text goes in before any list nested under it, which is the
    // order the source put them in.
    function flush() {
      if (!item || !text.length) return;
      inline(item, text.join('\n'), make);
      text = [];
    }

    while (i < lines.length) {
      if (BLANK.test(lines[i])) {
        var resume = nextContent(lines, i);
        var after = resume === -1 ? null : ITEM.exec(lines[resume]);
        if (!after || after[1].length < indent) break;
        if (kindOf(after) !== kind && after[1].length === indent) break;
        i = resume;
        continue;
      }

      var found = ITEM.exec(lines[i]);
      if (found) {
        var at = found[1].length;
        if (at < indent) break;

        if (at >= indent + 2 && item) {
          flush();
          var nested = buildList(lines, i, at, make);
          item.appendChild(nested.node);
          i = nested.next;
          continue;
        }

        if (kindOf(found) !== kind) break;
        flush();
        item = make.element('li');
        listEl.appendChild(item);
        text = [found[3]];
        i++;
        continue;
      }

      if (startsABlock(lines[i]) || !item) break;
      text.push(lines[i].trim());
      i++;
    }

    flush();
    return { node: listEl, next: i };
  }

  function paragraph(lines, start, blocks, make) {
    var body = [];
    var i = start;

    while (i < lines.length && !startsABlock(lines[i])) {
      body.push(lines[i].trim());
      i++;
    }

    blocks.push(inline(make.element('p'), body.join('\n'), make));
    return i;
  }

  /* ---------------------------------------------------------------- inline */

  /** Fill `parent` with the inline markup in `source`, and hand it back. */
  function inline(parent, source, make) {
    var pending = '';
    var i = 0;

    function flush() {
      if (!pending) return;
      parent.appendChild(make.text(pending));
      pending = '';
    }

    while (i < source.length) {
      var ch = source.charAt(i);

      if (ch === '\\' && PUNCT.test(source.charAt(i + 1))) {
        pending += source.charAt(i + 1);
        i += 2;
        continue;
      }

      if (ch === '\n') {
        flush();
        parent.appendChild(make.element('br'));
        i++;
        continue;
      }

      if (ch === '`') {
        var span = codeSpan(source, i);
        if (span) {
          flush();
          var code = make.element('code');
          code.appendChild(make.text(span.text));
          parent.appendChild(code);
          i = span.end;
          continue;
        }
      }

      if (ch === '[') {
        var link = linkAt(source, i);
        if (link) {
          var href = safeHref(link.href);
          if (href) {
            flush();
            parent.appendChild(anchor(href, link.label, make));
          } else {
            // Dropping it would leave a label with no destination and no sign
            // that anything was removed. Written out, it is inert and honest.
            pending += source.slice(i, link.end);
          }
          i = link.end;
          continue;
        }
      }

      if (ch === '*' || ch === '_') {
        var run = emphasisAt(source, i);
        if (run) {
          flush();
          var marked = inline(make.element(run.width === 1 ? 'em' : 'strong'), run.text, make);
          if (run.width === 3) {
            // ***both***: strong inside em, so neither marker is left as text.
            var outer = make.element('em');
            outer.appendChild(marked);
            marked = outer;
          }
          parent.appendChild(marked);
          i = run.end;
          continue;
        }
      }

      pending += ch;
      i++;
    }

    flush();
    return parent;
  }

  function anchor(href, label, make) {
    var a = make.element('a');
    a.setAttribute('href', href);
    if (EXTERNAL.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
    return inline(a, label, make);
  }

  /** A run of backticks, closed by a run of exactly the same length. */
  function codeSpan(source, at) {
    var open = 0;
    while (source.charAt(at + open) === '`') open++;

    var i = at + open;
    while (i < source.length) {
      if (source.charAt(i) !== '`') {
        i++;
        continue;
      }
      var run = 0;
      while (source.charAt(i + run) === '`') run++;
      if (run === open) {
        var text = source.slice(at + open, i).replace(/\n/g, ' ');
        // ``` `code` ``` — one space either side is the fence, not the content.
        if (/^ .* $/.test(text)) text = text.slice(1, -1);
        return { text: text, end: i + run };
      }
      i += run;
    }

    return null;
  }

  /**
   * The destination half of a link: `(dest)`, `(dest "title")` or `(<dest>)`.
   * A destination with whitespace in it and no title behind it is not one this
   * renderer will guess at — `java\tscript:` is the reason, and a link left as
   * text costs a learner nothing they can see.
   */
  function destination(raw) {
    var text = String(raw).trim();

    if (text.charAt(0) === '<') {
      var close = text.indexOf('>');
      return close < 0 ? null : text.slice(1, close);
    }

    var m = DESTINATION.exec(text);
    return m ? m[1] : null;
  }

  /** `[label](destination)`, with both halves balanced and neither wrapped. */
  function linkAt(source, at) {
    var depth = 0;
    var i = at;

    for (; i < source.length; i++) {
      var c = source.charAt(i);
      if (c === '\\') i++;
      else if (c === '\n') return null;
      else if (c === '[') depth++;
      else if (c === ']' && --depth === 0) break;
    }
    if (depth !== 0 || source.charAt(i + 1) !== '(') return null;

    var label = source.slice(at + 1, i);
    var open = 1;
    var href = '';

    for (var j = i + 2; j < source.length; j++) {
      var d = source.charAt(j);
      if (d === '\n') return null;
      if (d === '(') open++;
      if (d === ')' && --open === 0) return { label: label, href: destination(href), end: j + 1 };
      href += d;
    }

    return null;
  }

  /**
   * `**strong**`, `*slanted*`, `_slanted_`, `***both***`. A marker only opens a
   * run when something other than a space follows it and only closes one when
   * something other than a space precedes it, so `2 * 3 * 4` stays arithmetic.
   * `_` is ignored inside a word, so `snake_case_name` survives.
   */
  function emphasisAt(source, at) {
    var ch = source.charAt(at);
    if (ch === '_' && /\w/.test(source.charAt(at - 1))) return null;

    var run = 0;
    while (source.charAt(at + run) === ch) run++;
    var width = run >= 3 ? 3 : run >= 2 ? 2 : 1;

    var open = at + width;
    if (open >= source.length || /\s/.test(source.charAt(open))) return null;

    var i = open;
    while (i < source.length) {
      if (source.charAt(i) === '\\') {
        i += 2;
        continue;
      }
      if (source.charAt(i) !== ch) {
        i++;
        continue;
      }

      var close = 0;
      while (source.charAt(i + close) === ch) close++;

      var closes = close >= width && !/\s/.test(source.charAt(i - 1));
      if (closes && ch === '_' && /\w/.test(source.charAt(i + close))) closes = false;
      if (closes) return { width: width, text: source.slice(open, i), end: i + width };

      i += close;
    }

    return null;
  }

  /**
   * The destination of a link, or null if this renderer will not vouch for it.
   *
   * A browser ignores control characters and whitespace when it works out what
   * scheme a URL carries, so `java\tscript:` is `javascript:` to the only
   * reader that matters. The check looks at it the same way, then allows a
   * short list rather than denying a long one, and hands back the string the
   * browser would see rather than the one the Tutor typed.
   */
  function safeHref(raw) {
    if (raw == null) return null;
    var href = String(raw).trim();
    if (!href) return null;

    // What the browser will resolve, which is the only reading that matters:
    // returned rather than the raw text, so that every later decision — the
    // `target` on an external link included — is made on the same string.
    var probe = href.replace(/[\x00-\x20\x7f]/g, '');
    var scheme = SCHEME.exec(probe);
    if (scheme) return VOUCHED.indexOf(scheme[1].toLowerCase()) === -1 ? null : probe;

    // Protocol-relative: whatever the page was served as, which for a Lesson
    // opened from disk is nothing useful. Not worth vouching for.
    if (probe.indexOf('//') === 0) return null;

    return href;
  }

  root.RichText = { render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
