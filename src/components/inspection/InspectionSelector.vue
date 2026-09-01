<script setup lang="ts">
// Selector de campañas de inspección PERIÓDICAS (visitas discretas).
// Inspecta hace inspecciones periódicas, no monitoreo en tiempo real (eso es SHM).
import { computed, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { CONDITION } from '../../types/inspection'

const store = useInspectionStore()
const {
  structureInspections,
  inspectionIndex,
  activeInspection,
  conditionByCampaign,
  canWorkHere,
  teamMembers,
  authUser,
} = storeToRefs(store)

const hasInspections = computed(() => structureInspections.value.length > 0)

/** Con equipo, el inspector se elige entre los miembros que trabajan en terreno.
 *  Sin equipo (modo local) sigue siendo texto libre. */
const fieldMembers = computed(() =>
  teamMembers.value.filter((m) => m.role === 'admin' || m.role === 'inspector'),
)
const pickInspector = computed(() => fieldMembers.value.length > 0)

// Crear nueva campaña de inspección periódica
const showNew = ref(false)
const draft = reactive({ date: '', inspector: '', inspectorId: '', weather: '', summary: '' })
const error = ref('')

function openNew() {
  draft.date = new Date().toISOString().slice(0, 10)
  // Con equipo, por defecto se propone al propio usuario.
  const me = fieldMembers.value.find((m) => m.userId === authUser.value?.id)
  draft.inspectorId = me?.userId ?? ''
  draft.inspector = me
    ? me.email || me.name || me.userId
    : (activeInspection.value?.inspector ?? '')
  draft.weather = ''
  draft.summary = ''
  error.value = ''
  showNew.value = true
}

function onPickInspector(userId: string) {
  draft.inspectorId = userId
  const m = fieldMembers.value.find((x) => x.userId === userId)
  draft.inspector = m ? m.email || m.name || m.userId : ''
}

async function createInspection() {
  if (!draft.date || !draft.inspector.trim()) return
  error.value = ''
  try {
    await store.addInspection({
      date: draft.date,
      inspector: draft.inspector.trim(),
      inspectorId: draft.inspectorId || undefined,
      weather: draft.weather.trim() || undefined,
      summary: draft.summary.trim() || undefined,
    })
    showNew.value = false
  } catch (e) {
    error.value = (e as Error)?.message ?? String(e)
  }
}

const campaign = (id: string) => conditionByCampaign.value.find((x) => x.id === id)
const conditionColor = (id: string) => {
  const c = campaign(id)
  return c ? CONDITION[c.key].color : '#334155'
}
/** Cuánto trabajo tiene registrado esa campaña. Se muestra en la pill porque la
 *  app abre una sola campaña: sin el número, el trabajo de otra visita —o el que
 *  acaba de subir otra persona— parece no existir. */
const workload = (id: string) => {
  const c = campaign(id)
  if (!c) return ''
  const parts = []
  if (c.findings) parts.push(`${c.findings} daño${c.findings === 1 ? '' : 's'}`)
  if (c.tests) parts.push(`${c.tests} ensayo${c.tests === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function step(dir: number) {
  store.selectInspectionByIndex(inspectionIndex.value + dir)
}
</script>

<template>
  <div data-tour="campaigns" class="mx-auto max-w-3xl rounded-xl border border-ink-800 bg-ink-900/85 p-3 backdrop-blur">
    <div class="mb-2 flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs text-ink-400">
        <CalendarDays :size="14" />
        <span>Inspecciones periódicas</span>
        <span class="text-ink-600">· {{ structureInspections.length }}</span>
      </div>
      <div class="flex items-center gap-3">
        <div v-if="activeInspection" class="text-xs text-ink-300">
          <span class="font-medium text-ink-100">{{ fmt(activeInspection.date) }}</span>
          <span class="text-ink-500"> · {{ activeInspection.inspector }}</span>
        </div>
        <button
          v-if="canWorkHere"
          class="flex items-center gap-1 rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800"
          @click="openNew"
        >
          <Plus :size="13" /> Nueva
        </button>
      </div>
    </div>

    <!-- formulario nueva inspección -->
    <form
      v-if="showNew"
      class="mb-2 flex flex-wrap items-end gap-2 rounded-lg border border-ink-800 bg-ink-950/60 p-2"
      @submit.prevent="createInspection"
    >
      <label class="text-[11px] text-ink-400">
        Fecha
        <input
          v-model="draft.date"
          type="date"
          class="mt-0.5 block rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-ink-200"
        />
      </label>
      <label class="flex-1 text-[11px] text-ink-400">
        Inspector
        <select
          v-if="pickInspector"
          :value="draft.inspectorId"
          class="mt-0.5 block w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-ink-200"
          @change="onPickInspector(($event.target as HTMLSelectElement).value)"
        >
          <option value="">— Elige un miembro —</option>
          <option v-for="m in fieldMembers" :key="m.userId" :value="m.userId">
            {{ m.email || m.name || m.userId }}
          </option>
        </select>
        <input
          v-else
          v-model="draft.inspector"
          type="text"
          placeholder="Nombre"
          class="mt-0.5 block w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-ink-200"
        />
      </label>
      <label class="text-[11px] text-ink-400">
        Clima
        <input
          v-model="draft.weather"
          type="text"
          placeholder="Nublado, 12°C"
          class="mt-0.5 block w-32 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-ink-200"
        />
      </label>
      <label class="w-full text-[11px] text-ink-400">
        Resumen
        <textarea
          v-model="draft.summary"
          rows="2"
          placeholder="Objetivo y hallazgos generales de la visita…"
          class="mt-0.5 block w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-ink-200"
        />
      </label>
      <button type="submit" class="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-brand-500">
        Crear
      </button>
      <button type="button" class="rounded-md border border-ink-700 px-2 py-1.5 text-xs text-ink-300" @click="showNew = false">
        Cancelar
      </button>
      <p v-if="error" class="w-full text-[11px] text-red-400">{{ error }}</p>
    </form>

    <div v-if="!hasInspections" class="py-2 text-center text-xs text-ink-500">
      Sin inspecciones. Crea la primera con “Nueva”.
    </div>

    <div v-else class="flex items-center gap-2">
      <button
        class="rounded-md border border-ink-700 px-2 py-1 text-ink-300 hover:bg-ink-800 disabled:opacity-40"
        :disabled="inspectionIndex === 0"
        title="Inspección anterior"
        @click="step(-1)"
      >
        <ChevronLeft :size="14" />
      </button>

      <!-- campañas discretas como pills -->
      <div class="flex flex-1 flex-wrap gap-1.5">
        <button
          v-for="(insp, i) in structureInspections"
          :key="insp.id"
          class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors"
          :class="
            i === inspectionIndex
              ? 'border-brand-600 bg-brand-600/15 text-ink-100'
              : 'border-ink-700 text-ink-400 hover:bg-ink-800'
          "
          @click="store.selectInspectionByIndex(i)"
        >
          <span class="h-2 w-2 rounded-full" :style="{ background: conditionColor(insp.id) }" />
          {{ fmt(insp.date) }}
          <span
            v-if="campaign(insp.id)?.findings || campaign(insp.id)?.tests"
            class="rounded-full bg-ink-700/60 px-1.5 text-[10px] font-semibold text-ink-300"
            :title="workload(insp.id)"
          >
            {{ (campaign(insp.id)?.findings ?? 0) + (campaign(insp.id)?.tests ?? 0) }}
          </span>
        </button>
      </div>

      <button
        class="rounded-md border border-ink-700 px-2 py-1 text-ink-300 hover:bg-ink-800 disabled:opacity-40"
        :disabled="inspectionIndex >= structureInspections.length - 1"
        title="Inspección siguiente"
        @click="step(1)"
      >
        <ChevronRight :size="14" />
      </button>
    </div>
  </div>
</template>
