import { db } from '../db'
import { backend, dataUrlToFile, type RemoteCollection } from './backend'
import * as M from './mappers'
import { upsertFinding, upsertStructure } from './apply'
import { flushPhotoDeletions } from './photos'
import { isDemoRecord } from '../data/seed'
import type { Inspection, Structure } from '../types/inspection'
import { can as roleCan, roleInTeam, type Role, type Team } from '../types/team'

// IDs compatibles con PocketBase (15 chars [a-z0-9]). Registros con ids viejos
// (no compatibles) se omiten del sync — solo afecta datos demo previos.
const PB_ID = /^[a-z0-9]{15}$/

export interface SyncResult {
  pushed: number
  photos: number
  /** Archivos de gemelo 3D subidos en esta corrida. */
  models: number
  pulled: number
  /** Registros que no se enviaron: ajenos al rol, demo, o rechazados. */
  skipped: number
  /** Fotos borradas en el servidor (se habían borrado en el dispositivo). */
  photosRemoved: number
}

/**
 * Sincroniza Dexie ↔ PocketBase. Estrategia simple (última escritura gana):
 * empuja lo local que el usuario tenga permiso de escribir, sube las fotos
 * nuevas, y trae todo lo remoto visible.
 *
 * El filtro por permiso no es cosmético: el pull baja proyectos y estructuras
 * del equipo, y un inspector NO puede escribirlos (solo el administrador). Sin
 * filtro, la corrida siguiente intentaba devolverlos, el servidor respondía 404
 * y el error tumbaba el sync entero — o sea que a un inspector la sincronización
 * le funcionaba una sola vez. Lo mismo con los datos demo del dispositivo, que
 * comparten id entre usuarios y chocaban al subirlos.
 */
