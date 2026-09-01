// Aplicar registros remotos sobre Dexie.
//
// Lo usan las dos vías por las que llega trabajo ajeno: el pull del motor de
// sync y la suscripción en vivo. Está aparte porque un `put` a secas NO sirve
// para los hallazgos: pisaría las fotos que este dispositivo todavía no ha
// subido. El registro remoto solo conoce los archivos que ya están en
// PocketBase, así que las fotos locales pendientes hay que conservarlas.
import { db } from '../db'
import { trashedNames } from './photos'
import type { Finding, Inspection, Project, Structure, Test } from '../types/inspection'

/** ¿Esta foto todavía vive solo en este dispositivo? */
const pending = (p: Finding['photos'][number]) => !!p.dataUrl && !p.remoteName

/**
 * ¿Esta foto pendiente YA está subida con otro nombre?
 *
 * Se sube como `<id de la foto>.jpg` y PocketBase la guarda cambiando lo que no
 * sea alfanumérico por '_' y agregando un sufijo aleatorio: `ph-3f9a1c` termina
 * siendo `ph_3f9a1c_a9w4g8nqah.jpg`. Reconocerlo importa porque la subida y la
 * llegada del registro compiten: si el evento en vivo del propio push aterriza
 * entre que el archivo sube y que se anota el `remoteName`, la foto local sigue
 * pareciendo pendiente y queda DUPLICADA —una copia con base64 y otra con
 * archivo—, y la copia pendiente se vuelve a subir en la sincronización
 * siguiente. Así aparecían fotos repetidas en el servidor.
 */
function yaSubida(p: Finding['photos'][number], remotos: string[]): boolean {
  const base = p.id.replace(/[^a-zA-Z0-9]/g, '_')
  return remotos.some((n) => n.startsWith(base + '_') || n === p.id)
}

/**
 * Guarda un hallazgo remoto conservando las fotos locales aún no subidas y sin
 * resucitar las que se borraron sin señal.
 *
 * Sin lo primero, tomar una foto sin señal y recibir cualquier actualización
 * del mismo hallazgo (propia o ajena) la borraba antes de que llegara a
 * subirse. Sin lo segundo, borrar una foto ya subida no servía de nada: el
 * pull la traía de vuelta hasta que la sincronización alcanzara a aplicar el
 * borrado en el servidor.
 */
export async function upsertFinding(remote: Finding): Promise<void> {
  const local = await db.findings.get(remote.id)
  const papelera = await trashedNames()
  const llegan = papelera.size
    ? remote.photos.filter((p) => !p.remoteName || !papelera.has(p.remoteName))
    : remote.photos
  const nombres = remote.photos.map((p) => p.remoteName ?? p.id)
  const keep = (local?.photos ?? []).filter((p) => pending(p) && !yaSubida(p, nombres))
  await db.findings.put({ ...remote, photos: keep.length ? [...llegan, ...keep] : llegan })
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
