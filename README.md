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

**Estructural vs. no estructural.** El formulario abre con un selector de ámbito que
cambia el catálogo completo. `src/data/nonstructural.ts` cubre lo que no resiste pero
igual hay que inspeccionar: tabiques y cielos, revestimientos y fachada, cubierta y
aguas lluvias, ventanas y cristales, barandas y terminaciones, instalaciones y equipos
anclados, y el exterior. Esos hallazgos **se registran, se fotografían y salen en el
informe, pero no entran en la calificación** — es la separación de ATC-20 / EMS-98, y
ahora aplica a todo tipo de estructura (antes solo excluía `Tabique` y
`Antepecho / parapeto`, y solo en edificio).

El ámbito se guarda **explícito** en `Finding.nonStructural`, no se deduce del nombre:
cada campo admite "Otro…" y un "Cielo americano del hall" escrito a mano no calzaría
con ninguna lista. Los hallazgos anteriores al campo sí se resuelven por nombre
(`NONSTRUCT_BY_NAME`), y el push los normaliza al subir.

### Condición (índice de salud 0–100, 100 = sano)
`src/types/inspection.ts`. Modelo jerárquico hallazgo → elemento → estructura, con dos
agregadores:
- **Edificio** (redundante): promedio ponderado por importancia + override por elemento
  primario + **agregación por piso** (concentración tipo piso blando gobierna).
- **Puente** (serie): peor-caso más fuerte.

Los hallazgos **no estructurales se descartan de entrada**, en `inspectionScore` y para
cualquier tipo de estructura. Antes el filtro vivía dentro del roll-up de edificio, así
que en puente no aplicaba; y reconocía solo dos nombres de elemento.

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
Dos orígenes, y **los dos se pueden poner en cualquier momento** desde el editor de la
estructura (antes la casilla solo existía al crear, y solo para edificios: quien no la
marcaba se quedaba sin 3D para siempre):

- **Pórtico paramétrico** generado desde una grilla (vanos X/Z, pisos).
- **Modelo importado** desde **IFC** o **glTF/GLB** (`src/model/`).

Un modelo importado se dibuja con su **geometría real** (TresJS `<primitive>`), no como
cajas. Cada malla lleva `userData.elementId`, que es el puente con la capa semántica:
sin él el modelo sería una foto y no habría a qué colgarle un hallazgo.

| | IFC (`web-ifc`) | glTF / GLB (`GLTFLoader`) |
|---|---|---|
| De dónde sale | Revit, ArchiCAD, Tekla, BlenderBIM | Blender, SketchUp, Rhino |
| Tipo de elemento | lo **declara** el archivo (IfcColumn, IfcBeam, IfcSlab, IfcWall, IfcFooting…) | se deduce del **nombre** del objeto (`src/model/naming.ts`) |
| Piso | de la estructura espacial (`IfcRelContainedInSpatialStructure` → `IfcBuildingStorey`, ordenados por cota) | se estima por la altura del centro |
| Peso | ~3,5 MB de JS + 1,3 MB de WASM, con `import()` dinámico | ~46 kB, ya viene en `three` |

**Tres cosas medidas, no supuestas** (ver `scripts/check-model-import.mjs`):

1. **web-ifc ya normaliza a metros.** Un IFC declarado en milímetros devolvió un pilar
   de 400×3200 mm como `0.40 × 3.20`. Aplicarle además el factor del `IfcUnitAssignment`
   lo encogía 1000 veces y dejaba el edificio del porte de una moneda. No se convierten
   unidades a mano; solo queda una comprobación de tamaño como red de seguridad.
2. **Los contenedores espaciales entran como mallas.** De 7 "mallas" de un IFC de
   prueba, 3 eran `IfcSite`, `IfcBuilding` e `IfcBuildingStorey` con caja de tamaño cero.
   Sin filtrarlos aparecían en el árbol como elementos fantasma llamados "Edificio".
3. **El archivo NO se baja en el sync.** Un IFC son megabytes que en terreno se pagan
   con datos móviles, así que la descarga es bajo demanda (`ensureModelFile`) al abrir de
   verdad la vista 3D; después queda en IndexedDB y funciona sin señal. Por lo mismo
   web-ifc queda fuera del precache del service worker: importar necesita conexión la
   primera vez, el gemelo ya importado no.

Estructuras sin modelo 3D se trabajan por lista/jerarquía, como siempre.

### Campañas periódicas
Selector de inspecciones (visitas discretas). Al elegir una, el gemelo/lista muestran el
estado *a esa fecha* → permite comparar la **evolución entre inspecciones**.