export async function syncNow(): Promise<SyncResult> {
  if (!backend.isAuthenticated) throw new Error('No autenticado')
  const me = backend.user!.id
  let pushed = 0
  let photos = 0
  let models = 0
  let pulled = 0
  let skipped = 0
  let photosRemoved = 0

  // ── Permisos: qué puede escribir este usuario en el servidor ──
  // Se resuelve con los equipos del servidor (fuente de verdad), no con el
  // equipo activo de la interfaz: en una misma base hay registros de varios.
  const teams: Team[] = await backend.listTeams().catch(() => [])
  const teamById = new Map(teams.map((t) => [t.id, t]))

  /** Rol en el equipo del registro. 'local' = registro personal (sin equipo). */
  function permission(teamId?: string): Role | 'local' | 'none' {
    if (!teamId) return 'local'
    const team = teamById.get(teamId)
    if (!team) return 'none' // el equipo ya no existe o el usuario salió
    return roleInTeam(team, me) ?? 'none'
  }

  /** Proyectos y estructuras: solo el administrador del equipo los edita. */
  function mayManage(teamId?: string): boolean {
    const p = permission(teamId)
    return p === 'local' || (p !== 'none' && roleCan(p, 'manage_projects'))
  }

  /** Trabajo de terreno: admin siempre; inspector solo donde está asignado
   *  (o si la estructura no tiene asignados). Es la misma regla del servidor. */
  function mayWork(teamId: string | undefined, structure?: Structure): boolean {
    const p = permission(teamId)
    if (p === 'local') return true
    if (p === 'none' || !roleCan(p, 'edit_data')) return false
    if (p === 'admin') return true
    const assigned = structure?.inspectorIds ?? []
    return assigned.length === 0 || assigned.includes(me)
  }

  // ── Índices locales (para resolver hallazgo → campaña → estructura) ──
  const localStructures = await db.structures.toArray()
  const localInspections = await db.inspections.toArray()
  const localFindings = await db.findings.toArray()
  const localTests = await db.tests.toArray()
  const structureById = new Map(localStructures.map((s) => [s.id, s]))
  const inspectionById = new Map(localInspections.map((i) => [i.id, i]))
  const structureOf = (insp?: Inspection) =>
    insp ? structureById.get(insp.structureId) : undefined

  /** Veredicto de envío: 'si' se manda · 'no' no hay permiso (se cuenta como
   *  omitido) · 'demo' es dato de demostración del dispositivo (no se cuenta:
   *  no es un fallo, nunca fue para el servidor). */
  type Verdict = 'si' | 'no' | 'demo'

  /** Un registro de terreno se envía si su campaña existe, no es demo y el rol
   *  alcanza para escribir en la estructura de esa campaña. */
  function workItemVerdict(inspectionId: string, teamId?: string): Verdict {
    const insp = inspectionById.get(inspectionId)
    if (!insp) return 'no' // huérfano: su campaña ya no está en este dispositivo
    if (isDemoRecord(insp.id)) return 'demo'
    return mayWork(teamId, structureOf(insp)) ? 'si' : 'no'
  }

  // ── PUSH (orden de dependencias: proyecto → estructura → inspección → …) ──
  const pushAll = async (col: RemoteCollection, records: Record<string, unknown>[]) => {
    for (const r of records) {
      if (!PB_ID.test(String(r.id))) continue
      try {
        await backend.push(col, r)
        pushed++
      } catch {
        // Un registro rechazado (permiso, referencia rota) no puede llevarse
        // por delante el resto de la sincronización.
        skipped++
      }
    }
  }
  /** Deja fuera los datos demo (en silencio) y lo que el rol no puede escribir. */
  const sendable = <T extends { id: string }>(rows: T[], verdict: (row: T) => Verdict): T[] =>
    rows.filter((row) => {
      const v = isDemoRecord(row.id) ? 'demo' : verdict(row)
      if (v === 'no') skipped++
      return v === 'si'
    })

  const owned = (allowed: boolean): Verdict => (allowed ? 'si' : 'no')

  await pushAll(
    'projects',
    sendable(await db.projects.toArray(), (p) => owned(mayManage(p.teamId))).map((p) =>
      M.projectToRemote(p, me),
    ),
  )
  const pushableStructures = sendable(localStructures, (s) => owned(mayManage(s.teamId)))
  await pushAll('structures', pushableStructures.map((s) => M.structureToRemote(s, me)))

  // ── GEMELOS 3D: subir el archivo del modelo importado ──
  // Va después de la estructura (el registro tiene que existir) y solo una vez:
  // en cuanto PocketBase devuelve el nombre del archivo, queda anotado en
  // `model.remoteName` y no se vuelve a subir. La BAJADA no se hace acá a
  // propósito — un IFC son megabytes y en terreno se pagan con datos móviles,
  // así que se descarga cuando alguien abre el gemelo (`ensureModelFile`).
  for (const st of pushableStructures) {
    if (!st.model || st.model.remoteName || !PB_ID.test(st.id)) continue
    const stored = await db.models.get(st.id)
    if (!stored) continue
    try {
      const file = new File([stored.blob], stored.fileName, {
        type: 'application/octet-stream',
      })
      const remoteName = await backend.uploadModel(st.id, file)
      st.model.remoteName = remoteName
      await db.structures.put(st)
      models++
    } catch {
      skipped++
    }
  }
  await pushAll(
    'inspections',
    sendable(localInspections, (i) =>
      owned(mayWork(i.teamId, structureById.get(i.structureId))),
    ).map((i) => M.inspectionToRemote(i, me)),
  )
  const pushableFindings = sendable(localFindings, (f) => workItemVerdict(f.inspectionId, f.teamId))
  await pushAll('findings', pushableFindings.map((f) => M.findingToRemote(f, me)))
  await pushAll(
    'tests',
    sendable(localTests, (t) => workItemVerdict(t.inspectionId, t.teamId)).map((t) =>
      M.testToRemote(t, me),
    ),
  )

  // ── FOTOS: subir las locales que aún no tienen archivo remoto ──
  //
  // El `remoteName` se anota releyendo el hallazgo de Dexie, no sobre la copia
  // que se leyó al empezar la corrida: mientras esto sube, la escucha en vivo
  // está aplicando sobre el mismo registro los eventos del propio push, y
  // guardar la copia vieja encima resucitaba la foto como si no se hubiera
  // subido — para volver a subirla, duplicada, en la corrida siguiente.
  for (const f of pushableFindings) {
    if (!PB_ID.test(f.id)) continue
    for (const ph of f.photos) {
      if (ph.remoteName || !ph.dataUrl) continue // ya subida, o sin base64
      try {
        const rec = (await backend.uploadPhoto(f.id, dataUrlToFile(ph.dataUrl, `${ph.id}.jpg`))) as {
          photos?: string[]
        } & Record<string, unknown>
        const names = rec.photos ?? []
        const newName = names[names.length - 1]
        if (!newName) continue
        const url = backend.fileUrl(rec as { id: string; collectionId?: string }, newName)
        ph.remoteName = newName
        ph.url = url
        const fresco = await db.findings.get(f.id)
        if (fresco) {
          const suya = fresco.photos.find((x) => x.id === ph.id)
          if (suya) {
            suya.remoteName = newName
            suya.url = url
          }
          await db.findings.put(fresco)
        }
        photos++
      } catch {
        skipped++
      }
    }
  }

  // ── BORRADOS DE FOTOS PENDIENTES ──
  // Antes del pull, y no después: si el archivo sigue en el servidor cuando
  // llega el registro, la foto borrada vuelve a aparecer. (`upsertFinding`
  // igual filtra por la papelera, pero el orden correcto ahorra el rebote.)
  photosRemoved = await flushPhotoDeletions()

  // ── PULL (upsert remoto → local) ──
  const pullInto = async <T extends { id: string }>(
    table: { put: (v: T) => Promise<unknown> },
    records: T[],
  ) => {
    for (const r of records) {
      await table.put(r)
      pulled++
    }
  }
  // `author` se expande para poder mostrar quién registró cada cosa sin conexión.
  await pullInto(db.projects, (await backend.pull('projects')).map(M.projectFromRemote))
  // Igual que los hallazgos: no es un `put` a secas. Una estructura cuyo gemelo
  // se acaba de importar y todavía no sube no puede perder su modelo por el
  // hecho de que el servidor aún no lo tenga (ver sync/apply.ts).
  for (const st of (await backend.pull('structures')).map(M.structureFromRemote)) {
    await upsertStructure(st)
    pulled++
  }
  await pullInto(
    db.inspections,
    (await backend.pull('inspections', undefined, 'author')).map(M.inspectionFromRemote),
  )
  // Los hallazgos no se guardan con un `put` a secas: hay que conservar las
  // fotos tomadas sin señal que todavía no se han subido, o el propio pull las
  // borra antes de que lleguen al servidor (ver sync/apply.ts).
  for (const f of (await backend.pull('findings', undefined, 'author')).map(M.findingFromRemote)) {
    await upsertFinding(f)
    pulled++
  }
  await pullInto(db.tests, (await backend.pull('tests', undefined, 'author')).map(M.testFromRemote))

  return { pushed, photos, models, pulled, skipped, photosRemoved }
}
