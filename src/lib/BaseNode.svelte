<script lang="ts">
	// No props needed for x, y, width, height if it always fills parent
	// Parent (.node-wrapper) is positioned and sized by Whiteboard.svelte
</script>

<div class="node-base">
	<slot />
</div>

<style>
	.node-base {
		width: 100%; /* Fill the parent (.node-wrapper) */
		height: 100%; /* Fill the parent (.node-wrapper) */
		border: 1px solid #ccc;
		background-color: white;
		box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);
		user-select: none; /* Prevent selecting node content when panning board */
		display: flex; /* Useful for internal layout */
		align-items: center;
		justify-content: center;
		overflow: hidden; /* Clip content that overflows, or use 'auto' for scrollbars */
		box-sizing: border-box; /* So border doesn't add to width/height */
		cursor: default; /* Content cursor, wrapper has 'grab' */
	}
</style>