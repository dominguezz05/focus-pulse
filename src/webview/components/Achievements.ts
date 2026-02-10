import { DashboardData, DashboardComponent } from "../types";

export class AchievementsComponent implements DashboardComponent {
  private container: any;
  private showAllAchievements = false;
  private achievementQueue: Array<{ achievement: any; index: number }> = [];

  render(container: any, data: DashboardData): void {
    this.container = container;
    container.innerHTML = `
      <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-medium text-slate-200">Today's Achievements</h2>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400" id="achievements-count">0 achievements</span>
            <button
              id="achievements-toggle"
              class="text-[11px] text-sky-400 hover:underline"
              type="button"
            >
              View all
            </button>
          </div>
        </div>
        <div id="achievements" class="flex flex-wrap gap-2 text-xs">
          <span class="text-slate-400 text-xs">No data yet</span>
        </div>
        <div
          id="all-achievements"
          class="mt-3 grid gap-2 sm:grid-cols-2 text-xs hidden"
        ></div>
      </section>
    `;

    this.update(data);
    this.setupEventListeners();
  }

  update(data: DashboardData): void {
    const achievements = data.achievements || [];
    const allAchievements = data.allAchievements || [];

    // Update today's achievements
    const achievementsEl = document.getElementById("achievements");
    const achievementsCountEl = document.getElementById("achievements-count");

    if (achievementsEl) {
      this.clearChildren(achievementsEl);

      if (!achievements.length) {
        achievementsEl.innerHTML =
          '<span class="text-slate-400 text-xs">No achievements yet. Keep working and check back later.</span>';
      } else {
        achievements.forEach((a) => {
          const span = document.createElement("span");
          span.className =
            "inline-flex flex-col gap-0.5 rounded-lg border border-emerald-600/50 bg-emerald-500/10 px-2 py-1";
          span.innerHTML =
            '<span class="text-[11px] font-semibold text-emerald-300">' +
            a.title +
            '</span><span class="text-[10px] text-emerald-200/80">' +
            a.description +
            "</span>";
          achievementsEl.appendChild(span);
        });
      }
    }

    if (achievementsCountEl) {
      achievementsCountEl.textContent =
        achievements.length +
        (achievements.length === 1 ? " logro" : " logros");
    }

    // Update all achievements
    this.buildAllAchievements(allAchievements);
  }

  private setupEventListeners(): void {
    const achievementsToggleEl = document.getElementById("achievements-toggle");
    const allAchievementsEl = document.getElementById("all-achievements");

    if (achievementsToggleEl) {
      achievementsToggleEl.addEventListener("click", () => {
        this.showAllAchievements = !this.showAllAchievements;
        if (!allAchievementsEl) return;

        if (this.showAllAchievements) {
          allAchievementsEl.classList.remove("hidden");
          achievementsToggleEl.textContent = "Hide all";
        } else {
          allAchievementsEl.classList.add("hidden");
          achievementsToggleEl.textContent = "View all";
        }
      });
    }
  }

  private buildAllAchievements(all: any[]): void {
    const allAchievementsEl = document.getElementById("all-achievements");
    if (!allAchievementsEl) return;

    this.clearChildren(allAchievementsEl);

    if (!all || !all.length) {
      const p = document.createElement("p");
      p.className = "text-[11px] text-slate-500";
      p.textContent = "No achievement catalog available yet.";
      allAchievementsEl.appendChild(p);
      return;
    }

    all.forEach((a) => {
      const div = document.createElement("div");
      const base =
        "px-2 py-1 rounded-lg border text-[11px] flex flex-col gap-0.5";

      if (a.unlocked) {
        div.className =
          base + " border-emerald-500/60 bg-emerald-500/10 text-emerald-200";
      } else {
        div.className =
          base + " border-slate-700 bg-slate-900/80 text-slate-500";
      }

      div.innerHTML =
        '<span class="font-semibold">' +
        a.title +
        "</span>" +
        '<span class="text-[10px] opacity-80">' +
        a.description +
        "</span>";

      allAchievementsEl.appendChild(div);
    });
  }

  private clearChildren(el: any): void {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  destroy(): void {
    // Cleanup event listeners if needed
  }
}
