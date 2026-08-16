<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Printer, FlaskConical, FileText, Plus, Trash2 } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { iconForDamage } from '../../ui/icons'
import { CONDITION, SEVERITY, findingIndex, findingPriority, type Severity } from '../../types/inspection'
import VulnerabilityPanel from './VulnerabilityPanel.vue'
import { TEST_PRESETS, type TestPreset } from '../../data/tests'

const store = useInspectionStore()
const {
  activeStructure,
  activeProject,
  activeInspection,
  structureCondition,
  structureConditionKey,
  structureHazard,
  structureRisk,
  structureIrregularities,
  nonStructuralCount,
  conditionByCampaign,
  severityCounts,
  currentFindings,
  currentTests,
  canWorkHere,
  activeTeam,
} = storeToRefs(store)

const condition = computed(() => CONDITION[structureConditionKey.value])

// hallazgos de la campaña ordenados por prioridad de intervención (pronóstico:
// daño × riesgo de la causa), peor primero
const prioritized = computed(() =>
  [...currentFindings.value].sort((a, b) => findingPriority(b) - findingPriority(a)),
)

const totalFindings = computed(() => currentFindings.value.length)
const affectedEls = computed(() =>
  Object.values(severityCounts.value).slice(1).reduce((a, b) => a + b, 0),
)
const totalPhotos = computed(() =>
  currentFindings.value.reduce((n, f) => n + f.photos.length, 0),
)

// distribución de severidad (solo 1–4, el 0 es "sin daño")
const sevLevels: Severity[] = [4, 3, 2, 1]
const sevTotal = computed(() =>
  sevLevels.reduce<number>((n, s) => n + severityCounts.value[s], 0),
)
function sevPct(s: Severity) {
  return sevTotal.value ? (severityCounts.value[s] / sevTotal.value) * 100 : 0
}

const maxCampaignScore = computed(() =>
  Math.max(10, ...conditionByCampaign.value.map((c) => c.score)),
)

function fmt(d?: string) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function viewIn3D(elementId?: string) {
  if (!elementId) return
  store.selectElement(elementId)
  store.setView('twin')
}
function printReport() {
  window.print()
}

