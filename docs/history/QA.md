# Verification

Verified on 2026-11-16 in the local in-app Chromium browser.

## iPhone widget addition

- The complete suite now has 24 passing tests. Widget tests compare calendar/unlock behavior with the app, reject premature/stale learned actions, preserve compatible backup records, and compile/run the generated script against a controlled Scriptable API harness.
- Both Small and Medium render paths, speech dispatch, learned actions, backup export, silent-background-update protection, and acknowledged snapshot replacement were checked in the harness. No iPhone simulator or physical iPhone was available; native layout, speech output and widget installation remain device checks.
- Added Profile/sidebar navigation to the widget setup page. Preview uses a copy of real progress and does not mutate the learning schedule.
- Browser checks verified Small/Medium selection, generated code display, a successful `.js` download to the user's Downloads folder, and successful clipboard copying. Mobile setup at 390 pixels had no horizontal overflow and no browser warning/error logs.
- Generated widgets make no network requests and do not require the desktop localhost server to be reachable from the iPhone. All data transfer is explicit/manual; instructions state that widget refresh timing is controlled by iOS and speech opens Scriptable.
- The production build contains the setup modules and an initial, progress-free Scriptable script under `dist/widgets/English Words.js`.

## Claude artifact design update

- Inspected the supplied 15-artboard design in its embedded browser canvas. Read the home/flashcard typography, card geometry and computed colors directly: navy `#0b1020`, surface `#171e32`, border `#222a45`, purple `#6a5af0`, mint `#40d9b0`, Inter.
- Updated the dashboard, vocabulary library, cards, quiz/results, progress, settings/profile, notifications, grammar, pronunciation panel, icons and branding. Added the five-item mobile bottom nav and adapted the same visual system to desktop.
- The vocabulary library exposes only learned/saved words and the next available word. Future words remain hidden. Search and arrow-key tab switching were exercised in the browser.
- Checked library, learning, review, test, results, statistics, settings, notifications, grammar, history, favorites and word details at the mobile viewport. Each had matching viewport and document widths; there was no horizontal overflow. Browser warning/error logs were empty.
- English and light mode survived refresh. Restored Mongolian and dark mode after testing. Existing learned count, review result, test score and grammar completion remained intact.
- Exercised the compact pronunciation disclosure, slow playback and translation reveal. Microphone practice remains opt-in and was not activated for this visual update.
- Desktop dashboard at 1440 pixels had no horizontal overflow. Dashboard weekly activity remains available below the new reference-style cards.
- Reused the already-running local server on port 5173; no backend/account behavior was added from the reference's static examples.

## Weekly grammar and voice additions

- The expanded suite has 17 passing tests. New coverage validates all 100 bilingual lessons and their practice options, seven-calendar-day unlock boundaries, future-lesson access restrictions, completion without early unlocking, failed-attempt persistence, legacy backup compatibility, malformed grammar state, speech word matching, unsupported recognition, permission errors, cancellation and stale speech events.
- Started the grammar course in the browser. Exactly one lesson opened; the next date was seven days later. A deliberate wrong answer produced 1/2 and survived refresh. Retrying with both correct marked the lesson complete, kept the unlocked count at one, and changed its action to review.
- Direct navigation to a locked C1 lesson showed the locked notice rather than its learning content.
- Switching the interface to English preserved grammar completion and translated the new course and lesson controls. Grammar schedule dates include the year.
- Word cards show slow pronunciation, English example and usage playback, combined playback, stop controls, microphone practice, and privacy/recognition limitations. Slow and combined playback buttons and stop were exercised without browser errors; audio output was not independently assessed by a listener.
- Mobile checks at a 390-pixel viewport found no horizontal overflow on the expanded word card and the grammar lesson. The lesson and its explanation/example layout were visually inspected.
- Real microphone capture and recognition-service delivery were not activated in QA. Lifecycle/result/permission/error handling were tested with a controlled fake recognizer, without recording ambient audio. Device/browser microphone functionality still needs a user check.
- The QA browser now additionally contains an enrolled grammar course and one completed grammar lesson. The application still ships without seeded progress.

## Automated checks

- `npm test`: 10 tests pass (daily unlocks, refresh serialization, new-day rollover, changed schedules, midnight validation, spaced review, streaks, six quiz types, scoring, notification controls/deduplication, bilingual dictionary parity, valid backups, malformed imports).
- `npm run build`: production static output succeeds.
- `node --check app.js` and `node --check sw.js`: pass.

## Browser checks

- Dashboard, learning, review, test, results, favorites, history, statistics, settings, notifications, and word details render.
- Saved a word, revealed its meaning, and marked it learned. Refresh retained the favorite and progress, and advanced to the next eligible word.
- Completed a correct review. The word moved out of the due queue and its next review was the following day.
- Completed all six quiz question types, with one deliberate incorrect answer. Results showed 5/6, 83%, and the incorrect answer. A refresh mid-quiz retained the recorded answer.
- Changed to English and dark mode; refresh retained both preferences.
- Changed sound and the individual new-word reminder toggle; refresh retained both while the master remained off. No permission request occurred while the master was off.
- Changed the start time to a future time. Learning showed a live countdown after refresh while preserving the already learned word.
- Restored defaults through the confirmation dialog. Mongolian/light mode returned and learning history remained.
- Word-detail deep links retained their word and content after refresh.
- Mobile navigation opens and closes. Hidden mobile navigation does not expose focusable links.
- No horizontal overflow at 390, 768, and 1440 viewport overrides. Checked mobile notification and waiting screens, tablet word details, desktop dashboard, and dark favorites visually.
- Browser warning/error log was empty at final inspection.

## Limits

- Original Figma frames were inaccessible, so design matching is unverified.
- OS notification delivery, sound, and vibration depend on permissions and device support; actual OS delivery was not verified in this browser session. Scheduling and toggle logic are covered by automated tests.
- This local app does not schedule notifications while closed and does not sync between devices.
- Backup serialization and invalid-import rejection are unit tested; native file picker import/export were not exercised end to end.
- Vocabulary contains 30 curated entries; CEFR labels are editorial learning guidance.

The browser used for testing contains one genuinely learned QA word, one completed review, and one test result; the application ships with no seeded progress.


## Advanced expansion verification (2026-11-17)
42 automated tests pass and production build succeeds. All 15 new routes were opened in Mongolian mobile view without console errors. English/light checks and widths 390, 768, 1440 showed no document overflow on representative screens. Offline navigation fallback is covered by a controlled cache/fetch test, not a physical network disconnect. Native file-picker, microphone, OS notification delivery and real iPhone widget installation remain device verification tasks. See EXPANSION_REPORT.md for the complete scope and limitations.
