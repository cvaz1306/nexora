<script lang="ts">
	export let showId: boolean = false;
	export let id: string;

	let idWrapper: HTMLDivElement;
</script>

<div class="node-base-wrapper">
	<div bind:this={idWrapper} class="node-label">
		{#if showId}
			{id}
		{/if}
	</div>
	<div class="node-base" style="height: {showId ? `calc(100% - 30px)` : '100%'};">
		<slot />
	</div>
</div>

<style>
	.node-label {
		height: 30px;
	}
	.node-base-wrapper {
		width: 100%; /* Fill the parent (.node-wrapper) */
		height: 100%; /* Fill the parent (.node-wrapper) */
		border: 1px solid #ccc;
		border-radius: 15px;
		background-color: white;
		box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);
		user-select: none; /* Prevent selecting node content when panning board */
	}
	.node-base {
		width: 100%; /* Fill the parent (.node-wrapper) */

		background-color: white;
		user-select: none; /* Prevent selecting node content when panning board */
		display: flex; /* Useful for internal layout */
		align-items: center;
		justify-content: center;
		overflow: hidden; /* Clip content that overflows, or use 'auto' for scrollbars */
		box-sizing: border-box; /* So border doesn't add to width/height */
		cursor: default; /* Content cursor, wrapper has 'grab' */
	}
</style>
