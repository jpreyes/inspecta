<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Camera, X } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { fileToPhotoDataUrl } from '../../ui/photo'
import {
  catalogForScope,
  elementInfo,
  damagesForMaterial,
  causesForDamage,
  isNonStructural,
  SEVERITY,
  type DamageScope,
  type Photo,
  type Severity,
} from '../../types/inspection'

const store = useInspectionStore()
const { activeStructure, activeInspection, damageFormElementId, damageFormFinding } =
  storeToRefs(store)

// Elemento del modelo 3D vinculado (si el formulario se abrió desde el gemelo):
// el hallazgo se ata a ese elemento para colorear la malla y habilitar "Ver en 3D".
const linkedElement = computed(() =>
  activeStructure.value?.elements.find((e) => e.id === damageFormElementId.value) ?? null,
)

// Ámbito del hallazgo. Lo NO estructural (cielos, cristales, revestimientos,
// barandas, instalaciones) se registra igual y sale en el informe, pero no
// entra en la calificación: cambiarlo cambia el catálogo completo del
// formulario, porque los deterioros y las causas son otros.
// El formulario es el mismo para crear y para corregir. Editar hacía falta de
// verdad: sin esto, un dato mal puesto —propio o de otra persona del equipo—
// solo se podía borrar y volver a escribir entero, y con él se perdían las
// fotos. Se lee UNA vez, sin reactividad: el formulario se monta con `v-if`
// para cada apertura, y así la carga inicial de abajo corre antes que los watch.
const editar = damageFormFinding.value
const scope = ref<DamageScope>(
  editar && isNonStructural(editar) ? 'no-estructural' : 'estructural',
)
const cat = computed(() => catalogForScope(activeStructure.value?.type, scope.value))
const severities = [1, 2, 3, 4, 0] as Severity[]

const form = reactive({
  component: '',
  element: '',
  elementOther: '',
  material: '',
  materialOther: '',
  zone: '',
  zoneOther: '',
  damageType: '',
  damageOther: '',
  cause: '',
  causeOther: '',
  severity: 2 as Severity,
  extension: 20,
  notes: '',
  photos: [] as Photo[],
})

const components = computed(() => cat.value.components)
const elementOptions = computed(() => components.value.find((c) => c.component === form.component)?.elements ?? [])
const info = computed(() => (form.element && form.element !== 'Otro' ? elementInfo(cat.value, form.element) : undefined))
const materialOptions = computed(() => info.value?.materials ?? [])
const zoneOptions = computed(() => info.value?.zones ?? ['Otro'])
const materialValue = computed(() => (form.material === 'Otro' ? form.materialOther.trim() : form.material))
const damageOptions = computed(() => damagesForMaterial(cat.value, materialValue.value))
const causeOptions = computed(() =>
  form.damageType && form.damageType !== 'Otro' ? causesForDamage(cat.value, form.damageType) : [],
)

const elementValue = computed(() => (form.element === 'Otro' ? form.elementOther.trim() : form.element))
const damageValue = computed(() => (form.damageType === 'Otro' ? form.damageOther.trim() : form.damageType))
const zoneValue = computed(() => (form.zone === 'Otro' ? form.zoneOther.trim() : form.zone))
const causeValue = computed(() => (form.cause === 'Otro' ? form.causeOther.trim() : form.cause))
const canSave = computed(() => !!elementValue.value && !!damageValue.value && !!activeInspection.value)
const saving = ref(false)

