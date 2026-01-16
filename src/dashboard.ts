import * as vscode from 'vscode';
import { getStatsArray } from './focusTracker';

function getDashboardHtml() {
    const data = getStatsArray();
    const dataJson = JSON.stringify(data);

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Focus Pulse Dashboard</title>
    <!-- Tailwind CDN (simple y rápido para el webview) -->
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100">
    <div class="max-w-5xl mx-auto p-4 space-y-4">
        <header>
            <h1 class="text-2xl font-semibold flex items-center gap-2">
                <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    &#9889;
                </span>
                Focus Pulse Dashboard
            </h1>
            <p class="text-sm text-slate-400 mt-1">
                Resumen de foco por archivo en esta sesión de VS Code.
            </p>
        </header>

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

        const cardsEl = document.getElementById('cards');
        const tableBodyEl = document.getElementById('table-body');
        const summaryLabelEl = document.getElementById('summary-label');

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
            summaryLabelEl.textContent = data.length + (data.length === 1 ? ' archivo' : ' archivos');

            // Tarjetas: top 3 por puntuación
            const top = data.slice(0, 3);
            top.forEach((item, index) => {
                const color = scoreColor(item.score);
                const badgeClasses = scoreBadgeClasses(item.score);
                const rank = index + 1;

                const div = document.createElement('div');
                div.className = 'bg-slate-800/70 rounded-xl border border-slate-700/70 p-3 flex flex-col gap-2 shadow-sm';

                div.innerHTML = \`
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <div class="text-xs uppercase tracking-wide text-slate-400">Top \${rank}</div>
                            <div class="text-sm font-medium text-slate-100 truncate">\${item.fileName}</div>
                        </div>
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold \${badgeClasses}">
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

            // Tabla completa
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
