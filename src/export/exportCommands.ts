import * as vscode from 'vscode';
import { DataExportManager } from './DataExportManager';

export function registerExportCommands(context: vscode.ExtensionContext): void {
  const exportManager = DataExportManager.getInstance();

  const exportToFileCommand = vscode.commands.registerCommand(
    'focusPulse.exportDataToFile',
    async () => {
      const format = await vscode.window.showQuickPick(['json', 'xml'], {
        placeHolder: 'Select export format',
      });
      
      if (format) {
        await exportManager.exportToFile(format as 'json' | 'xml');
      }
    }
  );

  const importFromFileCommand = vscode.commands.registerCommand(
    'focusPulse.importDataFromFile',
    async () => {
      await exportManager.importFromFile();
    }
  );

  const exportAsJSONCommand = vscode.commands.registerCommand(
    'focusPulse.exportAsJSON',
    async () => {
      try {
        const data = await exportManager.exportData('json');
        const document = await vscode.workspace.openTextDocument({
          content: data,
          language: 'json'
        });
        await vscode.window.showTextDocument(document);
      } catch (error) {
        vscode.window.showErrorMessage(`JSON export failed: ${error}`);
      }
    }
  );

  const exportAsXMLCommand = vscode.commands.registerCommand(
    'focusPulse.exportAsXML',
    async () => {
      try {
        const data = await exportManager.exportData('xml');
        const document = await vscode.workspace.openTextDocument({
          content: data,
          language: 'xml'
        });
        await vscode.window.showTextDocument(document);
      } catch (error) {
        vscode.window.showErrorMessage(`XML export failed: ${error}`);
      }
    }
  );

  context.subscriptions.push(
    exportToFileCommand,
    importFromFileCommand,
    exportAsJSONCommand,
    exportAsXMLCommand
  );
}