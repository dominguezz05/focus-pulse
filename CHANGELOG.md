# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.7.1] - (2026-02-11)

### Added

- **GitHub Action**: Automated Git tagging system triggered on `main` branch merges, synchronized with JSON versioning.

---

### [2.7.0] (2026-02-10)

### 🌍 Full English Translation

**Complete i18n - Professional English Throughout**

- All dashboard UI translated to English
- Friends system: "Share Profile", "Searching...", "User", etc.
- Feedback modal: All validation messages in English
- Consistent professional terminology
- Ready for international users

---

### [2.6.2] (2026-02-09)

### 🎯 New Features

#### 💬 Feedback System with GitHub Integration

**User-Friendly Feedback Collection**

- **Floating button** — Always-visible feedback button in dashboard (bottom-left corner)
- **Premium modal design** — Glassmorphism UI with smooth animations
- **Multiple feedback types** — Ideas 💡, Bugs 🐛, UX Improvements ✨
- **Smart auto-popup** — Automatically appears when user reaches:
  - Level 5+
  - 7+ achievements unlocked
  - 5+ day streak
  - Only shows once every 30 days (non-intrusive)

**Dual Submission System**

- **Email via FormSubmit.co** — Direct email notifications (zero config needed after initial setup)
- **GitHub Issues** — Auto-creates issues in repository with proper labels
  - `enhancement` + `user-feedback` for suggestions
  - `bug` + `user-reported` for bug reports
  - `ux` + `user-feedback` for UX improvements
- **User context included** — Level, XP, and version auto-attached to feedback

**Privacy & UX**

- Optional email field (for follow-up responses)
- No sensitive data collected (no file names or code)
- Honeypot spam prevention
- One-click "View Issue" after submission
- Captcha-free experience

---

### [2.6.1] (2026-02-09)

### ✨ Friends System 2.0 - Major Improvements

#### 🚀 Share Profile Enhancements

- **Auto-copy gist link** — Gist URL automatically copied to clipboard when sharing profile
- **Multiple share options** — After sharing, choose to:
  - 📋 View full instructions (link + username)
  - 👤 Copy username only
  - 🌐 Open gist in browser
- **Better UX** — Clear instructions on what to share with friends

#### ⚡ Add Friend by Link (Recommended)

- **Direct gist link support** — Paste full gist URL instead of searching by username
- **Instant addition** — No waiting for GitHub API indexing
- **Auto-detection** — Automatically detects if input is:
  - Full gist URL (`https://gist.github.com/user/abc123...`)
  - Gist ID (`abc123def456...`)
  - GitHub username (fallback to search)
- **100% reliable** — Works even seconds after friend shared their profile

#### 🛠️ Search Improvements

- **Multi-page search** — Searches up to 300 gists (3 pages) instead of just 100
- **Retry with delay** — Automatically retries failed searches with 2-second delay
- **Better error messages** — Clear, actionable error messages with troubleshooting steps
- **Handles edge cases** — Graceful handling of network errors and API rate limits

### 🐛 Bug Fixes

#### State Management

- **Fixed persistent state error** — Resolved `"focusPulse.focusPulseAppState is not a registered configuration"` error by correctly using `globalState.update()` instead of `workspace.getConfiguration().update()`

#### Friends Tab UI

- **Fixed "Actualizando..." stuck state** — Now sends cached data when debounced or on error
- **Fixed buttons not resetting** — Add/Share buttons now properly reset after success or error
- **Fixed concurrent refresh blocking** — Improved `isRefreshing` flag handling with proper cleanup
- **Fixed missing error feedback** — All errors now update UI with current friends list + error message

#### Search Reliability

- **Fixed timing issues** — Retry mechanism handles newly created gists that aren't indexed yet
- **Fixed single-page limitation** — Now searches multiple pages of gists
- **Fixed network error crashes** — Proper error recovery and timestamp updates

### 🔧 Technical Improvements

- Added debouncing for friend refresh (5-second cooldown)
- Improved cache TTL handling (30-minute default)
- Better separation of concerns (link detection, error handling)
- Enhanced logging for debugging search issues

---

## [2.6.0] - 2026-02-05

### Features

- **Friends System** — Share a public GitHub Gist profile and compare stats with friends side-by-side in a new "Amigos" tab on the dashboard. Add friends by GitHub username or gist ID; profiles are cached locally with a 30-minute TTL and work offline with stale data. No backend required — leverages existing `@octokit/rest` and gist infrastructure.
  - New commands: `focusPulse.shareProfile`, `focusPulse.addFriend`, `focusPulse.removeFriend`
  - New files: `src/friends/FriendTypes.ts`, `src/friends/FriendService.ts`, `src/friends/friendCommands.ts`

