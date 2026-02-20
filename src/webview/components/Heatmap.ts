import { DashboardData, DashboardComponent } from '../types';
import { formatTimeShort } from '../../utils/formatters';

export class HeatmapComponent implements DashboardComponent {
  private container: any;

  render(container: any, data: DashboardData): void {
    this.container = container;
    container.innerHTML = `
      <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-medium text-slate-200">Heatmap de productividad (últimos 30 días)</h2>
          <span class="text-[11px] text-slate-500">Intensidad basada en minutos de foco</span>
        </div>
        <div id="heatmap" class="flex flex-col gap-1 text-[10px] text-slate-400"></div>
      </section>
    `;
    
    this.update(data);
  }

  update(data: DashboardData): void {
    const historyAll = data.historyAll || [];
    const heatmapEl = document.getElementById('heatmap');
    
    if (!heatmapEl) return;
    
    this.clearChildren(heatmapEl);
    
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
        '\n' + 
        'Tiempo: ' + formatTimeShort(day.totalTimeMs) + 
        '\nScore medio: ' + Math.round(day.avgScore);

      row.appendChild(cell);
    });

    heatmapEl.appendChild(row);
  }

  private clearChildren(el: any): void {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  destroy(): void {
    // Cleanup if needed
  }
}