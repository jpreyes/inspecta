<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Users, UserPlus, Trash2, Plus, Check } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'
import { ROLES, ROLE_ORDER, type Role } from '../../types/team'

const store = useInspectionStore()
const { teams, activeTeam, teamMembers, myRole, authUser, canManageTeam } = storeToRefs(store)

const open = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')

// Alta de equipo
const creating = ref(false)
const newTeamName = ref('')

// Invitación
const inviteEmail = ref('')
const inviteRole = ref<Role>('inspector')

const roleLabel = computed(() => (myRole.value ? ROLES[myRole.value].label : 'Local'))
const roleColor = computed(() => (myRole.value ? ROLES[myRole.value].color : '#64748b'))

/** Corre una acción mostrando su error en el panel en vez de romper la vista. */
async function run(fn: () => Promise<unknown>, ok = '') {
  error.value = ''
  notice.value = ''
  busy.value = true
  try {
    await fn()
    notice.value = ok
  } catch (e) {
    error.value = (e as Error)?.message ?? String(e)
  } finally {
    busy.value = false
  }
}

function doCreateTeam() {
  const name = newTeamName.value.trim()
  if (!name) return
  return run(async () => {
    await store.createTeam(name)
    newTeamName.value = ''
    creating.value = false
  }, 'Equipo creado. Eres su administrador.')
}

function doInvite() {
  const email = inviteEmail.value.trim()
  if (!email) return
  return run(async () => {
    await store.inviteMember(email, inviteRole.value)
    inviteEmail.value = ''
  }, 'Miembro agregado.')
}

function doChangeRole(userId: string, role: Role) {
  return run(() => store.setMemberRole(userId, role), 'Rol actualizado.')
}

function doRemove(userId: string) {
  return run(() => store.removeMember(userId), 'Miembro quitado del equipo.')
}

/** Nombre a mostrar: PocketBase oculta el email de otros usuarios. */
function display(m: { userId: string; name?: string; email?: string }) {
  return m.email || m.name || m.userId
}
</script>

<template>
  <div class="relative">
    <button
      class="flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:bg-ink-800"
      @click="open = !open"
    >
      <Users :size="14" :style="{ color: roleColor }" />
      <span class="hidden max-w-[9rem] truncate sm:inline">
        {{ activeTeam ? activeTeam.name : 'Equipo' }}
      </span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-30 mt-2 w-80 rounded-lg border border-ink-800 bg-ink-900 p-3 shadow-xl"
    >
      <!-- Sin sesión: los equipos viven en el servidor -->
      <template v-if="!authUser">
        <div class="text-xs font-medium text-ink-200">Equipos</div>
        <p class="mt-1.5 text-[11px] text-ink-400">
          Los equipos y roles viven en el servidor. Conéctate para compartir proyectos con otros
          inspectores. Sin conexión, la app trabaja en modo local con acceso completo a los datos de
          este dispositivo.
        </p>
      </template>

      <template v-else>
        <!-- Selector de equipo -->
        <div class="mb-2 flex items-center justify-between">
          <span class="text-xs font-medium text-ink-200">Equipo</span>
          <span
            class="rounded-full px-2 py-0.5 text-[10px] font-medium"
            :style="{ color: roleColor, background: roleColor + '22' }"
          >
            {{ roleLabel }}
          </span>
        </div>

        <select
          v-if="teams.length"
          class="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-ink-200"
          :value="activeTeam?.id ?? ''"
          @change="store.selectTeam(($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">— Modo local (sin equipo) —</option>
          <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <p v-else class="text-[11px] text-ink-400">
          Todavía no perteneces a ningún equipo. Crea uno para compartir proyectos.
        </p>

        <!-- Crear equipo -->
        <form v-if="creating" class="mt-2 flex gap-1" @submit.prevent="doCreateTeam">
          <input
            v-model="newTeamName"
            placeholder="Nombre del equipo"
            class="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-ink-200"
          />
          <button
            type="submit"
            :disabled="busy"
            class="rounded-md bg-brand-600 px-2 text-ink-950 hover:bg-brand-500 disabled:opacity-50"
          >
            <Check :size="14" />
          </button>
        </form>
        <button
          v-else
          class="mt-2 flex items-center gap-1 text-[11px] text-ink-400 hover:text-brand-400"
          @click="creating = true"
        >
          <Plus :size="12" /> Nuevo equipo
        </button>

        <!-- Miembros -->
        <template v-if="activeTeam">
          <div class="mt-3 border-t border-ink-800 pt-2.5">
            <div class="mb-1.5 text-xs font-medium text-ink-200">
              Miembros ({{ teamMembers.length }})
            </div>
            <ul class="max-h-52 space-y-1 overflow-y-auto">
              <li
                v-for="m in teamMembers"
                :key="m.userId"
                class="flex items-center gap-1.5 rounded-md bg-ink-950 px-2 py-1.5"
              >
                <span class="min-w-0 flex-1 truncate text-[11px] text-ink-300" :title="m.userId">
                  {{ display(m) }}
                  <span v-if="m.userId === authUser?.id" class="text-ink-500">(tú)</span>
                </span>

                <select
                  v-if="canManageTeam"
                  class="rounded border border-ink-700 bg-ink-800 px-1 py-0.5 text-[10px] text-ink-200"
                  :value="m.role"
                  :disabled="busy"
                  @change="doChangeRole(m.userId, ($event.target as HTMLSelectElement).value as Role)"
                >
                  <option v-for="r in ROLE_ORDER" :key="r" :value="r">{{ ROLES[r].label }}</option>
                </select>
                <span
                  v-else
                  class="rounded-full px-1.5 py-0.5 text-[10px]"
                  :style="{ color: ROLES[m.role].color, background: ROLES[m.role].color + '22' }"
                >
                  {{ ROLES[m.role].label }}
                </span>

                <button
                  v-if="canManageTeam"
                  class="text-ink-600 hover:text-red-400 disabled:opacity-40"
                  :disabled="busy"
                  title="Quitar del equipo"
                  @click="doRemove(m.userId)"
                >
                  <Trash2 :size="12" />
                </button>
              </li>
            </ul>
          </div>

          <!-- Invitar -->
          <form v-if="canManageTeam" class="mt-2.5 space-y-1.5" @submit.prevent="doInvite">
            <div class="flex gap-1">
              <input
                v-model="inviteEmail"
                type="email"
                placeholder="email@dominio.cl"
                class="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-xs text-ink-200"
              />
              <select
                v-model="inviteRole"
                class="rounded-md border border-ink-700 bg-ink-800 px-1 text-[11px] text-ink-200"
              >
                <option v-for="r in ROLE_ORDER" :key="r" :value="r">{{ ROLES[r].label }}</option>
              </select>
              <button
                type="submit"
                :disabled="busy"
                class="rounded-md bg-brand-600 px-2 text-ink-950 hover:bg-brand-500 disabled:opacity-50"
                title="Agregar al equipo"
              >
                <UserPlus :size="14" />
              </button>
            </div>
            <p class="text-[10px] leading-snug text-ink-500">
              {{ ROLES[inviteRole].hint }}
            </p>
            <p class="text-[10px] leading-snug text-ink-600">
              El usuario debe existir: las cuentas se crean en el panel de PocketBase (<code>/_/</code>).
            </p>
          </form>
        </template>

        <p v-if="error" class="mt-2 text-[11px] text-red-400">{{ error }}</p>
        <p v-if="notice" class="mt-2 text-[11px] text-brand-400">{{ notice }}</p>
      </template>
    </div>
  </div>
</template>
