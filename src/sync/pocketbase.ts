import PocketBase from 'pocketbase'

// Cliente PocketBase apuntando SIEMPRE al mismo origen ('/').
//
// · En producción la app se sirve desde `pb_public/` del propio PocketBase,
//   así que '/api' ya ES PocketBase → cero configuración.
// · En desarrollo, Vite hace proxy de '/api' hacia tu PocketBase local
//   (VITE_PB_URL o http://127.0.0.1:8097) — ver vite.config.ts.
//
// Resultado: el código de la app es IDÉNTICO local y en el VPS. Mover la web
// "al otro lado" no requiere tocar nada — solo servir el dist desde PocketBase.
export const pb = new PocketBase('/')

// Persistir la sesión entre recargas.
pb.authStore.onChange(() => {}, true)
