import * as vscode from "vscode";
import { CustomAchievement, validateCustomAchievement, generateAchievementId } from "../achievements";

export class CustomAchievementManager {
  private static currentPanel: vscode.WebviewPanel | undefined;

  public static show(context: vscode.ExtensionContext): void {
    if (this.currentPanel) {
      this.currentPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "customAchievements",
      "Logros Personalizados - Focus Pulse",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.getWebviewContent(panel.webview, context);

    panel.webview.onDidReceiveMessage(
      async (msg) => {
        switch (msg.type) {
          case "loadAchievements":
            this.loadAchievements(panel.webview, context);
            break;
          case "createAchievement":
            this.createAchievement(panel.webview, context, msg.data);
            break;
          case "deleteAchievement":
            this.deleteAchievement(panel.webview, context, msg.id);
            break;
          case "validateAchievement":
            this.validateAchievement(panel.webview, msg.data);
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    panel.onDidDispose(
      () => {
        this.currentPanel = undefined;
      },
      null,
      context.subscriptions
    );

    this.currentPanel = panel;
  }

  private static getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logros Personalizados - Focus Pulse</title>
    <script>
        const vscode = acquireVsCodeApi();
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .achievement-preview {
            transition: all 0.3s ease;
        }
        .achievement-preview:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }
        .badge-glow {
            animation: glow 2s ease-in-out infinite alternate;
        }
        @keyframes glow {
            from { box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); }
            to { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
        }
    </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">
    <div class="max-w-4xl mx-auto p-6">
        <header class="mb-8">
            <div class="flex items-center gap-3 mb-2">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl">
                    🏆
                </div>
                <div>
                    <h1 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        Logros Personalizados
                    </h1>
                    <p class="text-slate-400">Crea tus propios logros y badges para motivarte</p>
                </div>
            </div>
        </header>

        <div class="grid lg:grid-cols-2 gap-8">
            <!-- Formulario de creación -->
            <section class="bg-slate-800 rounded-xl p-6">
                <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
                    <span>✨</span> Crear Nuevo Logro
                </h2>
                
                <form id="achievement-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-2">Título</label>
                        <input type="text" id="title" maxlength="50" required
                               class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                               placeholder="Ej: Maestro del Código">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
                        <textarea id="description" maxlength="150" required rows="3"
                                  class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="Ej: Completa 100 minutos de foco en un día"></textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2">Icono (opcional)</label>
                            <input type="text" id="icon" maxlength="2"
                                   class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                   placeholder="🎯">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2">Color (opcional)</label>
                            <select id="color" class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option value="blue">Azul</option>
                                <option value="green">Verde</option>
                                <option value="purple">Púrpura</option>
                                <option value="red">Rojo</option>
                                <option value="yellow">Amarillo</option>
                                <option value="pink">Rosa</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-2">Condición</label>
                        <div class="grid grid-cols-3 gap-3">
                            <select id="condition-type" class="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option value="focus_time">Tiempo de foco</option>
                                <option value="streak">Racha de días</option>
                                <option value="files_worked">Archivos trabajados</option>
                                <option value="pomodoros">Pomodoros</option>
                                <option value="xp_level">Nivel de XP</option>
                                <option value="score_avg">Puntuación media</option>
                                <option value="edits_count">Número de ediciones</option>
                            </select>
                            
                            <select id="condition-operator" class="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option value="gte">≥ (al menos)</option>
                                <option value="gt">> (más de)</option>
                                <option value="eq">= (exactamente)</option>
                                <option value="lte">≤ (como máximo)</option>
                                <option value="lt">< (menos de)</option>
                            </select>
                            
                            <input type="number" id="condition-value" min="1" required
                                   class="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                   placeholder="Valor">
                        </div>
                        
                        <select id="condition-timeframe" class="mt-3 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option value="">(total)</option>
                            <option value="today">Hoy</option>
                            <option value="week">Esta semana</option>
                            <option value="month">Este mes</option>
                        </select>
                    </div>

                    <div id="validation-errors" class="hidden bg-red-900/50 border border-red-600 rounded-lg p-3 text-sm text-red-200"></div>

                    <div class="flex gap-3 pt-4">
                        <button type="submit" class="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium py-2 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105">
                            🚀 Crear Logro
                        </button>
                        <button type="button" id="preview-btn" class="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors">
                            👁️ Vista Previa
                        </button>
                    </div>
                </form>
            </section>

            <!-- Vista previa y lista -->
            <section>
                <!-- Vista previa -->
                <div id="preview-section" class="hidden bg-slate-800 rounded-xl p-6 mb-6 achievement-preview">
                    <h3 class="text-lg font-semibold mb-4">Vista Previa</h3>
                    <div id="achievement-preview" class="inline-flex flex-col gap-2 rounded-lg border px-3 py-2"></div>
                </div>

                <!-- Lista de logros existentes -->
                <div class="bg-slate-800 rounded-xl p-6">
                    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                        <span>📋</span> Logros Personalizados Existentes
                    </h3>
                    <div id="achievements-list" class="space-y-3">
                        <p class="text-slate-400 text-sm">Cargando logros...</p>
                    </div>
                </div>
            </section>
        </div>
    </div>

    <script>
        let currentAchievements = [];

        // Cargar logros al iniciar
        window.addEventListener('load', () => {
            vscode.postMessage({ type: 'loadAchievements' });
        });

        // Formulario
        document.getElementById('achievement-form').addEventListener('submit', (e) => {
            e.preventDefault();
            createAchievement();
        });

        // Vista previa
        document.getElementById('preview-btn').addEventListener('click', () => {
            showPreview();
        });

        // Validación en tiempo real
        ['title', 'description', 'condition-type', 'condition-operator', 'condition-value'].forEach(id => {
            document.getElementById(id).addEventListener('input', validateForm);
        });

        function createAchievement() {
            const achievement = {
                title: document.getElementById('title').value.trim(),
                description: document.getElementById('description').value.trim(),
                icon: document.getElementById('icon').value.trim() || '🏆',
                color: document.getElementById('color').value,
                condition: {
                    type: document.getElementById('condition-type').value,
                    operator: document.getElementById('condition-operator').value,
                    value: parseInt(document.getElementById('condition-value').value),
                    timeframe: document.getElementById('condition-timeframe').value || undefined
                }
            };

            vscode.postMessage({
                type: 'createAchievement',
                data: achievement
            });
        }

        function showPreview() {
            const achievement = {
                title: document.getElementById('title').value.trim() || 'Título del logro',
                description: document.getElementById('description').value.trim() || 'Descripción del logro',
                icon: document.getElementById('icon').value.trim() || '🏆',
                color: document.getElementById('color').value
            };

            const previewSection = document.getElementById('preview-section');
            const preview = document.getElementById('achievement-preview');
            
            preview.className = \`inline-flex flex-col gap-2 rounded-lg border px-3 py-2 badge-glow \${getColorClasses(achievement.color)}\`;
            preview.innerHTML = \`
                <span class="text-xl font-semibold">\${achievement.icon} \${achievement.title}</span>
                <span class="text-xs opacity-80">\${achievement.description}</span>
            \`;
            
            previewSection.classList.remove('hidden');
        }

        function validateForm() {
            const achievement = {
                title: document.getElementById('title').value.trim(),
                description: document.getElementById('description').value.trim(),
                icon: document.getElementById('icon').value.trim(),
                condition: {
                    type: document.getElementById('condition-type').value,
                    operator: document.getElementById('condition-operator').value,
                    value: parseInt(document.getElementById('condition-value').value),
                    timeframe: document.getElementById('condition-timeframe').value || undefined
                }
            };

            vscode.postMessage({
                type: 'validateAchievement',
                data: achievement
            });
        }

        function getColorClasses(color) {
            const colors = {
                blue: 'border-blue-500/60 bg-blue-500/10 text-blue-200',
                green: 'border-green-500/60 bg-green-500/10 text-green-200',
                purple: 'border-purple-500/60 bg-purple-500/10 text-purple-200',
                red: 'border-red-500/60 bg-red-500/10 text-red-200',
                yellow: 'border-yellow-500/60 bg-yellow-500/10 text-yellow-200',
                pink: 'border-pink-500/60 bg-pink-500/10 text-pink-200'
            };
            return colors[color] || colors.blue;
        }

        function renderAchievements(achievements) {
            const container = document.getElementById('achievements-list');
            
            if (!achievements || achievements.length === 0) {
                container.innerHTML = '<p class="text-slate-400 text-sm">No hay logros personalizados aún. ¡Crea el primero!</p>';
                return;
            }

            container.innerHTML = achievements.map(achievement => \`
                <div class="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div class="flex items-center gap-3">
                        <div class="text-2xl">\${achievement.icon}</div>
                        <div>
                            <div class="font-medium">\${achievement.title}</div>
                            <div class="text-xs text-slate-400">\${achievement.description}</div>
                            <div class="text-xs text-slate-500 mt-1">
                                Condición: \${formatCondition(achievement.condition)}
                            </div>
                        </div>
                    </div>
                    <button onclick="deleteAchievement('\${achievement.id}')" 
                            class="text-red-400 hover:text-red-300 transition-colors">
                        🗑️
                    </button>
                </div>
            \`).join('');
        }

        function formatCondition(condition) {
            const typeNames = {
                focus_time: 'Tiempo de foco',
                streak: 'Racha de días',
                files_worked: 'Archivos trabajados',
                pomodoros: 'Pomodoros',
                xp_level: 'Nivel de XP',
                score_avg: 'Puntuación media',
                edits_count: 'Ediciones'
            };

            const operatorNames = {
                gte: 'al menos',
                gt: 'más de',
                eq: 'exactamente',
                lte: 'como máximo',
                lt: 'menos de'
            };

            const timeframeNames = {
                today: 'hoy',
                week: 'esta semana',
                month: 'este mes',
                total: 'en total'
            };

            let text = \`\${typeNames[condition.type]} \${operatorNames[condition.operator]} \${condition.value}\`;
            if (condition.timeframe) {
                text += \` \${timeframeNames[condition.timeframe]}\`;
            }
            return text;
        }

        function deleteAchievement(id) {
            if (confirm('¿Estás seguro de que quieres eliminar este logro?')) {
                vscode.postMessage({
                    type: 'deleteAchievement',
                    id: id
                });
            }
        }

        function showValidationErrors(errors) {
            const errorDiv = document.getElementById('validation-errors');
            if (errors && errors.length > 0) {
                errorDiv.innerHTML = errors.map(err => \`• \${err}\`).join('<br>');
                errorDiv.classList.remove('hidden');
            } else {
                errorDiv.classList.add('hidden');
            }
        }

        // Recibir mensajes del extension host
        window.addEventListener('message', event => {
            const msg = event.data;
            
            switch (msg.type) {
                case 'achievementsLoaded':
                    currentAchievements = msg.data;
                    renderAchievements(currentAchievements);
                    break;
                case 'validationResult':
                    showValidationErrors(msg.data.errors);
                    break;
                case 'achievementCreated':
                    vscode.postMessage({ type: 'loadAchievements' });
                    document.getElementById('achievement-form').reset();
                    showValidationErrors([]);
                    break;
                case 'achievementDeleted':
                    vscode.postMessage({ type: 'loadAchievements' });
                    break;
            }
        });
    </script>
</body>
</html>`;
  }

  private static loadAchievements(webview: vscode.Webview, context: vscode.ExtensionContext): void {
    const { getCustomAchievements } = require("../achievements");
    const achievements = getCustomAchievements(context);
    webview.postMessage({
      type: "achievementsLoaded",
      data: achievements
    });
  }

  private static createAchievement(webview: vscode.Webview, context: vscode.ExtensionContext, data: any): void {
    const { validateCustomAchievement, generateAchievementId, saveCustomAchievement } = require("../achievements");
    
    const achievement = {
      ...data,
      id: generateAchievementId(data.title),
      created: Date.now(),
      custom: true
    };

    const validation = validateCustomAchievement(achievement);
    
    if (!validation.valid) {
      webview.postMessage({
        type: "validationResult",
        data: { errors: validation.errors }
      });
      return;
    }

    saveCustomAchievement(achievement, context);
    webview.postMessage({ type: "achievementCreated" });
  }

  private static deleteAchievement(webview: vscode.Webview, context: vscode.ExtensionContext, id: string): void {
    const { deleteCustomAchievement } = require("../achievements");
    deleteCustomAchievement(id, context);
    webview.postMessage({ type: "achievementDeleted" });
  }

  private static validateAchievement(webview: vscode.Webview, data: any): void {
    const { validateCustomAchievement } = require("../achievements");
    const achievement = {
      ...data,
      id: "temp-id",
      created: Date.now(),
      custom: true
    };

    const validation = validateCustomAchievement(achievement);
    webview.postMessage({
      type: "validationResult",
      data: { errors: validation.valid ? [] : validation.errors }
    });
  }
}