<script setup lang="ts">
// Panel de sincronización. La sesión ya existe cuando esto se muestra: sin
// ella la app entera es la pantalla de entrada (ver App.vue), así que acá no
// hay formulario de login, solo sincronizar y cerrar sesión.
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Cloud, RefreshCw, LogOut } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'

const store = useInspectionStore()
const { authUser, syncing, lastSyncAt, syncMessage } = storeToRefs(store)

const open = ref(false)

/** Cerrar sesión deja los datos en el dispositivo pero exige internet para
 *  volver a entrar: conviene sincronizar antes y avisarlo. */
function doLogout() {
  if (confirm('¿Cerrar sesión? Para volver a entrar vas a necesitar conexión a internet.')) {
    store.logout()
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
      class="flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-200 transition-colors hover:bg-ink-800"
      @click="open = !open"
    >
      <RefreshCw v-if="syncing" :size="14" class="animate-spin text-brand-500" />
      <Cloud v-else :size="14" />
      <span>Sincronización</span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-ink-800 bg-ink-900 p-3 shadow-xl"
    >
      <div class="mb-2 flex items-center gap-2 text-xs text-ink-300">
        <Cloud :size="14" class="text-brand-500" />
        <span class="truncate">{{ authUser?.email }}</span>
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
      <p class="mt-2 text-[11px] leading-snug text-ink-600">
        Sin señal la app funciona igual: sincroniza al volver a tener conexión.
      </p>
      <button
        class="mt-3 flex items-center gap-1 text-[11px] text-ink-500 hover:text-red-400"
        @click="doLogout"
      >
        <LogOut :size="12" /> Cerrar sesión
      </button>
    </div>
  </div>
</template>
