<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import * as THREE from 'three'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import { storeToRefs } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { SEVERITY } from '../../types/inspection'
import type { Element } from '../../types/inspection'
import { parseModel } from '../../model'

// Las props posicionales de TresJS (`:position`, `:args`) se tipan como
// THREE.Vector3 en vue-tsc aunque en runtime aceptan tuplas [x,y,z]. Usamos
// `any` para esos valores (siempre referencias estables) y evitar el falso error.
type Tuple3 = any

const store = useInspectionStore()
const { activeStructure, severityByElement, findingsAsOf, selectedElementId, placingPin, pendingPin, modelMessage } =
  storeToRefs(store)

const ghostPin = computed<Tuple3 | null>(() =>
  pendingPin.value ? [pendingPin.value.x, pendingPin.value.y, pendingPin.value.z] : null,
)

// Tuplas estables para args/posiciones estáticas.
const GRID_ARGS: [number, number, string, string] = [60, 60, '#1e293b', '#141e33']
const SPHERE_ARGS: Tuple3 = [0.28, 16, 16]
const GHOST_ARGS: Tuple3 = [0.34, 20, 20]
const LIGHT_A: Tuple3 = [12, 20, 8]
const LIGHT_B: Tuple3 = [-10, 8, -12]

const PLAIN_COLOR = '#5b6b82'
const SELECTED_COLOR = '#38bdf8'

// ─────────────────────────────────────────────────────────────
// Gemelo IMPORTADO (IFC / glTF): geometría real
//
// El pórtico paramétrico se dibuja como cajas declarativas (`<TresMesh>` por
// elemento). Un modelo importado no: su geometría llega como un Object3D ya
// armado por el importador, y se monta con `<primitive>`.
//
// Cada malla lleva `userData.elementId`, que es lo que permite seguir haciendo
// exactamente lo mismo que con las cajas: colorear por severidad y seleccionar
// al hacer click. Sin ese puente el modelo sería una foto, sin nada a lo que
// colgarle un hallazgo.
// ─────────────────────────────────────────────────────────────

// `shallowRef` a propósito: un Object3D de miles de mallas metido en un `ref`
// se volvería reactivo en profundidad y Vue recorrería el grafo entero en cada
// frame. Three ya gestiona su propia mutación.
const imported = shallowRef<THREE.Object3D | null>(null)
const modelError = ref('')
const loadingModel = ref(false)
/** elementId → materiales de sus mallas, para colorear sin volver a recorrer. */
let materialsByElement = new Map<string, THREE.MeshStandardMaterial[]>()

/** Libera la GPU: Three no recolecta geometrías ni materiales solo. */
function disposeImported() {
  const obj = imported.value
  imported.value = null
  materialsByElement = new Map()
  if (!obj) return
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!(mesh as any).isMesh) return
    mesh.geometry?.dispose()
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) m?.dispose()
  })
}

/** Da a cada elemento su propio material, para poder pintarlo por separado. */
function indexMaterials(root: THREE.Object3D) {
  const map = new Map<string, THREE.MeshStandardMaterial[]>()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!(mesh as any).isMesh) return
    const id = String(mesh.userData.elementId ?? '')
    if (!id) return
    // Un material por elemento (compartido entre sus mallas): colorear un pilar
    // es una sola asignación, y no miles de materiales sueltos.
    let mats = map.get(id)
    if (!mats) {
      const mat = new THREE.MeshStandardMaterial({
        color: PLAIN_COLOR,
        roughness: 0.75,
        metalness: 0.05,
      })
      mats = [mat]
      map.set(id, mats)
    }
    mesh.material = mats[0]
  })
  return map
}

/** Aplica al modelo importado los mismos colores que a las cajas. */
function paintImported() {
  for (const [id, mats] of materialsByElement) {
    const color = colorForId(id)
    for (const m of mats) {
      m.color.set(color)
      m.emissive.set(id === selectedElementId.value ? SELECTED_COLOR : '#000000')
      m.emissiveIntensity = id === selectedElementId.value ? 0.5 : 0
    }
  }
}

