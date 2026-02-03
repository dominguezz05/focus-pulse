# Focus Pulse - Contexto del Proyecto

## 🎯 ¿Qué es Focus Pulse?

Focus Pulse es una **extensión de VS Code** que gamifica el seguimiento de productividad y enfoque durante la codificación. Mide el nivel de enfoque en tiempo real a través de múltiples señales (tiempo activo, ediciones, cambios de archivo) y lo convierte en un sistema de progresión con XP, niveles, logros y un asistente virtual animado.

**No es un gestor de tareas** — Focus Pulse se enfoca exclusivamente en métricas de codificación en tiempo real.

- **Versión actual**: 2.4.1
- **Licencia**: MIT
- **Publisher**: dominguezz05
- **Repositorio**: https://github.com/dominguezz05/focus-pulse.git

---

## 🏗️ Arquitectura General

### Patrón de Diseño

- **Arquitectura basada en eventos**: EventBus centralizado para comunicación entre módulos
- **Estado centralizado**: StateManager reactivo con suscriptores
- **Modularización**: Separación clara entre lógica de negocio, UI y servicios
- **Extension + Webview**: Backend en TypeScript (Node.js) + Frontend en HTML/CSS con Webview API

### Flujo Principal

```
Usuario edita código
    ↓
focusTracker.ts detecta cambios (onDidChangeTextDocument)
    ↓
EventBus emite eventos (file:edit:occurred, file:switch:occurred)
    ↓
Módulos suscritos reaccionan:
    ├─ xp.ts → Calcula XP ganado
    ├─ achievements.ts → Verifica logros
    ├─ goals.ts → Actualiza progreso diario
    ├─ pomodoro.ts → Timer activo
    └─ deepWork.ts → Penalización por switches
    ↓
StateManager actualiza estado global
    ↓
dashboard-refactored.ts recibe notificación
    ↓
DashboardRenderer.render() actualiza Webview cada 2s
    ↓
Usuario ve su progreso en tiempo real
```

---

## 💡 Conceptos Clave

### 1. Focus Score (Puntuación de Enfoque)

**Fórmula:**

```
score = (timeMs × timeWeight) + (edits/min × editsWeight) - (switches/min × switchPenalty)
```

- **Rango**: 0-100
- **Pesos por defecto**:
  - `timeWeight`: 0.3
  - `editsWeight`: 8
  - `switchPenalty`: 15

**Interpretación:**

- 🟢 80-100: Enfoque excelente
- 🟠 50-79: Enfoque moderado
- 🔴 0-49: Baja concentración

### 2. Sistema XP y Niveles

**Fórmula XP Base:**

```typescript
xp = minutes × (avgScore / 100) × 10
```

**Bonificaciones:**

- Pomodoro completado: +50 XP (hoy) / +10 XP (histórico)
- Deep Work completado: +150 XP

**Curva de niveles:**

```typescript
xpToNextLevel = 100 + (currentLevel - 1) × 50
```

### 3. Context Switching (Cambio de Contexto)

Cada vez que cambias de archivo activo, se penaliza el focus score:

- **Normal**: -15 puntos por cambio/minuto
- **Deep Work Mode**: -40 puntos por cambio/minuto (×2.67 penalización)

### 4. Pomodoro Timer

Técnica tradicional integrada:

- 🍅 Work: 25 minutos (default)
- ☕ Break: 5 minutos (default)
- Bonus XP al completar ciclo
- Conteo diario/total persistente

### 5. Deep Work Mode

Sesiones enfocadas de alta intensidad:

- Duración: 60 minutos (default)
- Penalización extra por cambios de archivo (×40)
- Bonus XP: 150 puntos al completar
- Estado persistente (puede pausarse y retomarse)

### 6. Streaks (Rachas)

Días consecutivos con actividad:

- Se calcula automáticamente desde el historial
- Se reinicia si hay un día sin actividad
- Desbloquea logros especiales

### 7. Asistente Virtual

IA animada con 4 estados:

- **IDLE** (Normal): Sprites de reposo
- **FOCUSED** (Pensando): Animación cuando estás productivo
- **WARNING** (Fatiga): Alerta después de 90+ minutos
- **SUCCESS** (Level Up): Celebración por logros/XP

---

## 🛠️ Stack Tecnológico

### Frontend

- **TypeScript 5.6.3** (strict mode)
- **VS Code Webview API** (HTML5 + CSS)
- **Tailwind-style inline CSS** (sin build)
- Comunicación bidireccional con extension host

### Backend/Runtime

- **Node.js** (ejecuta TypeScript compilado)
- **VS Code Extension API** (@types/vscode ^1.90.0)
- **esbuild 0.27.2** (bundling optimizado)
- **@octokit/rest 22.0.1** (sincronización GitHub)

### Persistencia

