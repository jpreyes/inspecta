# Inspecta — Inspecciones estructurales con gemelo digital

Prototipo web/PWA para **inspecciones estructurales periódicas en terreno**, con
gemelo digital 3D y trabajo offline-first. El paradigma es el de `structapp-base`:
inspecciones periódicas (visitas discretas a terreno con su fecha, hallazgos, ensayos,
condición y reporte), **no** monitoreo en tiempo real (eso es SHM, otro producto —
p.ej. `wind-shm`). Del 3D de wind-shm solo se toma la idea visual del gemelo digital.
Pensado para compartir stack con el presupuestador `Scopes` (ambos Vue 3 + Vite + Tailwind).

## Stack

- **Vue 3 + Vite + TypeScript**
- **Tailwind CSS 4** (`@tailwindcss/vite`)
- **TresJS** (`@tresjs/core`, `@tresjs/cientos`) — Three.js declarativo para el gemelo 3D
- **Pinia** — estado
- **Dexie (IndexedDB)** — persistencia offline-first
- **vite-plugin-pwa** — instalable, service worker, funciona sin señal
- **PocketBase** — backend (auth + datos + fotos con thumbnails), self-host en 1 binario
- Geolocalización: solo **GPS del hallazgo/daño** (sin mapa Leaflet)

## Backend PocketBase (portable)

La web es **estática e independiente** del backend. El código habla siempre al
mismo origen `/api`, así que mover la web al VPS no requiere cambios:

- **Producción**: la app compilada (`dist/`) se sirve desde `pb_public/` del propio
  PocketBase → `/api` ya es PocketBase, mismo dominio, cero configuración.
- **Desarrollo**: Vite proxea `/api` a tu PocketBase local (`VITE_PB_URL`, por
  defecto `http://127.0.0.1:8097`). El código de la app es idéntico local y en el VPS.
- **Sin PocketBase**: la app funciona 100% offline (IndexedDB/Dexie). El backend es
  la capa de sync/compartir, no un requisito para operar.

Capa de backend en `src/sync/` (`pocketbase.ts` = cliente, `backend.ts` = adaptador
intercambiable). Ver `DEPLOY.md`.

## Cómo correr

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción + PWA
```

## Qué hay hoy (v0)

- **Gemelo digital 3D** paramétrico (pórtico de HA generado desde grilla: vanos,
  pisos, alturas). Cada elemento (columna/viga) se colorea por su **severidad
  vigente** en la inspección seleccionada. Click para seleccionar; pins 3D por hallazgo.
- **Jerarquía** Proyecto ▸ Estructura ▸ Elemento en el sidebar, con punto de salud.
- **Selector de inspecciones periódicas**: campañas discretas (visitas) seleccionables.
  Al elegir una, el gemelo muestra el estado *a esa visita* (último hallazgo por elemento
  en o antes de esa fecha) → permite comparar la **evolución del daño entre inspecciones**.
- **Ficha de inspección**: registrar hallazgo (tipo de daño, severidad 0–4,
  extensión %, observaciones, **fotos** vía cámara → base64), listado y borrado.
- **Scoring determinístico**: índice de condición por hallazgo y global por estructura.
- **Persistencia offline** en IndexedDB con datos semilla (edificio demo UACh, 2 campañas).

## Roadmap sugerido

- [x] Colocar el **pin exactamente donde se hace click** en la superficie 3D (raycast).
- [x] **Vista de Resultados** "de una sola mirada" (condición semáforo, KPIs, distribución por
      severidad, evolución por campaña, hallazgos priorizados, ensayos). Toggle Gemelo 3D ↔ Resultados.
- [x] **Ensayos** como entidad (esclerometría, carbonatación… tipo/método/norma/lab/muestra/resultado).
- [ ] **CRUD en Supabase** de proyectos/estructuras/campañas/hallazgos/ensayos (hoy solo IndexedDB local).
- [ ] **GPS** del dispositivo al crear hallazgo (geolocalización del daño, sin mapa).
- [ ] **Informe PDF** real (hoy usa print del navegador) con score, condición y fotos.
- [ ] Restringir el pin al **elemento seleccionado** (hoy se puede clavar en cualquier malla).
- [ ] Editor paramétrico de la estructura (cambiar grilla en vivo).
- [ ] **Reportes de campo** (PDF/Excel) reusando lo de `Scopes`.
- [ ] Rating **IA** de fotos (severidad sugerida) — capa opcional.
- [ ] Sincronización con backend (Supabase) cuando hay señal.
- [ ] Comparador lado a lado de dos campañas (diff de daño).

## Estructura

```
src/
  types/inspection.ts     # modelo de dominio + scoring + taxonomía de daño
  data/generate.ts        # generador paramétrico del pórtico 3D
  data/seed.ts            # datos demo
  db/index.ts             # Dexie / IndexedDB (offline)
  stores/inspection.ts    # store Pinia (estado por inspección periódica seleccionada)
  components/
    layout/TopBar.vue      layout/Sidebar.vue
    twin/TwinCanvas.vue    # gemelo digital 3D (TresJS)
    inspection/InspectionSelector.vue  # selector de campañas periódicas
    inspection/InspectionPanel.vue  # ficha + formulario de hallazgo
```
