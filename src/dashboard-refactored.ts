import * as vscode from "vscode";
import { DashboardData } from "./webview/types";
import { DashboardRenderer } from "./webview/DashboardRenderer";
import { getStateManager } from "./state/StateManager";
import { getEventBus } from "./events";
import { FOCUS_EVENTS } from "./events/EventTypes";
import { debounceDashboardUpdate } from "./utils/Debouncer";
import { openDashboard, updateDashboard } from "./dashboard";
import {
  handleEditorChange,
  handleTextDocumentChange,
  getCurrentStats,
  computeFocusScore,
  formatMinutes,
  getStatsArray,
  FocusSummary,
  resetFocusStats,
} from "./focusTracker";
import {
  initStorage,
  updateHistoryFromStats,
  getLastDays,
  getStreakDays,
  getHistory,
  clearHistory,
  HistoryDay,
} from "./storage";
import { initPomodoro, togglePomodoro, getPomodoroStats } from "./pomodoro";
import {
  computeAchievements,
  getAllAchievementsDefinitions,
} from "./achievements";
import { computeXpState, PomodoroStats } from "./xp";
import { DailyGoalProgress } from "./goals";
import {
  initDeepWork,
  toggleDeepWork,
  checkDeepWorkCompletion,
  getDeepWorkState,
  DeepWorkState,
} from "./deepWork";
import type { DeepWorkState as StateTypesDeepWorkState } from "./state/StateTypes";

let currentPanel: vscode.WebviewPanel | undefined;

// Type guard to distinguish between DeepWorkState types
function isStateTypesDeepWorkState(obj: any): obj is StateTypesDeepWorkState {
  return obj && typeof obj === 'object' && 'startTime' in obj && 'expectedDuration' in obj && 'score' in obj;
}

// Convert StateTypes.DeepWorkState to deepWork.DeepWorkState
function convertToDeepWorkState(state: StateTypesDeepWorkState): DeepWorkState {
  return {
    active: state.active,
    startedAt: state.startTime,
    durationMinutes: state.expectedDuration || 60,
    completedSessions: Math.floor(state.score) // Using score as proxy for completed sessions
  };
}

