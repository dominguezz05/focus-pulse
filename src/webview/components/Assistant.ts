import { DashboardData, DashboardComponent } from "../types";

export type AssistantState = "IDLE" | "FOCUSED" | "WARNING" | "SUCCESS";

export interface AssistantMessage {
  text: string;
  state: AssistantState;
  duration?: number;
}

export class AssistantComponent implements DashboardComponent {
  private container: any;
  private currentState: AssistantState = "IDLE";
  private speechBubble: HTMLElement | null = null;
  private character: HTMLElement | null = null;
  private characterImg: HTMLImageElement | null = null;
  private messageQueue: AssistantMessage[] = [];
  private isShowingMessage = false;
  private factsClickCount = 0;

  // Lógica de Animación Mejorada
  private animationInterval: any = null;
  private frameIndex = 0;
  private microAnimationTimeout: any = null;
  private stateTransitionTimeout: any = null;
  private lastStateChange = 0;
  private isInTransition = false;
  
  private readonly animationMap = {
    IDLE: ["normal/normal1.png", "normal/normal2.png"],
    FOCUSED: [
      "thinking/pensar1.png",
      "thinking/pensar2.png", 
      "thinking/pensar3.png",
      "thinking/pensar4.png",
    ],
    WARNING: [
      "fatigue/Fatiga1.png",
      "fatigue/fatiga2.png",
      "fatigue/fatiga3.png",
      "fatigue/fatiga4.png",
    ],
    SUCCESS: [
      "levelup/xp1.png",
      "levelup/xp2.png",
      "levelup/xp3.png",
      "levelup/xp4.png",
    ],
  };

  private readonly stateDurations = {
    IDLE: 300000, // 5 minutos
    FOCUSED: 60000, // 1 minuto 
    WARNING: 45000, // 45 segundos
    SUCCESS: 8000, // 8 segundos
  };

  private productivityFacts = [
    "¿Sabías que tardas 23 minutos en recuperar el foco tras una interrupción?",
    "El cerebro humano mantiene el foco máximo por ~45 minutos seguidos",
    "Trabajar en bloques de 90min + 15min de descanso es óptimo para productividad",
    "Hacer pausas cada 25 minutos aumenta un 13% tu productividad diaria",
    "La música sin letra puede mejorar tu concentración hasta en un 15%",
    "El multitasking reduce tu productividad en un 40% comparado con el trabajo enfocado",
  ];

  constructor() {
    this.setupGlobalStyles();
  }

  render(container: any, data: DashboardData): void {
    this.container = container;

    const assistantContainer = document.createElement("div");
    assistantContainer.id = "assistant-container";
    assistantContainer.className =
      "fixed bottom-4 right-4 z-50 pointer-events-none";
    assistantContainer.innerHTML = `
      <div id="deepy-character" class="relative pointer-events-auto cursor-pointer transform transition-all duration-300 hover:scale-110">
        <img id="assistant-sprite" 
             src="media/assistant/normal/normal1.png" 
             class="w-20 h-20 object-contain drop-shadow-xl select-none" 
             alt="Deepy" />
        <div id="deepy-aura" class="absolute -inset-2 rounded-full opacity-0 transition-opacity duration-500 pointer-events-none"></div>
      </div>
      
      <div id="speech-bubble" class="absolute bottom-24 right-0 max-w-xs bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-2xl opacity-0 pointer-events-none transition-all duration-300 transform translate-y-2">
        <div class="relative">
          <p id="speech-text" class="text-sm text-slate-800 font-bold leading-relaxed"></p>
          <div class="absolute -bottom-6 right-6 w-4 h-4 bg-white/95 rotate-45 border-r border-b border-slate-200"></div>
        </div>
      </div>
    `;

    container.appendChild(assistantContainer);

    // Cache DOM elements
    this.character = document.getElementById("deepy-character");
    this.characterImg = document.getElementById(
      "assistant-sprite",
    ) as HTMLImageElement;
    this.speechBubble = document.getElementById("speech-bubble");

    this.setupEventListeners();
    this.startAnimationLoop();

    // Welcome message con animación especial
    setTimeout(() => {
      this.showMessage(
        "¡Hola! Soy Deepy, tu compañero de Deep Work",
        "IDLE",
        4000,
      );
      this.animateCharacter("bounce");
    }, 500);
  }

