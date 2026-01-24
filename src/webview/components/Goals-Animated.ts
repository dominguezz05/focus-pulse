import { DashboardData, DashboardComponent } from '../types';

interface AchievementAnimation {
  element: any;
  timeout?: number;
}

export class GoalsAnimatedComponent implements DashboardComponent {
  private container: any;
  private isAnimating = false;
  private achievementAnimations: AchievementAnimation[] = [];

  render(container: any, data: DashboardData): void {
    this.container = container;
    container.innerHTML = `
      <section class="bg-slate-800/80 rounded-xl border border-slate-700/70 p-3">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-medium text-slate-200">🎯 Objetivo de hoy</h2>
          <span id="goal-status-label" class="text-xs text-slate-400">Sin objetivo configurado</span>
        </div>
        <div id="goal-content" class="space-y-2 text-xs text-slate-300">
          <p class="text-slate-500 text-xs">Configura los objetivos diarios en las opciones de Focus Pulse.</p>
        </div>
      </section>
    `;
    
    this.update(data);
  }

  update(data: DashboardData): void {
    const goals = data.goals;
    const statusLabel = document.getElementById('goal-status-label');
    const contentElement = document.getElementById('goal-content');

    if (!statusLabel || !contentElement) return;

    if (!goals || !goals.enabled) {
      statusLabel.textContent = 'Objetivos desactivados';
      contentElement.innerHTML = 
        '<p class="text-slate-500 text-xs">Activa los objetivos diarios en la configuración de Focus Pulse.</p>';
      return;
    }

    const min = Math.round(goals.minutesDone);
    const targetMin = goals.targetMinutes;
    const pom = goals.pomodorosDone;
    const targetPom = goals.targetPomodoros;

    const pctMin = Math.max(0, Math.min(100, (min / targetMin) * 100));
    const pctPom = targetPom > 0 ? Math.max(0, Math.min(100, (pom / targetPom) * 100)) : 100;

    // 🎨 Animación con efectos de celebración mejorados
    if (!this.isAnimating) {
      this.isAnimating = true;
      contentElement.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265)';
      contentElement.style.transform = 'scale(1.05)';
      
      setTimeout(() => {
        contentElement.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2)';
        contentElement.style.transform = 'scale(1)';
        contentElement.style.transition = '';
        this.isAnimating = false;
       }, 150);
    }
  }



  private triggerCelebration(container: any, message: string): void {
    // Crear elemento de celebración temporal
    const celebration = document.createElement('div');
    celebration.className = 'goal-celebration';
    celebration.textContent = message;
    
    // Añadir al DOM temporalmente
    this.container.appendChild(celebration);
    
    // Remover después de la animación
    setTimeout(() => {
      if (this.container && this.container.contains(celebration)) {
        this.container.removeChild(celebration);
      }
    }, 2000);
  }

  destroy(): void {
    // Limpiar animaciones pendientes
    this.achievementAnimations.forEach(anim => {
      if (anim.timeout) {
        clearTimeout(anim.timeout);
      }
      anim.element.remove();
    });
    this.achievementAnimations = [];
    this.container = null;
  }
}