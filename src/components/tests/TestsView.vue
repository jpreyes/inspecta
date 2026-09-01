<script setup lang="ts">
// Vista de ENSAYOS de la campaña.
//
// Antes vivían al final de "Resultados": para agregar una esclerometría había
// que cambiar de vista y bajar por toda la pantalla de KPIs, lo que en terreno
// —con el teléfono en una mano— hacía que simplemente no se registraran.
// Acá tienen pantalla propia, con las dos acciones que se hacen de verdad:
// crear la campaña del año y agregar el ensayo.
import { computed, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { FlaskConical, Plus, Trash2, CalendarDays } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { TEST_PRESETS, type TestPreset } from '../../data/tests'
import InspectionSelector from '../inspection/InspectionSelector.vue'

const store = useInspectionStore()
const { activeStructure, activeInspection, currentTests, canWorkHere } = storeToRefs(store)

const showNew = ref(false)
const draft = reactive({
  testType: '',
  method: '',
  standard: '',
  executedAt: '',
  laboratory: '',
  sampleLocation: '',
  resultSummary: '',
})
/** Ejemplo de resultado del ensayo elegido (placeholder del campo). */
const resultHint = ref('')
const error = ref('')

function openNew() {
  Object.assign(draft, {
    testType: '',
    method: '',
    standard: '',
    laboratory: '',
    sampleLocation: '',
    resultSummary: '',
  })
  draft.executedAt = activeInspection.value?.date ?? new Date().toISOString().slice(0, 10)
  resultHint.value = ''
  error.value = ''
  showNew.value = true
}

/** Atajo: rellena tipo, método y norma; el resto lo pone el inspector. */
function applyPreset(p: TestPreset) {
  draft.testType = p.testType
  draft.method = p.method
  draft.standard = p.standard === '—' ? '' : p.standard
  resultHint.value = p.resultHint
}

const canSave = computed(() => !!draft.testType.trim() && !!draft.resultSummary.trim())

async function create() {
  if (!canSave.value) return
  error.value = ''
  try {
    await store.addTest({
      testType: draft.testType.trim(),
      method: draft.method.trim() || undefined,
      standard: draft.standard.trim() || undefined,
      executedAt: draft.executedAt,
      laboratory: draft.laboratory.trim() || undefined,
      sampleLocation: draft.sampleLocation.trim() || undefined,
      resultSummary: draft.resultSummary.trim(),
    })
    showNew.value = false
  } catch (e) {
    error.value = (e as Error)?.message ?? String(e)
  }
}

function fmt(d?: string) {
  return d
    ? new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'
}

const inputCls =
  'min-h-9 rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-ink-200'
</script>

<template>
  <section class="mx-auto max-w-4xl space-y-4 p-6">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-ink-100">Ensayos</h1>
        <p class="mt-0.5 text-sm text-ink-400">
          {{ activeStructure?.name }} · campaña {{ fmt(activeInspection?.date) }}
        </p>
      </div>
      <button
        v-if="activeInspection && canWorkHere"
        data-tour="tests"
        class="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-500"
        @click="showNew ? (showNew = false) : openNew()"
      >
        <Plus :size="16" /> Nuevo ensayo
      </button>
    </header>

    <!-- Los ensayos cuelgan de una campaña: si no hay, lo primero es crearla. -->
    <InspectionSelector />

    <div
      v-if="!activeInspection"
      class="flex items-start gap-2 rounded-lg border border-amber-700/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300"
    >
      <CalendarDays :size="14" class="mt-0.5 shrink-0" />
      <span>Los ensayos se registran dentro de una campaña. Crea la primera con «Nueva» acá arriba.</span>
    </div>

    <!-- formulario nuevo ensayo -->
    <form
      v-if="showNew"
      class="grid gap-2 rounded-xl border border-brand-600/40 bg-ink-900 p-4 sm:grid-cols-2"
      @submit.prevent="create"
    >
      <!-- Atajos de ensayos frecuentes: rellenan método y norma, que es lo que
           siempre se escribe igual y siempre se escribe mal. -->
      <div class="flex flex-wrap gap-1.5 sm:col-span-2">
        <button
          v-for="p in TEST_PRESETS"
          :key="p.testType"
          type="button"
          class="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
          :class="
            draft.testType === p.testType
              ? 'border-brand-600 bg-brand-600/15 text-ink-100'
              : 'border-ink-700 text-ink-400 hover:bg-ink-800'
          "
          :title="p.standard === '—' ? p.method : p.method + ' · ' + p.standard"
          @click="applyPreset(p)"
        >
          {{ p.testType }}
        </button>
      </div>
      <input v-model="draft.testType" placeholder="Tipo (ej. Esclerometría)" :class="inputCls" />
      <input v-model="draft.executedAt" type="date" :class="inputCls" />
      <input v-model="draft.method" placeholder="Método" :class="inputCls" />
      <input v-model="draft.standard" placeholder="Norma (ej. NCh1565)" :class="inputCls" />
      <input v-model="draft.laboratory" placeholder="Laboratorio" :class="inputCls" />
      <input v-model="draft.sampleLocation" placeholder="Ubicación de la muestra" :class="inputCls" />
      <textarea
        v-model="draft.resultSummary"
        rows="2"
        :placeholder="resultHint ? 'Resultado, ej. ' + resultHint : 'Resultado / resumen'"
        :class="inputCls + ' sm:col-span-2'"
      />
      <div class="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          class="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-ink-950 hover:bg-brand-500 disabled:opacity-50"
          :disabled="!canSave"
        >
          Guardar ensayo
        </button>
        <button
          type="button"
          class="rounded-md border border-ink-700 px-3 py-2 text-sm text-ink-300"
          @click="showNew = false"
        >
          Cancelar
        </button>
      </div>
      <p v-if="error" class="text-[11px] text-red-400 sm:col-span-2">{{ error }}</p>
    </form>

    <div
      v-if="!currentTests.length && !showNew"
      class="rounded-xl border border-dashed border-ink-800 px-4 py-12 text-center"
    >
      <FlaskConical :size="28" class="mx-auto text-ink-700" />
      <p class="mt-2 text-sm text-ink-400">Sin ensayos registrados en esta campaña.</p>
      <button
        v-if="activeInspection && canWorkHere"
        class="mx-auto mt-3 flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-500"
        @click="openNew"
      >
        <Plus :size="16" /> Registrar primer ensayo
      </button>
    </div>

    <div v-else-if="currentTests.length" class="divide-y divide-ink-800 rounded-xl border border-ink-800 bg-ink-900">
      <div v-for="t in currentTests" :key="t.id" class="group px-4 py-3">
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-2 text-sm font-medium text-ink-100">
            <FlaskConical :size="15" class="text-ink-400" /> {{ t.testType }}
          </span>
          <div class="flex items-center gap-3">
            <span class="text-xs text-ink-500">{{ fmt(t.executedAt) }}</span>
            <button
              v-if="canWorkHere"
              class="text-ink-600 transition-opacity hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
              title="Eliminar ensayo"
              aria-label="Eliminar ensayo"
              @click="store.removeTest(t.id)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
        <div class="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-400">
          <span v-if="t.method">Método: {{ t.method }}</span>
          <span v-if="t.standard">Norma: {{ t.standard }}</span>
          <span v-if="t.laboratory">Lab: {{ t.laboratory }}</span>
          <span v-if="t.sampleLocation">Muestra: {{ t.sampleLocation }}</span>
        </div>
        <p class="mt-1 text-sm text-ink-200">{{ t.resultSummary }}</p>
        <p v-if="t.authorName" class="mt-1 text-[10px] text-ink-600">Registró {{ t.authorName }}</p>
      </div>
    </div>
  </section>
</template>
