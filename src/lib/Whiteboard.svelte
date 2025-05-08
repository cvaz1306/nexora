<script context="module" lang="ts">
	import type { ComponentType, SvelteComponent } from 'svelte';

	export type NodeData = {
		id: string;
		showId: boolean;
		component: ComponentType<SvelteComponent>;
		x: number;
		y: number;
		props: Record<string, any>;
		width: number;
		height: number;
	};
</script>

<script lang="ts">
	export let nodes: NodeData[] = [];
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';

	import ImageNode from './ImageNode.svelte';
	import TextNode from './TextNode.svelte';

	export let minZoom = 0.1;
	export let maxZoom = 5.0;
	export let zoomSensitivity = 0.002;
	export let gridSpacing = 20;

	const DEFAULT_NODE_WIDTH = 200;
	const DEFAULT_NODE_HEIGHT = 150;
	const MIN_NODE_WIDTH = 30;
	const MIN_NODE_HEIGHT = 30;
	let SNAP_THRESHOLD_STAGE = 8;
	
	let panX = 0;
	let panY = 0;
	
	let pointerVelX = 0;
	let pointerVelY = 0;
	// $: SNAP_THRESHOLD_STAGE = 8 / (Math.sqrt(pointerVelX * pointerVelX + pointerVelY * pointerVelY)/3); // Snap sensitivity in stage units (increased slightly)

	let zoom = 1;
	let isPanning = false;
	let startPanX = 0;
	let startPanY = 0;
	let containerElement: HTMLDivElement;
	let stageElement: HTMLDivElement;

	let isDraggingNode = false;
	let draggedNodeId: string | null = null;
	let dragStartX = 0;
	let dragStartY = 0;
	let nodeStartDragX = 0;
	let nodeStartDragY = 0;

	let isResizingNode = false;
	let resizingNodeId: string | null = null;
	type ResizeHandleType = 'tl' | 't' | 'tr' | 'l' | 'r' | 'bl' | 'b' | 'br';
	let activeResizeHandle: ResizeHandleType | null = null;
	let resizeStartMouseX = 0;
	let resizeStartMouseY = 0;
	let nodeInitialX = 0;
	let nodeInitialY = 0;
	let nodeInitialWidth = 0;
	let nodeInitialHeight = 0;

	let selectedNodeId: string | null = null;

	let activeSnapLines: Array<{
		type: 'h' | 'v';
		stageValue: number;
		start: number;
		end: number;
	}> = [];

	$: backgroundSize = gridSpacing * zoom;
	$: backgroundPositionX = panX % backgroundSize;
	$: backgroundPositionY = panY % backgroundSize;
	$: stageStyle = `
      transform: translate(${panX}px, ${panY}px) scale(${zoom});
      transform-origin: 0 0;
      background-size: ${backgroundSize}px ${backgroundSize}px;
      background-position: ${backgroundPositionX}px ${backgroundPositionY}px;
    `;

	function getMousePosition(event: MouseEvent | WheelEvent | PointerEvent): { x: number; y: number; } {
		if (!containerElement) return { x: 0, y: 0 };
		const rect = containerElement.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function screenToStageCoordinates(screenX: number, screenY: number): { x: number; y: number } {
		return { x: (screenX - panX) / zoom, y: (screenY - panY) / zoom };
	}

	export function getStageCoordinatesForScreenCenter(): { x: number; y: number } | null {
		if (!containerElement) return null;
		return screenToStageCoordinates(containerElement.clientWidth / 2, containerElement.clientHeight / 2);
	}

	// --- Snapping Logic ---
	function calculateAndApplySnapsForDrag(
		activeNodeId: string,
		tentativeX: number, // The node's desired X based on mouse movement
		tentativeY: number  // The node's desired Y based on mouse movement
	): { newX: number; newY: number } {
		const activeNode = nodes.find(n => n.id === activeNodeId);
		if (!activeNode) return { newX: tentativeX, newY: tentativeY };

		activeSnapLines = []; // Clear previous lines for this move calculation
		let finalX = tentativeX;
		let finalY = tentativeY;

		// --- X-Axis Snapping ---
		let bestDeltaX = SNAP_THRESHOLD_STAGE;
		let xSnapTargetStaticEdgeValue: number | null = null; // The X value of the static edge we snap to
		let xSnapActiveNodeOriginalOffset = 0; // Offset of the active node's snapping edge from its own tentativeX
		let xSnapSourceStaticNode: NodeData | null = null;

		// Define edges of the active node based on its tentative position
		const activeNodePointsX = [
			{ currentVal: tentativeX, originalOffset: 0 }, // Left edge
			{ currentVal: tentativeX + activeNode.width / 2, originalOffset: -activeNode.width / 2 }, // Center X
			{ currentVal: tentativeX + activeNode.width, originalOffset: -activeNode.width }  // Right edge
		];

		for (const staticNode of nodes) {
			if (staticNode.id === activeNodeId) continue;
			const staticNodePointsX = [staticNode.x, staticNode.x + staticNode.width / 2, staticNode.x + staticNode.width];

			for (const activeP of activeNodePointsX) {
				for (const staticP of staticNodePointsX) {
					const delta = Math.abs(activeP.currentVal - staticP);
					if (delta < bestDeltaX) {
						bestDeltaX = delta;
						xSnapTargetStaticEdgeValue = staticP;
						xSnapActiveNodeOriginalOffset = activeP.originalOffset;
						xSnapSourceStaticNode = staticNode;
					}
				}
			}
		}

		if (xSnapTargetStaticEdgeValue !== null) {
			finalX = xSnapTargetStaticEdgeValue + xSnapActiveNodeOriginalOffset;
		}

		// --- Y-Axis Snapping ---
		let bestDeltaY = SNAP_THRESHOLD_STAGE;
		let ySnapTargetStaticEdgeValue: number | null = null;
		let ySnapActiveNodeOriginalOffset = 0;
		let ySnapSourceStaticNode: NodeData | null = null;

		const activeNodePointsY = [
			{ currentVal: tentativeY, originalOffset: 0 }, // Top edge
			{ currentVal: tentativeY + activeNode.height / 2, originalOffset: -activeNode.height / 2 }, // Center Y
			{ currentVal: tentativeY + activeNode.height, originalOffset: -activeNode.height } // Bottom edge
		];

		for (const staticNode of nodes) {
			if (staticNode.id === activeNodeId) continue;
			const staticNodePointsY = [staticNode.y, staticNode.y + staticNode.height / 2, staticNode.y + staticNode.height];

			for (const activeP of activeNodePointsY) {
				for (const staticP of staticNodePointsY) {
					const delta = Math.abs(activeP.currentVal - staticP);
					if (delta < bestDeltaY) {
						bestDeltaY = delta;
						ySnapTargetStaticEdgeValue = staticP;
						ySnapActiveNodeOriginalOffset = activeP.originalOffset;
						ySnapSourceStaticNode = staticNode;
					}
				}
			}
		}
		
		if (ySnapTargetStaticEdgeValue !== null) {
			finalY = ySnapTargetStaticEdgeValue + ySnapActiveNodeOriginalOffset;
		}

		// --- Generate Snap Lines (after finalX and finalY are determined) ---
		if (xSnapTargetStaticEdgeValue !== null && xSnapSourceStaticNode) {
			activeSnapLines.push({
				type: 'v',
				stageValue: xSnapTargetStaticEdgeValue, // Line is AT the static node's edge
				start: Math.min(finalY, xSnapSourceStaticNode.y, finalY + activeNode.height, xSnapSourceStaticNode.y + xSnapSourceStaticNode.height),
				end: Math.max(finalY, xSnapSourceStaticNode.y, finalY + activeNode.height, xSnapSourceStaticNode.y + xSnapSourceStaticNode.height),
			});
		}
		if (ySnapTargetStaticEdgeValue !== null && ySnapSourceStaticNode) {
			// If an X snap also occurred, its line's vertical extent might need adjustment based on finalY.
			// This is implicitly handled if line generation happens after both finalX/finalY are set.
			activeSnapLines.push({
				type: 'h',
				stageValue: ySnapTargetStaticEdgeValue, // Line is AT the static node's edge
				start: Math.min(finalX, ySnapSourceStaticNode.x, finalX + activeNode.width, ySnapSourceStaticNode.x + ySnapSourceStaticNode.width),
				end: Math.max(finalX, ySnapSourceStaticNode.x, finalX + activeNode.width, ySnapSourceStaticNode.x + ySnapSourceStaticNode.width),
			});
		}
		return { newX: finalX, newY: finalY };
	}

	function calculateAndApplySnapsForResize(
		activeNodeId: string,
		tentative: { x: number; y: number; width: number; height: number }, // Tentative geometry from mouse
		handle: ResizeHandleType
	): { newX: number; newY: number; newWidth: number; newHeight: number } {
		activeSnapLines = []; // Clear previous lines for this move calculation
		let res = { ...tentative }; // Start with the mouse-driven geometry
		const staticNodes = nodes.filter(n => n.id !== activeNodeId);

		// --- X-Axis Snapping (for left/right handles) ---
		let bestDeltaX = SNAP_THRESHOLD_STAGE;
		let xSnapTargetStaticEdgeValue: number | null = null; // The X value of the static edge to snap to
		let xSnapSourceStaticNode: NodeData | null = null;

		let activeMovingEdgeX: number | null = null; // The current X value of the edge being resized
		if (handle.includes('l')) activeMovingEdgeX = res.x;
		else if (handle.includes('r')) activeMovingEdgeX = res.x + res.width;

		if (activeMovingEdgeX !== null) {
			for (const staticNode of staticNodes) {
				const staticNodePointsX = [staticNode.x, staticNode.x + staticNode.width / 2, staticNode.x + staticNode.width];
				for (const staticEdge of staticNodePointsX) {
					const delta = Math.abs(activeMovingEdgeX - staticEdge);
					if (delta < bestDeltaX) {
						bestDeltaX = delta;
						xSnapTargetStaticEdgeValue = staticEdge;
						xSnapSourceStaticNode = staticNode;
					}
				}
			}
		}

		if (xSnapTargetStaticEdgeValue !== null) {
			if (handle.includes('l')) {
				const newX = xSnapTargetStaticEdgeValue;
				const newWidth = (res.x + res.width) - newX; // Original right edge - new left edge
				if (newWidth >= MIN_NODE_WIDTH) {
					res.x = newX;
					res.width = newWidth;
				} else { xSnapTargetStaticEdgeValue = null; } // Cannot snap, would make node too small
			} else if (handle.includes('r')) {
				const newWidth = xSnapTargetStaticEdgeValue - res.x; // New right edge - current left edge
				if (newWidth >= MIN_NODE_WIDTH) {
					res.width = newWidth;
				} else { xSnapTargetStaticEdgeValue = null; }
			}
		}

		// --- Y-Axis Snapping (for top/bottom handles) ---
		let bestDeltaY = SNAP_THRESHOLD_STAGE;
		let ySnapTargetStaticEdgeValue: number | null = null;
		let ySnapSourceStaticNode: NodeData | null = null;

		let activeMovingEdgeY: number | null = null;
		if (handle.includes('t')) activeMovingEdgeY = res.y;
		else if (handle.includes('b')) activeMovingEdgeY = res.y + res.height;

		if (activeMovingEdgeY !== null) {
			for (const staticNode of staticNodes) {
				const staticNodePointsY = [staticNode.y, staticNode.y + staticNode.height / 2, staticNode.y + staticNode.height];
				for (const staticEdge of staticNodePointsY) {
					const delta = Math.abs(activeMovingEdgeY - staticEdge);
					if (delta < bestDeltaY) {
						bestDeltaY = delta;
						ySnapTargetStaticEdgeValue = staticEdge;
						ySnapSourceStaticNode = staticNode;
					}
				}
			}
		}

		if (ySnapTargetStaticEdgeValue !== null) {
			if (handle.includes('t')) {
				const newY = ySnapTargetStaticEdgeValue;
				const newHeight = (res.y + res.height) - newY; // Original bottom edge - new top edge
				if (newHeight >= MIN_NODE_HEIGHT) {
					res.y = newY;
					res.height = newHeight;
				} else { ySnapTargetStaticEdgeValue = null; }
			} else if (handle.includes('b')) {
				const newHeight = ySnapTargetStaticEdgeValue - res.y; // New bottom edge - current top edge
				if (newHeight >= MIN_NODE_HEIGHT) {
					res.height = newHeight;
				} else { ySnapTargetStaticEdgeValue = null; }
			}
		}
		
		// --- Generate Snap Lines (after res.x, res.y, res.width, res.height are potentially snapped) ---
		if (xSnapTargetStaticEdgeValue !== null && xSnapSourceStaticNode) {
			activeSnapLines.push({
				type: 'v', stageValue: xSnapTargetStaticEdgeValue,
				start: Math.min(res.y, xSnapSourceStaticNode.y, res.y + res.height, xSnapSourceStaticNode.y + xSnapSourceStaticNode.height),
				end: Math.max(res.y, xSnapSourceStaticNode.y, res.y + res.height, xSnapSourceStaticNode.y + xSnapSourceStaticNode.height)
			});
		}
		if (ySnapTargetStaticEdgeValue !== null && ySnapSourceStaticNode) {
			activeSnapLines.push({
				type: 'h', stageValue: ySnapTargetStaticEdgeValue,
				start: Math.min(res.x, ySnapSourceStaticNode.x, res.x + res.width, ySnapSourceStaticNode.x + ySnapSourceStaticNode.width),
				end: Math.max(res.x, ySnapSourceStaticNode.x, res.x + res.width, ySnapSourceStaticNode.x + ySnapSourceStaticNode.width)
			});
		}
		return res;
	}

	function handlePointerDown(event: PointerEvent) {
		const targetElement = event.target as HTMLElement;
		const nodeWrapper = targetElement.closest('.node-wrapper');
		const resizeHandle = targetElement.dataset.resizeHandle as ResizeHandleType;

		activeSnapLines = []; // Clear snap lines on any new interaction start

		if (event.button !== 0) return;

		if (resizeHandle && nodeWrapper && selectedNodeId === nodeWrapper.getAttribute('data-node-id')) {
			event.stopPropagation();
			const nodeId = nodeWrapper.getAttribute('data-node-id');
			if (!nodeId) return;
			const node = nodes.find((n) => n.id === nodeId);
			if (!node) return;

			isResizingNode = true;
			resizingNodeId = nodeId;
			activeResizeHandle = resizeHandle;
			resizeStartMouseX = event.clientX;
			resizeStartMouseY = event.clientY;
			nodeInitialX = node.x; // Store initial state of the node AT THE START of resize
			nodeInitialY = node.y;
			nodeInitialWidth = node.width;
			nodeInitialHeight = node.height;
			containerElement.style.userSelect = 'none';
			containerElement.setPointerCapture(event.pointerId);
		} else if (nodeWrapper) {
			event.stopPropagation();
			const nodeId = nodeWrapper.getAttribute('data-node-id');
			if (!nodeId) return;
			const node = nodes.find((n) => n.id === nodeId);
			if (!node) return;

			isDraggingNode = true;
			draggedNodeId = nodeId;
			selectedNodeId = nodeId;
			dragStartX = event.clientX; // Mouse position when drag started
			dragStartY = event.clientY;
			nodeStartDragX = node.x;   // Node's original X position when drag started
			nodeStartDragY = node.y;   // Node's original Y position when drag started
			containerElement.style.userSelect = 'none';
			containerElement.setPointerCapture(event.pointerId);
			containerElement.style.cursor = 'grabbing';
		} else if (targetElement === containerElement || targetElement === stageElement) {
			isPanning = true;
			startPanX = event.clientX - panX;
			startPanY = event.clientY - panY;
			selectedNodeId = null;
			containerElement.setPointerCapture(event.pointerId);
			containerElement.style.cursor = 'grabbing';
		}
	}

	function handlePointerMove(event: PointerEvent) {
		pointerVelX = event.movementX;
		pointerVelY = event.movementY;
		if (!event.isPrimary) return;

		if (isResizingNode && resizingNodeId && activeResizeHandle) {
			event.preventDefault();
			const dxScreen = event.clientX - resizeStartMouseX;
			const dyScreen = event.clientY - resizeStartMouseY;
			const dxStage = dxScreen / zoom; // Delta mouse movement in stage units
			const dyStage = dyScreen / zoom;

			// Calculate TENTATIVE new geometry based on initial state + mouse delta
			// These are the values BEFORE snapping is applied for this frame
			let tentativeX = nodeInitialX;
			let tentativeY = nodeInitialY;
			let tentativeWidth = nodeInitialWidth;
			let tentativeHeight = nodeInitialHeight;

			if (activeResizeHandle.includes('l')) {
				tentativeWidth = Math.max(MIN_NODE_WIDTH, nodeInitialWidth - dxStage);
				tentativeX = nodeInitialX + nodeInitialWidth - tentativeWidth; // Adjust X to keep right edge stationary
			} else if (activeResizeHandle.includes('r')) {
				tentativeWidth = Math.max(MIN_NODE_WIDTH, nodeInitialWidth + dxStage);
			}
			if (activeResizeHandle.includes('t')) {
				tentativeHeight = Math.max(MIN_NODE_HEIGHT, nodeInitialHeight - dyStage);
				tentativeY = nodeInitialY + nodeInitialHeight - tentativeHeight; // Adjust Y to keep bottom edge stationary
			} else if (activeResizeHandle.includes('b')) {
				tentativeHeight = Math.max(MIN_NODE_HEIGHT, nodeInitialHeight + dyStage);
			}
			// For middle handles, one dimension/position is preserved from nodeInitial
			if (activeResizeHandle === 't' || activeResizeHandle === 'b') {
				tentativeWidth = nodeInitialWidth; tentativeX = nodeInitialX;
			}
			if (activeResizeHandle === 'l' || activeResizeHandle === 'r') {
				tentativeHeight = nodeInitialHeight; tentativeY = nodeInitialY;
			}
			
			const snappedGeom = calculateAndApplySnapsForResize(
                resizingNodeId,
                { x: tentativeX, y: tentativeY, width: tentativeWidth, height: tentativeHeight },
                activeResizeHandle
            );

			nodes = nodes.map((n) =>
				n.id === resizingNodeId ? { ...n, ...snappedGeom } : n
			);
		} else if (isDraggingNode && draggedNodeId) {
			event.preventDefault();
			const dxScreen = event.clientX - dragStartX;
			const dyScreen = event.clientY - dragStartY;
			const dxStage = dxScreen / zoom;
			const dyStage = dyScreen / zoom;

			// Calculate TENTATIVE new position based on original start + total mouse delta
			let tentativeNewX = nodeStartDragX + dxStage;
			let tentativeNewY = nodeStartDragY + dyStage;

			const { newX: snappedX, newY: snappedY } = calculateAndApplySnapsForDrag(
                draggedNodeId,
                tentativeNewX,
                tentativeNewY
            );
            
			nodes = nodes.map((n) => (n.id === draggedNodeId ? { ...n, x: snappedX, y: snappedY } : n));
		} else if (isPanning) {
			event.preventDefault();
			panX = event.clientX - startPanX;
			panY = event.clientY - startPanY;
		}
	}

	function handlePointerUp(event: PointerEvent) {
		if (event.button !== 0) return;
		activeSnapLines = []; // Clear lines on pointer up, regardless of action

		if (isResizingNode) {
			containerElement.releasePointerCapture(event.pointerId);
			isResizingNode = false;
			resizingNodeId = null;
			activeResizeHandle = null;
			tick().then(() => { if (containerElement) containerElement.style.userSelect = ''; });
		} else if (isDraggingNode) {
			containerElement.releasePointerCapture(event.pointerId);
			isDraggingNode = false;
			draggedNodeId = null;
			tick().then(() => { if (containerElement) containerElement.style.userSelect = ''; });
		} else if (isPanning) {
			containerElement.releasePointerCapture(event.pointerId);
			isPanning = false;
		}
		if (containerElement) containerElement.style.cursor = 'grab';
	}

	function handlePointerLeave(event: PointerEvent) {
		if (isDraggingNode || isPanning || isResizingNode) {
			handlePointerUp(event); // Treat as pointer up to release states and clear lines
		}
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		activeSnapLines = []; // Clear snap lines if zooming occurs
		const { x: mouseX, y: mouseY } = getMousePosition(event);
		const delta = -event.deltaY * zoomSensitivity;
		const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * (1 + delta)));
		const stageMouseX = (mouseX - panX) / zoom;
		const stageMouseY = (mouseY - panY) / zoom;
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
				containerElement.addEventListener('pointerdown', handlePointerDown);
				containerElement.addEventListener('pointermove', handlePointerMove);
				containerElement.addEventListener('pointerup', handlePointerUp);
				containerElement.addEventListener('pointerleave', handlePointerLeave);
			}
		}
	});

	onDestroy(() => {
		if (browser && containerElement) {
			containerElement.removeEventListener('pointerdown', handlePointerDown);
			containerElement.removeEventListener('pointermove', handlePointerMove);
			containerElement.removeEventListener('pointerup', handlePointerUp);
			containerElement.removeEventListener('pointerleave', handlePointerLeave);
		}
	});

	export function addNode(
		type: 'image' | 'text',
		x: number,
		y: number,
		props: Record<string, any> = {}
	): NodeData {
		let component: ComponentType<SvelteComponent>;
		let defaultWidth = DEFAULT_NODE_WIDTH;
		let defaultHeight = DEFAULT_NODE_HEIGHT;

		switch (type) {
			case 'image': component = ImageNode as unknown as ComponentType<SvelteComponent>; break;
			case 'text': component = TextNode as unknown as ComponentType<SvelteComponent>; break;
			default: console.error(`Unknown node type: ${type}`); // @ts-expect-error
				return;
		}
		const newNode: NodeData = {
			id: crypto.randomUUID(),
			component, x, y,
			width: typeof props.width === 'number' ? props.width : defaultWidth,
			height: typeof props.height === 'number' ? props.height : defaultHeight,
			showId: props.showId ?? (nodes[0]?.showId ?? false),
			props
		};
		nodes = [...nodes, newNode];
		return newNode;
	}

	export function panBy(dx: number, dy: number): void { panX += dx; panY += dy; }
	export function panTo(targetX: number, targetY: number): void {
		if (!containerElement) return;
		panX = containerElement.clientWidth / 2 - targetX * zoom;
		panY = containerElement.clientHeight / 2 - targetY * zoom;
	}
	export function setZoom(newZoomLevel: number, centerX?: number, centerY?: number): void {
		const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoomLevel));
		if (centerX !== undefined && centerY !== undefined && containerElement) {
			const screenCenterX = centerX * zoom + panX;
			const screenCenterY = centerY * zoom + panY;
			panX = screenCenterX - centerX * clampedZoom;
			panY = screenCenterY - centerY * clampedZoom;
		} else if (containerElement) {
			const screenCenterX = containerElement.clientWidth / 2;
			const screenCenterY = containerElement.clientHeight / 2;
			const stageCenterX = (screenCenterX - panX) / zoom;
			const stageCenterY = (screenCenterY - panY) / zoom;
			panX = screenCenterX - stageCenterX * clampedZoom;
			panY = screenCenterY - stageCenterY * clampedZoom;
		}
		zoom = clampedZoom;
	}
	export function getViewport(): { panX: number; panY: number; zoom: number } { return { panX, panY, zoom }; }
	export function getSelectedNodeId(): string | null { return selectedNodeId; }
	export function setSelectedNodeId(id: string | null): void { selectedNodeId = id; }

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
				<svelte:component
					this={node.component}
					isSelected={node.id === selectedNodeId}
					id={node.id}
					showId={node.showId}
					{...node.props}
				/>
				{#if node.id === selectedNodeId}
					{#each resizeHandles as handle}
						<div
							class="resize-handle resize-handle-{handle}"
							data-resize-handle={handle}
							aria-label="Resize node {handle.replace('t','top ').replace('b','bottom ').replace('l','left ').replace('r','right ').trim()}"
						></div>
					{/each}
				{/if}
			</div>
		{/each}

		<!-- Snap Lines -->
		{#each activeSnapLines as line (line.type + line.stageValue + line.start + line.end)}
            <div
                class="snap-line"
                style:position="absolute"
                style:background-color="rgba(255, 0, 150, 0.6)" 
                style:left="{line.type === 'v' ? line.stageValue - 0.5 : line.start}px"
                style:top="{line.type === 'h' ? line.stageValue - 0.5 : line.start}px"
                style:width="{line.type === 'v' ? '1px' : (line.end - line.start)}px"
                style:height="{line.type === 'h' ? '1px' : (line.end - line.start)}px"
				style:pointer-events="none"
            ></div>
        {/each}
	</div>
</div>

<style>
	.whiteboard-container {
		width: 100%;
		height: 100%;
		overflow: hidden;
		position: relative;
		background-color: #f8f9fa;
		touch-action: none;
	}

	.whiteboard-stage {
		position: absolute;
		will-change: transform, background-position;
		background-image:
			linear-gradient(to right, #e9ecef 1px, transparent 1px),
			linear-gradient(to bottom, #e9ecef 1px, transparent 1px);
	}

	.node-wrapper {
		transition:
			outline-color 0.15s ease-in-out,
			outline-width 0.15s ease-in-out;
		outline: 2px solid transparent;
		outline-offset: 3px;
		z-index: 1;
		display: flex;
		flex-direction: column;
	}

	.node-wrapper.selected {
		outline-color: #007bff;
		z-index: 10;
	}

	.node-wrapper :global(input),
	.node-wrapper :global(textarea),
	.node-wrapper :global([contenteditable='true']),
	.node-wrapper :global([contenteditable='']) {
		user-select: text;
		cursor: text;
	}

	.resize-handle {
		position: absolute;
		width: 10px;
		height: 10px;
		background-color: #007bff;
		border: 1px solid white;
		box-sizing: border-box;
		z-index: 11;
	}
	.resize-handle-tl { top: -5px; left: -5px; cursor: nwse-resize; }
	.resize-handle-t { top: -5px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
	.resize-handle-tr { top: -5px; right: -5px; cursor: nesw-resize; }
	.resize-handle-l { top: 50%; left: -5px; transform: translateY(-50%); cursor: ew-resize; }
	.resize-handle-r { top: 50%; right: -5px; transform: translateY(-50%); cursor: ew-resize; }
	.resize-handle-bl { bottom: -5px; left: -5px; cursor: nesw-resize; }
	.resize-handle-b { bottom: -5px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
	.resize-handle-br { bottom: -5px; right: -5px; cursor: nwse-resize; }


	.whiteboard-container:focus { outline: 2px solid blue; outline-offset: 2px; }
	.whiteboard-container:focus:not(:focus-visible) { outline: none; }
	.whiteboard-container:focus-visible { outline: 2px solid blue; outline-offset: 2px; }

	.snap-line {
		z-index: 5; 
		pointer-events: none; 
	}
</style>