<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Trash2, X, Plus } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { iconForDamage } from '../../ui/icons'
import { SEVERITY, findingIndex } from '../../types/inspection'

const store = useInspectionStore()
const { selectedElement, selectedElementFindings, currentFindings, activeInspection, canEditData } =
  storeToRefs(store)

const list = computed(() =>
  selectedElement.value ? selectedElementFindings.value : currentFindings.value,
)

function register() {
  store.openDamageForm(selectedElement.value?.id)
}
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
          {{ selectedElement.type }}<span v-if="selectedElement.story != null"> · Nivel {{ selectedElement.story }}</span>
        </div>
      </template>
      <template v-else>
        <div class="text-sm font-semibold text-ink-100">Resumen de campaña</div>
        <div class="mt-0.5 text-xs text-ink-400">
          {{ activeInspection?.summary || 'Todos los hallazgos de esta campaña' }}
        </div>
      </template>
    </div>

    <!-- lista de hallazgos -->
    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <div v-if="!list.length" class="py-8 text-center text-xs text-ink-500">
        Sin hallazgos {{ selectedElement ? 'en este elemento' : 'en esta campaña' }}.
      </div>

      <div v-for="f in list" :key="f.id" class="mb-2 rounded-lg border border-ink-800 bg-ink-850 p-3">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2">
            <component :is="iconForDamage(f.damageType)" :size="16" class="text-ink-300" />
            <span class="text-sm font-medium text-ink-100">{{ f.damageType }}</span>
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
          <img v-for="p in f.photos" :key="p.id" :src="p.dataUrl || p.url" class="h-16 w-16 shrink-0 rounded object-cover" />
        </div>

        <div class="mt-2 flex items-center justify-between">
          <span v-if="f.authorName" class="text-[10px] text-ink-600">Registró {{ f.authorName }}</span>
          <span v-else />
          <button
            v-if="canEditData"
            class="flex items-center gap-1 text-[11px] text-ink-500 hover:text-red-400"
            @click="store.removeFinding(f.id)"
          >
            <Trash2 :size="12" /> Eliminar
          </button>
        </div>
      </div>
    </div>

    <!-- registrar daño (abre el formulario; el elemento va preseleccionado si hay uno) -->
    <div v-if="canEditData" class="border-t border-ink-800 p-3">
      <button
        class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-sm font-medium text-ink-950 hover:bg-brand-500"
        @click="register"
      >
        <Plus :size="15" /> Registrar daño{{ selectedElement ? ' aquí' : '' }}
      </button>
    </div>
  </aside>
</template>
