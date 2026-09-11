#!/bin/sh
# Scaffold the invariant infrastructure of a teaching workspace.
#
# This half is deliberately dumb: it only copies files that are the same for
# every subject. Everything subject-specific (MISSION, CURRICULUM, RESOURCES,
# TECH-STACK, the tutor's ROLE) is authored by the AI in /explorable-teach:init,
# because that part needs to understand the learner.
#
#   scripts/init-workspace.sh [target-dir]     # default: current directory
#
# Idempotent: never overwrites an existing file. Safe to re-run to repair a
# workspace that lost a file.

set -eu

TARGET=${1:-$(pwd)}
ROOT=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
TPL="$ROOT/skills/explorable-teach/templates"

[ -d "$TPL" ] || { echo "error: templates not found at $TPL" >&2; exit 1; }
mkdir -p "$TARGET"
TARGET=$(cd "$TARGET" && pwd)

copied=0; skipped=0
place() { # place <src> <dest-relative>
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

echo "Scaffolding teaching workspace at $TARGET"
echo

for d in lessons learning-records reference assets tutor; do
  [ -d "$TARGET/$d" ] || { mkdir -p "$TARGET/$d"; echo "  mkdir   $d/"; }
done

place "$TPL/tutor/server.js"    "tutor/server.js"
place "$TPL/tutor/tutorctl.sh"  "tutor/tutorctl.sh"
place "$TPL/tutor/ROLE.md"      "tutor/ROLE.md"
place "$TPL/tutor/README.md"    "tutor/README.md"
place "$TPL/assets/tutor.js"    "assets/tutor.js"
place "$TPL/assets/tutor.css"   "assets/tutor.css"
place "$TPL/agents/tutor.md"    ".claude/agents/tutor.md"
place "$TPL/assets/nav.js"      "assets/nav.js"
place "$TPL/assets/nav.css"     "assets/nav.css"
place "$TPL/assets/units.js"    "assets/units.js"
place "$TPL/index.html"         "index.html"
place "$TPL/assets/lesson-boot.js" "assets/lesson-boot.js"

chmod +x "$TARGET/tutor/tutorctl.sh" 2>/dev/null || true

echo
echo "$copied created, $skipped left alone."
echo
echo "Still to author (these depend on the subject and the learner):"
echo "  (assets/units.js was installed empty — fill it in so index.html has content)"
echo
for f in MISSION.md CURRICULUM.md RESOURCES.md TECH-STACK.md NOTES.md; do
  [ -e "$TARGET/$f" ] && echo "  have    $f" || echo "  MISSING $f"
done
