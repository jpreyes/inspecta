// Importador de IFC (web-ifc).
//
// El IFC es el formato del rubro —sale de Revit, ArchiCAD, Tekla y BlenderBIM—
// y es el único que trae la SEMÁNTICA: cada objeto dice si es un pilar, una
// viga o una losa, cómo se llama y en qué piso está. Eso es exactamente lo que
// el gemelo necesita para colorear por severidad, agrupar el árbol lateral y
// calcular la condición por piso, así que se lee entera y no solo la geometría.
//
// web-ifc pesa (≈6 MB de JS + 1,3 MB de WASM), por eso este módulo se carga con
// `import()` dinámico desde `model/index.ts`: quien nunca importa un IFC nunca
// lo descarga.
import * as THREE from 'three'
import type { Element, ElementType, Vec3 } from '../types/inspection'
import type { ImportedModel } from './types'
import { uniqueTag } from './naming'

/** Qué tipo IFC es cada cosa para nosotros. Lo que no esté acá entra como 'otro'. */
const TYPE_BY_IFC: Record<string, ElementType> = {
  IFCCOLUMN: 'columna',
  IFCBEAM: 'viga',
  IFCMEMBER: 'viga',
  IFCSLAB: 'losa',
  IFCROOF: 'losa',
  IFCPLATE: 'losa',
  IFCWALL: 'muro',
  IFCWALLSTANDARDCASE: 'muro',
  IFCCURTAINWALL: 'muro',
  IFCFOOTING: 'fundacion',
  IFCPILE: 'fundacion',
}

/**
 * Tipos de la estructura espacial del IFC. Entran en `LoadAllGeometry` como
 * mallas degeneradas (caja de tamaño cero) y, si no se filtran, aparecen en el
 * árbol como elementos fantasma llamados "Edificio" y "Nivel 1" a los que se les
 * pueden colgar daños. Medido con un IFC de prueba: de 7 "mallas", 3 eran esto.
 */
const SPATIAL = new Set(['IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY', 'IFCSPACE'])

/** Un modelo de más de 10 km de lado no es un edificio: es un archivo cuyas
 *  unidades no se pudieron interpretar. Red de seguridad, no conversión. */
const IMPLAUSIBLE_SPAN_M = 10_000

/** Volumen por debajo del cual una "malla" no es un elemento (1 cm³). */
const MIN_VOLUME_M3 = 1e-6

type Api = any

/** Valor de un atributo de web-ifc, que llega envuelto en `{ value }`. */
const val = (x: any): any => (x && typeof x === 'object' && 'value' in x ? x.value : x)

/**
 * Piso de cada elemento, leyendo la estructura espacial del IFC
 * (IfcRelContainedInSpatialStructure → IfcBuildingStorey). Los pisos se ordenan
 * por cota y se numeran desde 1, que es lo que espera la agregación por piso del
 * scoring (la concentración de daño en un piso gobierna la condición).
 */
function storeyByElement(api: Api, modelID: number): Map<number, number> {
  const out = new Map<number, number>()
  try {
    const storeys: { id: number; elevation: number }[] = []
    const storeyIds = api.GetLineIDsWithType(modelID, IFCBUILDINGSTOREY_ID)
    for (let i = 0; i < storeyIds.size(); i++) {
      const id = storeyIds.get(i)
      const line = api.GetLine(modelID, id)
      storeys.push({ id, elevation: Number(val(line?.Elevation)) || 0 })
    }
    storeys.sort((a, b) => a.elevation - b.elevation)
    const levelOf = new Map(storeys.map((s, i) => [s.id, i + 1]))

    const rels = api.GetLineIDsWithType(modelID, IFCRELCONTAINED_ID)
    for (let i = 0; i < rels.size(); i++) {
      const rel = api.GetLine(modelID, rels.get(i))
      const level = levelOf.get(val(rel?.RelatingStructure))
      if (level == null) continue
      for (const ref of rel?.RelatedElements ?? []) out.set(val(ref), level)
    }
  } catch {
    /* sin estructura espacial: los elementos quedan sin piso */
  }
  return out
}

// Los ids numéricos de tipo IFC se resuelven al importar el módulo (abajo).
let IFCBUILDINGSTOREY_ID = 0
let IFCRELCONTAINED_ID = 0

/**
 * Lee un IFC y devuelve la geometría real más la capa semántica de elementos.
 * `wasmDir` es la carpeta desde donde se sirve `web-ifc.wasm` (ver vite.config).
 */
