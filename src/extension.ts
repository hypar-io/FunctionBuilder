import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as chokidar from 'chokidar';

export function activate(context: vscode.ExtensionContext) {
	console.debug("Activating Hypar Code.");

	let root = path.join(context.extensionPath, 'media');
	if(vscode.workspace.workspaceFolders) {
		root = vscode.workspace.workspaceFolders[0].uri.fsPath;
	}
	let modelPath = path.join(root, "model.glb");
	let outputPath = path.join(root, "output.json");
	let configPath = path.join(root, 'hypar.json');
	let inputPath = path.join(root, 'input.json');

	let title = "Hypar Preview";
	if(vscode.workspace.name) {
		title = vscode.workspace.name;
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('hypar.preview', ()=>{
			HyparPanel.createOrShow(context, title, modelPath, configPath, inputPath, outputPath);
		})
	);

	if(vscode.window.registerWebviewPanelSerializer) {
		vscode.window.registerWebviewPanelSerializer(HyparPanel.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
				console.log(`Got state: ${state}`);
				HyparPanel.revive(webviewPanel, context.extensionPath, title, modelPath, configPath);
			}
		});
	}

	let type = 'hypar';
	vscode.tasks.registerTaskProvider(type, {
		provideTasks: () => {
			
			// https://stackoverflow.com/questions/55135876/extension-api-task-provider-build-task-example
			
			if(!vscode.workspace.workspaceFolders) {
				return [];
			}

			let hyparPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'hypar.json');
			if(!fs.existsSync(hyparPath)) {
				return [];
			}
	
			let runTask = new vscode.Task(
				{type: type, task:'run'},
				vscode.TaskScope.Workspace,
				'Run',
				'Hypar',
				new vscode.ShellExecution('hypar run'), []
			);
	
			return [runTask];
		},
		resolveTask(_task: vscode.Task): vscode.Task | undefined {
			return undefined;
		}
	});
}

