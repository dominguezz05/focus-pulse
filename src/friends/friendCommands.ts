import * as vscode from "vscode";
import { FriendService } from "./FriendService";
import { getEventBus } from "../events";
import { FOCUS_EVENTS } from "../events/EventTypes";
import { getHistory } from "../storage";
import { getStreakDays } from "../storage";
import { getPomodoroStats } from "../pomodoro";
import { computeAchievements } from "../achievements";
import { computeXpState } from "../xp";

export function registerFriendCommands(
  context: vscode.ExtensionContext,
): void {
  const fs = FriendService.getInstance();
  fs.setContext(context);

  // ── Share Profile ──────────────────────────────────────────────────────

  const shareProfileCmd = vscode.commands.registerCommand(
    "focusPulse.shareProfile",
    async () => {
      try {
        const login = await fs.getAuthenticatedLogin();
        if (!login) {
          vscode.window.showErrorMessage(
            "Focus Pulse: No estás autenticado. Ejecuta 'Focus Pulse: Autenticar cuenta' primero.",
          );
          return;
        }

        // Gather stats to build profile
        const historyAll = getHistory();
        const pomodoroStats = getPomodoroStats();
        const streakDays = getStreakDays(historyAll);
        const streakCount = Array.isArray(streakDays)
          ? streakDays.length
          : streakDays;

        const xp = computeXpState(historyAll, pomodoroStats, undefined);

        // Compute unlocked achievements count
        const { getStatsArray } = require("../focusTracker");
        const statsArray = getStatsArray();
        const unlocked = computeAchievements(
          streakCount,
          historyAll,
          statsArray,
          undefined,
          pomodoroStats,
          undefined,
          undefined,
          context,
        );

        // Average score of last 7 days
        const last7 = historyAll
          .slice()
          .sort((a: any, b: any) => a.date.localeCompare(b.date))
          .slice(-7);
        const avgScore =
          last7.length > 0
            ? last7.reduce((sum: number, d: any) => sum + d.avgScore, 0) /
              last7.length
            : 0;

        // Total focus time (all history)
        const totalFocusTimeMs = historyAll.reduce(
          (sum: number, d: any) => sum + (d.totalTimeMs || 0),
          0,
        );

        const profile = fs.buildOwnProfile({
          githubLogin: login,
          level: xp.level,
          totalXp: xp.totalXp,
          totalFocusTimeMs,
          currentStreak: streakCount,
          totalPomodoros: pomodoroStats?.total || 0,
          totalAchievements: unlocked.length,
          avgScoreLast7Days: Math.round(avgScore * 10) / 10,
        });

        await fs.shareProfile(profile);

        vscode.window.showInformationMessage(
          `Focus Pulse: ¡Perfil compartido! Comparte tu nombre de usuario de GitHub (${login}) con tus amigos para que te añadan.`,
        );

        // Trigger dashboard refresh so friends tab can update
        const eventBus = getEventBus();
        eventBus.emit(FOCUS_EVENTS.DASHBOARD_REFRESH, { reason: "manual" });
      } catch (err) {
        vscode.window.showErrorMessage(
          `Focus Pulse: Error al compartir perfil — ${err}`,
        );
      }
    },
  );

  // ── Add Friend ─────────────────────────────────────────────────────────

  const addFriendCmd = vscode.commands.registerCommand(
    "focusPulse.addFriend",
    async () => {
      try {
        const mode = await vscode.window.showQuickPick(
          [
            { label: "Por nombre de usuario de GitHub", value: "username" },
            { label: "Por ID de gist", value: "gistId" },
          ],
          { placeHolder: "¿Cómo deseas añadir al amigo?" },
        );
        if (!mode) return;

        const placeholder =
          mode.value === "username"
            ? "Nombre de usuario de GitHub"
            : "ID del gist (ej: aa7a08...1b2c3d)";

        const value = await vscode.window.showInputBox({
          prompt: placeholder,
          placeHolder: placeholder,
          validateInput: (v) =>
            v && v.trim().length > 0 ? undefined : "Campo obligatorio",
        });
        if (!value) return;

        const trimmed = value.trim();

        if (mode.value === "username") {
          await fs.addFriendByUsername(trimmed);
          vscode.window.showInformationMessage(
            `Focus Pulse: ¡${trimmed} añadido como amigo!`,
          );
        } else {
          const entry = await fs.addFriendByGistId(trimmed);
          vscode.window.showInformationMessage(
            `Focus Pulse: ¡${entry.username} añadido como amigo!`,
          );
        }

        const eventBus = getEventBus();
        eventBus.emit(FOCUS_EVENTS.DASHBOARD_REFRESH, { reason: "manual" });
      } catch (err) {
        vscode.window.showErrorMessage(
          `Focus Pulse: Error al añadir amigo — ${err}`,
        );
      }
    },
  );

  // ── Remove Friend ──────────────────────────────────────────────────────

  const removeFriendCmd = vscode.commands.registerCommand(
    "focusPulse.removeFriend",
    async () => {
      try {
        const friends = fs.loadFriends();
        if (friends.length === 0) {
          vscode.window.showInformationMessage(
            "Focus Pulse: No tienes amigos añadidos.",
          );
          return;
        }

        const picked = await vscode.window.showQuickPick(
          friends.map((f) => ({
            label: f.username,
            description: f.cachedProfile
              ? `Nivel ${f.cachedProfile.level}`
              : "Sin datos",
          })),
          { placeHolder: "Selecciona el amigo a eliminar" },
        );
        if (!picked) return;

        const confirm = await vscode.window.showInformationMessage(
          `¿Eliminar a ${picked.label} de tu lista de amigos?`,
          "Sí",
          "No",
        );
        if (confirm !== "Sí") return;

        await fs.removeFriend(picked.label);
        vscode.window.showInformationMessage(
          `Focus Pulse: ${picked.label} ha sido eliminado.`,
        );

        const eventBus = getEventBus();
        eventBus.emit(FOCUS_EVENTS.DASHBOARD_REFRESH, { reason: "manual" });
      } catch (err) {
        vscode.window.showErrorMessage(
          `Focus Pulse: Error al eliminar amigo — ${err}`,
        );
      }
    },
  );

  context.subscriptions.push(shareProfileCmd, addFriendCmd, removeFriendCmd);
}
