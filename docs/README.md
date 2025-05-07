### `src/lib/Whiteboard.svelte`

**Purpose:**

This is the core component of the application, acting as the interactive whiteboard canvas. It manages the overall stage (pan, zoom), renders the grid background, displays individual nodes, and handles user interactions like panning the board, selecting nodes, dragging nodes, and resizing nodes. It also exposes a public API for programmatic control (e.g., adding nodes, setting zoom/pan).

**`<script context="module" lang="ts">`**

*   **`NodeData` Type Export:**
    *   Defines the structure for the data representing each node on the whiteboard.
    *   `id`: A unique string identifier for the node.
    *   `component`: The Svelte component constructor (e.g., `TextNode`, `ImageNode`) to render for this node.
    *   `x`, `y`: Numbers representing the top-left corner position of the node on the stage (in unscaled stage coordinates).
    *   `width`, `height`: Numbers representing the dimensions of the node container (in unscaled stage coordinates). Crucial for rendering the wrapper and calculating resize operations.
    *   `props`: A flexible `Record<string, any>` object containing properties specific to the node's component (e.g., `{ text: 'Hello' }` for `TextNode`, `{ src: '...' }` for `ImageNode`).

**`<script lang="ts">`**

*   **Imports:**
    *   Svelte lifecycle functions (`onMount`, `onDestroy`, `tick`) and environment check (`browser`).
    *   Concrete node components (`ImageNode`, `TextNode`).
*   **Exports (Props):**
    *   `nodes: NodeData[]`: The array of node data objects to be rendered on the whiteboard. This is reactive and can be bound (`bind:nodes`).
    *   `minZoom`, `maxZoom`: Numbers defining the minimum and maximum allowed zoom levels.
    *   `zoomSensitivity`: A number controlling how fast zooming occurs with the mouse wheel.
    *   `gridSpacing`: The size (in stage units) of the grid squares in the background.
*   **Constants:**
    *   `DEFAULT_NODE_WIDTH`, `DEFAULT_NODE_HEIGHT`: Default dimensions used when adding new nodes if not specified.
    *   `MIN_NODE_WIDTH`, `MIN_NODE_HEIGHT`: Minimum dimensions enforced during node resizing.
*   **State:**
    *   `panX`, `panY`: Current horizontal and vertical pan offset of the stage (in screen pixels).
    *   `zoom`: Current zoom level (multiplier).
    *   `isPanning`: Boolean flag indicating if the user is currently panning the whiteboard background.
    *   `startPanX`, `startPanY`: Screen coordinates where panning started, used to calculate pan delta.
    *   `containerElement`, `stageElement`: Bindings to the main container and the pannable/zoomable stage divs.
    *   `isDraggingNode`: Boolean flag indicating if a node is being dragged.
    *   `draggedNodeId`: The `id` of the node currently being dragged.
    *   `dragStartX`, `dragStartY`: Screen coordinates where node dragging started.
    *   `nodeStartDragX`, `nodeStartDragY`: The node's original stage `x`, `y` when dragging started.
    *   `isResizingNode`: Boolean flag indicating if a node is being resized.
    *   `resizingNodeId`: The `id` of the node currently being resized.
    *   `activeResizeHandle`: The type (`'tl'`, `'br'`, etc.) of the resize handle currently being interacted with.
    *   `resizeStartMouseX`, `resizeStartMouseY`: Screen coordinates where node resizing started.
    *   `nodeInitialX`, `nodeInitialY`, `nodeInitialWidth`, `nodeInitialHeight`: The node's state (position and dimensions) when resizing started.
    *   `selectedNodeId`: The `id` of the currently selected node, or `null` if none is selected. Used for highlighting and enabling resizing.
*   **Reactive Calculations:**
    *   `backgroundSize`: Calculates the grid square size in screen pixels based on `gridSpacing` and `zoom`.
    *   `backgroundPositionX`, `backgroundPositionY`: Calculates the background offset based on `panX`, `panY` and `backgroundSize` (using modulo for seamless tiling).
    *   `stageStyle`: A dynamically generated string for the `style` attribute of the stage `div`. Applies the `transform` (translate and scale) and sets the `background-size` and `background-position` for the grid.
