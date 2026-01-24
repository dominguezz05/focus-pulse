import { DashboardData, DashboardComponent } from '../types';

export class GoalsComponent implements DashboardComponent {
  private container: any;
  private isAnimating = false;
  private goalStatusLabelEl: any = null;
  private goalContentEl: any = null;

  render(container: any, data: DashboardData): void {
    this.container = container;
    container.innerHTML = `
      <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-medium text-slate-200">🎯 Objetivo de hoy</h2>
          <span id="goal-status-label" class="text-xs text-slate-400">Sin objetivo configurado</span>
        </div>
        <div id="goal-content" class="space-y-2 text-xs text-slate-300">
          <p class="text-slate-500 text-xs">
            Configura los objetivos diarios en las opciones de Focus Pulse.
          </p>
        </div>
      </section>
    `;
    
    this.update(data);
  }

  update(data: DashboardData): void {
    const goals = data.goals;
    const goalStatusLabelEl = document.getElementById('goal-status-label');
    const goalContentEl = document.getElementById('goal-content');

    if (!goalStatusLabelEl || !goalContentEl) return;

    if (!goals || !goals.enabled) {
      goalStatusLabelEl.textContent = 'Objetivos desactivados';
      goalContentEl.innerHTML = 
        '<p class="text-slate-500 text-xs">Activa los objetivos diarios en la configuración de Focus Pulse.</p>';
      return;
    }

    const min = Math.round(goals.minutesDone);
    const targetMin = goals.targetMinutes;
    const pom = goals.pomodorosDone;
    const targetPom = goals.targetPomodoros;

    const pctMin = Math.max(0, Math.min(100, (min / targetMin) * 100));
    const pctPom = targetPom > 0 ? Math.max(0, Math.min(100, (pom / targetPom) * 100)) : 100;

    // 🎨 Animación de actualización con bounce effect
    if (!this.isAnimating) {
      this.isAnimating = true;
      goalContentEl.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2)';
      goalContentEl.style.transform = 'scale(0.98)';
      
      setTimeout(() => {
        goalContentEl.style.transform = 'scale(1)';
        goalContentEl.style.transition = '';
        this.isAnimating = false;
      }, 50);
    }

    goalStatusLabelEl.textContent = goals.allDone 
      ? '✅ Objetivo completado' 
      : 'En progreso';
      
    goalContentEl.innerHTML = `
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span>Minutos de foco</span>
          <span class="text-slate-200 font-semibold goal-value-update" data-value="${min}" data-target="${targetMin}">${min}/${targetMin} min</span>
        </div>
        <div class="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
          <div class="h-full bg-sky-500 transition-all goal-progress-bar" style="width: ${pctMin}%"></div>
        </div>
      </div>
      <div class="space-y-1.5 mt-2">
        <div class="flex items-center justify-between">
          <span>Pomodoros</span>
          <span class="text-slate-200 font-semibold goal-value-update" data-value="${pom}" data-target="${targetPom}">${pom}/${targetPom}</span>
        </div>
        <div class="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
          <div class="h-full bg-emerald-500 transition-all goal-progress-bar" style="width: ${pctPom}%"></div>
        </div>
      </div>
      ${goals.allDone 
        ? '<p class="text-[11px] text-emerald-300 mt-2 goal-celebration">🎉 ¡Objetivo completado! Buen trabajo 👏</p>'
        : '<p class="text-[11px] text-slate-500 mt-2">Completa ambos objetivos para cerrar el día 💪</p>'
      }
    `;
  }

  destroy(): void {
    // Cleanup if needed
  }
}