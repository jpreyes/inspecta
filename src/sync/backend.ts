import { pb } from './pocketbase'
import type { Team } from '../types/team'

/** Registro remoto de `teams` → modelo de la app. */
function teamFromRecord(rec: Record<string, unknown> & { id: string }): Team {
  // Una relación multi-valor llega como arreglo. Un valor suelto se envuelve:
  // es lo que devolvían estos campos cuando estaban mal declarados como
  // relación simple (ver pb_migrations/1721000400_multi_role_relations.js), y
  // leerlo como lista vacía dejaba al usuario sin rol reconocido.
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? (v as string[]) : typeof v === 'string' && v ? [v] : []
  return {
    id: rec.id,
    name: String(rec.name ?? ''),
    admins: list(rec.admins),
    inspectors: list(rec.inspectors),
    reviewers: list(rec.reviewers),
    clients: list(rec.clients),
  }
}

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
  name?: string
}

export const backend = {
  get isAuthenticated(): boolean {
    return pb.authStore.isValid
  },
  get user(): RemoteUser | null {
    const rec = pb.authStore.record
    if (!rec) return null
    const r = rec as { email?: string; name?: string }
    return { id: rec.id, email: r.email ?? '', name: r.name || undefined }
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
    const r = auth.record as { email?: string; name?: string }
    return { id: auth.record.id, email: r.email ?? email, name: r.name || undefined }
  },
  logout(): void {
    pb.authStore.clear()
  },

  // ── Equipos y miembros ──────────────────────────────────────

  /** Equipos donde el usuario es miembro (las reglas del servidor ya filtran). */
  async listTeams(): Promise<Team[]> {
    const recs = await pb.collection('teams').getFullList({ sort: 'name' })
    return recs.map(teamFromRecord)
  },

  async createTeam(name: string, adminId: string): Promise<Team> {
    const rec = await pb.collection('teams').create({
      name,
      admins: [adminId],
      inspectors: [],
      reviewers: [],
      clients: [],
    })
    return teamFromRecord(rec)
  },

  /** Guarda las listas de roles del equipo. Solo un admin lo logra (regla del servidor). */
  async saveTeamRoles(team: Team): Promise<Team> {
    const rec = await pb.collection('teams').update(team.id, {
      name: team.name,
      admins: team.admins,
      inspectors: team.inspectors,
      reviewers: team.reviewers,
      clients: team.clients,
    })
    return teamFromRecord(rec)
  },

  /**
   * Busca un usuario por email para invitarlo. Devuelve `null` si no existe:
   * la app NO crea cuentas — se crean en el panel de PocketBase (`/_/`).
   */
  async findUserByEmail(email: string): Promise<RemoteUser | null> {
    try {
      const rec = await pb
        .collection('users')
        .getFirstListItem(`email = ${JSON.stringify(email)}`, { requestKey: null })
      const r = rec as unknown as { email?: string; name?: string }
      return { id: rec.id, email: r.email || email, name: r.name || undefined }
    } catch {
      return null
    }
  },

  /**
   * Resuelve nombre/email de varios usuarios (para listar los miembros).
   * PocketBase oculta el email de otros usuarios salvo que ellos activen
   * `emailVisibility`, así que lo normal es recibir solo el nombre.
   */
  async usersByIds(ids: string[]): Promise<RemoteUser[]> {
    if (!ids.length) return []
    const filter = ids.map((id) => `id = ${JSON.stringify(id)}`).join(' || ')
    const recs = await pb.collection('users').getFullList({ filter, requestKey: null })
    return recs.map((rec) => {
      const r = rec as unknown as { email?: string; name?: string }
      return { id: rec.id, email: r.email || '', name: r.name || undefined }
    })
  },

  // ── CRUD genérico (base del motor de sync) ──────────────────

  /** Trae registros remotos, opcionalmente los modificados desde `since` (ISO).
   *  `expand` sirve para traer el autor y poder mostrar su nombre sin conexión. */
  async pull(
    col: RemoteCollection,
    since?: string,
    expand?: string,
  ): Promise<Record<string, unknown>[]> {
    const opts: { sort: string; filter?: string; expand?: string } = { sort: '-updated' }
    if (since) opts.filter = `updated >= "${since}"`
    if (expand) opts.expand = expand
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
