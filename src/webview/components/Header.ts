import { DashboardData, DashboardComponent } from '../types';

export class HeaderComponent implements DashboardComponent {
  private container: any;

  render(container: any, data: DashboardData): void {
    this.container = container;
    container.innerHTML = `
      <header class="flex flex-col gap-2">
        <div class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-semibold flex items-center gap-2">
              <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                ⚡
              </span>
              Focus Pulse Dashboard
            </h1>
            <p class="text-sm text-slate-400">
              Resumen de foco por archivo en esta sesión, productividad reciente y progreso de nivel.
            </p>
          </div>
          <div class="flex gap-2">
            <div class="relative">
              <button 
                id="export-menu-btn"
                class="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors duration-200 flex items-center gap-1.5 border border-slate-600"
                title="Exportar/Importar datos"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Datos
              </button>
              <div 
                id="export-menu" 
                class="absolute right-0 mt-1 w-48 bg-slate-800 border border-slate-600 rounded-md shadow-lg hidden z-50"
              >
                <div class="py-1">
                  <button 
                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    data-action="export-json"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7,10 12,15 17,10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Exportar JSON
                  </button>
                  <button 
                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    data-action="export-xml"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7,10 12,15 17,10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Exportar XML
                  </button>
                  <button 
                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    data-action="export-file"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7,10 12,15 17,10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Exportar a archivo
                  </button>
                  <button 
                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    data-action="import-file"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17,8 12,3 7,8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Importar desde archivo
                  </button>
                  <div class="border-t border-slate-700 my-1"></div>
                  <button 
                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    data-action="sync-status"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="23,4 23,10 17,10"></polyline>
                      <path d="M20.49,15a9,9,0,1,1-2.12-9.36L23,10"></path>
                    </svg>
                    Estado de sincronización
                  </button>
                  <button 
                    class="export-menu-item w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                    data-action="manual-sync"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="23,4 23,10 17,10"></polyline>
                      <path d="M20.49,15a9,9,0,1,1-2.12-9.36L23,10"></path>
                    </svg>
                    Sincronizar ahora
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 text-xs text-slate-400">
          <div class="flex items-center gap-1">
            <span class="uppercase tracking-wide">Nivel</span>
            <span id="xp-level" class="text-sm font-semibold text-emerald-300">1</span>
          </div>
          <div class="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
            <div id="xp-bar-inner" class="h-full bg-emerald-500 transition-all duration-300" style="width: 0%;"></div>
          </div>
          <span id="xp-label" class="text-[11px] text-slate-400">0 XP total</span>
        </div>
        <div id="deepwork-pill" class="text-[11px] text-slate-500"></div>
      </header>
    `;
    
    this.setupEventListeners();
    this.update(data);
  }

  private setupEventListeners(): void {
    const exportBtn = document.getElementById('export-menu-btn');
    const exportMenu = document.getElementById('export-menu');
    const menuItems = document.querySelectorAll('.export-menu-item');

    if (exportBtn && exportMenu) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!exportMenu.contains(e.target as Node) && !exportBtn.contains(e.target as Node)) {
          exportMenu.classList.add('hidden');
        }
      });

      menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = (item as HTMLElement).dataset.action;
          if (action) {
            this.handleMenuAction(action);
          }
          exportMenu.classList.add('hidden');
        });
      });
    }
  }

  private handleMenuAction(action: string): void {
    const vscode = (window as any).acquireVsCodeApi?.();
    if (!vscode) return;

    switch (action) {
      case 'export-json':
        (window as any).acquireVsCodeApi().postMessage({ command: 'export-json' });
        break;
      case 'export-xml':
        (window as any).acquireVsCodeApi().postMessage({ command: 'export-xml' });
        break;
      case 'export-file':
        (window as any).acquireVsCodeApi().postMessage({ command: 'export-file' });
        break;
      case 'import-file':
        (window as any).acquireVsCodeApi().postMessage({ command: 'import-file' });
        break;
      case 'sync-status':
        (window as any).acquireVsCodeApi().postMessage({ command: 'sync-status' });
        break;
      case 'manual-sync':
        (window as any).acquireVsCodeApi().postMessage({ command: 'manual-sync' });
        break;
    }
  }

  update(data: DashboardData): void {
    const xp = data.xp || { totalXp: 0, level: 1, xpInLevel: 0, xpToNext: 100 };
    const deepWork = data.deepWork;

    // Update XP
    const levelEl = document.getElementById('xp-level');
    const barEl = document.getElementById('xp-bar-inner');
    const labelEl = document.getElementById('xp-label');

    if (levelEl) levelEl.textContent = String(xp.level);
    if (barEl) {
      const pct = xp.xpToNext > 0 
        ? Math.max(0, Math.min(100, (xp.xpInLevel / xp.xpToNext) * 100))
        : 0;
      barEl.style.width = pct.toFixed(1) + '%';
    }
    if (labelEl) labelEl.textContent = Math.round(xp.totalXp) + ' XP total';

    // Update Deep Work pill
    const deepWorkPillEl = document.getElementById('deepwork-pill');
    if (deepWorkPillEl) {
      if (!deepWork) {
        deepWorkPillEl.textContent = "";
      } else if (deepWork.active) {
        deepWorkPillEl.textContent = "🧠 Deep Work activo";
        deepWorkPillEl.className = "text-[11px] text-emerald-300 mt-1";
      } else {
        deepWorkPillEl.textContent = "Deep Work inactivo (pulsa en la barra de estado para iniciar)";
        deepWorkPillEl.className = "text-[11px] text-slate-500 mt-1";
      }
    }
  }

  destroy(): void {
    // Cleanup if needed
  }
}