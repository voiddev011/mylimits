import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('./web',import.meta.url)),build:{outDir:'../web-dist',emptyOutDir:true,sourcemap:false},server:{host:'127.0.0.1'},oxc:{jsx:{runtime:'automatic'}}});
