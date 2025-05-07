<script lang="ts">
	import Whiteboard from '$lib/Whiteboard.svelte';
	import type { NodeData } from '$lib/Whiteboard.svelte';
	import TextNode from '$lib/TextNode.svelte';
	import ImageNode from '$lib/ImageNode.svelte';
	import HelpModal from '$lib/HelpModal.svelte'; // Import the modal
	import { onMount, type ComponentType, type SvelteComponent } from 'svelte';

	let whiteboardInstance: Whiteboard;

	let nodes: NodeData[] = [
		{
			id: 'initial-text',
			component: TextNode as unknown as ComponentType<SvelteComponent>,
			x: 0,
			y: 0,
			props: { text: 'Hello Whiteboard!', fontSize: 24 }
		},
		{
			id: 'initial-image',
			component: ImageNode as unknown as ComponentType<SvelteComponent>,
			x: 800,
			y: 0,
            width: 200,
            height: 200,
			props: { src: 'https://svelte.dev/favicon.png', alt: 'Svelte Logo', width: 50 }
		}
	];

	let commandInput: string = '';
	let commandInputRef: HTMLInputElement;
	let showHelpModal = false; // For controlling the modal

	const helpContent = `
<strong>help</strong>                          - Shows this help message.

<strong>add text</strong> <em>[content]</em>         - Adds a text node.
                                  e.g., <strong>add text</strong> <em>"Hello World"</em>
                                  e.g., <strong>text</strong> <em>Quick note</em> (shorthand)
                                  (Content is optional, defaults to random text)

<strong>add image</strong> <em>[url]</em>            - Adds an image node.
                                  e.g., <strong>add image</strong> <em>https://svelte.dev/favicon.png</em>
                                  e.g., <strong>image</strong> <em>https://picsum.photos/200</em> (shorthand)
                                  (URL is optional, defaults to a placeholder)

<strong>zoom in</strong> <em>[factor]</em>             - Zooms in. Default factor: 1.2.
                                  e.g., <strong>zoom in</strong>
                                  e.g., <strong>zoom in</strong> <em>1.5</em>
                                  e.g., <strong>zoomin</strong> <em>1.1</em> (shorthand)

<strong>zoom out</strong> <em>[factor]</em>            - Zooms out. Default factor: 1.2.
                                  e.g., <strong>zoom out</strong>
                                  e.g., <strong>zoom out</strong> <em>1.5</em>
                                  e.g., <strong>zoomout</strong> <em>1.1</em> (shorthand)

<strong>reset</strong>                           - Resets pan to (0,0) and zoom to 1x.

<strong>log</strong>                             - Logs current nodes to the browser console.

<strong>clear</strong>                           - Clears all nodes from the whiteboard.
    `;

	function executeAddTextNode(text?: string) {
		// const container = getWhiteboardContainer(); // Removed
		if (!whiteboardInstance) {
			console.warn('Whiteboard instance not available for adding text node.');
			return;
		}

		const viewCenter = whiteboardInstance.getStageCoordinatesForScreenCenter();

		if (!viewCenter) {
			console.warn(
				'Could not determine whiteboard view center to add text node. Whiteboard might not be fully ready.'
			);
			return;
		}

		const randomX = viewCenter.x + (Math.random() - 0.5) * 150;
		const randomY = viewCenter.y + (Math.random() - 0.5) * 150;
		const nodeText = text?.trim() || `Random ${Math.random().toString(36).substring(7)}`;

		whiteboardInstance.addNode('text', randomX, randomY, { text: nodeText, fontSize: 16 });
		console.log(`Added text node: "${nodeText}" at (${randomX.toFixed(0)}, ${randomY.toFixed(0)})`);
	}

	function executeAddImageNode(src?: string) {
		// const container = getWhiteboardContainer(); // Removed
		if (!whiteboardInstance) {
			console.warn('Whiteboard instance not available for adding image node.');
			return;
		}

		const viewCenter = whiteboardInstance.getStageCoordinatesForScreenCenter();

		if (!viewCenter) {
			console.warn(
				'Could not determine whiteboard view center to add image node. Whiteboard might not be fully ready.'
			);
			return;
		}

		let imageSrc: string | ArrayBuffer | null =
			src?.trim() || `https://placehold.co/200x150?text=Image`;
		if (imageSrc === 'upload' || imageSrc === 'input') {
			const fileInput = document.createElement('input');
			fileInput.type = 'file';
			fileInput.accept = 'image/*';
			fileInput.click();

			fileInput.addEventListener('change', (event) => {
				let file = fileInput.files[0];

				const reader = new FileReader();
				reader.onload = function (e) {
					imageSrc = e.target.result;
					console.log(e.target?.result);
					const randomX = viewCenter.x + (Math.random() - 0.5) * 200;
					const randomY = viewCenter.y + (Math.random() - 0.5) * 200;

					whiteboardInstance.addNode('image', randomX, randomY, {
						src: imageSrc,
						width: 500,
                        height: 500,
						alt: 'User Added Image'
					});
					console.log(
						`Added image node with src: "${imageSrc}" at (${randomX.toFixed(0)}, ${randomY.toFixed(0)})`
					);
				};
				reader.readAsDataURL(file);
			});
		} else {
			const randomX = viewCenter.x + (Math.random() - 0.5) * 200;
			const randomY = viewCenter.y + (Math.random() - 0.5) * 200;

			whiteboardInstance.addNode('image', randomX, randomY, {
				src: imageSrc,
				width: 100,
				alt: 'User Added Image'
			});
			console.log(
				`Added image node with src: "${imageSrc}" at (${randomX.toFixed(0)}, ${randomY.toFixed(0)})`
			);
		}
	}

	function executeZoom(direction: 'in' | 'out', factorStr?: string) {
		if (!whiteboardInstance) {
			console.warn('Whiteboard instance not available for zoom.');
			return;
		}

		let factor = parseFloat(factorStr || '1.2');
		if (isNaN(factor) || factor <= 0.1 || factor > 5) {
			console.warn(
				`Invalid zoom factor "${factorStr}". Using default 1.2. Factor must be > 0.1 and < 5.`
			);
			factor = 1.2;
		}

		const currentViewport = whiteboardInstance.getViewport();
		const targetZoom =
			direction === 'in' ? currentViewport.zoom * factor : currentViewport.zoom / factor;

		whiteboardInstance.setZoom(targetZoom);

		// The log now reflects the targetZoom. Whiteboard.svelte handles clamping internally.
		// To get the *actual* new zoom, we'd need whiteboardInstance.getViewport().zoom again after the call.
		// For simplicity of this change, we'll log the target.
		console.log(
			`Zoomed ${direction} by ${factor.toFixed(2)}. Target zoom level: ${targetZoom.toFixed(2)} (actual may be clamped)`
		);
	}

	function executeResetView() {
		if (!whiteboardInstance) return;
		whiteboardInstance.panTo(0, 0);
		whiteboardInstance.setZoom(1);
		console.log('View reset to origin and zoom 1x.');
	}

	function executeLogNodes() {
		if (!whiteboardInstance) {
			console.log(
				'Current Nodes (whiteboard not fully initialized yet):',
				JSON.parse(JSON.stringify(nodes))
			);
			return;
		}
		// Assuming Whiteboard.svelte keeps its 'nodes' prop in sync
		console.log('Current Nodes:', JSON.parse(JSON.stringify(nodes)));
	}

	function executeClearNodes() {
		if (!whiteboardInstance) {
			console.warn('Whiteboard instance not ready to clear nodes.');
			return;
		}
		nodes = [];
		console.log('All nodes cleared from the whiteboard.');
	}

	function executeHelp() {
		showHelpModal = true;
	}

	function parseAndExecuteCommand(fullCommand: string) {
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

		if (!whiteboardInstance && !['help', 'log'].includes(command)) {
			console.warn("Whiteboard not ready. Try command again shortly or type 'help'.");
			return;
		}

		console.log(
			`Executing: ${command}`,
			params.map((p) => (p.length > 30 ? p.substring(0, 27) + '...' : p))
		); // Log params concisely

		switch (command) {
			case 'add':
				if (params.length < 1) {
					console.warn('Usage: add <text|image> [content/url]');
					executeHelp();
					return;
				}
				if (params[0]?.toLowerCase() === 'text') {
					executeAddTextNode(params.slice(1).join(' '));
				} else if (params[0]?.toLowerCase() === 'image') {
					executeAddImageNode(params[1]);
				} else {
					console.warn(`Unknown 'add' subcommand: "${params[0]}". Try 'add text' or 'add image'.`);
					executeHelp();
				}
				break;
			case 'text':
				executeAddTextNode(params.join(' '));
				break;
			case 'image':
				executeAddImageNode(params[0]);
				break;
			case 'zoom':
				if (params.length < 1) {
					console.warn('Usage: zoom <in|out> [factor]');
					executeHelp();
					return;
				}
				if (params[0]?.toLowerCase() === 'in') {
					executeZoom('in', params[1]);
				} else if (params[0]?.toLowerCase() === 'out') {
					executeZoom('out', params[1]);
				} else {
					console.warn(`Unknown 'zoom' subcommand: "${params[0]}". Try 'zoom in' or 'zoom out'.`);
					executeHelp();
				}
				break;
			case 'zoomin':
				executeZoom('in', params[0]);
				break;
			case 'zoomout':
				executeZoom('out', params[0]);
				break;
			case 'reset':
				executeResetView();
				break;
			case 'log':
				executeLogNodes();
				break;
			case 'clear':
				executeClearNodes();
				break;
			case 'help':
				executeHelp();
				break;
			default:
				console.warn(`Unknown command: "${command}". Type 'help' for available commands.`);
				executeHelp();
		}
	}

	function handleCommandInput(event: KeyboardEvent) {
		if (event.key === 'Enter' && !showHelpModal) {
			// Prevent execution if modal is open
			event.preventDefault();
			if (commandInput.trim()) {
				parseAndExecuteCommand(commandInput);
				commandInput = '';
			}
		}
	}

	function closeHelpModal() {
		showHelpModal = false;
		if (commandInputRef) {
			commandInputRef.focus(); // Return focus to command input
		}
	}

	onMount(() => {
		document.addEventListener('zoom', (event) => {
			// General browser zoom event
			if (!(event.target as HTMLElement).closest('.whiteboard-wrapper')) {
				event.stopImmediatePropagation();
				event.preventDefault();
				console.log("Document 'zoom' event captured (likely browser pinch/ctrl-scroll).");
			}
		});

		if (commandInputRef) {
			commandInputRef.focus();
		}
		// console.log("Type 'help' in the command bar below for available commands."); // Initial prompt
	});
