<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { slide, fade } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
  
    export let show: boolean = false;
  
    const dispatch = createEventDispatcher();
    let modalElement: HTMLDivElement;
    let closeButtonElement: HTMLButtonElement;
  
    function close() {
      dispatch('close');
    }
  
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
      }
    }
  
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
  
      const focusableElements = modalElement.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusableElement = focusableElements[0] as HTMLElement;
      const lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLElement;
  
      if (event.shiftKey) { // Shift + Tab
        if (document.activeElement === firstFocusableElement) {
          lastFocusableElement.focus();
          event.preventDefault();
        }
      } else { // Tab
        if (document.activeElement === lastFocusableElement) {
          firstFocusableElement.focus();
          event.preventDefault();
        }
      }
    }
  
    onMount(() => {
      if (show && closeButtonElement) {
          // Timeout to ensure transition has started and element is visible for focus
          setTimeout(() => closeButtonElement.focus(), 0);
      }
    });
  
    // Refocus the close button if the modal re-opens
    $: if (show && closeButtonElement && modalElement && document.contains(modalElement)) {
      setTimeout(() => closeButtonElement.focus(), 0);
    }
  </script>
  
  <svelte:window on:keydown={handleKeydown} />
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  {#if show}
  
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal-backdrop"
      on:click={close}
      transition:fade={{ duration: 200 }}
    ></div>
  
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      bind:this={modalElement}
      class="modal-content"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      on:keydown={trapFocus}
      transition:slide={{ duration: 300, easing: quintOut, axis: 'y' }}
    >
      <button
        bind:this={closeButtonElement}
        class="close-button"
        on:click={close}
        aria-label="Close help dialog"
      >
      <i class="fa-solid fa-xmark"></i>
      </button>
      <h2 id="help-modal-title" class="modal-title">Available Commands</h2>
      <div class="help-text-content">
        <slot><!-- Help text will be injected here --></slot>
      </div>
    </div>
  {/if} 
  
  <style>
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.6);
      z-index: 999;
    }
  
    .modal-content {
      position: fixed;
      top: 2vh; /* Start slightly from top for slide-in effect */
      left: 50%;
      transform: translateX(-50%); /* Start off-screen */
      background-color: #2c2c2c;
      color: #e0e0e0;
      padding: 25px;
      border-radius: 8px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
      z-index: 1000;
      width: 90%;
      max-width: 600px;
      max-height: 85vh;
      overflow-y: auto;
      border: 1px solid #444;
    }
  
    .modal-title {
      margin-top: 0;
      margin-bottom: 20px;
      color: #7fdbff; /* A light blue for the title */
      font-size: 1.5em;
    }
  
    .close-button {
      position: absolute;
      top: 10px;
      right: 15px;
      background: none;
      border: none;
      font-size: 2.2em;
      line-height: 1;
      color: #aaa;
      cursor: pointer;
      padding: 0;
    }
    .close-button:hover,
    .close-button:focus {
      color: #fff;
      outline: none;
      text-shadow: 0 0 5px #fff;
    }
  
    .help-text-content {
      font-family: 'Consolas', 'Courier New', Courier, monospace;
      font-size: 0.9em;
      line-height: 1.6;
      white-space: pre-wrap; /* Allows wrapping and preserves whitespace */
    }
  
    .help-text-content strong {
      color: #6a9955; /* Green for command names */
    }
    .help-text-content em {
      color: #c586c0; /* Purple for parameters */
      font-style: normal;
    }
  </style>