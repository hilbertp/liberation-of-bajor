# {Title}

<!-- Lane: file with `--lane core` or `--lane surface` (docs/adr/ADR-PROOF-LANES.md). Surface = what the screen shows or says, or what a document says, no new branch of logic. Core = everything that changes what the system does. Absent = core. -->

## What is broken / Goal

{One paragraph: the outcome, in plain words. What will be true after this lands.}

## Why (evidence)

{Measured facts with file:line. Never "this seems wrong" — show the number or the line.}

## Tasks

1. {Numbered, concrete, independently verifiable.}
2. {...}

{Core lane, word for word:} Write one safety-net test per acceptance criterion, plus one for each trap, then stop.
{Surface lane, word for word:} Write a safety-net test only for a criterion that asserts behaviour; otherwise write none, then stop.

## Screen hooks

{Only when a criterion touches the screen. One line per criterion, either the stable names
with their starting state — e.g. `slice-NNN-ac-1: proposed row = .queue-row[data-id=<id>],
drag handle = .drag-handle; visible when at least two proposed slices are staged` — or the
words `Rom to declare` for that criterion. Omit this section entirely when nothing touches
the screen.}

## Traps

1. {How this is likely to go wrong, one or two sentences. Core lane: Rom writes one safety-net test per
   trap. Surface lane: a note to Rom and Nog, no test. Not the place for testing instructions.}

## What Rom does not do

- Rom writes safety-net tests as the brief's lane says: core lane, one per acceptance criterion plus one per trap; surface lane, only where a criterion asserts behaviour. Then he stops.
- Rom never writes or commits a browser test (a *.spec.js under e2e/). Browser tests are Julian's, written after the slice is on dev.
- Rom never runs the full safety-net suite and never the browser suite. He runs only the test file he wrote. GitHub runs the safety-net suite when the slice lands on dev; the Promote button runs both.
- Rom may look in a browser to check his own work and says what he saw under ## Safety-net tests. He does not prove it with a test.
- Core lane only: before committing, Rom stashes his fix, runs his new test file, confirms every new test goes red, restores the fix, and lists which tests went red under ## Safety-net tests.
- Rom moves his own safety-net tests when his change requires it and lists every move under ## Tests moved or weakened. He never edits a browser test.

## Acceptance criteria

- slice-NNN-ac-1: {checkable condition Nog can evaluate against the DONE report}

## REQUIRED — declare the ACs as commit trailers

    AC: slice-NNN-ac-1: {same text, verbatim}
    Lane: {core | surface — the same value as the frontmatter}
