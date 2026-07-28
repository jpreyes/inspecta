<script setup lang="ts">
// Selector de campañas de inspección PERIÓDICAS (visitas discretas).
// Inspecta hace inspecciones periódicas, no monitoreo en tiempo real (eso es SHM).
import { computed, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { CONDITION } from '../../types/inspection'

const store = useInspectionStore()
const { structureInspections, inspectionIndex, activeInspection, conditionByCampaign } =
  storeToRefs(store)

const hasInspections = computed(() => structureInspections.value.length > 0)

// Crear nueva campaña de inspección periódica
const showNew = ref(false)
const draft = reactive({ date: '', inspector: '', weather: '', summary: '' })
function openNew() {
  draft.date = new Date().toISOString().slice(0, 10)
  draft.inspector = activeInspection.value?.inspector ?? ''
  draft.weather = ''
  draft.summary = ''
  showNew.value = true
}
async function createInspection() {
  if (!draft.date || !draft.inspector.trim()) return
  await store.addInspection({
    date: draft.date,
    inspector: draft.inspector.trim(),
    weather: draft.weather.trim() || undefined,
    summary: draft.summary.trim() || undefined,
  })
  showNew.value = false
}

const conditionColor = (id: string) => {
  const c = conditionByCampaign.value.find((x) => x.id === id)
  return c ? CONDITION[c.key].color : '#334155'
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
  <div class="mx-auto max-w-3xl rounded-xl border border-ink-800 bg-ink-900/85 p-3 backdrop-blur">
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
        <input
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