class HyparPanel {
	/**
	 * Track the current panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: HyparPanel | undefined;
	public static readonly viewType = 'hypar';
	private readonly _panel: vscode.WebviewPanel;
	private _disposables: vscode.Disposable[] = [];
	private readonly _extensionPath: string;

	public static createOrShow(context:vscode.ExtensionContext, title: string, modelPath: string, configPath: string, inputPath: string, outputPath: string) {
		const column = vscode.ViewColumn.Two;

		// If we already have a panel, show it.
		if (HyparPanel.currentPanel) {
			console.debug("Revealing hypar code.");
			HyparPanel.currentPanel._panel.reveal(column);
			return;
		}

		let roots = [];
		roots.push(vscode.Uri.file(path.join(context.extensionPath, 'media')));
		roots.push(vscode.Uri.file(path.join(context.extensionPath, 'dist')));
		if(vscode.workspace.workspaceFolders) {
			roots.push(vscode.workspace.workspaceFolders[0].uri);
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			HyparPanel.viewType,
			title,
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: roots
			}
		);
		
		HyparPanel.currentPanel = new HyparPanel(panel, context.extensionPath, title, modelPath, configPath);

		console.debug(`Watching ${modelPath}.`);
		const watcher = chokidar.watch([modelPath, configPath, outputPath], {
			ignored: /(^|[\/\\])\../,
			persistent: true
		});
		watcher.on('change', (path:string, stats: fs.Stats)=>{
			if(HyparPanel.currentPanel) {
				switch(path) {
					case modelPath:
						this.updateModel(modelPath);
						break;
					case configPath:
						this.updateInputs(configPath, inputPath);
						break;
					case outputPath:
						this.updateOutputs(outputPath);
						break;
					default:
						console.warn('Unknown path received.');
				}
			}
		});
	}

	public static updateModel(modelPath: string, zoomToFit: boolean = false) {
		console.debug(`${modelPath} was changed. Reloading...`);
		if (!fs.existsSync(modelPath)) {
			console.log(`The file, ${modelPath} does not exist. The model update message will not be sent.`);
			return;
		}

		try {
			let b = fs.readFileSync(modelPath, 'base64');
			// TODO: Use ArrayBuffer when supported by VS Code
			// var ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
			if(HyparPanel.currentPanel) {
				HyparPanel.currentPanel._panel.webview.postMessage({command: 'load-model', data: b, options: {zoomToFit: zoomToFit}});
			}
		} catch (error) {
			HyparPanel.sleep(()=>{
				// Wait before attempting to read the file again, to avoid
				// file locking issues discovered during development.
				// TODO: Figure out what's causing file locking issues.
				console.warn(`There was an error reading the model: ${error}. Retrying in 1 second.`);
				let b = fs.readFileSync(modelPath, 'base64');
				// TODO: Use ArrayBuffer when supported by VS Code
				// var ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
				if(HyparPanel.currentPanel) {
					HyparPanel.currentPanel._panel.webview.postMessage({command: 'load-model', data: b, options: {zoomToFit: zoomToFit}});
				}
			});
		}
	}

	public static updateInputs(configPath: string, inputPath: string) {
		// Update the inputs
		console.debug(`${configPath} was changed. Updating the inputs...`);
		if(fs.existsSync(configPath)) {
			try {
				// Wait before attempting to read the file again, to avoid
				// file locking issues discovered during development.
				// TODO: Figure out what's causing file locking issues.
				let hypar = JSON.parse(fs.readFileSync(configPath, 'utf8'));
				HyparPanel.readInputFileAndPostMessage(inputPath, hypar);
			} catch (error) {
				console.warn(`There was an error reading the config: ${error}. Retrying in 1 second.`);
				HyparPanel.sleep(()=>{
					let hypar = JSON.parse(fs.readFileSync(configPath, 'utf8'));
					HyparPanel.readInputFileAndPostMessage(inputPath, hypar);
				});
			}
		}
	}

	private static readInputFileAndPostMessage(inputPath: string, hypar: any) {
		if(fs.existsSync(inputPath)) {
			try {
				let input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
				if(HyparPanel.currentPanel) {
					HyparPanel.currentPanel._panel.webview.postMessage({command: 'update-inputs', config: hypar, input: input});
				}
			} catch (error) {
				// Wait before attempting to read the file again, to avoid
				// file locking issues discovered during development.
				// TODO: Figure out what's causing file locking issues.
				console.warn(`There was an error reading the inputs: ${error}. Retrying in 1 second.`);
				HyparPanel.sleep(()=>{
					let input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
					if(HyparPanel.currentPanel) {
						HyparPanel.currentPanel._panel.webview.postMessage({command: 'update-inputs', config: hypar, input: input});
					}
				});
			}
		}
	}

	private static timeout(ms: number) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private static async sleep(fn: any, ...args: any) {
		await HyparPanel.timeout(1000);
		return fn(...args);
	}

	public static updateOutputs(outputPath: string) {
		if(vscode.workspace.workspaceFolders) {
			fs.readFile(outputPath, 'utf8', (err:NodeJS.ErrnoException | null, data:string)=>{
				if(err) {
					console.warn(err);
					return;
				}
				var outputData = JSON.parse(data);
				if(HyparPanel.currentPanel) {
					HyparPanel.currentPanel._panel.webview.postMessage({command: 'update-outputs', data: outputData});
				}
			});	
		}
	}

	public static revive(panel: vscode.WebviewPanel, extensionPath: string, title: string, modelPath: string, configPath: string) {
		console.debug("Reviving the web view.");
		HyparPanel.currentPanel = new HyparPanel(panel, extensionPath, title, modelPath, configPath);
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string, title: string, modelPath: string, configPath: string ) {
		this._panel = panel;
		this._extensionPath = extensionPath;

		// Set the webview's initial html content
		this._update(title);

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			(e:vscode.WebviewPanelOnDidChangeViewStateEvent) => {
				console.debug("Hypar view extension changed state. Nothing to do.");
			},
			null,
			this._disposables
		);
		
		let inputPath = path.join(this._extensionPath, 'media', 'input.json');
		if(vscode.workspace.workspaceFolders) {
			inputPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'input.json');
		}

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
					case 'hypar-update-inputs':
						fs.writeFile(inputPath, JSON.stringify(message.data), (err)=>{
							if(err) {
								console.warn(err);
							}
						});
						return;
					case 'hypar-loaded':
						HyparPanel.updateInputs(configPath, inputPath);
						HyparPanel.updateModel(modelPath, true);
						return;
					case 'hypar-image-captured':
						let matches = message.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
						if (matches.length !== 3) {
							return new Error('Invalid input string');
						}
						let imgData = Buffer.from(matches[2], 'base64');
						if(vscode.workspace.workspaceFolders) {
							let imgPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "preview.png");
							fs.writeFile(imgPath, imgData, (err: NodeJS.ErrnoException | null)=>{
								if(err) {
									console.error(err);
								}
							});
						}
				}
			},
			null,
			this._disposables
		);
	}

	public dispose() {
		HyparPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update(title:string) {
		console.debug("Updating hypar code.");
		this._panel.title = title;
		this._panel.webview.html = this._getHtmlForWebview(title);
	}

	private _getHtmlForWebview(title:string) {

		const hyparCssPath = vscode.Uri.file(
			path.join(this._extensionPath, 'media', 'hypar.css')
		);
		
		const hyparCssUri = hyparCssPath.with({scheme: 'vscode-resource'});

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();
		
		const root = 'https://hypar.io';
		// const root = 'https://dev.hypar.io';
		// const root = 'http://localhost:8080';

		return `<!DOCTYPE html>
		<html lang="en">
            <head>
                <meta charset="UTF-8">
                <!--
                Use a content security policy to only allow loading images from https or from our extension directory,
                and only allow scripts that have a specific nonce.
                -->
                <meta
					http-equiv="Content-Security-Policy"
					content="frame-src ${root}; img-src vscode-resource: https:; script-src vscode-resource: 'nonce-${nonce}' 'unsafe-eval'; style-src vscode-resource: 'unsafe-inline'; connect-src vscode-resource:;"
				/>
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link rel="stylesheet" type="text/css" href="${hyparCssUri}">
				<title>"${title}"</title>
            </head>
			<body>
				<iframe id="hypar-frame" style="width:100%;height:100%" src="${root}/functions/build" frameborder="0" ></iframe>
				<script nonce="${nonce}">
					let vscode = acquireVsCodeApi();
					let hypar = document.getElementById('hypar-frame').contentWindow;
					window.addEventListener('message', event => {
						let message = event.data
						if (message.command == 'update-inputs' ||
							message.command == 'update-outputs' ||
							message.command == 'load-model') {
								hypar.postMessage(message, '${root}/functions/build')
						} else if (	message.command == 'hypar-update-inputs' ||
									message.command == 'hypar-loaded' ||
									message.command == 'hypar-image-captured') {
							vscode.postMessage(message)
						}
					});
				</script>
            </body>
		</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}