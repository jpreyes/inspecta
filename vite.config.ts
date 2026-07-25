import os from 'node:os'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// El proyecto vive dentro de Dropbox, que bloquea node_modules/.vite al
// sincronizar → "EBUSY: rename" al reoptimizar deps → página en blanco.
// Movemos la caché de Vite fuera de Dropbox (temp del sistema).
const cacheDir = path.join(os.tmpdir(), 'vite-inspecta')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // En DEV, proxeamos '/api' (y '/_/' admin) al PocketBase local, así el código
  // de la app usa el mismo origen que en producción. No cambia nada al desplegar.
  // Inspecta usa el puerto 8097 (para no chocar con otras apps PocketBase en :8090+).
  const pbTarget = env.VITE_PB_URL || 'http://127.0.0.1:8097'

  return {
  cacheDir,
  server: {
    proxy: {
      '/api': { target: pbTarget, changeOrigin: true },
      '/_': { target: pbTarget, changeOrigin: true },
    },
  },
  plugins: [
    vue({
      // TresJS internal elements (<TresMesh>, etc.) los maneja su renderer propio,
      // así que le decimos a Vue que no los resuelva como componentes.
      // OJO: <TresCanvas> SÍ es un componente Vue real (provee el contexto) → excluirlo.
      template: {
        compilerOptions: {
          isCustomElement: (tag) =>
            (tag.startsWith('Tres') && tag !== 'TresCanvas') || tag === 'primitive',
        },
      },
    }),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Inspecta — Inspecciones Estructurales',
        short_name: 'Inspecta',
        description: 'Inspecciones estructurales con gemelo digital 3D y línea de tiempo',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  }
})
