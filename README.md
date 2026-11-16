# English Words

A bilingual (Mongolian/English) English-vocabulary and grammar learning app. It is local-first: everything is stored in the browser, and there is no account, backend or cloud sync. Mongolian is the default interface language; switch to English in Settings. It has no runtime dependencies. Node.js 18+ is needed only for the local server, tests and build.

```sh
npm run dev     # local server on http://localhost:5173 (127.0.0.1 only)
npm test        # 53 automated tests (node:test)
npm run build   # clean static build in dist/ plus the Scriptable widget
```

Serve `dist/` over HTTPS (or localhost) for service-worker and notification support.

## Features

### Learning
- **Words:** 30 curated words, each with Mongolian meaning, IPA, part of speech, CEFR level, examples, synonyms, antonyms and usage notes. You can add your own words through CSV/JSON import.
- **Daily schedule:** one new word unlocks at a time. Defaults are five words, starting at 09:00, every ten minutes. Missed earlier words stay available. All of the day's unlock times must fit before midnight. Changing the schedule settings re-plans today without removing learned words.
- **Spaced review:** correct recalls schedule the next review 1, 3, 7, 14, 30, then 60 days ahead; incorrect recalls retry after 10 minutes. New words are immediately reviewable. Keyboard: `Space` reveals, `1` = again, `2` = remembered.
- **Daily test:** 6–10 randomized questions of six types, built only from learned words. Unfinished tests and results persist.
- **Lists:** saved words (favorites), difficult words, and learning history (sorted by date learned, showing the next review date). Weak words are ranked from real wrong answers and overdue reviews.
- **Word detail:** an audio player (normal and slow speed, example, usage, all), meaning and definition, examples in context, synonyms and antonyms (clicking one searches for it), word family, collocations and phrasal verbs. It also shows learning state (review stage, next review), a difficult toggle, add-to-collection and speaking practice.

