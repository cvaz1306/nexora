<script lang="ts">
	import Whiteboard from '$lib/Whiteboard.svelte';
	import type { NodeData, Connection } from '$lib/Whiteboard.svelte';
	import TextNode from '$lib/TextNode.svelte';
	import ImageNode from '$lib/ImageNode.svelte';
	import HelpModal from '$lib/HelpModal.svelte';
	import CommandBar from '$lib/CommandBar.svelte';
	import { WhiteboardController } from '$lib/whiteboardController';
	import { CommandInterpreter } from '$lib/commandInterpreter';
	import { onMount, tick, type ComponentType, type SvelteComponent } from 'svelte';

	let whiteboardInstance: Whiteboard;
	let commandBarComponent: CommandBar;

	let nodes: NodeData[] = [
		{
			id: 'initial-text',
			component: TextNode as unknown as ComponentType<SvelteComponent>,
			x: 0,
			y: 0,
			width: 250,
			height: 180,
			showId: true,
			props: {
				text: 'Hello Whiteboard!\n\nTry resizing or dragging me.\n\nConnect me!',
				fontSize: 20
			}
		},
		{
			id: 'initial-image',
			component: ImageNode as unknown as ComponentType<SvelteComponent>,
			x: 800,
			y: 0,
			width: 200,
			height: 200,
			showId: true,
			props: { src: 'https://svelte.dev/favicon.png', alt: 'Svelte Logo', width: 50, height: 50 }
		},
		{
			id: 'node-c',
			component: TextNode as unknown as ComponentType<SvelteComponent>,
			x: 200,
			y: 300,
			width: 150,
			height: 100,
			showId: true,
			props: {
				text: 'Node C',
				fontSize: 18
			}
		},
		{
			id: 'node-d',
			component: ImageNode as unknown as ComponentType<SvelteComponent>,
			x: 900,
			y: 400,
			width: 180,
			height: 120,
			showId: true,
			props: { src: 'https://placehold.co/100x80/ff00ff/white?text=Node+D', alt: 'Node D', width: 180, height: 120 }
		}
	];

	let connections: Connection[] = [];
	let showConnections: boolean = true;

	let showHelpModal = false;

	const helpContent = `
<strong>help</strong>                          - Shows this help message. (alias: <strong>?</strong>)
<strong>add text</strong> <em>[content]</em>         - Adds a text node. (alias: <strong>text</strong>)
                                  e.g., <strong>add text</strong> <em>"Hello World"</em>
<strong>add image</strong> <em>[url|upload]</em>    - Adds an image node. (alias: <strong>image</strong>)
                                  e.g., <strong>image</strong> <em>upload</em>
<strong>connect</strong> <em><id1> <id2></em>        - Connects two nodes by ID (default bottom->top handles).
                                  e.g., <strong>connect</strong> <em>initial-text node-c</em>
<strong>zoom</strong> <em>[in|out|level] [factor]</em> - Zooms. e.g. <strong>zoom in</strong>, <strong>zoom 0.5</strong>
                                  (aliases: <strong>zoomin</strong>, <strong>zoomout</strong>)
<strong>set zoom</strong> <em>[level]</em>             - Sets zoom to a specific level.
                                  e.g., <strong>set zoom</strong> <em>0.75</em>
<strong>set pan</strong> <em>[x] [y]</em>              - Pans view to center on (x,y).
                                  e.g., <strong>set pan</strong> <em>0 0</em>
<strong>set sid</strong>                       - Toggles visibility of node IDs.
<strong>set connections</strong> <em><on|off></em>   - Toggles visibility of connection lines.
                                  e.g., <strong>set connections</strong> <em>off</em>
<strong>reset</strong>                           - Resets pan to (0,0) and zoom to 1x. (alias: <strong>resetview</strong>)
<strong>arrange</strong> <em>[padding]</em>           - Arranges nodes in a grid based on current proximity and connections. (alias: <strong>layout</strong>)
                                  e.g., <strong>arrange</strong> <em>50</em>
<strong>log</strong>                             - Logs current nodes and connections to console. (alias: <strong>ls</strong>)
<strong>clear</strong>                           - Clears all nodes and connections. (alias: <strong>cls</strong>)
    `;

	let controller: WhiteboardController;
	let interpreter: CommandInterpreter;

	onMount(() => {
		if (whiteboardInstance) {
			controller = new WhiteboardController({
				whiteboard: whiteboardInstance,
				getNodes: () => nodes,
				setNodes: (newNodes) => { nodes = newNodes; },
				getConnections: () => connections,
				setConnections: (newConnections) => { connections = newConnections; },
				showConnections: showConnections,
				setShowConnections: (show) => { showConnections = show; }
			});

			interpreter = new CommandInterpreter({
				controller: controller,
				showHelp: () => { showHelpModal = true; }
			});

		} else {
			console.error("Whiteboard instance not ready onMount. This shouldn't happen with bind:this.");
		}

		document.addEventListener('keypress', (event) => {
			if (
				(event.key === '/' || event.key === ':') &&
				!(event.target instanceof HTMLInputElement) &&
				!(event.target instanceof HTMLTextAreaElement) &&
				!(event.target as HTMLElement).isContentEditable
				)
			{
				commandBarComponent.focus();
				event.preventDefault();
			}
		});

		if (commandBarComponent) {
			tick().then(() => commandBarComponent.focus());
		}
	});

	function handleAddConnection(event: CustomEvent<{ from: string; to: string }>) {
		const { from, to } = event.detail;
		if (controller) {
            controller.connectNodes(from, to);
        } else {
            console.warn("Controller not ready to handle addConnection event.");
        }
	}

	function handleCommandSubmitted(event: CustomEvent<string>) {
		const command = event.detail;
		if (interpreter) {
			interpreter.interpretAndExecute(command);
		} else {
			console.warn('Command interpreter not ready.');
		}
	}

	function closeHelpModal() {
		showHelpModal = false;
		if (commandBarComponent) {
			commandBarComponent.focus();
		}
	}
