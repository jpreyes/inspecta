// Importación del gemelo digital desde un archivo.
//
// Dos formatos, y cada uno por una razón distinta:
//  · IFC  — el formato del rubro (Revit, ArchiCAD, Tekla, BlenderBIM). Trae la
//           semántica: qué es cada objeto, cómo se llama y en qué piso está.
//  · glTF/GLB — lo que exporta Blender y compañía. Solo geometría y nombres,
//           pero es el camino corto para quien no modela en BIM.
//
// Los dos importadores son pesados (web-ifc son ~6 MB de JS), así que se cargan
// con `import()` dinámico: la app normal no los descarga nunca.
import type { ImportedModel, ModelKind } from './types'

export type { ImportedModel, ModelKind } from './types'

/** Extensiones aceptadas, para el `accept` del input de archivo. */
export const MODEL_ACCEPT = '.ifc,.glb,.gltf'

/** Tope de tamaño. El archivo viaja al servidor y baja a cada teléfono en
 *  terreno: un modelo de 200 MB deja la app inservible con datos móviles. */
export const MAX_MODEL_MB = 60

export function kindOf(fileName: string): ModelKind | null {
  const n = fileName.toLowerCase()
  if (n.endsWith('.ifc')) return 'ifc'
  if (n.endsWith('.glb') || n.endsWith('.gltf')) return 'gltf'
  return null
}

/**
 * Lee el archivo y devuelve geometría + elementos. Lanza con un mensaje en
 * castellano y accionable: quien importa un modelo está frente al computador,
 * no leyendo la consola.
 */
export async function parseModel(file: File | Blob, fileName: string): Promise<ImportedModel> {
  const kind = kindOf(fileName)
  if (!kind) throw new Error('Formato no reconocido. Usa un archivo .ifc, .glb o .gltf.')
  if (file.size > MAX_MODEL_MB * 1024 * 1024) {
    throw new Error(
      `El modelo pesa ${Math.round(file.size / 1024 / 1024)} MB y el máximo es ${MAX_MODEL_MB} MB. ` +
        'Exporta solo la estructura, sin mobiliario ni terreno.',
    )
  }

  const buffer = await file.arrayBuffer()
  if (kind === 'ifc') {
    const { parseIfc } = await import('./ifc')
    // El .wasm se sirve tal cual desde la raíz (ver el plugin en vite.config.ts).
    return parseIfc(buffer, new URL('/', location.href).pathname)
  }
  const { parseGltf } = await import('./gltf')
  return parseGltf(buffer)
}

/** Resumen legible de lo que trajo el modelo, para confirmar antes de guardar. */
export function summarize(m: ImportedModel): string {
  const byType = new Map<string, number>()
  for (const e of m.elements) byType.set(e.type, (byType.get(e.type) ?? 0) + 1)
  const parts = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${n} ${t}${n === 1 ? '' : 's'}`)
  return `${m.elements.length} elementos — ${parts.join(', ')}`
}
