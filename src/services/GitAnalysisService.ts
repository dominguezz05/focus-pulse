import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: number;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface GitActivityInsight {
  type: "commit" | "merge" | "branch" | "stash";
  message: string;
  celebrationLevel: "low" | "medium" | "high";
  timestamp: number;
  data?: any;
}

export class GitAnalysisService {
  private static instance: GitAnalysisService;
  private lastCheckedCommit: string | null = null;
  private workspaceRoot: string | undefined;

  static getInstance(): GitAnalysisService {
    if (!GitAnalysisService.instance) {
      GitAnalysisService.instance = new GitAnalysisService();
    }
    return GitAnalysisService.instance;
  }

  private constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  async getLastCommit(): Promise<GitCommitInfo | null> {
    if (!this.workspaceRoot) {
      return null;
    }

    try {
      // Obtener el último commit
      const { stdout: commitData } = await execAsync(
        'git log -1 --pretty=format:"%H|%s|%an|%at"',
        { cwd: this.workspaceRoot }
      );

      if (!commitData) return null;

      const [hash, message, author, timestamp] = commitData.split("|");

      // Obtener estadísticas del commit
      const { stdout: statsData } = await execAsync(
        `git show ${hash} --stat --pretty="" --no-color`,
        { cwd: this.workspaceRoot }
      );

      // Parsear estadísticas
      const lines = statsData.trim().split("\n");
      const lastLine = lines[lines.length - 1];
      const filesChanged = lines.length - 1;

      let insertions = 0;
      let deletions = 0;

      const match = lastLine.match(/(\d+) insertion.*?(\d+) deletion/);
      if (match) {
        insertions = parseInt(match[1]) || 0;
        deletions = parseInt(match[2]) || 0;
      }

      return {
        hash,
        message,
        author,
        timestamp: parseInt(timestamp) * 1000,
        filesChanged,
        insertions,
        deletions,
      };
    } catch (error) {
      // Git no disponible o no es un repositorio git
      return null;
    }
  }

  async checkRecentActivity(): Promise<GitActivityInsight | null> {
    const lastCommit = await this.getLastCommit();

    if (!lastCommit) {
      return null;
    }

    // Si ya procesamos este commit, no hacer nada
    if (this.lastCheckedCommit === lastCommit.hash) {
      return null;
    }

    // Verificar si el commit es reciente (últimos 5 minutos)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (lastCommit.timestamp < fiveMinutesAgo) {
      return null;
    }

    // Marcar como procesado
    this.lastCheckedCommit = lastCommit.hash;

