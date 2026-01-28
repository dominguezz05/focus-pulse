import { DashboardData, DashboardComponent } from '../types';

export type AssistantState = 'IDLE' | 'FOCUSED' | 'WARNING';

export interface AssistantMessage {
  text: string;
  state: AssistantState;
  duration?: number;
}

export class AssistantComponent implements DashboardComponent {
  private container: any;
  private currentState: AssistantState = 'IDLE';
  private speechBubble: HTMLElement | null = null;
  private character: HTMLElement | null = null;
  private messageQueue: AssistantMessage[] = [];
  private isShowingMessage = false;
  private factsClickCount = 0;

  // Productivity facts for click interaction
  private productivityFacts = [
    "¿Sabías que tardas 23 minutos en recuperar el foco tras una interrupción?",
    "El cerebro humano mantiene el foco máximo por ~45 minutos seguidos",
    "Trabajar en bloques de 90min + 15min de descanso es óptimo para productividad",
    "Hacer pausas cada 25 minutos aumenta un 13% tu productividad diaria",
    "La música sin letra puede mejorar tu concentración hasta en un 15%",
    "El multitasking reduce tu productividad en un 40% comparado con el trabajo enfocado"
  ];

  constructor() {
    this.setupGlobalStyles();
  }

  render(container: any, data: DashboardData): void {
    this.container = container;
    
    // Create floating assistant container
    const assistantContainer = document.createElement('div');
    assistantContainer.id = 'assistant-container';
    assistantContainer.className = 'fixed bottom-4 right-4 z-50 pointer-events-none';
    assistantContainer.innerHTML = `
      <!-- Deepy Character -->
      <div id="deepy-character" class="relative pointer-events-auto cursor-pointer transform transition-all duration-300 hover:scale-110">
        <div class="pixel-art-character w-16 h-16 bg-slate-800 rounded-lg border-4 border-slate-600 shadow-xl flex items-center justify-center text-2xl select-none hover:shadow-purple-500/50">
          😊
        </div>
        <div id="deepy-aura" class="absolute -inset-2 rounded-lg opacity-0 transition-opacity duration-500 pointer-events-none"></div>
      </div>
      
      <!-- Speech Bubble -->
      <div id="speech-bubble" class="absolute bottom-20 right-0 max-w-xs bg-white/90 backdrop-blur-md border border-slate-300 rounded-xl p-3 shadow-xl opacity-0 pointer-events-none transition-all duration-300 transform translate-y-2">
        <div class="relative">
          <p id="speech-text" class="text-sm text-slate-800 font-medium"></p>
          <div class="absolute -bottom-2 right-4 w-0 h-0 border-l-8 border-l-transparent border-t-8 border-t-white/90 border-r-8 border-r-transparent"></div>
        </div>
      </div>
    `;

    container.appendChild(assistantContainer);

    // Cache DOM elements
    this.character = document.getElementById('deepy-character');
    this.speechBubble = document.getElementById('speech-bubble');

    // Setup event listeners
    this.setupEventListeners();

    // Show welcome message
    this.showMessage("¡Hola! Soy Deepy, tu compañero de Deep Work 💪", 'IDLE', 4000);
  }

  private setupEventListeners(): void {
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
  }

  private showProductivityFact(): void {
    const fact = this.productivityFacts[this.factsClickCount % this.productivityFacts.length];
    this.factsClickCount++;
    this.showMessage(fact, 'IDLE', 5000);
    
    // Animate character when clicked
    this.animateCharacter('bounce');
  }

  private setCharacterHover(isHovering: boolean): void {
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
  }

  private animateCharacter(animation: 'bounce' | 'wiggle' | 'pulse'): void {
    if (!this.character) return;

    const characterDiv = this.character.querySelector('.pixel-art-character');
    
    switch (animation) {
      case 'bounce':
        characterDiv?.classList.add('animate-bounce');
        setTimeout(() => characterDiv?.classList.remove('animate-bounce'), 600);
        break;
      case 'wiggle':
        characterDiv?.classList.add('animate-pulse');
        setTimeout(() => characterDiv?.classList.remove('animate-pulse'), 600);
        break;
      case 'pulse':
        characterDiv?.classList.add('animate-ping');
        setTimeout(() => characterDiv?.classList.remove('animate-ping'), 600);
        break;
    }
  }

  showMessage(text: string, state: AssistantState, duration: number = 3000): void {
    // Add to queue if currently showing message
    if (this.isShowingMessage) {
      this.messageQueue.push({ text, state, duration });
      return;
    }

    this.showImmediateMessage(text, state, duration);
  }

  private showImmediateMessage(text: string, state: AssistantState, duration: number): void {
    this.isShowingMessage = true;
    this.setState(state);

    if (!this.speechBubble || !this.character) return;

    const speechText = document.getElementById('speech-text');
    if (speechText) {
      speechText.textContent = text;
    }

    // Show speech bubble with animation
    this.speechBubble.classList.remove('opacity-0', 'translate-y-2');
    this.speechBubble.classList.add('opacity-100', 'translate-y-0');

    // Hide after duration
    setTimeout(() => {
      this.hideMessage();
    }, duration);
  }

  private hideMessage(): void {
    if (!this.speechBubble) return;

    this.speechBubble.classList.add('opacity-0', 'translate-y-2');
    this.speechBubble.classList.remove('opacity-100', 'translate-y-0');

    setTimeout(() => {
      this.isShowingMessage = false;
      
      // Process next message in queue
      if (this.messageQueue.length > 0) {
        const nextMessage = this.messageQueue.shift()!;
        this.showImmediateMessage(nextMessage.text, nextMessage.state, nextMessage.duration || 3000);
      } else {
        this.setState('IDLE');
      }
    }, 300);
  }

