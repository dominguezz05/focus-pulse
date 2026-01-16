import * as vscode from 'vscode';
import { getStatsArray } from './focusTracker';
import { getHistory, getLastDays, getStreakDays } from './storage';
import { computeAchievements } from './achievements';

function getDashboardHtml() {
    const data = getStatsArray();
    const history = getHistory();
    const last7 = getLastDays(7);
    const streak = getStreakDays();
    const achievements = computeAchievements(streak, history, data);

    const dataJson = JSON.stringify(data);
    const historyJson = JSON.stringify(last7);
    const achievementsJson = JSON.stringify(achievements);
    const streakJson = JSON.stringify(streak);

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Focus Pulse Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100">
    <div class="max-w-6xl mx-auto p-4 space-y-4">
        <header class="flex flex-col gap-1">
            <h1 class="text-2xl font-semibold flex items-center gap-2">
                <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    &#9889;
                </span>
                Focus Pulse Dashboard
            </h1>
            <p class="text-sm text-slate-400">
                Resumen de foco por archivo en esta sesión y métricas de productividad.
            </p>
        </header>

        <section class="grid gap-3 md:grid-cols-3">
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
                    <span id="last7-time" class="font-semibold">-</span> de trabajo
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
        </section>

        <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
            <div class="flex items-center justify-between mb-2">
                <h2 class="text-sm font-medium text-slate-200">Logros de hoy</h2>
                <span class="text-xs text-slate-400" id="achievements-count"></span>
            </div>
            <div id="achievements" class="flex flex-wrap gap-2 text-xs"></div>
        </section>

        <section id="cards" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"></section>

        <section class="bg-slate-800/60 rounded-xl border border-slate-700/60 overflow-hidden">
            <div class="px-4 py-2 border-b border-slate-700/70 flex items-center justify-between">
                <h2 class="text-sm font-medium text-slate-200">Detalle por archivo</h2>
                <span class="text-xs text-slate-400" id="summary-label"></span>
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
        const data = ${dataJson};
        const history7 = ${historyJson};
        const achievements = ${achievementsJson};
        const streak = ${streakJson};

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

        const cardsEl = document.getElementById('cards');
        const tableBodyEl = document.getElementById('table-body');
        const summaryLabelEl = document.getElementById('summary-label');
        const streakEl = document.getElementById('streak-value');
        const last7TimeEl = document.getElementById('last7-time');
        const last7ScoreEl = document.getElementById('last7-score');
        const filesTodayEl = document.getElementById('files-today');
        const achievementsEl = document.getElementById('achievements');
        const achievementsCountEl = document.getElementById('achievements-count');

        // Racha
        streakEl.textContent = streak + (streak === 1 ? ' día' : ' días');

        // Últimos 7 días
        if (!history7 || history7.length === 0) {
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
        filesTodayEl.textContent = data ? data.length : 0;

        // Logros
        if (!achievements || achievements.length === 0) {
            achievementsEl.innerHTML =
                '<span class="text-slate-400 text-xs">Sin logros todavía. Trabaja un poco más y vuelve a abrir el panel.</span>';
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

        if (!data || data.length === 0) {
            cardsEl.innerHTML = \`
                <div class="col-span-full bg-slate-800/60 rounded-xl border border-dashed border-slate-700/70 p-4">
                    <p class="text-sm font-medium text-slate-200">Sin datos todavía</p>
                    <p class="text-xs text-slate-400 mt-1">
                        Empieza a trabajar en uno o más archivos y vuelve a abrir el dashboard.
                    </p>
                </div>
            \`;
            summaryLabelEl.textContent = '0 archivos registrados';
        } else {
            summaryLabelEl.textContent =
                data.length + (data.length === 1 ? ' archivo' : ' archivos');

            const top = data.slice(0, 3);
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

            data.forEach(item => {
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
    </script>
</body>
</html>`;
}

export function openDashboard() {
    const panel = vscode.window.createWebviewPanel(
        'focusPulseDashboard',
        'Focus Pulse Dashboard',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );
    panel.webview.html = getDashboardHtml();
}
