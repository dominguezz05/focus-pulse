# Changelog

All notable versions of **Focus Pulse**.

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
