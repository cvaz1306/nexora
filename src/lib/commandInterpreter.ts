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
			console.warn("Whiteboard instance not fully ready. Try command again shortly or type 'help'.");
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
			case 'connect':
				if (params.length !== 2) {
					console.warn('Usage: connect <nodeId1> <nodeId2>');
					this.showHelpCallback();
					return;
				}
				this.controller.connectNodes(params[0], params[1]);
				break;
			case 'zoom':
				if (params.length < 1) {
					console.warn("Usage: zoom <in|out|value> [factor]. E.g., 'zoom in', 'zoom 0.5'");
					this.showHelpCallback();
					return;
				}
				const zoomAction = params[0]?.toLowerCase();
				if (zoomAction === 'in') {
					this.controller.zoom('in', params[1]);
				} else if (zoomAction === 'out') {
					this.controller.zoom('out', params[1]);
				} else {
					const zoomLevel = parseFloat(zoomAction);
					if (!isNaN(zoomLevel)) {
						this.controller.setZoom(zoomLevel);
					} else {
						console.warn(`Unknown 'zoom' action: "${params[0]}". Try 'zoom in', 'zoom out', or a number.`);
						this.showHelpCallback();
					}
				}
				break;
			case 'zoomin':
				this.controller.zoom('in', params[0]);
				break;
			case 'zoomout':
				this.controller.zoom('out', params[0]);
				break;
			case 'set':
				if (params.length < 1) {
					console.warn("Usage: set <property> <value>. E.g., 'set zoom 0.8', 'set pan 100 100', 'set sid', 'set connections on'");
					this.showHelpCallback();
					return;
				}
				const setProperty = params[0]?.toLowerCase();
				switch (setProperty) {
					case 'zoom':
						this.controller.setZoom(params[1]);
						break;
					case 'pan':
						const x = parseFloat(params[1]);
						const y = parseFloat(params[2]);
						if (!isNaN(x) && !isNaN(y)) {
							this.controller.panTo(x, y);
						} else {
							console.warn("Invalid pan coordinates. Usage: set pan <x> <y>");
							this.showHelpCallback();
						}
						break;
					case 'sid':
						this.controller.toggleIDHidden();
						break;
					case 'connections':
						if (params.length !== 2 || !['on', 'off'].includes(params[1]?.toLowerCase())) {
							console.warn("Usage: set connections <on|off>");
							this.showHelpCallback();
						} else {
							this.controller.toggleConnectionsVisibility(params[1]?.toLowerCase() === 'on');
						}
						break;
					default:
						console.warn(`Unknown 'set' subcommand: "${setProperty}". Try 'set zoom', 'set pan', 'set sid', or 'set connections'.`);
						this.showHelpCallback();
				}
				break;
			case 'reset':
			case 'resetview':
				this.controller.resetView();
				break;
			case 'arrange':
			case 'layout':
				this.controller.autoArrangeNodes(params[0]);
				break;
			case 'log':
			case 'ls':
				this.controller.logNodes();
				break;
			case 'clear':
			case 'cls':
				this.controller.clearNodes();
				break;
			case 'help':
			case '?':
				this.showHelpCallback();
				break;
			default:
				console.warn(`Unknown command: "${command}". Type 'help' for available commands.`);
				this.showHelpCallback();
		}
	}
}