<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useInspectionStore } from '../../stores/inspection'

import { Box, ChartColumn, Compass, List, Menu } from 'lucide-vue-next'
import SyncControl from '../sync/SyncControl.vue'
import TeamPanel from '../team/TeamPanel.vue'
import { CONDITION, conditionFromScore } from '../../types/inspection'

const store = useInspectionStore()
const { activeStructure, structureCondition, asOfDate, activeView, activeHasModel } =
  storeToRefs(store)

// Color del semáforo desde el índice de SALUD (un solo criterio, igual que el resto de la UI).
const conditionColor = computed(() => CONDITION[conditionFromScore(structureCondition.value)].color)
</script>

<template>
  <header
    class="flex h-14 shrink-0 items-center justify-between border-b border-ink-800 bg-ink-900 px-4"
  >
    <div class="flex min-w-0 items-center gap-2 sm:gap-3">
      <button
        class="-ml-1 rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-200 lg:hidden"
        title="Menú de estructuras"
        @click="store.toggleSidebar()"
      >
        <Menu :size="20" />
      </button>
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600">
        <svg viewBox="0 0 32 32" class="h-5 w-5" fill="none" stroke="#f0f9ff" stroke-width="2.4" stroke-linecap="round">
          <path d="M10 8 V24 M22 8 V24 M8 8 H24 M8 16 H24 M8 24 H24" />
        </svg>
      </div>
      <div class="min-w-0">
        <div class="text-sm font-semibold text-ink-100">Inspecta</div>
        <div class="hidden truncate text-[11px] text-ink-400 sm:block">
          Inspecciones estructurales · gemelo digital
        </div>
      </div>
    </div>

    <!-- toggle de vista central -->
    <div data-tour="views" class="flex rounded-lg border border-ink-800 bg-ink-950 p-0.5 text-xs">
      <button
        class="flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors"
        :class="activeView === 'list' ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200'"
        @click="store.setView('list')"
      >
        <List :size="14" /> <span class="hidden sm:inline">Lista</span>
      </button>
      <button
        v-if="activeHasModel"
        class="flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors"
        :class="activeView === 'twin' ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200'"
        @click="store.setView('twin')"
      >
        <Box :size="14" /> <span class="hidden sm:inline">Gemelo 3D</span>
      </button>
      <button
        class="flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors"
        :class="activeView === 'results' ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200'"
        @click="store.setView('results')"
      >
        <ChartColumn :size="14" /> <span class="hidden sm:inline">Resultados</span>
      </button>
    </div>

    <div class="flex items-center gap-3 sm:gap-4">
      <div v-if="activeStructure" class="hidden text-right md:block">
        <div class="max-w-[16rem] truncate text-xs text-ink-400">{{ activeStructure.name }}</div>
        <div class="text-[11px] text-ink-500">Estado al {{ asOfDate || '—' }}</div>
      </div>
      <div v-if="activeStructure" class="flex items-center gap-2">
        <span class="hidden text-xs text-ink-400 sm:inline">Condición</span>
        <div class="hidden h-2 w-24 overflow-hidden rounded-full bg-ink-800 sm:block">
          <div
            class="h-full rounded-full transition-all"
            :style="{ width: structureCondition + '%', background: conditionColor }"
          />
        </div>
        <span class="w-8 text-right text-sm font-semibold" :style="{ color: conditionColor }">
          {{ structureCondition }}
        </span>
      </div>
      <button
        data-tour="guide"
        class="flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:bg-ink-800"
        title="Guía de la plataforma"
        @click="store.startTour()"
      >
        <Compass :size="14" class="text-brand-500" />
        <span class="hidden sm:inline">Guía</span>
      </button>
      <TeamPanel />
      <SyncControl />
    </div>
  </header>
</template>
