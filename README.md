# English Words

A bilingual (Mongolian/English) English-vocabulary and grammar learning app. It is an installable PWA that works offline. It is **local-first**: everything works as a guest with data in the browser. An optional Supabase account adds private cloud sync across devices and cloud backups. Mongolian is the default interface language; switch to English in Settings.

```sh
npm ci          # @supabase/supabase-js (runtime, vendored into dist/) + PGlite (tests only)
npm run dev     # http://localhost:5173 (127.0.0.1 only); serves config.js, sw.js and the client
npm test        # 84 tests: learning logic, merge/sync, PWA, and migrations + RLS on real PostgreSQL
npm run build   # clean static build in dist/ (deployed by Vercel), plus the Scriptable widget
```

Cloud sync is enabled by two **public** environment variables, `SUPABASE_URL` and `SUPABASE_ANON_KEY`, set in `.env.local` or in the Vercel settings (see `.env.example`). Without them the app runs in local-only mode. Setup, deployment and the production checklist are in [DEPLOYMENT.md](DEPLOYMENT.md).

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

## Guest mode, cloud account and sync

- **Guest (default):** progress lives only in this browser on this device. Nothing is sent anywhere. Move it with a JSON backup.
- **Account (optional):** Settings → **Account & sync**. Supports email + password sign-up with email confirmation, sign-in, email sign-in links, password reset, password change, sign-out and account deletion. Sessions persist and refresh automatically.
- **What syncs:** the same document as the JSON backup (all progress, settings, collections, custom words). It is stored in `learning_states`, one row per user, readable only by that user (Row Level Security on `auth.uid()`). The vocabulary and the 100 grammar lessons are app content and stay in the bundle.
- **First sign-in on a device:** nothing is uploaded or replaced automatically when both the device and the account hold progress. You see both side by side and choose **Merge both**, **Use cloud progress** or **Use this device's progress**. Merge is recommended. Before anything changes, a copy of the device's progress is kept (downloadable until you discard it). Replacing the cloud copy saves it as a cloud backup first. The result is verified by reading it back.
- **Ongoing sync:**
  - Changes are saved locally first, then pushed after a few seconds, every 2 minutes, when the connection returns, or with **Sync now**.
  - Each write is compare-and-swap on a revision number. If another device wrote in between, the app performs a three-way merge (`merge.js`): logs are unioned, deletions honoured, and the most recent review wins. Then it retries. A merged result that fails validation is never uploaded or applied.
  - The sync status is shown in the top bar and on the Account page: synced, syncing, waiting, offline, error, or needs a decision.
- **Offline:** everything except account actions keeps working. Changes are queued as "waiting to sync" and pushed when you reconnect; the indicator never claims a sync that didn't happen.
- **Signing out:** either keep the progress on this device (it becomes guest data) or remove it. Unsynced changes trigger a warning first.
- **Deleting the account:** type `DELETE` to confirm. This deletes the account and all cloud data. You can keep a local copy.
- **Cloud backups:** create, list, restore (with confirmation, after an automatic "before restore" backup) and delete. The newest 30 are kept.

## Install the app (PWA)

- **Android (Chrome):** tap **Install** when offered (or use the Install button in Settings), or Chrome menu → **Install app / Add to Home screen**.
- **iPhone / iPad (Safari):** open the site in Safari → **Share** → **Add to Home Screen** → **Add**. iOS has no install prompt, and its rules differ from Android: web-app notifications need iOS 16.4+ and the installed app, and Safari may clear the data of web apps left unused for weeks. Keep sync or backups on.
- **Desktop (Chrome / Edge):** the install icon in the address bar, or **Install** in Settings.

What the PWA includes:
- A standalone display with safe-area insets and a boot screen.
- 192/512 px, maskable and Apple touch icons, generated by `node tools/app-icons.mjs` from the logo.
- An offline app shell, and an **"A new version is ready — Update now"** prompt.

The service worker:
- Its cache name is a content hash of the deployed files.
- It precaches the app shell, the vocabulary, grammar lessons, fonts, icons and the Supabase client.
- It serves them cache-first in production.
- New deployments install in the background and activate only when you confirm. Old caches are deleted on activation.
- It **only handles same-origin GET requests**. Supabase API and auth traffic is never cached, and auth tokens stay in `localStorage` (never in Cache Storage).

