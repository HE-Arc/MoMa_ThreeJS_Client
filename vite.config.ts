import { defineConfig } from 'vite'

export default defineConfig({
  base: '/MoMa_ThreeJS_Client/',
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  optimizeDeps: {
    exclude: ['@mori2003/jsimgui']
  },
  assetsInclude: ['**/*.wasm']
})

