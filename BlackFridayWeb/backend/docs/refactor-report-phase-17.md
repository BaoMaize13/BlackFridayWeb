# Phase 17 Refactor Report

## Goals

- clean architecture
- reduce duplication in scripts and report generation
- keep behavior unchanged for existing endpoints and demo flows
- remove dead code that is not referenced anywhere

## Files Added

| File | Purpose |
| --- | --- |
| `src/scripts/script-helpers.js` | Centralize reusable CLI parsing, HTTP request, response unwrap, console formatting, and counting helpers for runner/report scripts. |
| `src/utils/sleep.util.js` | Share the same `sleep()` utility between purchase flow and Redis lock flow instead of duplicating timer helpers. |
| `docs/refactor-report-phase-17.md` | Record the Phase 17 cleanup scope, safety checks, and test results for demo/submission. |

## Files Modified

| File | Change | Reason |
| --- | --- | --- |
| `README.md` | Rewrote the root backend README with quick start, script groups, demo commands, and docs index. | Make the repo easier to run and review during demo/submission. |
| `src/services/lock.service.js` | Replaced local `sleep()` helper with shared `sleep.util`. | Remove duplication while keeping lock behavior unchanged. |
| `src/services/purchase.service.js` | Replaced local `sleep()` helper with shared `sleep.util`. | Keep no-lock behavior identical but remove repeated utility code. |
| `src/scripts/no-lock-runner.js` | Switched shared CLI/HTTP/output helpers to `script-helpers.js`. | Reduce copy-paste without changing request flow or evidence calculation. |
| `src/scripts/with-lock-runner.js` | Switched shared CLI/HTTP/output helpers to `script-helpers.js`. | Same orchestration behavior, less duplicated plumbing. |
| `src/scripts/multi-instance-runner.js` | Switched shared CLI/HTTP/output helpers to `script-helpers.js`. | Keep multi-instance proof logic intact while standardizing script infrastructure. |
| `src/scripts/generate-metrics-summary.js` | Reused shared argument parsing helper. | Standardize CLI parsing across reporting scripts. |
| `src/scripts/compare-lock-strategies.js` | Reused shared argument parsing helper. | Standardize CLI parsing across reporting scripts. |
| `src/scripts/no-lock-report.js` | Reused `markdown-report.builder` and `report-writer` for Markdown table rendering and file output. | Eliminate duplicated file-writing and Markdown table boilerplate. |
| `src/scripts/with-lock-report.js` | Reused `markdown-report.builder` and `report-writer`. | Same as above, no change to report semantics. |
| `src/scripts/multi-instance-report.js` | Reused `markdown-report.builder` and `report-writer`. | Same as above, no change to report semantics. |
| `src/scripts/no-lock-evidence.js` | Reused shared boolean formatting helper. | Keep entry script thinner and consistent with other scripts. |
| `src/scripts/with-lock-evidence.js` | Reused shared boolean formatting helper. | Keep entry script thinner and consistent with other scripts. |

## Files Removed

| File | Reason | Safe because |
| --- | --- | --- |
| `src/config/database.js` | Dead compatibility shim that only re-exported `databaseConfig`. | No source file or test imports it; all runtime code already uses `src/config/index.js` directly. |

## Architecture Checks

| Check | Status |
| --- | --- |
| Controllers do not query DB directly | PASS |
| Routes only wire endpoints and middleware | PASS |
| Repositories do not contain business logic | PASS |
| Services contain purchase and lock business flow | PASS |
| Response format remains standardized through `response.js` | PASS |
| Error codes remain centralized in `constants/system.js` | PASS |
| Domain action/status constants remain centralized in `constants/domain.js` and `constants/lock.constants.js` | PASS |
| Existing script entrypoints still exist | PASS |

## Behavior Preservation Notes

- `POST /purchase/no-lock` was not made safe.
- `POST /purchase/with-lock` still uses Redis distributed lock.
- report filenames, evidence structure, and compare flow remain compatible with previous phases.
- Phase 17 focused on plumbing cleanup, not business rule changes.

## Test Results

| Command | Result | Notes |
| --- | --- | --- |
| `node -e "require(...)"` load check for changed modules | PASS | Confirmed refactored script/service modules load successfully after import changes. |
| `npm run test:all` | PASS | `44` pass, `20` skip. Redis-dependent tests skipped honestly because Redis was unavailable. |
| `npm run report:metrics -- --input=reports\\phase16-with-lock-sample.json --filePrefix=phase17-metrics-sample` | PASS | Metrics summary JSON/Markdown/CSV generated successfully after refactor. |
| `npm run report:compare -- --noLock=reports\\phase16-no-lock-sample.json --withLock=reports\\phase16-with-lock-sample.json --filePrefix=phase17-compare-sample` | PASS | Comparison JSON/Markdown/CSV generated successfully after refactor. |
| `npm run test:lock` | FAIL | Honest environment limitation: Redis was not running, so the script exited with `Redis reconnect retry limit reached`. |

## Known Limitations

- Redis-dependent tests and lock scripts still require a running Redis instance.
- Multi-instance end-to-end verification still requires two backend processes running at the same time.
- This phase did not introduce ESLint/Prettier to avoid a noisy formatting diff right before demo/submission.
- The workspace already contained pending Phase 15 and Phase 16 changes; this report only describes the cleanup applied in the current Phase 17 pass.
