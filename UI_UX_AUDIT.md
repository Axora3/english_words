# English Words — UI/UX audit and redesign plan

Date: 2026-11-17. Scope: the whole vanilla ES-module app (no framework, no bundler). That covers 33 hash routes, 4 stylesheets, 12 UI renderer modules, i18n dictionaries, the service worker, the build script and the test suite. The learning engine (`core.js`, `grammar.js`, `practice.js`, `backup.js`, `advanced-state.js`, the widget modules) is out of scope for visual changes and must keep its behaviour.

## 1. What exists

| Area | Files | Observation |
| --- | --- | --- |
| Shell / navigation | `premium.js` (`navigation`, `mobileNavigation`), `app.js` (`render`) | Sidebar has 5 primary + 3 secondary links, a settings link and a profile block. The topbar repeats an uppercase breadcrumb ("YOUR LEARNING SPACE / …"), the date, a bell and an "E" avatar. On mobile the sidebar becomes a drawer opened by "☰". |
| Styles | `styles.css` (42 KB), `theme.css` (38 KB), `platform.css` (9.5 KB), `premium.css` (57 KB) | Four generations of CSS (about 146 KB) override each other. The same selectors (`.card`, `.btn`, `.sidebar`, `.word-card`) are redefined up to four times. Tokens are defined three times with different names. |
| Icons | `icons.js`, `ui-polish.js`, inline glyphs everywhere | `polishUI()` walks every DOM text node after each render and swaps about 40 Unicode glyphs (`♪ ◇ ◆ ↗ ⌕ ◷ ✧ ϟ ⚑ ▣ ◎ ⇅ ★ …`) for SVGs. The swap is fragile, runs on every render, misses glyphs inside `lang` regions, and leaves "Aa" art blocks. The source still renders glyphs as icons. |
| Home | `premium.js: journalHome`, `platform-ui.js: challengeCard` | A row of four equal large "0" numbers, a focus card, a schedule list and two lower panels. The daily challenge card is appended after `main` content by a route check. The hierarchy is flat: everything has equal weight. |
| Vocabulary | `platform-ui.js: dictionary`, `wordRows` | The search plus three native selects sit inside a card, followed by unstyled rows of the same weight. CEFR level has no visual system. A second "Recent" card repeats rows. |
| Word detail | `app.js: wordCard`, `premium.js: wordConnections`, `voice-ui.js` | One `wordCard` function serves learn, review *and* detail, with boolean flags. As a result the detail page is a flashcard, not a reference page. The four audio actions are text links, not an audio control. The relations are plain text. |
| Review / test | `app.js: reviewPage/testPage/resultsPage` | They reuse the word card. Decorative "intro-art" blocks of glyphs (`↻✦`, `✓✧`). There is no keyboard flow and no meaningful completion summary. |
| Grammar | `grammar-ui.js` | Three equal numbers (two of them show the same value). The syllabus is five `<details>` cards plus a redundant level `<select>`, with glyph state markers (`✓`, `◷`, `↗`, `⌄`). |
| Practice | `premium.js: practiceCenter`, `practice-ui.js` | Four lanes with the same treatment. Speaking is a link into a word page. Exercise screens are generic cards with native selects. |
| Progress | `progress-ui.js`, `platform-ui.js: calendar/goals/weak` | Nine numbers in a grid, raw `<progress>` elements, unlabelled 30-day bars, and time-by-section showing internal route keys ("dashboard · 3"). The heatmap uses ISO dates as labels and has no weekday or month axis. Achievements use `★/◇`. |
| Settings | `app.js: settingsPage/notificationsPage` | A profile card, a widget link, three setting cards and an aside, with glyph section icons. Theme is a select. The About section is missing, and the reset action is a muted text link next to Save. |
| More | `platform-ui.js: tools` | Three `<details>` blocks of chip links ending in "↗". |

## 2. Problems (ranked)

