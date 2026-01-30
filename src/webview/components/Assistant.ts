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

  // Lógica de Animación
  private animationInterval: any = null;
  private frameIndex = 0;
  private readonly animationMap = {
    IDLE: ["normal/normal1.png", "normal/normal2.png"],
    FOCUSED: [
      "thinking/pensar1.png",
      "thinking/pensar2.png",
      "thinking/pensar3.png",
      "thinking/pensar4.png",
    ],
    WARNING: [
      "fatigue/fatiga1.png",
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

    // Welcome message
    this.showMessage(
      "¡Hola! Soy Deepy, tu compañero de Deep Work 💪",
      "IDLE",
      4000,
    );
  }

  private startAnimationLoop(): void {
    if (this.animationInterval) clearInterval(this.animationInterval);

    this.animationInterval = setInterval(() => {
      const frames = this.animationMap[this.currentState];
      this.frameIndex = (this.frameIndex + 1) % frames.length;

      if (this.characterImg) {
        this.characterImg.src = `media/assistant/${frames[this.frameIndex]}`;
      }
    }, 450); // Velocidad de animación
  }

  private setupEventListeners(): void {
    if (!this.character) return;

    this.character.addEventListener("click", () => {
      this.showProductivityFact();
    });

    this.character.addEventListener("mouseenter", () => {
      this.setCharacterHover(true);
    });

    this.character.addEventListener("mouseleave", () => {
      this.setCharacterHover(false);
    });
  }

  private showProductivityFact(): void {
    const fact =
      this.productivityFacts[
        this.factsClickCount % this.productivityFacts.length
      ];
    this.factsClickCount++;
    this.showMessage(fact, "IDLE", 5000);
    this.animateCharacter("bounce");
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

  private animateCharacter(animation: "bounce" | "wiggle" | "pulse"): void {
    if (!this.character) return;
    const el = this.character;

    const animClass =
      animation === "bounce"
        ? "animate-bounce"
        : animation === "wiggle"
          ? "pixel-wiggle"
          : "animate-pulse";

    el.classList.add(animClass);
    setTimeout(() => el.classList.remove(animClass), 1000);
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
    this.setState(state);

    if (!this.speechBubble) return;

    const speechText = document.getElementById("speech-text");
    if (speechText) speechText.textContent = text;

    this.speechBubble.classList.remove("opacity-0", "translate-y-2");
    this.speechBubble.classList.add("opacity-100", "translate-y-0");

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

  setState(state: AssistantState): void {
    if (this.currentState !== state) {
      this.currentState = state;
      this.frameIndex = 0; // Reiniciar animación al cambiar estado
      this.updateCharacterVisual();
    }
  }

  private updateCharacterVisual(): void {
    const aura = document.getElementById("deepy-aura");
    if (!aura) return;

    // Actualizamos el aura según el estado
    switch (this.currentState) {
      case "IDLE":
        aura.style.opacity = "0";
        break;
      case "FOCUSED":
        aura.className =
          "absolute -inset-4 rounded-full bg-blue-500/30 blur-2xl animate-pulse pointer-events-none";
        aura.style.opacity = "1";
        break;
      case "WARNING":
        aura.className =
          "absolute -inset-4 rounded-full bg-red-500/20 blur-xl pointer-events-none";
        aura.style.opacity = "1";
        break;
      case "SUCCESS":
        aura.className =
          "absolute -inset-4 rounded-full bg-yellow-400/40 blur-2xl animate-ping pointer-events-none";
        aura.style.opacity = "1";
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
        msg = `🎉 ¡Logro: ${details?.title || "conseguido"}!`;
        break;
      case "level":
        msg = `🚀 ¡Nivel ${details?.level || "UP"} alcanzado!`;
        break;
      case "streak":
        msg = `🔥 ¡${details?.days || "Nueva"} racha activa!`;
        break;
    }
    this.showMessage(msg, "SUCCESS", 5000);
    this.animateCharacter("bounce");
  }

  showWarning(message: string): void {
    this.showMessage(message, "WARNING", 4000);
    this.animateCharacter("wiggle");
  }

  showInsight(message: string): void {
    this.showMessage(message, "IDLE", 4000);
  }

  update(data: DashboardData): void {
    this.analyzeAndProvideInsights(data);
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
