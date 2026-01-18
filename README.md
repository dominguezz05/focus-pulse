# ⚡ Focus Pulse

[![VS Code](https://img.shields.io/badge/VS%20Code-extension-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com/)
![Version](https://img.shields.io/badge/version-0.4.0-informational)
![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/Made%20with-TypeScript-3178C6?logo=typescript&logoColor=white)
![Status](https://img.shields.io/badge/status-Experimental-orange)
[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/dominguezz05.focus-pulse?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=dominguezz05.focus-pulse)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/dominguezz05.focus-pulse)](https://marketplace.visualstudio.com/items?itemName=dominguezz05.focus-pulse)

**Focus Pulse** es una extensión de VS Code que mide tu **foco real al programar**, combinando:

- Análisis en tiempo real por archivo
- Sistema Pomodoro integrado
- XP + niveles + logros
- Dashboard visual con Tailwind
- Racha de días y progreso diario

Diseñado para desarrolladores que quieren mejorar su productividad sin complicarse.

---

## 🖼 Vista previa

### Dashboard principal

## ![Focus Pulse Dashboard](media/focus-pulse-dashboard.png)

## ✨ Características principales

✔ **Dashboard en vivo**  
Muestra en tiempo real tu desempeño: score, tiempo, ediciones, cambios de archivo, XP y nivel.

✔ **Focus Score inteligente**  
Calcula foco usando tiempo, ritmo de edición y penalización por cambios de fichero.  
Configurable desde Settings.

✔ **Pomodoro integrado**  
Temporizador de trabajo/descanso con bonus de XP y logros.

✔ **XP + niveles + gamificación**  
Sube de nivel como si fuera un RPG.  
Bonus por rachas y pomodoros completados.

✔ **Logros diarios**  
Desbloquea insignias por disciplina, racha, minutos, nivel o pomodoros.

✔ **Racha de días**  
Visualiza consistencia semanal: 1 día, 3 días, 7 días…

✔ **Integrado en la barra de estado**  
Muestra `Lvl X · Focus Y` + tiempo y ediciones del archivo activo.

✔ **Sin fricción y sin cuentas**  
Funciona completamente offline.  
No envía datos a ningún servidor.

---

## 📊 Cómo funciona

Focus Pulse registra:

- Tiempo activo por archivo
- Número de ediciones
- Cambios de pestaña
- Racha de días
- Sesiones Pomodoro
- XP total y nivel

El objetivo no es medirte, sino **entrenar disciplina** y evitar multitarea innecesaria.

---

## 🖥 Dashboard

Ejecuta:

Focus Pulse: Abrir dashboard

Incluye:

| Bloque         | Métrica               |
| -------------- | --------------------- |
| Nivel + XP     | Barra de progreso     |
| Pomodoros      | Hoy + total           |
| Racha          | Días consecutivos     |
| Últimos 7 días | Media de foco         |
| Archivos hoy   | Score + tiempo        |
| Logros         | Se actualizan en vivo |
| Tabla          | Detalle por archivo   |

---

## ⏱ Pomodoro

Ejecuta:

Focus Pulse: Iniciar/Parar Pomodoro

Modos:

- `Work` → +XP base + bonus
- `Break`
- `Idle`

Bonus XP por bloque completado.  
Logros especiales si encadenas varios.

---

## 🎮 XP, niveles y logros

El sistema XP recompensa:

- Tiempo productivo
- Score alto
- Racha de días
- Pomodoros completados

Ejemplo de logros:

- Primer enfoque
- 20 minutos de foco
- Cuatro pomodoros hoy
- Racha x7
- Nivel 5 — “Dev disciplinado”
- Nivel 10 — “Leyenda del foco”

---

## ⚙ Configuración

Desde Settings (Focus Pulse):

- minMinutesForScore — minutos mínimos para estabilizar el score

- focusPulse.score.timeWeight — peso del tiempo

- focusPulse.score.editsWeight — peso de las ediciones por minuto

- focusPulse.score.switchPenalty — penalización por cambio de archivo

- focusPulse.enablePomodoro — activar/desactivar Pomodoro

- focusPulse.pomodoro.workMinutes — duración de trabajo

- focusPulse.pomodoro.breakMinutes — duración de descanso

---

## 🧾 Comandos

| Comando                                                  | Acción                 |
| -------------------------------------------------------- | ---------------------- |
| **Focus Pulse: Abrir dashboard**                         | Estadísticas completas |
| **Focus Pulse: Mostrar estadísticas del archivo actual** | Popup rápido           |
| **Focus Pulse: Iniciar/Parar Pomodoro**                  | Timer integrado        |
| **Focus Pulse: Resetear histórico y XP**                 | Limpia datos           |
| **Focus Pulse: Show Stats**                              | Alias                  |

---

## 🗂 Datos y privacidad

- Todo se guarda **localmente en VS Code**
- No envía datos
- No hace tracking externo
- No requiere cuenta

---

## 🚀 Instalación (VSIX)

```bash
vsce package
```

Instalar en VS Code:

Extensions → Install from VSIX…

Seleccionar focus-pulse-x.y.z.vsix

Reiniciar VS Code si lo pide

Extensions → Install from VSIX…

---

Copyright (c) 2026 Iker