// Ensayos: alta/baja
const showNewTest = ref(false)
const testDraft = reactive({
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

function openNewTest() {
  Object.assign(testDraft, { testType: '', method: '', standard: '', laboratory: '', sampleLocation: '', resultSummary: '' })
  testDraft.executedAt = activeInspection.value?.date ?? new Date().toISOString().slice(0, 10)
  resultHint.value = ''
  showNewTest.value = true
}

/** Atajo: rellena tipo, método y norma; el resto lo pone el inspector. */
function applyPreset(p: TestPreset) {
  testDraft.testType = p.testType
  testDraft.method = p.method
  testDraft.standard = p.standard === '—' ? '' : p.standard
  resultHint.value = p.resultHint
}
async function createTest() {
  if (!testDraft.testType.trim() || !testDraft.resultSummary.trim()) return
  await store.addTest({
    testType: testDraft.testType.trim(),
    method: testDraft.method.trim() || undefined,
    standard: testDraft.standard.trim() || undefined,
    executedAt: testDraft.executedAt,
    laboratory: testDraft.laboratory.trim() || undefined,
    sampleLocation: testDraft.sampleLocation.trim() || undefined,
    resultSummary: testDraft.resultSummary.trim(),
  })
  showNewTest.value = false
}

const generating = ref(false)
async function generateDocx() {
  if (generating.value || !activeStructure.value || !activeInspection.value) return
  generating.value = true
  try {
    const { downloadReport } = await import('../../report/docx')
    await downloadReport({
      project: activeProject.value,
      structure: activeStructure.value,
      inspection: activeInspection.value,
      findings: prioritized.value,
      tests: currentTests.value,
      conditionScore: structureCondition.value,
      conditionKey: structureConditionKey.value,
      hazardScore: structureHazard.value,
      risk: structureRisk.value,
      irregularities: structureIrregularities.value,
      nonStructuralCount: nonStructuralCount.value,
      generatedAt: new Date().toISOString(),
      teamName: activeTeam.value?.name,
      preparedBy: store.authUser?.name || store.authUser?.email || undefined,
    })
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-5xl space-y-5 p-6">
    <!-- Cabecera -->
    <header class="flex items-start justify-between">
      <div>
        <h1 class="text-xl font-semibold text-ink-100">{{ activeStructure?.name }}</h1>
        <p class="mt-0.5 text-sm text-ink-400">
          Campaña {{ fmt(activeInspection?.date) }} · {{ activeInspection?.inspector }}
        </p>
        <p v-if="activeInspection?.summary" class="mt-1 max-w-2xl text-sm text-ink-300">
          {{ activeInspection.summary }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          data-tour="report"
          class="flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 disabled:opacity-50"
          :disabled="generating"
          @click="generateDocx"
        >
          <FileText :size="15" /> {{ generating ? 'Generando…' : 'Informe Word' }}
        </button>
        <button
          class="flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-2 text-sm text-ink-300 hover:bg-ink-800"
          title="Imprimir / PDF"
          @click="printReport"
        >
          <Printer :size="15" />
        </button>
      </div>
    </header>

    <!-- KPIs -->
    <div data-tour="kpis" class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <!-- condición global (semáforo) -->
      <div
        class="rounded-xl border p-4"
        :style="{ borderColor: condition.color + '55', background: condition.color + '12' }"
      >
        <div class="text-[11px] uppercase tracking-wide text-ink-400">Condición</div>
        <div class="mt-1 flex items-baseline gap-2">
          <span class="text-2xl font-bold" :style="{ color: condition.color }">
            {{ structureCondition }}
          </span>
          <span class="text-xs text-ink-500">/100</span>
        </div>
        <div class="mt-1 flex items-center gap-1.5 text-xs" :style="{ color: condition.color }">
          <span class="h-2 w-2 rounded-full" :style="{ background: condition.color }" />
          {{ condition.label }}
        </div>
      </div>

      <div class="rounded-xl border border-ink-800 bg-ink-900 p-4">
        <div class="text-[11px] uppercase tracking-wide text-ink-400">Hallazgos</div>
        <div class="mt-1 text-2xl font-bold text-ink-100">{{ totalFindings }}</div>
      </div>
      <div class="rounded-xl border border-ink-800 bg-ink-900 p-4">
        <div class="text-[11px] uppercase tracking-wide text-ink-400">Elem. afectados</div>
        <div class="mt-1 text-2xl font-bold text-ink-100">{{ affectedEls }}</div>
      </div>
      <div class="rounded-xl border border-ink-800 bg-ink-900 p-4">
        <div class="text-[11px] uppercase tracking-wide text-ink-400">Ensayos</div>
        <div class="mt-1 text-2xl font-bold text-ink-100">{{ currentTests.length }}</div>
      </div>
      <div class="rounded-xl border border-ink-800 bg-ink-900 p-4">
        <div class="text-[11px] uppercase tracking-wide text-ink-400">Fotos</div>
        <div class="mt-1 text-2xl font-bold text-ink-100">{{ totalPhotos }}</div>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <!-- Distribución por severidad -->
      <div class="rounded-xl border border-ink-800 bg-ink-900 p-4">
        <h2 class="text-sm font-semibold text-ink-200">Distribución por severidad</h2>
        <div v-if="sevTotal" class="mt-3 flex h-3 overflow-hidden rounded-full">
          <div
            v-for="s in sevLevels"
            :key="s"
            :style="{ width: sevPct(s) + '%', background: SEVERITY[s].color }"
          />
        </div>
        <div v-else class="mt-3 text-xs text-ink-500">Sin daños registrados.</div>
        <div class="mt-3 space-y-1.5">
          <div
            v-for="s in sevLevels"
            :key="s"
            class="flex items-center justify-between text-xs"
          >
            <div class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-sm" :style="{ background: SEVERITY[s].color }" />
              <span class="text-ink-300">{{ SEVERITY[s].label }}</span>
            </div>
            <span class="font-medium text-ink-200">{{ severityCounts[s] }}</span>
          </div>
        </div>
      </div>

      <!-- Condición por campaña de inspección (comparación entre visitas periódicas) -->
      <div class="rounded-xl border border-ink-800 bg-ink-900 p-4">
        <h2 class="text-sm font-semibold text-ink-200">Condición por inspección</h2>
        <div class="mt-4 flex h-32 items-end gap-3">
          <div
            v-for="c in conditionByCampaign"
            :key="c.id"
            class="flex flex-1 flex-col items-center gap-1"
          >
            <span class="text-xs font-semibold" :style="{ color: CONDITION[c.key].color }">
              {{ c.score }}
            </span>
            <div
              class="w-full rounded-t transition-all"
              :style="{
                height: (c.score / maxCampaignScore) * 90 + 'px',
                background: CONDITION[c.key].color,
                minHeight: '4px',
              }"
            />
            <span class="text-[10px] text-ink-500">{{ fmt(c.date) }}</span>
          </div>
        </div>
        <p class="mt-2 text-[11px] text-ink-500">Índice de salud: 100 = sano · 0 = crítico.</p>
      </div>
    </div>

    <!-- Vulnerabilidad por configuración (eje separado de la condición) -->
    <VulnerabilityPanel />

    <!-- Hallazgos priorizados -->
    <div class="rounded-xl border border-ink-800 bg-ink-900">
      <div class="border-b border-ink-800 px-4 py-3">
        <h2 class="text-sm font-semibold text-ink-200">Hallazgos priorizados</h2>
      </div>
      <div v-if="!prioritized.length" class="px-4 py-8 text-center text-sm text-ink-500">
        Sin hallazgos a la fecha de esta campaña.
      </div>
      <div v-else class="divide-y divide-ink-800">
        <div
          v-for="f in prioritized"
          :key="f.id"
          class="flex items-center gap-4 px-4 py-3 hover:bg-ink-850"
        >
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            :style="{ background: SEVERITY[f.severity].color + '22', color: SEVERITY[f.severity].color }"
          >
            <component :is="iconForDamage(f.damageType)" :size="18" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-ink-100">{{ f.damageType }}</span>
              <span class="text-xs text-ink-500">· {{ f.element }}<span v-if="f.zone"> / {{ f.zone }}</span></span>
            </div>
            <p v-if="f.notes" class="truncate text-xs text-ink-400">{{ f.notes }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-3 text-xs">
            <div class="hidden gap-1 sm:flex">
              <img
                v-for="p in f.photos.slice(0, 2)"
                :key="p.id"
                :src="p.dataUrl || p.url"
                class="h-9 w-9 rounded object-cover"
              />
            </div>
            <div class="text-right">
              <div class="text-ink-400">Ext {{ f.extension }}% · Índice {{ findingIndex(f) }}</div>
              <div class="text-ink-500">Prioridad {{ findingPriority(f) }}</div>
            </div>
            <span
              class="rounded px-1.5 py-0.5 text-[11px] font-semibold"
              :style="{ background: SEVERITY[f.severity].color + '22', color: SEVERITY[f.severity].color }"
            >
              {{ SEVERITY[f.severity].label }}
            </span>
            <button
              v-if="f.elementId"
              class="rounded-md border border-ink-700 px-2 py-1 text-ink-300 hover:bg-ink-800"
              @click="viewIn3D(f.elementId)"
            >
              Ver en 3D
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Ensayos -->
    <div data-tour="tests" class="rounded-xl border border-ink-800 bg-ink-900">
      <div class="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <h2 class="text-sm font-semibold text-ink-200">Ensayos</h2>
        <button
          v-if="activeInspection && canWorkHere"
          class="flex items-center gap-1 rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-800"
          @click="showNewTest ? (showNewTest = false) : openNewTest()"
        >
          <Plus :size="13" /> Nuevo ensayo
        </button>
      </div>

      <!-- formulario nuevo ensayo -->
      <form v-if="showNewTest" class="grid gap-2 border-b border-ink-800 p-4 sm:grid-cols-2" @submit.prevent="createTest">
        <!-- Atajos de ensayos frecuentes -->
        <div class="flex flex-wrap gap-1.5 sm:col-span-2">
          <button
            v-for="p in TEST_PRESETS"
            :key="p.testType"
            type="button"
            class="rounded-full border px-2 py-0.5 text-[11px] transition-colors"
            :class="
              testDraft.testType === p.testType
                ? 'border-brand-600 bg-brand-600/15 text-ink-100'
                : 'border-ink-700 text-ink-400 hover:bg-ink-800'
            "
            :title="p.standard === '—' ? p.method : p.method + ' · ' + p.standard"
            @click="applyPreset(p)"
          >
            {{ p.testType }}
          </button>
        </div>
        <input v-model="testDraft.testType" placeholder="Tipo (ej. Esclerometría)" class="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs text-ink-200" />
        <input v-model="testDraft.executedAt" type="date" class="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs text-ink-200" />
        <input v-model="testDraft.method" placeholder="Método" class="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs text-ink-200" />
        <input v-model="testDraft.standard" placeholder="Norma (ej. NCh1565)" class="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs text-ink-200" />
        <input v-model="testDraft.laboratory" placeholder="Laboratorio" class="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs text-ink-200" />
        <input v-model="testDraft.sampleLocation" placeholder="Ubicación de la muestra" class="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs text-ink-200" />
        <textarea v-model="testDraft.resultSummary" rows="2" :placeholder="resultHint ? 'Resultado, ej. ' + resultHint : 'Resultado / resumen'" class="rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs text-ink-200 sm:col-span-2" />
        <div class="flex gap-2 sm:col-span-2">
          <button type="submit" class="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-brand-500 disabled:opacity-50" :disabled="!testDraft.testType.trim() || !testDraft.resultSummary.trim()">Guardar</button>
          <button type="button" class="rounded-md border border-ink-700 px-2 py-1.5 text-xs text-ink-300" @click="showNewTest = false">Cancelar</button>
        </div>
      </form>

      <div v-if="!currentTests.length && !showNewTest" class="px-4 py-8 text-center text-sm text-ink-500">
        Sin ensayos registrados en esta campaña.
      </div>
      <div v-else class="divide-y divide-ink-800">
        <div v-for="t in currentTests" :key="t.id" class="group px-4 py-3">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 text-sm font-medium text-ink-100">
              <FlaskConical :size="15" class="text-ink-400" /> {{ t.testType }}
            </span>
            <div class="flex items-center gap-3">
              <span class="text-xs text-ink-500">{{ fmt(t.executedAt) }}</span>
              <button
                v-if="canWorkHere"
                class="text-ink-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
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
        </div>
      </div>
    </div>
  </section>
</template>