    // Analizar tipo de commit
    const insight = this.analyzeCommit(lastCommit);
    return insight;
  }

  private analyzeCommit(commit: GitCommitInfo): GitActivityInsight {
    const message = commit.message.toLowerCase();
    const filesChanged = commit.filesChanged;
    const totalChanges = commit.insertions + commit.deletions;

    // Detectar merge
    if (message.includes("merge") || message.includes("Merge")) {
      return {
        type: "merge",
        message: `🎉 ¡MERGE EXITOSO! ${filesChanged} archivos integrados. ¡Gran trabajo en equipo!`,
        celebrationLevel: "high",
        timestamp: commit.timestamp,
        data: commit,
      };
    }

    // Detectar commits grandes (refactors, features)
    if (filesChanged > 10 || totalChanges > 500) {
      return {
        type: "commit",
        message: `🚀 ¡COMMIT MASIVO! ${filesChanged} archivos, ${totalChanges} cambios. Eres una bestia del código!`,
        celebrationLevel: "high",
        timestamp: commit.timestamp,
        data: commit,
      };
    }

    // Detectar fixes
    if (message.includes("fix") || message.includes("bug")) {
      return {
        type: "commit",
        message: `🐛 ¡Bug aplastado! Commit: "${commit.message.slice(0, 50)}..." Eres un cazador de bugs`,
        celebrationLevel: "medium",
        timestamp: commit.timestamp,
        data: commit,
      };
    }

    // Detectar features
    if (message.includes("feat") || message.includes("feature") || message.includes("add")) {
      return {
        type: "commit",
        message: `✨ ¡Nueva feature! "${commit.message.slice(0, 50)}..." El producto está evolucionando`,
        celebrationLevel: "medium",
        timestamp: commit.timestamp,
        data: commit,
      };
    }

    // Detectar tests
    if (message.includes("test") || message.includes("spec")) {
      return {
        type: "commit",
        message: `🧪 ¡Tests guardados! "${commit.message.slice(0, 50)}..." La calidad se agradece`,
        celebrationLevel: "medium",
        timestamp: commit.timestamp,
        data: commit,
      };
    }

    // Detectar docs
    if (message.includes("doc") || message.includes("readme")) {
      return {
        type: "commit",
        message: `📚 ¡Documentación actualizada! El equipo te lo agradecerá`,
        celebrationLevel: "low",
        timestamp: commit.timestamp,
        data: commit,
      };
    }

    // Commit genérico
    return {
      type: "commit",
      message: `✅ ¡Commit guardado! ${filesChanged} archivo${filesChanged > 1 ? "s" : ""} en el historial. ¡Sigue así!`,
      celebrationLevel: "low",
      timestamp: commit.timestamp,
      data: commit,
    };
  }

  async checkForPRMerge(): Promise<GitActivityInsight | null> {
    if (!this.workspaceRoot) {
      return null;
    }

    try {
      // Verificar si el último commit es un merge de PR (GitHub/GitLab style)
      const { stdout } = await execAsync(
        'git log -1 --pretty=format:"%s"',
        { cwd: this.workspaceRoot }
      );

      const message = stdout.toLowerCase();

      if (
        message.includes("pull request") ||
        message.includes("merge pull request") ||
        message.includes("merge pr #") ||
        message.match(/merge.*#\d+/)
      ) {
        const lastCommit = await this.getLastCommit();

        if (!lastCommit) return null;

        // Verificar si es reciente (últimos 10 minutos)
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        if (lastCommit.timestamp < tenMinutesAgo) {
          return null;
        }

        return {
          type: "merge",
          message: `🎊 ¡PR MERGEADO! Tu código está en producción. ¡ÉPICO! 🚀`,
          celebrationLevel: "high",
          timestamp: lastCommit.timestamp,
          data: lastCommit,
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async getCurrentBranch(): Promise<string | null> {
    if (!this.workspaceRoot) {
      return null;
    }

    try {
      const { stdout } = await execAsync("git branch --show-current", {
        cwd: this.workspaceRoot,
      });
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }

  async getRecentCommitsCount(minutes: number = 60): Promise<number> {
    if (!this.workspaceRoot) {
      return 0;
    }

    try {
      const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
      const { stdout } = await execAsync(
        `git log --since="${since}" --oneline`,
        { cwd: this.workspaceRoot }
      );

      return stdout.trim().split("\n").filter((line) => line).length;
    } catch (error) {
      return 0;
    }
  }

  async detectCommitStreak(): Promise<GitActivityInsight | null> {
    const commitsLastHour = await this.getRecentCommitsCount(60);

    if (commitsLastHour >= 5) {
      return {
        type: "commit",
        message: `🔥 ¡RACHA DE COMMITS! ${commitsLastHour} commits en la última hora. ¡Imparable!`,
        celebrationLevel: "high",
        timestamp: Date.now(),
        data: { count: commitsLastHour },
      };
    }

    if (commitsLastHour >= 3) {
      return {
        type: "commit",
        message: `💪 ¡Productivo! ${commitsLastHour} commits en la última hora. Mantén el ritmo`,
        celebrationLevel: "medium",
        timestamp: Date.now(),
        data: { count: commitsLastHour },
      };
    }

    return null;
  }

  async getCommitStats(days: number = 7): Promise<{
    totalCommits: number;
    avgCommitsPerDay: number;
    mostProductiveDay: string;
  }> {
    if (!this.workspaceRoot) {
      return { totalCommits: 0, avgCommitsPerDay: 0, mostProductiveDay: "N/A" };
    }

    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { stdout } = await execAsync(
        `git log --since="${since}" --format="%ai"`,
        { cwd: this.workspaceRoot }
      );

      if (!stdout.trim()) {
        return {
          totalCommits: 0,
          avgCommitsPerDay: 0,
          mostProductiveDay: "N/A",
        };
      }

      const commits = stdout.trim().split("\n");
      const totalCommits = commits.length;
      const avgCommitsPerDay = totalCommits / days;

      // Contar commits por día de la semana
      const dayCount: Record<string, number> = {
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
        Sunday: 0,
      };

      commits.forEach((commit) => {
        const date = new Date(commit);
        const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
        dayCount[dayName] = (dayCount[dayName] || 0) + 1;
      });

      const mostProductiveDay = Object.entries(dayCount).sort(
        (a, b) => b[1] - a[1]
      )[0][0];

      return {
        totalCommits,
        avgCommitsPerDay: Math.round(avgCommitsPerDay * 10) / 10,
        mostProductiveDay,
      };
    } catch (error) {
      return { totalCommits: 0, avgCommitsPerDay: 0, mostProductiveDay: "N/A" };
    }
  }

  reset(): void {
    this.lastCheckedCommit = null;
  }
}
