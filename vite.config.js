import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// onnxruntime-web needs its .wasm binaries served as static files.
// This copies them from node_modules into /ort at build/dev time.
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
      .filter((name) => !env[name]?.trim());
    if (missing.length) {
      throw new Error(`Konfigurasi Supabase belum lengkap: ${missing.join(', ')}. Isi .env atau Environment Variables di Vercel sebelum build.`);
    }
  }

  return {
    plugins: [
      // Only E2E builds substitute the report-page detector. Direct model tests
      // still import the real YOLO module; production never includes this hook.
      mode === 'e2e' && {
        name: 'report-detector-test-fixture',
        enforce: 'pre',
        resolveId(source, importer) {
          if (importer?.endsWith('/src/pages/ReportPage.jsx') && source === '../ai/yolo.js') {
            if (process.env.VITE_SUPABASE_URL !== 'http://127.0.0.1:54321') {
              throw new Error('E2E detector requires the isolated test backend.');
            }
            return fileURLToPath(new URL('./tests/fixtures/report-detector.js', import.meta.url));
          }
        }
      },
      react(),
      viteStaticCopy({
        targets: [
          {
            src: ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs'],
            dest: 'ort'
          }
        ]
      })
    ],
    server: {
      port: 5173
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/onnxruntime')) return 'onnx-runtime';
            if (id.includes('node_modules/d3-')) return 'chart-math';
            if (id.includes('node_modules/recharts')) return 'charts';
            if (id.includes('node_modules/leaflet')) return 'maps';
          }
        }
      }
    }
  };
});
