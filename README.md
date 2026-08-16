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
- Inspecciones y ensayos (esclerometría, carbonatación…), con **atajos de ensayos
  frecuentes** (`src/data/tests.ts`) que rellenan método y norma para que el inspector
  solo escriba laboratorio, muestra y resultado.
- Vista de **Resultados** "de una sola mirada": KPIs, distribución por severidad,
  evolución por campaña, riesgo/vulnerabilidad/sitio, hallazgos priorizados y ensayos.
- **Informe Word (.docx)** generado en el cliente (`src/report/docx.ts`).

### Offline-first + sync opcional (PocketBase)
Todo vive en IndexedDB; la app funciona 100% sin señal. El backend PocketBase es una
capa opcional de sync/compartir. La web habla siempre al mismo origen `/api`, así que
servir `dist/` desde `pb_public/` no requiere cambios de código. Ver `DEPLOY.md`.

El push **filtra por permiso antes de enviar** (`src/sync/engine.ts`): el pull baja los
proyectos y estructuras del equipo, que un inspector no puede escribir, y devolverlos
sin filtro terminaba en 404 — un error que tumbaba la corrida entera y le dejaba la
sincronización servible una sola vez. Hoy se omiten en silencio (se informan como
"Omitidos N") y ningún registro rechazado interrumpe al resto.

### Guía guiada de la plataforma
`src/data/tour.ts` + `src/components/tour/TourOverlay.vue`. Trece pasos que iluminan
elementos reales de la interfaz (`data-tour="…"`) y llevan la app a la vista donde ese
elemento existe: conectarse → equipo y rol → estructuras → campañas → registrar daños →
tabla → condición → vulnerabilidad y sitio → ensayos → informe → sincronizar. Se abre
sola la primera vez en cada dispositivo (marca en `localStorage`) y se reabre con el
botón **Guía** de la barra superior. El elemento iluminado **sigue siendo clickeable**:
se puede probar lo que se está explicando sin salir de la guía.

El último paso ofrece **borrar los datos de demostración** del dispositivo. Esa siembra
(`src/data/seed.ts`) tiene ids fijos, así que es la misma en todos los dispositivos:
por eso el motor de sync no la sube nunca —el segundo usuario chocaría contra ids ya
tomados por el primero— y por eso, una vez borrada, no se vuelve a sembrar.

### Equipos, roles y trazabilidad
`src/types/team.ts`. Un **equipo** agrupa proyectos, estructuras y campañas, y tiene
miembros con un rol cada uno:

| Rol | Gestiona el equipo | Proyectos y estructuras | Campañas, hallazgos, ensayos | Ver e informar |
|---|---|---|---|---|
| Administrador | ✅ | ✅ | ✅ (todas) | ✅ |
| Inspector | — | — | ✅ (solo asignadas) | ✅ |
| Revisor | — | — | — | ✅ |
| Cliente | — | — | — | ✅ |

Los roles se guardan como **cuatro listas de usuarios en el propio equipo**
(`admins`/`inspectors`/`reviewers`/`clients`), no en una colección `memberships`:
en PocketBase las condiciones sobre una relación multi-valor se evalúan de forma
independiente entre filas, así que "la misma membresía tiene este usuario Y este rol"
no es expresable de forma confiable en una regla. Con listas por rol, cada regla mira
un solo campo y la autorización real la impone el servidor, no la interfaz.

**Dos trampas de PocketBase con estas listas** (ambas costaron caro, ver
`pb_migrations/1721000400`–`402`): una relación es múltiple solo si `maxSelect > 1`
—`maxSelect: 0` **no** significa "sin límite", deja el campo en un solo registro—, y
sobre una relación múltiple la regla tiene que decir contra qué compara:
`admins.id ?= @request.auth.id`. La forma corta `admins ?= @request.auth.id` funciona
sobre una relación simple y devuelve **cero** sobre una múltiple, así que al corregir
el campo las reglas dejan de calzar y el equipo se vuelve invisible para sus miembros
— con el agravante de que el cliente, al no reconocer ningún rol, cae en "modo local"
y ofrece permiso total en la interfaz contra un servidor que sí restringe.
Los valores guardados sí los convierte PocketBase solo al ampliar el campo
(comprobado: `'abc'` → `'["abc"]'`).

**Asignación por estructura.** El rol define *qué* puede hacer alguien; la asignación
define *dónde*. Cada estructura tiene su lista de inspectores (`structures.inspectors`),
y es muchos-a-muchos: Juan puede atender el Puente X y el Y, y Carlos el Z y también
el Y. Un inspector solo registra campañas, hallazgos y ensayos en las estructuras que
tiene asignadas.

Una estructura **sin asignados queda abierta** a todos los inspectores del equipo —
así el modelo es retrocompatible y no hay que asignar nada para empezar a trabajar.
Asignar es competencia del administrador (`structures` solo lo actualiza él). Los
revisores y clientes no se asignan: su acceso es de lectura sobre todo el equipo.

**Sin equipo la app está en modo local**: sin sesión los datos son de ese dispositivo,
no hay a quién restringir y el acceso es completo — es lo que mantiene intacto el
offline-first. Los permisos solo aplican cuando hay sesión y equipo activo.

Las **cuentas no se crean desde la app**: se crean en el panel de PocketBase (`/_/`),
y desde la app se invita por email a un usuario que ya existe. El auto-registro viene
cerrado a propósito (`pb_migrations/1721000200_close_signup.js`).

**Trazabilidad**: campañas, hallazgos y ensayos guardan `author` (quién lo registró).
El nombre se denormaliza en local (`authorName`) para que el informe muestre el autor
aunque se genere sin conexión. Aparece en la lista de daños y en el informe Word.

## Estructura

```
src/
  types/inspection.ts       # dominio + scoring (condición, prioridad)
  types/team.ts             # equipos, roles y matriz de permisos
  data/catalog.ts           # catálogo edificio/puente (generado)
  data/vulnerability.ts     # irregularidades NCh433/ASCE 7 + riesgo
  data/hazard.ts            # amenaza sísmica NCh433
  data/generate.ts          # generador paramétrico del pórtico 3D
  data/tests.ts             # atajos de ensayos frecuentes (tipo/método/norma)
  data/tour.ts              # pasos de la guía guiada
  data/seed.ts              # datos demo (ids fijos: nunca se sincronizan)
  db/index.ts               # Dexie / IndexedDB (offline)
  stores/inspection.ts      # store Pinia
  report/docx.ts            # informe Word
  sync/                     # capa PocketBase (opcional)
  ui/icons.ts, damage-icons.ts   # íconos de daño (SVG propios)
  components/
    layout/{TopBar,Sidebar}.vue
    team/TeamPanel.vue        # equipo activo, miembros, invitar, roles
    tour/TourOverlay.vue      # guía guiada (spotlight + tarjeta por paso)
    twin/TwinCanvas.vue
    list/DamageListView.vue
    results/{ResultsView,VulnerabilityPanel}.vue
    inspection/{InspectionSelector,InspectionPanel,DamageForm}.vue
scripts/
  build_catalog_ts.py       # genera data/catalog.ts
  calibrate.ts              # banco de calibración del scoring
```
