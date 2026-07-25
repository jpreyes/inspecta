<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { FolderOpen, Building2 } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { SEVERITY } from '../../types/inspection'

const store = useInspectionStore()
const { projects, structures, activeStructure, severityByElement, selectedElementId } =
  storeToRefs(store)

function structuresOf(projectId: string) {
  return structures.value.filter((s) => s.projectId === projectId)
}

// Elementos agrupados por nivel, con solo los que tienen algún hallazgo o todos si pocos
const groupedElements = computed(() => {
  const els = activeStructure.value?.elements ?? []
  const byStory = new Map<number, typeof els>()
  for (const el of els) {
    const s = el.story ?? 0
    if (!byStory.has(s)) byStory.set(s, [])
    byStory.get(s)!.push(el)
  }
  return [...byStory.entries()]
    .sort((a, b) => b[0] - a[0]) // pisos altos arriba
    .map(([story, list]) => ({
      story,
      list: [...list].sort((a, b) => a.tag.localeCompare(b.tag)),
    }))
})

function dotColor(elId: string) {
  const sev = severityByElement.value[elId]
  return sev != null ? SEVERITY[sev].color : '#334155'
}
</script>

<template>
  <aside class="flex flex-col overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 text-xs uppercase tracking-wide text-ink-500">
      <span>Proyectos</span>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      <div v-for="prj in projects" :key="prj.id" class="mb-2">
        <div class="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-ink-200">
          <FolderOpen :size="15" class="shrink-0 text-ink-400" />
          <span class="truncate font-medium">{{ prj.name }}</span>
        </div>

        <div class="ml-3 border-l border-ink-800 pl-2">
          <button
            v-for="str in structuresOf(prj.id)"
            :key="str.id"
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-ink-800"
            :class="str.id === activeStructure?.id ? 'bg-ink-800 text-ink-100' : 'text-ink-300'"
            @click="store.selectStructure(str.id)"
          >
            <Building2 :size="15" class="shrink-0" />
            <span class="truncate">{{ str.name }}</span>
          </button>

          <!-- elementos de la estructura activa -->
          <div v-if="activeStructure && activeStructure.projectId === prj.id" class="mt-1">
            <div v-for="grp in groupedElements" :key="grp.story" class="mb-1">
              <div class="px-2 py-1 text-[11px] uppercase tracking-wide text-ink-500">
                Nivel {{ grp.story }}
              </div>
              <button
                v-for="el in grp.list"
                :key="el.id"
                class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-ink-800"
                :class="el.id === selectedElementId ? 'bg-ink-800 text-ink-100' : 'text-ink-400'"
                @click="store.selectElement(el.id)"
              >
                <span
                  class="inline-block h-2 w-2 shrink-0 rounded-full"
                  :style="{ background: dotColor(el.id) }"
                />
                <span class="truncate">{{ el.tag }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