### Grammar
100 original bilingual lessons, 20 in each of A1, A2, B1, B2 and C1. The first lesson opens on enrolment and one more opens every seven calendar days; passing early does not speed up the next release. Each lesson has an explanation, a pattern, a translated example with audio, and two exercises. Both answers must be correct to complete a lesson. Failed attempts can be retried and are recorded as mistakes. CEFR labels are learning guidance, not an official checklist. [British Council grammar resources](https://learnenglish.britishcouncil.org/free-resources/grammar) are linked as a reference.

### Practice
- Listening (5 modes): the Check button stays disabled until every clip has actually started playing.
- Speaking: microphone-based word recognition.
- Writing: revision history and local rule checks.
- Quizzes: synonym, antonym and phrase quizzes, plus the daily test.
- Spelling (4 modes) and the sentence builder (click or drag tokens).
- Context sentences, 20 collocations and phrasal verbs, and 10 word families.

Speech recognition compares the recognised word with the target; it **does not score pronunciation or accent**. Writing checks are local heuristics, not AI grading.

### Progress
- An analytics overview: words learned, mastered, accuracy, active study time and streaks.
- A 12-week activity heatmap (click a day to open it in the calendar), a 7-day chart and a 30-day trend.
- CEFR progress, weak words, time by section, and the month/week calendar with per-day details.
- Editable study goals, 18 achievements (announced with a notification-style message when earned), a daily challenge whose points can be claimed once, and a mistake tracker.

### Vocabulary management
- **Dictionary:** search by English or Mongolian, with filters by CEFR level, part of speech and collection. It remembers recent searches and recently opened words.
- **Collections:** create, edit (in a dialog) and delete; add or remove words; quiz and flashcards; JSON/CSV export named after the collection.
- **Import:** CSV/JSON vocabulary import with a preview (valid / duplicate / invalid rows), limited to 5 MB and 5,000 words. Import only adds words. Collection exports can be re-imported.

### System
- Dark and light themes (toggle in the top bar or in Settings), Mongolian/English interface, compact density.
- Settings for schedule, reminders and notifications. JSON backup export and restore, with validation and confirmation before replacing data.
- An iPhone Scriptable widget, and an offline app shell after the first online visit.

## Data, storage and backups

- Learning data lives in `localStorage` under `lexi-v1` (schema `version: 1`, `advanced.version: 1`). The sidebar collapse state is a per-device preference under `english-words-ui` and is not part of backups.
- Version-1 backups from older builds, including ones without `advanced` data, remain importable. Missing structures are created by `migrateAdvanced`.
- Restoring a backup replaces the current data only after confirmation. Corrupted or invalid files are rejected and the current data is left untouched. If stored data itself is unreadable, it is never overwritten: the app offers to download the raw text before you restore.
- Active study time is counted only while the tab is visible, focused and recently used. It is stored as **one record per day and app section**. Older per-sample records are merged on load with totals preserved. This keeps storage small; previously a record was added every 15 seconds.
- Delivered-notification keys older than yesterday are pruned automatically. Recent keys still prevent duplicate reminders across tabs (together with Web Locks).

## Reminders and notifications

Reminders are opt-in and need browser notification permission. While a tab is open, the app checks the schedule every second and shows notifications through the service worker, or through the Notification API as a fallback. Reminders older than one minute are not replayed. **Reminders while the app is closed are not implemented**: that would need a server-side scheduler and Web Push.

## iPhone widget

Open **Settings → iPhone widget** to preview Small/Medium widgets, download a self-contained Scriptable script containing your progress, or copy its code. It runs offline, follows the same schedule and can mark a due word as learned. `npm run build` also writes a progress-free `widgets/English Words.js`; its `exportId` timestamp changes on every build. See [widgets/README.md](widgets/README.md) for setup and manual backup transfer. iOS controls the refresh timing.

## Security

- All user-, import- and backup-provided text is HTML-escaped before rendering. The component helpers in `ui.js` also escape every `href` and `data-action` attribute value.
- Backups and imports are fully validated (`backup.js`, `advanced-state.js`, `vocabulary.js`), with size limits (5 MB files, 5,000 custom words, bounded string lengths) and unique-ID checks.
- `index.html` sets a Content-Security-Policy. Scripts, fonts and connections are same-origin only, with no inline scripts and no `eval`. The local server binds to 127.0.0.1, blocks path traversal, and sends `nosniff` and `no-referrer` headers.
- There are no secrets or environment variables. `.env*` files are git-ignored. External links use `rel="noopener noreferrer"`.

## Design system

The look is ink navy (`#202734`) with green actions (`#B7D894`) and pale-green text in dark mode, and cream (`#FCF0DA`) with gold actions (`#F2C46A`), olive progress and brown text in light mode. The typeface is Inter. A five-step CEFR colour ramp and one hue per practice type are used consistently. The icons are Tabler Icons 3.31.0, stored locally as SVG under `assets/tabler/` (MIT). `icons.js` is generated by `node tools/icons.mjs`. No emoji or Unicode glyphs are used as icons. See [UI_UX_AUDIT.md](UI_UX_AUDIT.md).

## Structure

| Area | Modules |
| --- | --- |
| App shell & routing | `app.js` (state, persistence, routing, event handlers, notifications), `shell.js` (sidebar, top bar, bottom nav), `ui-polish.js` (post-render accessibility) |
| Design system | `tokens.css`, `components.css`, `screens.css`, `ui.js` (component helpers), `icons.js`, `labels.js` (new bilingual labels), `i18n.js` + `platform-i18n.js` (dictionaries) |
| Screens | `home.js`, `word-ui.js` (learn, detail, review, test, results, lists), `grammar-ui.js`, `practice-ui.js`, `progress-ui.js`, `platform-ui.js` (dictionary, collections, calendar, goals, weak words, More), `import-ui.js`, `widget-ui.js`, `voice-ui.js` |
| Business logic | `core.js` (schedule, SRS, tests, notifications), `grammar.js`, `practice.js`, `writing.js`, `collections.js`, `dictionary.js`, `calendar.js`, `analytics.js`, `achievements.js`, `daily-challenge.js`, `study-goals.js`, `weak-words.js`, `mistakes.js`, `speech.js` |
| Data & validation | `words.js`, `grammar-data.js`, `collocations.js`, `word-family.js`, `context-learning.js`, `vocabulary.js`, `vocabulary-import.js`, `backup.js`, `advanced-state.js` |
| Widget | `widget-model.js`, `widget-runtime.js`, `widget-export.js` |
| Offline | `sw.js` (app-shell cache, network-first, notification clicks) |
| Tooling | `server.mjs`, `build.mjs`, `tools/icons.mjs`, `tests/*.test.mjs` |

## Known limitations

- Audio playback, microphone recognition, OS notification delivery and the widget on a physical iPhone depend on the device. They were not verified in this environment.
- Offline behaviour is covered by a service-worker test harness, not by cutting a real network connection.
- Backups exported from this version may contain study-time records longer than 60 seconds. Builds older than this audit would reject them.
- Some Mongolian interface labels added during the redesign should be reviewed by a native speaker.

Historical reports from earlier development phases are in `docs/history/`. They describe earlier states of the app.
