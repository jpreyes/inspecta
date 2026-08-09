<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  FolderOpen,
  FolderPlus,
  Building2,
  ChevronRight,
  ChevronDown,
  Filter,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { SEVERITY, type Severity, type StructureType } from '../../types/inspection'

const store = useInspectionStore()
const { projects, structures, activeStructure, severityByElement, selectedElementId, canManageProjects } =
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

// ── Editor de proyectos / estructuras (CRUD) ─────────────
type EditorMode = null | 'new-project' | 'edit-project' | 'new-structure' | 'edit-structure'
const STRUCTURE_TYPES: { v: StructureType; label: string }[] = [
  { v: 'edificio', label: 'Edificio' },
  { v: 'puente', label: 'Puente' },
  { v: 'nave', label: 'Nave industrial' },
  { v: 'torre', label: 'Torre' },
]
const ed = reactive({
  mode: null as EditorMode,
  projectId: '',
  structureId: '',
  name: '',
  client: '',
  type: 'edificio' as StructureType,
  useGrid: false,
  baysX: 3,
  baysZ: 2,
  stories: 3,
})
const editorTitle = computed(
  () =>
    ({
      'new-project': 'Nuevo proyecto',
      'edit-project': 'Editar proyecto',
      'new-structure': 'Nueva estructura',
      'edit-structure': 'Editar estructura',
    })[ed.mode ?? 'new-project'],
)

