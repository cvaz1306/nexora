# Svelte Interactive Whiteboard

A simple interactive whiteboard application built with SvelteKit. This project demonstrates how to create a pannable, zoomable canvas where users can add, move, and resize different types of nodes (currently text and images).

## Key Features

*   **Infinite Canvas:** Pan and zoom smoothly around the whiteboard space.
*   **Node Types:** Add Text and Image nodes.
*   **Interactions:**
    *   Select nodes by clicking.
    *   Drag selected nodes to reposition them.
    *   Resize selected nodes using corner/side handles.
*   **Command-Line Interface:** Control the whiteboard via text commands entered in a bar at the bottom (e.g., `add text "Note"`, `add image upload`, `zoom in`).
*   **Help Modal:** Type `help` in the command bar to see available commands.
*   **Grid Background:** A dynamic grid visualizes the canvas space.
*   **TypeScript:** Built with TypeScript for type safety.
*   **Pointer Events:** Uses the Pointer Events API for unified mouse and touch input.

## Technology Stack

*   [SvelteKit](https://kit.svelte.dev/)
*   [Svelte 5](https://svelte.dev/)
*   [TypeScript](https://www.typescriptlang.org/)
*   HTML / CSS

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-folder>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or yarn install or pnpm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev -- --open
    ```
    This will start the Vite development server and open the application in your default browser, typically at `http://localhost:5173`.

## Usage

*   **Pan:** Click and drag the empty whiteboard background.
*   **Zoom:** Use the mouse wheel while hovering over the whiteboard.
*   **Select Node:** Click on a node.
*   **Drag Node:** Click and drag a selected node.
*   **Resize Node:** Click and drag the handles that appear around a selected node.
*   **Command Bar:** Type commands (like `help`, `add text ...`, `add image ...`, `zoom in`, `reset`) into the input field at the bottom and press Enter.