<script context="module" lang="ts">
	import type { ComponentType, SvelteComponent } from 'svelte';

	export type NodeData = {
		id: string;
		showId: boolean; // Existing property, ensure it's present
		component: ComponentType<SvelteComponent>;
		x: number; // Position on the whiteboard (unscaled stage coords)
		y: number; // Position on the whiteboard (unscaled stage coords)
		props: Record<string, any>;
		width: number; // Node width in stage units
		height: number; // Node height in stage units
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
	const SNAP_THRESHOLD_STAGE = 7; // Snap sensitivity in stage units

	let panX = 0;
	let panY = 0;
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

	// Snapping state
	let activeSnapLines: Array<{
		type: 'h' | 'v';
		stageValue: number; // X for vertical, Y for horizontal
		start: number;      // Y1 for vertical, X1 for horizontal
		end: number;        // Y2 for vertical, X2 for horizontal
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

	function getMousePosition(event: MouseEvent | WheelEvent | PointerEvent): {
		x: number;
		y: number;
	} {
		if (!containerElement) return { x: 0, y: 0 };
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

	// function stageToScreenCoordinates(stageX: number, stageY: number): { x: number; y: number } {
	// 	return {
	// 		x: stageX * zoom + panX,
	// 		y: stageY * zoom + panY
	// 	};
	// }

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

	// --- Snapping Logic ---
	function calculateAndApplySnapsForDrag(
        activeNodeId: string,
        tentativeX: number,
        tentativeY: number
    ): { newX: number; newY: number } {
        const activeNode = nodes.find(n => n.id === activeNodeId);
        if (!activeNode) return { newX: tentativeX, newY: tentativeY };

        activeSnapLines = []; // Clear previous lines
        let finalX = tentativeX;
        let finalY = tentativeY;

        let minDeltaX = SNAP_THRESHOLD_STAGE / zoom; // Convert to screen pixels for comparison consistency, or keep all in stage
        let targetSnapX: number | null = null;
		let xSnapSourceStaticNode: NodeData | null = null;


        let minDeltaY = SNAP_THRESHOLD_STAGE / zoom;
        let targetSnapY: number | null = null;
		let ySnapSourceStaticNode: NodeData | null = null;

        const activePoints = {
            left: tentativeX,
            cx: tentativeX + activeNode.width / 2,
            right: tentativeX + activeNode.width,
            top: tentativeY,
            cy: tentativeY + activeNode.height / 2,
            bottom: tentativeY + activeNode.height,
        };

        for (const staticNode of nodes) {
            if (staticNode.id === activeNodeId) continue;

            const staticPoints = {
                left: staticNode.x,
                cx: staticNode.x + staticNode.width / 2,
                right: staticNode.x + staticNode.width,
                top: staticNode.y,
                cy: staticNode.y + staticNode.height / 2,
                bottom: staticNode.y + staticNode.height,
            };

            const xComparisons = [
                { active: activePoints.left, static: staticPoints.left, offset: 0 },
                { active: activePoints.left, static: staticPoints.cx, offset: 0 },
                { active: activePoints.left, static: staticPoints.right, offset: 0 },
                { active: activePoints.cx, static: staticPoints.left, offset: -activeNode.width / 2 },
                { active: activePoints.cx, static: staticPoints.cx, offset: -activeNode.width / 2 },
                { active: activePoints.cx, static: staticPoints.right, offset: -activeNode.width / 2 },
                { active: activePoints.right, static: staticPoints.left, offset: -activeNode.width },
                { active: activePoints.right, static: staticPoints.cx, offset: -activeNode.width },
                { active: activePoints.right, static: staticPoints.right, offset: -activeNode.width },
            ];

            for (const comp of xComparisons) {
                const delta = Math.abs(comp.active - comp.static);
                if (delta < minDeltaX) {
                    minDeltaX = delta;
                    targetSnapX = comp.static + comp.offset;
					xSnapSourceStaticNode = staticNode;
                }
            }

            const yComparisons = [
                { active: activePoints.top, static: staticPoints.top, offset: 0 },
                { active: activePoints.top, static: staticPoints.cy, offset: 0 },
                { active: activePoints.top, static: staticPoints.bottom, offset: 0 },
                { active: activePoints.cy, static: staticPoints.top, offset: -activeNode.height / 2 },
                { active: activePoints.cy, static: staticPoints.cy, offset: -activeNode.height / 2 },
                { active: activePoints.cy, static: staticPoints.bottom, offset: -activeNode.height / 2 },
                { active: activePoints.bottom, static: staticPoints.top, offset: -activeNode.height },
                { active: activePoints.bottom, static: staticPoints.cy, offset: -activeNode.height },
                { active: activePoints.bottom, static: staticPoints.bottom, offset: -activeNode.height },
            ];
            for (const comp of yComparisons) {
                const delta = Math.abs(comp.active - comp.static);
                if (delta < minDeltaY) {
                    minDeltaY = delta;
                    targetSnapY = comp.static + comp.offset;
					ySnapSourceStaticNode = staticNode;
                }
            }
        }

        if (targetSnapX !== null && xSnapSourceStaticNode) {
            finalX = targetSnapX;
            activeSnapLines.push({
                type: 'v',
                stageValue: finalX + (activePoints.left - tentativeX), // The line is at the static node's edge usually
                start: Math.min(activePoints.top, xSnapSourceStaticNode.y),
                end: Math.max(activePoints.bottom, xSnapSourceStaticNode.y + xSnapSourceStaticNode.height),
            });
        }
        if (targetSnapY !== null && ySnapSourceStaticNode) {
            finalY = targetSnapY;
            activeSnapLines.push({
                type: 'h',
                stageValue: finalY + (activePoints.top - tentativeY),
                start: Math.min(activePoints.left, ySnapSourceStaticNode.x),
                end: Math.max(activePoints.right, ySnapSourceStaticNode.x + ySnapSourceStaticNode.width),
            });
        }
		// Re-calculate line position based on which edge of active node snapped to which edge of static node
		if (targetSnapX !== null && xSnapSourceStaticNode) {
			let lineXPos = 0;
			// Find which static point caused the snap
			const xComp = [
                { activeVal: activeNode.x, staticVal: xSnapSourceStaticNode.x, finalActivePos: finalX}, // L-L
				{ activeVal: activeNode.x, staticVal: xSnapSourceStaticNode.x + xSnapSourceStaticNode.width/2, finalActivePos: finalX}, // L-C
				{ activeVal: activeNode.x, staticVal: xSnapSourceStaticNode.x + xSnapSourceStaticNode.width, finalActivePos: finalX}, // L-R
				{ activeVal: activeNode.x + activeNode.width/2, staticVal: xSnapSourceStaticNode.x, finalActivePos: finalX + activeNode.width/2}, // C-L
				{ activeVal: activeNode.x + activeNode.width/2, staticVal: xSnapSourceStaticNode.x + xSnapSourceStaticNode.width/2, finalActivePos: finalX + activeNode.width/2}, // C-C
				// ... etc. The line should be ON the static node's edge/center.
            ].find(c => Math.abs((c.finalActivePos) - c.staticVal) < SNAP_THRESHOLD_STAGE / zoom);
			lineXPos = xComp ? xComp.staticVal : (finalX + (activePoints.left - tentativeX)); // Fallback

			activeSnapLines = activeSnapLines.filter(l => l.type !== 'v'); // remove old
			activeSnapLines.push({
                type: 'v',
                stageValue: lineXPos,
                start: Math.min(finalY, xSnapSourceStaticNode.y), // use finalY from Y-snap
                end: Math.max(finalY + activeNode.height, xSnapSourceStaticNode.y + xSnapSourceStaticNode.height),
            });
		}
		if (targetSnapY !== null && ySnapSourceStaticNode) {
			let lineYPos = 0;
			const yComp = [
                { activeVal: activeNode.y, staticVal: ySnapSourceStaticNode.y, finalActivePos: finalY},
                // ... etc
            ].find(c => Math.abs((c.finalActivePos) - c.staticVal) < SNAP_THRESHOLD_STAGE / zoom);
			lineYPos = yComp ? yComp.staticVal : (finalY + (activePoints.top - tentativeY));

			activeSnapLines = activeSnapLines.filter(l => l.type !== 'h'); // remove old
			activeSnapLines.push({
                type: 'h',
                stageValue: lineYPos,
                start: Math.min(finalX, ySnapSourceStaticNode.x), // use finalX from X-snap
                end: Math.max(finalX + activeNode.width, ySnapSourceStaticNode.x + ySnapSourceStaticNode.width),
            });
		}


        return { newX: finalX, newY: finalY };
    }

	function calculateAndApplySnapsForResize(
		activeNodeId: string,
		tentative: { x: number; y: number; width: number; height: number },
		handle: ResizeHandleType
	): { newX: number; newY: number; newWidth: number; newHeight: number } {
		activeSnapLines = [];
		let res = { ...tentative };
		const staticNodes = nodes.filter(n => n.id !== activeNodeId);

		// --- X-Axis Snapping ---
		let bestDeltaX = SNAP_THRESHOLD_STAGE / zoom;
		let finalSnapXValue: number | null = null;
		let xSnapTargetNode: NodeData | null = null;

		let activeMovingEdgeX: number;
		if (handle.includes('l')) activeMovingEdgeX = tentative.x;
		else if (handle.includes('r')) activeMovingEdgeX = tentative.x + tentative.width;
		else activeMovingEdgeX = Infinity;

		if (activeMovingEdgeX !== Infinity) {
			for (const staticNode of staticNodes) {
				const staticEdgesX = [staticNode.x, staticNode.x + staticNode.width / 2, staticNode.x + staticNode.width];
				for (const staticEdge of staticEdgesX) {
					const delta = Math.abs(activeMovingEdgeX - staticEdge);
					if (delta < bestDeltaX) {
						bestDeltaX = delta;
						finalSnapXValue = staticEdge;
						xSnapTargetNode = staticNode;
					}
				}
			}
		}

		if (finalSnapXValue !== null) {
			if (handle.includes('l')) {
				const dx = finalSnapXValue - res.x;
				if (res.width - dx >= MIN_NODE_WIDTH) { res.x += dx; res.width -= dx; }
				else { finalSnapXValue = null; }
			} else if (handle.includes('r')) {
				const newWidth = finalSnapXValue - res.x;
				if (newWidth >= MIN_NODE_WIDTH) { res.width = newWidth; }
				else { finalSnapXValue = null; }
			}
			if (finalSnapXValue !== null && xSnapTargetNode) {
				activeSnapLines.push({
					type: 'v', stageValue: finalSnapXValue,
					start: Math.min(res.y, xSnapTargetNode.y),
					end: Math.max(res.y + res.height, xSnapTargetNode.y + xSnapTargetNode.height)
				});
			}
		}

		// --- Y-Axis Snapping ---
		let bestDeltaY = SNAP_THRESHOLD_STAGE / zoom;
		let finalSnapYValue: number | null = null;
		let ySnapTargetNode: NodeData | null = null;

		let activeMovingEdgeY: number;
		if (handle.includes('t')) activeMovingEdgeY = tentative.y;
		else if (handle.includes('b')) activeMovingEdgeY = tentative.y + tentative.height;
		else activeMovingEdgeY = Infinity;

		if (activeMovingEdgeY !== Infinity) {
			for (const staticNode of staticNodes) {
				const staticEdgesY = [staticNode.y, staticNode.y + staticNode.height / 2, staticNode.y + staticNode.height];
				for (const staticEdge of staticEdgesY) {
					const delta = Math.abs(activeMovingEdgeY - staticEdge);
					if (delta < bestDeltaY) {
						bestDeltaY = delta;
						finalSnapYValue = staticEdge;
						ySnapTargetNode = staticNode;
					}
				}
			}
		}

		if (finalSnapYValue !== null) {
			if (handle.includes('t')) {
				const dy = finalSnapYValue - res.y;
				if (res.height - dy >= MIN_NODE_HEIGHT) { res.y += dy; res.height -= dy; }
				else { finalSnapYValue = null; }
			} else if (handle.includes('b')) {
				const newHeight = finalSnapYValue - res.y;
				if (newHeight >= MIN_NODE_HEIGHT) { res.height = newHeight; }
				else { finalSnapYValue = null; }
			}
			if (finalSnapYValue !== null && ySnapTargetNode) {
				activeSnapLines.push({
					type: 'h', stageValue: finalSnapYValue,
					start: Math.min(res.x, ySnapTargetNode.x),
					end: Math.max(res.x + res.width, ySnapTargetNode.x + ySnapTargetNode.width)
				});
			}
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
			nodeInitialX = node.x;
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
			dragStartX = event.clientX;
			dragStartY = event.clientY;
			nodeStartDragX = node.x;
			nodeStartDragY = node.y;
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
		if (!event.isPrimary) return;

		if (isResizingNode && resizingNodeId && activeResizeHandle) {
			event.preventDefault();
			const dxScreen = event.clientX - resizeStartMouseX;
			const dyScreen = event.clientY - resizeStartMouseY;
			const dxStage = dxScreen / zoom;
			const dyStage = dyScreen / zoom;

			let newX = nodeInitialX;
			let newY = nodeInitialY;
			let newWidth = nodeInitialWidth;
			let newHeight = nodeInitialHeight;

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
			if (activeResizeHandle === 't' || activeResizeHandle === 'b') {
				newWidth = nodeInitialWidth; newX = nodeInitialX;
			}
			if (activeResizeHandle === 'l' || activeResizeHandle === 'r') {
				newHeight = nodeInitialHeight; newY = nodeInitialY;
			}
			
			// Apply Snapping for Resize
			const snappedGeom = calculateAndApplySnapsForResize(
                resizingNodeId,
                { x: newX, y: newY, width: newWidth, height: newHeight },
                activeResizeHandle
            );
            newX = snappedGeom.newX;
            newY = snappedGeom.newY;
            newWidth = snappedGeom.newWidth;
            newHeight = snappedGeom.newHeight;

			nodes = nodes.map((n) =>
				n.id === resizingNodeId ? { ...n, x: newX, y: newY, width: newWidth, height: newHeight } : n
			);
		} else if (isDraggingNode && draggedNodeId) {
			event.preventDefault();
			const dxScreen = event.clientX - dragStartX;
			const dyScreen = event.clientY - dragStartY;
			const dxStage = dxScreen / zoom;
			const dyStage = dyScreen / zoom;

			let tentativeNewX = nodeStartDragX + dxStage;
			let tentativeNewY = nodeStartDragY + dyStage;

			// Apply Snapping for Drag
			const { newX: snappedX, newY: snappedY } = calculateAndApplySnapsForDrag(
                draggedNodeId,
                tentativeNewX,
                tentativeNewY
            );
            tentativeNewX = snappedX;
            tentativeNewY = snappedY;

			nodes = nodes.map((n) => (n.id === draggedNodeId ? { ...n, x: tentativeNewX, y: tentativeNewY } : n));
		} else if (isPanning) {
			event.preventDefault();
			panX = event.clientX - startPanX;
			panY = event.clientY - startPanY;
		}
	}

	function handlePointerUp(event: PointerEvent) {
		if (event.button !== 0) return;
		activeSnapLines = []; // Clear lines on pointer up

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
			handlePointerUp(event);
		}
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
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
			case 'image':
				component = ImageNode as unknown as ComponentType<SvelteComponent>;
				break;
			case 'text':
				component = TextNode as unknown as ComponentType<SvelteComponent>;
				break;
			default:
				console.error(`Unknown node type: ${type}`);
				// @ts-expect-error
				return;
		}
		const newNode: NodeData = {
			id: crypto.randomUUID(),
			component,
			x, y,
			width: typeof props.width === 'number' ? props.width : defaultWidth,
			height: typeof props.height === 'number' ? props.height : defaultHeight,
			showId: nodes[0]?.showId ?? false, // Inherit showId from first node or default to false
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
		panX = containerWidth / 2 - targetX * zoom;
		panY = containerHeight / 2 - targetY * zoom;
	}

	export function setZoom(newZoomLevel: number, centerX?: number, centerY?: number): void {
		const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoomLevel));
		if (centerX !== undefined && centerY !== undefined && containerElement) {
			const screenCenterX = centerX * zoom + panX;
			const screenCenterY = centerY * zoom + panY;
			panX = screenCenterX - centerX * clampedZoom;
			panY = screenCenterY - centerY * clampedZoom;
		} else if (centerX !== undefined || centerY !== undefined) {
			console.warn('setZoom requires both centerX and centerY for centered zoom.');
		} else {
			if (containerElement) {
				const screenCenterX = containerElement.clientWidth / 2;
				const screenCenterY = containerElement.clientHeight / 2;
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

	export function getSelectedNodeId(): string | null { return selectedNodeId; }
	export function setSelectedNodeId(id: string | null): void { selectedNodeId = id; }

	const resizeHandles: ResizeHandleType[] = ['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br'];
</script>

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
                style:background-color="rgba(0, 100, 255, 0.7)"
                style:left="{line.type === 'v' ? line.stageValue - 0.5 : line.start}px"
                style:top="{line.type === 'h' ? line.stageValue - 0.5 : line.start}px"
                style:width="{line.type === 'v' ? '1px' : (line.end - line.start)}px"
                style:height="{line.type === 'h' ? '1px' : (line.end - line.start)}px"
            ></div>
        {/each}
	</div>
</div>

<style>
	/* ... (previous styles) ... */
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
	/* ... (resize handle positions) ... */
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
		z-index: 5; /* Below selected node (10) but above others (1) */
		pointer-events: none; /* So they don't interfere with mouse operations */
	}
</style>