function openNewProject() {
  Object.assign(ed, { mode: 'new-project', name: '', client: '' })
}
function openEditProject(id: string, name: string, client?: string) {
  Object.assign(ed, { mode: 'edit-project', projectId: id, name, client: client ?? '' })
}
function openNewStructure(projectId: string) {
  Object.assign(ed, {
    mode: 'new-structure',
    projectId,
    name: '',
    type: 'edificio' as StructureType,
    useGrid: false,
    baysX: 3,
    baysZ: 2,
    stories: 3,
  })
  expandedProjects.add(projectId)
}
function openEditStructure(id: string, name: string, type: StructureType) {
  Object.assign(ed, { mode: 'edit-structure', structureId: id, name, type })
}
function cancelEditor() {
  ed.mode = null
}
async function submitEditor() {
  const name = ed.name.trim()
  if (!name) return
  if (ed.mode === 'new-project') await store.addProject({ name, client: ed.client })
  else if (ed.mode === 'edit-project')
    await store.updateProject(ed.projectId, { name, client: ed.client.trim() || undefined })
  else if (ed.mode === 'new-structure') {
    const grid =
      ed.type === 'edificio' && ed.useGrid
        ? { baysX: ed.baysX, baysZ: ed.baysZ, stories: ed.stories, bayX: 6, bayZ: 5, storyH: 3.2 }
        : undefined
    await store.addStructure({ projectId: ed.projectId, name, type: ed.type, grid })
  } else if (ed.mode === 'edit-structure')
    await store.updateStructure(ed.structureId, { name, type: ed.type })
  ed.mode = null
}
async function delProject(id: string, name: string) {
  if (confirm(`¿Eliminar el proyecto "${name}" y todas sus estructuras, inspecciones y hallazgos?`))
    await store.removeProject(id)
}
async function delStructure(id: string, name: string) {
  if (confirm(`¿Eliminar la estructura "${name}" y sus inspecciones y hallazgos?`))
    await store.removeStructure(id)
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
      <div class="flex items-center gap-1">
        <button
          class="flex items-center gap-1 rounded px-1.5 py-0.5 normal-case tracking-normal transition-colors"
          :class="onlyDamaged ? 'bg-amber-500/15 text-amber-400' : 'text-ink-500 hover:text-ink-300'"
          title="Mostrar solo elementos con daño"
          @click="onlyDamaged = !onlyDamaged"
        >
          <Filter :size="12" /> Con daño
        </button>
        <button
          v-if="canManageProjects"
          class="flex items-center gap-1 rounded px-1.5 py-0.5 normal-case tracking-normal text-ink-500 transition-colors hover:text-ink-200"
          title="Nuevo proyecto"
          @click="openNewProject"
        >
          <FolderPlus :size="13" /> Proyecto
        </button>
      </div>
    </div>

    <!-- Formulario CRUD (proyecto / estructura) -->
    <form
      v-if="ed.mode"
      class="mx-3 mb-2 space-y-2 rounded-lg border border-brand-600/40 bg-ink-950 p-2.5"
      @submit.prevent="submitEditor"
    >
      <div class="text-[11px] font-semibold text-ink-200">{{ editorTitle }}</div>
      <input
        v-model="ed.name"
        type="text"
        placeholder="Nombre"
        class="block w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-ink-200"
      />
      <input
        v-if="ed.mode === 'new-project' || ed.mode === 'edit-project'"
        v-model="ed.client"
        type="text"
        placeholder="Cliente (opcional)"
        class="block w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-ink-200"
      />
      <template v-if="ed.mode === 'new-structure' || ed.mode === 'edit-structure'">
        <select
          v-model="ed.type"
          class="block w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-ink-200"
        >
          <option v-for="t in STRUCTURE_TYPES" :key="t.v" :value="t.v">{{ t.label }}</option>
        </select>
        <label
          v-if="ed.mode === 'new-structure' && ed.type === 'edificio'"
          class="flex items-center gap-1.5 text-[11px] text-ink-400"
        >
          <input v-model="ed.useGrid" type="checkbox" class="accent-brand-600" />
          Generar modelo 3D (pórtico paramétrico)
        </label>
        <div v-if="ed.mode === 'new-structure' && ed.type === 'edificio' && ed.useGrid" class="flex gap-1.5">
          <label class="flex-1 text-[10px] text-ink-500">
            Vanos X
            <input v-model.number="ed.baysX" type="number" min="1" class="mt-0.5 block w-full rounded border border-ink-700 bg-ink-800 px-1.5 py-1 text-xs text-ink-200" />
          </label>
          <label class="flex-1 text-[10px] text-ink-500">
            Vanos Z
            <input v-model.number="ed.baysZ" type="number" min="1" class="mt-0.5 block w-full rounded border border-ink-700 bg-ink-800 px-1.5 py-1 text-xs text-ink-200" />
          </label>
          <label class="flex-1 text-[10px] text-ink-500">
            Pisos
            <input v-model.number="ed.stories" type="number" min="1" class="mt-0.5 block w-full rounded border border-ink-700 bg-ink-800 px-1.5 py-1 text-xs text-ink-200" />
          </label>
        </div>
      </template>
      <div class="flex gap-2">
        <button type="submit" class="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-ink-950 hover:bg-brand-500">
          Guardar
        </button>
        <button type="button" class="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300" @click="cancelEditor">
          Cancelar
        </button>
      </div>
    </form>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      <div v-if="!projects.length && ed.mode !== 'new-project'" class="px-2 py-8 text-center">
        <p class="text-xs text-ink-500">Aún no hay proyectos.</p>
        <button
          v-if="canManageProjects"
          class="mx-auto mt-3 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-500"
          @click="openNewProject"
        >
          <FolderPlus :size="14" /> Crear primer proyecto
        </button>
        <p v-else class="mt-2 text-[11px] text-ink-600">
          Tu rol no permite crear proyectos. Pídeselo a un administrador del equipo.
        </p>
      </div>
      <div v-for="prj in projects" :key="prj.id" class="mb-1">
        <!-- Proyecto -->
        <div class="group flex items-center gap-0.5 rounded pr-1 hover:bg-ink-800">
          <button
            class="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-sm text-ink-200"
            @click="toggleSet(expandedProjects, prj.id)"
          >
            <component :is="expandedProjects.has(prj.id) ? ChevronDown : ChevronRight" :size="14" class="shrink-0 text-ink-500" />
            <FolderOpen :size="15" class="shrink-0 text-ink-400" />
            <span class="truncate font-medium">{{ prj.name }}</span>
          </button>
          <div v-if="canManageProjects" class="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
            <button class="rounded p-1 text-ink-500 hover:text-brand-400" title="Nueva estructura" @click="openNewStructure(prj.id)">
              <Plus :size="13" />
            </button>
            <button class="rounded p-1 text-ink-500 hover:text-ink-200" title="Editar proyecto" @click="openEditProject(prj.id, prj.name, prj.client)">
              <Pencil :size="12" />
            </button>
            <button class="rounded p-1 text-ink-500 hover:text-red-400" title="Eliminar proyecto" @click="delProject(prj.id, prj.name)">
              <Trash2 :size="12" />
            </button>
          </div>
        </div>

        <div v-if="expandedProjects.has(prj.id)" class="ml-2 border-l border-ink-800 pl-1.5">
          <div v-for="str in structuresOf(prj.id)" :key="str.id">
            <!-- Estructura -->
            <div
              class="group flex items-center gap-0.5 rounded pr-1"
              :class="str.id === activeStructure?.id ? 'bg-ink-800' : 'hover:bg-ink-800'"
            >
              <button
                class="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-sm"
                :class="str.id === activeStructure?.id ? 'text-ink-100' : 'text-ink-300'"
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
              <div v-if="canManageProjects" class="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                <button class="rounded p-1 text-ink-500 hover:text-ink-200" title="Editar estructura" @click="openEditStructure(str.id, str.name, str.type)">
                  <Pencil :size="12" />
                </button>
                <button class="rounded p-1 text-ink-500 hover:text-red-400" title="Eliminar estructura" @click="delStructure(str.id, str.name)">
                  <Trash2 :size="12" />
                </button>
              </div>
            </div>

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
                    @click="store.selectElement(el.id); store.closeSidebar()"
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
          <div v-if="!structuresOf(prj.id).length" class="px-2 py-1 text-[11px] text-ink-600">
            Sin estructuras
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