- **VS Code GlobalState** (almacenamiento local)
- **Sincronización en la nube** (opcional, vía GitHub)
- No requiere base de datos externa

### Herramientas

- TypeScript Compiler (tsc)
- VSCE (empaquetado .vsix)
- Git (control de versiones)

---

## 📁 Estructura de Carpetas

```
focus-pulse/
├── src/
│   ├── extension-refactored.ts        # 🔴 Punto de entrada principal
│   ├── dashboard-refactored.ts        # Dashboard UI (orchestrator)
│   ├── focusTracker.ts                # Core: rastreador de enfoque
│   ├── storage.ts                     # Persistencia + historial
│   ├── pomodoro.ts                    # Timer Pomodoro
│   ├── xp.ts                          # Sistema XP + niveles
│   ├── achievements.ts                # Logros (predefinidos + custom)
│   ├── deepWork.ts                    # Modo Deep Work
│   ├── goals.ts                       # Objetivos diarios
│   ├── statusBar.ts                   # Barra de estado VS Code
│   ├── config.ts                      # Configuración
│   │
│   ├── state/                         # 🟡 Estado centralizado
│   │   ├── StateManager.ts            # Manager reactivo con suscriptores
│   │   └── StateTypes.ts              # Interfaces de estado
│   │
│   ├── events/                        # 🟡 Sistema de eventos
│   │   ├── EventBus.ts                # Bus central desacoplado
│   │   ├── EventTypes.ts              # Tipos de eventos (30+ eventos)
│   │   └── index.ts                   # Exportaciones públicas
│   │
│   ├── services/                      # 🟢 Servicios especializados
│   │   └── AssistantService.ts        # Lógica del asistente IA
│   │
│   ├── export/                        # 🟢 Sincronización y exportación
│   │   ├── DataExportManager.ts       # Importar/exportar JSON/XML
│   │   ├── UserSyncManager.ts         # Sincronización en la nube
│   │   ├── exportCommands.ts          # Comandos de exportación
│   │   └── syncCommands.ts            # Comandos de sincronización
│   │
│   ├── webview/                       # 🔵 Componentes UI (Webview)
│   │   ├── DashboardRenderer.ts       # Renderizador principal
│   │   ├── types.ts                   # Tipos de webview
│   │   ├── CustomAchievementManager.ts# Manager logros personalizados
│   │   └── components/                # Componentes reutilizables
│   │       ├── Assistant.ts           # Widget del asistente animado
│   │       ├── Header.ts              # Encabezado (nivel, XP, racha)
│   │       ├── Achievements.ts        # Panel de logros + badges
│   │       ├── Goals.ts               # Panel de objetivos diarios
│   │       ├── Goals-Animated.ts      # Versión animada (experimental)
│   │       ├── Heatmap.ts             # Mapa de calor de 30 días
│   │       ├── Metrics.ts             # Panel de métricas en tiempo real
│   │       ├── Table.ts               # Tabla de archivos trabajados
│   │       └── AuthComponent.ts       # Componente de autenticación
│   │
│   ├── utils/                         # 🟣 Utilidades
│   │   └── Debouncer.ts               # Debounce para optimización
│   │
│   └── media/                         # 📁 Recursos de medios
│       └── assistant/                 # Sprites del asistente (PNG)
│           ├── normal/                # Estado IDLE (frames 0-7)
│           ├── thinking/              # Estado FOCUSED (frames 0-7)
│           ├── fatigue/               # Estado WARNING (frames 0-7)
│           └── levelup/               # Estado SUCCESS (frames 0-7)
│
├── package.json                       # Dependencias + comandos + config
├── tsconfig.json                      # Configuración TypeScript
├── README.md                          # Documentación pública
├── CHANGELOG.md                       # Historial de versiones
├── claude.md                          # 📄 Este archivo
└── out/                               # Archivos compilados (.js)
```

**Leyenda:**

- 🔴 Archivos críticos de entrada
- 🟡 Arquitectura central (estado + eventos)
- 🟢 Servicios especializados
- 🔵 Componentes de UI
- 🟣 Utilidades y helpers

---

## 🧩 Componentes Principales

### 1. extension-refactored.ts

**Responsabilidad:** Punto de entrada de la extensión. Inicializa todos los módulos y coordina el ciclo de vida.

**Funciones clave:**

```typescript
activate(context: vscode.ExtensionContext)
  ├─ initStorage()                  // Cargar historial
  ├─ initStatusBar()                // Barra de estado
  ├─ initPomodoro()                 // Timer Pomodoro
  ├─ initDeepWork()                 // Deep Work mode
  ├─ registerExportCommands()       // Comandos exportación
  ├─ registerSyncCommands()         // Comandos sincronización
  └─ Watchers:
      ├─ onDidChangeActiveTextEditor()   // Cambio de archivo
      ├─ onDidChangeTextDocument()       // Edición de texto
      └─ setInterval(2000ms)             // Actualización periódica
```

