# Tutor tuning for this workspace

The tutor's general definition is in `tutor/ROLE.md` — the plugin's copy, shared by every
workspace. Do not repeat any of it here. **This file holds only what is particular to this
subject.** It is appended after the general definition, and both paths to the tutor — the service
and the subagent — get exactly the same pair.

Before any teaching has happened this file is empty, and that is fine: nothing written here means
the general definition alone.

What is usually worth writing down:

- **How this subject uses words** — which terms to translate, which to keep in the original, and
  any the learner has said outright they do not follow.
- **How to draw an analogy in this subject** — the ones already built in a lesson, which can be
  reused rather than reinvented.
- **Where this course stops** — "this course goes as far as x86; leave ARM out of it", "all code
  in Python 3.12 style".
- **Which files are worth a second look** — name the cheat sheets under `reference/`, if this
  course has any.

This file is prompt scaffolding, so write it in English like the definition it extends; what
language the tutor *answers* in is the learner's, and `tutor/ROLE.md` already says where that
comes from.

Restart the service after editing this file: `./tutor/tutorctl.sh restart`