### CRUD y datos
- Proyectos y estructuras (crear/editar/eliminar en el sidebar, borrado en cascada).
- Inspecciones y ensayos (esclerometría, carbonatación…), con **atajos de ensayos
  frecuentes** (`src/data/tests.ts`) que rellenan método y norma para que el inspector
  solo escriba laboratorio, muestra y resultado. Los ensayos tienen **vista propia** en
  la barra superior (`src/components/tests/TestsView.vue`): antes vivían al final de
  Resultados, y para agregar una esclerometría había que cambiar de vista y bajar por
  toda la pantalla de KPIs — con el teléfono en una mano, en terreno, simplemente no se
  registraban. La vista trae también el selector de campañas, porque un ensayo cuelga de
  una campaña y lo primero que falta suele ser la campaña del año.
- Vista de **Resultados** "de una sola mirada": KPIs, distribución por severidad,
  evolución por campaña, riesgo/vulnerabilidad/sitio, hallazgos priorizados y ensayos.
- **Informe Word (.docx)** generado en el cliente (`src/report/docx.ts`).

### Sesión obligatoria (y offline dentro de un plazo)
Los proyectos son del equipo y viven en el servidor, no en el dispositivo: **sin sesión
la app no muestra ningún dato**, solo la pantalla de entrada (`src/components/auth/`).
La primera entrada necesita internet, porque la clave la valida el servidor.

Después la sesión sirve **sin señal**: al arrancar, si hay conexión se revalida sola
contra PocketBase (`authRefresh`) —así una cuenta revocada deja de entrar— y si no la
hay, vale mientras la última validación exitosa tenga menos de **14 días**
(`GRACE_DAYS` en `src/stores/inspection.ts`); pasado ese plazo pide internet. Cerrar
sesión oculta todo y exige conexión para volver, así que conviene sincronizar antes;
la app lo advierte. Si entra otra cuenta en el mismo dispositivo, los datos locales del
anterior se borran (son de otra persona).

### Offline-first + sync opcional (PocketBase)
Todo vive en IndexedDB; la app funciona 100% sin señal mientras la sesión esté vigente.
El backend PocketBase es la fuente de los datos y la capa de sync/compartir. La web habla siempre al mismo origen `/api`, así que
servir `dist/` desde `pb_public/` no requiere cambios de código. Ver `DEPLOY.md`.

**El trabajo del equipo llega solo** (`src/sync/realtime.ts`). El sync es una corrida
puntual: sirve para ponerse al día, pero dejaba un hueco de operación — mientras una
inspectora registraba daños en terreno, quien tenía la app abierta no veía nada hasta
volver a entrar. Ahora hay una suscripción SSE a `/api/realtime` sobre las cinco
colecciones, y al volver la app al primer plano (o al recuperar la conexión) se
resincroniza, estrangulado a una vez por minuto. La lista muestra **En vivo** cuando la
escucha está abierta y **Sin conexión** cuando no.

Dos cosas que un `put` a secas rompía, y por eso el pull y el tiempo real pasan por
`src/sync/apply.ts`:

- **Las fotos sin subir.** El registro remoto solo conoce los archivos que ya están en
  PocketBase; guardarlo encima borraba la foto tomada sin señal antes de que subiera.
- **El gemelo recién importado.** Entre importarlo y que el archivo suba, el servidor
  tiene el metadato pero no el archivo y devuelve la estructura sin modelo: guardarlo
  destruía la geometría local y dejaba el blob huérfano, sin nada que lo resubiera.

La app abre **una campaña a la vez**, así que el trabajo registrado en otra campaña se ve
igual que si no existiera. Por eso cada fecha del selector lleva el número de daños y
ensayos que tiene, y la lista avisa cuántos hallazgos hay en otras campañas.

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

El último paso ofrece **borrar los datos de ejemplo** del dispositivo. Esa siembra
(`src/data/seed.ts`) se instala al iniciar sesión, lleva la palabra "ejemplo" en el
nombre —convive en el árbol con los encargos reales y sin la marca se confunden— y
tiene ids fijos, así que es la misma en todos los dispositivos: por eso el motor de
sync no la sube nunca (el segundo usuario chocaría contra ids ya tomados por el
primero) y por eso, una vez borrada, no se vuelve a sembrar.

> **Ojo al desplegar:** la app es una PWA con `registerType: 'autoUpdate'`. El
> service worker sirve el bundle cacheado hasta que la siguiente visita instala el
> nuevo, así que tras publicar hay que **recargar** para tomar los cambios — un cliente
> viejo sigue comportándose como antes (nos pasó: un navegador con la versión previa
> subió al servidor la siembra de ejemplo que la nueva ya no sube).

