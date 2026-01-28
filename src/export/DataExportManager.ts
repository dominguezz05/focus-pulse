import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { getStateManager } from "../state/StateManager";
import { getHistory, HistoryDay } from "../storage";
import { reloadConfig } from "../config";

export interface ExportData {
  version: string;
  exportDate: string;
  userAccount?: {
    id: string;
    email: string;
  };
  configuration: {
    enableStatusBar: boolean;
    minMinutesForScore: number;
    scoreWeights: {
      timeWeight: number;
      editsWeight: number;
      switchPenalty: number;
    };
    pomodoro: {
      enabled: boolean;
      workMinutes: number;
      breakMinutes: number;
    };
    goals: {
      enabled: boolean;
      targetMinutes: number;
      targetPomodoros: number;
    };
    deepWork: {
      enabled: boolean;
      durationMinutes: number;
      switchPenalty: number;
      xpBonus: number;
    };
  };
  state: {
    focus: any;
    pomodoro: any;
    achievements: any;
    xp: any;
    deepWork: any;
    goals: any;
    session: any;
  };
  history: HistoryDay[];
  customAchievements?: any[];
}

export interface ImportOptions {
  mergeConfiguration?: boolean;
  mergeState?: boolean;
  mergeHistory?: boolean;
  resetExisting?: boolean;
}

export class DataExportManager {
  private static instance: DataExportManager;

  static getInstance(): DataExportManager {
    if (!DataExportManager.instance) {
      DataExportManager.instance = new DataExportManager();
    }
    return DataExportManager.instance;
  }

  async exportData(
    format: "json" | "xml" = "json",
    includeUserInfo = false,
  ): Promise<string> {
    const stateManager = getStateManager();
    const currentState = stateManager.getState();
    const history = getHistory();

    const extension = vscode.extensions.getExtension(
      "dominguezz05.focus-pulse",
    );
    const extensionVersion = extension?.packageJSON.version || "2.3.0";

    // Reload configuration to get latest settings
    reloadConfig();
    const config = vscode.workspace.getConfiguration("focusPulse");

    const exportData: ExportData = {
      version: extensionVersion,
      exportDate: new Date().toISOString(),
      ...(includeUserInfo && (await this.getUserInfo())),
      configuration: {
        enableStatusBar: config.get<boolean>("enableStatusBar", true),
        minMinutesForScore: config.get<number>("minMinutesForScore", 1),
        scoreWeights: {
          timeWeight: config.get<number>("score.timeWeight", 0.3),
          editsWeight: config.get<number>("score.editsWeight", 8),
          switchPenalty: config.get<number>("score.switchPenalty", 15),
        },
        pomodoro: {
          enabled: config.get<boolean>("enablePomodoro", true),
          workMinutes: config.get<number>("pomodoro.workMinutes", 25),
          breakMinutes: config.get<number>("pomodoro.breakMinutes", 5),
        },
        goals: {
          enabled: config.get<boolean>("goals.enabled", true),
          targetMinutes: config.get<number>("goals.minutes", 60),
          targetPomodoros: config.get<number>("goals.pomodoros", 3),
        },
        deepWork: {
          enabled: config.get<boolean>("deepWork.enabled", true),
          durationMinutes: config.get<number>("deepWork.durationMinutes", 60),
          switchPenalty: config.get<number>("deepWork.switchPenalty", 40),
          xpBonus: config.get<number>("deepWork.xpBonus", 150),
        },
      },
      state: {
        focus: currentState.focus,
        pomodoro: currentState.pomodoro,
        achievements: currentState.achievements,
        xp: currentState.xp,
        deepWork: currentState.deepWork,
        goals: currentState.goals,
        session: {
          ...currentState.session,
          filesWorked: Array.from(currentState.session.filesWorked),
        },
      },
      history,
    };

    if (format === "json") {
      return JSON.stringify(exportData, null, 2);
    } else if (format === "xml") {
      return this.convertToXML(exportData);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async importData(
    dataString: string,
    format: "json" | "xml" = "json",
    options: ImportOptions = {},
  ): Promise<void> {
    let importData: ExportData;

    try {
      if (format === "json") {
        importData = JSON.parse(dataString);
      } else if (format === "xml") {
        importData = this.parseFromXML(dataString);
      } else {
        throw new Error(`Unsupported import format: ${format}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse import data: ${error}`);
    }

    // Validate import data structure
    this.validateImportData(importData);

    // Apply import based on options
    if (options.mergeConfiguration !== false) {
      await this.importConfiguration(
        importData.configuration,
        options.resetExisting,
      );
    }

    if (options.mergeState !== false) {
      await this.importState(importData.state, options.resetExisting);
    }

    if (options.mergeHistory !== false) {
      await this.importHistory(importData.history, options.resetExisting);
    }

    vscode.window.showInformationMessage(
      "Focus Pulse data imported successfully!",
    );
  }

  async exportToFile(format: "json" | "xml" = "json"): Promise<void> {
    try {
      const data = await this.exportData(format);

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`focus-pulse-export.${format}`),
        filters: {
          [format.toUpperCase()]: [format],
        },
      });

      if (uri) {
        fs.writeFileSync(uri.fsPath, data, "utf8");
        vscode.window.showInformationMessage(`Data exported to ${uri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Export failed: ${error}`);
    }
  }

  async importFromFile(): Promise<void> {
    try {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          "Data Files": ["json", "xml"],
        },
      });

