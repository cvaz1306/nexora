<script context="module" lang="ts">
	import type { ComponentType, SvelteComponent } from 'svelte';

	export type NodeData = {
		id: string;
		showId: boolean;
		component: ComponentType<SvelteComponent>;
		x: number; // Position on the whiteboard (unscaled stage coords)
		y: number; // Position on the whiteboard (unscaled stage coords)
		props: Record<string, any>;
		width: number; // Node width in stage units
		height: number; // Node height in stage units
	};

	export type ConnectorHandleType = 'top' | 'right' | 'bottom' | 'left';

	export type Connection = {
		id: string; // Unique ID for the connection itself
		from: { nodeId: string; handle: ConnectorHandleType }; // Source node ID and handle
		to: { nodeId: string; handle: ConnectorHandleType };   // Target node ID and handle
	};
</script>

<script lang="ts">
	import type Whiteboard from '$lib/Whiteboard.svelte';

	import type { NodeData, Connection, ConnectorHandleType } from '$lib/Whiteboard.svelte';

	import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';

	import ImageNode from './ImageNode.svelte';
	import TextNode from './TextNode.svelte';

	export let nodes: NodeData[] = [];
	export let minZoom = 0.1;
	export let maxZoom = 5.0;
	export let zoomSensitivity = 0.002;
	export let gridSpacing = 20;
	export let connections: Connection[] = [];
	export let showConnections: boolean = true;

	const DEFAULT_NODE_WIDTH = 200;
	const DEFAULT_NODE_HEIGHT = 150;
	const MIN_NODE_WIDTH = 30;
	const MIN_NODE_HEIGHT = 30;
	const SNAP_THRESHOLD_STAGE = 8;
	const CONNECTOR_HANDLE_OFFSET = 20; // Offset from the center along the edge

	let panX = 0;
	let panY = 0;
	let zoom = 1;
	let isPanning = false;
	let startPanX = 0;
	let startPanY = 0;
	let containerElement: HTMLDivElement;
	let stageElement: HTMLDivElement;
	let svgConnectionLayer: SVGSVGElement;

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

	let draggingConnection: {
		startNodeId: string;
		startHandle: ConnectorHandleType;
		startXStage: number;
		startYStage: number;
		currentMouseXScreen: number;
		currentMouseYScreen: number;
	} | null = null;

	const dispatch = createEventDispatcher<{
		addConnection: { from: string; to: string };
	}>();

	$: backgroundSize = gridSpacing * zoom;
	$: backgroundPositionX = panX % backgroundSize;
	$: backgroundPositionY = panY % backgroundSize;
	$: stageStyle = `
      transform: translate(${panX}px, ${panY}px) scale(${zoom});
      transform-origin: 0 0;
      background-size: ${backgroundSize}px ${backgroundSize}px;
      background-position: ${backgroundPositionX}px ${backgroundPositionY}px;
    `;

	$: connectionLines = connections.map(conn => {
		const fromNode = nodes.find(n => n.id === conn.from.nodeId);
		const toNode = nodes.find(n => n.id === conn.to.nodeId);

		if (!fromNode || !toNode) return null;

		const fromPosStage = getConnectorPosition(fromNode, conn.from.handle);
		const toPosStage = getConnectorPosition(toNode, conn.to.handle);

		const fromPosScreen = stageToScreenCoordinates(fromPosStage.x, fromPosStage.y);
		const toPosScreen = stageToScreenCoordinates(toPosStage.x, toPosStage.y);

		return {
			id: conn.id,
			x1: fromPosScreen.x,
			y1: fromPosScreen.y,
			x2: toPosScreen.x,
			y2: toPosScreen.y,
		};
	}).filter(line => line !== null);

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

	function stageToScreenCoordinates(stageX: number, stageY: number): { x: number; y: number } {
		return {
			x: stageX * zoom + panX,
			y: stageY * zoom + panY
		};
	}

	function getConnectorPosition(node: NodeData, handle: ConnectorHandleType): { x: number; y: number } {
		const nodeCenterX = node.x + node.width / 2;
		const nodeCenterY = node.y + node.height / 2;
		const handleSize = 12; // Should match CSS .connector-handle width/height
		const offset = CONNECTOR_HANDLE_OFFSET; // Use constant offset

		switch (handle) {
			case 'top': return { x: nodeCenterX - offset, y: node.y };
			case 'bottom': return { x: nodeCenterX + offset, y: node.y + node.height };
			case 'left': return { x: node.x, y: nodeCenterY - offset };
			case 'right': return { x: node.x + node.width, y: nodeCenterY + offset };
		}
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

	function calculateAndApplySnapsForDrag(
        activeNodeId: string,
        tentativeX: number,
        tentativeY: number
    ): { newX: number; newY: number } {
        const activeNode = nodes.find(n => n.id === activeNodeId);
        if (!activeNode) return { newX: tentativeX, newY: tentativeY };

        activeSnapLines = [];
        let finalX = tentativeX;
        let finalY = tentativeY;

        let bestDeltaX = SNAP_THRESHOLD_STAGE;
        let xSnapTargetStaticEdgeValue: number | null = null;
        let xSnapActiveNodeOriginalOffset = 0;
        let xSnapSourceStaticNode: NodeData | null = null;

        const activeNodePointsX = [
            { currentVal: tentativeX, originalOffset: 0 },
            { currentVal: tentativeX + activeNode.width / 2, originalOffset: -activeNode.width / 2 },
            { currentVal: tentativeX + activeNode.width, originalOffset: -activeNode.width }
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

        let bestDeltaY = SNAP_THRESHOLD_STAGE;
        let ySnapTargetStaticEdgeValue: number | null = null;
        let ySnapActiveNodeOriginalOffset = 0;
        let ySnapSourceStaticNode: NodeData | null = null;

        const activeNodePointsY = [
            { currentVal: tentativeY, originalOffset: 0 },
            { currentVal: tentativeY + activeNode.height / 2, originalOffset: -activeNode.height / 2 },
            { currentVal: tentativeY + activeNode.height, originalOffset: -activeNode.height }
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

		if (xSnapTargetStaticEdgeValue !== null && xSnapSourceStaticNode) {
			activeSnapLines.push({
				type: 'v',
				stageValue: xSnapTargetStaticEdgeValue,
				start: Math.min(finalY, xSnapSourceStaticNode.y, finalY + activeNode.height, xSnapSourceStaticNode.y + xSnapSourceStaticNode.height),
				end: Math.max(finalY, xSnapSourceStaticNode.y, finalY + activeNode.height, xSnapSourceStaticNode.y + xSnapSourceStaticNode.height),
			});
		}
		if (ySnapTargetStaticEdgeValue !== null && ySnapSourceStaticNode) {
			activeSnapLines.push({
				type: 'h',
				stageValue: ySnapTargetStaticEdgeValue,
				start: Math.min(finalX, ySnapSourceStaticNode.x, finalX + activeNode.width, ySnapSourceStaticNode.x + ySnapSourceStaticNode.width),
				end: Math.max(finalX, ySnapSourceStaticNode.x, finalX + activeNode.width, ySnapSourceStaticNode.x + ySnapSourceStaticNode.width),
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

		let bestDeltaX = SNAP_THRESHOLD_STAGE;
		let xSnapTargetStaticEdgeValue: number | null = null;
		let xSnapSourceStaticNode: NodeData | null = null;

		let activeMovingEdgeX: number | null = null;
		let fixedEdgeX: number | null = null;

		if (handle.includes('l')) {
			activeMovingEdgeX = res.x;
			fixedEdgeX = res.x + res.width;
		} else if (handle.includes('r')) {
			activeMovingEdgeX = res.x + res.width;
			fixedEdgeX = res.x;
		}

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

		if (xSnapTargetStaticEdgeValue !== null && fixedEdgeX !== null) {
			if (handle.includes('l')) {
				const newX = xSnapTargetStaticEdgeValue;
				const newWidth = fixedEdgeX - newX;
				if (newWidth >= MIN_NODE_WIDTH) {
					res.x = newX;
					res.width = newWidth;
				} else { xSnapTargetStaticEdgeValue = null; }
			} else if (handle.includes('r')) {
				const newWidth = xSnapTargetStaticEdgeValue - fixedEdgeX;
				if (newWidth >= MIN_NODE_WIDTH) {
					res.width = newWidth;
				} else { xSnapTargetStaticEdgeValue = null; }
			}
		}

		let bestDeltaY = SNAP_THRESHOLD_STAGE;
		let ySnapTargetStaticEdgeValue: number | null = null;
		let ySnapSourceStaticNode: NodeData | null = null;

		let activeMovingEdgeY: number | null = null;
		let fixedEdgeY: number | null = null;

		if (handle.includes('t')) {
			activeMovingEdgeY = res.y;
			fixedEdgeY = res.y + res.height;
		}
		else if (handle.includes('b')) {
			activeMovingEdgeY = res.y + res.height;
			fixedEdgeY = res.y;
		}

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

		if (ySnapTargetStaticEdgeValue !== null && fixedEdgeY !== null) {
			if (handle.includes('t')) {
				const newY = ySnapTargetStaticEdgeValue;
				const newHeight = fixedEdgeY - newY;
				if (newHeight >= MIN_NODE_HEIGHT) {
					res.y = newY;
					res.height = newHeight;
				} else { ySnapTargetStaticEdgeValue = null; }
			} else if (handle.includes('b')) {
				const newHeight = ySnapTargetStaticEdgeValue - fixedEdgeY;
				if (newHeight >= MIN_NODE_HEIGHT) {
					res.height = newHeight;
				} else { ySnapTargetStaticEdgeValue = null; }
			}
		}

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
				start: Math.min(res.x, xSnapSourceStaticNode.x, res.x + res.width, xSnapSourceStaticNode.x + xSnapSourceStaticNode.width),
				end: Math.max(res.x, xSnapSourceStaticNode.x, res.x + res.width, xSnapSourceStaticNode.x + xSnapSourceStaticNode.width)
			});
		}
		return res;
	}

	function handlePointerDown(event: PointerEvent) {
		const targetElement = event.target as HTMLElement;
		const nodeWrapper = targetElement.closest('.node-wrapper');
		const resizeHandle = targetElement.dataset.resizeHandle as ResizeHandleType;
		const connectorHandle = targetElement.dataset.connectorHandle as ConnectorHandleType;

		activeSnapLines = [];

		const isTextEditable = targetElement.isContentEditable ||
							   targetElement.tagName === 'INPUT' ||
							   targetElement.tagName === 'TEXTAREA';

		if (connectorHandle && nodeWrapper) {
			event.stopPropagation();
			const nodeId = nodeWrapper.getAttribute('data-node-id');
			if (!nodeId) return;

			const node = nodes.find(n => n.id === nodeId);
			if (!node) return;

			const startPosStage = getConnectorPosition(node, connectorHandle);
			const mousePosScreen = getMousePosition(event);

			draggingConnection = {
				startNodeId: nodeId,
				startHandle: connectorHandle,
				startXStage: startPosStage.x,
				startYStage: startPosStage.y,
				currentMouseXScreen: mousePosScreen.x,
				currentMouseYScreen: mousePosScreen.y,
			};

			containerElement.setPointerCapture(event.pointerId);
			containerElement.style.cursor = 'crosshair';

		} else if (resizeHandle && nodeWrapper && selectedNodeId === nodeWrapper.getAttribute('data-node-id')) {
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
		} else if (nodeWrapper && selectedNodeId === nodeWrapper.getAttribute('data-node-id')) {
			if (!isTextEditable) {
				event.stopPropagation();

				const nodeId = nodeWrapper.getAttribute('data-node-id');
				if (!nodeId) return;

				const node = nodes.find((n) => n.id === nodeId);
				if (!node) return;

				isDraggingNode = true;
				draggedNodeId = nodeId;

				dragStartX = event.clientX;
				dragStartY = event.clientY;
				nodeStartDragX = node.x;
				nodeStartDragY = node.y;

				containerElement.style.userSelect = 'none';
				containerElement.setPointerCapture(event.pointerId);
				containerElement.style.cursor = 'grabbing';
			}
		} else if (nodeWrapper && nodeWrapper.getAttribute('data-node-id') !== selectedNodeId) {
             selectedNodeId = nodeWrapper.getAttribute('data-node-id');
             event.stopPropagation();
             return;
        }
		else if (!nodeWrapper && selectedNodeId !== null) {
             selectedNodeId = null;
        }
		else if (targetElement === containerElement || targetElement === stageElement) {
			isPanning = true;
			startPanX = event.clientX - panX;
			startPanY = event.clientY - panY;

			containerElement.setPointerCapture(event.pointerId);
			containerElement.style.cursor = 'grabbing';
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (!event.isPrimary) return;

		if (draggingConnection) {
			event.preventDefault();
			const mousePosScreen = getMousePosition(event);
			draggingConnection = {
				...draggingConnection,
				currentMouseXScreen: mousePosScreen.x,
				currentMouseYScreen: mousePosScreen.y,
			};

		} else if (isResizingNode && resizingNodeId && activeResizeHandle) {
			event.preventDefault();

			const dxScreen = event.clientX - resizeStartMouseX;
			const dyScreen = event.clientY - resizeStartMouseY;

			const dxStage = dxScreen / zoom;
			const dyStage = dyScreen / zoom;

			let tentativeX = nodeInitialX;
			let tentativeY = nodeInitialY;
			let tentativeWidth = nodeInitialWidth;
			let tentativeHeight = nodeInitialHeight;

			if (activeResizeHandle.includes('l')) {
				const initialRight = nodeInitialX + nodeInitialWidth;
				tentativeX = nodeInitialX + dxStage;
				tentativeWidth = Math.max(MIN_NODE_WIDTH, initialRight - tentativeX);
				tentativeX = initialRight - tentativeWidth;
			} else if (activeResizeHandle.includes('r')) {
				const initialLeft = nodeInitialX;
				tentativeWidth = Math.max(MIN_NODE_WIDTH, nodeInitialWidth + dxStage);
			}

			if (activeResizeHandle.includes('t')) {
				const initialBottom = nodeInitialY + nodeInitialHeight;
				tentativeY = nodeInitialY + dyStage;
				tentativeHeight = Math.max(MIN_NODE_HEIGHT, initialBottom - tentativeY);
				tentativeY = initialBottom - tentativeHeight;
			} else if (activeResizeHandle.includes('b')) {
				const initialTop = nodeInitialY;
				tentativeHeight = Math.max(MIN_NODE_HEIGHT, nodeInitialHeight + dyStage);
			}

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

		if (draggingConnection) {
			const targetElement = event.target as HTMLElement;
			const targetConnectorHandle = targetElement.dataset.connectorHandle as ConnectorHandleType;
			const targetNodeWrapper = targetElement.closest('.node-wrapper');
			const targetNodeId = targetNodeWrapper?.getAttribute('data-node-id');

			if (targetNodeId && targetConnectorHandle && targetNodeId !== draggingConnection.startNodeId) {
				dispatch('addConnection', {
					from: draggingConnection.startNodeId,
					to: targetNodeId,
				});
			} else {
				console.log('Connection drag ended on invalid target.');
			}

			containerElement.releasePointerCapture(event.pointerId);
			draggingConnection = null;
			if (containerElement) containerElement.style.cursor = 'grab';

		} else if (isResizingNode) {
			containerElement.releasePointerCapture(event.pointerId);
			isResizingNode = false;
			resizingNodeId = null;
			activeResizeHandle = null;
			activeSnapLines = [];
			tick().then(() => {
				if (containerElement) {
					containerElement.style.userSelect = '';
				}
			});
		} else if (isDraggingNode) {
			containerElement.releasePointerCapture(event.pointerId);
			isDraggingNode = false;
			draggedNodeId = null;
			activeSnapLines = [];
			tick().then(() => {
				if (containerElement) {
					containerElement.style.userSelect = '';
				}
			});
		} else if (isPanning) {
			containerElement.releasePointerCapture(event.pointerId);
			isPanning = false;
			activeSnapLines = [];
		}

		if (containerElement && !isDraggingNode && !isResizingNode && !isPanning && !draggingConnection) {
             containerElement.style.cursor = 'grab';
        }
	}

	function handlePointerLeave(event: PointerEvent) {
		if (draggingConnection) {
			containerElement.releasePointerCapture(event.pointerId);
			draggingConnection = null;
			containerElement.style.cursor = 'grab';
		}
		else if (isDraggingNode || isPanning || isResizingNode) {
			handlePointerUp(event);
		}
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		activeSnapLines = [];
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

	export function addConnection(fromNodeId: string, toNodeId: string, fromHandle: ConnectorHandleType = 'bottom', toHandle: ConnectorHandleType = 'top'): Connection | null {
		const fromNode = nodes.find(n => n.id === fromNodeId);
		const toNode = nodes.find(n => n.id === toNodeId);

		if (!fromNode || !toNode || fromNodeId === toNodeId) {
			console.warn(`Cannot connect nodes: Invalid IDs or same node (${fromNodeId} -> ${toNodeId})`);
			return null;
		}

		const existing = connections.find(conn =>
			conn.from.nodeId === fromNodeId && conn.from.handle === fromHandle &&
			conn.to.nodeId === toNodeId && conn.to.handle === toHandle
		);

		if (existing) {
			console.warn(`Connection already exists: ${fromNodeId} (${fromHandle}) -> ${toNodeId} (${toHandle})`);
			return null;
		}

		const newConnection: Connection = {
			id: crypto.randomUUID(),
			from: { nodeId: fromNodeId, handle: fromHandle },
			to: { nodeId: toNodeId, handle: toHandle },
		};

		connections = [...connections, newConnection];
		console.log(`Added connection: ${fromNodeId} -> ${toNodeId}`);
		return newConnection;
	}

	export function removeConnection(connectionId: string): void {
		connections = connections.filter(conn => conn.id !== connectionId);
	}

	export function removeConnectionsForNode(nodeId: string): void {
		connections = connections.filter(conn => conn.from.nodeId !== nodeId && conn.to.nodeId !== nodeId);
	}

	export function setConnectionsState(newConnections: Connection[]): void {
		connections = newConnections;
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
	const connectorHandles: ConnectorHandleType[] = ['top', 'right', 'bottom', 'left'];
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
							aria-label="Resize node {handle
								.replace('t', 'top ')
								.replace('b', 'bottom ')
								.replace('l', 'left ')
								.replace('r', 'right ')
								.trim()}"
						></div>
					{/each}
				{/if}
				{#each connectorHandles as handle}
					<div
						class="connector-handle connector-handle-{handle}"
						data-connector-handle={handle}
						data-node-id={node.id}
						aria-label="Connect from {handle} of node {node.id}"
					></div>
				{/each}
			</div>
		{/each}

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

	{#if showConnections || draggingConnection}
		<svg class="connection-layer" bind:this={svgConnectionLayer}>
			{#if showConnections}
				{#each connectionLines as line (line.id)}
					<line
						x1={line.x1}
						y1={line.y1}
						x2={line.x2}
						y2={line.y2}
						stroke="grey"
						stroke-width="2"
						marker-end="url(#arrowhead)"
					/>
				{/each}
			{/if}
			{#if draggingConnection}
				<line
					x1={stageToScreenCoordinates(draggingConnection.startXStage, draggingConnection.startYStage).x}
					y1={stageToScreenCoordinates(draggingConnection.startXStage, draggingConnection.startYStage).y}
					x2={draggingConnection.currentMouseXScreen}
					y2={draggingConnection.currentMouseYScreen}
					stroke="rgba(0, 0, 255, 0.7)"
					stroke-width="2"
					stroke-dasharray="5,5"
				/>
			{/if}
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="grey" />
                </marker>
            </defs>
		</svg>
	{/if}

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
		box-sizing: border-box;
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

	.connector-handle {
		position: absolute;
		width: 12px;
		height: 12px;
		background-color: #28a745;
		border: 1px solid white;
		border-radius: 50%;
		box-sizing: border-box;
		z-index: 11;
		cursor: crosshair;
		opacity: 0.8; /* Always visible but slightly transparent */
		transition: opacity 0.1s ease-in-out;
	}

	.connector-handle:hover {
		opacity: 1; /* Fully opaque on hover */
	}

	/* Position connector handles, offset from center */
	.connector-handle-top { top: -6px; left: 50%; transform: translateX(-50%) translateY(-20px); }
	.connector-handle-right { top: 50%; right: -6px; transform: translateY(-50%) translateX(20px); }
	.connector-handle-bottom { bottom: -6px; left: 50%; transform: translateX(-50%) translateY(20px); }
	.connector-handle-left { top: 50%; left: -6px; transform: translateY(-50%) translateX(-20px); }


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

	.snap-line {
		z-index: 5;
		pointer-events: none;
	}

	.connection-layer {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}
</style>