# SDD ledger — plan: docs/superpowers/plans/2026-09-25-personalize-my-cv.md

Pre-flight: interfaces Task3(extractJson)->Task4 ✓, Task2(parseResume/parseEnvelope)->Task5/7 ✓, Task4(generateJson)->Task5/7 ✓, Task2(Resume)->Task6 ✓, Task3(buildFileName)->Task7 ✓, Task5/7(actions)->Task8 ✓. No conflicts.
Ruling: plan Task 2 Interfaces contains stray chars "parseResumeнял" — ignore, use parseResume/parseEnvelope as named in Produces.
Ruling: Task 1 says `npx create-next-app` in repo root, but root already holds docs/specs/plans + .superpowers. Manual scaffold (package.json + configs by hand) instead — same deliverable, preserves history. Cost if wrong: minor config drift, caught by `npm run build` in Task 8.
Todos: 1-scaffold, 2-schema, 3-filename/json, 4-llm, 5-base-upload, 6-pdf, 7-tailor, 8-ui, 9-readme. Status: starting Task 1.
