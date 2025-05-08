import type Whiteboard from '$lib/Whiteboard.svelte';
import type { NodeData } from '$lib/Whiteboard.svelte';

// These defaults are used when creating new nodes if not overridden by image dimensions etc.
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 150;

export interface WhiteboardControllerOptions {
	whiteboard: Whiteboard;
	getNodes: () => NodeData[];
	setNodes: (nodes: NodeData[]) => void;
}

export class WhiteboardController {
	private whiteboard: Whiteboard;
	private getNodesState: () => NodeData[];
	private setNodesState: (nodes: NodeData[]) => void;

	constructor(options: WhiteboardControllerOptions) {
		this.whiteboard = options.whiteboard;
		this.getNodesState = options.getNodes;
		this.setNodesState = options.setNodes;
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

	public setZoom(targetZoomLevel?: number | string): void { // Made parameter optional and accept string
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
			target = 1; // Default if undefined
		}

		if (isNaN(target) || target <= 0 || target > 10) { // Adjusted max zoom for direct set
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
		// Determine the new state based on the first node, or toggle to true if no nodes/all hidden
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
		if (!this.whiteboard) {
			console.log(
				'Current Nodes (whiteboard not fully initialized yet):',
				JSON.parse(JSON.stringify(this.getNodesState()))
			);
			return;
		}
		console.log('Current Nodes:', JSON.parse(JSON.stringify(this.getNodesState())));
	}

	public clearNodes(): void {
		this.setNodesState([]);
		console.log('All nodes cleared from the whiteboard.');
	}

	public autoArrangeNodes(paddingInput?: number | string ): void {
		const currentNodes = this.getNodesState();
		if (currentNodes.length === 0) {
			console.log('No nodes to arrange.');
			return;
		}

		const padding = typeof paddingInput === 'string' ? parseInt(paddingInput, 10) : (typeof paddingInput === 'number' ? paddingInput : 30);
		if (isNaN(padding)) {
			console.warn(`Invalid padding for arrange: "${paddingInput}". Using default 30.`);
			// Use default padding if parsing failed
		}


		const arrangedNodes: NodeData[] = [];
		let currentX = padding;
		let currentY = padding;
		let maxHeightInRow = 0;
		const MAX_COLS = Math.max(1, Math.floor(Math.sqrt(currentNodes.length) * 1.2)) // Dynamic cols
		// const MAX_COLS = 4; // Fixed columns if preferred


		currentNodes.slice().sort((a,b) => a.id.localeCompare(b.id)).forEach((node, index) => { // Sort for deterministic layout
			const newNode = { ...node };

			if (index > 0 && index % MAX_COLS === 0) {
				currentX = padding;
				currentY += maxHeightInRow + padding;
				maxHeightInRow = 0;
			}

			newNode.x = currentX;
			newNode.y = currentY;

			currentX += newNode.width + padding;
			maxHeightInRow = Math.max(maxHeightInRow, newNode.height);

			arrangedNodes.push(newNode);
		});

		this.setNodesState(arrangedNodes);
		console.log(`Auto-arranged ${arrangedNodes.length} nodes into a grid.`);
		// Optionally, after arranging, fit view to content
		// this.fitViewToNodes(arrangedNodes, padding);
	}

	// Optional: Helper to fit view after arranging (complex, can be added later)
	/*
	public fitViewToNodes(nodesToFit: NodeData[], padding: number = 50): void {
		if (!this.whiteboard || nodesToFit.length === 0) return;

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		nodesToFit.forEach(node => {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
			maxX = Math.max(maxX, node.x + node.width);
			maxY = Math.max(maxY, node.y + node.height);
		});

		const contentWidth = maxX - minX;
		const contentHeight = maxY - minY;
		if (contentWidth <= 0 || contentHeight <= 0) {
			this.resetView();
			return;
		}

		const viewPort = this.whiteboard.getViewport(); // Assume this returns screen width/height
		// This part is tricky: getViewport() returns pan/zoom. Need container dimensions.
		// For now, we'd need Whiteboard to expose its clientWidth/Height or pass them.
		// This is a placeholder for a more complex fit-to-view logic.
		// const screenWidth = ???;
		// const screenHeight = ???;
		// const zoomX = (screenWidth - 2 * padding) / contentWidth;
		// const zoomY = (screenHeight - 2 * padding) / contentHeight;
		// const newZoom = Math.min(zoomX, zoomY, this.whiteboard.maxZoom);
		// this.whiteboard.setZoom(newZoom);
		// const centerX = minX + contentWidth / 2;
		// const centerY = minY + contentHeight / 2;
		// this.whiteboard.panTo(centerX, centerY);

		console.log("Fit view to nodes (basic implementation needed).")
	}
	*/

	public isReady(): boolean {
		return !!this.whiteboard;
	}
}