  private startAnimationLoop(): void {
    if (this.animationInterval) clearInterval(this.animationInterval);
    if (this.microAnimationTimeout) clearTimeout(this.microAnimationTimeout);

    // Animación principal frame-by-frame optimizada
    this.animationInterval = setInterval(() => {
      if (this.isInTransition) return;
      
      const frames = this.animationMap[this.currentState];
      this.frameIndex = (this.frameIndex + 1) % frames.length;

      if (this.characterImg) {
        this.characterImg.style.opacity = "0.8";
        setTimeout(() => {
          if (this.characterImg) {
            this.characterImg.src = `media/assistant/${frames[this.frameIndex]}`;
            this.characterImg.style.opacity = "1";
          }
        }, 50);
      }

      // Micro-animaciones ocasionales
      if (Math.random() > 0.95 && this.currentState === "IDLE") {
        this.triggerMicroAnimation();
      }
    }, 350); // Velocidad optimizada
  }

  private triggerMicroAnimation(): void {
    if (!this.character) return;
    
    const microAnimations = [
      "animate-bounce",
      "animate-pulse", 
      "scale-110",
      "rotate-3",
      "rotate--3"
    ];
    
    const randomAnimation = microAnimations[Math.floor(Math.random() * microAnimations.length)];
    this.character.classList.add(randomAnimation);
    
    setTimeout(() => {
      this.character?.classList.remove(randomAnimation);
    }, 800);
  }

