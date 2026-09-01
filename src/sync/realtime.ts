// Suscripción en vivo al trabajo del equipo (SSE de PocketBase).
//
// El motor de sync (`engine.ts`) es una corrida puntual: empuja, sube fotos y
// baja todo. Sirve para ponerse al día, pero deja un hueco de operación —
// mientras una inspectora registra daños en terreno, quien tiene la app abierta
// no ve nada hasta que vuelve a entrar o aprieta el botón. De ahí venía el
// "no puedo ver los daños de la otra persona": el dato estaba en el servidor y
// las reglas lo entregaban, pero nadie lo iba a buscar.
//
// Acá se escuchan las cinco colecciones y se aplica cada cambio sobre Dexie.
// El servidor filtra por la regla de lectura, así que solo llega lo visible.
import { backend, type RemoteCollection } from './backend'
import { db } from '../db'
import * as M from './mappers'
import * as A from './apply'

/** Cómo mapear y dónde guardar cada colección, y qué expandir al escuchar. */
const HANDLERS: Record<
  RemoteCollection,
  { expand?: string; apply: (r: any) => Promise<void>; remove: (id: string) => Promise<void> }
> = {
  projects: {
    apply: (r) => A.upsertProject(M.projectFromRemote(r)),
    remove: (id) => db.projects.delete(id),
  },
  structures: {
    apply: (r) => A.upsertStructure(M.structureFromRemote(r)),
    remove: (id) => db.structures.delete(id),
  },
  inspections: {
    expand: 'author',
    apply: (r) => A.upsertInspection(M.inspectionFromRemote(r)),
    remove: (id) => db.inspections.delete(id),
  },
  findings: {
    expand: 'author',
    apply: (r) => A.upsertFinding(M.findingFromRemote(r)),
    remove: (id) => db.findings.delete(id),
  },
  tests: {
    expand: 'author',
    apply: (r) => A.upsertTest(M.testFromRemote(r)),
    remove: (id) => db.tests.delete(id),
  },
}

const COLLECTIONS = Object.keys(HANDLERS) as RemoteCollection[]

/**
 * Empieza a escuchar. `onChange` se llama agrupado (no una vez por registro):
 * al abrir la conexión PocketBase puede mandar una ráfaga, y recargar el store
 * en cada evento haría parpadear la interfaz.
 *
 * Devuelve la función para cortar. Es tolerante a fallos: sin conexión o sin
 * permiso simplemente no se suscribe — la app sigue funcionando offline y el
 * sync manual queda igual.
 */
export async function watchRemote(onChange: () => void): Promise<() => void> {
  if (!backend.isAuthenticated) return () => {}

  let timer: ReturnType<typeof setTimeout> | null = null
  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      onChange()
    }, 400)
  }

  const stops: (() => void)[] = []
  for (const col of COLLECTIONS) {
    const h = HANDLERS[col]
    try {
      stops.push(
        await backend.subscribe(
          col,
          (action, record) => {
            const done =
              action === 'delete' ? h.remove(record.id) : h.apply(record)
            // Un registro que no se puede aplicar (referencia que aún no llegó)
            // no puede cortar la escucha: la próxima corrida de sync lo arregla.
            done.then(schedule).catch(() => {})
          },
          h.expand,
        ),
      )
    } catch {
      /* sin conexión o sin permiso: se sigue sin tiempo real */
    }
  }

  return () => {
    if (timer) clearTimeout(timer)
    for (const stop of stops) {
      try {
        stop()
      } catch {
        /* noop */
      }
    }
  }
}
