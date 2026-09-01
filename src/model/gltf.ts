// Importador de glTF / GLB (Blender, SketchUp, Rhino, cualquier cosa que exporte
// glTF). No trae semántica estructural —eso solo lo da el IFC—, así que el tipo
// de cada elemento se deduce del NOMBRE del objeto en la escena. Nombrar bien en
// Blender ("Pilar A1", "Viga N2-3") es lo que hace la diferencia entre un gemelo
// utilizable y una malla muda.
//
// El loader viene dentro de `three`, que ya es dependencia: no agrega peso nuevo
// al bundle más allá de su propio chunk, y se carga por `import()` dinámico.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Element, Vec3 } from '../types/inspection'
import type { ImportedModel } from './types'
import { elementTypeFromName, uniqueTag } from './naming'

/** Alto de piso supuesto al agrupar por nivel cuando el archivo no lo dice. */
const ASSUMED_STORY_H = 3

export async function parseGltf(buffer: ArrayBuffer): Promise<ImportedModel> {
  const loader = new GLTFLoader()
  const gltf = await new Promise<any>((resolve, reject) => {
    // El segundo argumento es la ruta base para recursos externos. Va vacío a
    // propósito: solo se aceptan archivos autocontenidos (.glb, o .gltf con los
    // buffers incrustados), porque en terreno no hay de dónde bajar un .bin
    // suelto que quedó en el computador de quien modeló.
    loader.parse(buffer, '', resolve, reject)
  }).catch((e) => {
    const msg = String(e?.message ?? e)
    if (/draco/i.test(msg)) {
      throw new Error(
        'El modelo usa compresión Draco, que esta app no descomprime. Vuelve a exportarlo desde Blender con la compresión desactivada.',
      )
    }
    if (/\.bin|buffer/i.test(msg)) {
      throw new Error(
        'El archivo depende de recursos externos. Exporta un .glb (binario, autocontenido) en vez de un .gltf suelto.',
      )
    }
    throw new Error('No se pudo leer el modelo glTF: ' + msg)
  })

  const scene: THREE.Object3D = gltf.scene ?? gltf.scenes?.[0]
  if (!scene) throw new Error('El archivo no contiene ninguna escena.')
  scene.updateMatrixWorld(true)

  const notes: string[] = []
  const elements: Element[] = []
  const tags = new Set<string>()
  const sinNombre: string[] = []

  // Cada malla de primer nivel con nombre es un elemento. Se recorre la escena
  // entera y se agrupa por el ancestro con nombre más cercano: Blender exporta
  // un objeto con varias mallas cuando tiene varios materiales, y contarlas por
  // separado partiría un pilar en tres "elementos".
  const byOwner = new Map<THREE.Object3D, THREE.Mesh[]>()
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!(mesh as any).isMesh) return
    let owner: THREE.Object3D = mesh
    while (owner.parent && owner.parent !== scene && !owner.name) owner = owner.parent
    const arr = byOwner.get(owner)
    if (arr) arr.push(mesh)
    else byOwner.set(owner, [mesh])
  })

  let i = 0
  for (const [owner, meshes] of byOwner) {
    i++
    const box = new THREE.Box3()
    for (const m of meshes) box.expandByObject(m)
    if (box.isEmpty()) continue

    const name = (owner.name || '').trim()
    if (!name) sinNombre.push(String(i))
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const id = `gltf-${owner.uuid}`
    const tag = uniqueTag(name || `Objeto ${i}`, tags)

    owner.userData.elementId = id
    for (const m of meshes) m.userData.elementId = id

    elements.push({
      id,
      tag,
      type: elementTypeFromName(name),
      // Sin estructura espacial en el archivo, el nivel se deduce de la altura
      // del centro. Es una aproximación declarada, no un dato del modelo.
      story: Math.max(1, Math.floor(center.y / ASSUMED_STORY_H) + 1),
      position: { x: center.x, y: center.y, z: center.z } as Vec3,
      size: { x: size.x, y: size.y, z: size.z } as Vec3,
    })
  }

  if (!elements.length) throw new Error('El modelo no contiene mallas.')

  if (sinNombre.length) {
    notes.push(
      `${sinNombre.length} objeto(s) sin nombre quedaron como “Objeto N”. Nómbralos en Blender para reconocerlos en el árbol.`,
    )
  }
  const genericos = elements.filter((e) => e.type === 'otro').length
  if (genericos) {
    notes.push(
      `${genericos} objeto(s) sin tipo reconocible. Se deduce del nombre: incluye “pilar”, “viga”, “losa”, “muro” o “fundación”.`,
    )
  }
  notes.push('El nivel de cada elemento se estimó por su altura: el glTF no trae pisos.')

  return { kind: 'gltf', object: scene, elements, notes }
}