*   **Internal Logic Functions:**
    *   `getMousePosition(event)`: Calculates mouse coordinates relative to the `containerElement`.
    *   `screenToStageCoordinates(screenX, screenY)`: Converts coordinates from screen space (relative to the container) to stage space (unscaled, relative to the stage origin).
    *   `stageToScreenCoordinates(stageX, stageY)`: Converts coordinates from stage space to screen space.
*   **Event Handlers:**
    *   `handlePointerDown(event)`: Central handler for initiating interactions.
        *   Checks if the target is a resize handle on the selected node: If yes, initiates resize mode (`isResizingNode = true`), stores initial node state, captures pointer, prevents default text selection. Calls `stopPropagation` to prevent drag/pan.
        *   Checks if the target is a node wrapper (but not a resize handle): If yes, initiates drag mode (`isDraggingNode = true`), stores starting positions, captures pointer, sets cursor, prevents default text selection. Calls `stopPropagation` to prevent pan.
        *   Checks if the target is the background: If yes, initiates pan mode (`isPanning = true`), deselects any node, stores starting pan offset, captures pointer, sets cursor.
    *   `handlePointerMove(event)`: Handles movement during an active interaction.
        *   If resizing: Calculates mouse delta, converts to stage delta (dividing by `zoom`), calculates new node `x`, `y`, `width`, `height` based on the `activeResizeHandle`, enforces `MIN_NODE_WIDTH/HEIGHT`, and updates the `nodes` array immutably.
        *   If dragging: Calculates mouse delta, converts to stage delta, calculates new node `x`, `y`, and updates the `nodes` array immutably.
        *   If panning: Calculates new `panX`, `panY` based on mouse movement and the starting offset.
    *   `handlePointerUp(event)`: Cleans up after an interaction ends (resizing, dragging, *or* panning). Releases pointer capture, resets boolean flags (`isResizingNode`, `isDraggingNode`, `isPanning`), resets `userSelect` style (using `tick()` to ensure it happens after potential click events), and resets the container cursor.
    *   `handlePointerLeave(event)`: Called when the pointer leaves the container area. Treats this the same as `handlePointerUp` if an interaction was in progress to prevent stuck states.
    *   `handleWheel(event)`: Handles zooming. Prevents default scroll, calculates the new zoom level (clamped between `minZoom`/`maxZoom`), determines the stage coordinates under the mouse pointer *before* the zoom, calculates the required pan adjustment to keep that point under the pointer *after* the zoom, and updates `zoom`, `panX`, `panY`.
*   **Lifecycle (`onMount`, `onDestroy`):**
    *   `onMount`: Sets the initial cursor style (`grab`) and attaches the core pointer event listeners (`pointerdown`, `pointermove`, `pointerup`, `pointerleave`) directly to the `containerElement`. This is done programmatically for fine-grained control and pointer capture.
    *   `onDestroy`: Removes the programmatically added event listeners to prevent memory leaks.
*   **Public API Methods:**
    *   `addNode(type, x, y, props)`: Creates a new `NodeData` object with a unique ID, the specified component type, position, and props. Uses default dimensions if not provided in `props`. Adds the new node to the `nodes` array. Returns the newly created `NodeData`.
    *   `panBy(dx, dy)`: Pans the view by the given screen pixel delta.
    *   `panTo(targetX, targetY)`: Pans the view so that the given stage coordinates (`targetX`, `targetY`) are centered in the container.
    *   `setZoom(newZoomLevel, centerX?, centerY?)`: Sets the zoom level. Clamps the value. If `centerX`/`centerY` (stage coordinates) are provided, zooms towards that point; otherwise, zooms towards the center of the current view.
    *   `getStageCoordinatesForScreenCenter()`: Returns the stage coordinates corresponding to the center of the whiteboard container's viewport.
    *   `getViewport()`: Returns the current `{ panX, panY, zoom }` state.
    *   `getSelectedNodeId()`: Returns the ID of the currently selected node, or `null`.
    *   `setSelectedNodeId(id)`: Programmatically sets the selected node ID.
