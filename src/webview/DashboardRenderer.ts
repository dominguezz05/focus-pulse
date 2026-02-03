import { DashboardData, DashboardComponent } from "./types";
import { HeaderComponent } from "./components/Header";
import { MetricsComponent } from "./components/Metrics";
import { GoalsComponent } from "./components/Goals";
import { HeatmapComponent } from "./components/Heatmap";
import { AchievementsComponent } from "./components/Achievements";
import { TableComponent } from "./components/Table";
import { AssistantComponent } from "./components/Assistant";
import { AuthComponent } from "./components/AuthComponent";
import { NotificationsComponent } from "./components/Notifications";

export class DashboardRenderer {
  private components: Map<string, DashboardComponent> = new Map();
  private container: any;

  constructor() {
    // Initialize all components
    this.components.set("header", new HeaderComponent());
    this.components.set("metrics", new MetricsComponent());
    this.components.set("goals", new GoalsComponent());
    this.components.set("heatmap", new HeatmapComponent());
    this.components.set("achievements", new AchievementsComponent());
    this.components.set("table", new TableComponent());
    this.components.set("assistant", new AssistantComponent());
    this.components.set("auth", new AuthComponent());
    this.components.set("notifications", new NotificationsComponent());
  }

  render(container: any, data: DashboardData): void {
    this.container = container;
    container.innerHTML = `
      <div class="max-w-6xl mx-auto p-4 space-y-4">
        <div id="auth-container"></div>
        <div id="header-container"></div>
        <div id="metrics-container"></div>
        <div id="goals-container"></div>
        <div id="insights-container"></div>
        <div id="heatmap-container"></div>
        <div id="weekly-summary-container"></div>
        <div id="achievements-container"></div>
        <div id="cards-container"></div>
        <div id="table-container"></div>
        <div id="assistant-container"></div>
      </div>
    `;

    // Render each component
    this.renderComponent("auth", data);
    this.renderComponent("header", data);
    this.renderComponent("metrics", data);
    this.renderComponent("goals", data);
    this.renderComponent("heatmap", data);
    this.renderComponent("achievements", data);
    this.renderComponent("table", data);

    // Render assistant component (fixed position)
    this.renderComponent("assistant", data);

    // Render insights and weekly summary (simple components)
    this.renderInsights(data);
    this.renderWeeklySummary(data);
    this.renderCards(data);
  }

  update(data: DashboardData): void {
    // Update all components
    this.components.forEach((component) => {
      if (component.update) {
        component.update(data);
      }
    });

    // Update simple components
    this.renderInsights(data);
    this.renderWeeklySummary(data);
    this.renderCards(data);
  }

  // Public method for assistant-specific updates
  updateAssistant(data: { type: string; payload: any }): void {
    const assistant = this.components.get("assistant");
    if (assistant && (assistant as any).handleAssistantMessage) {
      (assistant as any).handleAssistantMessage(data.type, data.payload);
    }
  }

  private renderComponent(key: string, data: DashboardData): void {
    const component = this.components.get(key);
    if (!component) return;

    const containerId = `${key}-container`;
    const container = document.getElementById(containerId);
    if (container) {
      component.render(container, data);
    }
  }

  private renderInsights(data: DashboardData): void {
    const container = document.getElementById("insights-container");
    if (!container) return;

    const historyAll = data.historyAll || [];

    container.innerHTML = `
      <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
        <div class="flex items-center justify-between mb-1">
          <h2 class="text-sm font-medium text-slate-200">Insights rápidos</h2>
        </div>
        <div id="insights" class="text-xs text-slate-300 space-y-1">
          ${this.buildInsightsHTML(historyAll)}
        </div>
      </section>
    `;
  }

  private renderWeeklySummary(data: DashboardData): void {
    const container = document.getElementById("weekly-summary-container");
    if (!container) return;

    const weeklySummary = data.weeklySummary || [];

    container.innerHTML = `
      <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-medium text-slate-200">Resumen semanal</h2>
          <span class="text-[11px] text-slate-500">Minutos totales por semana</span>
        </div>
        <div id="weekly-summary" class="space-y-1 text-[11px] text-slate-300">
          ${this.buildWeeklySummaryHTML(weeklySummary)}
        </div>
      </section>
    `;
  }