## Reminders and notifications

There are three distinct mechanisms:
1. **In-app reminders.** While the app is open (tab or installed app), it checks the schedule every second.
2. **Browser notifications.** It shows those reminders as system notifications (through the service worker, or the Notification API), after opt-in and permission. Reminders older than one minute are not replayed; keys are de-duplicated across tabs.
3. **Remote Web Push** (reminders while the app is closed). **Not implemented.** It would need a push server, VAPID keys kept server-side, subscription storage and a scheduler. The app does not claim to remind you while it is closed.

## iPhone widget

Open **Settings → iPhone widget** to preview Small/Medium widgets, download a self-contained Scriptable script containing your progress, or copy its code. It runs offline, follows the same schedule and can mark a due word as learned. `npm run build` also writes a progress-free `widgets/English Words.js`; its `exportId` timestamp changes on every build. See [widgets/README.md](widgets/README.md) for setup and manual backup transfer. iOS controls the refresh timing.

## Security

- All user-, import- and backup-provided text is HTML-escaped before rendering. The component helpers in `ui.js` also escape every `href` and `data-action` attribute value.
- Backups and imports are fully validated (`backup.js`, `advanced-state.js`, `vocabulary.js`), with size limits (5 MB files, 5,000 custom words, bounded string lengths) and unique-ID checks.
- `index.html` sets a Content-Security-Policy. Scripts, fonts and connections are same-origin only, with no inline scripts and no `eval`. The local server binds to 127.0.0.1, blocks path traversal, and sends `nosniff` and `no-referrer` headers.
- Only the Supabase URL and the anon/publishable key ever reach the browser. `tools/env.mjs` **refuses to build or serve** a `service_role` JWT or an `sb_secret_` key. `.env*` files are git-ignored; `.env.example` has empty placeholders.
- The database is protected by RLS on every table. A test proves cross-user reads, writes and inserts are denied and anonymous access is blocked. Writes go through `push_learning_state`, which always uses `auth.uid()` and never a client-supplied ID. `delete_my_account` deletes only the caller.
- The CSP allows exactly one external origin, `https://*.supabase.co`, for API calls. The Supabase client is the pinned official `@supabase/supabase-js@2.118.0` (no `eval`), installed with a lockfile and served from `/vendor/`. It is loaded only for signed-in devices or when the Account page is opened.
- Vercel sends `nosniff`, `no-referrer`, `X-Frame-Options: DENY`, HSTS and a Permissions-Policy that allows the microphone for this site only. External links use `rel="noopener noreferrer"`.

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
| Cloud & sync | `cloud.js` (Supabase client, auth, data), `sync.js` (sync engine), `merge.js` (three-way merge), `account-ui.js` (Account & sync screen), `supabase/migrations/*.sql` |
| PWA & offline | `pwa.js` (registration, update prompt, install), `sw.js` (template), `manifest.webmanifest`, `icons/` |
| Tooling | `server.mjs`, `build.mjs`, `vercel.json`, `tools/env.mjs` (public config), `tools/app-files.mjs` (precache list and version), `tools/icons.mjs`, `tools/app-icons.mjs`, `tests/*.test.mjs` |

## Known limitations

- Audio playback, microphone recognition, OS notification delivery and the widget on a physical iPhone depend on the device. They were not verified in this environment.
- Offline behaviour was verified in a Chromium browser by stopping the server and using the app from its cache, and by service-worker tests. It was not tried on physical phones.
- Cloud sync, authentication and RLS were verified against PGlite, an in-process PostgreSQL with Supabase-style roles, and with an in-memory server in the sync tests. They still need to be checked against your real Supabase project (see the DEPLOYMENT.md checklist).
- Remote push notifications while the app is closed are not implemented.
- Backups exported from this version may contain study-time records longer than 60 seconds. Builds older than this audit would reject them.
- Some Mongolian interface labels added during the redesign should be reviewed by a native speaker.

Historical reports from earlier development phases are in `docs/history/`. They describe earlier states of the app.
