<script lang="ts">
  export let x: number = 0;
  export let y: number = 0;

  export let width: number = 200;
  export let height: number = 200;
  let divElement: HTMLElement;
  // Add any other common props like id, selected state, etc. later if needed
</script>

<div
  class="node-base"
  style:left="{x}px"
  style:top="{y}px"
  style="width: {width}; height: {height}"
  bind:this={divElement}
>
  <slot />
</div>

<style>
  .node-base {
    position: absolute;
    cursor: default; /* Change if adding dragging later */
    border: 1px solid #ccc;
    background-color: white;
    box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);
    user-select: none; /* Prevent selecting node content when panning board */
    min-width: 200px; /* Ensure nodes have some size */
    min-height: 200px;
    width: fit-content;
    height: fit-content;
    display: flex; /* Useful for internal layout */
    align-items: center;
    justify-content: center;
  }
</style>