**Eventos que escucha:**

- Cambio de editor activo → `handleEditorChange()`
- Cambio de texto → `handleTextDocumentChange()`
- Timer cada 2s → `updateAll()`

---

### 2. focusTracker.ts

**Responsabilidad:** Rastreo de tiempo y actividad por archivo.

**Interfaz principal:**

```typescript
interface FocusStats {
  uri: string;
  fileName: string;
  timeMs: number; // Tiempo acumulado
  edits: number; // Total de ediciones
  switches: number; // Cambios desde este archivo
  added: number; // Líneas añadidas
  deleted: number; // Líneas eliminadas
  lastActivatedAt: number; // Timestamp último acceso
}
```

**Funciones clave:**

```typescript
trackEdit(uri, contentChanges); // Registra edición
trackSwitch(fromUri, toUri); // Registra cambio de archivo
getActiveFileStats(); // Stats del archivo actual
getAllStats(); // Stats de todos los archivos
```

---

### 3. storage.ts

**Responsabilidad:** Persistencia y gestión de historial diario.

**Interfaz principal:**

```typescript
interface HistoryDay {
  date: string; // "YYYY-MM-DD"
  totalTimeMs: number; // Tiempo total del día
  totalEdits: number; // Ediciones totales
  avgScore: number; // Puntuación promedio
  sessions: {
    // Sesiones del día
    start: number;
    end: number;
    files: { name: string; edits: number; timeMs: number }[];
  }[];
}
```

**Funciones clave:**

```typescript
saveHistory(history); // Guardar historial
loadHistory(); // Cargar historial
computeStreak(history); // Calcular racha
updateHistoryFromStats(focusStats); // Actualizar día actual
```

**Persistencia:**

- Guarda en `context.globalState.get('focusPulse.history')`
- Debouncing de 1 segundo para evitar escrituras excesivas

---

### 4. xp.ts

**Responsabilidad:** Cálculo de XP, niveles y progresión.

**Interfaz principal:**

```typescript
interface XpState {
  totalXp: number; // XP acumulado total
  level: number; // Nivel actual
  xpInLevel: number; // XP en el nivel actual
  xpToNext: number; // XP necesario para subir
}
```

**Fórmula:**

```typescript
function computeXpState(history, pomodoros, deepWorkSessions): XpState {
  // XP base: minutos × (avgScore/100) × 10
  // Bonus Pomodoro: +50 hoy / +10 histórico
  // Bonus Deep Work: +150 por sesión
  // Curva de nivel: 100 + (level-1) × 50
}
```

**Eventos que emite:**

- `xp:earned` (cuando ganas XP)
- `xp:level_up` (cuando subes de nivel)

---

### 5. achievements.ts

**Responsabilidad:** Sistema de logros predefinidos y personalizados.

**Logros predefinidos:**

```typescript
const builtInAchievements = [
  { id: "first_focus", title: "First Focus", description: "1 min de foco" },
  { id: "streak_3", title: "Steady", description: "3 días consecutivos" },
  { id: "hundred_edits", title: "Editor", description: "100 ediciones" },
  { id: "level_5", title: "Rising Star", description: "Nivel 5" },
  { id: "epic_week", title: "Epic Week", description: "420 min en 1 semana" },
  // ... más logros
];
```

**Logros personalizados:**

```typescript
interface CustomAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  conditions: {
    focus_time?: number; // Minutos totales
    streak?: number; // Días consecutivos
    pomodoros?: number; // Pomodoros completados
    xp_level?: number; // Nivel mínimo
    score_avg?: number; // Puntuación promedio
  };
}
```

**Funciones clave:**

```typescript
computeAchievements(history, pomodoros, xpState); // Verifica logros
createCustomAchievement(data); // Crea logro personalizado
```

**Eventos que emite:**

- `achievement:unlocked` (nuevo logro desbloqueado)
- `achievement:progress` (progreso hacia logro)

---

### 6. StateManager.ts

**Responsabilidad:** Estado centralizado reactivo con patrón Observer.

**Arquitectura:**

```typescript
class StateManager {
  private state: AppState;
  private subscribers: Map<string, Function[]>;

  getState(): AppState;
  setState(updates: Partial<AppState>): void;
  subscribe(path: string, callback: Function): () => void;
}
```

**Estado global (AppState):**

```typescript
interface AppState {
  focus: {
    currentScore: number;
    sessionTime: number;
    sessionEdits: number;
    // ...
  };
  pomodoro: {
    isActive: boolean;
    mode: "work" | "break";
    remainingTime: number;
    // ...
  };
  achievements: {
    unlocked: string[];
    progress: Record<string, number>;
  };
  xp: XpState;
  deepWork: {
    isActive: boolean;
    startTime: number;
    duration: number;
    // ...
  };
  goals: DailyGoalProgress;
  ui: {
    isDashboardVisible: boolean;
  };
  session: {
    startTime: number;
    isPaused: boolean;
  };
}
```

