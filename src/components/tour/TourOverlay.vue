<script setup lang="ts">
// Guía guiada: oscurece la pantalla salvo el elemento del paso, y muestra una
// tarjeta al lado. El recorte se arma con cuatro rectángulos alrededor del
// objetivo (no con una máscara SVG) para que el elemento iluminado siga siendo
// clickeable: durante la guía se puede probar lo que se está explicando.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ChevronLeft, ChevronRight, Compass, Eraser, X } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { TOUR_STEPS } from '../../data/tour'

const store = useInspectionStore()
const { tourStep, hasDemoData } = storeToRefs(store)

const step = computed(() => TOUR_STEPS[tourStep.value] ?? TOUR_STEPS[0])
const isLast = computed(() => tourStep.value >= TOUR_STEPS.length - 1)

interface Box {
  top: number
  left: number
  width: number
  height: number
}
const box = ref<Box | null>(null)
const vw = ref(window.innerWidth)
const vh = ref(window.innerHeight)
const clearing = ref(false)

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function measure() {
  vw.value = window.innerWidth
  vh.value = window.innerHeight
  const sel = step.value.target
  const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null
  if (!el) {
    box.value = null
    return
  }
  const r = el.getBoundingClientRect()
  // Un objetivo con tamaño 0 está oculto (por ejemplo el cajón lateral cerrado):
  // se trata como si no existiera y la tarjeta va centrada.
  if (r.width < 2 || r.height < 2) {
    box.value = null
    return
  }
  const pad = 6
  box.value = {
    top: r.top - pad,
    left: r.left - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  }
}

/** Deja la app donde el paso pueda verse y luego mide el objetivo. */
async function goToStep() {
  const s = step.value
  if (s.view) store.setView(s.view) // ojo: setView cierra el cajón lateral
  if (s.openSidebar && vw.value < 1024) store.sidebarOpen = true
  await nextTick()
  await wait(s.view || s.openSidebar ? 280 : 60) // transición de vista / cajón
  const el = s.target ? (document.querySelector(s.target) as HTMLElement | null) : null
  if (el) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    await wait(300)
  }
  measure()
}

watch(tourStep, goToStep, { immediate: true })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') store.closeTour()
  else if (e.key === 'ArrowRight') store.tourNext()
  else if (e.key === 'ArrowLeft') store.tourPrev()
}

onMounted(() => {
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', measure, true)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('scroll', measure, true)
  window.removeEventListener('keydown', onKey)
})

// ── Posición de la tarjeta ───────────────────────────────────
// Debajo del objetivo si hay espacio; si no, encima (anclada por `bottom`, así
// no hay que conocer su alto); si tampoco cabe —un objetivo alto como la barra
// lateral—, al costado con más aire; y si nada de eso, al centro. Cada caso
// lleva su `maxHeight`: la tarjeta se desplaza por dentro antes que salirse de
// la pantalla. En pantallas chicas va como hoja arriba o abajo, según dónde
// esté el objetivo.
const CARD = 340
const NEED = 320 // alto que se le reserva para decidir arriba/abajo

const cardStyle = computed(() => {
  const r = box.value
  const width = Math.min(CARD, vw.value - 24)
  const centered = {
    width: width + 'px',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    maxHeight: vh.value - 48 + 'px',
  }
  if (!r) return centered

  if (vw.value < 640) {
    const targetLow = r.top + r.height / 2 > vh.value / 2
    const sheet = { left: '12px', right: '12px', width: 'auto', maxHeight: '55vh' }
    return targetLow ? { ...sheet, top: '12px' } : { ...sheet, bottom: '12px' }
  }

  const clampLeft = (l: number) =>
    Math.min(Math.max(l, 12), Math.max(12, vw.value - width - 12)) + 'px'
  const below = vh.value - (r.top + r.height)
  const above = r.top
  if (below >= NEED) {
    return {
      width: width + 'px',
      left: clampLeft(r.left),
      top: r.top + r.height + 12 + 'px',
      maxHeight: below - 24 + 'px',
    }
  }
  if (above >= NEED) {
    return {
      width: width + 'px',
      left: clampLeft(r.left),
      bottom: vh.value - r.top + 12 + 'px',
      maxHeight: above - 24 + 'px',
    }
  }
  const spaceRight = vw.value - (r.left + r.width)
  if (Math.max(spaceRight, r.left) >= width + 24) {
    const left = spaceRight >= r.left ? r.left + r.width + 12 : r.left - width - 12
    const top = Math.min(Math.max(r.top, 12), Math.max(12, vh.value - NEED))
    return {
      width: width + 'px',
      left: left + 'px',
      top: top + 'px',
      maxHeight: vh.value - top - 12 + 'px',
    }
  }
  return centered
})

