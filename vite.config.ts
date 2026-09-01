import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// El proyecto vive dentro de Dropbox, que bloquea node_modules/.vite al
// sincronizar → "EBUSY: rename" al reoptimizar deps → página en blanco.
// Movemos la caché de Vite fuera de Dropbox (temp del sistema).
const cacheDir = path.join(os.tmpdir(), 'vite-inspecta')

/**
 * Sirve `web-ifc.wasm` con NOMBRE FIJO en la raíz.
 *
 * web-ifc lo busca por ruta (`SetWasmPath('/')` → pide `/web-ifc.wasm`), así que
 * no sirve dejar que Vite lo trate como un asset con hash: hay que emitirlo tal
 * cual. Y no se commitea en `public/` porque son 1,3 MB de binario que ya vienen
 * en node_modules y quedarían desincronizados con la versión del paquete.
 */
function webIfcWasm(): Plugin {
  const source = path.join(process.cwd(), 'node_modules/web-ifc/web-ifc.wasm')
  return {
    name: 'inspecta:web-ifc-wasm',
    configureServer(server) {
      server.middlewares.use('/web-ifc.wasm', (_req, res) => {
        res.setHeader('Content-Type', 'application/wasm')
        fs.createReadStream(source).pipe(res)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'web-ifc.wasm', source: fs.readFileSync(source) })
    },
  }
}

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
    webIfcWasm(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Inspecta — Inspecciones Estructurales',
        short_name: 'Inspecta',
        description: 'Inspecciones estructurales periódicas con gemelo digital 3D',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        // Separados a propósito. Un mismo archivo marcado `any maskable` no
        // puede servir para las dos cosas: `maskable` se recorta a un círculo,
        // así que necesita margen de seguridad, y `any` tiene que llenar el
        // cuadro o se ve chico y flotando. Antes era uno solo con las dos
        // marcas, y perdía por los dos lados.
        //
        // Y van PNG además del SVG: los lanzadores de Android siguen
        // prefiriéndolos, e iOS ni siquiera mira el manifest (usa
        // `apple-touch-icon`, que va en index.html).
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // web-ifc queda FUERA del precache, tanto su JS (3,5 MB) como su WASM
        // (1,3 MB). Precachearlos costaría casi 5 MB de datos móviles a CADA
        // inspector en terreno por una función que se usa una vez, sentado en
        // el escritorio, al dar de alta la estructura. Y precachear solo el
        // .wasm no serviría de nada: sin su JS no se puede usar.
        //
        // Consecuencia asumida: importar un IFC necesita conexión la primera
        // vez. El gemelo ya importado sí funciona sin señal — el archivo del
        // modelo se cachea aparte, en IndexedDB (ver db/index.ts).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/web-ifc*'],
      },
    }),
  ],
  }
})
