<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Camera, MapPin, Crosshair, Trash2, X } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { damageIcon } from '../../ui/icons'
import {
  DAMAGE_TYPES,
  SEVERITY,
  findingIndex,
  type DamageType,
  type Photo,
  type Severity,
} from '../../types/inspection'

const store = useInspectionStore()
const { selectedElement, selectedElementFindings, currentFindings, activeInspection, pendingPin } =
  storeToRefs(store)

const damageKeys = Object.keys(DAMAGE_TYPES) as DamageType[]
const severities = [0, 1, 2, 3, 4] as Severity[]

const showForm = ref(false)
const form = reactive({
  damageType: 'fisura' as DamageType,
  severity: 2 as Severity,
  extension: 20,
  notes: '',
  photos: [] as Photo[],
})

function resetForm() {
  form.damageType = 'fisura'
  form.severity = 2
  form.extension = 20
  form.notes = ''
  form.photos = []
}

function openForm() {
  showForm.value = true
  resetForm()
  store.startPinPlacement()
}
function closeForm() {
  showForm.value = false
  resetForm()
  store.cancelPinPlacement()
}

// cerrar el formulario si cambia el elemento seleccionado
watch(selectedElement, () => {
  if (showForm.value) closeForm()
})

async function onPhoto(ev: Event) {
  const files = (ev.target as HTMLInputElement).files
  if (!files) return
  for (const file of Array.from(files)) {
    const dataUrl = await new Promise<string>((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.readAsDataURL(file)
    })
    form.photos.push({
      id: 'ph-' + Math.random().toString(36).slice(2, 8),
      dataUrl,
      takenAt: new Date().toISOString(),
    })
  }
  ;(ev.target as HTMLInputElement).value = ''
}

async function submit() {
  const el = selectedElement.value
  if (!el) return
  // pin clavado por raycast; fallback al centro del elemento con offset frontal
  const pin = pendingPin.value ?? {
    x: el.position.x,
    y: el.position.y,
    z: el.position.z + el.size.z / 2 + 0.15,
  }
  const f = await store.addFinding({
    elementId: el.id,
    damageType: form.damageType,
    severity: form.severity,
    extension: form.extension,
    pin,
    notes: form.notes,
  })
  if (f && form.photos.length) await store.updateFinding(f.id, { photos: [...form.photos] })
  closeForm()
}

const list = computed(() =>
  selectedElement.value ? selectedElementFindings.value : currentFindings.value,
)
</script>