**Patrón de uso:**

```typescript
// Suscribirse a cambios
stateManager.subscribe("xp.level", (newLevel) => {
  console.log("Nuevo nivel:", newLevel);
});

// Actualizar estado
stateManager.setState({
  xp: { totalXp: 500, level: 3, xpInLevel: 50, xpToNext: 100 },
});
```

---

### 7. EventBus.ts

**Responsabilidad:** Sistema de eventos desacoplado entre módulos.

**Eventos disponibles (30+):**

```typescript
// Archivo y edición
"file:focus:changed";
"file:edit:occurred";
"file:switch:occurred";

// Sesión
"session:started";
"session:ended";
"session:updated";

// Pomodoro
"pomodoro:started";
"pomodoro:completed";
"pomodoro:paused";
"pomodoro:reset";

// Logros
"achievement:unlocked";
"achievement:progress";

// XP
"xp:earned";
"xp:level_up";

// Deep Work
"deepwork:started";
"deepwork:ended";
"deepwork:updated";

// Objetivos
"goal:progress";
"goal:completed";

// Dashboard
"dashboard:opened";
"dashboard:closed";
"dashboard:refresh";

// Datos
"data:saved";
"data:loaded";
"data:reset";

// Configuración
"config:changed";
```

**Patrón de uso:**

```typescript
// Emitir evento
eventBus.emit("xp:level_up", { newLevel: 5, oldLevel: 4 });

// Escuchar evento
eventBus.on("xp:level_up", (data) => {
  console.log(`Subiste al nivel ${data.newLevel}!`);
});

// Desuscribirse
const unsubscribe = eventBus.on("xp:earned", handler);
unsubscribe();
```

---

### 8. DashboardRenderer.ts

**Responsabilidad:** Orquestador de componentes de UI para la Webview.

**Componentes que renderiza:**

```typescript
export function renderDashboard(state: AppState): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        ${renderStyles()}
        ${renderAssistantSprites()}
      </head>
      <body>
        ${AssistantComponent.render(state)}
        ${HeaderComponent.render(state)}
        ${MetricsComponent.render(state)}
        ${GoalsComponent.render(state)}
        ${AchievementsComponent.render(state)}
        ${HeatmapComponent.render(state)}
        ${TableComponent.render(state)}
        ${AuthComponent.render(state)}
        ${renderScripts()}
      </body>
    </html>
  `;
}
```

**Comunicación Webview ↔ Extension:**

```typescript
// Desde Webview (HTML/JS)
vscode.postMessage({ type: "startPomodoro" });

// En Extension (TypeScript)
panel.webview.onDidReceiveMessage((message) => {
  switch (message.type) {
    case "startPomodoro":
      pomodoroManager.start();
      break;
  }
});
```

---

### 9. AssistantService.ts + Assistant.ts

**Responsabilidad:** Lógica del asistente virtual animado.

**Estados del asistente:**

```typescript
enum AssistantState {
  IDLE = "normal", // Reposo (focus score < 60)
  FOCUSED = "thinking", // Productivo (60 ≤ score < 80)
  WARNING = "fatigue", // Fatiga (90+ minutos o alta fatiga)
  SUCCESS = "levelup", // Celebración (logro o level up)
}
```

**Detecciones automáticas:**

- **Fatiga**: Después de 90+ minutos continuos sin break
- **Deriva**: Más de 10 cambios de archivo en 5 minutos
- **Celebración**: Al desbloquear logro o subir de nivel

**Mensajes motivacionales:**

```typescript
const messages = {
  fatigue: [
    "¿Un descanso? Tu cerebro lo agradecerá 🧠",
    "Llevas mucho tiempo. Considera un break ☕",
  ],
  drift: [
    "Detecté muchos cambios de archivo. ¿Todo bien? 🔄",
    "Context switching alto. Respira hondo 🌬️",
  ],
  levelUp: ["¡LEVEL UP! 🎉", "¡Nuevo nivel desbloqueado! 🚀"],
  achievement: ["¡Logro desbloqueado! 🏆", "¡Bien hecho! 👏"],
};
```

**Animación:**

- Cada estado tiene 8 frames (0-7)
- Sprites en PNG (media/assistant/{state}/)
- Cambio de frame cada 100ms (10 FPS)

---

### 10. UserSyncManager.ts

**Responsabilidad:** Sincronización en la nube con GitHub.

**Flujo de autenticación:**

```
Usuario ejecuta comando "Focus Pulse: Authenticate"
    ↓
VS Code abre OAuth de GitHub
    ↓
Usuario autoriza
    ↓
Extension recibe accessToken
    ↓
Token guardado en SecretStorage
    ↓
