import * as vscode from "vscode";
import type { FocusSummary } from "./focusTracker";
import type { HistoryDay } from "./storage";
import type { Achievement } from "./achievements";
import type { XpState, PomodoroStats } from "./xp";

interface DashboardData {
  stats: FocusSummary[];
  history7: HistoryDay[];
  streak: number;
  achievements: Achievement[];
  xp: XpState;
  pomodoroStats?: PomodoroStats;
  historyAll?: HistoryDay[];
  goals?: {
    enabled: boolean;
    targetMinutes: number;
    targetPomodoros: number;
    minutesDone: number;
    pomodorosDone: number;
    doneMinutes: boolean;
    donePomodoros: boolean;
    allDone: boolean;
  };
  allAchievements?: (Achievement & { unlocked: boolean })[];
}

let currentPanel: vscode.WebviewPanel | undefined;

function getHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Focus Pulse Dashboard</title>
    <script>
      const vscode = acquireVsCodeApi();
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100">
    <div class="max-w-6xl mx-auto p-4 space-y-4">
        <header class="flex flex-col gap-2">
            <div>
                <h1 class="text-2xl font-semibold flex items-center gap-2">
                    <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                        &#9889;
                    </span>
                    Focus Pulse Dashboard
                </h1>
                <p class="text-sm text-slate-400">
                    Resumen de foco por archivo en esta sesión, productividad reciente y progreso de nivel.
                </p>
            </div>

            <div class="flex items-center gap-3 text-xs text-slate-400">
                <div class="flex items-center gap-1">
                    <span class="uppercase tracking-wide">Nivel</span>
                    <span id="xp-level" class="text-sm font-semibold text-emerald-300">1</span>
                </div>
                <div class="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div id="xp-bar-inner" class="h-full bg-emerald-500 transition-all duration-300" style="width: 0%;"></div>
                </div>
                <span id="xp-label" class="text-[11px] text-slate-400">0 XP total</span>
            </div>
        </header>

        <!-- Bloque métricas rápidas + insights + export -->
        <section class="grid gap-3 md:grid-cols-4">
            <div class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
                <div class="text-xs uppercase tracking-wide text-slate-400 mb-1">Racha</div>
                <div class="text-2xl font-semibold" id="streak-value">0 días</div>
                <p class="text-xs text-slate-400 mt-1">
                    Días consecutivos con tiempo de foco registrado.
                </p>
            </div>
            <div class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
                <div class="text-xs uppercase tracking-wide text-slate-400 mb-1">Últimos 7 días</div>
                <div class="text-sm text-slate-200">
                    <span id="last7-time" class="font-semibold">0s</span> de trabajo
                </div>
                <div class="text-sm text-slate-200">
                    Media de foco: <span id="last7-score" class="font-semibold">-</span>/100
                </div>
                <p class="text-xs text-slate-400 mt-1">
                    Basado en sesiones registradas con Focus Pulse.
                </p>
            </div>
            <div class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
                <div class="text-xs uppercase tracking-wide text-slate-400 mb-1">Archivos hoy</div>
                <div class="text-2xl font-semibold" id="files-today">0</div>
                <p class="text-xs text-slate-400 mt-1">
                    Archivos con foco en esta sesión de VS Code.
                </p>
            </div>
            <div class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3 flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="text-xs uppercase tracking-wide text-slate-400 mb-1">Pomodoros</div>
                        <div class="text-sm text-slate-200">
                            Hoy: <span id="pomodoro-today" class="font-semibold">0</span>
                        </div>
                        <div class="text-sm text-slate-200">
                            Total: <span id="pomodoro-total" class="font-semibold">0</span>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1 items-end">
                        <button id="export-json-btn" class="px-2 py-1 rounded-md bg-slate-700/80 text-[11px] hover:bg-slate-600 transition">
                            Exportar JSON
                        </button>
                        <button id="export-csv-btn" class="px-2 py-1 rounded-md bg-slate-700/80 text-[11px] hover:bg-slate-600 transition">
                            Exportar CSV
                        </button>
                    </div>
                </div>
                <p class="text-[11px] text-slate-500">
                    Exporta tu histórico para analizarlo fuera (Notion, Excel, etc.).
                </p>
            </div>
        </section>
        <!-- Objetivo de hoy -->
        <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
            <div class="flex items-center justify-between mb-2">
                <h2 class="text-sm font-medium text-slate-200">🎯 Objetivo de hoy</h2>
                <span id="goal-status-label" class="text-xs text-slate-400">Sin objetivo configurado</span>
            </div>
            <div id="goal-content" class="space-y-2 text-xs text-slate-300">
                <p class="text-slate-500 text-xs">
                    Configura los objetivos diarios en las opciones de Focus Pulse.
                </p>
            </div>
        </section>

        <!-- Insights hoy vs ayer -->
        <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
            <div class="flex items-center justify-between mb-1">
                <h2 class="text-sm font-medium text-slate-200">Insights rápidos</h2>
            </div>
            <div id="insights" class="text-xs text-slate-300 space-y-1">
                <p class="text-slate-500 text-xs">Aún no hay suficientes datos para comparar días.</p>
            </div>
        </section>

        <!-- Heatmap -->
        <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
            <div class="flex items-center justify-between mb-2">
                <h2 class="text-sm font-medium text-slate-200">Heatmap de productividad (últimos 30 días)</h2>
                <span class="text-[11px] text-slate-500">Intensidad basada en minutos de foco</span>
            </div>
            <div id="heatmap" class="flex flex-col gap-1 text-[10px] text-slate-400"></div>
        </section>

       <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
  <div class="flex items-center justify-between mb-2">
    <h2 class="text-sm font-medium text-slate-200">Logros de hoy</h2>
    <div class="flex items-center gap-2">
      <span class="text-xs text-slate-400" id="achievements-count">0 logros</span>
      <button
        id="achievements-toggle"
        class="text-[11px] text-sky-400 hover:underline"
        type="button"
      >
        Ver todos
      </button>
    </div>
  </div>
  <div id="achievements" class="flex flex-wrap gap-2 text-xs">
    <span class="text-slate-400 text-xs">Sin datos todavía.</span>
  </div>
  <div
    id="all-achievements"
    class="mt-3 grid gap-2 sm:grid-cols-2 text-xs hidden"
  ></div>
