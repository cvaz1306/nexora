import type Whiteboard from '$lib/Whiteboard.svelte';
import type { NodeData, Connection, ConnectorHandleType } from '$lib/Whiteboard.svelte';

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 150;

export interface WhiteboardControllerOptions {
	whiteboard: Whiteboard;
	getNodes: () => NodeData[];
	setNodes: (nodes: NodeData[]) => void;
	getConnections: () => Connection[];
	setConnections: (connections: Connection[]) => void;
	showConnections: boolean;
	setShowConnections: (show: boolean) => void;
}

export class WhiteboardController {
	private whiteboard: Whiteboard;
	private getNodesState: () => NodeData[];
	private setNodesState: (nodes: NodeData[]) => void;
	private getConnectionsState: () => Connection[];
	private setConnectionsState: (connections: Connection[]) => void;
	private setShowConnectionsState: (show: boolean) => void;

	constructor(options: WhiteboardControllerOptions) {
		this.whiteboard = options.whiteboard;
		this.getNodesState = options.getNodes;
		this.setNodesState = options.setNodes;
		this.getConnectionsState = options.getConnections;
		this.setConnectionsState = options.setConnections;
		this.setShowConnectionsState = options.setShowConnections;
	}

	public addTextNode(text?: string): void {
		if (!this.whiteboard) {
			console.warn('Whiteboard instance not available for adding text node.');
			return;
		}

		const viewCenter = this.whiteboard.getStageCoordinatesForScreenCenter();
		if (!viewCenter) {
			console.warn(
				'Could not determine whiteboard view center. Whiteboard might not be fully ready.'
			);
			return;
		}

		const randomX = viewCenter.x - DEFAULT_NODE_WIDTH / 2 + (Math.random() - 0.5) * 50;
		const randomY = viewCenter.y - DEFAULT_NODE_HEIGHT / 2 + (Math.random() - 0.5) * 50;
		const nodeText = text?.trim() || `Random ${Math.random().toString(36).substring(7)}`;

		const nodes = this.getNodesState();
		const showIdForNewNode = nodes.length > 0 ? nodes[0].showId : false;

		this.whiteboard.addNode('text', randomX, randomY, { text: nodeText, fontSize: 16, showId: showIdForNewNode });
		console.log(`Added text node: "${nodeText}" at (${randomX.toFixed(0)}, ${randomY.toFixed(0)})`);
	}

	public addImageNode(src?: string): void {
		if (!this.whiteboard) {
			console.warn('Whiteboard instance not available for adding image node.');
			return;
		}
		const viewCenter = this.whiteboard.getStageCoordinatesForScreenCenter();
		if (!viewCenter) {
			console.warn(
				'Could not determine whiteboard view center. Whiteboard might not be fully ready.'
			);
			return;
		}

		let imageSrcOrAction: string | ArrayBuffer | null =
			src?.trim() || `https://placehold.co/300x200?text=Image`;

		const nodes = this.getNodesState();
		const showIdForNewNode = nodes.length > 0 ? nodes[0].showId : false;

		const addTheNode = (
			finalImageSrc: string | ArrayBuffer | null,
			intrinsicWidth?: number,
			intrinsicHeight?: number
		) => {
			const initialWidth = intrinsicWidth
				? Math.min(intrinsicWidth, 600)
				: DEFAULT_NODE_WIDTH;
			const initialHeight = intrinsicHeight
				? Math.min(intrinsicHeight, 500)
				: DEFAULT_NODE_HEIGHT;

			const randomX = viewCenter.x - initialWidth / 2 + (Math.random() - 0.5) * 50;
			const randomY = viewCenter.y - initialHeight / 2 + (Math.random() - 0.5) * 50;

			this.whiteboard.addNode('image', randomX, randomY, {
				src: finalImageSrc,
				alt: 'User Added Image',
				width: initialWidth,
				height: initialHeight,
				showId: showIdForNewNode
			});
			console.log(
				`Added image node with src: "${
					finalImageSrc ? finalImageSrc.toString().substring(0, 30) + '...' : 'none'
				}" at (${randomX.toFixed(0)}, ${randomY.toFixed(0)})`
			);
		};

		if (imageSrcOrAction === 'upload' || imageSrcOrAction === 'input') {
			const fileInput = document.createElement('input');
			fileInput.type = 'file';
			fileInput.accept = 'image/*';
			fileInput.onchange = (event) => {
				const file = (event.target as HTMLInputElement).files?.[0];
				if (!file) return;
				const reader = new FileReader();
				reader.onload = (e) => {
					const uploadedImageSrc = e.target?.result;
					if (uploadedImageSrc) {
						const img = new Image();
						img.onload = () => addTheNode(uploadedImageSrc, img.naturalWidth, img.naturalHeight);
						img.onerror = () => {
							addTheNode(uploadedImageSrc);
							console.error('Could not load uploaded file as an image to get dimensions.');
						};
						img.src = uploadedImageSrc as string;
					}
				};
				reader.readAsDataURL(file);
			};
			fileInput.click();
		} else {
			const img = new Image();
			img.onload = () => addTheNode(imageSrcOrAction, img.naturalWidth, img.naturalHeight);
			img.onerror = () => {
				console.warn(`Could not load image from URL: ${imageSrcOrAction}. Adding with default size.`);
				addTheNode(imageSrcOrAction);
			};
			img.src = imageSrcOrAction as string;
		}
	}

