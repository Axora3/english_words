# English Words

A bilingual English vocabulary learning app. Mongolian is the default interface language; switch to English in Settings. No dependencies or account required. Requires Node.js 18+ for the local server and tests.

```sh
npm run dev
```

Open http://localhost:5173. Run `npm test` for scheduling, review, test, localization, and notification checks. `npm run build` creates a static deployment in `dist/`. Serve it over HTTPS (or localhost) for service worker and notification support.

## Features

- A curated collection of 30 English words, each with Mongolian meaning, IPA, part of speech, CEFR level, examples, synonyms, antonyms, and usage notes.
- One new word at a time on a persisted daily schedule. Defaults: five words, starting at 09:00, every ten minutes. Earlier missed words remain available, one at a time. All daily unlock times must fit before midnight. Changing learning settings updates today's schedule without removing learned words.
- Spaced review: correct recalls schedule 1, 3, 7, 14, 30, then 60 days ahead; incorrect recalls retry after 10 minutes. Newly learned words are immediately eligible for review. The default 14:00 review time is a reminder, not an access restriction.
- Randomized tests use only learned words as questions, with six types. Distractors come from the collection. A small learned collection may repeat words across question types. Results and unfinished tests persist. The default 20:00 test time is a reminder; tests can be taken at any time.
- Favorites, difficult words, learning history, activity statistics, dark mode, compact mode, and JSON backup export/import with validation and replacement confirmation.
- Pronunciation uses the device's English text-to-speech voice. Availability and quality depend on the browser and installed voices.

## Weekly grammar and speaking practice

