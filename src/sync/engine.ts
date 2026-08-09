import { db } from '../db'
import { backend, dataUrlToFile, type RemoteCollection } from './backend'
import * as M from './mappers'
import type { Finding } from '../types/inspection'

// IDs compatibles con PocketBase (15 chars [a-z0-9]). Registros con ids viejos
// (no compatibles) se omiten del sync — solo afecta datos demo previos.
const PB_ID = /^[a-z0-9]{15}$/

export interface SyncResult {
  pushed: number
  photos: number
  pulled: number
}

/**
 * Sincroniza Dexie ↔ PocketBase. Estrategia simple (última escritura gana):
 * empuja todo lo local, sube fotos nuevas, y trae todo lo remoto del usuario.
 */
export async function syncNow(): Promise<SyncResult> {
  if (!backend.isAuthenticated) throw new Error('No autenticado')
  const owner = backend.user!.id
  let pushed = 0
  let photos = 0
  let pulled = 0

  // ── PUSH (orden de dependencias: proyecto → estructura → inspección → …) ──
  const pushAll = async (col: RemoteCollection, records: Record<string, unknown>[]) => {
    for (const r of records) {
      if (!PB_ID.test(String(r.id))) continue
      await backend.push(col, r)
      pushed++
    }
  }
  await pushAll('projects', (await db.projects.toArray()).map((p) => M.projectToRemote(p, owner)))
  await pushAll('structures', (await db.structures.toArray()).map((s) => M.structureToRemote(s, owner)))
  await pushAll('inspections', (await db.inspections.toArray()).map((i) => M.inspectionToRemote(i, owner)))
  await pushAll('findings', (await db.findings.toArray()).map((f) => M.findingToRemote(f, owner)))
  await pushAll('tests', (await db.tests.toArray()).map((t) => M.testToRemote(t, owner)))

  // ── FOTOS: subir las locales que aún no tienen archivo remoto ──
  for (const f of await db.findings.toArray()) {
    if (!PB_ID.test(f.id)) continue
    let changed = false
    for (const ph of f.photos) {
      if (ph.remoteName || !ph.dataUrl) continue // ya subida, o sin base64
      const rec = (await backend.uploadPhoto(f.id, dataUrlToFile(ph.dataUrl, `${ph.id}.jpg`))) as {
        photos?: string[]
      } & Record<string, unknown>
      const names = rec.photos ?? []
      const newName = names[names.length - 1]
      if (newName) {
        ph.remoteName = newName
        ph.url = backend.fileUrl(rec as { id: string; collectionId?: string }, newName)
        photos++
        changed = true
      }
    }
    if (changed) await db.findings.put(f)
  }

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
  await pullInto(db.structures, (await backend.pull('structures')).map(M.structureFromRemote))
  await pullInto(
    db.inspections,
    (await backend.pull('inspections', undefined, 'author')).map(M.inspectionFromRemote),
  )
  await pullInto<Finding>(
    db.findings,
    (await backend.pull('findings', undefined, 'author')).map(M.findingFromRemote),
  )
  await pullInto(db.tests, (await backend.pull('tests', undefined, 'author')).map(M.testFromRemote))

  return { pushed, photos, pulled }
}
