import * as vscode from 'vscode';

let statusItem: vscode.StatusBarItem;
let timer: NodeJS.Timeout | undefined;

type Mode = 'idle' | 'work' | 'break';

let mode: Mode = 'idle';
let remainingSeconds = 0;

function getConfig() {
    const cfg = vscode.workspace.getConfiguration('focusPulse');
    return {
        enabled: cfg.get<boolean>('enablePomodoro', true),
        workMinutes: cfg.get<number>('pomodoro.workMinutes', 25),
        breakMinutes: cfg.get<number>('pomodoro.breakMinutes', 5)
    };
}

export function initPomodoro(context: vscode.ExtensionContext) {
    const cfg = getConfig();

    statusItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        1000
    );
    statusItem.command = 'focusPulse.pomodoroToggle';
    statusItem.tooltip = 'Pomodoro Focus Pulse: iniciar/parar';

    if (cfg.enabled) {
        statusItem.show();
    }

    updateText();
    context.subscriptions.push(statusItem);

    const configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('focusPulse')) {
            const c = getConfig();
            if (c.enabled) statusItem.show();
            else statusItem.hide();
        }
    });
    context.subscriptions.push(configListener);
}

function updateText() {
    const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
    const ss = String(remainingSeconds % 60).padStart(2, '0');

    if (mode === 'idle') {
        statusItem.text = '$(clock) Pomodoro';
    } else if (mode === 'work') {
        statusItem.text = `$(flame) Work ${mm}:${ss}`;
    } else {
        statusItem.text = `$(coffee) Break ${mm}:${ss}`;
    }
}

function stopTimer() {
    if (timer) {
        clearInterval(timer);
        timer = undefined;
    }
}

function startTimer(durationMinutes: number, newMode: Mode) {
    stopTimer();
    mode = newMode;
    remainingSeconds = durationMinutes * 60;
    updateText();

    timer = setInterval(() => {
        remainingSeconds -= 1;
        if (remainingSeconds <= 0) {
            if (mode === 'work') {
                vscode.window.showInformationMessage(
                    'Focus Pulse: fin de bloque de trabajo. ¡Descanso!'
                );
                const cfg = getConfig();
                startTimer(cfg.breakMinutes, 'break');
            } else if (mode === 'break') {
                vscode.window.showInformationMessage(
                    'Focus Pulse: fin del descanso. Nuevo bloque de trabajo.'
                );
                const cfg = getConfig();
                startTimer(cfg.workMinutes, 'work');
            } else {
                mode = 'idle';
                stopTimer();
            }
        }
        updateText();
    }, 1000);
}

export function togglePomodoro() {
    const cfg = getConfig();

    if (!cfg.enabled) {
        vscode.window.showInformationMessage(
            'Pomodoro desactivado en la configuración de Focus Pulse.'
        );
        return;
    }

    if (mode === 'idle') {
        startTimer(cfg.workMinutes, 'work');
    } else {
        mode = 'idle';
        stopTimer();
        remainingSeconds = 0;
        updateText();
    }
}
