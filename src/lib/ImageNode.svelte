<script lang="ts">
    import BaseNode from './BaseNode.svelte';
  
    export let x: number;
    export let y: number;
    export let src: string;
    export let alt: string = 'Whiteboard Image';
    export let width: number | undefined = undefined;
    export let height: number | undefined = undefined;
    export let image: HTMLImageElement;

    console.log(width, height)
  </script>
  
  <BaseNode {x} {y}>
    <img bind:this={image} src="{src}" {alt} {width} {height} draggable="false" style="display: block; width: {width}px;"/>
  </BaseNode>
  
  <style>
    img {
      /* Prevent default browser image drag */
      user-select: none;
      -webkit-user-drag: none;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  </style>