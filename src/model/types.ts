// Tipos compartidos por los importadores de modelo 3D (IFC y glTF/GLB).
import type * as THREE from 'three'
import type { Element } from '../types/inspection'

export type ModelKind = 'ifc' | 'gltf'

/**
 * Un modelo importado tiene DOS capas y las dos hacen falta:
 *
 *  · `object` — la geometría real que se dibuja en el gemelo.
 *  · `elements` — la capa semántica (tag, tipo, piso, caja envolvente) contra la
 *    que se cuelgan los hallazgos, se agrupa el árbol lateral y se calcula la
 *    condición por piso. Sin ella el modelo sería una foto bonita: no habría
 *    a qué atar un daño.
 *
 * El puente entre las dos es `userData.elementId`, que va en cada malla: así el
 * gemelo sabe qué pintar cuando un elemento tiene un hallazgo, y qué elemento
 * se seleccionó al hacer click.
 */
export interface ImportedModel {
  kind: ModelKind
  object: THREE.Object3D
  elements: Element[]
  /** Avisos legibles para mostrarle al usuario (unidades, objetos ignorados…). */
  notes: string[]
}