	public connectNodes(id1: string, id2: string): void {
		if (!this.whiteboard) {
			console.warn('Whiteboard instance not available for connecting nodes.');
			return;
		}
		const node1 = this.getNodesState().find(n => n.id === id1);
		const node2 = this.getNodesState().find(n => n.id === id2);

		if (!node1 || !node2) {
			console.warn(`Could not connect nodes: Node(s) not found. IDs: ${id1}, ${id2}`);
			return;
		}

		this.whiteboard.addConnection(id1, id2, 'bottom', 'top');
	}

	public toggleConnectionsVisibility(show?: boolean): void {
		if (!this.whiteboard) {
			console.warn('Whiteboard instance not available for toggling connections.');
			return;
		}
		const currentShow = (this.whiteboard as any).showConnections;

		const newShowState = show !== undefined ? show : !currentShow;
		this.setShowConnectionsState(newShowState);
		console.log(`Connection lines visibility toggled to: ${newShowState}`);
	}

	public zoom(direction: 'in' | 'out', factorStr?: string): void {
		if (!this.whiteboard) {
			console.warn('Whiteboard instance not available for zoom.');
			return;
		}
		let factor = parseFloat(factorStr || '1.2');
		if (isNaN(factor) || factor <= 0.1 || factor > 5) {
			console.warn(
				`Invalid zoom factor "${factorStr}". Using default 1.2. Factor must be > 0.1 and < 5.`
			);
			factor = 1.2;
		}
		const currentViewport = this.whiteboard.getViewport();
		const targetZoom =
			direction === 'in' ? currentViewport.zoom * factor : currentViewport.zoom / factor;
		this.whiteboard.setZoom(targetZoom);
		console.log(
			`Zoomed ${direction} by ${factor.toFixed(2)}. Target zoom level: ${targetZoom.toFixed(2)} (actual may be clamped)`
		);
	}

	public setZoom(targetZoomLevel?: number | string): void {
		if (!this.whiteboard) {
			console.warn('Whiteboard instance not available for zoom.');
			return;
		}
		let target: number;
		if (typeof targetZoomLevel === 'string') {
			target = parseFloat(targetZoomLevel);
		} else if (typeof targetZoomLevel === 'number') {
			target = targetZoomLevel;
		} else {
			target = 1;
		}

		if (isNaN(target) || target <= 0 || target > 10) {
			console.warn(
				`Invalid zoom target "${targetZoomLevel}". Using default 1. Target must be > 0 and <= 10.`
			);
			target = 1;
		}

		this.whiteboard.setZoom(target);
		console.log(
			`Zoom set to ${target.toFixed(2)}. (actual may be clamped by whiteboard min/max)`
		);
	}

	public panTo(x: number, y: number): void {
		if (!this.whiteboard) {
			console.warn('Whiteboard instance not available for pan.');
			return;
		}
		this.whiteboard.panTo(x, y);
		console.log(`Panned to (${x.toFixed(0)}, ${y.toFixed(0)})`);
	}

	public panBy(x: number, y: number): void {
		if (!this.whiteboard) {
			console.warn('Whiteboard instance not available for pan.');
			return;
		}
		this.whiteboard.panBy(x, y);
		console.log(`Panned by (${x.toFixed(0)}, ${y.toFixed(0)})`);
	}

	public toggleIDHidden(): void {
		let nodes = this.getNodesState();
		const newShowIdState = nodes.length > 0 ? !nodes[0].showId : true;
		nodes = nodes.map((node) => ({
			...node,
			showId: newShowIdState
		}));
		this.setNodesState(nodes);
		console.log(`Node IDs visibility toggled to: ${newShowIdState}`);
	}

	public resetView(): void {
		if (!this.whiteboard) return;
		this.whiteboard.panTo(0, 0);
		this.whiteboard.setZoom(1);
		console.log('View reset to origin and zoom 1x.');
	}

	public logNodes(): void {
		console.log('Current Nodes:', JSON.parse(JSON.stringify(this.getNodesState())));
		console.log('Current Connections:', JSON.parse(JSON.stringify(this.getConnectionsState())));
	}

