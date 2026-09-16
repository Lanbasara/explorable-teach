#!/bin/sh
# Scaffold the infrastructure of a teaching workspace.
#
# This half is deliberately dumb: it decides nothing about the subject. Split
# by one question — does this file vary by subject?
#
#   link    it does not. The file lives in the plugin and the workspace points
#           at it, so fixing it once fixes it for every workspace rather than
#           only the ones scaffolded afterwards. Re-pointed on every run, which
#           is how a workspace follows the plugin across an upgrade.
#   place   it does. Copied once and never touched again, because after the
#           first run it is the Teacher's file, not ours.
#
# Everything else subject-specific (MISSION, CURRICULUM, RESOURCES, TECH-STACK)
# is authored by the Teacher on its first run, because that part needs to
# understand the learner.
#
# The boot sequence of the explorable-teach skill runs this as its first step,
# so this script — not any document — is the source of truth for what a
# workspace contains.
#
#   scripts/init-workspace.sh [target-dir]     # default: current directory
#
# Idempotent, and it never destroys work: a placed file is never overwritten,
# re-pointing a link it already owns changes nothing, and a real file sitting
# where a link belongs is left alone as a deliberate override. Safe to re-run to
# repair a workspace that lost a file.

set -eu

TARGET=${1:-$(pwd)}
ROOT=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
SKILL="$ROOT/skills/explorable-teach"
TPL="$SKILL/templates"
RUNTIME="$SKILL/runtime"

[ -d "$TPL" ] || { echo "error: templates not found at $TPL" >&2; exit 1; }
[ -d "$RUNTIME" ] || { echo "error: runtime not found at $RUNTIME" >&2; exit 1; }
mkdir -p "$TARGET"
TARGET=$(cd "$TARGET" && pwd)

copied=0; skipped=0; linked=0; kept=0
place() { # place <src> <dest-relative>   — the workspace's own, copied once
  dest="$TARGET/$2"
  if [ -e "$dest" ]; then
    echo "  skip    $2  (already exists)"
    skipped=$((skipped+1))
  else
    mkdir -p "$(dirname "$dest")"
    cp "$1" "$dest"
    echo "  create  $2"
    copied=$((copied+1))
  fi
}

link() { # link <src> <dest-relative>   — the plugin's own, pointed at
  dest="$TARGET/$2"
  mkdir -p "$(dirname "$dest")"
  # A real file where a link belongs is somebody's deliberate override. The
  # plugin owns the link, not the path, so leave it alone and say so — this
  # script must never be the thing that deletes work.
  if [ -e "$dest" ] && [ ! -L "$dest" ]; then
    echo "  keep    $2  (a real file, not the plugin's link)"
    kept=$((kept+1))
    return 0
  fi
  # -n so that re-pointing an existing link replaces it instead of dropping a
  # link inside the directory it currently points at.
  ln -sfn "$1" "$dest"
  echo "  link    $2"
  linked=$((linked+1))
}

echo "Scaffolding teaching workspace at $TARGET"
echo

for d in lessons assignments submissions learning-records reference images assets tutor; do
  [ -d "$TARGET/$d" ] || { mkdir -p "$TARGET/$d"; echo "  mkdir   $d/"; }
done

# The tutor service. Everything here is the plugin's except the subject tuning.
link  "$RUNTIME/tutor/server.js"    "tutor/server.js"
link  "$RUNTIME/tutor/tutorctl.sh"  "tutor/tutorctl.sh"
link  "$RUNTIME/tutor/README.md"    "tutor/README.md"
link  "$RUNTIME/tutor/ROLE.md"      "tutor/ROLE.md"
link  "$RUNTIME/tutor/GRADER.md"    "tutor/GRADER.md"
place "$TPL/tutor/TUNING.md"        "tutor/TUNING.md"
place "$TPL/tutor/GRADER-TUNING.md" "tutor/GRADER-TUNING.md"
place "$TPL/agents/tutor.md"    ".claude/agents/tutor.md"
place "$TPL/agents/themer.md"   ".claude/agents/themer.md"
place "$TPL/agents/grader.md"   ".claude/agents/grader.md"

