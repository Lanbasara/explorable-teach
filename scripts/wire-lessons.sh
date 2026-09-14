#!/bin/sh
# Ensure every lesson / checkpoint / assignment page loads the shared
# infrastructure and declares the learner's language, without the author ever
# wiring either by hand.
#
#   scripts/wire-lessons.sh [workspace-dir]     # default: current directory
#
# Replaces the old five-line boilerplate with a single lesson-boot.js tag, adds
# that tag to any page missing it, and fills in <html lang> on any page that did
# not declare one — reading the language from assets/units.js, where the
# workspace states it once. Idempotent: re-run it any time, and after writing a
# new lesson.
#
# It closes by printing where each lesson is served, on $PORT (default 4173),
# with the command that starts the service — the in-page tutor only connects on
# a page the service served, so that address is what a teacher hands over.

set -eu
TARGET=${1:-$(pwd)}
cd "$TARGET"

python3 - <<'PY'
import glob, os, re

PAGES = sorted(glob.glob('lessons/*.html') + glob.glob('assignments/*.html'))
PORT = os.environ.get('PORT', '4173')          # what tutorctl.sh reads too
OLD = [
    re.compile(r'^[ \t]*<link[^>]*assets/(?:nav|tutor)\.css[^>]*>[ \t]*\n?', re.M),
    re.compile(r'^[ \t]*<script[^>]*assets/(?:units|nav|tutor)\.js[^>]*>\s*</script>[ \t]*\n?', re.M),
]

OPEN_HTML = re.compile(r'<html\b([^>]*)>', re.I)
HAS_LANG = re.compile(r'(?:^|\s)lang\s*=', re.I)   # not data-lang, not xml:lang


def unit_of(path, body):
    m = re.search(r'assets/nav\.js"[^>]*data-unit="([^"]*)"', body)          # keep what's there
    if m: return m.group(1)
    m = re.search(r'data-unit="([^"]*)"', body)
    if m: return m.group(1)
    m = re.match(r'(\d+)', os.path.basename(path))                           # 0000b-x.html -> 0000
    return m.group(1) if m else ''


COURSE = re.compile(r'window\.TEACH_COURSE\s*=\s*\{([^{}]*)\}')
COURSE_LANG = re.compile(r'(?:^|[{,\s])lang\s*:\s*[\'"]([A-Za-z][\w-]*)[\'"]')


def workspace_lang():
    """The learner's language, as the course manifest states it.

    One place, so a page never carries an opinion of its own about which
    language the workspace is in. Absent — an older workspace, or one not
    scaffolded from here — nothing is filled in, and the pages keep whatever
    they already declare.

    Read out of the course block rather than out of the whole file, because the
    rest of it is hand-edited: a unit that grows a `lang:` of its own, or a
    comment that mentions one, must not become the thing every page is given.
    """
    try:
        with open('assets/units.js', encoding='utf-8') as f:
            manifest = f.read()
    except OSError:
        return ''
    course = COURSE.search(manifest)
    if not course:
        return ''
    found = COURSE_LANG.search(course.group(1))
    return found.group(1) if found else ''


def with_boot(path, body):
    """The page, carrying exactly one bootstrap tag."""
    if 'lesson-boot.js' in body:
        return body

    unit = unit_of(path, body)
    for rx in OLD:
        body = rx.sub('', body)

    tag = '<script src="../assets/lesson-boot.js"%s></script>\n' % (
        ' data-unit="%s"' % unit if unit else '')

    if '</body>' in body:
        body = body.replace('</body>', tag + '</body>', 1)
    else:
        body = body.rstrip() + '\n' + tag
    return re.sub(r'\n{3,}', '\n\n', body)


def with_lang(body, lang):
    """The page, declaring the workspace's language if it declared none.

    A page that states its own is left alone: <html lang> is the authority, and
    the tooling filling a gap must never overrule an author who wrote one. A
    fragment with no <html> element at all gets nothing — lesson-boot.js sets
    the attribute at run time on whatever document it lands in.
    """
    if not lang:
        return body
    m = OPEN_HTML.search(body)
    if not m or HAS_LANG.search(m.group(1)):
        return body
    return body[:m.start()] + '<html lang="%s"%s>' % (lang, m.group(1).rstrip()) + body[m.end():]


def hand_over(pages):
    """Where each lesson is served, for the teacher to hand one of them over.

    The in-page tutor connects only on a page the service served, so what the
    teacher owes the learner is an address rather than a file. It is printed
    rather than described, because an address that is copied carries the port
    and one assembled by hand is where the port gets lost.

    Printed without asking whether the service is up, and so printed whether it
    is or not: the moment this is most needed is the moment before it is
    started, and a block that fell silent then would withhold the address
    exactly there. The port is $PORT for the same reason it is in tutorctl.sh —
    one env var decides it — and this is the port the service would be started
    on rather than a claim about one already running elsewhere.

    Lessons only, as in tutorctl.sh's own status output: an assignment page is
    reached from a lesson, and where the course as a whole opens is the
    documents' business rather than this script's.
    """
    lessons = [p for p in pages if p.startswith('lessons/')]
    if not lessons:
        return
    print('\nThe in-page tutor connects only on a page the service served, so hand the')
    print('learner one of these rather than the file — and start the service first:')
    print('\n    ./tutor/tutorctl.sh start\n')
    for p in lessons:
        print('    http://127.0.0.1:%s/%s' % (PORT, p))


LANG = workspace_lang()
wired = langed = skipped = 0

for p in PAGES:
    original = open(p, encoding='utf-8').read()

    body = with_boot(p, original)
    gained_boot = body != original

    after = with_lang(body, LANG)
    gained_lang = after != body

    if not gained_boot and not gained_lang:
        print('  ok      %s' % p); skipped += 1; continue

    open(p, 'w', encoding='utf-8').write(after)
    if gained_boot:
        print('  wired   %s  (unit %s)' % (p, unit_of(p, original) or '-')); wired += 1
    if gained_lang:
        print('  lang    %s  (%s)' % (p, LANG)); langed += 1

print('\n%d wired, %d given a language, %d already fine.' % (wired, langed, skipped))
hand_over(PAGES)
PY
