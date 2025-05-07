<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	export let placeholder: string = "Type command and press Enter";
	export let disabled: boolean = false;

    export let focused = false;
	let commandInput: string = '';
	let commandInputRef: HTMLInputElement;

	const dispatch = createEventDispatcher<{ submitCommand: string }>();

	function handleCommandInput(event: KeyboardEvent) {
		if (event.key === 'Enter' && !disabled) {
			event.preventDefault();
			if (commandInput.trim()) {
				dispatch('submitCommand', commandInput.trim());
				commandInput = '';
			}
		}
	}

	export function focus() {
		if (commandInputRef) {
			commandInputRef.focus();
		}
	}

	export function setInputValue(value: string) {
		commandInput = value;
	}

	onMount(() => {
		if (commandInputRef) {
			commandInputRef.focus();
		}
	});
</script>

<div class="command-bar-wrapper">
	<span class="prompt">></span>
	<input
		type="text"
		bind:this={commandInputRef}
		bind:value={commandInput}
        on:focusin={() => focused = true}
		on:focusout={() => focused = false}
		on:keydown={handleCommandInput}
		{placeholder}
		aria-label="Command Input"
		{disabled}
	/>
</div>

<style>
	.command-bar-wrapper {
		display: flex;
		align-items: center;
		padding: 10px 15px;
		background-color: #1e1e1e;
		color: #d4d4d4;
		font-family: 'Consolas', 'Menlo', 'Courier New', Courier, monospace;
		flex-shrink: 0;
		border-top: 1px solid #333;
		transition: filter 0.3s ease-in-out; /* For blur effect if parent applies it */
	}
	.command-bar-wrapper .prompt {
		margin-right: 8px;
		color: #6a9955;
		user-select: none;
	}
	.command-bar-wrapper input[type='text'] {
		flex-grow: 1;
		background-color: transparent;
		border: none;
		color: #d4d4d4;
		font-family: inherit;
		font-size: 0.95em;
		outline: none;
		padding: 4px 0;
	}
	.command-bar-wrapper input[type='text']::placeholder {
		color: #666;
	}
	.command-bar-wrapper input[type='text']:disabled {
		background-color: #2a2a2a; /* Slightly different background when disabled */
		color: #777;
	}
</style>