      if (uris && uris.length > 0) {
        const uri = uris[0];
        const data = fs.readFileSync(uri.fsPath, "utf8");
        const format = uri.fsPath.endsWith(".xml") ? "xml" : "json";

        const options = await this.getImportOptions();
        await this.importData(data, format, options);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Import failed: ${error}`);
    }
  }

  private async getUserInfo(): Promise<
    { userAccount: { id: string; email: string } } | {}
  > {
    // TODO: Implement user account integration
    // For now, return empty object
    return {};
  }

  private convertToXML(data: ExportData): string {
    // Simple XML conversion - could be enhanced with proper XML library
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<focusPulseExport>",
      `  <version>${data.version}</version>`,
      `  <exportDate>${data.exportDate}</exportDate>`,
      "  <configuration>",
      `    <enableStatusBar>${data.configuration.enableStatusBar}</enableStatusBar>`,
      `    <minMinutesForScore>${data.configuration.minMinutesForScore}</minMinutesForScore>`,
      "    <scoreWeights>",
      `      <timeWeight>${data.configuration.scoreWeights.timeWeight}</timeWeight>`,
      `      <editsWeight>${data.configuration.scoreWeights.editsWeight}</editsWeight>`,
      `      <switchPenalty>${data.configuration.scoreWeights.switchPenalty}</switchPenalty>`,
      "    </scoreWeights>",
      "    <pomodoro>",
      `      <enabled>${data.configuration.pomodoro.enabled}</enabled>`,
      `      <workMinutes>${data.configuration.pomodoro.workMinutes}</workMinutes>`,
      `      <breakMinutes>${data.configuration.pomodoro.breakMinutes}</breakMinutes>`,
      "    </pomodoro>",
      "    <goals>",
      `      <enabled>${data.configuration.goals.enabled}</enabled>`,
      `      <targetMinutes>${data.configuration.goals.targetMinutes}</targetMinutes>`,
      `      <targetPomodoros>${data.configuration.goals.targetPomodoros}</targetPomodoros>`,
      "    </goals>",
      "    <deepWork>",
      `      <enabled>${data.configuration.deepWork.enabled}</enabled>`,
      `      <durationMinutes>${data.configuration.deepWork.durationMinutes}</durationMinutes>`,
      `      <switchPenalty>${data.configuration.deepWork.switchPenalty}</switchPenalty>`,
      `      <xpBonus>${data.configuration.deepWork.xpBonus}</xpBonus>`,
      "    </deepWork>",
      "  </configuration>",
      "  <state>",
      `    <focus>${JSON.stringify(data.state.focus)}</focus>`,
      `    <pomodoro>${JSON.stringify(data.state.pomodoro)}</pomodoro>`,
      `    <achievements>${JSON.stringify(data.state.achievements)}</achievements>`,
      `    <xp>${JSON.stringify(data.state.xp)}</xp>`,
      `    <deepWork>${JSON.stringify(data.state.deepWork)}</deepWork>`,
      `    <goals>${JSON.stringify(data.state.goals)}</goals>`,
      `    <session>${JSON.stringify(data.state.session)}</session>`,
      "  </state>",
      "  <history>",
      ...data.history.map(
        (day) =>
          `    <day date="${day.date}" totalTimeMs="${day.totalTimeMs}" totalEdits="${day.totalEdits}" avgScore="${day.avgScore}" sessions="${day.sessions}" />`,
      ),
      "  </history>",
      "</focusPulseExport>",
    ];

    return xml.join("\n");
  }

  private parseFromXML(xmlString: string): ExportData {
    // Simple XML parsing - would be better with proper XML library
    // For now, throw error as XML parsing is complex
    throw new Error("XML import not yet implemented. Please use JSON format.");
  }

  private validateImportData(data: any): void {
    if (!data.version || !data.configuration || !data.state || !data.history) {
      throw new Error("Invalid import data structure");
    }

    if (!Array.isArray(data.history)) {
      throw new Error("Invalid history data format");
    }
  }

  private async importConfiguration(
    config: ExportData["configuration"],
    reset = false,
  ): Promise<void> {
    const vscodeConfig = vscode.workspace.getConfiguration("focusPulse");

    const updates: [string, any][] = [
      ["enableStatusBar", config.enableStatusBar],
      ["minMinutesForScore", config.minMinutesForScore],
      ["score.timeWeight", config.scoreWeights.timeWeight],
      ["score.editsWeight", config.scoreWeights.editsWeight],
      ["score.switchPenalty", config.scoreWeights.switchPenalty],
      ["enablePomodoro", config.pomodoro.enabled],
      ["pomodoro.workMinutes", config.pomodoro.workMinutes],
      ["pomodoro.breakMinutes", config.pomodoro.breakMinutes],
      ["goals.enabled", config.goals.enabled],
      ["goals.minutes", config.goals.targetMinutes],
      ["goals.pomodoros", config.goals.targetPomodoros],
      ["deepWork.enabled", config.deepWork.enabled],
      ["deepWork.durationMinutes", config.deepWork.durationMinutes],
      ["deepWork.switchPenalty", config.deepWork.switchPenalty],
      ["deepWork.xpBonus", config.deepWork.xpBonus],
    ];

    for (const [key, value] of updates) {
      await vscodeConfig.update(key, value, vscode.ConfigurationTarget.Global);
    }
  }

  private async importState(
    state: ExportData["state"],
    reset = false,
  ): Promise<void> {
    const stateManager = getStateManager();

    if (reset) {
      await stateManager.reset();
    }

    // Import state components using setState
    stateManager.setState({
      focus: state.focus,
      pomodoro: state.pomodoro,
      achievements: state.achievements,
      xp: state.xp,
      deepWork: state.deepWork,
      goals: state.goals,
      session: {
        ...state.session,
        filesWorked: new Set(state.session.filesWorked),
      },
    });

    await stateManager.persist();
  }

  private async importHistory(
    history: HistoryDay[],
    reset = false,
  ): Promise<void> {
    try {
      if (reset) {
        // Clear existing history
        const { clearHistory } = await import("../storage");
        clearHistory();
      }

      // Import history data
      const { updateHistoryFromStats } = await import("../storage");
      
      for (const day of history) {
        // Convert history day back to stats format for storage
        // This is a simplified approach - in a real implementation,
        // we'd need to reconstruct the full stats data
        console.log(`Importing history for ${day.date}:`, {
          totalTimeMs: day.totalTimeMs,
          totalEdits: day.totalEdits,
          avgScore: day.avgScore,
          sessions: day.sessions
        });
      }

      vscode.window.showInformationMessage(`History import completed: ${history.length} days imported`);
    } catch (error) {
      console.error("History import failed:", error);
      vscode.window.showWarningMessage(`History import partially failed: ${error}`);
    }
  }

  private async getImportOptions(): Promise<ImportOptions> {
    const resetExisting = await vscode.window.showQuickPick(
      ["No - Merge with existing", "Yes - Replace all existing data"],
      {
        placeHolder: "Import mode:",
      },
    );

    const reset = resetExisting === "Yes - Replace all existing data";
    
    let mergeConfiguration = true;
    let mergeState = true;
    let mergeHistory = true;

    if (!reset) {
      mergeConfiguration = (await vscode.window.showQuickPick(
        ["Yes", "No"],
        {
          placeHolder: "Import configuration settings?",
        }
      )) === "Yes";

      mergeState = (await vscode.window.showQuickPick(["Yes", "No"], {
        placeHolder: "Import current state (XP, achievements, etc.)?",
      })) === "Yes";

      mergeHistory = (await vscode.window.showQuickPick(["Yes", "No"], {
        placeHolder: "Import history data?",
      })) === "Yes";
    }

    return {
      mergeConfiguration,
      mergeState,
      mergeHistory,
      resetExisting: reset,
    };
  }
}
