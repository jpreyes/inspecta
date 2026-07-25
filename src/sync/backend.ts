import { pb } from './pocketbase'

// ─────────────────────────────────────────────────────────────
// Adaptador de backend remoto (hoy PocketBase).
//
// La app NUNCA importa PocketBase directamente: usa `backend`. Así el backend
// es intercambiable (PocketBase, Supabase, otro) sin tocar el resto de la app,
// y la app sigue funcionando SIN backend (offline-first, todo en Dexie).
// ─────────────────────────────────────────────────────────────

/** Colecciones remotas (mismos nombres que las tablas locales de Dexie). */
export type RemoteCollection = 'projects' | 'structures' | 'inspections' | 'findings' | 'tests'

export interface RemoteUser {
  id: string
  email: string
}

export const backend = {
  get isAuthenticated(): boolean {
    return pb.authStore.isValid
  },
  get user(): RemoteUser | null {
    const rec = pb.authStore.record
    return rec ? { id: rec.id, email: (rec as { email?: string }).email ?? '' } : null
  },

  /** ¿Está el backend accesible? Si no (offline o no desplegado), seguimos local. */
  async isReachable(): Promise<boolean> {
    try {
      await pb.health.check({ requestKey: null })
      return true
    } catch {
      return false
    }
  },

  async login(email: string, password: string): Promise<RemoteUser> {
    const auth = await pb.collection('users').authWithPassword(email, password)
    return { id: auth.record.id, email: (auth.record as { email?: string }).email ?? email }
  },
  logout(): void {
    pb.authStore.clear()
  },

  // ── CRUD genérico (base del motor de sync) ──────────────────

  /** Trae registros remotos, opcionalmente los modificados desde `since` (ISO). */
  async pull(col: RemoteCollection, since?: string): Promise<Record<string, unknown>[]> {
    const opts: { sort: string; filter?: string } = { sort: '-updated' }
    if (since) opts.filter = `updated >= "${since}"`
    return pb.collection(col).getFullList(opts)
  },

  /** Upsert por id (los ids son UUID generados en el cliente → estables). */
  async push(col: RemoteCollection, record: Record<string, unknown>): Promise<unknown> {
    try {
      return await pb.collection(col).update(String(record.id), record)
    } catch {
      return await pb.collection(col).create(record)
    }
  },

  async remove(col: RemoteCollection, id: string): Promise<void> {
    await pb.collection(col).delete(id)
  },

  /** Sube una foto real (archivo) al hallazgo — PocketBase genera el thumbnail. */
  async uploadPhoto(findingId: string, file: File): Promise<unknown> {
    const fd = new FormData()
    fd.append('photos+', file) // '+' = agregar al campo multi-archivo
    return pb.collection('findings').update(findingId, fd)
  },

  /** URL de un archivo (con thumbnail opcional, ej. '100x100'). */
  fileUrl(record: { id: string; collectionId?: string }, filename: string, thumb?: string): string {
    const url = pb.files.getURL(record, filename)
    return thumb ? `${url}?thumb=${thumb}` : url
  },
}

/** Convierte un dataURL (base64 de Dexie) en File para subir a PocketBase. */
export function dataUrlToFile(dataUrl: string, name = 'foto.jpg'): File {
  const [meta, b64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new File([arr], name, { type: mime })
}
