<script lang="ts">
	import { onMount } from 'svelte';
	import BaseNode from './BaseNode.svelte';

	export let text: string = 'New Text';
	export let fontSize: number = 16;
	export let editable: boolean = true; // Allow editing by default

	let initialText: string;
	let element: HTMLDivElement;

	// Basic handling to update the text prop when contenteditable changes
	// Note: This is a simplified update. More robust solutions might use
	// on:blur or debounce input events.
	function handleInput() {
		if (element) {
			text = element.innerText; // Update the reactive prop
		}
	}
	onMount(() => {
		initialText = text;
	});

	export let showId: boolean = false;
	export let id: string;
</script>
<BaseNode {showId} {id}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={element}
		class="text-content"
		contenteditable={editable}
		style:font-size="{fontSize}px"
		on:input={handleInput}
		on:mousedown|stopPropagation
		on:wheel|stopPropagation
	>
		{initialText}
	</div>
</BaseNode>

<style>
	.text-content {
		width: 100%;
		height: 100%;
		padding: 8px 12px;
		white-space: pre-wrap; /* Respect line breaks */
		word-break: break-word; /* Break long words */
		cursor: text;
		box-sizing: border-box;
		overflow: auto; /* Add scrollbars if content exceeds resized dimensions */
		line-height: 1.4; /* Adjust for better readability */
	}
	.text-content[contenteditable='true'] {
		outline: 1px dashed #99f; /* Indicate editable area */
	}
	.text-content[contenteditable='true']:focus {
		outline: 2px solid #55f;
	}
</style>