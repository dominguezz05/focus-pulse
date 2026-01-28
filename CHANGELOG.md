# Changelog

All notable versions of **Focus Pulse**.

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
