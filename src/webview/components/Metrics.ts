import { DashboardData, DashboardComponent } from '../types';
import { formatTimeShort } from '../../utils/formatters';

export class MetricsComponent implements DashboardComponent {
  private container: any;

  render(container: any, data: DashboardData): void {
    this.container = container;
    container.innerHTML = `
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
    `;
    
    this.update(data);
    this.setupEventListeners();
  }

  update(data: DashboardData): void {
    const stats = data.stats || [];
    const history7 = data.history7 || [];
    const streak = data.streak || 0;
    const pomodoroStats = data.pomodoroStats || { today: 0, total: 0 };

    // Update streak
    const streakEl = document.getElementById('streak-value');
    if (streakEl) {
      streakEl.textContent = String(streak) + (streak === 1 ? ' día' : ' días');
    }

    // Update last 7 days
    const last7TimeEl = document.getElementById('last7-time');
    const last7ScoreEl = document.getElementById('last7-score');
    
    if (!history7.length) {
      if (last7TimeEl) last7TimeEl.textContent = '0s';
      if (last7ScoreEl) last7ScoreEl.textContent = '-';
    } else {
      const totalMs = history7.reduce((a, h) => a + h.totalTimeMs, 0);
      const avgScore = history7.reduce((a, h) => a + h.avgScore, 0) / history7.length;
      if (last7TimeEl) last7TimeEl.textContent = formatTimeShort(totalMs);
      if (last7ScoreEl) last7ScoreEl.textContent = String(Math.round(avgScore));
    }

    // Update files today
    const filesTodayEl = document.getElementById('files-today');
    if (filesTodayEl) {
      filesTodayEl.textContent = String(stats.length);
    }

    // Update pomodoros
    const pomodoroTodayEl = document.getElementById('pomodoro-today');
    const pomodoroTotalEl = document.getElementById('pomodoro-total');
    
    if (pomodoroTodayEl) pomodoroTodayEl.textContent = String(pomodoroStats.today || 0);
    if (pomodoroTotalEl) pomodoroTotalEl.textContent = String(pomodoroStats.total || 0);
  }

  private setupEventListeners(): void {
    const exportJsonBtn = document.getElementById('export-json-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');

    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => {
        // @ts-ignore
        if (typeof vscode !== 'undefined') {
          // @ts-ignore
          vscode.postMessage({ type: 'export', format: 'json' });
        }
      });
    }
    
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        // @ts-ignore
        if (typeof vscode !== 'undefined') {
          // @ts-ignore
          vscode.postMessage({ type: 'export', format: 'csv' });
        }
      });
    }
  }

  destroy(): void {
    // Cleanup event listeners if needed
  }
}