*   **`resizeHandles` Array:** Stores the identifiers for the 8 resize handle positions.

**Template Structure:**

1.  **Outer Container (`div.whiteboard-container`):**
    *   Takes up 100% width/height, clips overflow.
    *   Sets `touch-action: none` to prevent default browser touch behaviors.
    *   `bind:this={containerElement}` to get a reference.
    *   Attaches the `on:wheel` handler (programmatic listeners handle pointer events).
    *   Accessible roles (`role="application"`, `aria-roledescription`).
    *   `tabindex="0"` to make it focusable.
2.  **Stage (`div.whiteboard-stage`):**
    *   Positioned absolutely within the container.
    *   `bind:this={stageElement}`.
    *   Receives the dynamic `style={stageStyle}` for pan, zoom, and grid background.
3.  **Node Rendering (`#each nodes ...`):**
    *   Iterates through the `nodes` array, using `node.id` as the key.
    *   **Node Wrapper (`div.node-wrapper`):**
        *   Positioned absolutely using inline `style:left` and `style:top` bound to `node.x` and `node.y`.
        *   Sized using inline `style:width` and `style:height` bound to `node.width` and `node.height`.
        *   `data-node-id={node.id}` for identification in event handlers.
        *   `class:selected` toggles based on `node.id === selectedNodeId`.
        *   Cursor dynamically set based on whether it's being dragged.
    *   **Dynamic Component (`<svelte:component>`):**
        *   Renders the component specified by `node.component`.
        *   Passes `isSelected`, `nodeId`, and all properties from `node.props` down to the specific node component.
    *   **Resize Handles (`{#if node.id === selectedNodeId}...`):**
        *   Conditionally rendered only for the selected node.
        *   Iterates through the `resizeHandles` array.
        *   Renders a `div.resize-handle.resize-handle-{handle}` for each handle type.
        *   `data-resize-handle={handle}` allows the `pointerdown` handler to identify which handle was clicked.
        *   No `on:pointerdown` here; the event bubbles to the container.

**Styling (`<style>`):**

*   `.whiteboard-container`: Basic setup, overflow hidden, relative positioning, background color, `touch-action`.
*   `.whiteboard-stage`: Absolute positioning, performance hints (`will-change`), defines the repeating gradient background image for the grid (color, thickness). Size and position are set dynamically via inline styles.
*   `.node-wrapper`: Base styles for the node container. `display: flex` helps contained components fill the space. Outline for selection feedback (transparent by default). `z-index` management.
*   `.node-wrapper.selected`: Applies the visible outline color and brings the selected node to the front (`z-index`).
*   `:global(...)` rules within `.node-wrapper`: Allow text selection specifically for input/textarea/contenteditable elements *inside* node components, overriding broader `user-select: none` potentially set elsewhere.
*   `.resize-handle`: Base styles for the small resize squares (position, size, background, border, box-sizing, z-index).
*   `.resize-handle-*`: Specific styles for each handle type (`tl`, `t`, `tr`, etc.) setting its exact position (`top`, `left`, `right`, `bottom`, `transform`) and the appropriate `cursor` style (e.g., `nwse-resize`).
*   `.whiteboard-container:focus...`: Standard focus outline styles for accessibility.

---

### `src/lib/BaseNode.svelte`

**Purpose:**

This component serves as a foundational building block for all node types on the whiteboard. It provides a consistent visual structure (background, border, shadow) and ensures that the node's content area fills the dimensions set by the parent `.node-wrapper` in `Whiteboard.svelte`. It uses a `<slot />` to allow specific node content (like images or text) to be inserted.

**`<script lang="ts">`**

*   No props are defined here for position or size (`x`, `y`, `width`, `height`) because these aspects are controlled by the `.node-wrapper` div in the parent `Whiteboard.svelte` component via inline styles.