</section>


        <section id="cards" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div class="col-span-full bg-slate-800/60 rounded-xl border border-dashed border-slate-700/70 p-4" id="no-data-card">
                <p class="text-sm font-medium text-slate-200">Sin datos todavía</p>
                <p class="text-xs text-slate-400 mt-1">
                    Empieza a trabajar en uno o más archivos y sigue editando para ver estadísticas en tiempo real.
                </p>
            </div>
        </section>

        <section class="bg-slate-800/60 rounded-xl border border-slate-700/60 overflow-hidden">
            <div class="px-4 py-2 border-b border-slate-700/70 flex items-center justify-between">
                <h2 class="text-sm font-medium text-slate-200">Detalle por archivo</h2>
                <span class="text-xs text-slate-400" id="summary-label">0 archivos registrados</span>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                    <thead class="bg-slate-800">
                        <tr class="text-left text-xs uppercase tracking-wide text-slate-400">
                            <th class="px-4 py-2">Archivo</th>
                            <th class="px-4 py-2">Puntuación</th>
                            <th class="px-4 py-2">Tiempo</th>
                            <th class="px-4 py-2">Ediciones</th>
                            <th class="px-4 py-2">Cambios</th>
                        </tr>
                    </thead>
                    <tbody id="table-body" class="divide-y divide-slate-800/80 bg-slate-900/40"></tbody>
                </table>
            </div>
        </section>
    </div>

    <script>
    let showAllAchievements = false;
        const cardsEl = document.getElementById('cards');
        const noDataCardEl = document.getElementById('no-data-card');
        const tableBodyEl = document.getElementById('table-body');
        const summaryLabelEl = document.getElementById('summary-label');
        const streakEl = document.getElementById('streak-value');
        const last7TimeEl = document.getElementById('last7-time');
        const last7ScoreEl = document.getElementById('last7-score');
        const filesTodayEl = document.getElementById('files-today');
        const achievementsEl = document.getElementById('achievements');
        const achievementsCountEl = document.getElementById('achievements-count');

        const xpLevelEl = document.getElementById('xp-level');
        const xpBarInnerEl = document.getElementById('xp-bar-inner');
        const xpLabelEl = document.getElementById('xp-label');

        const pomodoroTodayEl = document.getElementById('pomodoro-today');
        const pomodoroTotalEl = document.getElementById('pomodoro-total');

        const heatmapEl = document.getElementById('heatmap');
        const insightsEl = document.getElementById('insights');

        const exportJsonBtn = document.getElementById('export-json-btn');
        const exportCsvBtn = document.getElementById('export-csv-btn');

                const goalStatusLabelEl = document.getElementById('goal-status-label');
        const goalContentEl = document.getElementById('goal-content');