  setState(state: AssistantState): void {
    this.currentState = state;
    this.updateCharacterVisual();
  }

  private updateCharacterVisual(): void {
    if (!this.character) return;

    const characterDiv = this.character.querySelector('.pixel-art-character');
    const aura = document.getElementById('deepy-aura');

    switch (this.currentState) {
      case 'IDLE':
        if (characterDiv) {
          characterDiv.textContent = '😊';
          characterDiv.className = 'pixel-art-character w-16 h-16 bg-slate-800 rounded-lg border-4 border-slate-600 shadow-xl flex items-center justify-center text-2xl select-none hover:shadow-purple-500/50';
        }
        if (aura) {
          aura.style.opacity = '0';
          aura.className = 'absolute -inset-2 rounded-lg opacity-0 transition-opacity duration-500 pointer-events-none';
        }
        break;

      case 'FOCUSED':
        if (characterDiv) {
          characterDiv.textContent = '🧠';
          characterDiv.className = 'pixel-art-character w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg border-4 border-blue-400 shadow-xl shadow-blue-500/50 flex items-center justify-center text-2xl select-none animate-pulse';
        }
        if (aura) {
          aura.className = 'absolute -inset-2 rounded-lg bg-gradient-to-r from-orange-400 to-red-500 opacity-30 blur-md transition-opacity duration-500 pointer-events-none animate-pulse';
          aura.style.opacity = '0.7';
        }
        break;

      case 'WARNING':
        if (characterDiv) {
          characterDiv.textContent = '😰';
          characterDiv.className = 'pixel-art-character w-16 h-16 bg-gradient-to-br from-red-600 to-orange-600 rounded-lg border-4 border-red-400 shadow-xl shadow-red-500/50 flex items-center justify-center text-2xl select-none animate-bounce';
        }
        if (aura) {
          aura.className = 'absolute -inset-2 rounded-lg bg-red-500/40 transition-opacity duration-500 pointer-events-none';
          aura.style.opacity = '0.6';
        }
        break;
    }
  }

  private setupGlobalStyles(): void {
    // Add custom animations if not already present
    if (document.getElementById('deepy-styles')) return;

    const style = document.createElement('style');
    style.id = 'deepy-styles';
    style.textContent = `
      @keyframes pixel-wiggle {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(2deg); }
        75% { transform: rotate(-2deg); }
      }
      
      @keyframes float-sweat {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        50% { transform: translateY(-4px) rotate(10deg); opacity: 0.8; }
        100% { transform: translateY(-8px) rotate(-10deg); opacity: 0; }
      }
      
      .pixel-wiggle {
        animation: pixel-wiggle 0.5s ease-in-out infinite;
      }
      
      .sweat-drop {
        position: absolute;
        width: 4px;
        height: 6px;
        background: #60A5FA;
        border-radius: 50%;
        animation: float-sweat 2s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }

  // Public methods for external control
  showCelebration(type: 'achievement' | 'level' | 'streak', details?: any): void {
    let message = '';
    
    switch (type) {
      case 'achievement':
        message = `🎉 ¡Nuevo logro desbloqueado: ${details?.title || 'Increíble'}!`;
        break;
      case 'level':
        message = `🚀 ¡Nivel ${details?.level || 'superior'} alcanzado! Sigue así 💪`;
        break;
      case 'streak':
        message = `🔥 ¡${details?.days || 'varios'} días de racha! No pierdas el ritmo`;
        break;
    }
    
    this.showMessage(message, 'FOCUSED', 5000);
    this.animateCharacter('bounce');
  }

  showWarning(message: string): void {
    this.showMessage(message, 'WARNING', 4000);
    this.animateCharacter('wiggle');
  }

  showInsight(message: string): void {
    this.showMessage(message, 'IDLE', 4000);
  }

  update(data: DashboardData): void {
    // Analyze data and provide context-aware messages
    this.analyzeAndProvideInsights(data);
  }

  private analyzeAndProvideInsights(data: DashboardData): void {
    // This is where we implement the smart assistant logic
    // Will be enhanced with the AssistantService integration
    
    if (!data.stats || data.stats.length === 0) return;

    // Check for deep work session
    if (data.deepWork?.active) {
      // Don't disturb during deep work unless critical
      return;
    }

    // Check focus score
    const avgScore = data.stats.reduce((sum, stat) => sum + stat.score, 0) / data.stats.length;
    
    if (avgScore > 80 && Math.random() > 0.8) {
      this.showInsight("¡Excelente enfoque! Estás en la zona de productividad máxima");
      this.setState('FOCUSED');
    }

    // Check for too many switches (potential distraction)
    const totalSwitches = data.stats.reduce((sum, stat) => sum + stat.switches, 0);
    const totalTime = data.stats.reduce((sum, stat) => sum + this.parseTimeToMinutes(stat.timeText), 0);
    const switchesPerMinute = totalTime > 0 ? totalSwitches / totalTime : 0;

    if (switchesPerMinute > 2 && Math.random() > 0.7) {
      this.showWarning("🔄 Muchos cambios de archivo detectados. Intenta enfocarte en una tarea a la vez.");
    }

    // Check for long sessions (potential fatigue)
    if (totalTime > 90) {
      this.showWarning("⏰ Llevas más de 90 minutos trabajando. ¿Un descanso?");
    }
  }

  private parseTimeToMinutes(timeText: string): number {
    // Parse time like "25m 13s" to minutes
    const match = timeText.match(/(\d+)m?\s*(\d*)s?/);
    if (!match) return 0;
    
    const minutes = parseInt(match[1]) || 0;
    const seconds = parseInt(match[2]) || 0;
    return minutes + seconds / 60;
  }

  destroy(): void {
    // Cleanup event listeners and elements
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
  }
}