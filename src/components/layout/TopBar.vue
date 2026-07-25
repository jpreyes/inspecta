<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'

import { Box, ChartColumn, List } from 'lucide-vue-next'
import SyncControl from '../sync/SyncControl.vue'

const store = useInspectionStore()
const { activeStructure, structureCondition, asOfDate, activeView, activeHasModel } =
  storeToRefs(store)

const conditionColor = computed(() => {
  const c = structureCondition.value
  if (c >= 75) return '#ef4444'
  if (c >= 50) return '#f97316'
  if (c >= 25) return '#eab308'
  return '#22c55e'
})
</script>

<template>
  <header
    class="flex h-14 shrink-0 items-center justify-between border-b border-ink-800 bg-ink-900 px-4"
  >
    <div class="flex items-center gap-3">
      <div
        class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-ink-950"
      >
        I
      </div>
      <div>
        <div class="text-sm font-semibold text-ink-100">Inspecta</div>
        <div class="text-[11px] text-ink-400">Inspecciones estructurales · gemelo digital</div>
      </div>
    </div>

    <!-- toggle de vista central -->
    <div class="flex rounded-lg border border-ink-800 bg-ink-950 p-0.5 text-xs">
      <button
        class="flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors"
        :class="activeView === 'list' ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200'"
        @click="store.setView('list')"
      >
        <List :size="14" /> Lista
      </button>
      <button
        v-if="activeHasModel"
        class="flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors"
        :class="activeView === 'twin' ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200'"
        @click="store.setView('twin')"
      >
        <Box :size="14" /> Gemelo 3D
      </button>
      <button
        class="flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors"
        :class="activeView === 'results' ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200'"
        @click="store.setView('results')"
      >
        <ChartColumn :size="14" /> Resultados
      </button>
    </div>

    <div class="flex items-center gap-6">
      <div v-if="activeStructure" class="text-right">
        <div class="text-xs text-ink-400">{{ activeStructure.name }}</div>
        <div class="text-[11px] text-ink-500">Estado al {{ asOfDate || '—' }}</div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-ink-400">Condición</span>
        <div class="flex items-center gap-2">
          <div class="h-2 w-24 overflow-hidden rounded-full bg-ink-800">
            <div
              class="h-full rounded-full transition-all"
              :style="{ width: structureCondition + '%', background: conditionColor }"
            />
          </div>
          <span class="w-8 text-right text-sm font-semibold" :style="{ color: conditionColor }">
            {{ structureCondition }}
          </span>
        </div>
      </div>
      <SyncControl />
    </div>
  </header>
</template>