---

## [2.5.1] - 2026-02-04

### Fixed

- **PeakPerformanceAnalyzer crash** — `day.sessions.forEach is not a function`. The analyzer expected session objects with `start`/`end` timestamps, but `HistoryDay.sessions` is a plain number (count). Rewrote both `analyzePeakPerformance()` and `getHourlyStats()` to work with the actual stored data model.
- **NotificationService crash on startup** — `eventBus` was used directly in `activate()` without being in scope. Changed to `getEventBus()`.
- **Dead notification listeners** — `NotificationService` registered handlers for `POMODORO_COMPLETED`, `GOAL_COMPLETED`, `DEEP_WORK_STARTED`, and `DEEP_WORK_ENDED`, but none of those events were ever emitted. Wired up all missing emissions:
  - `pomodoro.ts` → `POMODORO_STARTED`, `POMODORO_COMPLETED`, `POMODORO_RESET`
  - `deepWork.ts` → `DEEP_WORK_STARTED`, `DEEP_WORK_ENDED` (on manual stop and on session completion)
  - `extension-refactored.ts` → `XP_EARNED`, `GOAL_COMPLETED` (on state transitions in the update loop)

---

## 2.5.0 (2026-02-03)

### Features

- add daily goals panel and achievements (v1.2.0) ([7f514ba](https://github.com/dominguezz05/focus-pulse/commit/7f514ba814671813bd5dd59ef425574420262ff2))
- add heatmap, export, insights and new achievements to Focus Pulse ([6ebf6aa](https://github.com/dominguezz05/focus-pulse/commit/6ebf6aa494da5439c6645821e6e490bf1c8ec6f0))
- add pomodoro, history tracking and achievements to Focus Pulse ([249c2de](https://github.com/dominguezz05/focus-pulse/commit/249c2de635a4ee01b3f52416c75cda8e3ee17d7a))
- add XP levels and progress bar to live dashboard ([7aaeb3e](https://github.com/dominguezz05/focus-pulse/commit/7aaeb3eaabd589e096a1f70691ae8eec56a9a861))
- configurable focus score and reset command for history and XP ([5123d2a](https://github.com/dominguezz05/focus-pulse/commit/5123d2abe87fa658736c1decfa570591b62c435a))
- integrate pomodoro into XP system and achievements ([865a29c](https://github.com/dominguezz05/focus-pulse/commit/865a29cdece7ea94ab1c2c6b5b6fc12f40626980))
- live dashboard with realtime focus stats updates ([14db491](https://github.com/dominguezz05/focus-pulse/commit/14db4912c6e1b8f261e0f856aa60940f4e213b8d))
- release Focus Pulse 2.0.0 (Deep Work + weekly insights) ([1ef72f0](https://github.com/dominguezz05/focus-pulse/commit/1ef72f08483044bba04a1794a0505430048b2253))
- show level in status bar and add XP-based achievements ([88a0771](https://github.com/dominguezz05/focus-pulse/commit/88a0771c8899a9454e13d41287942d21589cceee))
- ver todos los logros ([35a86d2](https://github.com/dominguezz05/focus-pulse/commit/35a86d2be64a32c21dd27eb8d081995b6b463e27))

### Chores

- +added / -deleted in dashboard ([79b9348](https://github.com/dominguezz05/focus-pulse/commit/79b9348226df08f3360e8afc548435dcb690b03a))
- assistant widget ([8f1ef9a](https://github.com/dominguezz05/focus-pulse/commit/8f1ef9acfb2c48e677887432a1a3bf0f0b2b6449))
- button ui ([9367a29](https://github.com/dominguezz05/focus-pulse/commit/9367a2917496e3a22ae0e19e637a789a19f955b3))
- Importacion y exportacion de datso de la cuenta ([4748a8a](https://github.com/dominguezz05/focus-pulse/commit/4748a8aa3958d378c40b479864883916ef15d526))
- new functions assistant ([fa3766b](https://github.com/dominguezz05/focus-pulse/commit/fa3766b22f375a48219b1577025c57f2490c0020))
- new logic functions assistant ([2692249](https://github.com/dominguezz05/focus-pulse/commit/2692249648856c19ce47496d4883817af7835a40))
- new version config ([5d2d97b](https://github.com/dominguezz05/focus-pulse/commit/5d2d97b2c27673a894374370b1dcf2bba94ac57c))
- prepare Focus Pulse 1.0.0 for Marketplace ([0eb2fd6](https://github.com/dominguezz05/focus-pulse/commit/0eb2fd60b3fb53eac84582fec8a5b67a92b19b3d))
- prepare Focus Pulse for VS Code packaging ([7c0534c](https://github.com/dominguezz05/focus-pulse/commit/7c0534c5aeab2d03d26a5c0d2068db79488e32d2))

### Bug Fixes

- assistant images ([b0d8028](https://github.com/dominguezz05/focus-pulse/commit/b0d8028d7d63471c8d912e54c3c3db16df07518a))
- assitant animation ([13fa87b](https://github.com/dominguezz05/focus-pulse/commit/13fa87b1f89bd9aeef33e5863bad2391932d6463))
- auth user ([2615c0c](https://github.com/dominguezz05/focus-pulse/commit/2615c0c23fd6b9cc5151ddff274c9abe4cdfcbd0))
- better readme ([710c590](https://github.com/dominguezz05/focus-pulse/commit/710c59035b0b5367fb8255b748b659a88fb13380))
- button ([016f960](https://github.com/dominguezz05/focus-pulse/commit/016f9603aac1f06a993963fa941de3438a148d6d))
- cambios ([1abbe1c](https://github.com/dominguezz05/focus-pulse/commit/1abbe1c809d28d2e10be78c0f436ed4aa6c14d9a))
- changelog implementation on readme ([80ce1ee](https://github.com/dominguezz05/focus-pulse/commit/80ce1ee42c349b719788c34c55e469532e62c5d5))
- commands in the button ([858b06e](https://github.com/dominguezz05/focus-pulse/commit/858b06e3d77cc629a84faeb4c0f6d083c7f6b8a7))
- correct typo in README ([46f360b](https://github.com/dominguezz05/focus-pulse/commit/46f360be18e9200d44bdb38727bfd11b67b9be45))
- details ([25dab7d](https://github.com/dominguezz05/focus-pulse/commit/25dab7d0ce9046b975e398171528c7cc6380d40f))
- gitnore ([9aacdca](https://github.com/dominguezz05/focus-pulse/commit/9aacdca52722cd6032564111cbd98934646f6dd7))
- image ([6ded27d](https://github.com/dominguezz05/focus-pulse/commit/6ded27d54f9a309fb03346fde5cdf1d1caa92c90))
- image assistant ([8432921](https://github.com/dominguezz05/focus-pulse/commit/8432921afecc91f84735ce3cc73bf49de13d8bd9))
- import y sincronización ([a9cae55](https://github.com/dominguezz05/focus-pulse/commit/a9cae55e2b1fdd7027dbfe1089042dc16fd04e7b))
- layout ([531036d](https://github.com/dominguezz05/focus-pulse/commit/531036da40df699eef3dcfa747a666fa5b2eb112))
- readme and chagelog ([1525c72](https://github.com/dominguezz05/focus-pulse/commit/1525c723d83a5f91878bd13f72bb76d147482cdb))
- readme and changelog ([8ba0d49](https://github.com/dominguezz05/focus-pulse/commit/8ba0d49242fa248d8df3ad766c3117a11f11f41e))
- repository ([95a5b50](https://github.com/dominguezz05/focus-pulse/commit/95a5b50b689004ef3b1f499b28e350df0bca095e))
- sync ([f2bc46c](https://github.com/dominguezz05/focus-pulse/commit/f2bc46c8292656459c077b90e7a5ef3d7d75dc79))

## [2.4.2] - 2026-02-04

### Added

- **🔮 Predictive Fatigue Detection**: AI-powered fatigue prediction using linear regression on score history. The assistant now warns you 10-15 minutes BEFORE fatigue hits, not after.
- **🎯 Peak Performance Analysis**: Automatic analysis of your productivity patterns to identify your best working hours and most productive days.
- **📊 Git Activity Insights**: Real-time celebration and tracking of git commits, merges, PRs, and coding streaks.
  - Detects commit types (feature, fix, test, docs, merge)
  - Celebrates massive commits (>10 files or >500 changes)
  - Tracks commit streaks (3+, 5+ commits per hour)
  - Detects PR merges with epic celebrations
- **⏰ Optimal Work Time Recommendations**: Based on historical data, the assistant suggests the best times for deep work and alerts when working during non-optimal hours.
- **📈 Smart Session Analytics**: Advanced metrics including score decline rate, variance analysis, and hourly performance tracking.

### Improved

- **Enhanced Assistant Intelligence**:
  - **Predictive Analysis**: Score decline detection using 10-minute sliding window with linear regression
  - **Time-Aware Recommendations**: "You'll be fatigued in ~10 min" instead of "You're fatigued now"
  - **Git Integration**: Automatic monitoring every 30 seconds with intelligent event detection
  - **Peak Hour Analysis**: Only shown once per day to avoid spam
  - **Contextual Tips**: File-type specific messages now include performance context
- **Message Quality**:
  - Added 30+ new contextual messages for different coding scenarios
  - Improved message timing (predictive vs reactive)
  - Better celebration triggers for achievements and git milestones
- **Configuration Sync**: Assistant config now syncs automatically with VS Code settings changes in real-time.

### Fixed

- **Configuration Loading**: Assistant now properly reads personality, flowProtection, and contextualMessages from VS Code settings on startup.
- **Resource Cleanup**: Added proper `deactivate()` function to clean up git monitoring intervals and prevent memory leaks.

### New Commands

```
Focus Pulse: Ver estadísticas de Git
```

Shows your git activity stats for the last 7 days (commits, avg per day, most productive day).

### Technical Improvements

- **Services Architecture**:
  - New `GitAnalysisService`: Analyzes git activity and generates insights
  - New `PeakPerformanceAnalyzer`: Identifies optimal work hours and patterns
  - Enhanced `AssistantService`: Integrates all analysis services
- **Predictive Algorithm**:
  - Calculates score decline rate using linear regression
  - Maintains 30-minute rolling score history
  - Triggers alerts based on decline velocity + current score
- **Performance**: Git monitoring runs async every 30s without blocking UI
- **Type Safety**: Full TypeScript typing for all new services and interfaces

---

## [2.4.1] - 2026-02-02

### Added

- **🎭 Personality System**: Choose your assistant's personality: Motivador, Neutro, Zen, or Humorístico.
- **🌊 Flow State Protection**: The assistant now detects when you're in "the zone" (high focus, low switching) and avoids interrupting.
- **📁 Contextual Messages**: File-type aware messages (test files, documentation, frontend/backend code).
- **⏱️ Adaptive Cooldown**: Smart message timing based on context (longer during flow, shorter for celebrations).

### Fixed

- **Assistant Visual System**: The assistant now correctly displays animated PNG sprites from `media/assistant/` instead of static emojis.
- **Sprite Animation Engine**: Implemented frame-by-frame animation loop (350ms intervals) for all assistant states (IDLE, FOCUSED, WARNING, SUCCESS).
- **Webview Resource URIs**: Fixed image loading by properly converting local file paths to webview URIs using `webview.asWebviewUri()`.
- **State Transition Animations**: Enhanced visual feedback with smooth opacity transitions between sprite frames.
- **Animation Cleanup**: Added proper cleanup of animation intervals to prevent memory leaks when dashboard is closed.

### Improved

- **Assistant Intelligence**:
  - **Flow Detection**: Score ≥75 + low switching + active editing + 15+ min session = Flow State
  - **Smart Interruptions**: Only high-priority messages during Deep Work or Flow State
  - **Personality-Driven Messages**: 12+ unique messages per personality per insight type
  - **Context Awareness**: Detects test files, config, documentation, frontend, and backend code
- **Assistant States**: Each state now displays its corresponding sprite set:
  - `IDLE`: normal1.png → normal2.png (2 frames)
  - `FOCUSED`: pensar1.png → pensar4.png (4 frames)
  - `WARNING`: Fatiga1.png → fatiga4.png (4 frames)
  - `SUCCESS`: xp1.png → xp4.png (4 frames)
- **Visual Polish**: Updated aura effects and character animations to match the pixel-art style of the sprites.

### Configuration

New settings available:

```json
"focusPulse.assistant.personality": "motivador", // motivador | neutro | zen | humorístico
"focusPulse.assistant.flowProtection": true,
"focusPulse.assistant.contextualMessages": true
```

---

## [2.4.0] - 2026-01-30

### Added

- **Focus Pulse Assistant**: Your new virtual coding companion integrated into the dashboard.
- **Visual State Engine**: Implemented three distinct visual states for the assistant: `IDLE`, `FOCUSED`, and `WARNING`.
- **Intelligent Suggestion Engine**:
  - **Fatigue Logic**: Real-time suggestions to rest during long sessions.
  - **Drift Detection**: Alerts for excessive file switching (attention drift).
  - **Motivation System**: Positive reinforcement based on real-time focus stats.
- **Interactive Productivity Tips**: Click interaction to reveal productivity fun facts and history-based advice.
- **Event-Driven Alerts**: Real-time notifications for achievements, XP levels, and deep work streaks.

### Fixed

- **Dashboard Syntax Error**: Fixed `Uncaught SyntaxError` related to `document.write` during dashboard initialization.
- **Panel Persistence**: Resolved issue where the dashboard failed to establish HTML when reusing an existing panel.
- **Extension Host Communication**: Improved reliability when opening the refactored dashboard and setting the HTML content.

### Improved

- **Dashboard Architecture**: Refactored the `DashboardRenderer` to support the new `AssistantComponent` system.
- **Bidirectional Communication**: Enhanced the EventBus to handle specific message types for the assistant.

---

## [2.3.0] - 2026-01-28

### Added

- **Cloud Sync Engine**: Integration with VS Code Authentication to keep progress across multiple devices.
- **Data Portability**: New commands to manually Export and Import your data in JSON/XML formats.
- **Direct Access**: Added synchronization and backup buttons directly onto the Dashboard for faster management.
- **Smart Merge**: Advanced logic to combine local history with imported backups without losing data.

### Improved

- **UI Refactor**: Significant layout improvements for better readability and responsiveness.
- **Personalized Achievements**: Enhanced the badge system with custom unlocking logic and visual feedback.

---

## [2.2.0] - 2026-01-28

## Added

- Implemented personalized achievements and badges functionality.
- Refactoring in the UI

---

## [2.1.0] — 2026-01-23

### Major Refactor – Component Architecture

- **Dashboard** Fully component-based, replacing the 800-line monolithic HTML. Improved maintainability, responsiveness, and separation of UI/business logic.
- **Event System** New event-driven architecture with typed events and centralized error handling, replacing direct module calls.
- **State Management** Centralized, reactive state with automatic synchronization, replacing scattered global state.
- **Performance** Debounced and scheduled updates, 50–70% faster and non-blocking.
- **Developer Experience** New configurable entry point (extension-refactored.js), simplified debugging, full TypeScript type safety.
- **Backward Compatibility** All existing functionality preserved, legacy commands maintained, migration path provided.

### File Structure Highlights:

src/
├── extension-refactored.ts
├── dashboard-refactored.ts
├── events/
├── state/
├── utils/
└── webview/

### Impact:

- Modular, maintainable dashboard
- Fully decoupled event-driven system
- Unified state management
- 50–70% performance improvement
- 100% TypeScript type safety

---

## [2.0.0] — 2026-01-20

### Added

- **Deep Work mode** with status bar toggle and pill in the dashboard.
- XP integration with Deep Work (extra XP per completed deep session).
- New Deep Work achievements (first session, 5 sessions, 15 sessions…).
- **Weekly summary** section (total minutes per week + average focus).
- “View all” achievements panel with unlocked / locked (grey) states.

### Improved

- Internal structure of dashboard data (`deepWork`, `weeklySummary`, `allAchievements`, `goals`).
- Visual polish of the dashboard for the 2.0.0 release.

---

## [1.2.2] — 2026-01-19

### Improved

- Visual tweaks and small layout refinements in the dashboard.

---

## [1.2.0] — 2026-01-18

### Added

- Daily goals system (time + pomodoros).
- Historical export in JSON and CSV.
- New achievements based on days, weeks and consistency.
- Visual improvements in the dashboard (sections, copy, layout).
- XP integration with pomodoros.

### Improved

- Refactor of the achievement calculation.
- Type cleanup and internal structure.

---

## [1.1.0] — 2026-01-17

### Added

- Improved XP system (progression curve, bonuses, levels).
- Status bar showing `Lvl X · Focus Y`.
- Achievements linked to XP and level.
- Achievements panel in the dashboard.

### Improved

- Focus Score weights.
- Smooth animations in the dashboard.

---

## [1.0.0] — 2026-01-16

### Added

- Real-time dashboard built with Tailwind.
- Focus Score per file (time, edits, switches).
- Status bar with `Lvl X · Focus Y | time | edits`.
- XP + level system with progression curve.
- Daily history and active-streak tracking.
- Integrated Pomodoro (work/break) with XP bonus.
- Basic achievements: first focus, 20 min, 100+ edits, streaks, etc.
- Level/XP achievements (level 3, 5, 10…).
- Pomodoro-specific achievements (first block, 4 in a day, accumulated).

- Commands:
  - `Focus Pulse: Open dashboard`
  - `Focus Pulse: Show stats for current file`
  - `Focus Pulse: Start/Stop Pomodoro`
  - `Focus Pulse: Reset history and XP`

- Advanced configuration for Focus Score + Pomodoro.

---

## [0.4.0] — 2026-01-15

### Added

- First public version with dashboard, Pomodoro, XP and basic achievements.
