import * as vscode from 'vscode';
import type { FocusSummary } from './focusTracker';
import type { HistoryDay } from './storage';
import type { Achievement } from './achievements';

interface DashboardData {
    stats: FocusSummary[];
    history7: HistoryDay[];
    streak: number;
    achievements: Achievement[];
}

let currentPanel: vscode.WebviewPanel | undefined;

function getHtml(): string {
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
        </section>

        <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
            <div class="flex items-center justify-between mb-2">
                <h2 class="text-sm font-medium text-slate-200">Logros de hoy</h2>
                <span class="text-xs text-slate-400" id="achievements-count">0 logros</span>
            </div>
            <div id="achievements" class="flex flex-wrap gap-2 text-xs">
                <span class="text-slate-400 text-xs">Sin datos todavía.</span>
            </div>
        </section>

        <section id="cards" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div class="col-span-full bg-slate-800/60 rounded-xl border border-dashed border-slate-700/70 p-4" id="no-data-card">
                <p class="text-sm font-medium text-slate-200">Sin datos todavía</p>
                <p class="text-xs text-slate-400 mt-1">
                    Empieza a trabajar en uno o más archivos y vuelve a abrir el dashboard.
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

        function render(data) {
            const stats = data.stats || [];
            const history7 = data.history7 || [];
            const streak = data.streak || 0;
            const achievements = data.achievements || [];

            // Racha
            streakEl.textContent = streak + (streak === 1 ? ' día' : ' días');

            // Últimos 7 días
            if (!history7.length) {
                last7TimeEl.textContent = '0s';
                last7ScoreEl.textContent = '-';
            } else {
                const totalMs = history7.reduce((a, h) => a + h.totalTimeMs, 0);
                const avgScore = history7.reduce((a, h) => a + h.avgScore, 0) / history7.length;
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

            // Tarjetas y tabla
            clearChildren(tableBodyEl);
            if (!stats.length) {
                if (noDataCardEl) noDataCardEl.classList.remove('hidden');
                summaryLabelEl.textContent = '0 archivos registrados';
                return;
            }

            if (noDataCardEl) noDataCardEl.classList.add('hidden');
            summaryLabelEl.textContent =
                stats.length + (stats.length === 1 ? ' archivo' : ' archivos');

            // Top 3
            // Primero borramos todas las tarjetas menos el placeholder (que ya está oculto)
            const cardChildren = Array.from(cardsEl.children).filter(el => el !== noDataCardEl);
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

            // Tabla
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
        currentPanel.reveal(vscode.ViewColumn.One);
        return;
    }

    currentPanel = vscode.window.createWebviewPanel(
        'focusPulseDashboard',
        'Focus Pulse Dashboard',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    currentPanel.webview.html = getHtml();

    currentPanel.onDidDispose(() => {
        currentPanel = undefined;
    }, null, context.subscriptions);
}

export function updateDashboard(data: DashboardData) {
    if (!currentPanel) return;
    currentPanel.webview.postMessage({
        type: 'stats:update',
        payload: data
    });
}
