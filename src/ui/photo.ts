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