const achievementsToggleEl = document.getElementById("achievements-toggle");
const allAchievementsEl = document.getElementById("all-achievements");

if (achievementsToggleEl) {
  achievementsToggleEl.addEventListener("click", () => {
    showAllAchievements = !showAllAchievements;
    if (!allAchievementsEl) return;
    if (showAllAchievements) {
      allAchievementsEl.classList.remove("hidden");
      achievementsToggleEl.textContent = "Ocultar";
    } else {
      allAchievementsEl.classList.add("hidden");
      achievementsToggleEl.textContent = "Ver todos";
    }
  });
}


        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'export', format: 'json' });
            });
        }
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'export', format: 'csv' });
            });
        }

        function scoreColor(score) {
            if (score >= 80) return 'bg-emerald-500';
            if (score >= 50) return 'bg-amber-400';
            return 'bg-rose-500';
        }

        function scoreBadgeClasses(score) {
            if (score >= 80) return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
            if (score >= 50) return 'bg-amber-400/20 text-amber-300 border border-amber-400/40';
            return 'bg-rose-500/20 text-rose-300 border border-rose-500/40';
        }

        function formatMs(ms) {
            const m = Math.floor(ms / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            if (m === 0) return s + 's';
            return m + 'm ' + s + 's';
        }

        function clearChildren(el) {
            while (el.firstChild) el.removeChild(el.firstChild);
        }

        function buildHeatmap(historyAll) {
            clearChildren(heatmapEl);
            if (!historyAll || !historyAll.length) {
                const p = document.createElement('p');
                p.className = 'text-[11px] text-slate-500';
                p.textContent = 'Todavía no hay suficiente histórico para mostrar el heatmap.';
                heatmapEl.appendChild(p);
                return;
            }

            // últimos 30 días
            const sorted = historyAll.slice().sort((a, b) => a.date.localeCompare(b.date));
            const last30 = sorted.slice(-30);
            if (!last30.length) return;

            const maxMs = last30.reduce((max, d) => Math.max(max, d.totalTimeMs), 0) || 1;

            const row = document.createElement('div');
            row.className = 'flex flex-wrap gap-1';

            last30.forEach(day => {
                const level = day.totalTimeMs / maxMs; // 0..1
                let bg = 'bg-slate-800';
                if (level > 0 && level <= 0.25) bg = 'bg-sky-900';
                else if (level <= 0.5) bg = 'bg-sky-700';
                else if (level <= 0.75) bg = 'bg-sky-500';
                else if (level > 0.75) bg = 'bg-sky-400';

                const cell = document.createElement('div');
                cell.className = 'w-4 h-4 rounded-sm ' + bg + ' cursor-default';
                cell.title =
                    day.date +
                    '\\n' +
                    'Tiempo: ' +
                    formatMs(day.totalTimeMs) +
                    '\\nScore medio: ' +
                    Math.round(day.avgScore);

                row.appendChild(cell);
            });

            heatmapEl.appendChild(row);
        }

        function buildInsights(historyAll) {
            clearChildren(insightsEl);

            if (!historyAll || historyAll.length < 2) {
                const p = document.createElement('p');
                p.className = 'text-slate-500 text-xs';
                p.textContent = 'Aún no hay suficientes días para comparar (mínimo 2).';
                insightsEl.appendChild(p);
                return;
            }

            const sorted = historyAll.slice().sort((a, b) => a.date.localeCompare(b.date));
            const today = sorted[sorted.length - 1];
            const yesterday = sorted[sorted.length - 2];

            const todayMin = today.totalTimeMs / 60000;
            const yesterdayMin = yesterday.totalTimeMs / 60000;

            const diffMin = todayMin - yesterdayMin;
            const diffPct = yesterdayMin > 0 ? (diffMin / yesterdayMin) * 100 : 0;

            const p1 = document.createElement('p');
            const arrow = diffMin > 0 ? '↑' : diffMin < 0 ? '↓' : '→';
            const trendClass =
                diffMin > 0 ? 'text-emerald-300' : diffMin < 0 ? 'text-rose-300' : 'text-slate-300';

            p1.innerHTML =
                'Hoy has trabajado <span class="' +
                trendClass +
                '">' +
                arrow +
                ' ' +
                Math.round(Math.abs(diffMin)) +
                ' min</span> ' +
                (diffMin >= 0 ? 'más' : 'menos') +
                ' que ayer.';

            const p2 = document.createElement('p');
            const scoreDiff = today.avgScore - yesterday.avgScore;
            const scoreArrow = scoreDiff > 0 ? '↑' : scoreDiff < 0 ? '↓' : '→';
            const scoreClass =
                scoreDiff > 0 ? 'text-emerald-300' : scoreDiff < 0 ? 'text-rose-300' : 'text-slate-300';

            p2.innerHTML =
                'Tu foco medio ha ' +
                (scoreDiff > 0 ? 'mejorado' : scoreDiff < 0 ? 'bajado' : 'quedado igual') +
                ': <span class="' +
                scoreClass +
                '">' +
                scoreArrow +
                ' ' +
                Math.round(Math.abs(scoreDiff)) +
                '</span> puntos frente a ayer.';

            insightsEl.appendChild(p1);
            insightsEl.appendChild(p2);
        }
                          function buildGoals(goals) {
            if (!goalStatusLabelEl || !goalContentEl) return;

            if (!goals || !goals.enabled) {
                goalStatusLabelEl.textContent = 'Objetivos desactivados';
                goalContentEl.innerHTML =
                    '<p class="text-slate-500 text-xs">Activa los objetivos diarios en la configuración de Focus Pulse.</p>';
                return;
            }

            const min = Math.round(goals.minutesDone);
            const targetMin = goals.targetMinutes;
            const pom = goals.pomodorosDone;
            const targetPom = goals.targetPomodoros;

            const pctMin = Math.max(0, Math.min(100, (min / targetMin) * 100));
            const pctPom = targetPom > 0
                ? Math.max(0, Math.min(100, (pom / targetPom) * 100))
                : 100;

            goalStatusLabelEl.textContent = goals.allDone
                ? '✅ Objetivo completado'
                : 'En progreso';

            goalContentEl.innerHTML =
                '<div class="space-y-1.5">' +
                    '<div class="flex items-center justify-between">' +
                        '<span>Minutos de foco</span>' +
                        '<span class="text-slate-200 font-semibold">' + min + '/' + targetMin + ' min</span>' +
                    '</div>' +
                    '<div class="w-full h-2 rounded-full bg-slate-700 overflow-hidden">' +
                        '<div class="h-full bg-sky-500 transition-all" style="width: ' + pctMin + '%;"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="space-y-1.5 mt-2">' +
                    '<div class="flex items-center justify-between">' +
                        '<span>Pomodoros</span>' +
                        '<span class="text-slate-200 font-semibold">' + pom + '/' + targetPom + '</span>' +
                    '</div>' +
                    '<div class="w-full h-2 rounded-full bg-slate-700 overflow-hidden">' +
                        '<div class="h-full bg-emerald-500 transition-all" style="width: ' + pctPom + '%;"></div>' +
                    '</div>' +
                '</div>' +
                (goals.allDone
                    ? '<p class="text-[11px] text-emerald-300 mt-2">Has cumplido el objetivo de hoy. Buen trabajo 👏</p>'
                    : '<p class="text-[11px] text-slate-500 mt-2">Completa ambos objetivos para cerrar el día.</p>');
        }


function buildAllAchievements(all) {
  if (!allAchievementsEl) return;
  clearChildren(allAchievementsEl);

  if (!all || !all.length) {
    const p = document.createElement("p");
    p.className = "text-[11px] text-slate-500";
    p.textContent =
      "Todavía no hay catálogo de logros disponible.";
    allAchievementsEl.appendChild(p);
    return;
  }

  all.forEach((a) => {
    const div = document.createElement("div");
    const base =
      "px-2 py-1 rounded-lg border text-[11px] flex flex-col gap-0.5";

    if (a.unlocked) {
      div.className =
        base +
        " border-emerald-500/60 bg-emerald-500/10 text-emerald-200";
    } else {
      div.className =
        base +
        " border-slate-700 bg-slate-900/80 text-slate-500";
    }

    div.innerHTML =
      '<span class="font-semibold">' +
      a.title +
      "</span>" +
      '<span class="text-[10px] opacity-80">' +
      a.description +
      "</span>";

    allAchievementsEl.appendChild(div);
  });
}

        function render(data) {
            const stats = data.stats || [];
            const history7 = data.history7 || [];
            const historyAll = data.historyAll || [];
            const streak = data.streak || 0;
            const achievements = data.achievements || [];
            const xp = data.xp || {
                totalXp: 0,
                level: 1,
                xpInLevel: 0,
                xpToNext: 100
            };
            const goals = data.goals;
const allAchievements = data.allAchievements || [];

            const pomodoroStats = data.pomodoroStats || { today: 0, total: 0 };

            // XP / nivel
            if (xpLevelEl && xpBarInnerEl && xpLabelEl) {
                xpLevelEl.textContent = String(xp.level);
                const pct =
                    xp.xpToNext > 0
                        ? Math.max(0, Math.min(100, (xp.xpInLevel / xp.xpToNext) * 100))
                        : 0;
                xpBarInnerEl.style.width = pct.toFixed(1) + '%';
                xpLabelEl.textContent = Math.round(xp.totalXp) + ' XP total';
            }

            // Pomodoros
            if (pomodoroTodayEl && pomodoroTotalEl) {
                pomodoroTodayEl.textContent = String(pomodoroStats.today || 0);
                pomodoroTotalEl.textContent = String(pomodoroStats.total || 0);
            }

            // Racha
            streakEl.textContent = streak + (streak === 1 ? ' día' : ' días');

            // Últimos 7 días
            if (!history7.length) {
                last7TimeEl.textContent = '0s';
                last7ScoreEl.textContent = '-';
            } else {
                const totalMs = history7.reduce((a, h) => a + h.totalTimeMs, 0);
                const avgScore =
                    history7.reduce((a, h) => a + h.avgScore, 0) / history7.length;
                last7TimeEl.textContent = formatMs(totalMs);
                last7ScoreEl.textContent = Math.round(avgScore);
            }

            // Archivos de hoy
            filesTodayEl.textContent = stats.length;

            // Logros
            clearChildren(achievementsEl);
            if (!achievements.length) {
                achievementsEl.innerHTML =
                    '<span class="text-slate-400 text-xs">Sin logros todavía. Trabaja un poco más y sigue revisando.</span>';
                achievementsCountEl.textContent = '0 logros';
            } else {
                achievementsCountEl.textContent =
                    achievements.length + (achievements.length === 1 ? ' logro' : ' logros');
                achievements.forEach(a => {
                    const span = document.createElement('span');
                    span.className =
                        'inline-flex flex-col gap-0.5 rounded-lg border border-emerald-600/50 bg-emerald-500/10 px-2 py-1';
                    span.innerHTML =
                        '<span class="text-[11px] font-semibold text-emerald-300">' +
                        a.title +
                        '</span><span class="text-[10px] text-emerald-200/80">' +
                        a.description +
                        '</span>';
                    achievementsEl.appendChild(span);
                });
            }

            // Heatmap + insights
            buildHeatmap(historyAll);
            buildInsights(historyAll);
buildGoals(goals);
buildAllAchievements(allAchievements);

if (!showAllAchievements && allAchievementsEl) {
  allAchievementsEl.classList.add("hidden");
}

            // Tabla y tarjetas
            clearChildren(tableBodyEl);

            if (!stats.length) {
                if (noDataCardEl) noDataCardEl.classList.remove('hidden');
                summaryLabelEl.textContent = '0 archivos registrados';
                return;
            }

            if (noDataCardEl) noDataCardEl.classList.add('hidden');
            summaryLabelEl.textContent =
                stats.length + (stats.length === 1 ? ' archivo' : ' archivos');

            const cardChildren = Array.from(cardsEl.children).filter(
                el => el !== noDataCardEl
            );
            cardChildren.forEach(el => cardsEl.removeChild(el));

            const top = stats.slice(0, 3);
            top.forEach((item, index) => {
                const color = scoreColor(item.score);
                const badgeClasses = scoreBadgeClasses(item.score);
                const rank = index + 1;

                const div = document.createElement('div');
                div.className =
                    'bg-slate-800/70 rounded-xl border border-slate-700/70 p-3 flex flex-col gap-2 shadow-sm';

                div.innerHTML = \`
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <div class="text-[10px] uppercase tracking-wide text-slate-400">Top \${rank}</div>
                            <div class="text-sm font-medium text-slate-100 truncate">\${item.fileName}</div>
                        </div>
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold \${badgeClasses}">
                            \${item.score}/100
                        </span>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Tiempo: <span class="text-slate-200">\${item.timeText}</span></span>
                        <span>Ediciones: <span class="text-slate-200">\${item.edits}</span></span>
                        <span>Cambios: <span class="text-slate-200">\${item.switches}</span></span>
                    </div>
                    <div class="mt-1.5">
                        <div class="w-full h-2 rounded-full bg-slate-700/80 overflow-hidden">
                            <div class="h-full rounded-full \${color}" style="width: \${item.score}%;"></div>
                        </div>
                    </div>
                \`;

                cardsEl.appendChild(div);
            });

            stats.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-800/80 transition-colors';

                tr.innerHTML = \`
                    <td class="px-4 py-2 text-slate-100 whitespace-nowrap max-w-xs truncate">
                        \${item.fileName}
                    </td>
                    <td class="px-4 py-2">
                        <span class="inline-flex items-center gap-1">
                            <span class="inline-block w-6 text-slate-100">\${item.score}</span>
                            <span class="h-1.5 w-16 rounded-full bg-slate-700 overflow-hidden">
                                <span class="block h-full bg-emerald-500" style="width: \${item.score}%;"></span>
                            </span>
                        </span>
                    </td>
                    <td class="px-4 py-2 text-slate-100">\${item.timeText}</td>
                    <td class="px-4 py-2 text-slate-100">\${item.edits}</td>
                    <td class="px-4 py-2 text-slate-100">\${item.switches}</td>
                \`;

                tableBodyEl.appendChild(tr);
            });
        }

        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (!msg || msg.type !== 'stats:update') return;
            render(msg.payload || {});
        });
    </script>
</body>
</html>`;
}

export function openDashboard(context: vscode.ExtensionContext) {
  if (currentPanel) {
    currentPanel.webview.html = getHtml();
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    "focusPulseDashboard",
    "Focus Pulse Dashboard",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  currentPanel.webview.html = getHtml();

  currentPanel.webview.onDidReceiveMessage(
    async (msg) => {
      if (!msg || msg.type !== "export") return;

      const format = msg.format === "csv" ? "csv" : "json";
      const uri = await vscode.window.showSaveDialog({
        filters: format === "json" ? { JSON: ["json"] } : { CSV: ["csv"] },
        saveLabel: "Exportar",
      });
      if (!uri) return;

      await vscode.commands.executeCommand("focusPulse.exportData", {
        format,
        target: uri,
      });
    },
    undefined,
    context.subscriptions,
  );

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
    },
    null,
    context.subscriptions,
  );
}

export function updateDashboard(data: DashboardData) {
  if (!currentPanel) return;
  currentPanel.webview.postMessage({
    type: "stats:update",
    payload: data,
  });
}
