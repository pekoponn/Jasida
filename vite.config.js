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
  };
});