### Equipos, roles y trazabilidad
`src/types/team.ts`. Un **equipo** agrupa proyectos, estructuras y campañas, y tiene
miembros con un rol cada uno:

| Rol | Gestiona el equipo | Proyectos y estructuras | Campañas, hallazgos, ensayos | Ver e informar |
|---|---|---|---|---|
| Administrador | ✅ | ✅ | ✅ (todas) | ✅ |
| Inspector | — | — | ✅ (solo asignadas) | ✅ |
| Revisor | — | — | — | ✅ (todo el equipo) |
| Cliente | — | — | — | ✅ (solo sus proyectos) |

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
Asignar es competencia del administrador (`structures` solo lo actualiza él).

**Asignación por proyecto, para los clientes** (`projects.clients`,
`pb_migrations/1788400100`). El cliente es de solo lectura, pero eso no dice *cuánto*
lee: un equipo que atiende a varios mandantes no puede mostrarle a cada uno el trabajo
de los demás. Un cliente ve únicamente los proyectos donde está asignado, y con ellos
sus estructuras, campañas, hallazgos y ensayos; el resto del equipo sigue viendo todo.

Acá la convención es **la contraria** a la de los inspectores: una lista de clientes
vacía no abre el proyecto, lo cierra. Heredar el acceso del equipo es justamente lo que
se está corrigiendo, así que falla cerrado — sin asignación explícita, ningún cliente
ve el proyecto. Se marca en el editor de proyectos del árbol lateral, y no hay que
confundirlo con el campo «Cliente» de al lado, que es el *nombre* del mandante para el
informe. Los revisores no se asignan: leen todo el equipo.

**El `owner` ya no abre puertas en un registro de equipo.** Las reglas traían de arrastre
`owner = @request.auth.id` para que los registros personales anteriores a los equipos
siguieran siendo accesibles; esos tienen `team = ''`, así que la salida quedó acotada a
ellos. Sobre un registro de equipo era un agujero: quien creó algo y después bajó a
cliente lo seguía editando y borrando.

**Y una grieta en la creación, que el hook cierra** (`pb_hooks/keep_team.pb.js`). La regla
de creación tiene una rama para el registro personal (`@request.body.team = ""`), así que
cualquier cuenta autenticada podía crear un hallazgo con `team: ''` colgado de la campaña
de un equipo ajeno: no lo veía nadie más, pero en la app de quien lo creó aparecía dentro
de esa campaña, como un daño más del informe. Ojo con el orden si se toca esto: la regla
se evalúa contra **`@request.body`**, o sea contra lo que mandó el cliente, así que un
hook que le ponga el equipo al registro no lo somete a ninguna regla — heredarlo, que era
lo natural, hacía que el hallazgo del cliente se guardara con el equipo puesto y pasara a
verlo el equipo entero. Por eso el hook **rechaza** en vez de heredar cuando el autor no
puede escribir en el equipo del padre.

Todo esto está cubierto por `scripts/check-client-scope.mjs`, que corre contra un
PocketBase de verdad (ver la cabecera del archivo).

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
  db/index.ts               # Dexie / IndexedDB (offline; incluye el archivo del gemelo)
  data/nonstructural.ts     # catálogo de elementos NO estructurales (no califican)
  model/                    # importación del gemelo: ifc.ts · gltf.ts · naming.ts
  stores/inspection.ts      # store Pinia
  report/docx.ts            # informe Word
  sync/                     # capa PocketBase: backend · engine · realtime · apply · mappers
  ui/icons.ts, damage-icons.ts   # íconos de daño (SVG propios)
  components/
    layout/{TopBar,Sidebar}.vue
    team/TeamPanel.vue        # equipo activo, miembros, invitar, roles
    tour/TourOverlay.vue      # guía guiada (spotlight + tarjeta por paso)
    tests/TestsView.vue       # ensayos de la campaña (vista propia)
    twin/TwinCanvas.vue       # gemelo: cajas paramétricas o geometría importada
    list/DamageListView.vue
    results/{ResultsView,VulnerabilityPanel}.vue
    inspection/{InspectionSelector,InspectionPanel,DamageForm}.vue
scripts/
  build_catalog_ts.py       # genera data/catalog.ts
  calibrate.ts              # banco de calibración del scoring
  check-views.mjs           # QA: vistas, tiempo real y ámbito del formulario
  check-model-import.mjs    # QA: importa fixtures/edificio.ifc por la interfaz
```