Open **Долоо хоногийн дүрэм / Weekly grammar** and start the course. There are 100 original bilingual lessons, 20 in each of A1, A2, B1, B2 and C1. Topics progress from basic sentence structure through tense/aspect, modal verbs, determiners, clauses, passives, reported language and advanced information structure. CEFR labels are learning guidance, not a claim of an exhaustive official grammar checklist or a proficiency certificate. [British Council grammar resources](https://learnenglish.britishcouncil.org/free-resources/grammar) provide a linked learning reference.

The first lesson opens on enrolment; one additional lesson opens every seven calendar days from that date. Passing early does not advance the next release. Every lesson includes a bilingual explanation, a structure pattern, a translated worked example, English example audio and two exercises with feedback. Both exercise answers must be correct to mark a lesson completed. Earlier lessons remain accessible, failed attempts can be retried, and completed lessons and attempts survive refresh, settings resets and backup restoration. Existing version-1 backups remain compatible.

Vocabulary cards now offer normal and slow word pronunciation, example audio, an English usage explanation, combined word/example/usage playback and a stop button. Microphone practice is optional and starts only after its button is pressed. The browser requests microphone permission; it may send audio to its own speech-recognition service. Lexi does not store recordings or recognised transcripts. Navigation, stopping practice, a result, an error or a 15-second timeout ends listening.

Speech recognition compares the recognised word with the target; it **does not measure phoneme accuracy or assign a pronunciation/accent score**. An incorrect recognition result is a prompt to practise, not a reliable judgment of speaking ability. Browser speech recognition has [limited availability and can use a remote engine](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). Unsupported browsers retain listening/repeating controls and show an explicit microphone fallback. Denied permission, unavailable microphones, silence and network errors have separate messages. Speech synthesis voices and actual microphone service availability depend on the browser/device.

## iPhone Home Screen widget

Open **Profile → iPhone widget** to preview Small/Medium widgets, download a self-contained Scriptable script with your actual progress, or copy its code. The script runs offline on the iPhone, follows the same daily word schedule, displays the English word/Mongolian meaning/IPA, and can mark a due word learned. Tapping pronunciation opens Scriptable to speak the word. Scriptable must be installed on the phone; this is not a Safari shortcut or a WidgetKit app bundle.

`npm run build` also produces a default, progress-free `widgets/English Words.js` and packages it under `dist/widgets/`. See [the installation guide](widgets/README.md) for iPhone setup and manual JSON backup transfer between the widget and the website. There is no automatic cloud sync, and iOS controls actual widget refresh timing. The source was exercised with a Scriptable API harness; installation and native rendering on a physical iPhone have not been verified here.

## Persistence and reminders

Learning data uses browser localStorage. It stays on the current browser origin and device; there is no backend or cloud sync. Export backups before clearing browser data. All metrics start at zero and derive from actual learning records.

Reminders are opt-in and require browser notification permission. An open tab checks the schedule and uses a service worker to display notifications when available, otherwise the Notification API. The app records notification IDs and uses Web Locks where available to avoid duplicate reminders across tabs. Individual reminder toggles and the master switch are independent. Browser/OS permission and throttling can prevent or delay delivery. Reminders older than one minute are intentionally not replayed. Sound follows the browser/OS notification behavior; vibration is attempted only on supporting devices.

**Closed-app scheduled reminders are not implemented.** A static local app cannot reliably wake a service worker at a wall-clock time; reliable delivery while closed requires a server-side scheduler and Web Push subscription infrastructure. The UI states this limitation explicitly.

## Design system

The art direction is "quiet precision": ink-navy surfaces in dark mode and warm paper in light mode, with Inter typography. Colour has fixed jobs. Violet marks actions and the current selection. Mint marks achieved progress only. A five-step CEFR ramp (A1 → C2) is used the same way across vocabulary, grammar and analytics, and each practice type has its own hue. The audit and plan are in [UI_UX_AUDIT.md](UI_UX_AUDIT.md).

- `tokens.css` — dark/light colour tokens, type scale, spacing, radii, motion and the base layer (including `prefers-reduced-motion`).
- `components.css` — the shell (collapsible sidebar, top bar, mobile bottom navigation with safe areas) and every reusable component and state. Components include buttons, icon buttons with tooltips, badges, CEFR chips, stats, progress bars and rings, notices, feedback, empty states, skeletons, segmented controls, tabs, inputs, selects, switches, settings rows, quiz options, bar charts, dropdowns, dialogs, toasts, vocabulary rows, timelines, the audio player and voice practice.
- `screens.css` — layouts per screen, plus responsive rules for 375 → 1920 px.
- `ui.js` — HTML helpers for those components (the app renders HTML strings; there is no framework).
- `icons.js` — generated by `node tools/icons.mjs` from the official Tabler Icons 3.31.0 SVGs in `assets/tabler/` (MIT, licence kept). Icons are outline by default; filled variants are used only for selected states such as a saved heart. Unicode glyphs are not used as icons.
- `shell.js`, `home.js`, `word-ui.js` — navigation, the Home dashboard, and the learn, word-detail, review, test and word-list screens.

Keyboard shortcuts: `/` focuses vocabulary search, `Space` reveals the meaning in learn and review, and `1` / `2` answer a review card. The theme can be toggled from the top bar. The collapsed state of the desktop sidebar is a per-device preference stored under `english-words-ui`. It is not part of learning data or backups. Existing learning data, schedules, grammar progress and backups keep their formats. Every figure shown is derived from actual records.

## Structure

- `app.js`: UI, storage, notification coordination, import/export
- `core.js`: scheduling, spaced review, quiz generation, scoring
- `backup.js`: persisted-state and import validation
- `grammar-data.js`: 100 bilingual grammar lessons and 200 practice questions
- `grammar.js`: weekly calendar-based unlocks, mastery and grammar validation
- `grammar-ui.js`: course overview, syllabus and lesson interface
- `speech.js` / `voice-ui.js`: speech lifecycle, word comparison and optional practice interface
- `widget-model.js` / `widget-runtime.js`: offline iPhone widget scheduling, persistence and Scriptable rendering
- `widget-export.js` / `widget-ui.js`: personal script generation, preview, download/copy and setup instructions
- `i18n.js`: complete English/Mongolian UI dictionaries
- `words.js`: curated vocabulary collection
- `tokens.css` / `components.css` / `screens.css`: design tokens, component library and screen layouts (see Design system)
- `sw.js`: notification display and click handling
- `tests/core.test.mjs`: business logic regression tests

No authentication or profile is included because there is no backend. This is a local-first learning app, not a cloud service.


## Advanced expansion
Phase 1 adds calendar, collections, dictionary, goals and weak words. Phase 2 adds five listening modes with real speech-start gating, four spelling modes, sentence ordering, relation quizzes, 20 curated phrases and revision-based writing checks. Phase 3 adds earned badges, daily challenges, word families, real analytics and mistake records. Version-1 backups remain supported. Study time counts visible, focused, recently active sessions only. Writing uses local rules, not AI grading.

Phase 4: CSV/JSON vocabulary import uses a staged preview (5 MB / 5,000 words), normalized duplicate detection, validation and additive merge. Collection exports can be reimported. Offline service worker caches the app shell and curriculum after a successful online visit; device voices may still require connectivity. Invalid local storage is preserved and can be downloaded before restoring a valid backup. No backend, account or cloud sync is introduced.
