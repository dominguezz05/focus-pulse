import * as vscode from "vscode";
import {
  CustomAchievement,
  validateCustomAchievement,
  generateAchievementId,
} from "../achievements";

export class CustomAchievementManager {
  private static currentPanel: vscode.WebviewPanel | undefined;

  public static show(context: vscode.ExtensionContext): void {
    if (this.currentPanel) {
      this.currentPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "customAchievements",
      "Custom Achievements - Focus Pulse",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    panel.webview.html = this.getWebviewContent(panel.webview, context);

    panel.webview.onDidReceiveMessage(
      async (msg) => {
        switch (msg.type) {
          case "loadAchievements":
            this.loadAchievements(panel.webview, context);
            break;
          case "createAchievement":
            await this.createAchievement(panel.webview, context, msg.data);
            break;
          case "deleteAchievement":
            await this.deleteAchievement(panel.webview, context, msg.id);
            break;
          case "validateAchievement":
            this.validateAchievement(panel.webview, msg.data);
            break;
        }
      },
      undefined,
      context.subscriptions,
    );

    panel.onDidDispose(
      () => {
        this.currentPanel = undefined;
      },
      null,
      context.subscriptions,
    );

    this.currentPanel = panel;
  }

  private static getWebviewContent(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Custom Achievements - Focus Pulse</title>
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
                        Custom Achievements
                    </h1>
                    <p class="text-slate-400">Create your own achievements and badges to motivate yourself</p>
                </div>
            </div>
        </header>

        <div class="grid lg:grid-cols-2 gap-8">
            <!-- Creation form -->
            <section class="bg-slate-800 rounded-xl p-6">
                <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
                    <span>✨</span> Create New Achievement
                </h2>
                
                <form id="achievement-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-2">Title</label>
                        <input type="text" id="title" maxlength="50" required
                               class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                               placeholder="E.g.: Code Master">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-2">Description</label>
                        <textarea id="description" maxlength="150" required rows="3"
                                  class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="E.g.: Complete 100 minutes of focus in one day"></textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2">Icon (optional)</label>
                            <input type="text" id="icon" maxlength="2"
                                   class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                   placeholder="🎯">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2">Color (optional)</label>
                            <select id="color" class="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option value="blue">Blue</option>
                                <option value="green">Green</option>
                                <option value="purple">Purple</option>
                                <option value="red">Red</option>
                                <option value="yellow">Yellow</option>
                                <option value="pink">Pink</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-2">Condition</label>
                        <div class="grid grid-cols-3 gap-3">
                            <select id="condition-type" class="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option value="focus_time">Focus time</option>
                                <option value="streak">Day streak</option>
                                <option value="files_worked">Files worked</option>
                                <option value="pomodoros">Pomodoros</option>
                                <option value="xp_level">XP Level</option>
                                <option value="score_avg">Average score</option>
                                <option value="edits_count">Number of edits</option>
                            </select>
                            
                            <select id="condition-operator" class="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option value="gte">≥ (at least)</option>
                                <option value="gt">> (more than)</option>
                                <option value="eq">= (exactly)</option>
                                <option value="lte">≤ (at most)</option>
                                <option value="lt">< (less than)</option>
                            </select>
                            
                            <input type="number" id="condition-value" min="1" required
                                   class="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Value">
                        </div>
                        
                        <select id="condition-timeframe" class="mt-3 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option value="">(total)</option>
                            <option value="today">Today</option>
                            <option value="week">This week</option>
                            <option value="month">This month</option>
                        </select>
                    </div>

                    <div id="validation-errors" class="hidden bg-red-900/50 border border-red-600 rounded-lg p-3 text-sm text-red-200"></div>

                    <div class="flex gap-3 pt-4">
                        <button type="submit" class="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium py-2 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105">
                            🚀 Create Achievement
                        </button>
                        <button type="button" id="preview-btn" class="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors">
                            👁️ Preview
                        </button>
                    </div>
                </form>
            </section>

            <!-- Vista previa y lista -->
            <section>
                <!-- Vista previa -->
                <div id="preview-section" class="hidden bg-slate-800 rounded-xl p-6 mb-6 achievement-preview relative">
                    <button id="close-preview" aria-label="Close preview" title="Close" class="absolute right-3 top-3 text-slate-400 hover:text-white bg-slate-700/40 hover:bg-slate-700 rounded-full w-8 h-8 flex items-center justify-center">✖</button>
                    <h3 class="text-lg font-semibold mb-4">Preview</h3>
                    <div id="achievement-preview" class="inline-flex flex-col gap-2 rounded-lg border px-3 py-2"></div>
                </div>

                <!-- List of existing achievements -->
                <div class="bg-slate-800 rounded-xl p-6">
                    <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                        <span>📋</span> Existing Custom Achievements
                    </h3>
                    <div id="achievements-list" class="space-y-3">
                        <p class="text-slate-400 text-sm">Loading achievements...</p>
                    </div>
                </div>
            </section>
        </div>
    </div>

    <script>
        let currentAchievements = [];

        // Load achievements on start
        window.addEventListener('load', () => {
            vscode.postMessage({ type: 'loadAchievements' });
        });

        // Form
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
                title: document.getElementById('title').value.trim() || 'Achievement title',
                description: document.getElementById('description').value.trim() || 'Achievement description',
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

        // Close preview handlers
        try {
            const closeBtn = document.getElementById('close-preview');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    const previewSection = document.getElementById('preview-section');
                    if (previewSection) previewSection.classList.add('hidden');
                });
            }
        } catch (e) {
            // ignore
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const previewSection = document.getElementById('preview-section');
                if (previewSection && !previewSection.classList.contains('hidden')) {
                    previewSection.classList.add('hidden');
                }
            }
        });

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
                container.innerHTML = '<p class="text-slate-400 text-sm">No custom achievements yet. Create the first one!</p>';
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
                                Condition: \${formatCondition(achievement.condition)}
                            </div>
                        </div>
                    </div>
                   
                </div>
            \`).join('');
        }

        function formatCondition(condition) {
            const typeNames = {
                focus_time: 'Focus time',
                streak: 'Day streak',
                files_worked: 'Files worked',
                pomodoros: 'Pomodoros',
                xp_level: 'XP Level',
                score_avg: 'Average score',
                edits_count: 'Edits'
            };

            const operatorNames = {
                gte: 'at least',
                gt: 'more than',
                eq: 'exactly',
                lte: 'at most',
                lt: 'less than'
            };

            const timeframeNames = {
                today: 'today',
                week: 'this week',
                month: 'this month',
                total: 'in total'
            };

            let text = \`\${typeNames[condition.type]} \${operatorNames[condition.operator]} \${condition.value}\`;
            if (condition.timeframe) {
                text += \` \${timeframeNames[condition.timeframe]}\`;
            }
            return text;
        }

        function handleDeleteClick(e) {
            const btn = e.currentTarget;
            const id = btn.getAttribute('data-id');
            if (!id) return;
            if (!confirm('Are you sure you want to delete this achievement?')) return;
            try {
                btn.setAttribute('disabled', 'true');
                btn.textContent = 'Deleting...';
            } catch (err) {}
            vscode.postMessage({ type: 'deleteAchievement', id: id });
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
                    // prefer optimistic removal if id provided
                    if (msg.id) {
                        currentAchievements = currentAchievements.filter(a => a.id !== msg.id);
                        renderAchievements(currentAchievements);
                    } else {
                        vscode.postMessage({ type: 'loadAchievements' });
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
  }

  private static loadAchievements(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
  ): void {
    const { getCustomAchievements } = require("../achievements");
    const achievements = getCustomAchievements(context);
    webview.postMessage({
      type: "achievementsLoaded",
      data: achievements,
    });
  }

  private static async createAchievement(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    data: any,
  ): Promise<void> {
    const {
      validateCustomAchievement,
      generateAchievementId,
      saveCustomAchievement,
    } = require("../achievements");

    const achievement = {
      ...data,
      id: generateAchievementId(data.title),
      created: Date.now(),
      custom: true,
    };

    const validation = validateCustomAchievement(achievement);

    if (!validation.valid) {
      webview.postMessage({
        type: "validationResult",
        data: { errors: validation.errors },
      });
      return;
    }

    try {
      await saveCustomAchievement(achievement, context);
      webview.postMessage({ type: "achievementCreated" });
    } catch (err) {
      console.error("Failed to save custom achievement", err);
      webview.postMessage({
        type: "validationResult",
        data: { errors: ["Could not save the achievement. Try again."] },
      });
    }
  }

  private static async deleteAchievement(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    id: string,
  ): Promise<void> {
    const { deleteCustomAchievement } = require("../achievements");
    try {
      await deleteCustomAchievement(id, context);
      webview.postMessage({ type: "achievementDeleted", id });
    } catch (err) {
      console.error("Failed to delete custom achievement", err);
      webview.postMessage({
        type: "validationResult",
        data: { errors: ["Could not delete the achievement. Try again."] },
      });
    }
  }

  private static validateAchievement(webview: vscode.Webview, data: any): void {
    const { validateCustomAchievement } = require("../achievements");
    const achievement = {
      ...data,
      id: "temp-id",
      created: Date.now(),
      custom: true,
    };

    const validation = validateCustomAchievement(achievement);
    webview.postMessage({
      type: "validationResult",
      data: { errors: validation.valid ? [] : validation.errors },
    });
  }
}
