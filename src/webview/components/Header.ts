import { DashboardData, DashboardComponent } from '../types';

export class HeaderComponent implements DashboardComponent {
  private container: any;

  render(container: any, data: DashboardData): void {
    this.container = container;
    container.innerHTML = `
      <header class="flex flex-col gap-2">
        <div>
          <h1 class="text-2xl font-semibold flex items-center gap-2">
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              ⚡
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
        <div id="deepwork-pill" class="text-[11px] text-slate-500"></div>
      </header>
    `;
    
    this.update(data);
  }

  update(data: DashboardData): void {
    const xp = data.xp || { totalXp: 0, level: 1, xpInLevel: 0, xpToNext: 100 };
    const deepWork = data.deepWork;

    // Update XP
    const levelEl = document.getElementById('xp-level');
    const barEl = document.getElementById('xp-bar-inner');
    const labelEl = document.getElementById('xp-label');

    if (levelEl) levelEl.textContent = String(xp.level);
    if (barEl) {
      const pct = xp.xpToNext > 0 
        ? Math.max(0, Math.min(100, (xp.xpInLevel / xp.xpToNext) * 100))
        : 0;
      barEl.style.width = pct.toFixed(1) + '%';
    }
    if (labelEl) labelEl.textContent = Math.round(xp.totalXp) + ' XP total';

    // Update Deep Work pill
    const deepWorkPillEl = document.getElementById('deepwork-pill');
    if (deepWorkPillEl) {
      if (!deepWork) {
        deepWorkPillEl.textContent = "";
      } else if (deepWork.active) {
        deepWorkPillEl.textContent = "🧠 Deep Work activo";
        deepWorkPillEl.className = "text-[11px] text-emerald-300 mt-1";
      } else {
        deepWorkPillEl.textContent = "Deep Work inactivo (pulsa en la barra de estado para iniciar)";
        deepWorkPillEl.className = "text-[11px] text-slate-500 mt-1";
      }
    }
  }

  destroy(): void {
    // Cleanup if needed
  }
}