// Valores iniciales. Se resuelven ANTES de registrar los watch de más abajo:
// esos watch limpian material/zona/daño en cascada, y si corrieran sobre la
// carga de un hallazgo existente lo dejarían a medio llenar.
if (editar) {
  // Un valor guardado puede no estar en el catálogo (se escribió con "Otro…",
  // o el catálogo cambió): en ese caso vuelve al campo libre, que es donde el
  // inspector lo puso.
  const pick = (value: string | undefined, options: string[], other: 'elementOther' | 'materialOther' | 'zoneOther' | 'damageOther' | 'causeOther') => {
    const v = (value ?? '').trim()
    if (!v) return ''
    if (options.includes(v)) return v
    form[other] = v
    return 'Otro'
  }
  // El componente sale del catálogo (donde vive el elemento). Si el elemento se
  // escribió a mano, se respeta el guardado solo si el catálogo lo conoce.
  const enCatalogo = cat.value.components.find((c) =>
    c.elements.some((e) => e.element === editar.element),
  )?.component
  const guardado = components.value.some((c) => c.component === editar.component)
    ? editar.component
    : undefined
  form.component = enCatalogo ?? guardado ?? components.value[0]?.component ?? ''
  form.element = pick(editar.element, elementOptions.value.map((e) => e.element), 'elementOther')
  form.material = pick(editar.material, materialOptions.value, 'materialOther')
  form.zone = pick(editar.zone, zoneOptions.value, 'zoneOther')
  form.damageType = pick(editar.damageType, damageOptions.value.map((d) => d.name), 'damageOther')
  form.cause = pick(editar.cause, causeOptions.value, 'causeOther')
  form.severity = editar.severity
  form.extension = editar.extension
  form.notes = editar.notes ?? ''
  form.photos = [...editar.photos]
} else {
  form.component = components.value[0]?.component ?? ''
  form.element = elementOptions.value[0]?.element ?? ''
}

// resets en cascada
watch(scope, () => {
  form.component = components.value[0]?.component ?? ''
  form.element = elementOptions.value[0]?.element ?? ''
  form.elementOther = ''
})
watch(
  () => form.component,
  () => {
    form.element = elementOptions.value[0]?.element ?? ''
    form.elementOther = ''
  },
)
watch(
  () => form.element,
  () => {
    form.material = ''
    form.materialOther = ''
    form.zone = ''
    form.zoneOther = ''
    form.damageType = ''
    form.cause = ''
  },
)
watch(
  () => [form.material, form.damageType],
  () => {
    form.cause = ''
    form.causeOther = ''
  },
)

// La foto se guarda a tamaño estándar (HD), no como sale de la cámara: ver
// src/ui/photo.ts — 12 MP por hallazgo llenan el navegador y no se suben nunca
// desde terreno.
// Fotos ya subidas que se quitaron en esta edición. No se borran al apretar la
// X sino al Guardar: si no, "Cancelar" ya habría borrado la foto del servidor.
const fotosQuitadas = ref<string[]>([])
function quitarFoto(i: number) {
  const p = form.photos[i]
  if (p?.remoteName) fotosQuitadas.value.push(p.remoteName)
  form.photos.splice(i, 1)
}

async function onPhoto(ev: Event) {
  const files = (ev.target as HTMLInputElement).files
  if (!files) return
  for (const file of Array.from(files)) {
    const dataUrl = await fileToPhotoDataUrl(file)
    form.photos.push({ id: 'ph-' + Math.random().toString(36).slice(2, 8), dataUrl, takenAt: new Date().toISOString() })
  }
  ;(ev.target as HTMLInputElement).value = ''
}

const error = ref('')

async function submit() {
  if (!canSave.value || saving.value) return
  saving.value = true
  error.value = ''
  const datos = {
    component: form.component || undefined,
    element: elementValue.value,
    material: materialValue.value || undefined,
    zone: zoneValue.value || undefined,
    elementId: damageFormElementId.value ?? undefined,
    damageType: damageValue.value,
    cause: causeValue.value || undefined,
    severity: form.severity,
    extension: form.extension,
    nonStructural: scope.value === 'no-estructural',
    notes: form.notes,
  }
  try {
    if (editar) {
      // Las fotos van en el mismo patch: acá están las ya subidas (con
      // `remoteName`) más las que se acaben de agregar.
      await store.updateFinding(editar.id, { ...datos, photos: [...form.photos] })
      // Y las que se quitaron hay que borrarlas también del servidor, o el
      // siguiente pull las devuelve.
      await store.removeStoredPhotos(editar.id, fotosQuitadas.value)
    } else {
      const f = await store.addFinding(datos)
      if (f && form.photos.length) await store.updateFinding(f.id, { photos: [...form.photos] })
    }
  } catch (e) {
    error.value = (e as Error)?.message ?? String(e)
    saving.value = false
    return
  }
  saving.value = false
  store.closeDamageForm()
}

