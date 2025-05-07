<script lang="ts">
	import Whiteboard from '$lib/Whiteboard.svelte';
	import type { NodeData } from '$lib/Whiteboard.svelte';
	import TextNode from '$lib/TextNode.svelte';
	import ImageNode from '$lib/ImageNode.svelte';
	import HelpModal from '$lib/HelpModal.svelte';
	import CommandBar from '$lib/CommandBar.svelte';
	import { WhiteboardController } from '$lib/whiteboardController';
	import { CommandInterpreter } from '$lib/commandInterpreter';
	import { onMount, type ComponentType, type SvelteComponent } from 'svelte';

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
			props: {
				text: 'Hello Whiteboard!\n\nTry resizing me.\nOr dragging me around.',
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
			props: { src: 'https://svelte.dev/favicon.png', alt: 'Svelte Logo', width: 50, height: 50 }
		}
	];

	let showHelpModal = false;

	const helpContent = `
<strong>help</strong>                          - Shows this help message.
<strong>add text</strong> <em>[content]</em>         - Adds a text node.
                                  e.g., <strong>add text</strong> <em>"Hello World"</em>
                                  e.g., <strong>text</strong> <em>Quick note</em> (shorthand)
<strong>add image</strong> <em>[url|upload]</em>    - Adds an image node.
                                  e.g., <strong>add image</strong> <em>https://svelte.dev/favicon.png</em>
                                  e.g., <strong>image</strong> <em>upload</em> (opens file dialog)
<strong>zoom in</strong> <em>[factor]</em>             - Zooms in. Default factor: 1.2.
<strong>zoom out</strong> <em>[factor]</em>            - Zooms out. Default factor: 1.2.
<strong>reset</strong>                           - Resets pan to (0,0) and zoom to 1x.
<strong>log</strong>                             - Logs current nodes to the browser console.
<strong>clear</strong>                           - Clears all nodes from the whiteboard.
    `; // Simplified example, keep your full help content

	let controller: WhiteboardController;
	let interpreter: CommandInterpreter;

	onMount(() => {
		// Ensure whiteboardInstance is available before initializing controller
		// Svelte's bind:this guarantees it's set after component mounts
		if (whiteboardInstance) {
			controller = new WhiteboardController({
				whiteboard: whiteboardInstance,
				getNodes: () => nodes, // Provide a way to get current nodes
				setNodes: (newNodes) => { // Provide a way to set nodes (for clear)
					nodes = newNodes;
				}
			});

			interpreter = new CommandInterpreter({
				controller: controller,
				showHelp: () => {
					showHelpModal = true;
				}
			});
		} else {
			console.error("Whiteboard instance not ready onMount. This shouldn't happen with bind:this.");
		}
		document.addEventListener('keypress', (event) => {
			if(event.key === '/' || event.key === ':') {
				commandBarComponent.focus();
			}
	});
		document.addEventListener('zoom', (event) => {
			if (!(event.target as HTMLElement).closest('.whiteboard-wrapper')) {
				event.stopImmediatePropagation();
				event.preventDefault();
			}
		});

		if (commandBarComponent) {
			commandBarComponent.focus();
		}
	});

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
		<Whiteboard bind:this={whiteboardInstance} bind:nodes />
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
		overflow: hidden; /* Important: keep this to prevent double scrollbars */
	}
	main {
		display: flex;
		flex-direction: column;
		height: 100vh; /* Changed from 100% to 100vh for full viewport height */
		background-color: #f0f0f0;
	}

	.whiteboard-wrapper {
		flex-grow: 1;
		min-height: 0; /* Important for flex-grow in a flex column */
		position: relative;
		transition: filter 0.3s ease-in-out;
	}

	.command-bar-container {
		/* This container ensures the CommandBar itself can be blurred if needed */
		flex-shrink: 0; /* Prevent shrinking */
		transition: filter 0.3s ease-in-out;
	}

	.blur-content {
		filter: blur(5px) brightness(0.7);
	}

	/* Styles for help text in the modal */
	:global(.help-text-content strong.cmd-name) {
		color: #9cdcfe;
		font-weight: bold;
	}
	:global(.help-text-content em.cmd-param) {
		color: #ce9178;
		font-style: italic;
	}
	/* Ensure HelpModal is rendered above blurred content */
	:global(.help-modal-overlay) { /* Assuming HelpModal has an overlay with this class */
		z-index: 1000;
	}
</style>