// Cargar / descargar el modelo al cambiar de estructura.
watch(
  () => activeStructure.value?.id,
  async (id) => {
    disposeImported()
    modelError.value = ''
    const st = activeStructure.value
    if (!id || !st?.model) return
    loadingModel.value = true
    try {
      const blob = await store.ensureModelFile(id)
      if (!blob) {
        modelError.value =
          'El modelo 3D todavía no está en este dispositivo. Conéctate para bajarlo.'
        return
      }
      // Ojo: entre el await y acá el usuario pudo cambiar de estructura.
      if (activeStructure.value?.id !== id) return
      const parsed = await parseModel(blob, st.model.fileName)
      if (activeStructure.value?.id !== id) return
      materialsByElement = indexMaterials(parsed.object)
      imported.value = parsed.object
      paintImported()
    } catch (e) {
      modelError.value = (e as Error)?.message ?? String(e)
    } finally {
      loadingModel.value = false
    }
  },
  { immediate: true },
)

// Repintar cuando cambia la severidad vigente o la selección.
watch([severityByElement, selectedElementId], () => {
  if (imported.value) paintImported()
})

onBeforeUnmount(disposeImported)

// ── Cajas (pórtico paramétrico) ────────────────────────────
const meshes = computed(() =>
  imported.value
    ? []
    : (activeStructure.value?.elements ?? [])
        .filter((el) => el.position && el.size)
        .map((el) => ({
          el,
          position: [el.position!.x, el.position!.y, el.position!.z] as Tuple3,
          size: [el.size!.x, el.size!.y, el.size!.z] as Tuple3,
        })),
)

const pins = computed(() =>
  findingsAsOf.value
    .filter((f) => f.pin)
    .map((f) => ({
      id: f.id,
      color: SEVERITY[f.severity].color,
      position: [f.pin!.x, f.pin!.y, f.pin!.z] as Tuple3,
    })),
)

/** Color de un elemento (por id) según su severidad vigente en el timeline. */
function colorForId(id: string): string {
  if (id === selectedElementId.value) return SELECTED_COLOR
  const sev = severityByElement.value[id]
  return sev != null ? SEVERITY[sev].color : PLAIN_COLOR
}
function colorFor(el: Element): string {
  return colorForId(el.id)
}

/**
 * Emissive SOLO depende de la selección (cambia al hacer click).
 * ⚠️ No debe depender de un estado de "hover" reactivo: si el render lee el
 * elemento bajo el cursor y los eventos @pointer lo escriben, el raycaster de
 * TresJS (activo cada frame por enable-damping) entra en feedback infinito
 * → "Maximum recursive updates". El hover se resuelve solo como cursor.
 */
function emissiveFor(el: Element): string {
  return el.id === selectedElementId.value ? '#0ea5e9' : '#000000'
}

// ── Encuadre de cámara ─────────────────────────────────────
// Con modelo importado no hay grilla de la que deducir el tamaño, así que se
// calcula desde la caja envolvente de los elementos — que existe en los dos
// casos, porque el importador la deja en `position`/`size`.
const extent = computed(() => {
  const g = activeStructure.value?.grid
  if (g) {
    return {
      width: Math.max(g.baysX * g.bayX, g.baysZ * g.bayZ),
      height: g.stories * g.storyH,
    }
  }
  const els = activeStructure.value?.elements ?? []
  let maxXZ = 0
  let maxY = 0
  for (const el of els) {
    if (!el.position || !el.size) continue
    maxXZ = Math.max(maxXZ, Math.abs(el.position.x) + el.size.x, Math.abs(el.position.z) + el.size.z)
    maxY = Math.max(maxY, el.position.y + el.size.y / 2)
  }
  return { width: maxXZ * 2 || 20, height: maxY || 10 }
})

const camPos = computed<Tuple3>(() => {
  const { width, height } = extent.value
  const d = Math.max(width, height) * 1.6
  return [d, height * 0.9 + 6, d]
})
const camTarget = computed<Tuple3>(() => [0, extent.value.height / 2, 0])
/** Grilla de piso proporcional al modelo (un IFC de 80 m se salía de la de 60). */
const gridArgs = computed<Tuple3>(() => {
  const size = Math.max(60, Math.ceil((extent.value.width * 1.5) / 10) * 10)
  return [size, size / 10, GRID_ARGS[2], GRID_ARGS[3]]
})

