import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

export default defineConfig({
	server: {
		host: true, // Accept external connections
		port: 5173,
		hmr: {
			protocol: 'ws',
			host: 'localhost',
			port: 5173,
			clientPort: 5173,
		},
	},
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide'
		})
	]
});
