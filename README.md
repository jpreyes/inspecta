# Inspecta — Inspecciones estructurales con gemelo digital

App web/PWA para **inspecciones estructurales periódicas en terreno**, con gemelo
digital 3D opcional y trabajo **offline-first**. El paradigma es el de inspecciones
periódicas (visitas discretas con su fecha, hallazgos, ensayos, condición y reporte),
**no** monitoreo en tiempo real (eso es SHM, otro producto). Del 3D solo se toma la
idea visual del gemelo digital.

## Stack

- **Vue 3 + Vite + TypeScript**
- **Tailwind CSS 4** (`@tailwindcss/vite`)
- **TresJS** (`@tresjs/core`, `@tresjs/cientos`) — Three.js declarativo para el gemelo 3D
- **Pinia** — estado
- **Dexie (IndexedDB)** — persistencia offline-first
- **vite-plugin-pwa** — instalable, service worker, funciona sin señal
- **docx** — informe Word generado en el cliente
- **PocketBase** — backend opcional (auth + datos + fotos), self-host en 1 binario

## Cómo correr

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción + PWA (vue-tsc -b, estricto)
```

Herramienta de calibración del scoring: `npx tsx scripts/calibrate.ts`.

## Funcionalidad

### Catálogo por tipo de estructura
`src/data/catalog.ts` (generado por `scripts/build_catalog_ts.py`) define, para
**edificio** y **puente**: componentes → elementos (con materiales y zonas), deterioros
(con material y criterios de gravedad en 4 bandas) y causas por deterioro. El puente
se deriva del maestro `Gravedades_Base.xlsx` enriquecido con materialidad y anclajes.
Cada campo admite "Otro" (texto libre).

### Registro de daños ("daño primero")
Un botón **Nuevo daño** abre un formulario en cascada: Componente → Elemento → Material
→ Zona → Tipo de daño → Causa, con severidad (0–4), extensión (%), observaciones y
**fotos** (cámara → base64). Si se abre desde el gemelo, el hallazgo queda atado al
elemento 3D (colorea la malla).

### Condición (índice de salud 0–100, 100 = sano)
`src/types/inspection.ts`. Modelo jerárquico hallazgo → elemento → estructura, con dos
agregadores:
- **Edificio** (redundante): promedio ponderado por importancia + override por elemento
  primario + **agregación por piso** (concentración tipo piso blando gobierna). Los
  elementos **no estructurales** (tabiques) no afectan la condición estructural.
- **Puente** (serie): peor-caso más fuerte.

La causa no entra en la condición: alimenta la **prioridad de intervención**
(`findingPriority` = daño × riesgo de la causa). Inspirado en España (G·K1·K2),
AASHTO/BCI, PCI deduct y ATC-20/EMS-98.

### Vulnerabilidad por configuración (registro)
`src/data/vulnerability.ts`. Catálogo de irregularidades **NCh433 / ASCE 7** (planta
12.3-1, elevación 12.3-2, más mecanismos locales: columna corta, golpeteo, viga
fuerte-columna débil, pórtico-tabique). Se **registran** cuáles hay y su nivel; no se
agregan en un índice (su peligrosidad depende del sismo y de un análisis).

### Amenaza sísmica y riesgo
`src/data/hazard.ts`. Índice de amenaza/exposición desde el sitio (zona sísmica, tipo
de suelo DS61, categoría de ocupación NCh433). **Riesgo = matriz(condición × amenaza)**.

### Gemelo digital 3D (opcional)
Pórtico paramétrico (TresJS) generado desde grilla; cada elemento se colorea por su
severidad vigente en la campaña seleccionada. Estructuras sin modelo 3D se trabajan por
lista/jerarquía.

### Campañas periódicas
Selector de inspecciones (visitas discretas). Al elegir una, el gemelo/lista muestran el
estado *a esa fecha* → permite comparar la **evolución entre inspecciones**.

### CRUD y datos
- Proyectos y estructuras (crear/editar/eliminar en el sidebar, borrado en cascada).
- Inspecciones y ensayos (esclerometría, carbonatación…).
- Vista de **Resultados** "de una sola mirada": KPIs, distribución por severidad,
  evolución por campaña, riesgo/vulnerabilidad/sitio, hallazgos priorizados y ensayos.
- **Informe Word (.docx)** generado en el cliente (`src/report/docx.ts`).

### Offline-first + sync opcional (PocketBase)
Todo vive en IndexedDB; la app funciona 100% sin señal. El backend PocketBase es una
capa opcional de sync/compartir. La web habla siempre al mismo origen `/api`, así que
servir `dist/` desde `pb_public/` no requiere cambios de código. Ver `DEPLOY.md`.

## Estructura

```
src/
  types/inspection.ts       # dominio + scoring (condición, prioridad)
  data/catalog.ts           # catálogo edificio/puente (generado)
  data/vulnerability.ts     # irregularidades NCh433/ASCE 7 + riesgo
  data/hazard.ts            # amenaza sísmica NCh433
  data/generate.ts          # generador paramétrico del pórtico 3D
  data/seed.ts              # datos demo
  db/index.ts               # Dexie / IndexedDB (offline)
  stores/inspection.ts      # store Pinia
  report/docx.ts            # informe Word
  sync/                     # capa PocketBase (opcional)
  ui/icons.ts, damage-icons.ts   # íconos de daño (SVG propios)
  components/
    layout/{TopBar,Sidebar}.vue
    twin/TwinCanvas.vue
    list/DamageListView.vue
    results/{ResultsView,VulnerabilityPanel}.vue
    inspection/{InspectionSelector,InspectionPanel,DamageForm}.vue
scripts/
  build_catalog_ts.py       # genera data/catalog.ts
  calibrate.ts              # banco de calibración del scoring
```