**Template Structure:**

*   Contains a single `div` with the class `node-base`.
*   Includes a `<slot />` element, which acts as a placeholder where the content from the specific node component (e.g., `ImageNode`, `TextNode`) will be rendered.

**Styling (`<style>`):**

*   `.node-base`:
    *   `width: 100%`, `height: 100%`: Makes the base fill the dimensions allocated by its parent (`.node-wrapper`).
    *   `border`, `background-color`, `box-shadow`: Provides the default visual appearance of a node.
    *   `user-select: none`: Prevents accidental text selection within the node's *non-interactive* parts when the user might be trying to pan the whiteboard. Specific interactive elements inside the slot (like editable text) should override this.
    *   `display: flex`, `align-items: center`, `justify-content: center`: Basic flex layout to center the slotted content by default. Specific node types might override this.
    *   `overflow: hidden`: Clips any content within the node that exceeds its boundaries, especially important after resizing.
    *   `box-sizing: border-box`: Ensures padding and border are included in the element's total width and height.
    *   `cursor: default`: Sets the default cursor for the node's content area.

---

### `src/lib/ImageNode.svelte`

**Purpose:**

This component is responsible for displaying an image within a `BaseNode`. It ensures the image scales appropriately to fit within the node's current dimensions while maintaining its aspect ratio.

**`<script lang="ts">`**

*   **Imports:** Imports the `BaseNode` component.
*   **Exports (Props):**
    *   `src: string`: The URL or data URI of the image to display. (Required)
    *   `alt: string`: Alternative text for the image (defaults to 'Whiteboard Image').
    *   `image: HTMLImageElement | undefined`: An optional prop to allow binding directly to the underlying `<img>` element (using `bind:this`).
*   **`$$props` Usage:** Notes that `width` and `height` passed within the `props` object of the `NodeData` (e.g., `props: { width: 50, height: 50 }`) can be accessed via the special `$$props` variable and are used to set the *native* `width` and `height` attributes on the `<img>` tag. This is distinct from the node container's dimensions.

**Template Structure:**

*   Uses the `BaseNode` component as a wrapper.
*   Inside the `BaseNode`, it renders an `<img>` tag:
    *   `bind:this={image}`: Binds the actual DOM element to the exported `image` prop if provided.
    *   `src={src}` and `alt={alt}`: Sets the image source and alt text from props.
    *   `draggable="false"`: Prevents the default browser image dragging behavior.
    *   `style="..."`: Contains crucial CSS for scaling:
        *   `display: block;`: Prevents extra space below the image.
        *   `max-width: 100%; max-height: 100%;`: Ensures the image doesn't exceed the container dimensions.
        *   `object-fit: contain;`: Scales the image down to fit within the container while preserving its aspect ratio (letterboxing if necessary).
        *   `width: 100%; height: 100%;`: Makes the image *try* to fill the container, which works in conjunction with `object-fit: contain` to achieve the desired scaling.
    *   `width={$$props.width || undefined}` and `height={$$props.height || undefined}`: Passes any `width`/`height` found in the `NodeData.props` object to the native HTML attributes of the `<img>` tag. This can sometimes help the browser reserve space or provide hints, but the CSS handles the actual display scaling.

**Styling (`<style>`):**

*   `img`: Contains styles to prevent default browser dragging (`user-select: none; -webkit-user-drag: none;`). Other primary scaling styles are handled inline for clarity in this implementation.

---

### `src/lib/TextNode.svelte`

**Purpose:**

This component displays text content within a `BaseNode`. It supports multiline text and can optionally be made editable directly on the whiteboard via the `contenteditable` attribute.

**`<script lang="ts">`**

*   **Imports:** Svelte's `onMount` and the `BaseNode` component.
*   **Exports (Props):**
    *   `text: string`: The text content to display (defaults to 'New Text'). This prop is updated reactively when the content is edited.
    *   `fontSize: number`: The font size in pixels (defaults to 16).
    *   `editable: boolean`: Controls whether the text content can be edited (defaults to `true`).
