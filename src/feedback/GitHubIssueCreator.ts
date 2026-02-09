import * as vscode from "vscode";

export interface FeedbackData {
  type: "Sugerencia" | "Bug" | "Mejora UX";
  message: string;
  email?: string;
  userLevel: number;
  userXp: number;
  version: string;
}

export class GitHubIssueCreator {
  private static REPO_OWNER = "dominguezz05";
  private static REPO_NAME = "focus-pulse";

  /**
   * Creates a GitHub issue from user feedback
   */
  static async createIssueFromFeedback(
    feedback: FeedbackData,
    context: vscode.ExtensionContext
  ): Promise<string | null> {
    try {
      const token = await context.secrets.get("focusPulse.githubToken");

      if (!token) {
        console.warn("No GitHub token available, skipping issue creation");
        return null;
      }

      const { Octokit } = await import("@octokit/rest");
      const octokit = new Octokit({ auth: token });

      // Determine label based on feedback type
      const labels = this.getLabelsForType(feedback.type);

      // Build issue title
      const title = this.buildIssueTitle(feedback);

      // Build issue body
      const body = this.buildIssueBody(feedback);

      // Create the issue
      const { data: issue } = await octokit.rest.issues.create({
        owner: this.REPO_OWNER,
        repo: this.REPO_NAME,
        title,
        body,
        labels,
      });

      console.log(`GitHub issue created: ${issue.html_url}`);
      return issue.html_url;
    } catch (error) {
      console.error("Failed to create GitHub issue:", error);
      return null;
    }
  }

  private static getLabelsForType(type: string): string[] {
    switch (type) {
      case "Sugerencia":
        return ["enhancement", "user-feedback"];
      case "Bug":
        return ["bug", "user-reported"];
      case "Mejora UX":
        return ["ux", "user-feedback"];
      default:
        return ["user-feedback"];
    }
  }

  private static buildIssueTitle(feedback: FeedbackData): string {
    const prefix = this.getTitlePrefix(feedback.type);
    const message = feedback.message.split("\n")[0].trim(); // First line only
    const truncated = message.length > 60
      ? message.substring(0, 57) + "..."
      : message;

    return `${prefix} ${truncated}`;
  }

  private static getTitlePrefix(type: string): string {
    switch (type) {
      case "Sugerencia":
        return "💡 [FEATURE]";
      case "Bug":
        return "🐛 [BUG]";
      case "Mejora UX":
        return "✨ [UX]";
      default:
        return "📝";
    }
  }

  private static buildIssueBody(feedback: FeedbackData): string {
    return `
## Feedback del Usuario

**Tipo**: ${feedback.type}

### Descripción

${feedback.message}

---

### Información del Usuario

- **Nivel**: ${feedback.userLevel}
- **XP Total**: ${feedback.userXp}
- **Versión**: ${feedback.version}
${feedback.email ? `- **Email de contacto**: ${feedback.email}` : ""}

---

<sub>🤖 Issue creado automáticamente desde Focus Pulse Dashboard</sub>
`.trim();
  }

  /**
   * Check if user is authenticated with GitHub
   */
  static async isGitHubAuthenticated(
    context: vscode.ExtensionContext
  ): Promise<boolean> {
    const token = await context.secrets.get("focusPulse.githubToken");
    return !!token;
  }
}