function pick(id: string | undefined, ev: any) {
  ev?.stopPropagation?.()
  if (placingPin.value) {
    const p = ev?.point
    if (p) store.setPendingPin({ x: p.x, y: p.y, z: p.z })
    return
  }
  if (!id) return
  store.selectElement(id === selectedElementId.value ? null : id)
}
function onPick(el: Element, ev: any) {
  pick(el.id, ev)
}
/** Click sobre el modelo importado: el elemento sale de la malla tocada. */
function onPickImported(ev: any) {
  const id = ev?.object?.userData?.elementId ?? ev?.intersections?.[0]?.object?.userData?.elementId
  pick(id, ev)
}
function onHover(_el: Element | null, ev: any) {
  ev?.stopPropagation?.()
  document.body.style.cursor = placingPin.value ? 'crosshair' : 'pointer'
}
function onLeave() {
  document.body.style.cursor = 'auto'
}
</script>

<template>
  <div class="relative h-full w-full">
    <TresCanvas clear-color="#0b1220">
      <TresPerspectiveCamera :position="camPos" :fov="45" />
      <OrbitControls :target="camTarget" :enable-damping="true" make-default />

      <TresAmbientLight :intensity="0.9" />
      <TresDirectionalLight :position="LIGHT_A" :intensity="1.4" />
      <TresDirectionalLight :position="LIGHT_B" :intensity="0.4" />

      <!-- piso / grilla de referencia -->
      <TresGridHelper :args="gridArgs" />

      <!-- gemelo IMPORTADO: geometría real (IFC / glTF) -->
      <primitive
        v-if="imported"
        :object="imported"
        @click="onPickImported"
        @pointer-enter="onHover(null, $event)"
        @pointer-leave="onLeave"
      />

      <!-- gemelo PARAMÉTRICO: una caja por elemento -->
      <TresMesh
        v-for="m in meshes"
        :key="m.el.id"
        :position="m.position"
        @click="onPick(m.el, $event)"
        @pointer-enter="onHover(m.el, $event)"
        @pointer-leave="onLeave"
      >
        <TresBoxGeometry :args="m.size" />
        <TresMeshStandardMaterial
          :color="colorFor(m.el)"
          :emissive="emissiveFor(m.el)"
          :emissive-intensity="0.6"
          :roughness="0.7"
          :metalness="0.1"
        />
      </TresMesh>

      <!-- pins de hallazgos -->
      <TresMesh v-for="p in pins" :key="p.id" :position="p.position">
        <TresSphereGeometry :args="SPHERE_ARGS" />
        <TresMeshStandardMaterial :color="p.color" :emissive="p.color" :emissive-intensity="0.9" />
      </TresMesh>

      <!-- pin fantasma: previsualización del hallazgo que se está colocando -->
      <TresMesh v-if="ghostPin" :position="ghostPin">
        <TresSphereGeometry :args="GHOST_ARGS" />
        <TresMeshStandardMaterial color="#38bdf8" :emissive="'#38bdf8'" :emissive-intensity="1" />
      </TresMesh>
    </TresCanvas>

    <!-- Estado del modelo importado, sobre el lienzo.
         El resumen del importador (cuántos elementos, qué quedó sin tipo o sin
         piso) no es un detalle: es lo único que le dice a quien carga un IFC si
         el archivo salió bien nombrado o si el gemelo va a ser inservible. -->
    <div
      v-if="loadingModel || modelError || modelMessage"
      class="absolute inset-x-0 top-4 flex justify-center px-4"
    >
      <div
        class="flex max-w-2xl items-start gap-3 rounded-lg border px-3 py-2 text-xs backdrop-blur"
        :class="
          modelError
            ? 'border-red-700/50 bg-red-950/80 text-red-300'
            : 'border-ink-700 bg-ink-900/85 text-ink-300'
        "
      >
        <span>{{ modelError || (loadingModel ? 'Cargando el modelo 3D…' : modelMessage) }}</span>
        <button
          v-if="!loadingModel"
          class="shrink-0 text-ink-500 hover:text-ink-200"
          aria-label="Cerrar aviso"
          @click="modelError = ''; store.modelMessage = ''"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>