*   **Internal State:**
    *   `initialText: string`: Stores the initial value of the `text` prop when the component mounts. This is necessary because directly binding `text` to `contenteditable`'s content can have unexpected behavior or performance issues, especially with complex updates. We render `initialText` and update the `text` prop separately.
    *   `element: HTMLDivElement`: A binding to the `div` element that displays the text.
*   **Functions:**
    *   `handleInput()`: An event handler triggered by the `input` event on the contenteditable `div`. It reads the current `innerText` of the element and updates the reactive `text` prop, allowing changes to be potentially saved or reflected elsewhere.
    *   `onMount`: Sets `initialText` to the value of the `text` prop when the component first renders.

**Template Structure:**

*   Uses the `BaseNode` component as a wrapper.
*   Inside `BaseNode`, it renders a `div` with the class `text-content`:
    *   `bind:this={element}`: Binds the DOM element for access in the script.
    *   `contenteditable={editable}`: Makes the div editable based on the prop.
    *   `style:font-size="{fontSize}px"`: Applies the font size dynamically.
    *   `on:input={handleInput}`: Calls the handler when the content changes.
    *   `on:mousedown|stopPropagation` and `on:wheel|stopPropagation`: Prevents the whiteboard from interpreting clicks/scrolls inside the text area as attempts to drag the node or zoom the canvas, allowing for normal text interaction (selection, scrolling within the div if needed).
    *   `{initialText}`: Renders the initial text content. Subsequent edits modify the DOM directly, and the `handleInput` function syncs the state back to the `text` prop.

**Styling (`<style>`):**

*   `.text-content`:
    *   `width: 100%`, `height: 100%`: Makes the text area fill the dimensions of the `BaseNode`.
    *   `padding`: Adds internal spacing.
    *   `white-space: pre-wrap;`: Preserves whitespace and line breaks entered by the user.
    *   `word-break: break-word;`: Prevents long words from overflowing horizontally.
    *   `cursor: text;`: Indicates text can be selected/edited.
    *   `box-sizing: border-box;`: Includes padding in the element's total dimensions.
    *   `overflow: auto;`: Adds scrollbars if the text content becomes larger than the node's dimensions (e.g., after resizing the node smaller).
    *   `line-height`: Improves readability.
*   `[contenteditable="true"]`: Adds a dashed outline to visually indicate when the text area is editable.
*   `[contenteditable="true"]:focus`: Changes the outline when the editable area receives focus.

---

### `src/lib/HelpModal.svelte`

**Purpose:**

A general-purpose, accessible modal dialog component used here to display command help. It handles visibility toggling, focus trapping within the modal when open, and closing via the Escape key or clicking the backdrop.

**`<script lang="ts">`**

*   **Imports:** Svelte's `createEventDispatcher`, `onMount`, `onDestroy`, transitions (`slide`, `fade`), and easing (`quintOut`).
*   **Exports (Props):**
    *   `show: boolean`: Controls whether the modal is visible (defaults to `false`). Can be bound (`bind:show`).
*   **Internal State:**
    *   `modalElement: HTMLDivElement`: Binding to the main modal content `div`.
    *   `closeButtonElement: HTMLButtonElement`: Binding to the close button.
*   **Event Dispatcher:**
    *   `dispatch = createEventDispatcher()`: Used to dispatch a `close` event when the modal should be closed.
*   **Functions:**
    *   `close()`: Dispatches the `close` event.
    *   `handleKeydown(event)`: Attached to the `window`. If the Escape key is pressed while the modal is shown (`show` is true), it calls `close()`.
    *   `trapFocus(event)`: Attached to the modal content `div`. Handles Tab and Shift+Tab key presses to keep focus cycling only within the modal's focusable elements, preventing focus from escaping to the underlying page.
*   **Lifecycle & Reactivity:**
    *   `onMount`: If the modal mounts as visible (`show` is true), it sets focus to the `closeButtonElement` after a minimal timeout (ensuring the element is rendered and transitions started).
    *   `$: if (show && ...)`: A reactive statement that re-focuses the close button whenever the `show` prop becomes true *after* the initial mount (e.g., if the modal is closed and then re-opened).