Sincronización automática activada (cada 30 min)
```

**Datos sincronizados:**

```typescript
interface SyncData {
  version: string; // Versión de la extensión
  timestamp: number; // Timestamp de sincronización
  history: HistoryDay[]; // Historial de días
  xpState: XpState; // Estado XP
  pomodoros: number; // Pomodoros completados
  deepWorkSessions: number; // Sesiones Deep Work
  customAchievements: CustomAchievement[]; // Logros personalizados
  // NO incluye nombres de archivos (privacidad)
}
```

**Funcionalidades:**

- Sincronización automática configurable (30 min default)
- Historial de versiones (últimas 10)
- Merge inteligente (preserva XP máximo)
- Resolución de conflictos (prioridad a datos más recientes)

---

## ⚙️ Configuración (settings.json)

### Configuración completa disponible:

```jsonc
{
  // Barra de estado
  "focusPulse.enableStatusBar": true,

  // Focus Score
  "focusPulse.minMinutesForScore": 1,
  "focusPulse.score.timeWeight": 0.3,
  "focusPulse.score.editsWeight": 8,
  "focusPulse.score.switchPenalty": 15,

  // Pomodoro
  "focusPulse.enablePomodoro": true,
  "focusPulse.pomodoro.workMinutes": 25,
  "focusPulse.pomodoro.breakMinutes": 5,

  // Objetivos diarios
  "focusPulse.goals.enabled": true,
  "focusPulse.goals.minutes": 60,
  "focusPulse.goals.pomodoros": 3,

  // Deep Work
  "focusPulse.deepWork.enabled": true,
  "focusPulse.deepWork.durationMinutes": 60,
  "focusPulse.deepWork.switchPenalty": 40,
  "focusPulse.deepWork.xpBonus": 150,

  // Sincronización
  "focusPulse.sync.enabled": true,
  "focusPulse.sync.intervalMinutes": 30,

  // GitHub (para sync)
  "focusPulse.githubToken": "", // Se almacena en SecretStorage
}
```

---

## 🎮 Comandos Disponibles

### Comandos principales (Command Palette):

```
Focus Pulse: Open Dashboard
├─ ID: focusPulse.openDashboard
└─ Descripción: Abre el dashboard completo en panel lateral

Focus Pulse: Show File Stats
├─ ID: focusPulse.showStats
└─ Descripción: Muestra stats del archivo actual en modal

Focus Pulse: Toggle Pomodoro
├─ ID: focusPulse.pomodoroToggle
└─ Descripción: Inicia/pausa el timer Pomodoro

Focus Pulse: Toggle Deep Work
├─ ID: focusPulse.deepWorkToggle
└─ Descripción: Inicia/finaliza sesión Deep Work

Focus Pulse: Create Custom Achievement
├─ ID: focusPulse.createCustomAchievement
└─ Descripción: Wizard para crear logro personalizado

Focus Pulse: Export Data
├─ ID: focusPulse.exportDataToFile
└─ Descripción: Exporta datos a JSON o XML

Focus Pulse: Import Data
├─ ID: focusPulse.importDataFromFile
└─ Descripción: Importa datos desde archivo

Focus Pulse: Authenticate
├─ ID: focusPulse.authenticate
└─ Descripción: Autenticar cuenta GitHub para sync

Focus Pulse: Manual Sync
├─ ID: focusPulse.manualSync
└─ Descripción: Forzar sincronización inmediata

Focus Pulse: Download Sync
├─ ID: focusPulse.downloadSync
└─ Descripción: Descargar versión específica de sincronización

Focus Pulse: List Syncs
├─ ID: focusPulse.listSyncs
└─ Descripción: Ver historial de sincronizaciones

Focus Pulse: Delete Sync
├─ ID: focusPulse.deleteSync
└─ Descripción: Eliminar sincronización de la nube

Focus Pulse: Sign Out
├─ ID: focusPulse.signOut
└─ Descripción: Cerrar sesión y detener sync automático

Focus Pulse: Sync Status
├─ ID: focusPulse.syncStatus
└─ Descripción: Ver estado de sincronización actual

Focus Pulse: Reset Data
├─ ID: focusPulse.resetData
└─ Descripción: Limpiar todo el historial y XP (con confirmación)
```

---

## 🔄 Flujos Importantes

### Flujo 1: Inicio de sesión

```
Usuario abre VS Code con archivo abierto
    ↓
extension-refactored.ts → activate()
    ↓
storage.loadHistory() → Cargar historial desde GlobalState
    ↓
onDidChangeActiveTextEditor() dispara
    ↓
focusTracker.trackSwitch(null, currentFile)
    ↓
EventBus.emit('file:focus:changed')
    ↓
StateManager actualiza estado
    ↓
statusBar.update() → Muestra nivel + score en barra
    ↓
setInterval cada 2s comienza a ejecutar updateAll()
```

### Flujo 2: Usuario edita código

```
Usuario escribe en el editor
    ↓