export async function parseIfc(buffer: ArrayBuffer, wasmDir: string): Promise<ImportedModel> {
  const webIfc = await import('web-ifc')
  IFCBUILDINGSTOREY_ID = webIfc.IFCBUILDINGSTOREY
  IFCRELCONTAINED_ID = webIfc.IFCRELCONTAINEDINSPATIALSTRUCTURE

  const api: Api = new webIfc.IfcAPI()
  api.SetWasmPath(wasmDir, true)
  await api.Init()

  // COORDINATE_TO_ORIGIN evita el problema clásico del IFC georreferenciado:
  // coordenadas de cientos de miles de metros que dejan el modelo fuera de la
  // vista y arruinan la precisión del float.
  const modelID = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: true })
  const notes: string[] = []

  try {
    // OJO: no se convierten unidades a mano. Medido contra web-ifc 0.0.77 con un
    // IFC declarado en MILÍMETROS, la geometría vuelve YA en metros (un pilar de
    // 400×3200 mm salió 0,40 × 3,20). Aplicarle además el factor del
    // IfcUnitAssignment lo encogía 1000 veces y dejaba el edificio del porte de
    // una moneda. Lo único que queda es la comprobación de tamaño de más abajo.
    const storeys = storeyByElement(api, modelID)

    const root = new THREE.Group()
    root.name = 'ifc'
    const elements: Element[] = []
    const tags = new Set<string>()
    const box = new THREE.Box3()

    const flatMeshes = api.LoadAllGeometry(modelID)
    for (let i = 0; i < flatMeshes.size(); i++) {
      const flat = flatMeshes.get(i)
      const expressID = flat.expressID

      // Nombre y tipo: el IFC los declara, no hay que adivinarlos.
      let name = ''
      let ifcType = ''
      let globalId = ''
      try {
        const line = api.GetLine(modelID, expressID)
        name = String(val(line?.Name) ?? '').trim()
        globalId = String(val(line?.GlobalId) ?? '').trim()
        ifcType = String(api.GetNameFromTypeCode(api.GetLineType(modelID, expressID)) ?? '')
      } catch {
        /* elemento sin propiedades legibles: entra igual, con tipo genérico */
      }
      if (SPATIAL.has(ifcType.toUpperCase())) continue

      const group = new THREE.Group()

      for (let g = 0; g < flat.geometries.size(); g++) {
        const placed = flat.geometries.get(g)
        const geom = api.GetGeometry(modelID, placed.geometryExpressID)
        const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize())
        const indices = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize())
        if (!verts.length || !indices.length) continue

        // web-ifc entrega los vértices intercalados: 3 de posición + 3 de normal.
        const interleaved = new THREE.InterleavedBuffer(new Float32Array(verts), 6)
        const buf = new THREE.BufferGeometry()
        buf.setAttribute('position', new THREE.InterleavedBufferAttribute(interleaved, 3, 0))
        buf.setAttribute('normal', new THREE.InterleavedBufferAttribute(interleaved, 3, 3))
        buf.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1))

        const mesh = new THREE.Mesh(buf)
        mesh.applyMatrix4(new THREE.Matrix4().fromArray(placed.flatTransformation))
        group.add(mesh)
      }
      if (!group.children.length) continue

      group.updateMatrixWorld(true)
      const gbox = new THREE.Box3().setFromObject(group)
      if (gbox.isEmpty()) continue

      const center = gbox.getCenter(new THREE.Vector3())
      const size = gbox.getSize(new THREE.Vector3())
      // Una caja sin volumen no es un elemento inspeccionable: es un eje, un
      // punto de referencia o un contenedor que se coló.
      if (size.x * size.y * size.z < MIN_VOLUME_M3) continue
      box.union(gbox)
      const type = TYPE_BY_IFC[ifcType.toUpperCase()] ?? 'otro'
      const id = globalId || `ifc-${expressID}`
      const tag = uniqueTag(name || `${ifcType || 'Elemento'} ${expressID}`, tags)

      group.userData.elementId = id
      for (const child of group.children) child.userData.elementId = id
      root.add(group)

      elements.push({
        id,
        tag,
        type,
        story: storeys.get(expressID),
        position: { x: center.x, y: center.y, z: center.z } as Vec3,
        size: { x: size.x, y: size.y, z: size.z } as Vec3,
      })
    }

    if (!elements.length) throw new Error('El IFC no trae geometría legible.')

    // Red de seguridad: si el modelo mide kilómetros, web-ifc no logró
    // interpretar las unidades del archivo y venía en milímetros.
    const span = box.getSize(new THREE.Vector3())
    const maxSpan = Math.max(span.x, span.y, span.z)
    if (maxSpan > IMPLAUSIBLE_SPAN_M) {
      const fix = 0.001
      root.scale.setScalar(fix)
      for (const el of elements) {
        el.position = { x: el.position!.x * fix, y: el.position!.y * fix, z: el.position!.z * fix }
        el.size = { x: el.size!.x * fix, y: el.size!.y * fix, z: el.size!.z * fix }
      }
      notes.push(
        `El archivo medía ${Math.round(maxSpan)} de lado: se interpretó en milímetros.`,
      )
    }

    const sinPiso = elements.filter((e) => e.story == null).length
    if (sinPiso) notes.push(`${sinPiso} elemento(s) sin piso asignado en el IFC.`)

    return { kind: 'ifc', object: root, elements, notes }
  } finally {
    try {
      api.CloseModel(modelID)
    } catch {
      /* noop */
    }
  }
}
