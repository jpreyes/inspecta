<script setup lang="ts">
// Visor de fotos a pantalla completa.
//
// En la ficha y en las tablas las fotos son miniaturas de 32–64 px: sirven para
// saber que HAY foto, no para mirar la grieta. Acá se ve completa, y con las
// flechas se recorren las del mismo hallazgo sin volver atrás.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import type { Photo } from '../../types/inspection'

const props = defineProps<{ photos: Photo[]; start?: number; caption?: string }>()
const emit = defineEmits<{ close: [] }>()

const i = ref(Math.min(Math.max(props.start ?? 0, 0), Math.max(0, props.photos.length - 1)))
const actual = computed(() => props.photos[i.value])
/** La foto recién tomada vive en base64; la que vino del servidor, en su URL. */
const src = computed(() => actual.value?.dataUrl || actual.value?.url || '')
const varias = computed(() => props.photos.length > 1)

function mover(d: number) {
  if (!varias.value) return
  i.value = (i.value + d + props.photos.length) % props.photos.length
}

function fmt(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Teclado: en el computador se revisa el informe con las flechas, no con el ratón.
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowRight') mover(1)
  else if (e.key === 'ArrowLeft') mover(-1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <!-- z-60: por encima de la ficha y del formulario, que es desde donde se abre -->
  <div
    class="fixed inset-0 z-[60] flex flex-col bg-black/90 p-3 sm:p-6"
    role="dialog"
    aria-label="Foto del hallazgo"
    @click.self="emit('close')"
  >
    <div class="flex items-start justify-between gap-3 pb-2">
      <div class="min-w-0 text-xs text-ink-400">
        <p v-if="caption" class="truncate text-ink-200">{{ caption }}</p>
        <p>
          <span v-if="varias">Foto {{ i + 1 }} de {{ photos.length }}</span>
          <span v-if="varias && fmt(actual?.takenAt)"> · </span>
          <span v-if="fmt(actual?.takenAt)">{{ fmt(actual?.takenAt) }}</span>
        </p>
      </div>
      <button
        class="-m-2 flex h-10 w-10 shrink-0 items-center justify-center text-ink-300 hover:text-ink-100"
        aria-label="Cerrar la foto"
        title="Cerrar la foto"
        @click="emit('close')"
      >
        <X :size="20" />
      </button>
    </div>

    <div class="flex min-h-0 flex-1 items-center gap-2" @click.self="emit('close')">
      <button
        v-if="varias"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-900/80 text-ink-200 hover:bg-ink-800"
        aria-label="Foto anterior"
        @click="mover(-1)"
      >
        <ChevronLeft :size="20" />
      </button>
      <img :src="src" class="mx-auto max-h-full min-h-0 max-w-full object-contain" />
      <button
        v-if="varias"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-900/80 text-ink-200 hover:bg-ink-800"
        aria-label="Foto siguiente"
        @click="mover(1)"
      >
        <ChevronRight :size="20" />
      </button>
    </div>

    <!-- Tira de miniaturas: con varias fotos, saltar a una es más rápido que
         pasarlas de a una. -->
    <div v-if="varias" class="flex justify-center gap-2 overflow-x-auto pt-3">
      <button
        v-for="(p, n) in photos"
        :key="p.id"
        class="h-12 w-12 shrink-0 overflow-hidden rounded border-2"
        :class="n === i ? 'border-brand-500' : 'border-transparent opacity-60 hover:opacity-100'"
        @click="i = n"
      >
        <img :src="p.dataUrl || p.url" class="h-full w-full object-cover" />
      </button>
    </div>
  </div>
</template>