const selectCls = 'w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-2 text-sm text-ink-100'
const textCls =
  'mt-1.5 min-h-9 w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-2 text-sm text-ink-100'
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8">
    <div class="w-full max-w-lg rounded-xl border border-ink-800 bg-ink-900 shadow-2xl">
      <div class="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-ink-100">{{ editar ? 'Editar daño' : 'Nuevo daño' }}</h2>
          <p class="text-[11px] text-ink-500">
            {{ activeStructure?.name }} · campaña {{ activeInspection?.date }}
            <span v-if="linkedElement" class="text-brand-500">· elemento {{ linkedElement.tag }}</span>
            <span v-if="scope === 'no-estructural'" class="text-amber-400">· no estructural</span>
            <span v-if="editar?.authorName" class="text-ink-600">· registró {{ editar.authorName }}</span>
          </p>
        </div>
        <!-- El área tocable va más allá del ícono: 18px son incómodos con el dedo. -->
        <button
          class="-m-2 flex h-9 w-9 items-center justify-center text-ink-500 hover:text-ink-200"
          aria-label="Cerrar"
          @click="store.closeDamageForm()"
        >
          <X :size="18" />
        </button>
      </div>

      <form class="space-y-3 p-4" @submit.prevent="submit">
        <!-- Ámbito: manda el catálogo entero y decide si el daño califica -->
        <div>
          <div class="flex rounded-lg border border-ink-700 bg-ink-950 p-0.5 text-xs">
            <button
              v-for="s in ([
                { v: 'estructural', label: 'Estructural' },
                { v: 'no-estructural', label: 'No estructural' },
              ] as const)"
              :key="s.v"
              type="button"
              class="min-h-9 flex-1 rounded-md px-3 font-medium transition-colors"
              :class="
                scope === s.v ? 'bg-brand-600 text-ink-950' : 'text-ink-400 hover:text-ink-200'
              "
              @click="scope = s.v"
            >
              {{ s.label }}
            </button>
          </div>
          <p v-if="scope === 'no-estructural'" class="mt-1.5 text-[11px] leading-snug text-ink-500">
            Cielos, revestimientos, cristales, barandas, cubierta, instalaciones… Queda
            registrado y sale en el informe, pero <span class="text-ink-300">no entra en la
            condición estructural</span>.
          </p>
        </div>

        <!-- Componente + Elemento -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-[11px] font-medium text-ink-300">Componente</label>
            <select v-model="form.component" :class="selectCls">
              <option v-for="c in components" :key="c.component" :value="c.component">{{ c.component }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-[11px] font-medium text-ink-300">Elemento</label>
            <select v-model="form.element" :class="selectCls">
              <option v-for="e in elementOptions" :key="e.element" :value="e.element">{{ e.element }}</option>
              <option value="Otro">Otro…</option>
            </select>
            <input v-if="form.element === 'Otro'" v-model="form.elementOther" type="text" placeholder="Escribe el elemento" :class="textCls" />
          </div>
        </div>

        <!-- Material + Zona -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-[11px] font-medium text-ink-300">Material</label>
            <select v-model="form.material" :class="selectCls">
              <option value="">— sin especificar —</option>
              <option v-for="m in materialOptions" :key="m" :value="m">{{ m }}</option>
              <option value="Otro">Otro…</option>
            </select>
            <input v-if="form.material === 'Otro'" v-model="form.materialOther" type="text" placeholder="Escribe el material" :class="textCls" />
          </div>
          <div>
            <label class="mb-1 block text-[11px] font-medium text-ink-300">Zona / ubicación</label>
            <select v-model="form.zone" :class="selectCls">
              <option value="">— sin especificar —</option>
              <option v-for="z in zoneOptions" :key="z" :value="z">{{ z }}</option>
            </select>
            <input v-if="form.zone === 'Otro'" v-model="form.zoneOther" type="text" placeholder="Escribe la zona" :class="textCls" />
          </div>
        </div>

        <!-- Deterioro + Causa -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-[11px] font-medium text-ink-300">Tipo de daño</label>
            <select v-model="form.damageType" :class="selectCls">
              <option value="">— selecciona —</option>
              <option v-for="d in damageOptions" :key="d.name" :value="d.name">{{ d.name }}</option>
              <option value="Otro">Otro…</option>
            </select>
            <input v-if="form.damageType === 'Otro'" v-model="form.damageOther" type="text" placeholder="Escribe el daño" :class="textCls" />
          </div>
          <div>
            <label class="mb-1 block text-[11px] font-medium text-ink-300">Causa probable</label>
            <select v-model="form.cause" :class="selectCls">
              <option value="">— sin especificar —</option>
              <option v-for="c in causeOptions" :key="c" :value="c">{{ c }}</option>
              <option value="Otro">Otro…</option>
            </select>
            <input v-if="form.cause === 'Otro'" v-model="form.causeOther" type="text" placeholder="Escribe la causa" :class="textCls" />
          </div>
        </div>

        <!-- Severidad -->
        <div>
          <label class="mb-1 block text-[11px] text-ink-400">Severidad</label>
          <div class="flex gap-1">
            <button
              v-for="s in severities"
              :key="s"
              type="button"
              class="min-h-9 flex-1 rounded-md border py-2 text-xs font-medium"
              :style="
                form.severity === s
                  ? { background: SEVERITY[s].color, borderColor: SEVERITY[s].color, color: '#0b1220' }
                  : { borderColor: '#334155', color: SEVERITY[s].color }
              "
              @click="form.severity = s"
            >
              {{ SEVERITY[s].label }}
            </button>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-[11px] text-ink-400">Extensión: {{ form.extension }}%</label>
          <input v-model.number="form.extension" type="range" min="0" max="100" class="h-9 w-full accent-brand-500" />
        </div>

        <div>
          <label class="mb-1 block text-[11px] text-ink-400">Observaciones</label>
          <textarea v-model="form.notes" rows="2" class="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-2 text-sm text-ink-200" placeholder="Descripción, medidas, recomendaciones…" />
        </div>

        <div>
          <label class="mb-1 flex min-h-9 w-fit cursor-pointer items-center gap-1.5 py-1.5 text-[11px] text-brand-500 hover:text-brand-400">
            <Camera :size="14" /> Agregar foto
            <input type="file" accept="image/*" capture="environment" multiple class="hidden" @change="onPhoto" />
          </label>
          <!-- `url` (no solo `dataUrl`): al editar, las fotos ya subidas viven en
               el servidor y solo tienen su enlace. -->
          <div v-if="form.photos.length" class="flex gap-2 overflow-x-auto">
            <div v-for="(p, i) in form.photos" :key="p.id" class="relative shrink-0">
              <button
                type="button"
                class="h-14 w-14 overflow-hidden rounded hover:ring-2 hover:ring-brand-600"
                title="Ver la foto completa"
                @click="store.openPhotoViewer(form.photos, i)"
              >
                <img :src="p.dataUrl || p.url" class="h-full w-full object-cover" />
              </button>
              <!-- Se quita cualquier foto, subida o no. La que ya está en el
                   servidor se borra allá al guardar (ver sync/photos.ts): sin
                   eso, sacarla de la lista local no servía de nada porque el
                   siguiente pull la devolvía. -->
              <button
                type="button"
                class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink-950/90 text-ink-400 hover:text-red-400"
                title="Quitar foto"
                aria-label="Quitar foto"
                @click="quitarFoto(i)"
              >
                <X :size="11" />
              </button>
            </div>
          </div>
        </div>

        <p v-if="error" class="text-[11px] text-red-400">{{ error }}</p>

        <div class="flex gap-2 pt-1">
          <button type="button" class="flex-1 rounded-md border border-ink-700 py-2 text-sm text-ink-300 hover:bg-ink-800" @click="store.closeDamageForm()">Cancelar</button>
          <button type="submit" class="flex-1 rounded-md bg-brand-600 py-2 text-sm font-medium text-ink-950 hover:bg-brand-500 disabled:opacity-50" :disabled="!canSave || saving">
            {{ editar ? 'Guardar cambios' : 'Guardar daño' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
