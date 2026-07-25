<script setup lang="ts">
import { computed } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import { storeToRefs } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'
import { SEVERITY } from '../../types/inspection'
import type { Element } from '../../types/inspection'

// Las props posicionales de TresJS (`:position`, `:args`) se tipan como
// THREE.Vector3 en vue-tsc aunque en runtime aceptan tuplas [x,y,z]. Usamos
// `any` para esos valores (siempre referencias estables) y evitar el falso error.
type Tuple3 = any

const store = useInspectionStore()
const { activeStructure, severityByElement, findingsAsOf, selectedElementId, placingPin, pendingPin } =
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

const meshes = computed(() =>
  (activeStructure.value?.elements ?? []).map((el) => ({
    el,
    position: [el.position.x, el.position.y, el.position.z] as Tuple3,
    size: [el.size.x, el.size.y, el.size.z] as Tuple3,
  })),
)

const pins = computed(() =>
  findingsAsOf.value.map((f) => ({
    id: f.id,
    color: SEVERITY[f.severity].color,
    position: [f.pin.x, f.pin.y, f.pin.z] as Tuple3,
  })),
)

/** Color del elemento según su severidad vigente en la fecha del timeline. */
function colorFor(el: Element): string {
  if (el.id === selectedElementId.value) return '#38bdf8'
  const sev = severityByElement.value[el.id]
  return sev != null ? SEVERITY[sev].color : '#5b6b82'
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

// Encuadre de cámara — tuplas estables (solo cambian con la estructura)
const camPos = computed<Tuple3>(() => {
  const g = activeStructure.value?.grid
  if (!g) return [20, 16, 20]
  const spanX = g.baysX * g.bayX
  const spanZ = g.baysZ * g.bayZ
  const h = g.stories * g.storyH
  const d = Math.max(spanX, spanZ, h) * 1.6
  return [d, h * 0.9 + 6, d]
})
const camTarget = computed<Tuple3>(() => {
  const g = activeStructure.value?.grid
  const h = g ? g.stories * g.storyH : 10
  return [0, h / 2, 0]
})

function onPick(el: Element, ev: any) {
  ev?.stopPropagation?.()
  // En modo colocación: clava el pin en el punto exacto de intersección (mundo).
  if (placingPin.value) {
    const p = ev?.point
    if (p) store.setPendingPin({ x: p.x, y: p.y, z: p.z })
    return
  }
  store.selectElement(el.id === selectedElementId.value ? null : el.id)
}
function onHover(_el: Element, ev: any) {
  ev?.stopPropagation?.()
  document.body.style.cursor = placingPin.value ? 'crosshair' : 'pointer'
}
function onLeave() {
  document.body.style.cursor = 'auto'
}
</script>

<template>
  <TresCanvas clear-color="#0b1220">
    <TresPerspectiveCamera :position="camPos" :fov="45" />
    <OrbitControls :target="camTarget" :enable-damping="true" make-default />

    <TresAmbientLight :intensity="0.9" />
    <TresDirectionalLight :position="LIGHT_A" :intensity="1.4" />
    <TresDirectionalLight :position="LIGHT_B" :intensity="0.4" />

    <!-- piso / grilla de referencia -->
    <TresGridHelper :args="GRID_ARGS" />

    <!-- elementos estructurales -->
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
</template>
