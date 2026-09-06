import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// onnxruntime-web needs its .wasm binaries served as static files.
// This copies them from node_modules into /ort at build/dev time.
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/onnxruntime-web/dist/*.wasm',
          dest: 'ort'
        }
      ]
    })
  ],
  server: {
    port: 5173
  }
});