  private renderCards(data: DashboardData): void {
    const container = document.getElementById("cards-container");
    if (!container) return;

    const stats = data.stats || [];

    container.innerHTML = `
      <section id="cards" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        ${
          !stats.length
            ? `
          <div class="col-span-full bg-slate-800/60 rounded-xl border border-dashed border-slate-700/70 p-4">
            <p class="text-sm font-medium text-slate-200">Sin datos todavía</p>
            <p class="text-xs text-slate-400 mt-1">
              Empieza a trabajar en uno o más archivos y sigue editando para ver estadísticas en tiempo real.
            </p>
          </div>
        `
            : ""
        }
      </section>
    `;

    // Render top 3 cards
    const top = stats.slice(0, 3);
    const cardsEl = document.getElementById("cards");
    if (cardsEl && top.length > 0) {
      top.forEach((item, index) => {
        const div = document.createElement("div");
        div.className =
          "bg-slate-800/70 rounded-xl border border-slate-700/70 p-3 flex flex-col gap-2 shadow-sm";

        const color = this.scoreColor(item.score);
        const badgeClasses = this.scoreBadgeClasses(item.score);
        const rank = index + 1;

        div.innerHTML = `
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-[10px] uppercase tracking-wide text-slate-400">Top ${rank}</div>
              <div class="text-sm font-medium text-slate-100 truncate">${item.fileName}</div>
            </div>
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClasses}">
              ${item.score}/100
            </span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Tiempo: <span class="text-slate-200">${item.timeText}</span></span>
            <span>Ediciones: <span class="text-slate-200">${item.edits}</span></span>
            <span>Cambios: <span class="text-slate-200">${item.switches}</span></span>
          </div>
          <div class="mt-1.5">
            <div class="w-full h-2 rounded-full bg-slate-700/80 overflow-hidden">
              <div class="h-full rounded-full ${color}" style="width: ${item.score}%;"></div>
            </div>
          </div>
        `;

        cardsEl.appendChild(div);
      });
    }
  }

  private buildInsightsHTML(historyAll: any[]): string {
    if (!historyAll || historyAll.length < 2) {
      return '<p class="text-slate-500 text-xs">Aún no hay suficientes días para comparar (mínimo 2).</p>';
    }

    const sorted = historyAll
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const today = sorted[sorted.length - 1];
    const yesterday = sorted[sorted.length - 2];

    const todayMin = today.totalTimeMs / 60000;
    const yesterdayMin = yesterday.totalTimeMs / 60000;

    const diffMin = todayMin - yesterdayMin;
    const diffPct = yesterdayMin > 0 ? (diffMin / yesterdayMin) * 100 : 0;

    const arrow = diffMin > 0 ? "↑" : diffMin < 0 ? "↓" : "→";
    const trendClass =
      diffMin > 0
        ? "text-emerald-300"
        : diffMin < 0
          ? "text-rose-300"
          : "text-slate-300";

    const scoreDiff = today.avgScore - yesterday.avgScore;
    const scoreArrow = scoreDiff > 0 ? "↑" : scoreDiff < 0 ? "↓" : "→";
    const scoreClass =
      scoreDiff > 0
        ? "text-emerald-300"
        : scoreDiff < 0
          ? "text-rose-300"
          : "text-slate-300";

    return `
      <p>
        Hoy has trabajado <span class="${trendClass}">${arrow} ${Math.round(Math.abs(diffMin))} min</span> 
        ${diffMin >= 0 ? "más" : "menos"} que ayer.
      </p>
      <p>
        Tu foco medio ha ${scoreDiff > 0 ? "mejorado" : scoreDiff < 0 ? "bajado" : "quedado igual"}: 
        <span class="${scoreClass}">${scoreArrow} ${Math.round(Math.abs(scoreDiff))}</span> puntos frente a ayer.
      </p>
    `;
  }

  private buildWeeklySummaryHTML(weekly: any[]): string {
    if (!weekly || !weekly.length) {
      return '<p class="text-slate-500 text-xs">Todavía no hay datos suficientes.</p>';
    }

    return weekly
      .map((w) => {
        const pct = Math.max(5, Math.min(100, (w.totalMinutes / 600) * 100));
        return `
        <div class="flex items-center gap-2">
          <span class="w-16 text-slate-400">${w.weekLabel}</span>
          <div class="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
            <div class="h-full bg-indigo-400" style="width: ${pct}%;"></div>
          </div>
          <span class="w-24 text-right text-slate-300">
            ${Math.round(w.totalMinutes)} min · ${w.avgScore.toFixed(0)}/100
          </span>
        </div>
      `;
      })
      .join("");
  }

  private scoreColor(score: number): string {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 50) return "bg-amber-400";
    return "bg-rose-500";
  }

  private scoreBadgeClasses(score: number): string {
    if (score >= 80)
      return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
    if (score >= 50)
      return "bg-amber-400/20 text-amber-300 border border-amber-400/40";
    return "bg-rose-500/20 text-rose-300 border border-rose-500/40";
  }

  destroy(): void {
    this.components.forEach((component) => {
      if (component.destroy) {
        component.destroy();
      }
    });
  }
}