# Page infrastructure: the widget, the nav bar, the bootstrap. The manifest is
# the one file here that describes this course rather than any course — and it
# is where the workspace states the learner's language, once, for every page.
#
# Learner-facing text splits the same way everything else here does. What a
# button is called varies by language and by nothing else, so the tables live in
# the plugin — inside lesson-boot.js, which every workspace already links, so an
# upgrade reaches an existing one with nothing to run. strings.js is this
# workspace's own table, for a language the plugin does not ship or an entry it
# disagrees with.
link  "$RUNTIME/assets/rich-text.js"    "assets/rich-text.js"
link  "$RUNTIME/assets/tutor.js"        "assets/tutor.js"
link  "$RUNTIME/assets/tutor.css"       "assets/tutor.css"
link  "$RUNTIME/assets/nav.js"          "assets/nav.js"
link  "$RUNTIME/assets/nav.css"         "assets/nav.css"
link  "$RUNTIME/assets/lesson-boot.js"  "assets/lesson-boot.js"
place "$TPL/assets/units.js"       "assets/units.js"
place "$TPL/assets/strings.js"     "assets/strings.js"
place "$TPL/assets/theme.css"      "assets/theme.css"
place "$TPL/index.html"            "index.html"

# Where a submission too large for the assignment page is put. Placed rather
# than merely mkdir'd so the directory is a real thing in the learner's version
# control from day one: a submission is the evidence a verdict was reached on,
# and an empty directory git never records is one nobody can look back at.
place "$TPL/submissions/README.md" "submissions/README.md"

# Shared styles, then the Components that do not vary by subject. Every page
# in the workspace links style.css; a lesson links only the Components it uses.
link "$RUNTIME/assets/style.css"           "assets/style.css"
link "$RUNTIME/assets/exercise.js"         "assets/exercise.js"
link "$RUNTIME/assets/exercise.css"        "assets/exercise.css"
link "$RUNTIME/assets/predict-reveal.js"   "assets/predict-reveal.js"
link "$RUNTIME/assets/predict-reveal.css"  "assets/predict-reveal.css"
link "$RUNTIME/assets/step-animation.js"   "assets/step-animation.js"
link "$RUNTIME/assets/step-animation.css"  "assets/step-animation.css"
link "$RUNTIME/assets/drag-order.js"       "assets/drag-order.js"
link "$RUNTIME/assets/drag-order.css"      "assets/drag-order.css"
link "$RUNTIME/assets/checkpoint.js"       "assets/checkpoint.js"
link "$RUNTIME/assets/checkpoint.css"      "assets/checkpoint.css"
link "$RUNTIME/assets/assignment.js"       "assets/assignment.js"
link "$RUNTIME/assets/assignment.css"      "assets/assignment.css"

echo
summary="$copied created, $skipped left alone, $linked pointed at the plugin"
if [ "$kept" -gt 0 ]; then summary="$summary, $kept overridden here"; fi
echo "$summary."
echo
echo "Still to author (these depend on the subject and the learner):"
echo "  (assets/units.js was installed empty — fill it in so index.html has content,"
echo "   and set its lang to the learner's language; every page takes it from there)"
echo "  (assets/strings.js is this workspace's own table of learner-facing text — leave it"
echo "   empty unless the plugin ships no table for that language, or one needs overriding)"
echo "  (tutor/TUNING.md and tutor/GRADER-TUNING.md are placeholders — tune them for this subject;"
echo "   tutor/ROLE.md and tutor/GRADER.md are the plugin's)"
echo
for f in MISSION.md CURRICULUM.md RESOURCES.md TECH-STACK.md NOTES.md; do
  [ -e "$TARGET/$f" ] && echo "  have    $f" || echo "  MISSING $f"
done
