import * as vscode from "vscode";
import { DashboardData } from "./webview/types";
import { DashboardRenderer } from "./webview/DashboardRenderer";
import { UserSyncManager } from "./export/UserSyncManager";
import { getStateManager } from "./state/StateManager";
import { getEventBus } from "./events";
import { FOCUS_EVENTS } from "./events/EventTypes";
import { debounceDashboardUpdate } from "./utils/Debouncer";
import { openDashboard, updateDashboard } from "./dashboard";
import { AssistantService } from "./services/AssistantService";
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
let assistantService: AssistantService | undefined;

// Type guard to distinguish between DeepWorkState types
function isStateTypesDeepWorkState(obj: any): obj is StateTypesDeepWorkState {
  return (
    obj &&
    typeof obj === "object" &&
    "startTime" in obj &&
    "expectedDuration" in obj &&
    "score" in obj
  );
}

// Convert StateTypes.DeepWorkState to deepWork.DeepWorkState
function convertToDeepWorkState(state: StateTypesDeepWorkState): DeepWorkState {
  return {
    active: state.active,
    startedAt: state.startTime,
    durationMinutes: state.expectedDuration || 60,
    completedSessions: Math.floor(state.score), // Using score as proxy for completed sessions
  };
}

function getRefactoredHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  // Generate URIs for assistant sprites
  const getAssistantImageUri = (state: string, frame: string) => {
    const imagePath = vscode.Uri.joinPath(context.extensionUri, 'media', 'assistant', state, frame);
    return webview.asWebviewUri(imagePath).toString();
  };

  // Create animation map with proper URIs
  const animationMapJson = JSON.stringify({
    IDLE: [
      getAssistantImageUri('normal', 'normal1.png'),
      getAssistantImageUri('normal', 'normal2.png')
    ],
    FOCUSED: [
      getAssistantImageUri('thinking', 'pensar1.png'),
      getAssistantImageUri('thinking', 'pensar2.png'),
      getAssistantImageUri('thinking', 'pensar3.png'),
      getAssistantImageUri('thinking', 'pensar4.png')
    ],
    WARNING: [
      getAssistantImageUri('fatigue', 'Fatiga1.png'),
      getAssistantImageUri('fatigue', 'fatiga2.png'),
      getAssistantImageUri('fatigue', 'fatiga3.png'),
      getAssistantImageUri('fatigue', 'fatiga4.png')
    ],
    SUCCESS: [
      getAssistantImageUri('levelup', 'xp1.png'),
      getAssistantImageUri('levelup', 'xp2.png'),
      getAssistantImageUri('levelup', 'xp3.png'),
      getAssistantImageUri('levelup', 'xp4.png')
    ]
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Focus Pulse Dashboard</title>

  <link rel="icon" href="data:image/svg+xml,
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
    <text y='0.9em' font-size='90'>⚡</text>
  </svg>">

  <script>
    const vscode = acquireVsCodeApi();
    // Assistant animation map with proper URIs
    const ASSISTANT_ANIMATION_MAP = ${animationMapJson};
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
<!-- Tab bar -->
<div class="flex gap-1 mb-3 border-b border-slate-700/50 pb-2" id="tab-bar">
  <button class="tab-btn active-tab px-4 py-1.5 text-sm font-medium rounded-t-lg bg-slate-800 text-slate-100 border border-slate-700/60 border-b-0" data-tab="dashboard">Dashboard</button>
  <button class="tab-btn px-4 py-1.5 text-sm font-medium rounded-t-lg text-slate-400 hover:text-slate-200 transition-colors" data-tab="friends">Amigos</button>
</div>
<!-- Dashboard tab content -->
<div id="tab-content-dashboard" class="space-y-4">
<!-- Header Component -->
                        <header class="flex flex-col gap-2" id="header-container">
                            <div class="flex justify-between items-start">
                                <div>
                                    <h1 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-3">
                                       <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                                            ⚡
                                        </span>
                                        Focus Pulse Dashboard 
                                    </h1>
                                    <p class="text-slate-400">
                                        Visualiza tu productividad y progreso directamente en VS Code.
                                    </p>
                                </div>
                                <div class="flex gap-2">
                                    <div class="relative">
                                        <button 
                                            id="export-menu-btn"
                                            class="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors duration-200 flex items-center gap-1.5 border border-slate-600"
                                            title="Exportar/Importar datos"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="7,10 12,15 17,10"></polyline>
                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                            </svg>
                                            Datos
                                        </button>
                                        <div 
                                            id="export-menu" 
                                            class="absolute right-0 mt-1 w-48 bg-slate-800 border border-slate-600 rounded-md shadow-lg hidden z-50"
                                        >
                                            <div class="py-1">
                                                <button 
                                                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                                    data-action="export-json"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="7,10 12,15 17,10"></polyline>
                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                    </svg>
                                                    Exportar JSON
                                                </button>
                                                <button 
                                                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                                    data-action="export-xml"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="7,10 12,15 17,10"></polyline>
                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                    </svg>
                                                    Exportar XML
                                                </button>
                                                <button 
                                                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                                    data-action="export-file"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="7,10 12,15 17,10"></polyline>
                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                    </svg>
                                                    Exportar a archivo
                                                </button>
                                                <button 
                                                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                                    data-action="import-file"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="17,8 12,3 7,8"></polyline>
                                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                                    </svg>
                                                    Importar desde archivo
                                                </button>
                                                <div class="border-t border-slate-700 my-1"></div>
                                                <button 
                                                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                                    data-action="sync-status"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <polyline points="23,4 23,10 17,10"></polyline>
                                                        <path d="M20.49,15a9,9,0,1,1-2.12-9.36L23,10"></path>
                                                    </svg>
                                                    Estado de sincronización
                                                </button>
                                                <button
                                                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                                                    data-action="goto-friends"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                        <circle cx="9" cy="7" r="4"></circle>
                                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                                    </svg>
                                                    Amigos
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-4 text-sm" id="xp-container">
                                <div class="flex items-center gap-2">
                                    <span class="text-slate-300 font-medium">Nivel</span>
                                    <span id="xp-level" class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">1</span>
                                </div>
                                <div class="flex-1 h-3 rounded-full bg-slate-700/50 overflow-hidden backdrop-blur-sm border border-slate-600/50">
                                    <div id="xp-bar-inner" class="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 shadow-lg shadow-blue-500/25" style="width: 0%;"></div>
                                </div>
                                <span id="xp-label" class="text-sm text-slate-300 font-medium">0 XP total</span>
                            </div>
                            <div id="deepwork-pill" class="text-[11px] text-slate-500"></div>
                        </header>
                        
                        <!-- Metrics Grid -->
                        <section class="grid gap-4 md:grid-cols-4" id="metrics-container">
                            <div class="bg-slate-800 rounded-xl border border-slate-700/60 p-4 backdrop-blur-sm hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
                                <div class="text-xs uppercase tracking-wide text-slate-400 mb-2 font-semibold">Racha</div>
                                <div class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400" id="streak-value">0 días</div>
                                <p class="text-xs text-slate-400 mt-2">Días consecutivos con tiempo de foco registrado.</p>
                            </div>
                            <div class="bg-slate-800 rounded-xl border border-slate-700/60 p-4 backdrop-blur-sm hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
                                <div class="text-xs uppercase tracking-wide text-slate-400 mb-2 font-semibold">Últimos 7 días</div>
                                <div class="text-lg text-slate-200 mb-1">
                                    <span id="last7-time" class="font-bold text-blue-300">0s</span> de trabajo
                                </div>
                                <div class="text-lg text-slate-200">
                                    Media de foco: <span id="last7-score" class="font-bold text-purple-300">-</span>/100
                                </div>
                                <p class="text-xs text-slate-400 mt-2">Basado en sesiones registradas con Focus Pulse.</p>
                            </div>
                            <div class="bg-slate-800 rounded-xl border border-slate-700/60 p-4 backdrop-blur-sm hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
                                <div class="text-xs uppercase tracking-wide text-slate-400 mb-2 font-semibold">Archivos hoy</div>
                                <div class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400" id="files-today">0</div>
                                <p class="text-xs text-slate-400 mt-2">Archivos con foco en esta sesión de VS Code.</p>
                            </div>
                            <div class="bg-slate-800 rounded-xl border border-slate-700/60 p-4 backdrop-blur-sm hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 flex flex-col gap-3">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <div class="text-xs uppercase tracking-wide text-slate-400 mb-2 font-semibold">Pomodoros</div>
                                        <div class="text-lg text-slate-200 mb-1">
                                            Hoy: <span id="pomodoro-today" class="font-bold text-emerald-300">0</span>
                                        </div>
                                        <div class="text-lg text-slate-200">
                                            Total: <span id="pomodoro-total" class="font-bold text-emerald-400">0</span>
                                        </div>
                                    </div>
                                    <div class="flex flex-col gap-2 items-end">
                                        <button id="export-json-btn" class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-[11px] font-medium text-blue-300 hover:from-blue-500/30 hover:to-purple-500/30 transition-all duration-200 border border-blue-500/30">
                                            Exportar JSON
                                        </button>
                                        <button id="export-csv-btn" class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-[11px] font-medium text-emerald-300 hover:from-emerald-500/30 hover:to-blue-500/30 transition-all duration-200 border border-emerald-500/30">
                                            Exportar CSV
                                        </button>
                                    </div>
                                </div>
                                <p class="text-[11px] text-slate-500">Exporta tu histórico para analizarlo fuera (Notion, Excel, etc.).</p>
                            </div>
                        </section>
                        
                        <!-- Goals Component -->
                        <section class="bg-slate-800 rounded-xl border border-slate-700/60 p-4 backdrop-blur-sm" id="goals-container">
                            <div class="flex items-center justify-between mb-3">
                                <h2 class="text-lg font-semibold flex items-center gap-2">
                                    <span>🎯</span> Objetivo de hoy
                                </h2>
                                <span id="goal-status-label" class="text-sm text-slate-400 font-medium">Sin objetivo configurado</span>
                            </div>
                            <div id="goal-content" class="space-y-3 text-sm text-slate-300">
                                <p class="text-slate-500 text-sm">Configura los objetivos diarios en las opciones de Focus Pulse.</p>
                            </div>
                        </section>
                        
                        <!-- Insights Component -->
                        <section class="bg-slate-800 rounded-xl border border-slate-700/60 p-4 backdrop-blur-sm" id="insights-container">
                            <div class="flex items-center justify-between mb-3">
                                <h2 class="text-lg font-semibold flex items-center gap-2">
                                    <span>📊</span> Insights rápidos
                                </h2>
                            </div>
                            <div id="insights" class="text-sm text-slate-300 space-y-2">
                                <p class="text-slate-500 text-sm">Aún no hay suficientes datos para comparar días.</p>
                            </div>
                        </section>
                        
                        <!-- Heatmap Component -->
                        <section class="bg-slate-800 rounded-xl border border-slate-700/60 p-4 backdrop-blur-sm" id="heatmap-container">
                            <div class="flex items-center justify-between mb-3">
                                <h2 class="text-lg font-semibold flex items-center gap-2">
                                    <span>🔥</span> Heatmap de productividad (últimos 30 días)
                                </h2>
                                <span class="text-sm text-slate-500">Intensidad basada en minutos de foco</span>
                            </div>
                            <div id="heatmap" class="flex flex-col gap-1 text-[10px] text-slate-400"></div>
                        </section>
                        
                        <!-- Weekly Summary Component -->
                        <section class="bg-slate-800 rounded-xl border border-slate-700/60 p-4 backdrop-blur-sm" id="weekly-container">
                            <div class="flex items-center justify-between mb-3">
                                <h2 class="text-lg font-semibold flex items-center gap-2">
                                    <span>📈</span> Resumen semanal
                                </h2>
                                <span class="text-sm text-slate-500">Minutos totales por semana</span>
                            </div>
                            <div id="weekly-summary" class="space-y-2 text-sm text-slate-300">
                                <p class="text-slate-500 text-sm">Todavía no hay datos suficientes.</p>
                            </div>
                        </section>
                        
                        <!-- Achievements Component -->
                        <section class="bg-slate-800 rounded-xl border border-slate-700/60 p-4 backdrop-blur-sm" id="achievements-container">
                            <div class="flex items-center justify-between mb-3">
                                <h2 class="text-lg font-semibold flex items-center gap-2">
                                    <span>🏆</span> Logros de hoy
                                </h2>
                                <div class="flex items-center gap-3">
                                    <button id="custom-achievements-btn" class="text-sm bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 hover:from-purple-500/30 hover:to-pink-500/30 px-3 py-1.5 rounded-lg border border-purple-500/30 font-medium transition-all duration-200 transform hover:scale-105" type="button">
                                        ⚡ Personalizados
                                    </button>
                                    <span class="text-sm text-slate-400 font-medium" id="achievements-count">0 logros</span>
                                    <button id="achievements-toggle" class="text-sm text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2 transition-colors" type="button">
                                        Ver todos
                                    </button>
                                </div>
                            </div>
                            <div id="achievements" class="flex flex-wrap gap-2 text-sm">
                                <span class="text-slate-400 text-sm">Sin datos todavía.</span>
                            </div>
                            <div id="all-achievements" class="mt-3 grid gap-2 sm:grid-cols-2 text-sm hidden"></div>
                        </section>
                        
                        <!-- Table Component -->
                        <section class="bg-slate-800/60 rounded-xl border border-slate-700/60 overflow-hidden backdrop-blur-sm" id="table-container">
                            <div class="px-6 py-3 border-b border-slate-700/70 bg-slate-800/40 flex items-center justify-between">
                                <h2 class="text-base font-semibold text-slate-200 flex items-center gap-2">
                                    <span>📄</span> Detalle por archivo
                                </h2>
                                <span class="text-sm text-slate-400 font-medium" id="summary-label">0 archivos registrados</span>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="min-w-full">
                                    <thead class="bg-slate-800/60 border-b border-slate-700/50">
                                        <tr class="text-left text-sm uppercase tracking-wide text-slate-400 font-semibold">
                                            <th class="px-6 py-3">Archivo</th>
                                            <th class="px-6 py-3">Puntuación</th>
                                            <th class="px-6 py-3">Tiempo</th>
                                            <th class="px-6 py-3">Ediciones</th>
                                            <th class="px-6 py-3">Δ texto</th>
                                            <th class="px-6 py-3">Cambios</th>
                                        </tr>
                                    </thead>
                                    <tbody id="table-body" class="divide-y divide-slate-800/60 bg-slate-900/30"></tbody>
                                </table>
                            </div>
                        </section>
</div><!-- /tab-content-dashboard -->
<!-- Friends tab (hidden initially) -->
<div id="tab-content-friends" class="space-y-4 hidden">
  <div id="friends-container" class="bg-slate-800/60 rounded-xl border border-slate-700/60 p-4">
    <!-- populated dynamically by updateFriendsTab() -->
  </div>
</div>
                    </div>
                \`;
            }
            
setupEventListeners() {
                var self = this;
                
                // Export menu toggle
                const exportBtn = document.getElementById('export-menu-btn');
                const exportMenu = document.getElementById('export-menu');
                const menuItems = document.querySelectorAll('.export-menu-item');

                if (exportBtn && exportMenu) {
                    exportBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        exportMenu.classList.toggle('hidden');
                    });

                    document.addEventListener('click', function(e) {
                        if (!exportMenu.contains(e.target) && !exportBtn.contains(e.target)) {
                            exportMenu.classList.add('hidden');
                        }
                    });

                    menuItems.forEach(function(item) {
                        item.addEventListener('click', function(e) {
                            e.stopPropagation();
                            const action = item.getAttribute('data-action');
                            if (action === 'goto-friends') {
                                var friendsTabBtn = document.querySelector('.tab-btn[data-tab="friends"]');
                                if (friendsTabBtn) friendsTabBtn.click();
                            } else if (action === 'sync-status') {
                                var syncInfo = self.syncInfo || {};
                                var statusMsg = syncInfo.isAuthenticated
                                    ? 'Autenticado · Última sync: ' + (syncInfo.lastSync ? new Date(syncInfo.lastSync).toLocaleString() : 'Nunca') + ' · Auto-sync: ' + (syncInfo.autoSyncEnabled ? 'Activado' : 'Desactivado')
                                    : 'No autenticado. Conecta tu cuenta de GitHub para sincronizar.';
                                var existing = document.getElementById('sync-status-toast');
                                if (existing) existing.remove();
                                var toast = document.createElement('div');
                                toast.id = 'sync-status-toast';
                                toast.className = 'fixed top-4 right-4 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-lg p-3 text-sm text-slate-200 max-w-xs';
                                toast.innerHTML = '<div class="flex justify-between items-start gap-2 mb-1.5"><span class="font-semibold text-slate-100">Sincronización</span><button id="sync-toast-close" class="text-slate-500 hover:text-slate-300 leading-none text-lg">&times;</button></div><p class="text-slate-300">' + statusMsg + '</p>';
                                document.body.appendChild(toast);
                                toast.querySelector('#sync-toast-close').addEventListener('click', function() { toast.remove(); });
                                setTimeout(function() { if (toast.parentNode) toast.remove(); }, 5000);
                            } else if (action) {
                                vscode.postMessage({ command: action });
                            }
                            exportMenu.classList.add('hidden');
                        });
                    });
                }
                
                // Legacy export buttons (if they exist)
                const legacyExportJsonBtn = document.getElementById('export-json-btn');
                if (legacyExportJsonBtn) {
                    legacyExportJsonBtn.addEventListener('click', function() {
                        vscode.postMessage({ type: 'export', format: 'json' });
                    });
                }
                
                const legacyExportCsvBtn = document.getElementById('export-csv-btn');
                if (legacyExportCsvBtn) {
                    legacyExportCsvBtn.addEventListener('click', function() {
                        vscode.postMessage({ type: 'export', format: 'csv' });
                    });
                }
                
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
                
                // Custom achievements button
                document.getElementById('custom-achievements-btn').addEventListener('click', function() {
                    vscode.postMessage({ type: 'openCustomAchievements' });
                });

                // Tab switching
                var tabBtns = document.querySelectorAll('.tab-btn');
                tabBtns.forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var target = btn.getAttribute('data-tab');
                        document.getElementById('tab-content-dashboard').classList.toggle('hidden', target !== 'dashboard');
                        document.getElementById('tab-content-friends').classList.toggle('hidden', target !== 'friends');
                        tabBtns.forEach(function(b) {
                            var active = b.getAttribute('data-tab') === target;
                            b.classList.toggle('active-tab', active);
                            b.classList.toggle('bg-slate-800', active);
                            b.classList.toggle('text-slate-100', active);
                            b.classList.toggle('border', active);
                            b.classList.toggle('border-slate-700/60', active);
                            b.classList.toggle('border-b-0', active);
                            b.classList.toggle('text-slate-400', !active);
                        });
if (target === 'friends') {
                            // Check if friends data is stale before refreshing
                            const now = Date.now();
                            const lastFriendsUpdate = window.lastFriendsUpdate || 0;
                            const FRIENDS_STALE_THRESHOLD = 30000; // 30 seconds

                            if (now - lastFriendsUpdate > FRIENDS_STALE_THRESHOLD) {
                                document.getElementById('friends-container').innerHTML = '<div class="flex justify-center py-8"><div class="text-slate-400 text-sm animate-pulse">Actualizando...</div></div>';
                                vscode.postMessage({ type: 'friends:refreshFriends' });
                                window.lastFriendsUpdate = now;
                            } else {
                                // Use cached data if still fresh
                                console.log('Friends data still fresh, using cache');
                            }
                        }
                    });
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

                if (data.sync) {
                    this.syncInfo = data.sync;
                }

if (data.friends) {
                    this.updateFriendsTab(data.friends);
                    // Update timestamp when friends data is received
                    window.lastFriendsUpdate = Date.now();
                }
            }
            
            updateFriendsTab(data) {
                var container = document.getElementById('friends-container');
                if (!container) return;

                // Toast messages (error or share success)
                var toastHtml = '';
                if (data && data._error) {
                    toastHtml = '<div class="bg-rose-900/40 border border-rose-700/60 rounded-lg p-2.5 text-rose-300 text-sm mb-3">' + data._error + '</div>';
                }
                if (data && data.shareComplete) {
                    toastHtml = '<div class="bg-emerald-900/40 border border-emerald-700/60 rounded-lg p-2.5 text-emerald-300 text-sm mb-3" id="friends-share-toast">✓ Perfil compartido. Comparte tu usuario <strong>' + (data.ownUsername || '') + '</strong> con tus amigos.</div>';
                }

                if (!data || !data.isAuthenticated) {
                    container.innerHTML =
                        '<div class="text-center py-8">' +
                        '<p class="text-slate-400 text-sm mb-4">Necesitas autenticarte con GitHub para usar la función de amigos.</p>' +
                        '<button class="px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 hover:from-blue-500/30 hover:to-purple-500/30 rounded-lg border border-blue-500/30 text-sm font-medium transition-all" id="friends-auth-btn">Autenticar cuenta</button>' +
                        '</div>';
                    var authBtn = container.querySelector('#friends-auth-btn');
                    if (authBtn) {
                        authBtn.addEventListener('click', function() {
                            vscode.postMessage({ type: 'authenticate' });
                        });
                    }
                    return;
                }

                var friends = data.friends || [];
                var ownProfile = data.ownProfile;
                var ownUsername = data.ownUsername || 'Tú';

                // Header: Share Profile + Add Friend (username only)
                var headerHtml =
                    '<div class="flex flex-col sm:flex-row gap-3 mb-4">' +
                    '<button class="px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-emerald-300 hover:from-emerald-500/30 hover:to-blue-500/30 rounded-lg border border-emerald-500/30 text-sm font-medium transition-all" id="friends-share-btn">📤 Compartir perfil</button>' +
                    '<div class="flex flex-1 gap-2">' +
                    '<input type="text" id="friends-add-input" placeholder="Link del gist o username de GitHub" class="flex-1 bg-slate-700/40 border border-slate-600/60 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/60" title="Puedes pegar el link completo del gist o solo el username">' +
                    '<button class="px-3 py-1.5 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-lg border border-blue-500/30 text-sm font-medium transition-all" id="friends-add-btn">➕ Añadir</button>' +
                    '</div>' +
                    '</div>';

                // Build rows: own profile first, then friends
                var rows = '';
                if (ownProfile) {
                    rows +=
                        '<tr class="border-l-4 border-emerald-500" style="background:rgba(15,23,42,0.8);">' +
                        '<td class="px-4 py-2.5 text-slate-100 font-semibold">' + ownUsername + ' <span class="text-xs text-emerald-400 ml-1">(Tú)</span></td>' +
                        '<td class="px-4 py-2.5 text-blue-300 font-semibold">' + ownProfile.level + '</td>' +
                        '<td class="px-4 py-2.5 text-purple-300">' + ownProfile.totalXp + '</td>' +
                        '<td class="px-4 py-2.5 text-slate-200">' + this.formatFocusTime(ownProfile.totalFocusTimeMs) + '</td>' +
                        '<td class="px-4 py-2.5 text-emerald-300">' + ownProfile.currentStreak + '</td>' +
                        '<td class="px-4 py-2.5 text-slate-200">' + ownProfile.totalPomodoros + '</td>' +
                        '<td class="px-4 py-2.5 text-slate-200">' + ownProfile.totalAchievements + '</td>' +
                        '<td class="px-4 py-2.5"></td>' +
                        '</tr>';
                }

                var self = this;
                friends.forEach(function(f) {
                    var p = f.cachedProfile;
                    if (p) {
                        rows +=
                            '<tr class="hover:bg-slate-800/60 transition-colors">' +
                            '<td class="px-4 py-2.5 text-slate-200">' + f.username + '</td>' +
                            '<td class="px-4 py-2.5 text-blue-300">' + p.level + '</td>' +
                            '<td class="px-4 py-2.5 text-purple-300">' + p.totalXp + '</td>' +
                            '<td class="px-4 py-2.5 text-slate-200">' + self.formatFocusTime(p.totalFocusTimeMs) + '</td>' +
                            '<td class="px-4 py-2.5 text-emerald-300">' + p.currentStreak + '</td>' +
                            '<td class="px-4 py-2.5 text-slate-200">' + p.totalPomodoros + '</td>' +
                            '<td class="px-4 py-2.5 text-slate-200">' + p.totalAchievements + '</td>' +
                            '<td class="px-4 py-2.5"><button class="friends-remove-btn text-slate-500 hover:text-rose-400 transition-colors text-lg leading-none" data-username="' + f.username + '">&times;</button></td>' +
                            '</tr>';
                    } else {
                        rows +=
                            '<tr class="hover:bg-slate-800/60 transition-colors">' +
                            '<td class="px-4 py-2.5 text-slate-200">' + f.username + '</td>' +
                            '<td colspan="6" class="px-4 py-2.5 text-slate-500 text-sm italic">Sin datos disponibles</td>' +
                            '<td class="px-4 py-2.5"><button class="friends-remove-btn text-slate-500 hover:text-rose-400 transition-colors text-lg leading-none" data-username="' + f.username + '">&times;</button></td>' +
                            '</tr>';
                    }
                });

                var tableHtml = '';
                if (rows) {
                    tableHtml =
                        '<div class="overflow-x-auto mt-2">' +
                        '<table class="min-w-full">' +
                        '<thead class="bg-slate-800/60 border-b border-slate-700/50">' +
                        '<tr class="text-left text-xs uppercase tracking-wide text-slate-400 font-semibold">' +
                        '<th class="px-4 py-2.5">Usuario</th>' +
                        '<th class="px-4 py-2.5">Nivel</th>' +
                        '<th class="px-4 py-2.5">XP</th>' +
                        '<th class="px-4 py-2.5">Tiempo total</th>' +
                        '<th class="px-4 py-2.5">Racha</th>' +
                        '<th class="px-4 py-2.5">Pomodoros</th>' +
                        '<th class="px-4 py-2.5">Logros</th>' +
                        '<th class="px-4 py-2.5"></th>' +
                        '</tr>' +
                        '</thead>' +
                        '<tbody class="divide-y divide-slate-800/60 bg-slate-900/30">' +
                        rows +
                        '</tbody>' +
                        '</table>' +
                        '</div>';
                } else {
                    tableHtml =
                        '<div class="border border-dashed border-slate-600/60 rounded-lg p-5 text-center space-y-2">' +
                        '<p class="text-slate-300 text-sm font-medium">¿Por dónde empezar?</p>' +
                        '<div class="text-slate-400 text-xs space-y-1 max-w-sm mx-auto">' +
                        '<p>1. Pulsa <strong class="text-emerald-400">Compartir perfil</strong> para crear tu perfil público.</p>' +
                        '<p>2. Pide a un amigo que haga lo mismo con Focus Pulse.</p>' +
                        '<p>3. Añádelo aquí con su nombre de usuario de GitHub.</p>' +
                        '</div>' +
                        '</div>';
                }

                container.innerHTML = toastHtml + headerHtml + tableHtml;

                // Auto-dismiss share success toast
                if (data && data.shareComplete) {
                    setTimeout(function() {
                        var el = document.getElementById('friends-share-toast');
                        if (el) {
                            el.style.transition = 'opacity 0.3s';
                            el.style.opacity = '0';
                            setTimeout(function() { if (el && el.parentNode) el.remove(); }, 300);
                        }
                    }, 4000);
                }

                // Wire up Share Profile button (with loading state)
                var shareBtn = container.querySelector('#friends-share-btn');
                if (shareBtn) {
                    shareBtn.addEventListener('click', function() {
                        shareBtn.textContent = 'Compartiendo...';
                        shareBtn.disabled = true;
                        shareBtn.classList.add('opacity-60');
                        vscode.postMessage({ type: 'friends:shareProfile' });
                    });
                }

                // Wire up Add Friend button (with loading state)
                var addInput = container.querySelector('#friends-add-input');
                var addBtn = container.querySelector('#friends-add-btn');
                if (addBtn && addInput) {
                    var doAdd = function() {
                        var value = addInput.value.trim();
                        if (!value) return;

                        // Auto-detect if it's a gist URL or username
                        var mode = 'username';
                        if (value.includes('gist.github.com') || /^[a-f0-9]{32}$/i.test(value)) {
                            mode = 'gistId';
                        }

                        addBtn.textContent = mode === 'gistId' ? '🔍 Buscando...' : '🔍 Buscando...';
                        addBtn.disabled = true;
                        vscode.postMessage({ type: 'friends:addFriend', payload: { mode: mode, value: value } });
                        addInput.value = '';
                    };
                    addBtn.addEventListener('click', doAdd);
                    addInput.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter') doAdd();
                    });
                }

                // Wire up Remove buttons
                var removeBtns = container.querySelectorAll('.friends-remove-btn');
                removeBtns.forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var username = btn.getAttribute('data-username');
                        if (username) {
                            vscode.postMessage({ type: 'friends:removeFriend', payload: { username: username } });
                        }
                    });
                });
            }

            formatFocusTime(ms) {
                if (!ms) return '0h 0m';
                var totalMinutes = Math.floor(ms / 60000);
                var h = Math.floor(totalMinutes / 60);
                var m = totalMinutes % 60;
                return h + 'h ' + m + 'm';
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
                            
                            // Estilos diferentes para logros personalizados
                                if (a.custom) {
                                const colorClass = a.color ? getColorClass(a.color) : 'border-purple-600/50 bg-purple-500/10';
                                const textColorClass = a.color ? getTextColorClass(a.color) : 'text-purple-300';
                                const textSecondaryClass = a.color ? getTextSecondaryClass(a.color) : 'text-purple-200/80';
                                
                                span.className = 'inline-flex flex-col gap-1 rounded-lg border ' + colorClass + ' px-3 py-2 badge-glow shadow-sm transform hover:scale-105 transition-all duration-200';
                                span.innerHTML = 
                                    '<span class="text-sm font-semibold ' + textColorClass + '">' + (a.icon || '🏆') + ' ' + a.title + '</span>' +
                                    '<span class="text-xs ' + textSecondaryClass + '">' + a.description + '</span>';
                            } else {
                                span.className = 'inline-flex flex-col gap-1 rounded-lg border border-emerald-600/50 bg-emerald-500/10 px-3 py-2 shadow-sm transform hover:scale-105 transition-all duration-200';
                                span.innerHTML = 
                                    '<span class="text-sm font-semibold text-emerald-300">' + a.title + '</span>' +
                                    '<span class="text-xs text-emerald-200/80">' + a.description + '</span>';
                            }
                            
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
                        const base = 'px-3 py-2 rounded-lg border text-sm flex flex-col gap-1 transition-all duration-200 hover:transform hover:scale-105';
                        
                        if (a.unlocked) {
                            div.className = base + ' border-emerald-500/60 bg-emerald-500/10 text-emerald-200 shadow-sm shadow-emerald-500/10';
                        } else {
                            div.className = base + ' border-slate-700 bg-slate-900/80 text-slate-500';
                        }
                        
                        div.innerHTML = 
                            '<span class="font-semibold">' + (a.icon || '🏆') + ' ' + a.title + '</span>' +
                            '<span class="text-xs opacity-80">' + a.description + '</span>';
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
            
            getColorClass(color) {
                const colors = {
                    blue: 'border-blue-500/60 bg-blue-500/10',
                    green: 'border-green-500/60 bg-green-500/10',
                    purple: 'border-purple-600/50 bg-purple-500/10',
                    red: 'border-red-500/60 bg-red-500/10',
                    yellow: 'border-yellow-500/60 bg-yellow-500/10',
                    pink: 'border-pink-500/60 bg-pink-500/10'
                };
                return colors[color] || colors.blue;
            }
            
            getTextColorClass(color) {
                const colors = {
                    blue: 'text-blue-300',
                    green: 'text-green-300',
                    purple: 'text-purple-300',
                    red: 'text-red-300',
                    yellow: 'text-yellow-300',
                    pink: 'text-pink-300'
                };
                return colors[color] || colors.blue;
            }
            
            getTextSecondaryClass(color) {
                const colors = {
                    blue: 'text-blue-200/80',
                    green: 'text-green-200/80',
                    purple: 'text-purple-200/80',
                    red: 'text-red-200/80',
                    yellow: 'text-yellow-200/80',
                    pink: 'text-pink-200/80'
                };
                return colors[color] || colors.blue;
            }
        }
        
        // Helper functions for color styling
        function getColorClass(color) {
            const colors = {
                blue: 'border-blue-500/60 bg-blue-500/10',
                green: 'border-green-500/60 bg-green-500/10',
                purple: 'border-purple-600/50 bg-purple-500/10',
                red: 'border-red-500/60 bg-red-500/10',
                yellow: 'border-yellow-500/60 bg-yellow-500/10',
                pink: 'border-pink-500/60 bg-pink-500/10'
            };
            return colors[color] || colors.blue;
        }
        
        function getTextColorClass(color) {
            const colors = {
                blue: 'text-blue-300',
                green: 'text-green-300',
                purple: 'text-purple-300',
                red: 'text-red-300',
                yellow: 'text-yellow-300',
                pink: 'text-pink-300'
            };
            return colors[color] || colors.blue;
        }
        
        function getTextSecondaryClass(color) {
            const colors = {
                blue: 'text-blue-200/80',
                green: 'text-green-200/80',
                purple: 'text-purple-200/80',
                red: 'text-red-200/80',
                yellow: 'text-yellow-200/80',
                pink: 'text-pink-200/80'
            };
            return colors[color] || colors.blue;
        }

        // Initialize dashboard when DOM is ready
        let dashboardRenderer;
        let assistantRenderer;
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                dashboardRenderer = new RefactoredDashboardRenderer();
                dashboardRenderer.init();
                initAssistant();
            });
        } else {
            dashboardRenderer = new RefactoredDashboardRenderer();
            dashboardRenderer.init();
            initAssistant();
        }

        // Assistant Component Implementation
        function initAssistant() {
            const AssistantRenderer = function() {
                this.container = null;
                this.currentState = 'IDLE';
                this.speechBubble = null;
                this.character = null;
                this.characterImg = null;
                this.messageQueue = [];
                this.isShowingMessage = false;
                this.factsClickCount = 0;
                this.animationInterval = null;
                this.frameIndex = 0;
                this.productivityFacts = [
                    "¿Sabías que tardas 23 minutos en recuperar el foco tras una interrupción?",
                    "El cerebro humano mantiene el foco máximo por ~45 minutos seguidos",
                    "Trabajar en bloques de 90min + 15min de descanso es óptimo para productividad",
                    "Hacer pausas cada 25 minutos aumenta un 13% tu productividad diaria",
                    "La música sin letra puede mejorar tu concentración hasta en un 15%",
                    "El multitasking reduce tu productividad en un 40% comparado con el trabajo enfocto"
                ];

                this.setupGlobalStyles();
                this.render();
                this.setupEventListeners();

                // Notify extension that assistant is ready
                vscode.postMessage({ type: 'assistant:ready' });
            };

            AssistantRenderer.prototype.setupGlobalStyles = function() {
                if (document.getElementById('deepy-styles')) return;

                const style = document.createElement('style');
                style.id = 'deepy-styles';
                style.textContent = \`
                    @keyframes pixel-wiggle {
                        0%, 100% { transform: rotate(0deg); }
                        25% { transform: rotate(5deg); }
                        75% { transform: rotate(-5deg); }
                    }
                    .pixel-wiggle { animation: pixel-wiggle 0.3s ease-in-out infinite; }

                    @keyframes celebration-pulse {
                        0% { transform: scale(1) rotate(0deg); opacity: 1; }
                        25% { transform: scale(1.3) rotate(5deg); opacity: 0.9; }
                        50% { transform: scale(1.1) rotate(-3deg); opacity: 1; }
                        75% { transform: scale(1.2) rotate(2deg); opacity: 0.95; }
                        100% { transform: scale(1) rotate(0deg); opacity: 1; }
                    }
                    .celebration-pulse { animation: celebration-pulse 1.2s ease-in-out; }

                    @keyframes warning-shake {
                        0%, 100% { transform: translateX(0); }
                        10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
                        20%, 40%, 60%, 80% { transform: translateX(3px); }
                    }
                    .warning-shake { animation: warning-shake 0.6s ease-in-out; }

                    @keyframes focus-glow {
                        0%, 100% { filter: brightness(1) drop-shadow(0 0 8px rgba(59, 130, 246, 0.5)); }
                        50% { filter: brightness(1.2) drop-shadow(0 0 16px rgba(59, 130, 246, 0.8)); }
                    }
                    .focus-glow { animation: focus-glow 2s ease-in-out infinite; }

                    @keyframes gentle-pulse {
                        0%, 100% { transform: scale(1); opacity: 0.3; }
                        50% { transform: scale(1.05); opacity: 0.5; }
                    }

                    @keyframes focus-aura {
                        0%, 100% { transform: scale(1); opacity: 0.8; }
                        50% { transform: scale(1.15); opacity: 1; }
                    }

                    @keyframes warning-pulse {
                        0%, 100% { transform: scale(1); opacity: 0.7; }
                        50% { transform: scale(1.2); opacity: 0.9; }
                    }

                    @keyframes celebration-burst {
                        0% { transform: scale(0.5); opacity: 0; }
                        50% { transform: scale(1.3); opacity: 1; }
                        100% { transform: scale(1); opacity: 0.9; }
                    }
                \`;
                document.head.appendChild(style);
            };

            AssistantRenderer.prototype.startAnimationLoop = function() {
                if (this.animationInterval) clearInterval(this.animationInterval);

                this.frameIndex = 0;

                // Animation loop for sprite frames
                this.animationInterval = setInterval(() => {
                    const frames = ASSISTANT_ANIMATION_MAP[this.currentState];
                    if (!frames || frames.length === 0) return;

                    this.frameIndex = (this.frameIndex + 1) % frames.length;

                    if (this.characterImg) {
                        // Smooth fade transition between frames
                        this.characterImg.style.opacity = '0.8';
                        setTimeout(() => {
                            if (this.characterImg) {
                                this.characterImg.src = frames[this.frameIndex];
                                this.characterImg.style.opacity = '1';
                            }
                        }, 50);
                    }

                    // Micro-animations occasionally when IDLE
                    if (Math.random() > 0.95 && this.currentState === 'IDLE') {
                        this.triggerMicroAnimation();
                    }
                }, 350); // Frame rate
            };

            AssistantRenderer.prototype.triggerMicroAnimation = function() {
                if (!this.character) return;

                const microAnimations = ['animate-bounce', 'animate-pulse', 'scale-110'];
                const randomAnimation = microAnimations[Math.floor(Math.random() * microAnimations.length)];

                this.character.classList.add(randomAnimation);
                setTimeout(() => {
                    this.character?.classList.remove(randomAnimation);
                }, 800);
            };

            AssistantRenderer.prototype.render = function() {
                // Create floating assistant container
                const assistantContainer = document.createElement('div');
                assistantContainer.id = 'assistant-container';
                assistantContainer.className = 'fixed bottom-4 right-4 z-50 pointer-events-none';
                assistantContainer.innerHTML = \`
                    <!-- Deepy Character -->
                    <div id="deepy-character" class="relative pointer-events-auto cursor-pointer transform transition-all duration-300 hover:scale-110">
                        <img id="assistant-sprite"
                             src="\${ASSISTANT_ANIMATION_MAP.IDLE[0]}"
                             class="w-20 h-20 object-contain drop-shadow-xl select-none"
                             alt="Deepy Assistant" />
                        <div id="deepy-aura" class="absolute -inset-2 rounded-full opacity-0 transition-opacity duration-500 pointer-events-none"></div>
                    </div>

                    <!-- Speech Bubble -->
                    <div id="speech-bubble" class="absolute bottom-24 right-0 max-w-xs bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-2xl opacity-0 pointer-events-none transition-all duration-300 transform translate-y-2">
                        <div class="relative">
                            <p id="speech-text" class="text-sm text-slate-800 font-bold leading-relaxed"></p>
                            <div class="absolute -bottom-6 right-6 w-4 h-4 bg-white/95 rotate-45 border-r border-b border-slate-200"></div>
                        </div>
                    </div>
                \`;

                document.body.appendChild(assistantContainer);

                // Cache DOM elements
                this.character = document.getElementById('deepy-character');
                this.characterImg = document.getElementById('assistant-sprite');
                this.speechBubble = document.getElementById('speech-bubble');
                this.container = assistantContainer;

                // Start animation loop
                this.startAnimationLoop();

                // Show welcome message
                setTimeout(() => {
                    this.showMessage("¡Hola! Soy Deepy, tu compañero de Deep Work", 'IDLE', 4000);
                }, 500);
            };

            AssistantRenderer.prototype.setupEventListeners = function() {
                if (!this.character) return;

                this.character.addEventListener('click', () => {
                    this.showProductivityFact();
                });

                this.character.addEventListener('mouseenter', () => {
                    this.setCharacterHover(true);
                });

                this.character.addEventListener('mouseleave', () => {
                    this.setCharacterHover(false);
                });
            };

            AssistantRenderer.prototype.showProductivityFact = function() {
                const fact = this.productivityFacts[this.factsClickCount % this.productivityFacts.length];
                this.factsClickCount++;
                this.showMessage(fact, 'IDLE', 5000);
                this.animateCharacter('bounce');
                
                // Notify extension about click
                vscode.postMessage({ 
                    type: 'assistant:click',
                    data: { factIndex: this.factsClickCount - 1 }
                });
            };

            AssistantRenderer.prototype.setCharacterHover = function(isHovering) {
                if (!this.character) return;
                
                const characterDiv = this.character.querySelector('.pixel-art-character');
                const aura = document.getElementById('deepy-aura');
                
                if (isHovering) {
                    characterDiv?.classList.add('border-purple-500');
                    characterDiv?.classList.remove('border-slate-600');
                    if (aura) {
                        aura.className = 'absolute -inset-2 rounded-lg bg-purple-500/20 transition-opacity duration-300 pointer-events-none';
                        aura.style.opacity = '1';
                    }
                } else {
                    characterDiv?.classList.remove('border-purple-500');
                    characterDiv?.classList.add('border-slate-600');
                    if (aura) {
                        aura.style.opacity = '0';
                    }
                }
            };

            AssistantRenderer.prototype.animateCharacter = function(animation) {
                if (!this.character) return;

                const animClass =
                    animation === 'bounce' ? 'animate-bounce' :
                    animation === 'wiggle' ? 'pixel-wiggle' :
                    animation === 'pulse' ? 'animate-pulse' :
                    animation === 'celebrate' ? 'celebration-pulse' :
                    animation === 'shake' ? 'warning-shake' :
                    animation === 'glow' ? 'focus-glow' :
                    'animate-pulse';

                this.character.classList.add(animClass);
                setTimeout(() => {
                    if (this.character) {
                        this.character.classList.remove(animClass);
                    }
                }, 1200);
            };

            AssistantRenderer.prototype.showMessage = function(text, state, duration) {
                duration = duration || 3000;
                
                if (this.isShowingMessage) {
                    this.messageQueue.push({ text, state, duration });
                    return;
                }

                this.showImmediateMessage(text, state, duration);
            };

            AssistantRenderer.prototype.showImmediateMessage = function(text, state, duration) {
                this.isShowingMessage = true;
                this.setState(state);

                if (!this.speechBubble || !this.character) return;

                const speechText = document.getElementById('speech-text');
                if (speechText) {
                    speechText.textContent = text;
                }

                this.speechBubble.classList.remove('opacity-0', 'translate-y-2');
                this.speechBubble.classList.add('opacity-100', 'translate-y-0');

                setTimeout(() => {
                    this.hideMessage();
                }, duration);
            };

            AssistantRenderer.prototype.hideMessage = function() {
                if (!this.speechBubble) return;

                this.speechBubble.classList.add('opacity-0', 'translate-y-2');
                this.speechBubble.classList.remove('opacity-100', 'translate-y-0');

                setTimeout(() => {
                    this.isShowingMessage = false;
                    
                    if (this.messageQueue.length > 0) {
                        const nextMessage = this.messageQueue.shift();
                        this.showImmediateMessage(nextMessage.text, nextMessage.state, nextMessage.duration || 3000);
                    } else {
                        this.setState('IDLE');
                    }
                }, 300);
            };

            AssistantRenderer.prototype.setState = function(state) {
                this.currentState = state;
                this.updateCharacterVisual();
            };

            AssistantRenderer.prototype.updateCharacterVisual = function() {
                if (!this.character || !this.characterImg) return;

                const aura = document.getElementById('deepy-aura');

                // Reset frame index when changing state
                this.frameIndex = 0;

                // Update sprite image to first frame of new state
                const frames = ASSISTANT_ANIMATION_MAP[this.currentState];
                if (frames && frames.length > 0) {
                    this.characterImg.src = frames[0];
                }

                // Update aura based on state
                if (!aura) return;

                // Clear previous classes
                aura.className = 'absolute rounded-full pointer-events-none transition-all duration-500';

                switch (this.currentState) {
                    case 'IDLE':
                        aura.className += ' -inset-2 bg-purple-500/10 blur-sm';
                        aura.style.opacity = '0.3';
                        aura.style.animation = 'gentle-pulse 4s ease-in-out infinite';
                        break;

                    case 'FOCUSED':
                        aura.className += ' -inset-6 bg-blue-500/40 blur-2xl';
                        aura.style.opacity = '0.8';
                        aura.style.animation = 'focus-aura 2s ease-in-out infinite';
                        break;

                    case 'WARNING':
                        aura.className += ' -inset-5 bg-orange-500/30 blur-xl';
                        aura.style.opacity = '0.7';
                        aura.style.animation = 'warning-pulse 1.5s ease-in-out infinite';
                        break;

                    case 'SUCCESS':
                        aura.className += ' -inset-8 bg-gradient-to-r from-yellow-400/50 via-orange-400/50 to-pink-400/50 blur-2xl';
                        aura.style.opacity = '0.9';
                        aura.style.animation = 'celebration-burst 1s ease-out';
                        setTimeout(() => {
                            if (aura && this.currentState === 'SUCCESS') {
                                aura.style.animation = 'gentle-pulse 3s ease-in-out infinite';
                            }
                        }, 1000);
                        break;
                }
            };

            AssistantRenderer.prototype.handleAssistantMessage = function(type, data) {
                switch (type) {
                    case 'show':
                        this.showMessage(data.message, data.state, data.duration);
                        break;
                    case 'celebrate':
                        this.showCelebration(data.type, data.details);
                        break;
                    case 'hide':
                        this.hideMessage();
                        break;
                }
            };

            AssistantRenderer.prototype.showCelebration = function(type, details) {
                let message = '';

                switch (type) {
                    case 'achievement':
                        message = \`¡Logro desbloqueado: \${details?.title || 'Increíble'}!\`;
                        break;
                    case 'level':
                        message = \`¡Nivel \${details?.level || 'superior'} alcanzado! Sigue así\`;
                        break;
                    case 'streak':
                        message = \`¡\${details?.days || 'varios'} días de racha! No pierdas el ritmo\`;
                        break;
                }

                this.showMessage(message, 'SUCCESS', 5000);
                this.animateCharacter('celebrate');
            };

            AssistantRenderer.prototype.destroy = function() {
                // Clear animation interval
                if (this.animationInterval) {
                    clearInterval(this.animationInterval);
                }

                // Remove event listeners
                if (this.character) {
                    this.character.removeEventListener('click', this.showProductivityFact);
                    this.character.removeEventListener('mouseenter', () => this.setCharacterHover(true));
                    this.character.removeEventListener('mouseleave', () => this.setCharacterHover(false));
                }

                // Remove styles
                const styles = document.getElementById('deepy-styles');
                if (styles) {
                    styles.remove();
                }

                // Remove container
                if (this.container) {
                    this.container.remove();
                }
            };

            // Initialize assistant
            assistantRenderer = new AssistantRenderer();

            // Listen for assistant messages from extension
            window.addEventListener('message', function(event) {
                const msg = event.data;
                
                switch (msg.type) {
                    case 'assistant:show':
                        assistantRenderer.showMessage(msg.data.message, msg.data.state, msg.data.duration);
                        break;
                    case 'assistant:celebrate':
                        assistantRenderer.showCelebration(msg.data.type, msg.data.details);
                        break;
                    case 'assistant:hide':
                        assistantRenderer.hideMessage();
                        break;
                }
            });
        }
        
        // Listen for data updates
        window.addEventListener('message', function(event) {
            const msg = event.data;
            if (!msg) return;
            if (msg.type === 'stats:update' && dashboardRenderer) {
                dashboardRenderer.updateData(msg.payload || {});
            }
            if (msg.type === 'friends:update' && dashboardRenderer) {
                dashboardRenderer.updateFriendsTab(msg.payload || {});
            }
            if (msg.type === 'sync-info-update' && dashboardRenderer) {
                dashboardRenderer.syncInfo = msg.payload || {};
            }
            if (msg.type === 'friends:error' && dashboardRenderer) {
                dashboardRenderer.updateFriendsTab({ _error: msg.payload?.message || 'Error desconocido' });
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
    currentPanel.webview.html = getRefactoredHtml(context, currentPanel.webview);
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  console.log("Creando nuevo panel de dashboard");

  // Initialize assistant service
  assistantService = AssistantService.getInstance();

  currentPanel = vscode.window.createWebviewPanel(
    "focusPulseDashboardV2",
    "Focus Pulse Dashboard ",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  // Set webview panel for assistant service
  assistantService.setWebviewPanel(currentPanel);

  console.log("Estableciendo HTML del dashboard");
  currentPanel.webview.html = getRefactoredHtml(context, currentPanel.webview);

currentPanel.webview.onDidReceiveMessage(
    async (msg) => {
      if (!msg) return;

      // Handle different message types
      switch (msg.command || msg.type) {
        case "requestData": {
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
          undefined,
          pomodoroStats,
          undefined,
          deepWork,
          context,
        );
        const allDefs = getAllAchievementsDefinitions();
        const { getCustomAchievements } = require("./achievements");
        const customAchievements = getCustomAchievements(context);

        // Combinar definiciones estáticas con logros personalizados
        const allAchievements = [
          ...allDefs.map((a: any) => ({
            ...a,
            unlocked: achievements.some((u) => u.id === a.id),
          })),
          ...customAchievements.map((a: any) => ({
            ...a,
            unlocked: achievements.some((u) => u.id === a.id),
          })),
        ];
        // Check if deepWork is from StateTypes and convert if needed
        let deepWorkForXp: DeepWorkState | undefined;
        if (isStateTypesDeepWorkState(deepWork)) {
          deepWorkForXp = convertToDeepWorkState(deepWork);
        } else {
          deepWorkForXp = deepWork;
        }

        const xp = computeXpState(historyAll, pomodoroStats, deepWorkForXp);

        // Get sync information
        const syncManager = UserSyncManager.getInstance();
        const currentUser = syncManager.getCurrentUser();
        const syncInfo = {
          isAuthenticated: !!currentUser,
          userEmail: currentUser?.email,
          lastSync: syncManager.getLastSyncTime(),
          autoSyncEnabled: syncManager.isAutoSyncEnabled(),
        };

        // Build friends data for initial load
        let friendsTabData: any = undefined;
        try {
          const { FriendService: FSInit } = require("./friends/FriendService");
          const friendSvcInit = FSInit.getInstance();
          friendSvcInit.setContext(context);
          const friendsList = friendSvcInit.loadFriends();
          const loginInit = await friendSvcInit.getAuthenticatedLogin();
          friendsTabData = {
            friends: friendsList,
            ownProfile: null,
            isAuthenticated: !!syncManager.getCurrentUser(),
            ownUsername: loginInit,
          };
        } catch {
          // friends feature not available — omit gracefully
        }

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
          sync: syncInfo,
          friends: friendsTabData,
        };

        console.log(
          "Enviando datos al dashboard:",
          dashboardData.stats?.length || 0,
          "archivos",
        );
        currentPanel?.webview.postMessage({
          type: "stats:update",
          payload: dashboardData,
        });
          break;
        }
        case "openCustomAchievements": {
          const {
            CustomAchievementManager,
          } = require("./webview/CustomAchievementManager");
          CustomAchievementManager.show(context);
          break;
        }
        case "export": {
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
          break;
        }
        case "export-json": {
          await vscode.commands.executeCommand("focusPulse.exportAsJSON");
          break;
        }
        case "export-xml": {
          await vscode.commands.executeCommand("focusPulse.exportAsXML");
          break;
        }
        case "export-file": {
          await vscode.commands.executeCommand("focusPulse.exportDataToFile");
          break;
        }
        case "import-file": {
          await vscode.commands.executeCommand("focusPulse.importDataFromFile");
          break;
        }
        case "sync-status": {
          await vscode.commands.executeCommand("focusPulse.syncStatus");
          break;
        }
        case "manual-sync": {
          await vscode.commands.executeCommand("focusPulse.manualSync");
          break;
        }
        case "authenticate": {
          await vscode.commands.executeCommand("focusPulse.authenticate");
          // After auth, refresh friends tab + sync info en la webview
          try {
            const { FriendService: FSAuth } = require("./friends/FriendService");
            const fsSvcAuth = FSAuth.getInstance();
            fsSvcAuth.setContext(context);
            const fListAuth = fsSvcAuth.loadFriends();
            const fLoginAuth = await fsSvcAuth.getAuthenticatedLogin();
            const sMgrAuth = UserSyncManager.getInstance();
            const curUserAuth = sMgrAuth.getCurrentUser();
            currentPanel?.webview.postMessage({
              type: "friends:update",
              payload: { friends: fListAuth, ownProfile: null, isAuthenticated: !!curUserAuth, ownUsername: fLoginAuth },
            });
            currentPanel?.webview.postMessage({
              type: "sync-info-update",
              payload: { isAuthenticated: !!curUserAuth, userEmail: curUserAuth?.email, lastSync: sMgrAuth.getLastSyncTime(), autoSyncEnabled: sMgrAuth.isAutoSyncEnabled() },
            });
          } catch { /* ignore */ }
          break;
        }
        case "create-github-token": {
          await vscode.commands.executeCommand("focusPulse.createGitHubToken");
          break;
        }
        case "assistant:ready": {
          console.log("Assistant component is ready");
          if (assistantService) {
            assistantService.setWebviewPanel(currentPanel!);
          }
          break;
        }
        case "assistant:click": {
          console.log("Assistant clicked");
          break;
        }
case "friends:refreshFriends": {
          // Add debouncing for friend refresh calls
          const now = Date.now();
          const lastFriendsRefresh = (globalThis as any).lastFriendsRefresh || 0;
          const FRIENDS_REFRESH_DEBOUNCE = 5000; // 5 seconds

          if (now - lastFriendsRefresh < FRIENDS_REFRESH_DEBOUNCE) {
            console.log("Friends refresh debounced, skipping");
            // Still send cached data to prevent "Actualizando..." getting stuck
            const { FriendService: FSDebounce } = require("./friends/FriendService");
            const friendServiceDebounce = FSDebounce.getInstance();
            friendServiceDebounce.setContext(context);
            const cachedFriends = friendServiceDebounce.loadFriends();
            const cachedLogin = await friendServiceDebounce.getAuthenticatedLogin();
            const syncMgrDebounce = UserSyncManager.getInstance();
            currentPanel?.webview.postMessage({
              type: "friends:update",
              payload: {
                friends: cachedFriends,
                ownProfile: null,
                isAuthenticated: !!syncMgrDebounce.getCurrentUser(),
                ownUsername: cachedLogin
              },
            });
            return;
          }
          (globalThis as any).lastFriendsRefresh = now;

          const { FriendService } = require("./friends/FriendService");
          const friendService = FriendService.getInstance();
          friendService.setContext(context);
          try {
            const friends = await friendService.refreshFriends();
            const login = await friendService.getAuthenticatedLogin();
            const syncMgr = UserSyncManager.getInstance();
            const isAuth = !!syncMgr.getCurrentUser();

            // Build ownProfile from current data
            let ownProfile = null;
            if (isAuth && login) {
              const hist = getHistory();
              const pomStats = getPomodoroStats();
              const streakD = getStreakDays(hist);
              const streakN = Array.isArray(streakD) ? streakD.length : streakD;
              const xpData = computeXpState(hist, pomStats, undefined);
              const statsArr = getStatsArray();
              const dwState = getDeepWorkState(context);
              const unl = computeAchievements(streakN, hist, statsArr, xpData, pomStats, undefined, dwState, context);
              const last7 = hist.slice().sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(-7);
              const avgSc = last7.length > 0
                ? last7.reduce((s: number, d: any) => s + d.avgScore, 0) / last7.length
                : 0;
              const totalMs = hist.reduce((s: number, d: any) => s + (d.totalTimeMs || 0), 0);
              ownProfile = friendService.buildOwnProfile({
                githubLogin: login,
                level: xpData.level,
                totalXp: xpData.totalXp,
                totalFocusTimeMs: totalMs,
                currentStreak: streakN,
                totalPomodoros: pomStats?.total || 0,
                totalAchievements: unl.length,
                avgScoreLast7Days: Math.round(avgSc * 10) / 10,
              });
            }

            currentPanel?.webview.postMessage({
              type: "friends:update",
              payload: { friends, ownProfile, isAuthenticated: isAuth, ownUsername: login },
            });
          } catch (err) {
            // On error, still send current friends list to prevent UI getting stuck
            const friendsOnError = friendService.loadFriends();
            const loginOnError = await friendService.getAuthenticatedLogin();
            const syncMgrOnError = UserSyncManager.getInstance();
            currentPanel?.webview.postMessage({
              type: "friends:update",
              payload: {
                friends: friendsOnError,
                ownProfile: null,
                isAuthenticated: !!syncMgrOnError.getCurrentUser(),
                ownUsername: loginOnError,
                _error: `Error al actualizar amigos: ${String(err)}`
              },
            });
          }
          break;
        }
        case "friends:shareProfile": {
          try {
            await vscode.commands.executeCommand("focusPulse.shareProfile");
            const { FriendService: FS4 } = require("./friends/FriendService");
            const fsSvc4 = FS4.getInstance();
            fsSvc4.setContext(context);
            const fList4 = fsSvc4.loadFriends();
            const fLogin4 = await fsSvc4.getAuthenticatedLogin();
            const sMgr4 = UserSyncManager.getInstance();
            currentPanel?.webview.postMessage({
              type: "friends:update",
              payload: {
                friends: fList4,
                ownProfile: null,
                isAuthenticated: !!sMgr4.getCurrentUser(),
                ownUsername: fLogin4,
                shareComplete: true
              },
            });
          } catch (err) {
            // On error, still send update to reset button state
            const { FriendService: FS4Err } = require("./friends/FriendService");
            const fsSvc4Err = FS4Err.getInstance();
            fsSvc4Err.setContext(context);
            const fList4Err = fsSvc4Err.loadFriends();
            const fLogin4Err = await fsSvc4Err.getAuthenticatedLogin();
            const sMgr4Err = UserSyncManager.getInstance();
            currentPanel?.webview.postMessage({
              type: "friends:update",
              payload: {
                friends: fList4Err,
                ownProfile: null,
                isAuthenticated: !!sMgr4Err.getCurrentUser(),
                ownUsername: fLogin4Err,
                _error: `Error al compartir perfil: ${String(err)}`
              },
            });
          }
          break;
        }
        case "friends:addFriend": {
          const { FriendService: FS2 } = require("./friends/FriendService");
          const friendSvc = FS2.getInstance();
          friendSvc.setContext(context);
          try {
            if (msg.payload?.mode === "username") {
              await friendSvc.addFriendByUsername(msg.payload.value);
            } else {
              await friendSvc.addFriendByGistId(msg.payload.value);
            }
            const updatedFriends = friendSvc.loadFriends();
            const syncMgr2 = UserSyncManager.getInstance();
            const login2 = await friendSvc.getAuthenticatedLogin();
            currentPanel?.webview.postMessage({
              type: "friends:update",
              payload: {
                friends: updatedFriends,
                ownProfile: null,
                isAuthenticated: !!syncMgr2.getCurrentUser(),
                ownUsername: login2
              },
            });
          } catch (err) {
            // Send current friends list with error to reset UI state
            const currentFriends = friendSvc.loadFriends();
            const login2 = await friendSvc.getAuthenticatedLogin();
            const syncMgr2 = UserSyncManager.getInstance();
            currentPanel?.webview.postMessage({
              type: "friends:update",
              payload: {
                friends: currentFriends,
                ownProfile: null,
                isAuthenticated: !!syncMgr2.getCurrentUser(),
                ownUsername: login2,
                _error: String(err)
              },
            });
          }
          break;
        }
        case "friends:removeFriend": {
          const { FriendService: FS3 } = require("./friends/FriendService");
          const friendSvc2 = FS3.getInstance();
          friendSvc2.setContext(context);
          await friendSvc2.removeFriend(msg.payload?.username || "");
          const updatedFriends2 = friendSvc2.loadFriends();
          const syncMgr3 = UserSyncManager.getInstance();
          const login3 = await friendSvc2.getAuthenticatedLogin();
          currentPanel?.webview.postMessage({
            type: "friends:update",
            payload: { friends: updatedFriends2, ownProfile: null, isAuthenticated: !!syncMgr3.getCurrentUser(), ownUsername: login3 },
          });
          break;
        }
        default: {
          console.warn("Unknown message type:", msg.type || msg.command);
        }
      }
    },
    undefined,
    context.subscriptions,
  );

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
      assistantService = undefined;
    },
    null,
    context.subscriptions,
  );
}

export function updateRefactoredDashboard(data: DashboardData) {
  // Check if panel exists before debouncing
  if (!currentPanel) return;

  // Update assistant service with new data
  if (assistantService) {
    assistantService.analyzeDashboardData(data);
  }

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
    // Convert deepWork for computeAchievements if needed
    let deepWorkForAchievement: DeepWorkState | undefined;
    if (isStateTypesDeepWorkState(deepWork)) {
      deepWorkForAchievement = convertToDeepWorkState(deepWork);
    } else {
      deepWorkForAchievement = deepWork;
    }

    const streakDays = getStreakDays(historyAll);
    const achievements = computeAchievements(
      Array.isArray(streakDays) ? streakDays.length : streakDays,
      historyAll,
      statsArray,
      undefined,
      pomodoroStats,
      undefined,
      deepWorkForAchievement,
      context,
    );
    const allDefs = getAllAchievementsDefinitions();
    const { getCustomAchievements } = require("./achievements");
    const customAchievements = getCustomAchievements(context);

    // Combinar definiciones estáticas con logros personalizados
    const allAchievements = [
      ...allDefs.map((a: any) => ({
        ...a,
        unlocked: achievements.some((u) => u.id === a.id),
      })),
      ...customAchievements.map((a: any) => ({
        ...a,
        unlocked: achievements.some((u) => u.id === a.id),
      })),
    ];
    // Check if deepWork is from StateTypes and convert if needed
    let deepWorkForXp: DeepWorkState | undefined;
    if (isStateTypesDeepWorkState(deepWork)) {
      deepWorkForXp = convertToDeepWorkState(deepWork);
    } else {
      deepWorkForXp = deepWork;
    }

    const xp = computeXpState(historyAll, pomodoroStats, deepWorkForXp);

    // Get sync information
    const syncManager = UserSyncManager.getInstance();
    const currentUser = syncManager.getCurrentUser();
    const syncInfo = {
      isAuthenticated: !!currentUser,
      userEmail: currentUser?.email,
      lastSync: syncManager.getLastSyncTime(),
      autoSyncEnabled: syncManager.isAutoSyncEnabled(),
    };

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
      sync: syncInfo,
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
      undefined,
      pomodoroStats,
      undefined,
      deepWork,
      context,
    );
    const allDefs = getAllAchievementsDefinitions();
    const { getCustomAchievements } = require("./achievements");
    const customAchievements = getCustomAchievements(context);

    // Combinar definiciones estáticas con logros personalizados
    const allAchievements = [
      ...allDefs.map((a: any) => ({
        ...a,
        unlocked: achievements.some((u) => u.id === a.id),
      })),
      ...customAchievements.map((a: any) => ({
        ...a,
        unlocked: achievements.some((u) => u.id === a.id),
      })),
    ];
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
