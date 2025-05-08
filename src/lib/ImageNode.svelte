<script lang="ts">
	import BaseNode from './BaseNode.svelte';

	export let src: string;
	export let alt: string = 'Whiteboard Image';
	// `width` and `height` props from NodeData.props can be accessed via $$props
	// if needed for img attributes, e.g. $$props.width
	export let image: HTMLImageElement | undefined = undefined; // Make binding optional
	export let showId: boolean = false;
	export let id: string;
</script>

<BaseNode {showId} {id}>
	<img
		bind:this={image}
		{src}
		{alt}
		draggable="false"
		style="display: block; max-width: 100%; max-height: 100%; object-fit: contain; width: 100%; height: 100%;"
		width={$$props.width || undefined} 
		height={$$props.height || undefined}
	/>
</BaseNode>

<style>
	img {
		/* Prevent default browser image drag */
		user-select: none;
		-webkit-user-drag: none;
		/* Styles moved to inline for clarity, or can be kept here if preferred */
	}
</style>