**Template Structure:**

1.  **`svelte:window on:keydown={handleKeydown}`:** Listens for keydown events globally to catch the Escape key.
2.  **`{#if show}`:** The entire modal structure is conditionally rendered based on the `show` prop.
3.  **Backdrop (`div.modal-backdrop`):**
    *   A semi-transparent overlay covering the whole screen.
    *   `on:click={close}`: Closes the modal when the backdrop is clicked.
    *   `transition:fade`: Applies a fade-in/out effect.
4.  **Modal Content (`div.modal-content`):**
    *   The main modal container.
    *   `bind:this={modalElement}`.
    *   ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) for accessibility.
    *   `on:keydown={trapFocus}`: Attaches the focus trapping logic.
    *   `transition:slide`: Applies a slide-in/out effect from the top.
5.  **Close Button (`button.close-button`):**
    *   Positioned absolutely within the modal content.
    *   `bind:this={closeButtonElement}`.
    *   `on:click={close}`.
    *   `aria-label` for accessibility.
    *   Contains an icon (`<i>`).
6.  **Title (`h2#help-modal-title`):** The modal title, linked by `aria-labelledby`.
7.  **Content Area (`div.help-text-content`):**
    *   Contains a `<slot />`, allowing the parent component (`+page.svelte`) to inject the actual help text HTML.

**Styling (`<style>`):**

*   `.modal-backdrop`: Fixed positioning, full screen coverage, semi-transparent background, high `z-index`.
*   `.modal-content`: Fixed positioning, centered horizontally (`left: 50%`, `transform: translateX(-50%)`), styled background/color, padding, border-radius, shadow, max dimensions, `overflow-y: auto` for scrollable content, and a higher `z-index` than the backdrop.
*   `.modal-title`: Basic title styling.
*   `.close-button`: Absolute positioning in the top-right, basic button reset styles, styling for the icon/text, hover/focus states.
*   `.help-text-content`: Sets font family (monospace), size, line-height, and `white-space: pre-wrap` for the slotted content.

---

### `src/routes/+page.svelte`

**Purpose:**

This is the main SvelteKit page route component. It instantiates the `Whiteboard` component, initializes it with some sample nodes, provides a command-line interface (input bar) at the bottom for interacting with the whiteboard via text commands, and uses the `HelpModal` to display available commands when requested.

**`<script lang="ts">`**

*   **Imports:** `Whiteboard`, `NodeData`, specific node components (`TextNode`, `ImageNode`), `HelpModal`, and Svelte's `onMount`.
*   **State:**
    *   `whiteboardInstance: Whiteboard`: Holds the instance of the Whiteboard component (bound using `bind:this`). Used to call its public API methods.
    *   `nodes: NodeData[]`: The array of node data passed to the Whiteboard component. Initialized with sample text and image nodes. This array is updated directly by some command functions (like `executeClearNodes` or potentially by getting the state back from the whiteboard if needed). Note the inclusion of `width` and `height` for the initial nodes.
    *   `commandInput: string`: Bound to the value of the command input field.
    *   `commandInputRef: HTMLInputElement`: Binding to the command input element itself (for focusing).
    *   `showHelpModal: boolean`: Controls the visibility of the `HelpModal`.
