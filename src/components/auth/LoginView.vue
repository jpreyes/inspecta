<script setup lang="ts">
// Pantalla de entrada. Sin sesión la app no muestra ningún dato: los proyectos
// son del servidor y del equipo, no del dispositivo. La primera entrada
// necesita internet (la clave la valida el servidor); después la sesión sirve
// sin señal, y se revalida sola cada vez que hay conexión.
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { CloudOff, LogIn } from 'lucide-vue-next'
import { useInspectionStore } from '../../stores/inspection'

const store = useInspectionStore()
const { sessionMessage } = storeToRefs(store)

const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  if (busy.value) return
  error.value = ''
  busy.value = true
  try {
    await store.login(email.value.trim(), password.value)
    password.value = ''
  } catch (e) {
    const status = (e as { status?: number })?.status
    error.value =
      status === 0
        ? 'No hay conexión con el servidor. La primera entrada (y volver a entrar tras cerrar sesión) necesita internet.'
        : 'Email o clave incorrectos.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 items-center justify-center bg-ink-950 p-6">
    <div class="w-full max-w-sm">
      <div class="mb-6 flex items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600">
          <svg viewBox="0 0 32 32" class="h-6 w-6" fill="none" stroke="#f0f9ff" stroke-width="2.4" stroke-linecap="round">
            <path d="M10 8 V24 M22 8 V24 M8 8 H24 M8 16 H24 M8 24 H24" />
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-semibold text-ink-100">Inspecta</h1>
          <p class="text-xs text-ink-400">Inspecciones estructurales · gemelo digital</p>
        </div>
      </div>

      <!-- Por qué se está pidiendo la sesión (expiró, venció el plazo sin validar…) -->
      <p
        v-if="sessionMessage"
        class="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-300"
      >
        {{ sessionMessage }}
      </p>

      <form class="space-y-3 rounded-xl border border-ink-800 bg-ink-900 p-4" @submit.prevent="submit">
        <div>
          <label class="mb-1 block text-[11px] font-medium text-ink-300" for="login-email">Email</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="username"
            required
            placeholder="tu@correo.cl"
            class="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-2 text-sm text-ink-100"
          />
        </div>
        <div>
          <label class="mb-1 block text-[11px] font-medium text-ink-300" for="login-pass">Clave</label>
          <input
            id="login-pass"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full rounded-md border border-ink-700 bg-ink-800 px-2 py-2 text-sm text-ink-100"
          />
        </div>
        <button
          type="submit"
          :disabled="busy"
          class="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-600 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-500 disabled:opacity-50"
        >
          <LogIn :size="15" /> {{ busy ? 'Entrando…' : 'Entrar' }}
        </button>
        <p v-if="error" class="text-[11px] leading-relaxed text-red-400">{{ error }}</p>
      </form>

      <div class="mt-4 flex gap-2 text-[11px] leading-relaxed text-ink-500">
        <CloudOff :size="14" class="mt-0.5 shrink-0" />
        <p>
          Una vez adentro, la app funciona sin señal: los datos quedan en este dispositivo y suben
          cuando vuelves a tener conexión. La sesión se revalida sola cada vez que hay internet y
          vale hasta 14 días sin validar.
        </p>
      </div>
      <p class="mt-3 text-[11px] leading-relaxed text-ink-600">
        Las cuentas no se crean desde acá: las crea el administrador. Si olvidaste tu clave, pídele
        que te la cambie.
      </p>
    </div>
  </div>
</template>
