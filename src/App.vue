<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Building2, PanelLeft } from 'lucide-vue-next'
import { useInspectionStore } from './stores/inspection'
import Sidebar from './components/layout/Sidebar.vue'
import TopBar from './components/layout/TopBar.vue'
import TwinCanvas from './components/twin/TwinCanvas.vue'
import InspectionSelector from './components/inspection/InspectionSelector.vue'
import InspectionPanel from './components/inspection/InspectionPanel.vue'
import ResultsView from './components/results/ResultsView.vue'
import DamageListView from './components/list/DamageListView.vue'
import DamageForm from './components/inspection/DamageForm.vue'
import TourOverlay from './components/tour/TourOverlay.vue'
import LoginView from './components/auth/LoginView.vue'

const store = useInspectionStore()
const { ready, activeView, damageFormOpen, sidebarOpen, activeStructure, tourOpen, authUser } =
  storeToRefs(store)

onMounted(() => store.init())
</script>

<template>
  <div class="flex h-full flex-col bg-ink-950 text-ink-300">
    <TopBar v-if="authUser" />

    <!-- Sin sesión no se muestra ningún dato: los proyectos son del servidor. -->
    <LoginView v-if="ready && !authUser" />

    <div v-else-if="ready" class="relative flex min-h-0 flex-1">
      <!-- Backdrop del drawer (solo móvil/tablet) -->
      <div
        v-if="sidebarOpen"
        class="absolute inset-0 z-30 bg-ink-950/60 lg:hidden"
        @click="store.closeSidebar()"
      />
      <!-- Sidebar: estático en ≥lg; drawer deslizante en pantallas chicas -->
      <Sidebar
        class="absolute inset-y-0 left-0 z-40 w-72 shrink-0 border-r border-ink-800 bg-ink-900 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0"
        :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
      />

      <!-- Sin estructura activa (base recién creada o todo borrado) -->
      <div v-if="!activeStructure" class="flex min-w-0 flex-1 items-center justify-center p-8">
        <div class="max-w-sm text-center">
          <Building2 :size="40" class="mx-auto text-ink-700" />
          <h2 class="mt-3 text-lg font-semibold text-ink-100">No hay estructuras</h2>
          <p class="mt-1 text-sm text-ink-400">
            Crea un proyecto y una estructura para empezar a registrar inspecciones y daños.
          </p>
          <button
            class="mx-auto mt-4 flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-500 lg:hidden"
            @click="store.toggleSidebar()"
          >
            <PanelLeft :size="16" /> Abrir menú
          </button>
        </div>
      </div>

      <!-- Vista LISTA (por defecto) — tabla de daños a todo el ancho -->
      <DamageListView v-else-if="activeView === 'list'" class="min-w-0 flex-1 overflow-y-auto bg-ink-950" />

      <!-- Vista GEMELO 3D -->
      <template v-else-if="activeView === 'twin'">
        <main class="relative min-w-0 flex-1 bg-ink-950">
          <TwinCanvas />
          <div class="pointer-events-none absolute inset-x-0 bottom-0 p-4">
            <InspectionSelector class="pointer-events-auto" />
          </div>
          <div
            class="pointer-events-none absolute left-4 top-4 hidden rounded-lg border border-ink-800 bg-ink-900/80 px-3 py-2 text-xs text-ink-400 backdrop-blur sm:block"
          >
            Click en un elemento para inspeccionarlo · arrastra para orbitar
          </div>
        </main>
        <InspectionPanel class="hidden w-96 shrink-0 border-l border-ink-800 bg-ink-900 lg:block" />
      </template>

      <!-- Vista RESULTADOS -->
      <ResultsView v-else class="min-w-0 flex-1 overflow-y-auto bg-ink-950" />
    </div>

    <div v-else class="flex flex-1 items-center justify-center text-ink-400">
      Comprobando tu sesión…
    </div>

    <!-- Formulario "daño primero" (global, sobre cualquier vista) -->
    <DamageForm v-if="damageFormOpen" />

    <!-- Guía de la plataforma: se abre sola la primera vez -->
    <TourOverlay v-if="ready && authUser && tourOpen" />
  </div>
</template>

