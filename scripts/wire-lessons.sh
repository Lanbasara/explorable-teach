#!/bin/sh
# Ensure every lesson / checkpoint / assignment page loads the shared
# infrastructure, without the author ever wiring it by hand.
#
#   scripts/wire-lessons.sh [workspace-dir]     # default: current directory
#
# Replaces the old five-line boilerplate with a single lesson-boot.js tag, and
# adds that tag to any page missing it. Idempotent: re-run it any time, and
# after writing a new lesson.

set -eu
TARGET=${1:-$(pwd)}
cd "$TARGET"

python3 - <<'PY'
import glob, os, re

PAGES = sorted(glob.glob('lessons/*.html') + glob.glob('assignments/*.html'))
OLD = [
    re.compile(r'^[ \t]*<link[^>]*assets/(?:nav|tutor)\.css[^>]*>[ \t]*\n?', re.M),
    re.compile(r'^[ \t]*<script[^>]*assets/(?:units|nav|tutor)\.js[^>]*>\s*</script>[ \t]*\n?', re.M),
]

def unit_of(path, body):
    m = re.search(r'assets/nav\.js"[^>]*data-unit="([^"]*)"', body)          # keep what's there
    if m: return m.group(1)
    m = re.search(r'data-unit="([^"]*)"', body)
    if m: return m.group(1)
    m = re.match(r'(\d+)', os.path.basename(path))                           # 0000b-x.html -> 0000
    return m.group(1) if m else ''

changed = skipped = 0
for p in PAGES:
    body = open(p, encoding='utf-8').read()
    if 'lesson-boot.js' in body:
        print('  ok      %s' % p); skipped += 1; continue

    unit = unit_of(p, body)
    for rx in OLD:
        body = rx.sub('', body)

    tag = '<script src="../assets/lesson-boot.js"%s></script>\n' % (
        ' data-unit="%s"' % unit if unit else '')

    if '</body>' in body:
        body = body.replace('</body>', tag + '</body>', 1)
    else:
        body = body.rstrip() + '\n' + tag
    body = re.sub(r'\n{3,}', '\n\n', body)

    open(p, 'w', encoding='utf-8').write(body)
    print('  wired   %s  (unit %s)' % (p, unit or '-')); changed += 1

print('\n%d wired, %d already fine.' % (changed, skipped))
PY
