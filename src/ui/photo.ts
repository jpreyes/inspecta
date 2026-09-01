// Fotos a tamaño estándar antes de guardarlas.
//
// La cámara de un teléfono actual entrega 12 MP: ~4 MB por foto, y en base64
// dentro de IndexedDB, un tercio más. Una campaña con cuarenta fotos así llena
// el almacenamiento del navegador y, sobre todo, hace impagable la subida justo
// donde peor está la señal —en terreno—. Y no aporta nada: una grieta, un
// descascaramiento o una filtración se documentan igual a 1920 px.
//
// Por eso toda foto que entra a la app se reescala al vuelo al lado mayor en
// 1920 px (HD) y se recomprime a JPEG. Dos detalles que se pagan caro si se
// omiten:
//
//  · `imageOrientation: 'from-image'` — sin eso, las fotos tomadas en vertical
//    salen acostadas: el sensor graba la rotación en EXIF y el canvas la ignora.
//  · fondo blanco antes de dibujar — un PNG con transparencia sobre canvas
//    vacío se convierte a JPEG con el fondo NEGRO.
//
// Si el navegador no puede decodificar el archivo, vale más la foto original
// que ninguna foto: se guarda tal cual.

/** Lado mayor de una foto guardada, en píxeles. */
export const PHOTO_MAX_EDGE = 1920
/** Calidad JPEG de la recompresión. */
export const PHOTO_QUALITY = 0.82

/** Tamaño de destino conservando la proporción; nunca agranda. */
export function fitPhoto(w: number, h: number, max = PHOTO_MAX_EDGE) {
  const escala = Math.min(1, max / Math.max(w, h))
  return { width: Math.round(w * escala), height: Math.round(h * escala) }
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(file)
  })
}

/**
 * Convierte el archivo de la cámara en la foto que guarda la app: JPEG, lado
 * mayor 1920 px como máximo, orientación ya aplicada.
 */
export async function fileToPhotoDataUrl(file: File | Blob): Promise<string> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = fitPhoto(bmp.width, bmp.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('sin contexto 2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bmp, 0, 0, width, height)
    bmp.close?.()
    return canvas.toDataURL('image/jpeg', PHOTO_QUALITY)
  } catch {
    return readAsDataUrl(file)
  }
}

/** ¿Esta foto ya está a tamaño estándar? (JPEG y dentro del lado máximo). */
async function medir(blob: Blob) {
  const bmp = await createImageBitmap(blob)
  const size = { w: bmp.width, h: bmp.height }
  bmp.close?.()
  return size
}

/**
 * Reduce una foto YA guardada. Devuelve `null` si no hace falta tocarla —que es
 * lo normal a partir de la segunda pasada—, para no recomprimir un JPEG una y
 * otra vez: cada recompresión pierde calidad aunque no gane ni un byte.
 */
export async function shrinkStored(blob: Blob): Promise<Blob | null> {
  const { w, h } = await medir(blob)
  if (Math.max(w, h) <= PHOTO_MAX_EDGE && blob.type === 'image/jpeg') return null
  const dataUrl = await fileToPhotoDataUrl(blob)
  const reducida = await (await fetch(dataUrl)).blob()
  // Si el resultado no es más liviano, la original se queda: pasa con fotos
  // pequeñas que ya venían muy comprimidas.
  return reducida.size < blob.size ? reducida : null
}

/** Lo mismo sobre el base64 que guarda Dexie. `null` = ya estaba bien. */
export async function shrinkDataUrl(dataUrl: string): Promise<string | null> {
  const blob = await (await fetch(dataUrl)).blob()
  const reducida = await shrinkStored(blob)
  return reducida ? readAsDataUrl(reducida) : null
}

/** Bytes que ocupa un dataURL base64 (aproximado, sirve para informar). */
export function dataUrlBytes(dataUrl?: string): number {
  if (!dataUrl) return 0
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.round((b64.length * 3) / 4)
}