onDidChangeTextDocument() dispara
    ↓
focusTracker.trackEdit(uri, contentChanges)
    ├─ Incrementa edits++
    ├─ Calcula added/deleted lines
    └─ Actualiza timeMs (desde lastActivatedAt)
    ↓
EventBus.emit('file:edit:occurred')
    ↓
StateManager actualiza focus.sessionEdits
    ↓
updateAll() (cada 2s)
    ├─ updateHistoryFromStats()
    │   └─ Actualiza día actual en historial
    ├─ computeXpState()
    │   ├─ Calcula XP ganado
    │   └─ Verifica si hay level up
    ├─ computeAchievements()
    │   └─ Verifica logros desbloqueados
    └─ updateRefactoredDashboard()
        └─ DashboardRenderer.render() → Actualiza Webview
```

### Flujo 3: Usuario cambia de archivo

```
Usuario hace clic en otro archivo en el explorador
    ↓
onDidChangeActiveTextEditor() dispara
    ↓
focusTracker.trackSwitch(oldFile, newFile)
    ├─ Incrementa switches en oldFile
    ├─ Calcula penalización al score
    └─ Actualiza lastActivatedAt en newFile
    ↓
EventBus.emit('file:switch:occurred')
    ↓
StateManager actualiza focus.currentScore (decremento)
    ↓
statusBar.update() → Color cambia si score baja de 50
    ↓
AssistantService detecta context switching alto
    └─ Cambia estado a WARNING si >10 switches en 5 min
```

### Flujo 4: Usuario completa Pomodoro

```
Usuario ejecuta "Toggle Pomodoro"
    ↓
pomodoro.start() → Inicia timer de 25 min
    ↓
EventBus.emit('pomodoro:started')
    ↓
StateManager actualiza pomodoro.isActive = true
    ↓
Timer countdown cada segundo
    ↓
Al llegar a 0:
    ↓
pomodoro.complete()
    ├─ Incrementa pomodoro count (hoy + total)
    └─ EventBus.emit('pomodoro:completed')
    ↓
xp.ts escucha evento
    └─ Añade +50 XP (hoy) / +10 XP (histórico)
    ↓
achievements.ts verifica logro "pomodoro_10"
    └─ Si es 10º pomodoro → EventBus.emit('achievement:unlocked')
    ↓
AssistantService detecta evento
    └─ Cambia a estado SUCCESS con mensaje "¡Pomodoro completado! 🍅"
```

### Flujo 5: Sincronización en la nube

```
Usuario ejecuta "Authenticate"
    ↓
UserSyncManager.authenticate()
    ├─ VS Code abre OAuth GitHub
    └─ Usuario autoriza
    ↓
Token guardado en context.secrets
    ↓
Sincronización automática activada (cada 30 min)
    ↓
[30 minutos después]
    ↓
UserSyncManager.syncUp()
    ├─ Recopila datos (history, xp, logros)
    ├─ Serializa a JSON
    └─ Sube a GitHub vía Octokit
    ↓
[En otro dispositivo]
    ↓
Usuario ejecuta "Download Sync"
    ↓
UserSyncManager.syncDown()
    ├─ Descarga JSON de GitHub
    ├─ Merge inteligente con datos locales
    │   └─ Preserva XP máximo, combina historial
    └─ Guarda en GlobalState
    ↓
EventBus.emit('data:loaded')
    ↓