function getRefactoredHtml(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Focus Pulse Dashboard v2.1</title>
    <script>
      const vscode = acquireVsCodeApi();
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100">
    <div id="dashboard-root"></div>
    
    <script>
        // Import the component-based renderer
        // In a real implementation, we'd bundle these with webpack/vite
        // For now, we'll create a simple version that matches the new architecture
        
        class RefactoredDashboardRenderer {
            constructor() {
                this.components = new Map();
                this.state = {};
            }
            
            init() {
                this.setupComponents();
                this.setupEventListeners();
                this.requestInitialData();
            }
            
            setupComponents() {
                const root = document.getElementById('dashboard-root');
                if (!root) return;
                
                root.innerHTML = \`
                    <div class="max-w-6xl mx-auto p-4 space-y-4">
                        <!-- Header Component -->
                        <header class="flex flex-col gap-2" id="header-container">
                            <div>
                                <h1 class="text-2xl font-semibold flex items-center gap-2">
                                    <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                                        ⚡
                                    </span>
                                    Focus Pulse Dashboard v2.1
                                </h1>
                                <p class="text-sm text-slate-400">
                                    Dashboard con arquitectura de componentes refactorizada.
                                </p>
                            </div>
                            
                            <div class="flex items-center gap-3 text-xs text-slate-400" id="xp-container">
                                <div class="flex items-center gap-1">
                                    <span class="uppercase tracking-wide">Nivel</span>
                                    <span id="xp-level" class="text-sm font-semibold text-emerald-300">1</span>
                                </div>
                                <div class="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                                    <div id="xp-bar-inner" class="h-full bg-emerald-500 transition-all duration-300" style="width: 0%;"></div>
                                </div>
                                <span id="xp-label" class="text-[11px] text-slate-400">0 XP total</span>
                            </div>
                            <div id="deepwork-pill" class="text-[11px] text-slate-500"></div>
                        </header>
                        
                        <!-- Metrics Grid -->
                        <section class="grid gap-3 md:grid-cols-4" id="metrics-container">
                            <div class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
                                <div class="text-xs uppercase tracking-wide text-slate-400 mb-1">Racha</div>
                                <div class="text-2xl font-semibold" id="streak-value">0 días</div>
                                <p class="text-xs text-slate-400 mt-1">Días consecutivos con tiempo de foco registrado.</p>
                            </div>
                            <div class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
                                <div class="text-xs uppercase tracking-wide text-slate-400 mb-1">Últimos 7 días</div>
                                <div class="text-sm text-slate-200">
                                    <span id="last7-time" class="font-semibold">0s</span> de trabajo
                                </div>
                                <div class="text-sm text-slate-200">
                                    Media de foco: <span id="last7-score" class="font-semibold">-</span>/100
                                </div>
                                <p class="text-xs text-slate-400 mt-1">Basado en sesiones registradas con Focus Pulse.</p>
                            </div>
                            <div class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
                                <div class="text-xs uppercase tracking-wide text-slate-400 mb-1">Archivos hoy</div>
                                <div class="text-2xl font-semibold" id="files-today">0</div>
                                <p class="text-xs text-slate-400 mt-1">Archivos con foco en esta sesión de VS Code.</p>
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
                                <p class="text-[11px] text-slate-500">Exporta tu histórico para analizarlo fuera (Notion, Excel, etc.).</p>
                            </div>
                        </section>
                        
                        <!-- Goals Component -->
                        <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3" id="goals-container">
                            <div class="flex items-center justify-between mb-2">
                                <h2 class="text-sm font-medium text-slate-200">🎯 Objetivo de hoy</h2>
                                <span id="goal-status-label" class="text-xs text-slate-400">Sin objetivo configurado</span>
                            </div>
                            <div id="goal-content" class="space-y-2 text-xs text-slate-300">
                                <p class="text-slate-500 text-xs">Configura los objetivos diarios en las opciones de Focus Pulse.</p>
                            </div>
                        </section>
                        
                        <!-- Insights Component -->
                        <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3" id="insights-container">
                            <div class="flex items-center justify-between mb-1">
                                <h2 class="text-sm font-medium text-slate-200">Insights rápidos</h2>
                            </div>
                            <div id="insights" class="text-xs text-slate-300 space-y-1">
                                <p class="text-slate-500 text-xs">Aún no hay suficientes datos para comparar días.</p>
                            </div>
                        </section>
                        
                        <!-- Heatmap Component -->
                        <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3" id="heatmap-container">
                            <div class="flex items-center justify-between mb-2">
                                <h2 class="text-sm font-medium text-slate-200">Heatmap de productividad (últimos 30 días)</h2>
                                <span class="text-[11px] text-slate-500">Intensidad basada en minutos de foco</span>
                            </div>
                            <div id="heatmap" class="flex flex-col gap-1 text-[10px] text-slate-400"></div>
                        </section>
                        
                        <!-- Weekly Summary Component -->
                        <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3" id="weekly-container">
                            <div class="flex items-center justify-between mb-2">
                                <h2 class="text-sm font-medium text-slate-200">Resumen semanal</h2>
                                <span class="text-[11px] text-slate-500">Minutos totales por semana</span>
                            </div>
                            <div id="weekly-summary" class="space-y-1 text-[11px] text-slate-300">
                                <p class="text-slate-500 text-xs">Todavía no hay datos suficientes.</p>
                            </div>
                        </section>
                        
                        <!-- Achievements Component -->
                        <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3" id="achievements-container">
                            <div class="flex items-center justify-between mb-2">
                                <h2 class="text-sm font-medium text-slate-200">Logros de hoy</h2>
                                <div class="flex items-center gap-2">
                                    <span class="text-xs text-slate-400" id="achievements-count">0 logros</span>
                                    <button id="achievements-toggle" class="text-[11px] text-sky-400 hover:underline" type="button">
                                        Ver todos
                                    </button>
                                </div>
                            </div>
                            <div id="achievements" class="flex flex-wrap gap-2 text-xs">
                                <span class="text-slate-400 text-xs">Sin datos todavía.</span>
                            </div>
                            <div id="all-achievements" class="mt-3 grid gap-2 sm:grid-cols-2 text-xs hidden"></div>
                        </section>
                        
                        <!-- Table Component -->
                        <section class="bg-slate-800/60 rounded-xl border border-slate-700/60 overflow-hidden" id="table-container">
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
                                            <th class="px-4 py-2">Δ texto</th>
                                            <th class="px-4 py-2">Cambios</th>
                                        </tr>
                                    </thead>
                                    <tbody id="table-body" class="divide-y divide-slate-800/80 bg-slate-900/40"></tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                \`;
            }
            
            setupEventListeners() {
                var self = this;
                // Export buttons
                document.getElementById('export-json-btn').addEventListener('click', function() {
                    vscode.postMessage({ type: 'export', format: 'json' });
                });
                
                document.getElementById('export-csv-btn').addEventListener('click', function() {
                    vscode.postMessage({ type: 'export', format: 'csv' });
                });
                
                // Achievements toggle
                var showAllAchievements = false;
                document.getElementById('achievements-toggle').addEventListener('click', function() {
                    showAllAchievements = !showAllAchievements;
                    var allAchievementsEl = document.getElementById('all-achievements');
                    var toggleBtn = document.getElementById('achievements-toggle');
                    
                    if (showAllAchievements) {
                        allAchievementsEl.classList.remove('hidden');
                        if (toggleBtn) toggleBtn.textContent = 'Ocultar';
                    } else {
                        allAchievementsEl.classList.add('hidden');
                        if (toggleBtn) toggleBtn.textContent = 'Ver todos';
                    }
                });
            }
            
            requestInitialData() {
                vscode.postMessage({ type: 'requestData' });
            }
            
            updateData(data) {
                // Update XP
                if (data.xp) {
                    var levelEl = document.getElementById('xp-level');
                    var barEl = document.getElementById('xp-bar-inner');
                    var labelEl = document.getElementById('xp-label');
                    
                    if (levelEl) levelEl.textContent = data.xp.level;
                    if (barEl) {
                        var pct = data.xp.xpToNext > 0 
                            ? Math.max(0, Math.min(100, (data.xp.xpInLevel / data.xp.xpToNext) * 100))
                            : 0;
                        barEl.style.width = pct.toFixed(1) + '%';
                    }
                    if (labelEl) labelEl.textContent = Math.round(data.xp.totalXp) + ' XP total';
                }
                
                // Update Deep Work
                if (data.deepWork) {
                    const deepWorkEl = document.getElementById('deepwork-pill');
                    if (deepWorkEl) {
                        if (data.deepWork.active) {
                            deepWorkEl.textContent = '🧠 Deep Work activo';
                            deepWorkEl.className = 'text-[11px] text-emerald-300 mt-1';
                        } else {
                            deepWorkEl.textContent = 'Deep Work inactivo (pulsa en la barra de estado para iniciar)';
                            deepWorkEl.className = 'text-[11px] text-slate-500 mt-1';
                        }
                    }
                }
                
                // Update metrics
                if (data.streak !== undefined) {
                    const streakEl = document.getElementById('streak-value');
                    if (streakEl) {
                        streakEl.textContent = data.streak + (data.streak === 1 ? ' día' : ' días');
                    }
                }
                
                if (data.history7) {
                    const timeEl = document.getElementById('last7-time');
                    const scoreEl = document.getElementById('last7-score');
                    
                    if (data.history7.length > 0) {
                        const totalMs = data.history7.reduce((a, h) => a + h.totalTimeMs, 0);
                        const avgScore = data.history7.reduce((a, h) => a + h.avgScore, 0) / data.history7.length;
                        
                        if (timeEl) timeEl.textContent = this.formatMs(totalMs);
                        if (scoreEl) scoreEl.textContent = Math.round(avgScore);
                    }
                }
                
                if (data.stats) {
                    const filesEl = document.getElementById('files-today');
                    const summaryLabelEl = document.getElementById('summary-label');
                    
                    if (filesEl) filesEl.textContent = data.stats.length;
                    if (summaryLabelEl) {
                        summaryLabelEl.textContent = data.stats.length + (data.stats.length === 1 ? ' archivo' : ' archivos');
                    }
                    
                    // Update table
                    const tableBody = document.getElementById('table-body');
                    if (tableBody) {
                        tableBody.innerHTML = '';
                        data.stats.forEach((item) => {
                            const tr = document.createElement('tr');
                            tr.className = 'hover:bg-slate-800/80 transition-colors';
                            tr.innerHTML = 
                                '<td class="px-4 py-2 text-slate-100 whitespace-nowrap max-w-xs truncate">' + item.fileName + '</td>' +
                                '<td class="px-4 py-2">' +
                                    '<span class="inline-flex items-center gap-1">' +
                                        '<span class="inline-block w-6 text-slate-100">' + item.score + '</span>' +
                                        '<span class="h-1.5 w-16 rounded-full bg-slate-700 overflow-hidden">' +
                                            '<span class="block h-full bg-emerald-500" style="width: ' + item.score + '%;"></span>' +
                                        '</span>' +
                                    '</span>' +
                                '</td>' +
                                '<td class="px-4 py-2 text-slate-100">' + item.timeText + '</td>' +
                                '<td class="px-4 py-2 text-slate-100">' + item.edits + '</td>' +
                                '<td class="px-4 py-2 text-slate-100">' +
                                    '<span class="text-emerald-300">+' + item.added + '</span>' +
                                    '<span class="text-slate-500 mx-1">/</span>' +
                                    '<span class="text-rose-300">-' + item.deleted + '</span>' +
                                '</td>' +
                                '<td class="px-4 py-2 text-slate-100">' + item.switches + '</td>';
                            tableBody.appendChild(tr);
                        });
                    }
                }
                
                if (data.pomodoroStats) {
                    const todayEl = document.getElementById('pomodoro-today');
                    const totalEl = document.getElementById('pomodoro-total');
                    
                    if (todayEl) todayEl.textContent = data.pomodoroStats.today || 0;
                    if (totalEl) totalEl.textContent = data.pomodoroStats.total || 0;
                }
                
                // Update goals
                if (data.goals) {
                    const goals = data.goals;
                    const statusEl = document.getElementById('goal-status-label');
                    const contentEl = document.getElementById('goal-content');
                    
                    if (statusEl && contentEl) {
                        if (!goals.enabled) {
                            statusEl.textContent = 'Objetivos desactivados';
                            contentEl.innerHTML = '<p class="text-slate-500 text-xs">Activa los objetivos diarios en la configuración de Focus Pulse.</p>';
                        } else {
                            const min = Math.round(goals.minutesDone);
                            const targetMin = goals.targetMinutes;
                            const pom = goals.pomodorosDone;
                            const targetPom = goals.targetPomodoros;
                            
                            const pctMin = Math.max(0, Math.min(100, (min / targetMin) * 100));
                            const pctPom = targetPom > 0 ? Math.max(0, Math.min(100, (pom / targetPom) * 100)) : 100;
                            
                            statusEl.textContent = goals.allDone ? '✅ Objetivo completado' : 'En progreso';
                            contentEl.innerHTML = 
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
                                    : '<p class="text-[11px] text-slate-500 mt-2">Completa ambos objetivos para cerrar el día.</p>'
                                );
                        }
                    }
                }
                
                if (data.historyAll && data.achievements && data.allAchievements) {
                    this.updateInsights(data);
                    this.updateHeatmap(data);
                    this.updateAchievements(data);
                }
                
                if (data.weeklySummary) {
                    this.updateWeeklySummary(data);
                }
            }
            
            updateInsights(data) {
                const insightsEl = document.getElementById('insights');
                if (!insightsEl || !data.historyAll || data.historyAll.length < 2) {
                    if (insightsEl) {
                        insightsEl.innerHTML = '<p class="text-slate-500 text-xs">Aún no hay suficientes días para comparar (mínimo 2).</p>';
                    }
                    return;
                }
                
                const sorted = data.historyAll.slice().sort((a, b) => a.date.localeCompare(b.date));
                const today = sorted[sorted.length - 1];
                const yesterday = sorted[sorted.length - 2];
                
                const todayMin = today.totalTimeMs / 60000;
                const yesterdayMin = yesterday.totalTimeMs / 60000;
                const diffMin = todayMin - yesterdayMin;
                
                const scoreDiff = today.avgScore - yesterday.avgScore;
                
                const arrow = diffMin > 0 ? '↑' : diffMin < 0 ? '↓' : '→';
                const trendClass = diffMin > 0 ? 'text-emerald-300' : diffMin < 0 ? 'text-rose-300' : 'text-slate-300';
                const scoreArrow = scoreDiff > 0 ? '↑' : scoreDiff < 0 ? '↓' : '→';
                const scoreClass = scoreDiff > 0 ? 'text-emerald-300' : scoreDiff < 0 ? 'text-rose-300' : 'text-slate-300';
                
                insightsEl.innerHTML = 
                    '<p>' +
                        'Hoy has trabajado <span class="' + trendClass + '">' + arrow + ' ' + Math.round(Math.abs(diffMin)) + ' min</span> ' +
                        (diffMin >= 0 ? 'más' : 'menos') + ' que ayer.' +
                    '</p>' +
                    '<p>' +
                        'Tu foco medio ha ' + (scoreDiff > 0 ? 'mejorado' : scoreDiff < 0 ? 'bajado' : 'quedado igual') + ': ' +
                        '<span class="' + scoreClass + '">' + scoreArrow + ' ' + Math.round(Math.abs(scoreDiff)) + '</span> puntos frente a ayer.' +
                    '</p>';
            }
            
            updateHeatmap(data) {
                const heatmapEl = document.getElementById('heatmap');
                if (!heatmapEl || !data.historyAll || !data.historyAll.length) {
                    if (heatmapEl) {
                        heatmapEl.innerHTML = '<p class="text-[11px] text-slate-500">Todavía no hay suficiente histórico para mostrar el heatmap.</p>';
                    }
                    return;
                }
                
                const sorted = data.historyAll.slice().sort((a, b) => a.date.localeCompare(b.date));
                const last30 = sorted.slice(-30);
                if (!last30.length) return;
                
                const maxMs = last30.reduce((max, d) => Math.max(max, d.totalTimeMs), 0) || 1;
                
                let html = '<div class="flex flex-wrap gap-1">';
                last30.forEach((day) => {
                    const level = day.totalTimeMs / maxMs;
                    let bg = 'bg-slate-800';
                    if (level > 0 && level <= 0.25) bg = 'bg-sky-900';
                    else if (level <= 0.5) bg = 'bg-sky-700';
                    else if (level <= 0.75) bg = 'bg-sky-500';
                    else if (level > 0.75) bg = 'bg-sky-400';
                    
                    html += 
                        '<div class="w-4 h-4 rounded-sm ' + bg + ' cursor-default" ' +
                             'title="' + day.date + '\\nTiempo: ' + this.formatMs(day.totalTimeMs) + '\\nScore medio: ' + Math.round(day.avgScore) + '">' +
                        '</div>';
                });
                html += '</div>';
                heatmapEl.innerHTML = html;
            }
            
            updateWeeklySummary(data) {
                const weeklyEl = document.getElementById('weekly-summary');
                if (!weeklyEl || !data.weeklySummary || !data.weeklySummary.length) {
                    if (weeklyEl) {
                        weeklyEl.innerHTML = '<p class="text-slate-500 text-xs">Todavía no hay datos suficientes.</p>';
                    }
                    return;
                }
                
                let html = '';
                data.weeklySummary.forEach((w) => {
                    const pct = Math.max(5, Math.min(100, (w.totalMinutes / 600) * 100));
                    html += 
                        '<div class="flex items-center gap-2">' +
                            '<span class="w-16 text-slate-400">' + w.weekLabel + '</span>' +
                            '<div class="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">' +
                                '<div class="h-full bg-indigo-400" style="width: ' + pct + '%;"></div>' +
                            '</div>' +
                            '<span class="w-24 text-right text-slate-300">' +
                                Math.round(w.totalMinutes) + ' min · ' + w.avgScore.toFixed(0) + '/100' +
                            '</span>' +
                        '</div>';
                });
                weeklyEl.innerHTML = html;
            }
            
            updateAchievements(data) {
                const achievementsEl = document.getElementById('achievements');
                const achievementsCountEl = document.getElementById('achievements-count');
                const allAchievementsEl = document.getElementById('all-achievements');
                
                // Update today's achievements
                if (achievementsEl && achievementsCountEl) {
                    if (!data.achievements || !data.achievements.length) {
                        achievementsEl.innerHTML = '<span class="text-slate-400 text-xs">Sin logros todavía. Trabaja un poco más y sigue revisando.</span>';
                        achievementsCountEl.textContent = '0 logros';
                    } else {
                        achievementsEl.innerHTML = '';
                        data.achievements.forEach((a) => {
                            const span = document.createElement('span');
                            span.className = 'inline-flex flex-col gap-0.5 rounded-lg border border-emerald-600/50 bg-emerald-500/10 px-2 py-1';
                            span.innerHTML = 
                                '<span class="text-[11px] font-semibold text-emerald-300">' + a.title + '</span>' +
                                '<span class="text-[10px] text-emerald-200/80">' + a.description + '</span>';
                            achievementsEl.appendChild(span);
                        });
                        achievementsCountEl.textContent = data.achievements.length + (data.achievements.length === 1 ? ' logro' : ' logros');
                    }
                }
                
                // Update all achievements
                if (allAchievementsEl && data.allAchievements) {
                    allAchievementsEl.innerHTML = '';
                    data.allAchievements.forEach((a) => {
                        const div = document.createElement('div');
                        const base = 'px-2 py-1 rounded-lg border text-[11px] flex flex-col gap-0.5';
                        
                        if (a.unlocked) {
                            div.className = base + ' border-emerald-500/60 bg-emerald-500/10 text-emerald-200';
                        } else {
                            div.className = base + ' border-slate-700 bg-slate-900/80 text-slate-500';
                        }
                        
                        div.innerHTML = 
                            '<span class="font-semibold">' + a.title + '</span>' +
                            '<span class="text-[10px] opacity-80">' + a.description + '</span>';
                        allAchievementsEl.appendChild(div);
                    });
                }
            }
            
            formatMs(ms) {
                const m = Math.floor(ms / 60000);
                const s = Math.floor((ms % 60000) / 1000);
                if (m === 0) return s + 's';
                return m + 'm ' + s + 's';
            }
        }
        
        // Initialize dashboard when DOM is ready
        let dashboardRenderer;
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                dashboardRenderer = new RefactoredDashboardRenderer();
                dashboardRenderer.init();
            });
        } else {
            dashboardRenderer = new RefactoredDashboardRenderer();
            dashboardRenderer.init();
        }
        
        // Listen for data updates
        window.addEventListener('message', function(event) {
            const msg = event.data;
            console.log('Mensaje recibido en dashboard:', msg);
            if (!msg || msg.type !== 'stats:update') return;
            
            if (dashboardRenderer) {
                console.log('Actualizando dashboard con datos:', msg.payload);
                dashboardRenderer.updateData(msg.payload || {});
            }
        });
    </script>
</body>
</html>`;
}

export function openRefactoredDashboard(context: vscode.ExtensionContext) {
  console.log("openRefactoredDashboard llamado");
  if (currentPanel) {
    console.log("Reutilizando panel existente");
    currentPanel.webview.html = getRefactoredHtml();
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  console.log("Creando nuevo panel de dashboard");
  currentPanel = vscode.window.createWebviewPanel(
    "focusPulseDashboardV2",
    "Focus Pulse Dashboard v2.1",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  console.log("Estableciendo HTML del dashboard");
  currentPanel.webview.html = getRefactoredHtml();

  currentPanel.webview.onDidReceiveMessage(
    async (msg) => {
      if (!msg) return;

      // Handle different message types
      if (msg.type === "requestData") {
        console.log("Dashboard requesting data");
        // Send initial data when dashboard requests it
        const statsArray = getStatsArray();
        const history7 = getLastDays(7);
        const historyAll = getHistory();
        const pomodoroStats = getPomodoroStats();
        const deepWork = getDeepWorkState(context);
        const streakDays = getStreakDays(historyAll);
    const achievements = computeAchievements(
      Array.isArray(streakDays) ? streakDays.length : streakDays,
      historyAll,
      statsArray,
    );
    const allDefs = getAllAchievementsDefinitions();
    const allAchievements = allDefs.map((a: any) => ({
      ...a,
      unlocked: achievements.some((u) => u.id === a.id),
    }));
    // Check if deepWork is from StateTypes and convert if needed
    let deepWorkForXp: DeepWorkState | undefined;
    if (isStateTypesDeepWorkState(deepWork)) {
      deepWorkForXp = convertToDeepWorkState(deepWork);
    } else {
      deepWorkForXp = deepWork;
    }
    
    const xp = computeXpState(historyAll, pomodoroStats, deepWorkForXp);

        const dashboardData: DashboardData = {
          stats: statsArray,
          history7,
          streak: Array.isArray(streakDays) ? streakDays.length : streakDays,
          achievements,
          xp,
          pomodoroStats,
          historyAll,
          deepWork,
          allAchievements,
          weeklySummary: [], // TODO: Implement weekly summary
          goals: undefined, // TODO: Implement goals
        };

        console.log("Enviando datos al dashboard:", dashboardData.stats?.length || 0, "archivos");
        currentPanel?.webview.postMessage({
          type: "stats:update",
          payload: dashboardData,
        });
      } else if (msg.type === "export") {
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
      }
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

export function updateRefactoredDashboard(data: DashboardData) {
  // Check if panel exists before debouncing
  if (!currentPanel) return;
  
  // Debounce dashboard updates for performance
  debounceDashboardUpdate(() => {
    if (!currentPanel) return;
    currentPanel.webview.postMessage({
      type: "stats:update",
      payload: data,
    });
  });
}

// Event listeners for state changes
export function setupDashboardEventListeners(context: vscode.ExtensionContext) {
  const stateManager = getStateManager();
  const eventBus = getEventBus();

  // Listen to state changes and update dashboard
  stateManager.subscribe((state, previousState) => {
    const statsArray = getStatsArray();
    const history7 = getLastDays(7);
    const historyAll = getHistory();
    const pomodoroStats = getPomodoroStats();
    const deepWork = state.deepWork;
    const streakDays = getStreakDays(historyAll);
    const achievements = computeAchievements(
      Array.isArray(streakDays) ? streakDays.length : streakDays,
      historyAll,
      statsArray,
    );
    const allDefs = getAllAchievementsDefinitions();
    const allAchievements = allDefs.map((a: any) => ({
      ...a,
      unlocked: achievements.some((u) => u.id === a.id),
    }));
    // Check if deepWork is from StateTypes and convert if needed
    let deepWorkForXp: DeepWorkState | undefined;
    if (isStateTypesDeepWorkState(deepWork)) {
      deepWorkForXp = convertToDeepWorkState(deepWork);
    } else {
      deepWorkForXp = deepWork;
    }
    
    const xp = computeXpState(historyAll, pomodoroStats, deepWorkForXp);

    const dashboardData: DashboardData = {
      stats: statsArray,
      history7,
      streak: Array.isArray(streakDays) ? streakDays.length : streakDays,
      achievements,
      xp,
      pomodoroStats,
      historyAll,
      deepWork,
      allAchievements,
      weeklySummary: [], // TODO: Implement weekly summary
      goals: undefined, // TODO: Implement goals
    };

    updateRefactoredDashboard(dashboardData);
  });

  // Listen to specific events
  eventBus.on(FOCUS_EVENTS.DASHBOARD_REFRESH, () => {
    console.log("Dashboard refresh requested");
    const statsArray = getStatsArray();
    const historyAll = getHistory();
    const pomodoroStats = getPomodoroStats();
    const deepWork = getDeepWorkState(context);
    const streakDays = getStreakDays(historyAll);
    const achievements = computeAchievements(
      Array.isArray(streakDays) ? streakDays.length : streakDays,
      historyAll,
      statsArray,
    );
    const allDefs = getAllAchievementsDefinitions();
    const allAchievements = allDefs.map((a: any) => ({
      ...a,
      unlocked: achievements.some((u) => u.id === a.id),
    }));
    // Check if deepWork is from StateTypes and convert if needed
    let deepWorkForXp: DeepWorkState | undefined;
    if (isStateTypesDeepWorkState(deepWork)) {
      deepWorkForXp = convertToDeepWorkState(deepWork);
    } else {
      deepWorkForXp = deepWork;
    }
    
    const xp = computeXpState(historyAll, pomodoroStats, deepWorkForXp);
    
    updateRefactoredDashboard({
      stats: statsArray,
      history7: getLastDays(7),
      historyAll,
      streak: Array.isArray(streakDays) ? streakDays.length : streakDays,
      achievements,
      xp,
      pomodoroStats,
      allAchievements,
    });
  });
}
