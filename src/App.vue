<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useInspectionStore } from './stores/inspection'
import Sidebar from './components/layout/Sidebar.vue'
import TopBar from './components/layout/TopBar.vue'
import TwinCanvas from './components/twin/TwinCanvas.vue'
import InspectionSelector from './components/inspection/InspectionSelector.vue'
import InspectionPanel from './components/inspection/InspectionPanel.vue'
import ResultsView from './components/results/ResultsView.vue'
import DamageListView from './components/list/DamageListView.vue'

const store = useInspectionStore()
const { ready, activeView } = storeToRefs(store)

onMounted(() => store.init())
</script>

<template>
  <div class="flex h-full flex-col bg-ink-950 text-ink-300">
    <TopBar />

    <div v-if="ready" class="flex min-h-0 flex-1">
      <Sidebar class="w-72 shrink-0 border-r border-ink-800 bg-ink-900" />

      <!-- Vista LISTA (por defecto) -->
      <template v-if="activeView === 'list'">
        <main class="relative min-w-0 flex-1 overflow-y-auto bg-ink-950">
          <DamageListView />
          <div class="pointer-events-none sticky inset-x-0 bottom-0 p-4">
            <InspectionSelector class="pointer-events-auto" />
          </div>
        </main>
        <InspectionPanel class="w-96 shrink-0 border-l border-ink-800 bg-ink-900" />
      </template>

      <!-- Vista GEMELO 3D -->
      <template v-else-if="activeView === 'twin'">
        <main class="relative min-w-0 flex-1 bg-ink-950">
          <TwinCanvas />
          <div class="pointer-events-none absolute inset-x-0 bottom-0 p-4">
            <InspectionSelector class="pointer-events-auto" />
          </div>
          <div
            class="pointer-events-none absolute left-4 top-4 rounded-lg border border-ink-800 bg-ink-900/80 px-3 py-2 text-xs text-ink-400 backdrop-blur"
          >
            Click en un elemento para inspeccionarlo · arrastra para orbitar
          </div>
        </main>
        <InspectionPanel class="w-96 shrink-0 border-l border-ink-800 bg-ink-900" />
      </template>

      <!-- Vista RESULTADOS -->
      <ResultsView v-else class="min-w-0 flex-1 overflow-y-auto bg-ink-950" />
    </div>

    <div v-else class="flex flex-1 items-center justify-center text-ink-400">
      Cargando base offline…
    </div>
  </div>
</template>
