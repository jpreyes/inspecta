<script setup lang="ts">
// Ficha de un hallazgo.
//
// La tabla de daños es un resumen: una fila con diez columnas, las
// observaciones cortadas a una línea y las fotos de 32 px. Sirve para recorrer
// la campaña, no para mirar un daño. Al apretar la fila se abre esto: el
// hallazgo completo, con la escala de gravedad explicada, las observaciones
// enteras y las fotos grandes.
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Box, Pencil, Trash2, X } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { iconForDamage } from '../../ui/icons'
import {
  SEVERITY,
  catalogForScope,
  findingIndex,
  isNonStructural,
  type Photo,
} from '../../types/inspection'

const store = useInspectionStore()
const { findingSheet, activeStructure, activeHasModel, canWorkHere } = storeToRefs(store)

const f = computed(() => findingSheet.value)
const noEstructural = computed(() => (f.value ? isNonStructural(f.value) : false))
const severity = computed(() => (f.value ? SEVERITY[f.value.severity] : SEVERITY[0]))

/** Descripción de la banda de gravedad según el catálogo del deterioro. Es lo
 *  que distingue "Severo" de "Moderado" y no está en ninguna otra pantalla. */
const criterio = computed(() => {
  const finding = f.value
  if (!finding || finding.severity < 1) return ''
  // El criterio vive en el catálogo del ÁMBITO del hallazgo: los deterioros de
  // lo no estructural son otros y sus bandas también.
  const cat = catalogForScope(
    activeStructure.value?.type,
    noEstructural.value ? 'no-estructural' : 'estructural',
  )
  const dano = cat.damages.find((d) => d.name === finding.damageType)
  return dano?.severity[finding.severity - 1] ?? ''
})

/** Elemento del gemelo 3D al que está atado (si lo está). */
const elemento = computed(() =>
  activeStructure.value?.elements.find((e) => e.id === f.value?.elementId),
)

const campo = computed(() =>
  f.value
    ? [
        { k: 'Componente', v: f.value.component },
        { k: 'Material', v: f.value.material },
        { k: 'Zona / ubicación', v: f.value.zone },
        { k: 'Causa probable', v: f.value.cause },
        { k: 'Extensión afectada', v: `${f.value.extension} %` },
        {
          k: 'Índice de daño',
          v: noEstructural.value ? 'No aplica (no estructural)' : String(findingIndex(f.value)),
        },
        { k: 'Elemento del gemelo', v: elemento.value?.tag },
      ].filter((x) => x.v)
    : [],
)

function fmt(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function verEn3D() {
  if (!f.value?.elementId) return
  store.selectElement(f.value.elementId)
  store.setView('twin')
  store.closeFindingSheet()
}
function editar() {
  const id = f.value?.id
  store.closeFindingSheet()
  if (id) store.editFinding(id)
}
async function eliminar() {
  const id = f.value?.id
  if (!id) return
  store.closeFindingSheet()
  await store.removeFinding(id)
}
function abrirFoto(fotos: Photo[], i: number) {
  store.openPhotoViewer(fotos, i, f.value ? `${f.value.element} · ${f.value.damageType}` : undefined)
}
</script>

<template>
  <div
    v-if="f"
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
    @click.self="store.closeFindingSheet()"
  >
    <div class="w-full max-w-2xl rounded-xl border border-ink-800 bg-ink-900 shadow-2xl">
      <!-- Cabecera: qué elemento y qué le pasa -->
      <div class="flex items-start justify-between gap-3 border-b border-ink-800 px-4 py-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <component :is="iconForDamage(f.damageType)" :size="18" class="shrink-0 text-ink-400" />
            <h2 class="truncate text-sm font-semibold text-ink-100">{{ f.damageType }}</h2>
          </div>
          <p class="mt-0.5 truncate text-[11px] text-ink-500">
            {{ f.element }}
            <span v-if="f.zone"> · {{ f.zone }}</span>
            <span v-if="noEstructural" class="text-amber-400"> · no estructural</span>
          </p>
        </div>
        <button
          class="-m-2 flex h-9 w-9 shrink-0 items-center justify-center text-ink-500 hover:text-ink-200"
          aria-label="Cerrar la ficha"
          title="Cerrar"
          @click="store.closeFindingSheet()"
        >
          <X :size="18" />
        </button>
      </div>

      <div class="space-y-4 p-4">
        <!-- Gravedad, con el criterio que la justifica -->
        <div
          class="rounded-lg border p-3"
          :style="{ borderColor: severity.color + '55', background: severity.color + '12' }"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-semibold" :style="{ color: severity.color }">
              {{ severity.label }}
            </span>
            <span class="text-[11px] text-ink-500">
              Gravedad {{ f.severity }}/4 · extensión {{ f.extension }} %
            </span>
          </div>
          <p v-if="criterio" class="mt-1 text-xs leading-snug text-ink-300">{{ criterio }}</p>
          <p v-if="noEstructural" class="mt-1.5 text-[11px] leading-snug text-ink-500">
            Queda registrado y sale en el informe, pero
            <span class="text-ink-300">no entra en la condición estructural</span>.
          </p>
        </div>

        <!-- Datos del hallazgo -->
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div v-for="c in campo" :key="c.k">
            <dt class="text-[11px] text-ink-500">{{ c.k }}</dt>
            <dd class="text-ink-200">{{ c.v }}</dd>
          </div>
        </dl>

        <div v-if="f.notes">
          <p class="text-[11px] text-ink-500">Observaciones</p>
          <p class="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-ink-200">{{ f.notes }}</p>
        </div>

        <!-- Fotos: acá sí grandes, y al apretarlas se ven completas -->
        <div v-if="f.photos.length">
          <p class="text-[11px] text-ink-500">Fotos · {{ f.photos.length }}</p>
          <div class="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button
              v-for="(p, i) in f.photos"
              :key="p.id"
              class="aspect-square overflow-hidden rounded-lg border border-ink-800 hover:border-brand-600"
              title="Ver la foto completa"
              @click="abrirFoto(f.photos, i)"
            >
              <img :src="p.dataUrl || p.url" class="h-full w-full object-cover" />
            </button>
          </div>
        </div>

        <p class="text-[11px] text-ink-600">
          <span v-if="f.authorName">Registró {{ f.authorName }}</span>
          <span v-if="f.authorName && fmt(f.createdAt)"> · </span>
          <span v-if="fmt(f.createdAt)">{{ fmt(f.createdAt) }}</span>
        </p>

        <div class="flex flex-wrap gap-2 border-t border-ink-800 pt-3">
          <button
            v-if="f.elementId && activeHasModel"
            class="flex items-center gap-1.5 rounded-md border border-ink-700 px-3 py-2 text-sm text-ink-200 hover:bg-ink-800"
            @click="verEn3D"
          >
            <Box :size="15" /> Ver en 3D
          </button>
          <div class="flex-1" />
          <template v-if="canWorkHere">
            <button
              class="flex items-center gap-1.5 rounded-md border border-ink-700 px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 hover:text-red-400"
              @click="eliminar"
            >
              <Trash2 :size="15" /> Eliminar
            </button>
            <button
              class="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-500"
              @click="editar"
            >
              <Pencil :size="15" /> Editar
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