</script>

<main class:modal-open={showHelpModal}>
	<div class="whiteboard-wrapper" class:blur-content={showHelpModal}>
		<Whiteboard
			bind:this={whiteboardInstance}
			bind:nodes
			bind:connections
			bind:showConnections
			on:addConnection={handleAddConnection}
		/>
	</div>
	<div class="command-bar-container" class:blur-content={showHelpModal}>
		<CommandBar
			bind:this={commandBarComponent}
			placeholder="Type command (or 'help') and press Enter"
			disabled={showHelpModal}
			on:submitCommand={handleCommandSubmitted}
		/>
	</div>

	{#if showHelpModal}
		<HelpModal bind:show={showHelpModal} on:close={closeHelpModal}>
			<div class="help-text-content">
				{@html helpContent
					.replace(/<strong>/g, '<strong class="cmd-name">')
					.replace(/<em>/g, '<em class="cmd-param">')}
			</div>
		</HelpModal>
	{/if}
</main>

<style>
	:global(body, html) {
		margin: 0;
		padding: 0;
		height: 100%;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif,
			'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
		overflow: hidden;
	}
	main {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: #f0f0f0;
	}

	.whiteboard-wrapper {
		flex-grow: 1;
		min-height: 0;
		position: relative;
		transition: filter 0.3s ease-in-out;
	}

	.command-bar-container {
		flex-shrink: 0;
		transition: filter 0.3s ease-in-out;
	}

	.blur-content {
		filter: blur(5px) brightness(0.7);
	}

	:global(.help-text-content strong.cmd-name) {
		color: #9cdcfe;
		font-weight: bold;
	}
	:global(.help-text-content em.cmd-param) {
		color: #ce9178;
		font-style: italic;
	}
	:global(.help-modal-overlay) {
		z-index: 1000;
	}
</style>