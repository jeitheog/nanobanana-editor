import { defineConfig } from 'vite';

export default defineConfig({
    root: './',
    server: {
        port: 8080,
        open: true,
        proxy: {
            '/api': 'http://localhost:3001'
        }
    },
    build: {
        outDir: 'dist'
    }
});
