<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Cloud, CloudOff, RefreshCw, LogOut } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'

const store = useInspectionStore()
const { authUser, syncing, lastSyncAt, syncMessage } = storeToRefs(store)

const open = ref(false)
const email = ref('')
const password = ref('')
const error = ref('')

async function doLogin() {
  error.value = ''
  try {
    await store.login(email.value.trim(), password.value)
    password.value = ''
  } catch (e) {
    error.value = 'No se pudo iniciar sesión. Revisa email/clave.'
  }
}
async function doSync() {
  try {
    await store.syncNow()
  } catch {
    /* el mensaje queda en syncMessage */
  }
}
function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="relative">
    <button
      data-tour="sync"
      class="flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1 text-xs transition-colors"
      :class="authUser ? 'text-ink-200 hover:bg-ink-800' : 'text-ink-400 hover:bg-ink-800'"
      @click="open = !open"
    >
      <RefreshCw v-if="syncing" :size="14" class="animate-spin text-brand-500" />
      <component :is="authUser ? Cloud : CloudOff" v-else :size="14" />
      <span>{{ authUser ? 'Sincronización' : 'Conectar' }}</span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-ink-800 bg-ink-900 p-3 shadow-xl"
    >
      <!-- Conectado -->
      <template v-if="authUser">
        <div class="mb-2 flex items-center gap-2 text-xs text-ink-300">
          <Cloud :size="14" class="text-brand-500" />
          <span class="truncate">{{ authUser.email }}</span>
        </div>
        <button
          class="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-ink-950 hover:bg-brand-500 disabled:opacity-50"
          :disabled="syncing"
          @click="doSync"
        >
          {{ syncing ? 'Sincronizando…' : 'Sincronizar ahora' }}
        </button>
        <p v-if="syncMessage" class="mt-2 text-[11px] text-ink-400">{{ syncMessage }}</p>
        <p v-if="lastSyncAt" class="mt-0.5 text-[11px] text-ink-500">
          Última sincronización: {{ fmt(lastSyncAt) }}
        </p>
        <button
          class="mt-3 flex items-center gap-1 text-[11px] text-ink-500 hover:text-red-400"
          @click="store.logout()"
        >
          <LogOut :size="12" /> Cerrar sesión
        </button>
      </template>

      <!-- Login -->
      <form v-else class="space-y-2" @submit.prevent="doLogin">
        <div class="text-xs font-medium text-ink-200">Conectar al servidor</div>
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          autocomplete="username"
          class="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-ink-200"
        />
        <input
          v-model="password"
          type="password"
          placeholder="Clave"
          autocomplete="current-password"
          class="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-ink-200"
        />
        <button
          type="submit"
          class="w-full rounded-md bg-brand-600 py-1.5 text-sm font-medium text-ink-950 hover:bg-brand-500"
        >
          Entrar
        </button>
        <p v-if="error" class="text-[11px] text-red-400">{{ error }}</p>
        <p class="text-[11px] text-ink-500">
          Sin conexión, la app funciona igual (offline). La sincronización sube y baja tus datos.
        </p>
      </form>
    </div>
  </div>
</template>