</script>

<main class:modal-open={showHelpModal}>
	<div class="whiteboard-wrapper" class:blur-content={showHelpModal}>
		<Whiteboard bind:this={whiteboardInstance} bind:nodes />
	</div>
	<div class="command-bar-container" class:blur-content={showHelpModal}>
		<span class="prompt">></span>
		<input
			type="text"
			bind:this={commandInputRef}
			bind:value={commandInput}
			on:keydown={handleCommandInput}
			placeholder="Type command (or 'help') and press Enter"
			aria-label="Command Input"
			disabled={showHelpModal}
		/>
	</div>

	<HelpModal bind:show={showHelpModal} on:close={closeHelpModal}>
		{@html helpContent
			.replace(/<strong>/g, '<strong class="cmd-name">')
			.replace(/<em>/g, '<em class="cmd-param">')}
	</HelpModal>
</main>

<style>
	:global(body, html) {
		margin: 0;
		padding: 0;
		height: 100%;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif,
			'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
		overflow: hidden;
	}
	main {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: #f0f0f0; /* Lighter background for the app */
	}

	.whiteboard-wrapper {
		flex-grow: 1;
		min-height: 0;
		/* border-top: 1px solid #ccc; No longer needed with app background */
		position: relative;
		transition: filter 0.3s ease-in-out;
	}

	.command-bar-container {
		display: flex;
		align-items: center;
		padding: 10px 15px;
		background-color: #1e1e1e;
		color: #d4d4d4;
		font-family: 'Consolas', 'Menlo', 'Courier New', Courier, monospace;
		flex-shrink: 0;
		border-top: 1px solid #333;
		transition: filter 0.3s ease-in-out;
	}
	.command-bar-container .prompt {
		margin-right: 8px;
		color: #6a9955;
		user-select: none;
	}
	.command-bar-container input[type='text'] {
		flex-grow: 1;
		background-color: transparent;
		border: none;
		color: #d4d4d4;
		font-family: inherit;
		font-size: 0.95em;
		outline: none;
		padding: 4px 0;
	}
	.command-bar-container input[type='text']::placeholder {
		color: #666;
	}
	.command-bar-container input[type='text']:disabled {
		background-color: #2a2a2a; /* Slightly different background when disabled */
		color: #777;
	}

	/* Styles for blurring content behind modal */
	.blur-content {
		filter: blur(5px) brightness(0.7);
		/* pointer-events: none; /* Careful with this, might interfere if modal isn't perfectly on top */
	}

	/* Styles for help text in the modal if passed as HTML */
	:global(.help-text-content strong.cmd-name) {
		/* For styling within @html */
		color: #9cdcfe; /* Light blue for command names */
		font-weight: bold;
	}
	:global(.help-text-content em.cmd-param) {
		/* For styling within @html */
		color: #ce9178; /* Orange/brown for parameters */
		font-style: italic;
	}
</style>
