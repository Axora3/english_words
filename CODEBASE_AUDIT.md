# Codebase audit — 2026-11-17

Scope: the whole repository (44 JS modules, 3 stylesheets, tests, build, service worker, widget). Checkpoint commit `5cf7e64` on `main` holds the state before this work; all changes are on branch `chore/codebase-audit`. There is no `package-lock.json` and there are no npm dependencies.

## 1. Feature status

"Browser" means exercised end to end in the running app, with persisted state checked afterwards. "Unit" means covered by `npm test`. "Device" means it depends on hardware or OS behaviour that was not available here.

| Area | Feature | Status | Evidence |
| --- | --- | --- | --- |
| Learning | Daily schedule, new words, reveal, mark learned | Working | Browser + unit |
| | Word detail (audio controls, relations, family, phrases, state, collection) | Working | Browser |
| | Pronunciation (speech synthesis) | Working; audio output is device-dependent | Device |
| | Spaced repetition / review session / keyboard flow | Working | Browser + unit |
| | Daily test and results | Working | Browser + unit |
| | Favorites, difficult filter, history | Working; **history lacked dates → fixed** | Browser |
| | Weak words + "practise again" | Working | Browser + unit |
| Grammar | 100 lessons, CEFR tabs, weekly unlock, locked notice | Working | Browser + unit |
| | Exercises, wrong attempt → mistakes, retry, completion | Working | Browser + unit |
| Practice | Synonym/antonym/phrase quiz, spelling, builder, writing | Working | Browser + unit |
| | Listening (gated on actual playback start) | Working; audio is device-dependent | Browser (gating) + unit |
| | Speaking (microphone) | Implemented; not exercised (needs a mic) | Device |
| | Context, collocations, phrasal verbs, word families | Working | Browser |
| Progress | Calendar (month/week, day details), heatmap → calendar | Working; **Mongolian month name fell back to English → fixed** | Browser + unit |
| | Analytics, study goals, daily challenge (single claim) | Working | Browser + unit |
| | Achievements | Working; **were only recorded when the Achievements page was opened → now announced when earned** | Browser + unit |
| Vocabulary | Dictionary search (EN/MN), level/POS/collection filters | Working; **POS filter offered values no word had → now built from the data** | Browser + unit |
| | Collections CRUD, quiz, flashcards, JSON/CSV export | Working; **export file was always `collection.*` → now named after the collection** | Browser + unit |
| | Add to collection from word page | **False "saved" toast when adding failed → fixed** | Browser |
| | CSV/JSON vocabulary import with preview | Working | Browser + unit |
| System | Dark/light, MN/EN, compact | Working | Browser |
| | Settings validation (rejects schedules past midnight) | Working | Browser + unit |
| | Backup export / restore / corrupted file / legacy v1 | Working; **restoring a backup silently reset the theme to dark on next load → fixed** | Browser + unit |
| | Notifications (settings, dedup, extra reminders) | Settings and dedup working; OS delivery not verified | Unit / Device |
| | iPhone widget generation, preview, download, code view | Working; not run on an iPhone | Browser + unit / Device |
| | Offline shell | Service-worker fallback unit-tested | Unit |

No feature was UI-only or fake. Every visible control is wired to real state.

## 2. Repairs

1. **Security (XSS).** A crafted backup could inject attributes through a writing-record ID (`data-action`) and a mistake `sourceId` (`href`). Both are now escaped or encoded. The `button`, `iconButton`, `segmented`, `tabLinks` and `linkRow` helpers now escape all `href`/`data-action` values. The widget preview escapes the custom word's level.
2. **Content Security Policy** added to `index.html`: same-origin scripts, fonts and connections, no inline scripts. The dev server now sends `nosniff`/`no-referrer` and correct MIME types for `.ttf`, `.json` and `.png`.
3. **Unbounded storage growth.** Study time was saved as one record every 15 s, which would pass localStorage limits after months of use. It is now aggregated per day and section (`recordStudyTime`), and old records are compacted on load (`compactTime`) with totals preserved. Validation now allows aggregated values up to 86,400 s.
4. **Notification key growth.** Delivered keys older than yesterday are pruned (`pruneNotified`).
5. **Theme reset after restore**, the **achievement announcement**, the **history dates**, the **POS filter**, the **export filename**, the **collection-add feedback** and the **Mongolian calendar month**, all described in the table above.
6. **Navigation consistency.** Search and synonym lookups use the canonical `#library` route; `#dictionary` stays as an alias for old links. In scrollable tab strips the active tab now scrolls into view on narrow screens.

## 3. Cleanup report

Every item was checked for static imports, dynamic key construction (`t(x+'Prompt')`, `` `cefr-${level}` ``), service-worker and build lists, widget usage and backup/migration use before removal.

| Removed / changed | Reason |
| --- | --- |
| `premium.js` → `labels.js` | The name no longer described the content (label table only) |
| Duplicate `esc` in `app.js` | `ui.js` already exports it |
| Legacy `btn()`, `header()`, `PlatformUI.b/title`, `PracticeUI.b` | No callers after the redesign |
| `localWritingAdapter` (`writing.js`) | Unused abstraction |
| 73 i18n keys (EN and MN pairs) | No static or dynamic reference; a script proved all 469 remaining entries unchanged |
| CSS `.review-count-dot`, `.span-2`, `.tabular` | No markup uses them |
| `QA.md`, `EXPANSION_REPORT.md` → `docs/history/` | Stale reports that referenced deleted files; kept, not deleted |
| `build.mjs` | Starts from a clean `dist/` so stale files are not shipped |
| `.gitignore` / `.gitattributes` | `.env*` ignored; LF line endings |

Kept on purpose: dynamically used i18n keys (prompt types, widget steps and sizes, challenge kinds, context categories, reminder kinds); `tests/fixtures/redesign-preview.csv` (now used by a test); `widgets/English Words.js` (generated deliverable); `tools/icons.mjs`.

## 4. Tests

The original 42 tests plus 11 new ones in `tests/quality.test.mjs` cover:
- study-time aggregation and compaction;
- notification pruning and deduplication;
- legacy v1 import, backup round-trip and corrupted/invalid rejection;
- CSV preview and duplicate-safe merge;
- one-time achievement unlock;
- attribute and markup escaping;
- every literal UI key existing in both languages;
- service-worker and build lists matching real files.

Result: `npm test` 53/53 passing; `npm run build` succeeds.

## 5. Remaining issues and decisions

- The audit prompt asked to keep violet and mint. The palette was later changed at your request to navy/green (dark) and cream/gold (light); that newer request was kept.
- Device-only behaviour (audio, microphone, OS notifications, Scriptable on an iPhone) is untested here.
- Backups from this build may contain aggregated study-time records that older builds would reject (forward compatibility only).
- Mongolian copy added during the redesign would benefit from a native-speaker review.
