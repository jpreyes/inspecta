// Aplicar registros remotos sobre Dexie.
//
// Lo usan las dos vías por las que llega trabajo ajeno: el pull del motor de
// sync y la suscripción en vivo. Está aparte porque un `put` a secas NO sirve
// para los hallazgos: pisaría las fotos que este dispositivo todavía no ha
// subido. El registro remoto solo conoce los archivos que ya están en
// PocketBase, así que las fotos locales pendientes hay que conservarlas.
import { db } from '../db'
import type { Finding, Inspection, Project, Structure, Test } from '../types/inspection'

/** ¿Esta foto todavía vive solo en este dispositivo? */
const pending = (p: Finding['photos'][number]) => !!p.dataUrl && !p.remoteName

/**
 * Guarda un hallazgo remoto conservando las fotos locales aún no subidas.
 * Sin esto, tomar una foto sin señal y recibir cualquier actualización del
 * mismo hallazgo (propia o ajena) la borraba antes de que llegara a subirse.
 */
export async function upsertFinding(remote: Finding): Promise<void> {
  const local = await db.findings.get(remote.id)
  const keep = (local?.photos ?? []).filter(pending)
  await db.findings.put(keep.length ? { ...remote, photos: [...remote.photos, ...keep] } : remote)
}

export async function upsertProject(r: Project) {
  await db.projects.put(r)
}
/**
 * Guarda una estructura remota sin perder un gemelo 3D recién importado.
 *
 * Mismo problema que las fotos: el registro remoto solo conoce el modelo si el
 * ARCHIVO ya subió. Entre importarlo y que la subida salga bien (o falle por
 * falta de señal) hay una ventana en la que el servidor tiene el metadato pero
 * no el archivo, y devuelve la estructura sin modelo. Guardar eso a secas
 * borraba la geometría local y dejaba el blob huérfano en IndexedDB, sin nada
 * que lo volviera a subir.
 */
export async function upsertStructure(remote: Structure): Promise<void> {
  if (remote.model) {
    await db.structures.put(remote)
    return
  }
  const local = await db.structures.get(remote.id)
  const pendiente = local?.model && !local.model.remoteName && (await db.models.get(remote.id))
  await db.structures.put(
    pendiente
      ? { ...remote, model: local!.model, grid: local!.grid, elements: local!.elements }
      : remote,
  )
}
export async function upsertInspection(r: Inspection) {
  await db.inspections.put(r)
}
export async function upsertTest(r: Test) {
  await db.tests.put(r)
}
