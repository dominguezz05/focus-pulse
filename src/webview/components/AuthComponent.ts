import { DashboardData, DashboardComponent } from '../types';

export class AuthComponent implements DashboardComponent {
  private container: any;
  private isVisible: boolean = true;

  render(container: any, data: DashboardData): void {
    this.container = container;
    
    // Check if user is authenticated - default to false if sync is undefined
    const isAuthenticated = data.sync?.isAuthenticated || false;
    
    console.log('AuthComponent render - isAuthenticated:', isAuthenticated, 'sync data:', data.sync);
    
    // Always render the HTML, then show/hide based on auth state
    this.renderAuthModal(container, data);
    
    if (isAuthenticated) {
      this.hide();
    } else {
      this.show();
    }
  }

  private renderAuthModal(container: any, data: DashboardData): void {
    
    container.innerHTML = `
      <div id="auth-float" class="fixed inset-0 z-50 flex items-start justify-center pt-20" style="display: ${this.isVisible ? 'flex' : 'none'};">
        <div class="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl p-6 m-4 max-w-md w-full">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-white">Protege tu progreso</h3>
              <p class="text-sm text-slate-400">Guarda tu progreso en la nube y sincroniza entre dispositivos</p>
            </div>
          </div>
          
          <div class="space-y-3">
            <button id="auth-btn" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
              </svg>
              Autenticar con GitHub
            </button>
            
            <button id="help-btn" class="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2.5 rounded-md text-sm transition-colors duration-200 flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              ¿Cómo crear un token de GitHub?
            </button>
            
            <button id="dismiss-btn" class="w-full text-slate-400 hover:text-slate-300 text-xs py-2 transition-colors duration-200">
              Ahora no, quizás más tarde
            </button>
          </div>
          
          <div class="mt-4 text-xs text-slate-500">
            <p>🔒 Tus datos se guardan en Gists privados de GitHub, solo tú puedes verlos.</p>
            <p>🔄 Puedes sincronizar tu progreso en múltiples dispositivos.</p>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const authBtn = document.getElementById('auth-btn');
    const helpBtn = document.getElementById('help-btn');
    const dismissBtn = document.getElementById('dismiss-btn');

    if (authBtn) {
      authBtn.addEventListener('click', () => {
        (window as any).acquireVsCodeApi().postMessage({ command: 'authenticate' });
      });
    }

    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        this.showHelpModal();
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        this.hide();
      });
    }
  }

  private show(): void {
    this.isVisible = true;
    // Make sure container is visible
    if (this.container) {
      this.container.style.display = 'block';
    }
    const authFloat = document.getElementById('auth-float');
    if (authFloat) {
      authFloat.style.display = 'flex';
    }
  }

  private hide(): void {
    this.isVisible = false;
    const authFloat = document.getElementById('auth-float');
    if (authFloat) {
      authFloat.style.display = 'none';
    }
    // Also hide the container
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  private showHelpModal(): void {
    const helpContent = `
      <div class="fixed inset-0 z-60 flex items-start justify-center pt-20">
        <div class="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-white">¿Cómo crear un Personal Access Token de GitHub?</h3>
            <button id="close-help" class="text-slate-400 hover:text-slate-200">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="space-y-4 text-sm text-slate-300">
            <div class="bg-slate-800/50 rounded-lg p-4">
              <h4 class="font-semibold text-white mb-2">📋 Pasos para crear tu token:</h4>
              <ol class="space-y-2 text-xs text-slate-300">
                <li>1. Ve a <a href="https://github.com/settings/tokens" target="_blank" class="text-blue-400 hover:underline">github.com/settings/tokens</a></li>
                <li>2. Haz clic en "Generate new token" → "Generate new token (classic)"</li>
                <li>3. Dale un nombre (ej: "Focus Pulse Sync")</li>
                <li>4. Selecciona "No expiration" o elige una duración</li>
                <li>5. Marca solo el permiso <strong>gist</strong></li>
                <li>6. Haz clic en "Generate token"</li>
                <li>7. Copia el token (no podrás volver a verlo)</li>
              </ol>
            </div>
            
            <div class="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
              <p class="text-xs text-blue-300">
                <strong>💡 Consejo:</strong> Una vez creado el token, vuelve al dashboard y haz clic en "Autenticar con GitHub" para pegarlo.
              </p>
            </div>
            
            <div class="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
              <p class="text-xs text-amber-300">
                <strong>⚠️ Importante:</strong> Tus datos se guardan en Gists privados de GitHub, solo tú puedes verlos.
              </p>
            </div>
          </div>
          
          <div class="mt-4 flex justify-end gap-2">
            <button id="open-github-tokens" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-sm transition-colors duration-200">
              Abrir GitHub Tokens
            </button>
            <button id="close-help-btn" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm transition-colors duration-200">
              Entendido
            </button>
          </div>
        </div>
      </div>
    `;

    const helpDiv = document.createElement('div');
    helpDiv.id = 'help-modal';
    helpDiv.innerHTML = helpContent;
    document.body.appendChild(helpDiv);

    // Setup event listeners for help modal
    const closeHelp = document.getElementById('close-help');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const openGithubTokens = document.getElementById('open-github-tokens');

    if (closeHelp) {
      closeHelp.addEventListener('click', () => {
        helpDiv.remove();
      });
    }

    if (closeHelpBtn) {
      closeHelpBtn.addEventListener('click', () => {
        helpDiv.remove();
      });
    }

    if (openGithubTokens) {
      openGithubTokens.addEventListener('click', () => {
        window.open('https://github.com/settings/tokens', '_blank');
        helpDiv.remove();
      });
    }
  }

  update(data: DashboardData): void {
    const isAuthenticated = data.sync?.isAuthenticated;
    
    if (isAuthenticated && this.isVisible) {
      this.hide();
    } else if (!isAuthenticated && !this.isVisible) {
      this.render(this.container, data);
    }
  }

  destroy(): void {
    // Cleanup if needed
  }
}