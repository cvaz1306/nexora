<script context="module" lang="ts">
	import type { ComponentType, SvelteComponent } from 'svelte';

	export type NodeData = {
		id: string;
		component: ComponentType<SvelteComponent>;
		x: number; // Position on the whiteboard (unscaled stage coords)
		y: number; // Position on the whiteboard (unscaled stage coords)
		props: Record<string, any>;
		width: number; // Node width in stage units
		height: number; // Node height in stage units
	};
</script>

<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	// import type { ComponentType, SvelteComponent } from 'svelte';

	// Import node types
	import ImageNode from './ImageNode.svelte';
	import TextNode from './TextNode.svelte';

	// --- Exports ---
	export let nodes: NodeData[] = [];
	export let minZoom = 0.1;
	export let maxZoom = 5.0;
	export let zoomSensitivity = 0.002;
	export let gridSpacing = 20; // Grid size in stage units

	// --- Constants ---
	const DEFAULT_NODE_WIDTH = 200;
	const DEFAULT_NODE_HEIGHT = 150;
	const MIN_NODE_WIDTH = 30;
	const MIN_NODE_HEIGHT = 30;

	// --- State ---
	let panX = 0;
	let panY = 0;
	let zoom = 1;
	let isPanning = false;
	let startPanX = 0;
	let startPanY = 0;
	let containerElement: HTMLDivElement;
	let stageElement: HTMLDivElement;

	// Node dragging state
	let isDraggingNode = false;
	let draggedNodeId: string | null = null;
	let dragStartX = 0; // Mouse position when drag started (screen coords)
	let dragStartY = 0;
	let nodeStartDragX = 0; // Node's original X position when drag started (stage coords)
	let nodeStartDragY = 0; // Node's original Y position when drag started (stage coords)

	// Node resizing state
	let isResizingNode = false;
	let resizingNodeId: string | null = null;
	type ResizeHandleType = 'tl' | 't' | 'tr' | 'l' | 'r' | 'bl' | 'b' | 'br';
	let activeResizeHandle: ResizeHandleType | null = null;
	let resizeStartMouseX = 0; // Mouse position when resize started (screen coords)
	let resizeStartMouseY = 0;
	let nodeInitialX = 0; // Node's original state when resize started (stage coords)
	let nodeInitialY = 0;
	let nodeInitialWidth = 0;
	let nodeInitialHeight = 0;

	// Selection state
	let selectedNodeId: string | null = null;

	// --- Reactive Calculations ---
	// Calculate background size and position based on zoom and pan for the dynamic grid
	$: backgroundSize = gridSpacing * zoom;
	// Adjust background position to align with the stage's pan
	// We use modulo to keep the position values smaller and prevent potential precision issues
	$: backgroundPositionX = panX % backgroundSize;
	$: backgroundPositionY = panY % backgroundSize;
	$: stageStyle = `
      transform: translate(${panX}px, ${panY}px) scale(${zoom});
      transform-origin: 0 0;
      background-size: ${backgroundSize}px ${backgroundSize}px;
      background-position: ${backgroundPositionX}px ${backgroundPositionY}px;
    `;

	// --- Internal Logic ---

	function getMousePosition(event: MouseEvent | WheelEvent | PointerEvent): {
		x: number;
		y: number;
	} {
		if (!containerElement) return { x: 0, y: 0 }; // Should not happen in browser context
		const rect = containerElement.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
	}

	function screenToStageCoordinates(screenX: number, screenY: number): { x: number; y: number } {
		return {
			x: (screenX - panX) / zoom,
			y: (screenY - panY) / zoom
		};
	}

	function stageToScreenCoordinates(stageX: number, stageY: number): { x: number; y: number } {
		return {
			x: stageX * zoom + panX,
			y: stageY * zoom + panY
		};
	}

	export function getStageCoordinatesForScreenCenter(): { x: number; y: number } | null {
		if (!containerElement) {
			console.warn('Whiteboard.getStageCoordinatesForScreenCenter: containerElement not ready.');
			return null;
		}
		return screenToStageCoordinates(
			containerElement.clientWidth / 2,
			containerElement.clientHeight / 2
		);
	}

	// --- Event Handlers ---

	function handlePointerDown(event: PointerEvent) {
		const targetElement = event.target as HTMLElement;
		const nodeWrapper = targetElement.closest('.node-wrapper'); // Check if click is on a node
		const resizeHandle = targetElement.dataset.resizeHandle as ResizeHandleType;

		if (event.button !== 0) return; // Only handle left clicks

		if (
			resizeHandle &&
			nodeWrapper &&
			selectedNodeId === nodeWrapper.getAttribute('data-node-id')
		) {
			// --- Node Resize Start ---
			event.stopPropagation(); // Prevent whiteboard panning/node dragging

			const nodeId = nodeWrapper.getAttribute('data-node-id');
			if (!nodeId) return;
			const node = nodes.find((n) => n.id === nodeId);
			if (!node) return;

			isResizingNode = true;
			resizingNodeId = nodeId;
			activeResizeHandle = resizeHandle;

			resizeStartMouseX = event.clientX;
			resizeStartMouseY = event.clientY;
			nodeInitialX = node.x;
			nodeInitialY = node.y;
			nodeInitialWidth = node.width;
			nodeInitialHeight = node.height;

			containerElement.style.userSelect = 'none';
			containerElement.setPointerCapture(event.pointerId);
			// Cursor will be set by CSS on the handle
			// containerElement.style.cursor = getComputedStyle(targetElement).cursor || 'default';
		} else if (nodeWrapper) {
			// --- Node Drag Start ---
			event.stopPropagation(); // Prevent whiteboard panning when starting node drag

			const nodeId = nodeWrapper.getAttribute('data-node-id');
			if (!nodeId) return;

			const node = nodes.find((n) => n.id === nodeId);
			if (!node) return;

			isDraggingNode = true;
			draggedNodeId = nodeId;
			selectedNodeId = nodeId; // Select the node being dragged

			// Store initial positions
			dragStartX = event.clientX;
			dragStartY = event.clientY;
			nodeStartDragX = node.x;
			nodeStartDragY = node.y;

			// Prevent text selection during drag
			containerElement.style.userSelect = 'none';
			containerElement.setPointerCapture(event.pointerId); // Capture pointer events
			containerElement.style.cursor = 'grabbing'; // Indicate dragging node
		} else if (targetElement === containerElement || targetElement === stageElement) {
			// --- Whiteboard Pan Start ---
			isPanning = true;
			startPanX = event.clientX - panX; // Store initial offset relative to pan
			startPanY = event.clientY - panY;
			selectedNodeId = null; // Deselect nodes when clicking background

			containerElement.setPointerCapture(event.pointerId);
			containerElement.style.cursor = 'grabbing';
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (!event.isPrimary) return; // Ignore multi-touch/pen secondary pointers for simplicity

		if (isResizingNode && resizingNodeId && activeResizeHandle) {
			// --- Node Resize Move ---
			event.preventDefault();

			const dxScreen = event.clientX - resizeStartMouseX;
			const dyScreen = event.clientY - resizeStartMouseY;

			const dxStage = dxScreen / zoom;
			const dyStage = dyScreen / zoom;

			let newX = nodeInitialX;
			let newY = nodeInitialY;
			let newWidth = nodeInitialWidth;
			let newHeight = nodeInitialHeight;

			// Apply changes based on handle type
			if (activeResizeHandle.includes('l')) {
				newWidth = Math.max(MIN_NODE_WIDTH, nodeInitialWidth - dxStage);
				newX = nodeInitialX + nodeInitialWidth - newWidth;
			} else if (activeResizeHandle.includes('r')) {
				newWidth = Math.max(MIN_NODE_WIDTH, nodeInitialWidth + dxStage);
			}

			if (activeResizeHandle.includes('t')) {
				newHeight = Math.max(MIN_NODE_HEIGHT, nodeInitialHeight - dyStage);
				newY = nodeInitialY + nodeInitialHeight - newHeight;
			} else if (activeResizeHandle.includes('b')) {
				newHeight = Math.max(MIN_NODE_HEIGHT, nodeInitialHeight + dyStage);
			}

			// For middle handles (t, b, l, r), only one dimension changes
			if (activeResizeHandle === 't' || activeResizeHandle === 'b') {
				newWidth = nodeInitialWidth; // Keep width constant
				newX = nodeInitialX;
			}
			if (activeResizeHandle === 'l' || activeResizeHandle === 'r') {
				newHeight = nodeInitialHeight; // Keep height constant
				newY = nodeInitialY;
			}

			nodes = nodes.map((n) =>
				n.id === resizingNodeId ? { ...n, x: newX, y: newY, width: newWidth, height: newHeight } : n
			);
		} else if (isDraggingNode && draggedNodeId) {
			// --- Node Drag Move ---
			event.preventDefault(); // Prevent default behaviors like text selection/image dragging

			// Calculate mouse delta in screen coordinates
			const dxScreen = event.clientX - dragStartX;
			const dyScreen = event.clientY - dragStartY;

			// Convert screen delta to stage delta (scaled)
			const dxStage = dxScreen / zoom;
			const dyStage = dyScreen / zoom;

			// Calculate new node position in stage coordinates
			const newX = nodeStartDragX + dxStage;
			const newY = nodeStartDragY + dyStage;

			// Update the specific node's position (immutable update for reactivity)
			nodes = nodes.map((n) => (n.id === draggedNodeId ? { ...n, x: newX, y: newY } : n));
		} else if (isPanning) {
			// --- Whiteboard Pan Move ---
			event.preventDefault();
			// Calculate new pan based on current mouse position and initial offset
			panX = event.clientX - startPanX;
			panY = event.clientY - startPanY;
		}
	}

	function handlePointerUp(event: PointerEvent) {
		if (event.button !== 0) return; // Only handle left releases

		if (isResizingNode) {
			containerElement.releasePointerCapture(event.pointerId);
			isResizingNode = false;
			resizingNodeId = null;
			activeResizeHandle = null;
			tick().then(() => {
				if (containerElement) {
					containerElement.style.userSelect = '';
				}
			});
		} else if (isDraggingNode) {
			containerElement.releasePointerCapture(event.pointerId);
			isDraggingNode = false;
			draggedNodeId = null;
			// Important: Reset userSelect *after* potential click events might fire
			// Using tick() ensures styles are reset after the current event loop cycle
			tick().then(() => {
				if (containerElement) {
					// Check if component is still mounted
					containerElement.style.userSelect = '';
				}
			});
		} else if (isPanning) {
			containerElement.releasePointerCapture(event.pointerId);
			isPanning = false;
		}

		// Reset cursor regardless of what was happening
		if (containerElement) {
			// Reset cursor to grab unless hovering over a specific interactive element
			// For simplicity, always set to grab. CSS will override for handles.
			containerElement.style.cursor = 'grab';
		}
	}

	function handlePointerLeave(event: PointerEvent) {
		// If pointer leaves the container while dragging/panning/resizing, treat it like pointerUp
		if (isDraggingNode || isPanning || isResizingNode) {
			handlePointerUp(event);
		}
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		const { x: mouseX, y: mouseY } = getMousePosition(event);

		const delta = -event.deltaY * zoomSensitivity;
		const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * (1 + delta)));

		// Calculate mouse position in stage coordinates *before* zoom
		const stageMouseX = (mouseX - panX) / zoom;
		const stageMouseY = (mouseY - panY) / zoom;

		// Calculate the new pan values needed to keep the stage point under the mouse
		const newPanX = mouseX - stageMouseX * newZoom;
		const newPanY = mouseY - stageMouseY * newZoom;

		zoom = newZoom;
		panX = newPanX;
		panY = newPanY;
	}

	onMount(() => {
		if (browser) {
			if (containerElement) {
				containerElement.style.cursor = 'grab';
				// Add pointer event listeners to the container
				containerElement.addEventListener('pointerdown', handlePointerDown);
				containerElement.addEventListener('pointermove', handlePointerMove);
				containerElement.addEventListener('pointerup', handlePointerUp);
				containerElement.addEventListener('pointerleave', handlePointerLeave); // Handle leaving the area
				// Wheel event is already attached via Svelte's on:wheel
			}
		}
	});

	onDestroy(() => {
		if (browser && containerElement) {
			// Clean up listeners attached directly
			containerElement.removeEventListener('pointerdown', handlePointerDown);
			containerElement.removeEventListener('pointermove', handlePointerMove);
			containerElement.removeEventListener('pointerup', handlePointerUp);
			containerElement.removeEventListener('pointerleave', handlePointerLeave);
		}
	});

	// --- Public Methods (API) ---

	export function addNode(
		type: 'image' | 'text',
		x: number,
		y: number,
		props: Record<string, any> = {}
	): NodeData {
		let component: ComponentType<SvelteComponent>;
		switch (type) {
			case 'image':
				component = ImageNode as unknown as ComponentType<SvelteComponent>;
				break;
			case 'text':
				component = TextNode as unknown as ComponentType<SvelteComponent>;
				break;
			default:
				console.error(`Unknown node type: ${type}`);
				// @ts-expect-error Return undefined or handle error appropriately
				return;
		}
		const newNode: NodeData = {
			id: crypto.randomUUID(),
			component,
			x, // Stage coordinates
			y, // Stage coordinates
			width: typeof props.width === 'number' ? props.width : DEFAULT_NODE_WIDTH,
			height: typeof props.height === 'number' ? props.height : DEFAULT_NODE_HEIGHT,
			props
		};

		nodes = [...nodes, newNode];
		return newNode;
	}

	export function panBy(dx: number, dy: number): void {
		panX += dx;
		panY += dy;
	}

	export function panTo(targetX: number, targetY: number): void {
		if (!containerElement) return;
		const containerWidth = containerElement.clientWidth;
		const containerHeight = containerElement.clientHeight;
		// Center the target stage coordinates in the view
		panX = containerWidth / 2 - targetX * zoom;
		panY = containerHeight / 2 - targetY * zoom;
	}

	export function setZoom(newZoomLevel: number, centerX?: number, centerY?: number): void {
		const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoomLevel));
		// If center point (in stage coords) is provided, zoom around it
		if (centerX !== undefined && centerY !== undefined && containerElement) {
			// Convert stage center to screen center
			const screenCenterX = centerX * zoom + panX;
			const screenCenterY = centerY * zoom + panY;
			// Calculate new pan to keep the stage point under the screen point
			panX = screenCenterX - centerX * clampedZoom;
			panY = screenCenterY - centerY * clampedZoom;
		} else if (centerX !== undefined || centerY !== undefined) {
			console.warn(
				'setZoom requires both centerX and centerY (in stage coordinates) to center the zoom.'
			);
		} else {
			// Optional: Zoom towards center of the screen if no center provided
			if (containerElement) {
				const containerWidth = containerElement.clientWidth;
				const containerHeight = containerElement.clientHeight;
				const screenCenterX = containerWidth / 2;
				const screenCenterY = containerHeight / 2;

				const stageCenterX = (screenCenterX - panX) / zoom;
				const stageCenterY = (screenCenterY - panY) / zoom;

				panX = screenCenterX - stageCenterX * clampedZoom;
				panY = screenCenterY - stageCenterY * clampedZoom;
			}
		}
		zoom = clampedZoom;
	}

	export function getViewport(): { panX: number; panY: number; zoom: number } {
		return { panX, panY, zoom };
	}

	export function getSelectedNodeId(): string | null {
		return selectedNodeId;
	}

	export function setSelectedNodeId(id: string | null): void {
		selectedNodeId = id;
	}

	const resizeHandles: ResizeHandleType[] = ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'];
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="whiteboard-container"
	bind:this={containerElement}
	on:wheel|preventDefault={handleWheel}
	role="application"
	aria-roledescription="interactive whiteboard"
	tabindex="0"