Dashboard se actualiza con nuevos datos
```

---

## 🗂️ Tipos de Datos Principales

### FocusStats (focusTracker.ts)

```typescript
interface FocusStats {
  uri: string; // "file:///path/to/file.ts"
  fileName: string; // "file.ts"
  timeMs: number; // Tiempo acumulado en ms
  edits: number; // Total de ediciones
  switches: number; // Cambios desde este archivo
  added: number; // Líneas añadidas
  deleted: number; // Líneas eliminadas
  lastActivatedAt: number; // Timestamp último acceso
}
```

### FocusSummary (focusTracker.ts)

```typescript
interface FocusSummary {
  totalTimeMs: number; // Tiempo total de sesión
  totalEdits: number; // Ediciones totales
  totalSwitches: number; // Cambios de archivo totales
  avgScore: number; // Puntuación promedio (0-100)
}
```

### HistoryDay (storage.ts)

```typescript
interface HistoryDay {
  date: string; // "YYYY-MM-DD"
  totalTimeMs: number; // Tiempo total del día
  totalEdits: number; // Ediciones totales
  avgScore: number; // Puntuación promedio
  sessions: {
    // Sesiones del día
    start: number; // Timestamp inicio
    end: number; // Timestamp fin
    files: {
      name: string; // Nombre archivo (NO ruta completa)
      edits: number; // Ediciones en archivo
      timeMs: number; // Tiempo en archivo
    }[];
  }[];
}
```

### XpState (xp.ts)

```typescript
interface XpState {
  totalXp: number; // XP acumulado total
  level: number; // Nivel actual (1+)
  xpInLevel: number; // XP en el nivel actual
  xpToNext: number; // XP necesario para subir
}
```

### Achievement (achievements.ts)

```typescript
interface Achievement {
  id: string; // Identificador único
  title: string; // Título corto
  description: string; // Descripción detallada
  icon: string; // Emoji o icono
  color: string; // Color hex (#...)
  custom?: boolean; // Si es logro personalizado
  unlocked?: boolean; // Si está desbloqueado
  progress?: number; // Progreso (0-100)
}
```

### DailyGoalProgress (goals.ts)

```typescript
interface DailyGoalProgress {
  minutesGoal: number; // Meta de minutos (default 60)
  minutesCurrent: number; // Minutos actuales
  pomodorosGoal: number; // Meta de pomodoros (default 3)
  pomodorosCurrent: number; // Pomodoros actuales
  date: string; // "YYYY-MM-DD"
}
```

### PomodoroState (pomodoro.ts)

```typescript
interface PomodoroState {
  isActive: boolean; // Si el timer está corriendo
  mode: "work" | "break"; // Modo actual
  startTime: number; // Timestamp inicio
  remainingTime: number; // Tiempo restante (ms)
  totalPomodoros: number; // Total histórico
  todayPomodoros: number; // Pomodoros hoy
}
```

### DeepWorkState (deepWork.ts)

```typescript
interface DeepWorkState {
  isActive: boolean; // Si está en Deep Work
  startTime: number; // Timestamp inicio
  duration: number; // Duración objetivo (ms)
  completedSessions: number; // Sesiones completadas (histórico)
  currentScore: number; // Score actual de sesión
}
```

### AppState (StateTypes.ts)

```typescript
interface AppState {
  focus: {
    currentScore: number;
    sessionTime: number;
    sessionEdits: number;
    sessionSwitches: number;
    topFiles: { name: string; timeMs: number; edits: number }[];
  };
  pomodoro: PomodoroState;
  achievements: {
    unlocked: string[];
    progress: Record<string, number>;
  };
  xp: XpState;
  deepWork: DeepWorkState;
  goals: DailyGoalProgress;
  ui: {
    isDashboardVisible: boolean;
  };
  session: {
    startTime: number;
    isPaused: boolean;
  };
}
```

---

## 🧪 Testing y Debugging

### Debugging local

```bash
# Compilar TypeScript
npm run compile

# Compilar en modo watch (recarga automática)
npm run watch

# Ejecutar extensión en modo debug
F5 (en VS Code) → Abre Extension Development Host
```

### Inspeccionar Webview

```
1. Abrir dashboard (Focus Pulse: Open Dashboard)
2. Cmd+Shift+P → "Developer: Open Webview Developer Tools"
3. Inspeccionar HTML/CSS/JS de la webview
```

### Limpiar datos de prueba

```
Focus Pulse: Reset Data
└─ Elimina historial, XP, logros, etc.
```

### Ver logs

```typescript
// En el código:
console.log('Debug message');

