<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Plus, Trash2 } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { iconForDamage } from '../../ui/icons'
import { CONDITION, SEVERITY, findingIndex } from '../../types/inspection'
import InspectionSelector from '../inspection/InspectionSelector.vue'

const store = useInspectionStore()
const { activeStructure, activeInspection, activeHasModel, currentFindings, structureCondition, structureConditionKey, canWorkHere } =
  storeToRefs(store)

const condition = computed(() => CONDITION[structureConditionKey.value])

function fmt(d?: string) {
  return d
    ? new Date(d + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'
}

/** Fecha/hora de registro (createdAt es ISO completo, no solo la fecha). */
function fmtStamp(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <section class="mx-auto max-w-5xl space-y-4 p-6">
    <!-- Cabecera -->
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-ink-100">{{ activeStructure?.name }}</h1>
        <p class="mt-0.5 text-sm text-ink-400">
          Campaña {{ fmt(activeInspection?.date) }} · {{ activeInspection?.inspector }}
          <span v-if="!activeHasModel" class="text-ink-500">· sin modelo 3D</span>
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div
          class="flex items-center gap-2 rounded-lg border px-3 py-2"
          :style="{ borderColor: condition.color + '55', background: condition.color + '12' }"
        >
          <span class="h-2.5 w-2.5 rounded-full" :style="{ background: condition.color }" />
          <span class="text-sm font-semibold" :style="{ color: condition.color }">{{ condition.label }}</span>
          <span class="text-xs text-ink-500">{{ structureCondition }}/100</span>
        </div>
        <button
          v-if="canWorkHere"
          data-tour="new-damage"
          class="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-500"
          @click="store.openDamageForm()"
        >
          <Plus :size="16" /> Nuevo daño
        </button>
      </div>
    </header>

    <InspectionSelector />

    <!-- Tabla de daños (estilo structapp) -->
    <div v-if="currentFindings.length" data-tour="damage-table" class="overflow-x-auto rounded-xl border border-ink-800">
      <table class="w-full text-sm">
        <thead class="bg-ink-900 text-left text-[11px] uppercase tracking-wide text-ink-500">
          <tr>
            <th class="px-3 py-2 font-medium">Elemento</th>
            <th class="px-3 py-2 font-medium">Material</th>
            <th class="px-3 py-2 font-medium">Zona</th>
            <th class="px-3 py-2 font-medium">Daño</th>
            <th class="px-3 py-2 font-medium">Causa</th>
            <th class="px-3 py-2 font-medium">Gravedad</th>
            <th class="px-3 py-2 text-right font-medium">Ext.</th>
            <th class="px-3 py-2 font-medium">Fotos</th>
            <th class="px-3 py-2 font-medium">Registró</th>
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink-800">
          <tr v-for="f in currentFindings" :key="f.id" class="bg-ink-900/50 hover:bg-ink-850">
            <td class="px-3 py-2 font-medium text-ink-100">
              {{ f.element }}
              <span v-if="f.component" class="block text-[10px] font-normal text-ink-600">{{ f.component }}</span>
            </td>
            <td class="px-3 py-2 text-ink-400">{{ f.material || '—' }}</td>
            <td class="px-3 py-2 text-ink-400">{{ f.zone || '—' }}</td>
            <td class="px-3 py-2">
              <div class="flex items-center gap-1.5 text-ink-200">
                <component :is="iconForDamage(f.damageType)" :size="15" class="text-ink-400" />
                {{ f.damageType }}
              </div>
              <p v-if="f.notes" class="mt-0.5 max-w-xs truncate text-[11px] text-ink-500">{{ f.notes }}</p>
            </td>
            <td class="px-3 py-2 text-ink-400">{{ f.cause || '—' }}</td>
            <td class="px-3 py-2">
              <span
                class="rounded px-1.5 py-0.5 text-[11px] font-semibold"
                :style="{ background: SEVERITY[f.severity].color + '22', color: SEVERITY[f.severity].color }"
              >
                {{ SEVERITY[f.severity].label }}
              </span>
              <div class="mt-0.5 text-[10px] text-ink-500">Índice {{ findingIndex(f) }}</div>
            </td>
            <td class="px-3 py-2 text-right text-ink-400">{{ f.extension }}%</td>
            <td class="px-3 py-2">
              <div v-if="f.photos.length" class="flex gap-1">
                <img
                  v-for="p in f.photos.slice(0, 3)"
                  :key="p.id"
                  :src="p.dataUrl || p.url"
                  class="h-8 w-8 rounded object-cover"
                />
              </div>
              <span v-else class="text-[11px] text-ink-600">—</span>
            </td>
            <td class="px-3 py-2 text-[11px] text-ink-500">
              {{ f.authorName || '—' }}
              <span class="block text-[10px] text-ink-600">{{ fmtStamp(f.createdAt) }}</span>
            </td>
            <td class="px-3 py-2 text-right">
              <button
                v-if="canWorkHere"
                class="text-ink-600 hover:text-red-400"
                title="Eliminar"
                @click="store.removeFinding(f.id)"
              >
                <Trash2 :size="14" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- vacío -->
    <div v-else data-tour="damage-table" class="rounded-xl border border-dashed border-ink-800 px-4 py-12 text-center">
      <p class="text-sm text-ink-400">Sin daños registrados en esta campaña.</p>
      <button
        v-if="canWorkHere"
        data-tour="new-damage-empty"
        class="mx-auto mt-3 flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-500"
        @click="store.openDamageForm()"
      >
        <Plus :size="16" /> Registrar primer daño
      </button>
      <p v-else class="mt-2 text-xs text-ink-600">
        Tu rol solo permite consultar. Un inspector del equipo debe registrar los daños.
      </p>
    </div>
  </section>
</template>