1. **No single design system.** Four overlapping stylesheets, three token sets, and ad-hoc components re-styled per screen. Every screen inherits `.card` with 20–28 px radii, so everything looks like the same tile.
2. **Icon inconsistency.** There is a mix of Unicode glyphs, a runtime text-node replacement hack and Tabler SVGs. Adjacent icons differ in style and alignment, and some icon-only buttons have no reliable labels.
3. **Weak information hierarchy.** Home, Grammar and Progress give equal weight to every number. Nothing tells the learner what to do next.
4. **Repetitive card grids.** Dictionary, phrases, families, achievements, mistakes, collections and analytics all render `card platform-card` stacks.
5. **Word detail is not a reference page.** There is no editorial word typography and no real audio control. Learning state (stage, next review) is hidden at the bottom as small text.
6. **Unlabelled or misleading data viz.** Bars have no axis, internal keys are shown to users, and the heatmap has no axes or legend.
7. **Mobile.** The "More" entry is buried. Some text drops to 8–11 px. Bottom-nav labels truncate in Mongolian.
8. **States.** Focus rings are inconsistent. Disabled styles are missing on several controls. There are no designed empty, error or offline states.

## 3. Art direction — "Quiet precision"

A calm, editorial study environment: deep ink navy in dark mode, warm paper in light mode. Typography carries the identity. The English word is set very large and tight, IPA and numerals use tabular figures, and hairline rules replace boxes where possible. Colour is functional:

- **Violet** — actions and the current selection.
- **Mint** — achieved progress only.
- **A five-step CEFR ramp** (A1 → C2), used consistently on vocabulary, grammar and analytics.
- **One hue per practice type** (listening, speaking, writing, quiz, spelling, builder, context), applied only to that type's icon tile and accent rule.

Radii are 6 / 10 / 14 px. Elevation appears only on menus, dialogs and the primary "today" module.

## 4. Implementation plan

- **Foundation:** `tokens.css` (dark/light tokens, type scale, spacing, motion), `components.css` (every component and state), `screens.css` (screen layouts). These replace the four legacy stylesheets. `ui.js` holds HTML component helpers (button, icon button, page/section header, stat, progress bar/ring, badge, CEFR chip, empty state, switch/select rows, segmented control, word row, audio player, quiz option, heatmap). `icons.js` is generated from 109 official Tabler 3.31.0 SVGs stored locally (`tools/icons.mjs`), with filled variants used only for selected states.
- **Remove the glyph hack:** all glyphs are replaced at the source. `polishUI` keeps only its accessibility duties (labels, `aria-disabled`, auto-opening dialogs).
- **Screens:** new renderers for Home, Vocabulary, Word detail, Learn, Review, Test/Results, Grammar (course + lesson), Practice center + exercises, Progress overview, Calendar, Goals, Weak words, Achievements, Challenge, Mistakes, Collections, Phrases, Context, Families, Writing, Import, Settings, Notifications, Widget and More. The renderers keep every `data-action`, form `id`, input `id`/`name` and handler, so the business logic is untouched.
- **Navigation:** desktop collapsible sidebar (Learn group, Library group, Account). Mobile bottom nav: Home / Vocabulary / Review / Practice / Progress. All other destinations go in the "More" directory, reached from the mobile top bar.
- **Motion:** 120–220 ms transitions; press feedback; reveal, progress and toast transitions; quiz feedback; achievement pop. Everything is disabled under `prefers-reduced-motion`.
- **Verify:** `npm test` and `npm run build`; browser pass at 375 / 390 / 768 / 1024 / 1440 / 1920 in both themes and both languages; core flows (learn → review → test, grammar exercise, practice, import/export).

## 5. References studied

- [Tabler Icons](https://github.com/tabler/tabler-icons) — the only icon source (MIT, notice kept in `assets/tabler/LICENSE`).
- [Lucide](https://github.com/lucide-icons/lucide) — reference for optical consistency (24 px grid, a single stroke width). Not mixed in.
- [Radix Primitives](https://github.com/radix-ui/primitives) / [Themes](https://github.com/radix-ui/themes) — patterns reimplemented in vanilla JS/CSS: roving-tabindex tabs, visible `:focus-visible` rings, dialog focus return and Escape handling, switch semantics, and 12-step colour roles.
- [Motion Primitives](https://github.com/ibelick/motion-primitives) — short, purposeful transitions, reimplemented in CSS. No React dependency.