// En VS Code:
View → Output → Select "Focus Pulse" from dropdown
```

---

## 📦 Build y Publicación

### Compilar extensión

```bash
npm run compile        # Compilar TypeScript
npm run package        # Crear .vsix con vsce
```

### Publicar a Marketplace

```bash
vsce publish           # Publicar nueva versión
vsce publish minor     # Incrementar versión minor
vsce publish major     # Incrementar versión major
```

### Versionado (Semantic Versioning)

- **Patch (2.4.1 → 2.4.2)**: Bug fixes
- **Minor (2.4.x → 2.5.0)**: Nuevas features compatibles
- **Major (2.x.x → 3.0.0)**: Breaking changes

---

## 🚀 Roadmap y Próximas Features

### v2.4.x (Actual - En desarrollo)

- ✅ Asistente virtual con animaciones
- ✅ Sincronización en la nube
- ✅ Logros personalizados
- 🔄 Multiidioma (español, inglés)
- 🔄 Modo oscuro/claro para dashboard

### v2.5.0 (Próximo)

- 🔜 Sistema de amigos y competencia social
- 🔜 Gráficos de tendencias (semana/mes)
- 🔜 Integración con GitHub para commits
- 🔜 Modo "Focus Group" (equipos)

### v3.0.0 (Largo plazo)

- 🔜 Análisis personal avanzado con IA
- 🔜 Recomendaciones de productividad
- 🔜 Integración con otros editores (JetBrains, etc.)
- 🔜 API pública para extensiones

---

## 🐛 Issues Conocidos

### Branch actual: review

- **Estado**: En revisión
- **Últimos commits**:
  - `fix: assistant animation`
  - `fix: assistant images`
  - `fix: sync`
  - `fix: auth user`
  - `Implements frames for assistant`

### Archivos modificados sin commit:

- `package.json` (modificado)

---

## 📚 Referencias Útiles

### Documentación oficial

- VS Code Extension API: https://code.visualstudio.com/api
- TypeScript Handbook: https://www.typescriptlang.org/docs/
- Webview API: https://code.visualstudio.com/api/extension-guides/webview

### Arquitectura

- Event-Driven Architecture: https://martinfowler.com/articles/201701-event-driven.html
- Observer Pattern: https://refactoring.guru/design-patterns/observer
- State Management: https://kentcdodds.com/blog/application-state-management-with-react

### Gamificación

- Pomodoro Technique: https://francescocirillo.com/products/the-pomodoro-technique
- Deep Work (Cal Newport): https://www.calnewport.com/books/deep-work/
- Flow State: https://en.wikipedia.org/wiki/Flow_(psychology)

---

## 🤝 Contribuir

### Estructura de ramas

- `main`: Código estable (producción)
- `develop`: Desarrollo activo
- `feature/*`: Nuevas features
- `fix/*`: Bug fixes
- `review`: Revisión pre-merge (actual)

### Flujo de trabajo

```bash
# Crear rama de feature
git checkout -b feature/mi-feature

# Hacer cambios y commit
git add .
git commit -m "feat: descripción"

# Push y crear PR
git push origin feature/mi-feature
```

### Convenciones de commits

```
feat: Nueva funcionalidad
fix: Corrección de bug
docs: Cambios en documentación
style: Formato, espaciado, etc.
refactor: Refactorización sin cambio funcional
test: Añadir tests
chore: Tareas de mantenimiento
```

---

## 💡 Tips para Desarrolladores

### 1. Extensión del estado

Si necesitas añadir nuevo estado:

```typescript
// 1. Actualizar StateTypes.ts
interface AppState {
  // ... estado existente
  myNewFeature: {
    enabled: boolean;
    data: any;
  };
}

// 2. Actualizar StateManager.ts (inicialización)
const initialState: AppState = {
  // ... estado existente
  myNewFeature: {
    enabled: false,
    data: null,
  },
};

// 3. Usar en tu módulo
stateManager.subscribe("myNewFeature.enabled", (enabled) => {
  console.log("Feature enabled:", enabled);
});
```

### 2. Añadir nuevo evento

```typescript
// 1. Actualizar EventTypes.ts
export type EventType =
  | 'existing:event'
  | 'my:new:event'; // Añadir aquí

export interface EventPayloads {
  'existing:event': { ... };
  'my:new:event': { myData: string }; // Añadir payload
}

// 2. Emitir en tu módulo
eventBus.emit('my:new:event', { myData: 'value' });

// 3. Escuchar en otro módulo
eventBus.on('my:new:event', (data) => {
  console.log(data.myData);
});
```

### 3. Crear nuevo componente de Webview

```typescript
// 1. Crear archivo en webview/components/MyComponent.ts
export class MyComponent {
  static render(state: AppState): string {
    return `
      <div class="my-component">
        <h3>${state.myFeature.title}</h3>
        <p>${state.myFeature.description}</p>
      </div>
    `;
  }
}

// 2. Importar en DashboardRenderer.ts
import { MyComponent } from "./components/MyComponent";

// 3. Añadir al render
export function renderDashboard(state: AppState): string {
  return `
    ...
    ${MyComponent.render(state)}
    ...
  `;
}
```

### 4. Añadir nuevo comando

```typescript
// 1. En extension-refactored.ts
context.subscriptions.push(
  vscode.commands.registerCommand('focusPulse.myCommand', () => {
    // Tu lógica aquí
    vscode.window.showInformationMessage('Mi comando ejecutado!');
  })
);

// 2. En package.json
"contributes": {
  "commands": [
    {
      "command": "focusPulse.myCommand",
      "title": "Focus Pulse: My Command"
    }
  ]
}
```

### 5. Optimización de rendimiento

- **Debouncing**: Usar `Debouncer.ts` para escritura en storage
- **Throttling**: No actualizar dashboard más de 1 vez cada 2s
- **Lazy loading**: Cargar componentes solo cuando son visibles
- **Memoización**: Cachear cálculos costosos (XP, logros)

---

## 📝 Notas Finales

Este documento está diseñado para que cualquier desarrollador pueda entender el proyecto Focus Pulse sin necesidad de explorar el código fuente. Cubre:

- ✅ Propósito y funcionalidad
- ✅ Arquitectura y diseño
- ✅ Componentes principales
- ✅ Flujos de datos
- ✅ Configuración y comandos
- ✅ Tipos y estructuras
- ✅ Guías de desarrollo

Para cualquier duda o sugerencia, contactar con el equipo de desarrollo.

---

**Última actualización**: 2026-02-02
**Versión del proyecto**: 2.4.1
**Branch**: review
