import { DashboardData, DashboardComponent } from "../types";

export class TableComponent implements DashboardComponent {
  private container: any;

  render(container: any, data: DashboardData): void {
    this.container = container;
    container.innerHTML = `
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
                <th class="px-4 py-2">Δ texto</th>
                <th class="px-4 py-2">Cambios</th>
              </tr>
            </thead>
            <tbody id="table-body" class="divide-y divide-slate-800/80 bg-slate-900/40"></tbody>
          </table>
        </div>
      </section>
    `;

    this.update(data);
  }

  update(data: DashboardData): void {
    const stats = data.stats || [];
    const tableBodyEl = document.getElementById("table-body");
    const summaryLabelEl = document.getElementById("summary-label");

    if (!tableBodyEl || !summaryLabelEl) return;

    this.clearChildren(tableBodyEl);

    if (!stats.length) {
      summaryLabelEl.textContent = "0 archivos registrados";
      return;
    }

    summaryLabelEl.textContent =
      stats.length + (stats.length === 1 ? " archivo" : " archivos");

    stats.forEach((item) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-800/80 transition-colors";

      tr.innerHTML = `
        <td class="px-4 py-2 text-slate-100 whitespace-nowrap max-w-xs truncate">
          ${item.fileName}
        </td>
        <td class="px-4 py-2">
          <span class="inline-flex items-center gap-1">
            <span class="inline-block w-6 text-slate-100">${item.score}</span>
            <span class="h-1.5 w-16 rounded-full bg-slate-700 overflow-hidden">
              <span class="block h-full bg-emerald-500" style="width: ${item.score}%;"></span>
            </span>
          </span>
        </td>
        <td class="px-4 py-2 text-slate-100">${item.timeText}</td>
        <td class="px-4 py-2 text-slate-100">${item.edits}</td>
        <td class="px-4 py-2 text-slate-100">
          <span class="text-emerald-300">+${item.added}</span>
          <span class="text-slate-500 mx-1">/</span>
          <span class="text-rose-300">-${item.deleted}</span>
        </td>
        <td class="px-4 py-2 text-slate-100">${item.switches}</td>
      `;

      tableBodyEl.appendChild(tr);
    });
  }

  private clearChildren(el: any): void {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  destroy(): void {
    // Cleanup if needed
  }
}
