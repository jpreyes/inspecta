<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Camera, X } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import {
  catalogFor,
  elementInfo,
  damagesForMaterial,
  causesForDamage,
  SEVERITY,
  type Photo,
  type Severity,
} from '../../types/inspection'

const store = useInspectionStore()
const { activeStructure, activeInspection } = storeToRefs(store)

const cat = computed(() => catalogFor(activeStructure.value?.type))
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

// defaults + resets en cascada
form.component = components.value[0]?.component ?? ''
form.element = elementOptions.value[0]?.element ?? ''
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

async function onPhoto(ev: Event) {
  const files = (ev.target as HTMLInputElement).files
  if (!files) return
  for (const file of Array.from(files)) {
    const dataUrl = await new Promise<string>((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.readAsDataURL(file)
    })
    form.photos.push({ id: 'ph-' + Math.random().toString(36).slice(2, 8), dataUrl, takenAt: new Date().toISOString() })
  }
  ;(ev.target as HTMLInputElement).value = ''
}

async function submit() {
  if (!canSave.value || saving.value) return
  saving.value = true
  const f = await store.addFinding({
    component: form.component || undefined,
    element: elementValue.value,
    material: materialValue.value || undefined,
    zone: zoneValue.value || undefined,
    damageType: damageValue.value,
    cause: causeValue.value || undefined,
    severity: form.severity,
    extension: form.extension,
    notes: form.notes,
  })
  if (f && form.photos.length) await store.updateFinding(f.id, { photos: [...form.photos] })
  saving.value = false
  store.closeDamageForm()
}

const selectCls = 'w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-2 text-sm text-ink-100'
const textCls = 'mt-1.5 w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-ink-100'
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8">
    <div class="w-full max-w-lg rounded-xl border border-ink-800 bg-ink-900 shadow-2xl">
      <div class="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-ink-100">Nuevo daño</h2>
          <p class="text-[11px] text-ink-500">{{ activeStructure?.name }} · campaña {{ activeInspection?.date }}</p>
        </div>
        <button class="text-ink-500 hover:text-ink-200" @click="store.closeDamageForm()"><X :size="18" /></button>
      </div>

      <form class="space-y-3 p-4" @submit.prevent="submit">
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
              class="flex-1 rounded-md border py-1.5 text-xs font-medium"
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
          <input v-model.number="form.extension" type="range" min="0" max="100" class="w-full accent-brand-500" />
        </div>

        <div>
          <label class="mb-1 block text-[11px] text-ink-400">Observaciones</label>
          <textarea v-model="form.notes" rows="2" class="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-ink-200" placeholder="Descripción, medidas, recomendaciones…" />
        </div>

        <div>
          <label class="mb-1 flex w-fit cursor-pointer items-center gap-1.5 text-[11px] text-brand-500 hover:text-brand-400">
            <Camera :size="14" /> Agregar foto
            <input type="file" accept="image/*" capture="environment" multiple class="hidden" @change="onPhoto" />
          </label>
          <div v-if="form.photos.length" class="flex gap-2 overflow-x-auto">
            <img v-for="p in form.photos" :key="p.id" :src="p.dataUrl" class="h-14 w-14 shrink-0 rounded object-cover" />
          </div>
        </div>

        <div class="flex gap-2 pt-1">
          <button type="button" class="flex-1 rounded-md border border-ink-700 py-2 text-sm text-ink-300 hover:bg-ink-800" @click="store.closeDamageForm()">Cancelar</button>
          <button type="submit" class="flex-1 rounded-md bg-brand-600 py-2 text-sm font-medium text-ink-950 hover:bg-brand-500 disabled:opacity-50" :disabled="!canSave || saving">Guardar daño</button>
        </div>
      </form>
    </div>
  </div>
</template>