*   **`helpContent: string`:** A template literal string containing the formatted help text (using basic HTML like `<strong>` and `<em>`).
*   **Command Execution Functions (`execute...`)**:
    *   `executeAddTextNode(text?)`: Gets the whiteboard center using the instance's API, calculates a slightly random position, and calls `whiteboardInstance.addNode('text', ...)`.
    *   `executeAddImageNode(src?)`: Similar to text, gets center. Handles the special `upload` keyword to trigger a file input dialog. Uses `FileReader` to read the uploaded file as a data URL. Uses the `Image` constructor to preload the image (from URL or data URL) to attempt to get its `naturalWidth`/`naturalHeight` before calling `whiteboardInstance.addNode`, passing these dimensions in the `props` so the node can be sized appropriately initially. Includes error handling for image loading.
    *   `executeZoom(direction, factorStr?)`: Parses the factor, gets the current zoom via API, calculates the target zoom, and calls `whiteboardInstance.setZoom()`.
    *   `executeResetView()`: Calls `whiteboardInstance.panTo(0, 0)` and `whiteboardInstance.setZoom(1)`.
    *   `executeLogNodes()`: Logs the current state of the local `nodes` array (ideally kept in sync by the whiteboard binding).
    *   `executeClearNodes()`: Clears the local `nodes` array (which updates the whiteboard via the binding).
    *   `executeHelp()`: Sets `showHelpModal = true`.
*   **`parseAndExecuteCommand(fullCommand)`**:
    *   Trims the input.
    *   Uses a regex (`argsRegex`) to split the command into parts, respecting quotes.
    *   Identifies the command (first part, lowercased) and parameters.
    *   Checks if `whiteboardInstance` is ready before executing commands that need it.
    *   Uses a `switch` statement on the command to call the appropriate `execute...` function with the parameters.
    *   Includes aliases (e.g., `text` for `add text`) and error handling for unknown commands.
*   **Event Handlers:**
    *   `handleCommandInput(event)`: Listens for the Enter key in the command input (when the modal is *not* shown). If pressed, it prevents default form submission, executes the command via `parseAndExecuteCommand`, and clears the input.
    *   `closeHelpModal()`: Sets `showHelpModal = false` and returns focus to the command input.
*   **Lifecycle (`onMount`):**
    *   Sets initial focus to the command input.
    *   Includes a listener for the generic browser `zoom` event, attempting to prevent it if it doesn't originate from within the whiteboard wrapper (this might have limited effect depending on the browser).

**Template Structure:**

1.  **`main` element:** Uses flexbox to arrange the whiteboard and command bar vertically, filling the viewport height. `class:modal-open` might be used for global styles when modal is open (though not used in the provided CSS).
2.  **`div.whiteboard-wrapper`:** A container for the whiteboard, allowing it to grow and fill available space. `class:blur-content` applies a blur effect when the help modal is shown.
3.  **`<Whiteboard>` Component:**
    *   `bind:this={whiteboardInstance}`: Gets the component instance.
    *   `bind:nodes`: Two-way binding for the node data array.
4.  **`div.command-bar-container`:** The fixed bar at the bottom. `class:blur-content` applies blur when modal is shown.
    *   Contains a prompt (`>`).
    *   Contains the `<input>` field:
        *   `bind:this={commandInputRef}`.
        *   `bind:value={commandInput}`.
        *   `on:keydown={handleCommandInput}`.
        *   `placeholder`.
        *   `disabled={showHelpModal}`: Disables input when help is visible.
5.  **`<HelpModal>` Component:**
    *   `bind:show={showHelpModal}`.
    *   `on:close={closeHelpModal}`: Listens for the modal's close event.
    *   Injects the `helpContent` string into the default slot using `{@html ...}`. Includes `.replace()` calls to add CSS classes to the `<strong>` and `<em>` tags for specific styling within the modal.

**Styling (`<style>`):**

*   Global styles for `body, html` to remove margin/padding and ensure full height.
*   `main` layout styles (flex, height, background).
*   `.whiteboard-wrapper` styles (flex grow, position relative, transition for blur).
*   `.command-bar-container`: Flex layout, dark background, monospace font, fixed height (`flex-shrink: 0`), border, transition for blur.
*   `.prompt` styling.
*   `input[type='text']` styling (transparent background, color, font, no outline). Placeholder and disabled styles.
*   `.blur-content`: Applies `filter: blur(...) brightness(...)` to elements when the modal is open.
*   `:global(...)` rules for `.help-text-content`: Styles the command names (`strong.cmd-name`) and parameters (`em.cmd-param`) within the HTML injected into the help modal.

---