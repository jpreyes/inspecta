// Mantención de las fotos: borrarlas de verdad y reducirlas a tamaño estándar.
//
// Las fotos son, con diferencia, lo que más ocupa en esta app: viven dos veces
// —el archivo en PocketBase y su base64 en IndexedDB— y salen de una cámara de
// 12 MP. Acá está lo que hay que hacer con las que YA estaban guardadas cuando
// se empezó a reducirlas al entrar (ver src/ui/photo.ts).
import { db } from '../db'
import { backend } from './backend'
import { dataUrlBytes, shrinkStored } from '../ui/photo'
import type { Finding } from '../types/inspection'

/** Nombres de archivo pendientes de borrar en el servidor. */
export async function trashedNames(): Promise<Set<string>> {
  return new Set((await db.photoTrash.toArray()).map((t) => t.remoteName))
}

/**
 * Anota que estas fotos ya subidas se borraron.
 *
 * No se borra en el acto contra el servidor a propósito: en terreno no hay
 * señal, y un borrado que solo funciona con conexión no es un borrado. La
 * lápida queda en Dexie, filtra lo que llega del servidor mientras tanto
 * (sync/apply.ts) y se aplica en la siguiente sincronización.
 */
export async function trashPhotos(findingId: string, remoteNames: string[]): Promise<void> {
  if (!remoteNames.length) return
  const at = new Date().toISOString()
  await db.photoTrash.bulkPut(remoteNames.map((remoteName) => ({ remoteName, findingId, at })))
}

/**
 * Aplica las lápidas contra el servidor. Devuelve cuántas fotos se borraron.
 * Lo que falla (sin permiso, sin señal) se queda para la próxima: la lista es
 * corta y volver a intentarlo no cuesta nada.
 */
export async function flushPhotoDeletions(): Promise<number> {
  let borradas = 0
  for (const t of await db.photoTrash.toArray()) {
    try {
      await backend.deletePhoto(t.findingId, t.remoteName)
      await db.photoTrash.delete(t.remoteName)
      borradas++
    } catch (e) {
      // 404 = el hallazgo o el archivo ya no están: la lápida cumplió.
      if (String((e as { status?: number })?.status) === '404') {
        await db.photoTrash.delete(t.remoteName)
      }
    }
  }
  return borradas
}

export interface ShrinkResult {
  /** Fotos reducidas en este dispositivo (base64 de Dexie). */
  locales: number
  /** Fotos reemplazadas en el servidor por su versión reducida. */
  remotas: number
  /** Bytes liberados en el dispositivo. */
  bytes: number
  /** Fotos que no se pudieron reducir (sin permiso, sin señal, formato raro). */
  omitidas: number
}

/**
 * Reduce el base64 que este dispositivo guarda de cada foto. Es puramente
 * local: no necesita señal ni permiso, y es lo que de verdad descongestiona
 * IndexedDB, donde la misma foto pesa un tercio más que el archivo.
 */
export async function compactLocalPhotos(): Promise<{ fotos: number; bytes: number }> {
  let fotos = 0
  let bytes = 0
  for (const f of await db.findings.toArray()) {
    let cambio = false
    for (const p of f.photos) {
      if (!p.dataUrl) continue
      const antes = dataUrlBytes(p.dataUrl)
      try {
        const blob = await (await fetch(p.dataUrl)).blob()
        const reducida = await shrinkStored(blob)
        if (!reducida) continue
        p.dataUrl = await blobToDataUrl(reducida)
        bytes += antes - dataUrlBytes(p.dataUrl)
        fotos++
        cambio = true
      } catch {
        // Una foto que el navegador no sabe decodificar se queda como está.
      }
    }
    if (cambio) await db.findings.put(f)
  }
  return { fotos, bytes }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}

/**
 * Reduce también el ARCHIVO que está en el servidor: lo baja, lo reescala, sube
 * la versión nueva y borra la vieja. En ese orden — si algo se corta a mitad, lo
 * peor que queda es una foto duplicada, nunca un hallazgo sin foto.
 *
 * Va detrás de un botón y no dentro de la sincronización de siempre porque
 * baja y vuelve a subir megabytes, y la sincronización corre sola al abrir la
 * app: en terreno eso se paga con datos móviles.
 *
 * `puedeEscribir` decide qué hallazgos tocar: el servidor solo acepta el cambio
 * de quien puede editar el hallazgo, así que intentarlo con los demás solo
 * gastaría la conexión.
 */
export async function shrinkRemotePhotos(
  puedeEscribir: (f: Finding) => boolean,
): Promise<{ fotos: number; omitidas: number }> {
  let fotos = 0
  let omitidas = 0
  for (const f of await db.findings.toArray()) {
    if (!puedeEscribir(f)) continue
    let cambio = false
    for (const p of f.photos) {
      if (!p.remoteName) continue
      try {
        const original = await backend.downloadPhoto(f.id, p.remoteName)
        const reducida = await shrinkStored(original)
        if (!reducida) continue
        const nombreViejo = p.remoteName
        // Los nombres que ya había: el archivo nuevo es el único que no está
        // en esta lista. Quedarse con "el último" sería quedarse con otra foto
        // del mismo hallazgo si PocketBase no respeta el orden.
        const previos = new Set(f.photos.map((x) => x.remoteName).filter(Boolean) as string[])
        const file = new File([reducida], nombreViejo.replace(/\.[^.]+$/, '') + '.jpg', {
          type: 'image/jpeg',
        })
        const rec = (await backend.uploadPhoto(f.id, file)) as {
          photos?: string[]
        } & { id: string; collectionId?: string }
        const nuevo = (rec.photos ?? []).find((n) => !previos.has(n))
        if (!nuevo) {
          omitidas++
          continue
        }
        await backend.deletePhoto(f.id, nombreViejo)
        p.id = nuevo
        p.remoteName = nuevo
        p.url = backend.fileUrl(rec, nuevo)
        // Solo se refresca el base64 si este dispositivo ya lo tenía: crearlo
        // acá metería en IndexedDB una copia de cada foto del equipo, que es
        // justo lo contrario de lo que se está haciendo.
        if (p.dataUrl) p.dataUrl = await blobToDataUrl(reducida)
        fotos++
        cambio = true
      } catch {
        omitidas++
      }
    }
    if (cambio) await db.findings.put(f)
  }
  return { fotos, omitidas }
}
