<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { FolderOpen, Building2, ChevronRight, ChevronDown, Filter } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { SEVERITY, type Severity } from '../../types/inspection'

const store = useInspectionStore()
const { projects, structures, activeStructure, severityByElement, selectedElementId } =
  storeToRefs(store)

// Estado de despliegue (colapsable)
const expandedProjects = reactive(new Set<string>(projects.value.map((p) => p.id)))
const expandedStructures = reactive(new Set<string>())
const expandedGroups = reactive(new Set<number>()) // por nivel de la estructura activa
const onlyDamaged = ref(false)

// abrir la estructura activa automáticamente
watch(
  activeStructure,
  (s) => {
    if (s) expandedStructures.add(s.id)
  },
  { immediate: true },
)

function structuresOf(projectId: string) {
  return structures.value.filter((s) => s.projectId === projectId)
}

function toggleSet<T>(set: Set<T>, key: T) {
  set.has(key) ? set.delete(key) : set.add(key)
}

function onStructureClick(id: string) {
  if (activeStructure.value?.id !== id) {
    store.selectStructure(id)
    expandedStructures.add(id)
  } else {
    toggleSet(expandedStructures, id)
  }
}

function isDamaged(elId: string) {
  return severityByElement.value[elId] != null
}
function dotColor(elId: string) {
  const sev = severityByElement.value[elId]
  return sev != null ? SEVERITY[sev].color : '#334155'
}

// Elementos de la estructura activa, agrupados por nivel, con conteo de daños
const groupedElements = computed(() => {
  const els = activeStructure.value?.elements ?? []
  const byStory = new Map<number, typeof els>()
  for (const el of els) {
    const s = el.story ?? 0
    if (!byStory.has(s)) byStory.set(s, [])
    byStory.get(s)!.push(el)
  }
  return [...byStory.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([story, all]) => {
      const sorted = [...all].sort((a, b) => a.tag.localeCompare(b.tag))
      const list = onlyDamaged.value ? sorted.filter((el) => isDamaged(el.id)) : sorted
      const damaged = sorted.filter((el) => isDamaged(el.id)).length
      return { story, list, damaged, total: sorted.length }
    })
    .filter((g) => !onlyDamaged.value || g.damaged > 0)
})

// Daños totales de la estructura activa (para el badge en su fila)
const structureDamaged = computed(() => Object.keys(severityByElement.value).length)
</script>

<template>
  <aside class="flex flex-col overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 text-xs uppercase tracking-wide text-ink-500">
      <span>Estructura y elementos</span>
      <button
        class="flex items-center gap-1 rounded px-1.5 py-0.5 normal-case tracking-normal transition-colors"
        :class="onlyDamaged ? 'bg-amber-500/15 text-amber-400' : 'text-ink-500 hover:text-ink-300'"
        title="Mostrar solo elementos con daño"
        @click="onlyDamaged = !onlyDamaged"
      >
        <Filter :size="12" /> Con daño
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      <div v-for="prj in projects" :key="prj.id" class="mb-1">
        <!-- Proyecto -->
        <button
          class="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-sm text-ink-200 hover:bg-ink-800"
          @click="toggleSet(expandedProjects, prj.id)"
        >
          <component :is="expandedProjects.has(prj.id) ? ChevronDown : ChevronRight" :size="14" class="shrink-0 text-ink-500" />
          <FolderOpen :size="15" class="shrink-0 text-ink-400" />
          <span class="truncate font-medium">{{ prj.name }}</span>
        </button>

        <div v-if="expandedProjects.has(prj.id)" class="ml-2 border-l border-ink-800 pl-1.5">
          <div v-for="str in structuresOf(prj.id)" :key="str.id">
            <!-- Estructura -->
            <button
              class="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-sm hover:bg-ink-800"
              :class="str.id === activeStructure?.id ? 'bg-ink-800 text-ink-100' : 'text-ink-300'"
              @click="onStructureClick(str.id)"
            >
              <component :is="expandedStructures.has(str.id) ? ChevronDown : ChevronRight" :size="14" class="shrink-0 text-ink-500" />
              <Building2 :size="15" class="shrink-0" />
              <span class="flex-1 truncate">{{ str.name }}</span>
              <span
                v-if="str.id === activeStructure?.id && structureDamaged"
                class="rounded-full bg-red-500/15 px-1.5 text-[10px] font-semibold text-red-400"
              >
                {{ structureDamaged }}
              </span>
            </button>

            <!-- Niveles (colapsables) de la estructura activa -->
            <div
              v-if="str.id === activeStructure?.id && expandedStructures.has(str.id)"
              class="ml-2 border-l border-ink-800 pl-1.5"
            >
              <div v-for="grp in groupedElements" :key="grp.story" class="mb-0.5">
                <button
                  class="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] uppercase tracking-wide text-ink-500 hover:bg-ink-800"
                  @click="toggleSet(expandedGroups, grp.story)"
                >
                  <component :is="expandedGroups.has(grp.story) ? ChevronDown : ChevronRight" :size="12" class="shrink-0" />
                  <span class="flex-1">Nivel {{ grp.story }}</span>
                  <span class="text-ink-600">{{ grp.total }}</span>
                  <span
                    v-if="grp.damaged"
                    class="rounded-full bg-red-500/15 px-1.5 font-semibold text-red-400"
                  >
                    {{ grp.damaged }}
                  </span>
                </button>

                <div v-if="expandedGroups.has(grp.story)" class="ml-2">
                  <button
                    v-for="el in grp.list"
                    :key="el.id"
                    class="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-ink-800"
                    :class="el.id === selectedElementId ? 'bg-ink-800 text-ink-100' : 'text-ink-400'"
                    @click="store.selectElement(el.id)"
                  >
                    <span class="inline-block h-2 w-2 shrink-0 rounded-full" :style="{ background: dotColor(el.id) }" />
                    <span class="flex-1 truncate">{{ el.tag }}</span>
                    <span
                      v-if="isDamaged(el.id)"
                      class="rounded px-1 text-[10px] font-semibold"
                      :style="{ color: SEVERITY[severityByElement[el.id] as Severity].color }"
                    >
                      {{ SEVERITY[severityByElement[el.id] as Severity].label }}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
