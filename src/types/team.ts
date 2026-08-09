// ─────────────────────────────────────────────────────────────
// Equipos, roles y permisos.
//
// Un EQUIPO agrupa proyectos/estructuras/campañas y sus miembros. Cada miembro
// tiene exactamente un ROL dentro del equipo, que decide qué puede hacer.
//
// Los roles se guardan como cuatro listas de usuarios EN EL PROPIO EQUIPO
// (admins/inspectors/reviewers/clients) y no en una colección `memberships`.
// Motivo: en PocketBase las condiciones sobre una relación multi-valor se
// evalúan de forma independiente entre filas, así que "la misma membresía tiene
// este usuario Y este rol" no es expresable de forma confiable en una regla.
// Con listas por rol, cada regla es una comprobación de un solo campo.
// ─────────────────────────────────────────────────────────────

export type Role = 'admin' | 'inspector' | 'revisor' | 'cliente'

/** Campo (lista de usuarios) del registro `teams` que corresponde a cada rol. */
export type RoleField = 'admins' | 'inspectors' | 'reviewers' | 'clients'

export const ROLE_FIELD: Record<Role, RoleField> = {
  admin: 'admins',
  inspector: 'inspectors',
  revisor: 'reviewers',
  cliente: 'clients',
}

export const ROLE_OF_FIELD: Record<RoleField, Role> = {
  admins: 'admin',
  inspectors: 'inspector',
  reviewers: 'revisor',
  clients: 'cliente',
}

export interface RoleMeta {
  label: string
  hint: string
  color: string
}

export const ROLES: Record<Role, RoleMeta> = {
  admin: {
    label: 'Administrador',
    hint: 'Gestiona el equipo y sus miembros, crea proyectos y estructuras, y edita todo.',
    color: '#a855f7',
  },
  inspector: {
    label: 'Inspector',
    hint: 'Registra campañas, hallazgos, fotos y ensayos. No crea ni borra proyectos.',
    color: '#0ea5e9',
  },
  revisor: {
    label: 'Revisor',
    hint: 'Lee todo y genera informes, pero no modifica los datos de terreno.',
    color: '#eab308',
  },
  cliente: {
    label: 'Cliente',
    hint: 'Solo lectura: consulta resultados e informes de su estructura.',
    color: '#64748b',
  },
}

/** Orden de mayor a menor privilegio (para resolver pertenencias duplicadas). */
export const ROLE_ORDER: Role[] = ['admin', 'inspector', 'revisor', 'cliente']

export type Permission =
  /** Gestionar el equipo: invitar, cambiar roles, quitar miembros, renombrar. */
  | 'manage_team'
  /** Crear/editar/eliminar proyectos y estructuras. */
  | 'manage_projects'
  /** Crear/editar campañas, hallazgos, fotos y ensayos (trabajo de terreno). */
  | 'edit_data'
  /** Ver datos y generar el informe. */
  | 'view'

const MATRIX: Record<Role, Permission[]> = {
  admin: ['manage_team', 'manage_projects', 'edit_data', 'view'],
  inspector: ['edit_data', 'view'],
  revisor: ['view'],
  cliente: ['view'],
}

/**
 * ¿El rol permite esta acción?
 *
 * `role === null` significa **modo local**: la app no está conectada a un
 * servidor, así que los datos son de este dispositivo y no hay a quién
 * restringir. Se permite todo — es lo que mantiene el offline-first intacto.
 */
export function can(role: Role | null, p: Permission): boolean {
  if (role === null) return true
  return MATRIX[role].includes(p)
}

/** Un equipo tal como lo usa la app (proyección del registro remoto). */
export interface Team {
  id: string
  name: string
  admins: string[]
  inspectors: string[]
  reviewers: string[]
  clients: string[]
}

/** Un miembro resuelto: usuario + su rol en el equipo. */
export interface TeamMember {
  userId: string
  role: Role
  /** Nombre visible. PocketBase oculta el email de otros usuarios salvo que
   *  ellos activen `emailVisibility`, así que puede venir vacío. */
  name?: string
  email?: string
}

/** Rol de un usuario en un equipo (el de mayor privilegio si está repetido). */
export function roleInTeam(team: Team | null | undefined, userId: string | null): Role | null {
  if (!team || !userId) return null
  for (const r of ROLE_ORDER) {
    if (team[ROLE_FIELD[r]]?.includes(userId)) return r
  }
  return null
}

/** Lista de miembros del equipo, sin duplicados, ordenada por privilegio. */
export function membersOf(team: Team | null | undefined): TeamMember[] {
  if (!team) return []
  const seen = new Set<string>()
  const out: TeamMember[] = []
  for (const r of ROLE_ORDER) {
    for (const userId of team[ROLE_FIELD[r]] ?? []) {
      if (seen.has(userId)) continue
      seen.add(userId)
      out.push({ userId, role: r })
    }
  }
  return out
}
