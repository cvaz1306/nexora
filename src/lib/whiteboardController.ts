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

		this.whiteboard.addNode('text', randomX, randomY, { text: nodeText, fontSize: 16 });
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
				height: initialHeight
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

	public setZoom(targetStr?: string): void {
		if (!this.whiteboard) {
			console.warn('Whiteboard instance not available for zoom.');
			return;
		}
		let target = parseFloat(targetStr || '1');
		if (isNaN(target) || target <= 0.1 || target > 5) {
			console.warn(
				`Invalid zoom target "${targetStr}". Using default 1. Target must be > 0.1 and < 5.`
			);
			target = 1;
		}

		this.whiteboard.setZoom(target);
		console.log(
			`Zoomed to ${target.toFixed(2)}. Target zoom level: ${target.toFixed(2)} (actual may be clamped)`
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
		nodes = nodes.map((node) => ({
			...node,
			showId: !node.showId
		}));
		this.setNodesState(nodes);
	}

	public resetView(): void {
		if (!this.whiteboard) return;
		this.whiteboard.panTo(0, 0);
		this.whiteboard.setZoom(1);
		console.log('View reset to origin and zoom 1x.');
	}

	public logNodes(): void {
		if (!this.whiteboard) { // Check whiteboard instance directly for readiness
			console.log(
				'Current Nodes (whiteboard not fully initialized yet):',
				JSON.parse(JSON.stringify(this.getNodesState())) // Use getNodesState for initial nodes
			);
			return;
		}
		console.log('Current Nodes:', JSON.parse(JSON.stringify(this.getNodesState())));
	}

	public clearNodes(): void {
		this.setNodesState([]); // This updates the reactive 'nodes' in +page.svelte
		console.log('All nodes cleared from the whiteboard.');
	}

	public isReady(): boolean {
		return !!this.whiteboard;
	}
}