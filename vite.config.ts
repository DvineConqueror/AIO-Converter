import { defineConfig } from 'vite';
export default defineConfig(({ command }) => ({ base: './', plugins: command === 'serve' ? [{ name: 'development-style-policy', transformIndexHtml: html => html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") }] : [], server: { host: '127.0.0.1', port: 5173, strictPort: true }, build: { outDir: 'dist' } }));
