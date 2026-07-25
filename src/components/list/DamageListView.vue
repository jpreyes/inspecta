<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Box, Plus } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { damageIcon } from '../../ui/icons'
import {
  CONDITION,
  DAMAGE_TYPES,
  SEVERITY,
  findingIndex,
  worstSeverity,
  type Finding,
} from '../../types/inspection'

const store = useInspectionStore()
const {
  activeStructure,
  activeInspection,
  activeHasModel,
  currentFindings,
  structureCondition,
  structureConditionKey,
  selectedElementId,
} = storeToRefs(store)

const condition = computed(() => CONDITION[structureConditionKey.value])

// tag/tipo por elemento
const elMeta = computed(() => {
  const m: Record<string, { tag: string; type: string; story?: number }> = {}
  for (const el of activeStructure.value?.elements ?? []) {
    m[el.id] = { tag: el.tag, type: el.type, story: el.story }
  }
  return m
})

// Daños de la campaña agrupados por elemento, peor severidad primero
const byElement = computed(() => {
  const groups = new Map<string, Finding[]>()
  for (const f of currentFindings.value) {
    if (!groups.has(f.elementId)) groups.set(f.elementId, [])
    groups.get(f.elementId)!.push(f)
  }
  return [...groups.entries()]
    .map(([elementId, list]) => ({
      elementId,
      meta: elMeta.value[elementId] ?? { tag: elementId, type: '' },
      findings: [...list].sort((a, b) => b.severity - a.severity),
      worst: worstSeverity(list),
    }))
    .sort((a, b) => b.worst - a.worst)
})

function selectAndRegister(elementId: string) {
  store.selectElement(elementId)
}
function fmt(d?: string) {
  return d
    ? new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'
}
</script>

<template>
  <section class="mx-auto max-w-4xl space-y-4 p-6">
    <!-- Cabecera -->
    <header class="flex items-start justify-between">
      <div>
        <h1 class="text-xl font-semibold text-ink-100">{{ activeStructure?.name }}</h1>
        <p class="mt-0.5 text-sm text-ink-400">
          Campaña {{ fmt(activeInspection?.date) }} · {{ activeInspection?.inspector }}
          <span v-if="!activeHasModel" class="ml-1 text-ink-500">· sin modelo 3D</span>
        </p>
      </div>
      <div
        class="flex items-center gap-2 rounded-lg border px-3 py-2"
        :style="{ borderColor: condition.color + '55', background: condition.color + '12' }"
      >
        <span class="h-2.5 w-2.5 rounded-full" :style="{ background: condition.color }" />
        <span class="text-sm font-semibold" :style="{ color: condition.color }">{{ condition.label }}</span>
        <span class="text-xs text-ink-500">{{ structureCondition }}/100</span>
      </div>
    </header>

    <p class="text-xs text-ink-500">
      Selecciona un elemento (aquí o en el árbol de la izquierda) y usa
      <b class="text-ink-300">Registrar hallazgo</b> en el panel derecho. No requiere modelo 3D.
    </p>

    <!-- Daños por elemento -->
    <div v-if="byElement.length" class="space-y-3">
      <div
        v-for="grp in byElement"
        :key="grp.elementId"
        class="overflow-hidden rounded-xl border bg-ink-900"
        :class="grp.elementId === selectedElementId ? 'border-brand-600' : 'border-ink-800'"
      >
        <!-- cabecera del elemento -->
        <button
          class="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ink-850"
          @click="selectAndRegister(grp.elementId)"
        >
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: SEVERITY[grp.worst].color }" />
          <span class="text-sm font-semibold text-ink-100">{{ grp.meta.tag }}</span>
          <span class="text-xs capitalize text-ink-500">{{ grp.meta.type }}</span>
          <span v-if="grp.meta.story != null" class="text-xs text-ink-600">· Nivel {{ grp.meta.story }}</span>
          <span class="ml-auto text-xs text-ink-500">{{ grp.findings.length }} hallazgo(s)</span>
          <Plus :size="15" class="text-ink-500" />
        </button>

        <!-- hallazgos del elemento -->
        <div class="divide-y divide-ink-800 border-t border-ink-800">
          <div v-for="f in grp.findings" :key="f.id" class="flex items-center gap-3 px-4 py-2.5">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              :style="{ background: SEVERITY[f.severity].color + '22', color: SEVERITY[f.severity].color }"
            >
              <component :is="damageIcon[f.damageType]" :size="16" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm text-ink-100">{{ DAMAGE_TYPES[f.damageType].label }}</div>
              <p v-if="f.notes" class="truncate text-xs text-ink-400">{{ f.notes }}</p>
            </div>
            <div class="hidden gap-1 sm:flex">
              <img
                v-for="p in f.photos.slice(0, 3)"
                :key="p.id"
                :src="p.dataUrl || p.url"
                class="h-8 w-8 rounded object-cover"
              />
            </div>
            <div class="text-right text-xs text-ink-500">
              <div>Ext {{ f.extension }}%</div>
              <div>Índice {{ findingIndex(f) }}</div>
            </div>
            <span
              class="rounded px-1.5 py-0.5 text-[11px] font-semibold"
              :style="{ background: SEVERITY[f.severity].color + '22', color: SEVERITY[f.severity].color }"
            >
              {{ SEVERITY[f.severity].label }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- vacío -->
    <div v-else class="rounded-xl border border-dashed border-ink-800 px-4 py-12 text-center">
      <Box :size="28" class="mx-auto text-ink-700" />
      <p class="mt-2 text-sm text-ink-400">Sin hallazgos en esta campaña.</p>
      <p class="mt-1 text-xs text-ink-500">
        Selecciona un elemento en el árbol de la izquierda y registra el primer hallazgo.
      </p>
    </div>
  </section>
</template>