  private setupEventListeners(): void {
    if (!this.character) return;

    // Click - diferente reacción según estado
    this.character.addEventListener("click", (e) => {
      e.preventDefault();
      this.handleCharacterClick();
    });

    // Hover mejorado con feedback contextual
    this.character.addEventListener("mouseenter", () => {
      this.setCharacterHover(true);
    });

    this.character.addEventListener("mouseleave", () => {
      this.setCharacterHover(false);
    });

    // Doble click para modo especial
    this.character.addEventListener("dblclick", (e) => {
      e.preventDefault();
      this.handleDoubleClick();
    });

    // Right click para menú contextual
    this.character.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.handleRightClick();
    });
  }

  private handleCharacterClick(): void {
    // Click simple cambia según estado actual
    switch (this.currentState) {
      case "IDLE":
        this.showProductivityFact();
        break;
      case "FOCUSED":
        this.showMessage("¡Continúa así! Tu enfoque es impresionante", "FOCUSED", 3000);
        this.animateCharacter("pulse");
        break;
      case "WARNING":
        this.showMessage("¿Necesitas ayuda? Aquí estoy para ti", "IDLE", 4000);
        this.setState("IDLE");
        break;
      case "SUCCESS":
        this.createParticleEffect();
        this.showMessage("¡Logro desbloqueado! Sigue así", "SUCCESS", 3000);
        break;
    }
  }

  private handleDoubleClick(): void {
    // Doble click - celebración especial
    this.showMessage("¡Eres increíble! ¡Sigue conquistando tus metas!", "SUCCESS", 5000);
    this.createParticleEffect();
    this.animateCharacter("celebrate");
    
    // Efecto rainbow temporal
    const aura = document.getElementById("deepy-aura");
    if (aura) {
      aura.style.background = "linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #ffeaa7, #fd79a8)";
      aura.style.animation = "celebration-burst 2s ease-out";
      setTimeout(() => {
        this.updateCharacterVisual();
      }, 2000);
    }
  }

  private handleRightClick(): void {
    // Right click - ciclo de estados manual
    const states: AssistantState[] = ["IDLE", "FOCUSED", "WARNING", "SUCCESS"];
    const currentIndex = states.indexOf(this.currentState);
    const nextState = states[(currentIndex + 1) % states.length];
    
    this.setState(nextState);
    this.showMessage(`Estado manual: ${nextState}`, nextState, 2000);
  }

  private showProductivityFact(): void {
    const fact =
      this.productivityFacts[
        this.factsClickCount % this.productivityFacts.length
      ];
    this.factsClickCount++;
    
    // Reacción diferente según el estado actual
    let reactionType: "bounce" | "wiggle" | "pulse" | "celebrate" = "bounce";
    
    switch (this.currentState) {
      case "IDLE":
        reactionType = "bounce";
        break;
      case "FOCUSED":
        reactionType = "pulse";
        break;
      case "WARNING":
        reactionType = "wiggle";
        break;
      case "SUCCESS":
        reactionType = "celebrate";
        break;
    }
    
    this.showMessage(fact, this.currentState, 5000);
    this.animateCharacter(reactionType);
  }

  private setCharacterHover(isHovering: boolean): void {
    if (!this.character) return;
    const aura = document.getElementById("deepy-aura");

    if (isHovering) {
      if (aura) {
        aura.className =
          "absolute -inset-2 rounded-full bg-purple-500/20 blur-xl transition-opacity duration-300 pointer-events-none";
        aura.style.opacity = "1";
      }
    } else {
      this.updateCharacterVisual(); // Restaura el aura según el estado actual
    }
  }

  private animateCharacter(animation: "bounce" | "wiggle" | "pulse" | "celebrate" | "shake" | "glow" | "sparkle"): void {
    if (!this.character) return;
    const el = this.character;

    const animClass =
      animation === "bounce"
        ? "animate-bounce"
        : animation === "wiggle"
          ? "pixel-wiggle"
        : animation === "celebrate"
          ? "celebration-pulse"
        : animation === "shake"
          ? "warning-shake"
        : animation === "glow"
          ? "focus-glow"
        : animation === "sparkle"
          ? "success-sparkle"
          : "animate-pulse";

    el.classList.add(animClass);
    setTimeout(() => el.classList.remove(animClass), 1200);
  }

  showMessage(
    text: string,
    state: AssistantState,
    duration: number = 3000,
  ): void {
    if (this.isShowingMessage) {
      this.messageQueue.push({ text, state, duration });
      return;
    }
    this.showImmediateMessage(text, state, duration);
  }

  private showImmediateMessage(
    text: string,
    state: AssistantState,
    duration: number,
  ): void {
    this.isShowingMessage = true;
    
    // Cambiar estado del personaje según el mensaje
    this.setState(state);

    if (!this.speechBubble) return;

    const speechText = document.getElementById("speech-text");
    if (speechText) speechText.textContent = text;

    // Agregar icono SVG según el tipo de mensaje
    const iconContainer = this.speechBubble.querySelector('.message-icon');
    if (iconContainer) iconContainer.remove();
    
    const iconHtml = this.getMessageIcon(text, state);
    if (iconHtml) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = iconHtml;
      const icon = tempDiv.firstElementChild;
      if (icon) {
        icon.className = 'message-icon absolute -left-12 top-2 w-8 h-8';
        this.speechBubble.querySelector('.relative')?.prepend(icon);
      }
    }

    this.speechBubble.classList.remove("opacity-0", "translate-y-2");
    this.speechBubble.classList.add("opacity-100", "translate-y-0");

    // Animación especial según el estado
    if (state === "SUCCESS") {
      this.createParticleEffect();
    } else if (state === "WARNING") {
      setTimeout(() => this.createCharacterShake(), 200);
    } else if (state === "FOCUSED") {
      setTimeout(() => this.createFocusPulse(), 100);
    }

    setTimeout(() => this.hideMessage(), duration);
  }

  private hideMessage(): void {
    if (!this.speechBubble) return;

    this.speechBubble.classList.add("opacity-0", "translate-y-2");
    this.speechBubble.classList.remove("opacity-100", "translate-y-0");

    setTimeout(() => {
      this.isShowingMessage = false;
      if (this.messageQueue.length > 0) {
        const next = this.messageQueue.shift()!;
        this.showImmediateMessage(next.text, next.state, next.duration || 3000);
      } else {
        this.setState("IDLE");
      }
    }, 300);
  }

  setState(state: AssistantState, force: boolean = false): void {
    if (this.currentState === state && !force) return;

    // Iniciar transición suave
    this.startStateTransition(state);
  }

  private startStateTransition(newState: AssistantState): void {
    if (this.isInTransition && newState !== "IDLE") return;

    this.isInTransition = true;
    const previousState = this.currentState;
    
    // Anticipación visual
    this.character?.classList.add("scale-95");
    
    setTimeout(() => {
      // Cambio de estado
      this.currentState = newState;
      this.frameIndex = 0;
      this.lastStateChange = Date.now();
      
      // Actualizar visual
      this.updateCharacterVisual();
      
      // Completar transición
      setTimeout(() => {
        this.character?.classList.remove("scale-95");
        this.isInTransition = false;
        
        // Auto-regreso a IDLE después del tiempo especificado
        if (newState !== "IDLE") {
          this.scheduleReturnToIdle();
        }
      }, 300);
    }, 150);
  }

  private scheduleReturnToIdle(): void {
    if (this.stateTransitionTimeout) {
      clearTimeout(this.stateTransitionTimeout);
    }
    
    const duration = this.stateDurations[this.currentState] || 60000;
    
    this.stateTransitionTimeout = setTimeout(() => {
      if (this.currentState !== "IDLE" && !this.isShowingMessage) {
        this.setState("IDLE");
      }
    }, duration);
  }

  private updateCharacterVisual(): void {
    const aura = document.getElementById("deepy-aura");
    if (!aura) return;

    // Limpiar clases previas
    aura.className = "absolute rounded-full pointer-events-none transition-all duration-500";

    // Actualizar aura según el estado con efectos mejorados
    switch (this.currentState) {
      case "IDLE":
        aura.className += " -inset-2 bg-purple-500/10 blur-sm";
        aura.style.opacity = "0.3";
        aura.style.animation = "gentle-pulse 4s ease-in-out infinite";
        break;
      case "FOCUSED":
        aura.className += " -inset-6 bg-blue-500/40 blur-2xl";
        aura.style.opacity = "0.8";
        aura.style.animation = "focus-aura 2s ease-in-out infinite";
        break;
      case "WARNING":
        aura.className += " -inset-5 bg-orange-500/30 blur-xl";
        aura.style.opacity = "0.7";
        aura.style.animation = "warning-pulse 1.5s ease-in-out infinite";
        break;
      case "SUCCESS":
        aura.className += " -inset-8 bg-gradient-to-r from-yellow-400/50 via-orange-400/50 to-pink-400/50 blur-2xl";
        aura.style.opacity = "0.9";
        aura.style.animation = "celebration-burst 1s ease-out";
        setTimeout(() => {
          if (aura && this.currentState === "SUCCESS") {
            aura.style.animation = "gentle-pulse 3s ease-in-out infinite";
          }
        }, 1000);
        break;
    }
  }

  private setupGlobalStyles(): void {
    if (document.getElementById("deepy-styles")) return;

    const style = document.createElement("style");
    style.id = "deepy-styles";
    style.textContent = `
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
      
      @keyframes success-sparkle {
        0%, 100% { filter: brightness(1) drop-shadow(0 0 0 transparent); }
        25% { filter: brightness(1.3) drop-shadow(0 0 12px rgba(250, 204, 21, 0.8)); }
        50% { filter: brightness(1.4) drop-shadow(0 0 20px rgba(250, 204, 21, 1)); }
        75% { filter: brightness(1.2) drop-shadow(0 0 8px rgba(250, 204, 21, 0.6)); }
      }
      .success-sparkle { animation: success-sparkle 1s ease-in-out; }
      
      @keyframes particle-float {
        0% { transform: translateY(0px) translateX(0px) rotate(0deg); opacity: 1; }
        50% { transform: translateY(-20px) translateX(10px) rotate(180deg); opacity: 0.8; }
        100% { transform: translateY(-40px) translateX(-5px) rotate(360deg); opacity: 0; }
      }
      .particle-float { animation: particle-float 2s ease-out forwards; }
      
      @keyframes gentle-pulse {
        0%, 100% { transform: scale(1); opacity: 0.3; }
        50% { transform: scale(1.05); opacity: 0.5; }
      }
      .gentle-pulse { animation: gentle-pulse 4s ease-in-out infinite; }
      
      @keyframes focus-aura {
        0%, 100% { transform: scale(1) rotate(0deg); filter: blur(16px); }
        25% { transform: scale(1.1) rotate(5deg); filter: blur(20px); }
        50% { transform: scale(1.15) rotate(0deg); filter: blur(24px); }
        75% { transform: scale(1.1) rotate(-5deg); filter: blur(20px); }
      }
      .focus-aura { animation: focus-aura 2s ease-in-out infinite; }
      
      @keyframes warning-pulse {
        0%, 100% { transform: scale(1); opacity: 0.7; background: rgba(251, 146, 60, 0.3); }
        50% { transform: scale(1.2); opacity: 0.9; background: rgba(239, 68, 68, 0.5); }
      }
      .warning-pulse { animation: warning-pulse 1.5s ease-in-out infinite; }
      
      @keyframes celebration-burst {
        0% { transform: scale(0.5) rotate(0deg); opacity: 0; filter: hue-rotate(0deg); }
        50% { transform: scale(1.3) rotate(180deg); opacity: 1; filter: hue-rotate(45deg); }
        100% { transform: scale(1) rotate(360deg); opacity: 0.9; filter: hue-rotate(90deg); }
      }
      .celebration-burst { animation: celebration-burst 1s ease-out; }
    `;
    document.head.appendChild(style);
  }

  // API Pública
  showCelebration(
    type: "achievement" | "level" | "streak",
    details?: any,
  ): void {
    let msg = "";
    switch (type) {
      case "achievement":
        msg = `¡Logro: ${details?.title || "conseguido"}!`;
        break;
      case "level":
        msg = `¡Nivel ${details?.level || "superior"} alcanzado!`;
        break;
      case "streak":
        msg = `¡${details?.days || "nueva"} racha activa!`;
        break;
    }
    this.showMessage(msg, "SUCCESS", 5000);
    this.animateCharacter("sparkle");
  }

  showWarning(message: string): void {
    this.showMessage(message, "WARNING", 4000);
    this.animateCharacter("shake");
  }

  showInsight(message: string): void {
    this.showMessage(message, "IDLE", 4000);
  }

  private getMessageIcon(message: string, state: AssistantState): string {
    const lowerMessage = message.toLowerCase();
    
    if (state === "SUCCESS" || lowerMessage.includes("logro") || lowerMessage.includes("nivel")) {
      return `<svg class="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L14.09 8.26L21 9.27L16.5 13.14L18.18 20L12 16.27L5.82 20L7.5 13.14L3 9.27L9.91 8.26L12 2Z"/>
      </svg>`;
    }
    
    if (state === "WARNING" || lowerMessage.includes("descanso") || lowerMessage.includes("fatiga")) {
      return `<svg class="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>`;
    }
    
    if (state === "FOCUSED" || lowerMessage.includes("enfoque") || lowerMessage.includes("profundo")) {
      return `<svg class="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>`;
    }
    
    if (lowerMessage.includes("pomodoro") || lowerMessage.includes("ciclo")) {
      return `<svg class="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M12 6v6l4 2"/>
      </svg>`;
    }
    
    return `<svg class="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>`;
  }

  private createParticleEffect(): void {
    if (!this.character) return;
    
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        const particle = document.createElement('div');
        const particles = ['✨', '⭐', '💫', '🌟'];
        particle.innerHTML = particles[Math.floor(Math.random() * particles.length)];
        particle.className = 'absolute text-xl particle-float pointer-events-none';
        particle.style.left = `${Math.random() * 60 - 10}px`;
        particle.style.top = '20px';
        this.character?.appendChild(particle);
        
        setTimeout(() => particle.remove(), 2000);
      }, i * 80);
    }
  }

  private createCharacterShake(): void {
    if (!this.character) return;
    this.character.classList.add("warning-shake");
    setTimeout(() => this.character?.classList.remove("warning-shake"), 600);
  }

  private createFocusPulse(): void {
    if (!this.character) return;
    this.character.classList.add("focus-glow");
    setTimeout(() => this.character?.classList.remove("focus-glow"), 2000);
  }

  update(data: DashboardData): void {
    this.analyzeAndProvideInsights(data);
    this.updateStateBasedOnContext(data);
  }

  private updateStateBasedOnContext(data: DashboardData): void {
    if (data.deepWork?.active) {
      // Usuario en modo Deep Work - mantener estado FOCUSED
      this.setState("FOCUSED");
    } else if (data.streak && data.streak > 7 && Math.random() > 0.7) {
      // Racha larga - ocasionalmente mostrar estado SUCCESS motivacional
      this.setState("SUCCESS");
    } else if (data.stats && data.stats.length > 0) {
      // Analizar rendimiento reciente
      const avgScore = data.stats.reduce((sum, stat) => sum + stat.score, 0) / data.stats.length;
      
      if (avgScore < 30) {
        // Bajo rendimiento - mostrar estado WARNING
        this.setState("WARNING");
      } else if (avgScore > 85 && Math.random() > 0.8) {
        // Alto rendimiento - ocasionalmente mostrar FOCUSED
        this.setState("FOCUSED");
      }
    }
    
    // Análisis de tiempo de sesión
    if (data.stats && data.stats.length > 0) {
      const totalTime = data.stats.reduce((sum, stat) => sum + this.parseTimeToMinutes(stat.timeText), 0);
      if (totalTime > 120) {
        // Más de 2 horas - mostrar fatiga
        this.setState("WARNING");
      }
    }
  }

  private analyzeAndProvideInsights(data: DashboardData): void {
    if (!data.stats || data.stats.length === 0 || data.deepWork?.active) return;

    const avgScore =
      data.stats.reduce((sum, stat) => sum + stat.score, 0) / data.stats.length;
    if (avgScore > 80 && Math.random() > 0.9) {
      this.showInsight("¡Foco impecable! Sigue así.");
      this.setState("FOCUSED");
    }

    const totalTime = data.stats.reduce(
      (sum, stat) => sum + this.parseTimeToMinutes(stat.timeText),
      0,
    );
    if (totalTime > 90)
      this.showWarning("⏰ Llevas mucho tiempo. ¿Descansamos?");
  }

  private parseTimeToMinutes(timeText: string): number {
    const match = timeText.match(/(\d+)m?\s*(\d*)s?/);
    if (!match) return 0;
    return (parseInt(match[1]) || 0) + (parseInt(match[2]) || 0) / 60;
  }

  destroy(): void {
    if (this.animationInterval) clearInterval(this.animationInterval);
    const styles = document.getElementById("deepy-styles");
    if (styles) styles.remove();
  }
}