<template>
  <aside class="flex flex-col overflow-hidden">
    <!-- cabecera -->
    <div class="border-b border-ink-800 px-4 py-3">
      <template v-if="selectedElement">
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold text-ink-100">{{ selectedElement.tag }}</div>
          <button
            class="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-300"
            @click="store.selectElement(null)"
          >
            <X :size="13" /> cerrar
          </button>
        </div>
        <div class="mt-0.5 text-xs capitalize text-ink-400">
          {{ selectedElement.type }} · Nivel {{ selectedElement.story }}
        </div>
      </template>
      <template v-else>
        <div class="text-sm font-semibold text-ink-100">Resumen de campaña</div>
        <div class="mt-0.5 text-xs text-ink-400">
          {{ activeInspection?.summary || 'Selecciona un elemento en el gemelo 3D' }}
        </div>
      </template>
    </div>

    <!-- lista de hallazgos -->
    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <div v-if="!list.length" class="py-8 text-center text-xs text-ink-500">
        Sin hallazgos {{ selectedElement ? 'en este elemento' : 'en esta campaña' }}.
      </div>

      <div
        v-for="f in list"
        :key="f.id"
        class="mb-2 rounded-lg border border-ink-800 bg-ink-850 p-3"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2">
            <component :is="damageIcon[f.damageType]" :size="16" class="text-ink-300" />
            <span class="text-sm font-medium text-ink-100">
              {{ DAMAGE_TYPES[f.damageType].label }}
            </span>
          </div>
          <span
            class="rounded px-1.5 py-0.5 text-[11px] font-semibold"
            :style="{ background: SEVERITY[f.severity].color + '22', color: SEVERITY[f.severity].color }"
          >
            {{ SEVERITY[f.severity].label }}
          </span>
        </div>

        <div class="mt-2 flex items-center gap-3 text-[11px] text-ink-400">
          <span>Extensión {{ f.extension }}%</span>
          <span>·</span>
          <span>Índice {{ findingIndex(f) }}</span>
        </div>

        <p v-if="f.notes" class="mt-2 text-xs text-ink-300">{{ f.notes }}</p>

        <div v-if="f.photos.length" class="mt-2 flex gap-2 overflow-x-auto">
          <img
            v-for="p in f.photos"
            :key="p.id"
            :src="p.dataUrl || p.url"
            class="h-16 w-16 shrink-0 rounded object-cover"
          />
        </div>

        <button
          class="mt-2 flex items-center gap-1 text-[11px] text-ink-500 hover:text-red-400"
          @click="store.removeFinding(f.id)"
        >
          <Trash2 :size="12" /> Eliminar
        </button>
      </div>
    </div>

    <!-- formulario de nuevo hallazgo -->
    <div v-if="selectedElement" class="border-t border-ink-800 p-3">
      <button
        v-if="!showForm"
        class="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-ink-950 hover:bg-brand-500"
        @click="openForm"
      >
        + Registrar hallazgo
      </button>

      <form v-else class="space-y-3" @submit.prevent="submit">
        <!-- estado del pin por raycast -->
        <div
          class="flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px]"
          :class="
            pendingPin
              ? 'border-brand-600/50 bg-brand-600/10 text-brand-500'
              : 'border-amber-600/40 bg-amber-500/10 text-amber-400'
          "
        >
          <MapPin v-if="pendingPin" :size="14" class="shrink-0" />
          <Crosshair v-else :size="14" class="shrink-0" />
          <span v-if="pendingPin">Pin clavado en el modelo · click de nuevo para reubicar</span>
          <span v-else>Haz click sobre el daño en el modelo 3D para clavar el pin</span>
        </div>

        <div>
          <label class="mb-1 block text-[11px] text-ink-400">Tipo de daño</label>
          <select
            v-model="form.damageType"
            class="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-ink-200"
          >
            <option v-for="k in damageKeys" :key="k" :value="k">
              {{ DAMAGE_TYPES[k].label }}
            </option>
          </select>
        </div>

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
              {{ s }}
            </button>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-[11px] text-ink-400">
            Extensión: {{ form.extension }}%
          </label>
          <input v-model.number="form.extension" type="range" min="0" max="100" class="w-full accent-brand-500" />
        </div>

        <div>
          <label class="mb-1 block text-[11px] text-ink-400">Observaciones</label>
          <textarea
            v-model="form.notes"
            rows="2"
            class="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-ink-200"
            placeholder="Descripción, medidas, recomendaciones…"
          />
        </div>

        <div>
          <label class="mb-1 flex w-fit cursor-pointer items-center gap-1.5 text-[11px] text-brand-500 hover:text-brand-400">
            <Camera :size="14" /> Agregar foto
            <input type="file" accept="image/*" capture="environment" multiple class="hidden" @change="onPhoto" />
          </label>
          <div v-if="form.photos.length" class="flex gap-2 overflow-x-auto">
            <img
              v-for="p in form.photos"
              :key="p.id"
              :src="p.dataUrl || p.url"
              class="h-14 w-14 shrink-0 rounded object-cover"
            />
          </div>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-md border border-ink-700 py-1.5 text-sm text-ink-300 hover:bg-ink-800"
            @click="closeForm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="flex-1 rounded-md bg-brand-600 py-1.5 text-sm font-medium text-ink-950 hover:bg-brand-500"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  </aside>
</template>
