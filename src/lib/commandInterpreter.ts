import type { WhiteboardController } from './whiteboardController';

export interface CommandInterpreterOptions {
	controller: WhiteboardController;
	showHelp: () => void;
}

export class CommandInterpreter {
	private controller: WhiteboardController;
	private showHelpCallback: () => void;

	constructor(options: CommandInterpreterOptions) {
		this.controller = options.controller;
		this.showHelpCallback = options.showHelp;
	}

	public interpretAndExecute(fullCommand: string): void {
		const trimmedCommand = fullCommand.trim();
		if (!trimmedCommand) return;

		const argsRegex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
		const parts: string[] = [];
		let match;
		while ((match = argsRegex.exec(trimmedCommand)) !== null) {
			parts.push(match[1] || match[2] || match[0]);
		}

		if (parts.length === 0) return;

		const command = parts[0].toLowerCase();
		const params = parts.slice(1);

		if (!this.controller.isReady() && !['help', 'log'].includes(command)) {
			console.warn("Whiteboard not ready. Try command again shortly or type 'help'.");
			return;
		}

		console.log(
			`Executing: ${command}`,
			params.map((p) => (p.length > 30 ? p.substring(0, 27) + '...' : p))
		);

		switch (command) {
			case 'add':
				if (params.length < 1) {
					console.warn('Usage: add <text|image> [content/url]');
					this.showHelpCallback();
					return;
				}
				if (params[0]?.toLowerCase() === 'text') {
					this.controller.addTextNode(params.slice(1).join(' '));
				} else if (params[0]?.toLowerCase() === 'image') {
					this.controller.addImageNode(params[1]);
				} else {
					console.warn(`Unknown 'add' subcommand: "${params[0]}". Try 'add text' or 'add image'.`);
					this.showHelpCallback();
				}
				break;
			case 'text':
				this.controller.addTextNode(params.join(' '));
				break;
			case 'image':
				this.controller.addImageNode(params[0]);
				break;
			case 'zoom':
				if (params.length < 1) {
					console.warn('Usage: zoom <in|out> [factor]');
					this.showHelpCallback();
					return;
				}
				if (params[0]?.toLowerCase() === 'in') {
					this.controller.zoom('in', params[1]);
				} else if (params[0]?.toLowerCase() === 'out') {
					this.controller.zoom('out', params[1]);
				} else {
					console.warn(`Unknown 'zoom' subcommand: "${params[0]}". Try 'zoom in' or 'zoom out'.`);
					this.showHelpCallback();
				}
				break;
			case 'zoomin':
				this.controller.zoom('in', params[0]);
				break;
			case 'zoomout':
				this.controller.zoom('out', params[0]);
				break;
			case 'set':
				console.log(params)
				console.log(parts)
				switch (params[0]?.toLowerCase()) {
					case 'zoom':
						this.controller.setZoom(parseFloat(params[1]));
						break;
					case 'pan':
						this.controller.panTo(parseFloat(params[1]), parseFloat(params[2]));
						break;
					case 'sid':
						this.controller.toggleIDHidden()
						console.log("Toggled ID visibility")
						break;
					default:
						console.warn(`Unknown 'set' subcommand: "${params[0]}". Try 'set zoom' or 'set pan'.`);
						this.showHelpCallback();
				}
			case 'reset':
				this.controller.resetView();
				break;
			case 'log':
				this.controller.logNodes();
				break;
			case 'clear':
				this.controller.clearNodes();
				break;
			case 'help':
				this.showHelpCallback();
				break;
			default:
				console.warn(`Unknown command: "${command}". Type 'help' for available commands.`);
				this.showHelpCallback();
		}
	}
}