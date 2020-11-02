// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {transform} from './transform';
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('transform.convertToArrowFunction', () => {
		const code = readCode();
		const transformedCode = transform(code);
		write(transformedCode)
	});

	context.subscriptions.push(disposable);
}


function readCode(): string {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		throw new Error("No active editor");
	}
	return editor.document.getText();
}

function write(code: string) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		throw new Error("No active editor");
	}
	const edit = new vscode.WorkspaceEdit();

	const wholeDocument = new vscode.Range(
		new vscode.Position(0,0),
		new vscode.Position(editor.document.lineCount, 0)
	)
	const updateCode = new vscode.TextEdit(wholeDocument, code);
	edit.set(editor.document.uri, [updateCode]);
	vscode.workspace.applyEdit(edit);
}

// this method is called when your extension is deactivated
export function deactivate() { }