async function clearDemo() {
  clearing.value = true
  try {
    await store.removeDemoData()
  } finally {
    clearing.value = false
  }
}
</script>

<template>
  <div class="pointer-events-none fixed inset-0" style="z-index: 45">
    <!-- Velo: completo si no hay objetivo, o cuatro tiras alrededor de él -->
    <template v-if="box">
      <div class="pointer-events-auto absolute inset-x-0 bg-ink-950/75" :style="{ top: 0, height: Math.max(0, box.top) + 'px' }" />
      <div class="pointer-events-auto absolute inset-x-0 bottom-0 bg-ink-950/75" :style="{ top: box.top + box.height + 'px' }" />
      <div
        class="pointer-events-auto absolute left-0 bg-ink-950/75"
        :style="{ top: box.top + 'px', height: box.height + 'px', width: Math.max(0, box.left) + 'px' }"
      />
      <div
        class="pointer-events-auto absolute right-0 bg-ink-950/75"
        :style="{ top: box.top + 'px', height: box.height + 'px', left: box.left + box.width + 'px' }"
      />
      <!-- Anillo del objetivo (no intercepta clics: el elemento sigue vivo) -->
      <div
        class="absolute rounded-lg ring-2 ring-brand-500"
        :style="{
          top: box.top + 'px',
          left: box.left + 'px',
          width: box.width + 'px',
          height: box.height + 'px',
        }"
      />
    </template>
    <div v-else class="pointer-events-auto absolute inset-0 bg-ink-950/80" />

    <!-- Tarjeta del paso -->
    <div
      class="pointer-events-auto absolute overflow-y-auto rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-2xl"
      :style="cardStyle"
      role="dialog"
      aria-modal="false"
      :aria-label="step.title"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2">
          <Compass :size="15" class="shrink-0 text-brand-500" />
          <h2 class="text-sm font-semibold text-ink-100">{{ step.title }}</h2>
        </div>
        <button class="shrink-0 text-ink-500 hover:text-ink-200" title="Cerrar la guía" @click="store.closeTour()">
          <X :size="16" />
        </button>
      </div>

      <p class="mt-2 text-[13px] leading-relaxed text-ink-300">{{ step.body }}</p>

      <ul v-if="step.bullets" class="mt-2 space-y-1">
        <li v-for="b in step.bullets" :key="b" class="flex gap-1.5 text-[12px] leading-relaxed text-ink-400">
          <span class="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-500" />
          <span>{{ b }}</span>
        </li>
      </ul>

      <!-- Limpieza de los datos de demostración (último paso) -->
      <button
        v-if="isLast && hasDemoData"
        class="mt-3 flex items-center gap-1.5 rounded-md border border-ink-700 px-2 py-1.5 text-[11px] text-ink-300 hover:bg-ink-800 disabled:opacity-50"
        :disabled="clearing"
        @click="clearDemo"
      >
        <Eraser :size="12" />
        {{ clearing ? 'Borrando…' : 'Borrar los datos de demostración de este dispositivo' }}
      </button>

      <div class="mt-4 flex items-center justify-between gap-2">
        <span class="text-[11px] text-ink-500">Paso {{ tourStep + 1 }} de {{ TOUR_STEPS.length }}</span>
        <div class="flex items-center gap-1.5">
          <button
            class="rounded-md border border-ink-700 px-2 py-1 text-ink-300 hover:bg-ink-800 disabled:opacity-40"
            :disabled="tourStep === 0"
            title="Paso anterior"
            @click="store.tourPrev()"
          >
            <ChevronLeft :size="14" />
          </button>
          <button
            class="flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-500"
            @click="store.tourNext()"
          >
            {{ isLast ? 'Listo' : 'Siguiente' }}
            <ChevronRight v-if="!isLast" :size="14" />
          </button>
        </div>
      </div>

      <button v-if="!isLast" class="mt-2 text-[11px] text-ink-500 hover:text-ink-300" @click="store.closeTour()">
        Saltar la guía
      </button>
    </div>
  </div>
</template>