	public clearNodes(): void {
		this.setNodesState([]);
		this.setConnectionsState([]);
		console.log('All nodes and connections cleared from the whiteboard.');
	}

	public autoArrangeNodes(paddingInput?: number | string): void {
		const currentNodes = this.getNodesState();
		const currentConnections = this.getConnectionsState();

		if (currentNodes.length === 0) {
			console.log('No nodes to arrange.');
			return;
		}

		const padding = typeof paddingInput === 'string' ? parseInt(paddingInput, 10) : (typeof paddingInput === 'number' ? paddingInput : 60);
		if (isNaN(padding)) {
			console.warn(`Invalid padding for arrange: "${paddingInput}". Using default 60.`);
		}

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		let totalWidth = 0, totalHeight = 0;

		currentNodes.forEach(node => {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
			maxX = Math.max(maxX, node.x + node.width);
			maxY = Math.max(maxY, node.y + node.height);
			totalWidth += node.width;
			totalHeight += node.height;
		});

		const avgNodeWidth = totalWidth / currentNodes.length || DEFAULT_NODE_WIDTH;
		const avgNodeHeight = totalHeight / currentNodes.length || DEFAULT_NODE_HEIGHT;

		const currentLayoutWidth = maxX - minX;
		const currentLayoutHeight = maxY - minY;
		const aspectRatio = currentLayoutWidth > 0 && currentLayoutHeight > 0 ? currentLayoutWidth / currentLayoutHeight : 1;

		const estimatedNumCells = currentNodes.length;

		const estimatedCols = Math.max(1, Math.round(Math.sqrt(estimatedNumCells * aspectRatio)));
		const estimatedRows = Math.max(1, Math.ceil(estimatedNumCells / estimatedCols));

		const grid: (string | null)[][] = Array(estimatedRows).fill(null).map(() => Array(estimatedCols).fill(null));
		const nodesWithGridPos = new Map<string, NodeData & { gridRow?: number; gridCol?: number }>();
		currentNodes.forEach(node => nodesWithGridPos.set(node.id, { ...node }));

		const layoutCenterX = minX + (maxX - minX) / 2;
		const layoutCenterY = minY + (maxY - minY) / 2;

		const sortedNodes = [...currentNodes].sort((a, b) => {
			const distA = Math.hypot(a.x - layoutCenterX, a.y - layoutCenterY);
			const distB = Math.hypot(b.x - layoutCenterX, b.y - layoutCenterY);
			return distA - distB;
		});

		const placedNodes = new Set<string>();

		const adjList = new Map<string, string[]>();
		currentConnections.forEach(conn => {
			if (!adjList.has(conn.from.nodeId)) adjList.set(conn.from.nodeId, []);
			if (!adjList.has(conn.to.nodeId)) adjList.set(conn.to.nodeId, []);
			adjList.get(conn.from.nodeId)!.push(conn.to.nodeId);
			adjList.get(conn.to.nodeId)!.push(conn.from.nodeId);
		});


		sortedNodes.forEach(node => {
			if (placedNodes.has(node.id)) return;

			const relativeX = node.x - minX;
			const relativeY = node.y - minY;

			const totalLayoutEstWidth = estimatedCols * (avgNodeWidth + padding);
			const totalLayoutEstHeight = estimatedRows * (avgNodeHeight + padding);

			const targetCol = Math.min(estimatedCols - 1, Math.floor(relativeX / (currentLayoutWidth || 1) * estimatedCols)); // Scale relative pos by actual bounds
			const targetRow = Math.min(estimatedRows - 1, Math.floor(relativeY / (currentLayoutHeight || 1) * estimatedRows)); // Scale relative pos by actual bounds


			const clampedTargetCol = Math.max(0, Math.min(estimatedCols - 1, targetCol));
			const clampedTargetRow = Math.max(0, Math.min(estimatedRows - 1, targetRow));

			let bestRow = -1, bestCol = -1;
			let minDistanceSq = Infinity;

			for (let r = 0; r < estimatedRows; r++) {
				for (let c = 0; c < estimatedCols; c++) {
					if (grid[r][c] === null) {
						const distSq = (r - clampedTargetRow) * (r - clampedTargetRow) + (c - clampedTargetCol) * (c - clampedTargetCol);
						if (distSq < minDistanceSq) {
							minDistanceSq = distSq;
							bestRow = r;
							bestCol = c;
						}
					}
				}
			}

			if (bestRow !== -1 && bestCol !== -1) {
				grid[bestRow][bestCol] = node.id;
				placedNodes.add(node.id);
				nodesWithGridPos.get(node.id)!.gridRow = bestRow;
				nodesWithGridPos.get(node.id)!.gridCol = bestCol;

				const neighborsToPlace = adjList.get(node.id)?.filter(neighborId => !placedNodes.has(neighborId)) || [];

				const adjacentOffsets = [{dr: -1, dc: 0}, {dr: 1, dc: 0}, {dr: 0, dc: -1}, {dr: 0, dc: 1}, {dr: -1, dc: -1}, {dr: -1, dc: 1}, {dr: 1, dc: -1}, {dr: 1, dc: 1}];

				neighborsToPlace.forEach(neighborId => {
					const neighborNode = currentNodes.find(n => n.id === neighborId);
					if (!neighborNode) return;

					let placedNeighbor = false;
					adjacentOffsets.sort(() => Math.random() - 0.5);

					for (const offset of adjacentOffsets) {
						const neighborRow = bestRow + offset.dr;
						const neighborCol = bestCol + offset.dc;

						if (neighborRow >= 0 && neighborRow < estimatedRows &&
							neighborCol >= 0 && neighborCol < estimatedCols &&
							grid[neighborRow][neighborCol] === null)
						{
							grid[neighborRow][neighborCol] = neighborId;
							placedNodes.add(neighborId);
							nodesWithGridPos.get(neighborId)!.gridRow = neighborRow;
							nodesWithGridPos.get(neighborId)!.gridCol = neighborCol;
							placedNeighbor = true;
							break;
						}
					}
				});
			} else {
                 console.warn(`Could not find empty cell for node ${node.id}`);
                 nodesWithGridPos.set(node.id, node);
            }
		});

         let currentRow = 0;
         let currentCol = 0;
         nodesWithGridPos.forEach(node => {
             if (node.gridRow === undefined || node.gridCol === undefined) {
                 while(currentRow < estimatedRows && currentCol < estimatedCols && grid[currentRow][currentCol] !== null) {
                      currentCol++;
                      if (currentCol >= estimatedCols) {
                           currentCol = 0;
                           currentRow++;
                      }
                 }
                 if (currentRow < estimatedRows && currentCol < estimatedCols) {
                      grid[currentRow][currentCol] = node.id;
                      node.gridRow = currentRow;
                      node.gridCol = currentCol;
                      placedNodes.add(node.id);
                      currentCol++;
                 } else {
                      console.error(`Ran out of grid space trying to place node ${node.id}`);
                 }
             }
         });

		const finalGridRows = estimatedRows;
		const finalGridCols = estimatedCols;

		const colWidths = Array(finalGridCols).fill(0);
		const rowHeights = Array(finalGridRows).fill(0);

		nodesWithGridPos.forEach(node => {
			const { gridRow, gridCol } = node;
			if (gridRow !== undefined && gridCol !== undefined) {
				colWidths[gridCol] = Math.max(colWidths[gridCol], node.width);
				rowHeights[gridRow] = Math.max(rowHeights[gridRow], node.height);
			}
		});

		const colOffsets = [padding];
		for(let i = 0; i < finalGridCols - 1; i++) {
			colOffsets.push(colOffsets[i] + colWidths[i] + padding);
		}

		const rowOffsets = [padding];
		for(let i = 0; i < finalGridRows - 1; i++) {
			rowOffsets.push(rowOffsets[i] + rowHeights[i] + padding);
		}

		const finalArrangedNodes: NodeData[] = [];
		currentNodes.forEach(node => {
			const tempNode = nodesWithGridPos.get(node.id);
			if (tempNode && tempNode.gridRow !== undefined && tempNode.gridCol !== undefined) {
				const newX = colOffsets[tempNode.gridCol];
				const newY = rowOffsets[tempNode.gridRow];
				finalArrangedNodes.push({ ...node, x: newX, y: newY });
			} else {
				finalArrangedNodes.push(node);
				console.warn(`Node ${node.id} was not placed in the grid during arrange.`);
			}
		});

		this.setNodesState(finalArrangedNodes);

		let finalMinX = Infinity, finalMinY = Infinity, finalMaxX = -Infinity, finalMaxY = -Infinity;
		if (finalArrangedNodes.length > 0) {
			finalArrangedNodes.forEach(node => {
				finalMinX = Math.min(finalMinX, node.x);
				finalMinY = Math.min(finalMinY, node.y);
				finalMaxX = Math.max(finalMaxX, node.x + node.width);
				finalMaxY = Math.max(finalMaxY, node.y + node.height);
			});

			const layoutCenterX = finalMinX + (finalMaxX - finalMinX) / 2;
			const layoutCenterY = finalMinY + (finalMaxY - finalMinY) / 2;
			this.whiteboard.panTo(layoutCenterX, layoutCenterY);
		}

		console.log(`Auto-arranged ${finalArrangedNodes.length} nodes into a grid.`);
	}

	public isReady(): boolean {
		return !!this.whiteboard;
	}
}