>
	<div class="whiteboard-stage" bind:this={stageElement} style={stageStyle}>
		{#each nodes as node (node.id)}
			<div
				class="node-wrapper"
				class:selected={node.id === selectedNodeId}
				data-node-id={node.id}
				style:left="{node.x}px"
				style:top="{node.y}px"
				style:width="{node.width}px"
				style:height="{node.height}px"
				style:position="absolute"
				style:cursor={isDraggingNode && draggedNodeId === node.id ? 'grabbing' : 'grab'}
			>
				<!-- Pass down selection state if the node component needs it -->
				<svelte:component
					this={node.component}
					isSelected={node.id === selectedNodeId}
					nodeId={node.id}
					{...node.props}
				/>
				{#if node.id === selectedNodeId}
					{#each resizeHandles as handle}
						<div
							class="resize-handle resize-handle-{handle}"
							data-resize-handle={handle}
							aria-label="Resize node {handle
								.replace('t', 'top ')
								.replace('b', 'bottom ')
								.replace('l', 'left ')
								.replace('r', 'right ')
								.trim()}"
						></div>
					{/each}
				{/if}
			</div>
		{/each}
	</div>
	<!-- Optional UI elements -->
</div>

<style>
	.whiteboard-container {
		width: 100%;
		height: 100%;
		overflow: hidden;
		position: relative;
		background-color: #f8f9fa; /* Lighter background */
		touch-action: none; /* Prevent browser default touch actions like scroll/zoom */
		/* cursor: grab; Set dynamically */
	}

	.whiteboard-stage {
		position: absolute;
		/* transform-origin: 0 0; Set in style attribute */
		will-change: transform, background-position; /* Performance hint */
		/* Dynamic Grid Background */
		background-image:
			linear-gradient(to right, #e9ecef 1px, transparent 1px),
			/* Grid line color */ linear-gradient(to bottom, #e9ecef 1px, transparent 1px);
		/* background-size and background-position are set dynamically via style attribute */
	}

	.node-wrapper {
		/* Base node wrapper styles */
		/* Add transition for smoother selection outline appearance/disappearance */
		transition:
			outline-color 0.15s ease-in-out,
			outline-width 0.15s ease-in-out;
		outline: 2px solid transparent; /* Reserve space for outline */
		outline-offset: 3px;
		z-index: 1; /* Base z-index */
		display: flex; /* To help svelte:component fill the space */
		flex-direction: column; /* If svelte:component needs to stack things */
	}

	.node-wrapper.selected {
		outline-color: #007bff; /* Selection outline color */
		z-index: 10; /* Bring selected node to front */
	}

	/* Selectively re-enable text selection for specific elements *inside* node components
       if needed (e.g., for a contenteditable div in TextNode.svelte) */
	.node-wrapper :global(input),
	.node-wrapper :global(textarea),
	.node-wrapper :global([contenteditable='true']),
	.node-wrapper :global([contenteditable='']) {
		user-select: text; /* Allow text selection for inputs/editable areas */
		/* Ensure these elements can still be focused and interacted with */
		cursor: text;
	}

	.resize-handle {
		position: absolute;
		width: 10px;
		height: 10px;
		background-color: #007bff;
		border: 1px solid white;
		box-sizing: border-box;
		z-index: 11; /* Above node content but below other selected nodes perhaps */
	}

	.resize-handle-tl {
		top: -5px;
		left: -5px;
		cursor: nwse-resize;
	}
	.resize-handle-t {
		top: -5px;
		left: 50%;
		transform: translateX(-50%);
		cursor: ns-resize;
	}
	.resize-handle-tr {
		top: -5px;
		right: -5px;
		cursor: nesw-resize;
	}
	.resize-handle-l {
		top: 50%;
		left: -5px;
		transform: translateY(-50%);
		cursor: ew-resize;
	}
	.resize-handle-r {
		top: 50%;
		right: -5px;
		transform: translateY(-50%);
		cursor: ew-resize;
	}
	.resize-handle-bl {
		bottom: -5px;
		left: -5px;
		cursor: nesw-resize;
	}
	.resize-handle-b {
		bottom: -5px;
		left: 50%;
		transform: translateX(-50%);
		cursor: ns-resize;
	}
	.resize-handle-br {
		bottom: -5px;
		right: -5px;
		cursor: nwse-resize;
	}

	.whiteboard-container:focus {
		outline: 2px solid blue;
		outline-offset: 2px;
	}
	.whiteboard-container:focus:not(:focus-visible) {
		outline: none;
	}
	.whiteboard-container:focus-visible {
		outline: 2px solid blue;
		outline-offset: 2px;
	}
</style>
