# explorable-teach

Teach any topic through interactive, explorable HTML lessons — with a stateless
AI tutor living inside the page.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `Lanbasara/explorable-teach`, managed with the
`gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each using its own name as the label string.
See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` (glossary) and `docs/DECISIONS.md` (design decisions) at the
repo root. This repo keeps decisions as one narrative record rather than numbered ADRs.
See `docs/agents/domain.md`.

### Tests

`npm test` — Node's built-in test runner, zero third-party dependencies, no install step.
The suite checks that this plugin's documents and scripts still describe reality. See
`docs/agents/tests.md`.
