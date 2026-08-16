import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  Finding,
  Inspection,
  Project,
  Severity,
  Structure,
  StructureType,
  Test,
  Vec3,
} from '../types/inspection'
import { conditionFromScore, hasModel, inspectionScore, isNonStructural } from '../types/inspection'
import { generateFrame } from '../data/generate'
import { registeredIrregularities, riskLevel } from '../data/vulnerability'
import { hazardIndex, type SiteConfig } from '../data/hazard'
import { db, seedIfEmpty } from '../db'
import { isDemoRecord } from '../data/seed'
import { TOUR_STEPS } from '../data/tour'
import { backend, type RemoteUser } from '../sync/backend'
import { syncNow as runSync } from '../sync/engine'
import {
  can as roleCan,
  membersOf,
  roleInTeam,
  ROLE_FIELD,
  type Permission,
  type Role,
  type Team,
  type TeamMember,
} from '../types/team'

/** Copia plana (sin proxies reactivos de Vue). IndexedDB no puede clonar proxies
 *  anidados (p.ej. las fotos dentro de un hallazgo), y se perdían al guardar. */
function plain<T>(o: T): T {
  return JSON.parse(JSON.stringify(o))
}

/** ID de 15 caracteres [a-z0-9] — compatible con los record ids de PocketBase,
 *  para que el mismo id sirva local y remoto. */
function uid() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const rnd = globalThis.crypto?.getRandomValues?.(new Uint32Array(15))
  let s = ''
  for (let i = 0; i < 15; i++) {
    const n = rnd ? rnd[i] : Math.floor(Math.random() * 4294967296)
    s += chars[n % 36]
  }
  return s
}

export const useInspectionStore = defineStore('inspection', () => {
  // ── Estado ─────────────────────────────────────────────
  const projects = ref<Project[]>([])
  const structures = ref<Structure[]>([])
  const inspections = ref<Inspection[]>([])
  const findings = ref<Finding[]>([])
  const tests = ref<Test[]>([])
  const ready = ref(false)

  /** Vista central: lista de daños (por defecto), gemelo 3D o resultados. */
  const activeView = ref<'list' | 'twin' | 'results'>('list')

  /** Sidebar como drawer en pantallas chicas (móvil/tablet). */
  const sidebarOpen = ref(false)

  const selectedStructureId = ref<string | null>(null)
  const selectedElementId = ref<string | null>(null)
  /** Índice de la campaña de inspección seleccionada (visita periódica activa). */
  const inspectionIndex = ref(0)

  // Colocación de pin por raycast: al registrar un hallazgo, el usuario clava
  // el pin sobre la superficie 3D del elemento.
  const placingPin = ref(false)
  const pendingPin = ref<Vec3 | null>(null)

  // Formulario "daño primero": se abre desde cualquier lado, el elemento es un
  // campo del formulario (no hay que preseleccionarlo navegando el árbol).
  const damageFormOpen = ref(false)
  const damageFormElementId = ref<string | null>(null)

  // ── Sync / autenticación (PocketBase) ──────────────────
  const authUser = ref<RemoteUser | null>(backend.user)
  const syncing = ref(false)
  const lastSyncAt = ref<string | null>(null)
  const syncMessage = ref('')

  // ── Guía guiada (tour) ─────────────────────────────────
  // Se abre sola la primera vez que se usa la app en este dispositivo, y queda
  // disponible en el botón "Guía". La marca vive en localStorage: es una
  // preferencia del dispositivo, no un dato de la inspección.
  const TOUR_KEY = 'inspecta.tour'
  /** Marca de que ya se borró la siembra demo (para no volver a sembrarla). */
  const DEMO_KEY = 'inspecta.demo'
  const tourOpen = ref(false)
  const tourStep = ref(0)

  function startTour() {
    tourStep.value = 0
    tourOpen.value = true
  }
  function closeTour() {
    tourOpen.value = false
    localStorage.setItem(TOUR_KEY, 'done')
  }
  function tourNext() {
    if (tourStep.value >= TOUR_STEPS.length - 1) closeTour()
    else tourStep.value++
  }
  function tourPrev() {
    if (tourStep.value > 0) tourStep.value--
  }

  // ── Equipos y roles ────────────────────────────────────
  const teams = ref<Team[]>([])
  const activeTeamId = ref<string | null>(localStorage.getItem('inspecta.team'))
  /** Nombres de usuarios ya resueltos (id → nombre visible). */
  const userNames = ref<Record<string, string>>({})
  const teamMessage = ref('')

  const activeTeam = computed<Team | null>(
    () => teams.value.find((t) => t.id === activeTeamId.value) ?? null,
  )

  /**
   * Rol del usuario en el equipo activo. `null` = modo local: no hay sesión ni
   * equipo, los datos son de este dispositivo y no hay a quién restringir.
   */
  const myRole = computed<Role | null>(() =>
    roleInTeam(activeTeam.value, authUser.value?.id ?? null),
  )

  /** Miembros del equipo activo con su nombre visible resuelto. */
  const teamMembers = computed<TeamMember[]>(() =>
    membersOf(activeTeam.value).map((m) => ({
      ...m,
      name:
        userNames.value[m.userId] ||
        (m.userId === authUser.value?.id ? authUser.value.email : undefined),
      email: m.userId === authUser.value?.id ? authUser.value?.email : undefined,
    })),
  )

  /** ¿El usuario puede hacer esto? Sin equipo (modo local) siempre puede. */
  function can(p: Permission): boolean {
    return roleCan(myRole.value, p)
  }
  const canManageTeam = computed(() => can('manage_team'))
  const canManageProjects = computed(() => can('manage_projects'))

  /**
   * ¿Puede trabajar (campañas, hallazgos, ensayos) en ESTA estructura?
   *
   * El rol manda primero: revisor y cliente nunca. Después manda la asignación:
   * un inspector solo trabaja en las estructuras que tiene asignadas. Una
   * estructura sin asignados queda abierta a todos los inspectores del equipo
   * (es el comportamiento previo a la asignación, y el que aplica en modo local).
   * El admin del equipo siempre puede. Las reglas de PocketBase imponen lo mismo
   * del lado del servidor: esto solo evita ofrecer botones que van a fallar.
   */
  function canWorkOnStructure(structureId?: string | null): boolean {
    if (!can('edit_data')) return false
    if (myRole.value === null || myRole.value === 'admin') return true
    const s = structures.value.find((x) => x.id === structureId)
    const assigned = s?.inspectorIds ?? []
    return assigned.length === 0 || assigned.includes(authUser.value?.id ?? '')
  }

  /** Lo mismo, para la estructura activa (lo que consume la interfaz). */
  const canWorkHere = computed(() => canWorkOnStructure(selectedStructureId.value))

  /** Estructura a la que pertenece una campaña (para validar hallazgos/ensayos). */
  function structureOfInspection(inspectionId?: string): string | undefined {
    return inspections.value.find((i) => i.id === inspectionId)?.structureId
  }

  /** Sello de equipo + autor para los registros nuevos. */
  function stamp() {
    return {
      teamId: activeTeamId.value ?? undefined,
      authorId: authUser.value?.id,
      authorName: authUser.value?.name || authUser.value?.email || undefined,
    }
  }

  // ── Carga ──────────────────────────────────────────────
  /** Recarga los datos en memoria desde Dexie. */
  async function reload() {
    projects.value = await db.projects.toArray()
    structures.value = await db.structures.toArray()
    inspections.value = (await db.inspections.toArray()).sort((a, b) =>
      a.date.localeCompare(b.date),
    )
    findings.value = await db.findings.toArray()
    tests.value = await db.tests.toArray()
  }

  async function init() {
    if (!localStorage.getItem(DEMO_KEY)) await seedIfEmpty()
    await reload()
    selectedStructureId.value = structures.value[0]?.id ?? null
    inspectionIndex.value = Math.max(0, structureInspections.value.length - 1)
    ready.value = true
    // Primera vez en este dispositivo: se abre la guía.
    if (!localStorage.getItem(TOUR_KEY)) startTour()
    // Con sesión guardada, recupera equipos y rol sin bloquear el arranque.
    if (backend.isAuthenticated) {
      loadTeams().catch(() => {
        teamMessage.value = 'No se pudieron cargar los equipos (sin conexión).'
      })
    }
  }

  // ── Getters ────────────────────────────────────────────
  const activeStructure = computed<Structure | null>(
    () => structures.value.find((s) => s.id === selectedStructureId.value) ?? null,
  )

  /** Proyecto de la estructura activa. */
  const activeProject = computed<Project | null>(
    () => projects.value.find((p) => p.id === activeStructure.value?.projectId) ?? null,
  )

  /** ¿La estructura activa tiene modelo 3D? Si no, el gemelo no aplica. */
  const activeHasModel = computed(() => hasModel(activeStructure.value))

  /** Inspecciones de la estructura activa, ordenadas en el tiempo. */
  const structureInspections = computed<Inspection[]>(() =>
    inspections.value
      .filter((i) => i.structureId === selectedStructureId.value)
      .sort((a, b) => a.date.localeCompare(b.date)),
  )

  const activeInspection = computed<Inspection | null>(
    () => structureInspections.value[inspectionIndex.value] ?? null,
  )

  /** Fecha de la campaña de inspección seleccionada. */
  const asOfDate = computed(() => activeInspection.value?.date ?? '')

  /**
   * Estado del elemento a la fecha de la campaña seleccionada: por cada
   * elemento, el hallazgo más reciente registrado en o antes de esa inspección.
   * Permite ver la estructura tal como estaba en cada visita periódica.
   */
  /** Peor hallazgo por elemento 3D (con elementId) acumulado hasta `cutoff`.
   *  Solo para colorear el gemelo; los hallazgos sin elementId no aplican. */
  function worstPerElementUpTo(cutoff: string): Finding[] {
    if (!cutoff) return []
    const inspById = new Map(inspections.value.map((i) => [i.id, i]))
    const visible = findings.value.filter((f) => {
      const insp = inspById.get(f.inspectionId)
      return f.elementId && insp && insp.structureId === selectedStructureId.value && insp.date <= cutoff
    })
    const latest = new Map<string, Finding>()
    for (const f of visible) {
      const key = f.elementId as string
      const prev = latest.get(key)
      if (!prev) {
        latest.set(key, f)
        continue
      }
      const fDate = inspById.get(f.inspectionId)!.date
      const pDate = inspById.get(prev.inspectionId)!.date
      if (fDate > pDate || (fDate === pDate && f.createdAt > prev.createdAt)) {
        latest.set(key, f)
      }
    }
    return [...latest.values()]
  }

  const findingsAsOf = computed<Finding[]>(() => worstPerElementUpTo(asOfDate.value))

  /** Mapa elementId → severidad vigente a la fecha de corte (para colorear el 3D). */
  const severityByElement = computed<Record<string, Severity>>(() => {
    const map: Record<string, Severity> = {}
    for (const f of findingsAsOf.value) {
      const k = f.elementId as string
      map[k] = f.severity > (map[k] ?? 0) ? f.severity : map[k] ?? f.severity
    }
    return map
  })

  /** Todos los hallazgos de la campaña seleccionada. */
  const currentFindings = computed<Finding[]>(() =>
    findings.value
      .filter((f) => f.inspectionId === activeInspection.value?.id)
      .sort((a, b) => b.severity - a.severity),
  )

  const selectedElement = computed(
    () => activeStructure.value?.elements.find((e) => e.id === selectedElementId.value) ?? null,
  )

  const selectedElementFindings = computed<Finding[]>(() =>
    findingsAsOf.value.filter((f) => f.elementId === selectedElementId.value),
  )

  /** Índice de salud global (0 crítico → 100 sano) de la campaña activa. */
  const structureCondition = computed(() =>
    inspectionScore(currentFindings.value, activeStructure.value?.type, activeStructure.value?.elements),
  )

  /** Condición semáforo (operativa/observación/crítica) derivada del índice. */
  const structureConditionKey = computed(() => conditionFromScore(structureCondition.value))

  /** Irregularidades registradas (configuración) de la estructura activa. */
  const structureIrregularities = computed(() =>
    registeredIrregularities(activeStructure.value?.vulnerability),
  )

  /** Índice de amenaza/exposición sísmica del sitio (0 sin datos → 100). */
  const structureHazard = computed(() => hazardIndex(activeStructure.value?.site))

  /** Riesgo = matriz(condición, amenaza) de la campaña activa. La vulnerabilidad
   *  se registra aparte (no entra al número). */
  const structureRisk = computed(() => riskLevel(structureCondition.value, structureHazard.value))

  /** Hallazgos no estructurales de la campaña (no afectan la condición estructural). */
  const nonStructuralCount = computed(
    () => currentFindings.value.filter((f) => isNonStructural(f.element)).length,
  )

  /** Condición por campaña de inspección — comparación entre visitas periódicas. */
  const conditionByCampaign = computed(() =>
    structureInspections.value.map((insp) => {
      const fs = findings.value.filter((f) => f.inspectionId === insp.id)
      const score = inspectionScore(fs, activeStructure.value?.type, activeStructure.value?.elements)
      return { id: insp.id, date: insp.date, score, key: conditionFromScore(score) }
    }),
  )

  /** Conteo de hallazgos por severidad en la campaña activa. */
  const severityCounts = computed<Record<Severity, number>>(() => {
    const c: Record<Severity, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const f of currentFindings.value) c[f.severity]++
    return c
  })

  /** Ensayos de la campaña seleccionada. */
  const currentTests = computed<Test[]>(() =>
    tests.value.filter((t) => t.inspectionId === activeInspection.value?.id),
  )

  // ── Acciones ───────────────────────────────────────────
  function selectStructure(id: string) {
    selectedStructureId.value = id
    selectedElementId.value = null
    inspectionIndex.value = Math.max(0, structureInspections.value.length - 1)
    // si la estructura no tiene modelo 3D, no dejar la vista en el gemelo
    if (activeView.value === 'twin' && !activeHasModel.value) activeView.value = 'list'
  }

  function selectElement(id: string | null) {
    selectedElementId.value = id
  }

  function setView(v: 'list' | 'twin' | 'results') {
    activeView.value = v
    sidebarOpen.value = false
  }
  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }
  function closeSidebar() {
    sidebarOpen.value = false
  }

  function openDamageForm(elementId?: string) {
    damageFormElementId.value = elementId ?? null
    damageFormOpen.value = true
  }
  function closeDamageForm() {
    damageFormOpen.value = false
    damageFormElementId.value = null
  }

  // ── Auth + sync ────────────────────────────────────────
  async function login(email: string, password: string) {
    authUser.value = await backend.login(email, password)
    await loadTeams()
    return authUser.value
  }
  function logout() {
    backend.logout()
    authUser.value = null
    teams.value = []
    userNames.value = {}
    // No se limpia activeTeamId: al volver a entrar se reencuentra el equipo.
  }

  // ── Equipos ────────────────────────────────────────────

  /** Trae los equipos del usuario y resuelve los nombres de sus miembros. */
  async function loadTeams() {
    if (!backend.isAuthenticated) return
    teams.value = await backend.listTeams()
    if (!teams.value.find((t) => t.id === activeTeamId.value)) {
      selectTeam(teams.value[0]?.id ?? null)
    }
    await resolveMemberNames()
  }

  async function resolveMemberNames() {
    const ids = [...new Set(teams.value.flatMap((t) => membersOf(t).map((m) => m.userId)))]
    const missing = ids.filter((id) => !userNames.value[id])
    if (!missing.length) return
    try {
      for (const u of await backend.usersByIds(missing)) {
        userNames.value[u.id] = u.name || u.email || u.id
      }
    } catch {
      /* sin permiso o sin red: se muestra el id */
    }
  }

  function selectTeam(id: string | null) {
    activeTeamId.value = id
    if (id) localStorage.setItem('inspecta.team', id)
    else localStorage.removeItem('inspecta.team')
  }

  async function createTeam(name: string) {
    if (!authUser.value) throw new Error('Inicia sesión primero')
    const t = await backend.createTeam(name.trim(), authUser.value.id)
    teams.value.push(t)
    selectTeam(t.id)
    return t
  }

  /** Guarda el equipo en el servidor y refleja el resultado en memoria. */
  async function persistTeam(next: Team) {
    const saved = await backend.saveTeamRoles(next)
    const i = teams.value.findIndex((t) => t.id === saved.id)
    if (i >= 0) teams.value[i] = saved
    await resolveMemberNames()
    return saved
  }

  /** Quita un usuario de todas las listas de rol (copia nueva, sin mutar). */
  function withoutMember(team: Team, userId: string): Team {
    return {
      ...team,
      admins: team.admins.filter((id) => id !== userId),
      inspectors: team.inspectors.filter((id) => id !== userId),
      reviewers: team.reviewers.filter((id) => id !== userId),
      clients: team.clients.filter((id) => id !== userId),
    }
  }

  /**
   * Invita por email a un usuario que YA existe. La app no crea cuentas: se
   * crean en el panel de PocketBase (`/_/`). Devuelve un mensaje si no existe.
   */
  async function inviteMember(email: string, role: Role) {
    const team = activeTeam.value
    if (!team) throw new Error('Selecciona un equipo primero')
    const user = await backend.findUserByEmail(email.trim())
    if (!user) {
      throw new Error(
        `No existe un usuario con ${email.trim()}. Créalo primero en el panel de PocketBase (/_/).`,
      )
    }
    if (membersOf(team).some((m) => m.userId === user.id)) {
      throw new Error('Ese usuario ya es miembro del equipo.')
    }
    const next = withoutMember(team, user.id)
    next[ROLE_FIELD[role]] = [...next[ROLE_FIELD[role]], user.id]
    userNames.value[user.id] = user.name || user.email || user.id
    return persistTeam(next)
  }

  async function setMemberRole(userId: string, role: Role) {
    const team = activeTeam.value
    if (!team) return
    // No dejar el equipo sin ningún administrador.
    if (team.admins.includes(userId) && role !== 'admin' && team.admins.length === 1) {
      throw new Error('El equipo debe conservar al menos un administrador.')
    }
    const next = withoutMember(team, userId)
    next[ROLE_FIELD[role]] = [...next[ROLE_FIELD[role]], userId]
    return persistTeam(next)
  }

  async function removeMember(userId: string) {
    const team = activeTeam.value
    if (!team) return
    if (team.admins.includes(userId) && team.admins.length === 1) {
      throw new Error('El equipo debe conservar al menos un administrador.')
    }
    return persistTeam(withoutMember(team, userId))
  }
  async function syncNow() {
    if (!authUser.value) throw new Error('Inicia sesión primero')
    syncing.value = true
    syncMessage.value = ''
    try {
      const res = await runSync()
      await reload()
      if (!structures.value.find((s) => s.id === selectedStructureId.value)) {
        selectedStructureId.value = structures.value[0]?.id ?? null
      }
      inspectionIndex.value = Math.min(inspectionIndex.value, Math.max(0, structureInspections.value.length - 1))
      lastSyncAt.value = new Date().toISOString()
      syncMessage.value =
        `Enviados ${res.pushed} · Fotos ${res.photos} · Recibidos ${res.pulled}` +
        // Omitidos = registros que tu rol no puede escribir en el servidor
        // (proyectos y estructuras si eres inspector). No es un error.
        (res.skipped ? ` · Omitidos ${res.skipped}` : '')
      return res
    } catch (e) {
      const err = e as { message?: string; status?: number; response?: { data?: unknown } }
      const detail = err?.response?.data ? ' — ' + JSON.stringify(err.response.data) : ''
      syncMessage.value = 'Error: ' + (err?.message ?? String(e)) + detail
      throw e
    } finally {
      syncing.value = false
    }
  }

  function startPinPlacement() {
    placingPin.value = true
    pendingPin.value = null
  }
  function setPendingPin(v: Vec3) {
    pendingPin.value = v
  }
  function cancelPinPlacement() {
    placingPin.value = false
    pendingPin.value = null
  }

  function selectInspectionByIndex(i: number) {
    const max = structureInspections.value.length - 1
    inspectionIndex.value = Math.min(Math.max(i, 0), Math.max(0, max))
  }

  async function addFinding(payload: {
    component?: string
    element: string
    material?: string
    zone?: string
    elementId?: string
    damageType: string
    cause?: string
    severity: Severity
    extension: number
    pin?: Vec3
    notes?: string
  }) {
    if (!activeInspection.value) return
    if (!canWorkOnStructure(structureOfInspection(activeInspection.value.id))) {
      throw new Error('No estás asignado a esta estructura.')
    }
    const f: Finding = {
      id: uid(),
      inspectionId: activeInspection.value.id,
      photos: [],
      createdAt: new Date().toISOString(),
      ...stamp(),
      ...payload,
    }
    findings.value.push(f)
    await db.findings.add(plain(f))
    return f
  }

  async function updateFinding(id: string, patch: Partial<Finding>) {
    const f = findings.value.find((x) => x.id === id)
    if (!f) return
    if (!canWorkOnStructure(structureOfInspection(f.inspectionId))) {
      throw new Error('No estás asignado a esta estructura.')
    }
    Object.assign(f, patch)
    await db.findings.put(plain(f))
  }

  async function removeFinding(id: string) {
    const f = findings.value.find((x) => x.id === id)
    if (f && !canWorkOnStructure(structureOfInspection(f.inspectionId))) {
      throw new Error('No estás asignado a esta estructura.')
    }
    findings.value = findings.value.filter((f) => f.id !== id)
    await db.findings.delete(id)
  }

  /** Fija la clase de una irregularidad (0/1/2) en la estructura activa y persiste. */
  async function setIrregularity(id: string, cls: number) {
    const s = activeStructure.value
    if (!s) return
    const v: Record<string, number> = { ...(s.vulnerability ?? {}) }
    if (cls > 0) v[id] = cls
    else delete v[id]
    s.vulnerability = v
    await db.structures.put(plain(s))
  }

  /** Actualiza la configuración de sitio (amenaza sísmica) de la estructura activa. */
  async function setSite(patch: Partial<SiteConfig>) {
    const s = activeStructure.value
    if (!s) return
    s.site = { ...(s.site ?? {}), ...patch }
    await db.structures.put(plain(s))
  }

  // ── Datos de demostración ──────────────────────────────
  /** ¿Quedan datos sembrados de demostración en este dispositivo? */
  const hasDemoData = computed(
    () => projects.value.some((p) => isDemoRecord(p.id)) || structures.value.some((s) => isDemoRecord(s.id)),
  )

  /**
   * Borra la siembra de demostración y todo lo que cuelgue de ella. Es una
   * limpieza LOCAL: esos registros nunca se suben al servidor (el motor de
   * sync los reconoce por id), así que no hay nada que borrar del otro lado.
   */
  async function removeDemoData() {
    // Deja constancia: si no, la siembra volvería sola en el próximo arranque
    // cuando el dispositivo quede sin ningún proyecto.
    localStorage.setItem(DEMO_KEY, 'cleared')
    const demoProjects = new Set(projects.value.filter((p) => isDemoRecord(p.id)).map((p) => p.id))
    const demoStructures = new Set(
      structures.value.filter((s) => isDemoRecord(s.id) || demoProjects.has(s.projectId)).map((s) => s.id),
    )
    const demoInspections = new Set(
      inspections.value.filter((i) => isDemoRecord(i.id) || demoStructures.has(i.structureId)).map((i) => i.id),
    )
    const dropFinding = (x: { id: string; inspectionId: string }) =>
      isDemoRecord(x.id) || demoInspections.has(x.inspectionId)

    await db.findings.bulkDelete(findings.value.filter(dropFinding).map((f) => f.id))
    await db.tests.bulkDelete(tests.value.filter(dropFinding).map((t) => t.id))
    await db.inspections.bulkDelete([...demoInspections])
    await db.structures.bulkDelete([...demoStructures])
    await db.projects.bulkDelete([...demoProjects])

    await reload()
    if (!structures.value.find((s) => s.id === selectedStructureId.value)) {
      selectedStructureId.value = structures.value[0]?.id ?? null
      selectedElementId.value = null
    }
    inspectionIndex.value = Math.max(0, structureInspections.value.length - 1)
  }

  // ── CRUD de proyectos ──────────────────────────────────
  async function addProject(payload: { name: string; client?: string }) {
    if (!can('manage_projects')) throw new Error('Tu rol no permite crear proyectos.')
    const p: Project = {
      id: uid(),
      name: payload.name.trim(),
      client: payload.client?.trim() || undefined,
      createdAt: new Date().toISOString(),
      teamId: activeTeamId.value ?? undefined,
    }
    projects.value.push(p)
    await db.projects.add(plain(p))
    return p
  }
  async function updateProject(id: string, patch: Partial<Project>) {
    const p = projects.value.find((x) => x.id === id)
    if (!p) return
    Object.assign(p, patch)
    await db.projects.put(plain(p))
  }
  async function removeProject(id: string) {
    if (!can('manage_projects')) throw new Error('Tu rol no permite eliminar proyectos.')
    for (const s of structures.value.filter((s) => s.projectId === id)) await removeStructure(s.id)
    projects.value = projects.value.filter((p) => p.id !== id)
    await db.projects.delete(id)
  }

  // ── CRUD de estructuras ────────────────────────────────
  async function addStructure(payload: {
    projectId: string
    name: string
    type: StructureType
    grid?: Structure['grid']
  }) {
    if (!can('manage_projects')) throw new Error('Tu rol no permite crear estructuras.')
    const s: Structure = {
      id: uid(),
      projectId: payload.projectId,
      name: payload.name.trim(),
      type: payload.type,
      grid: payload.grid,
      elements: payload.grid ? generateFrame(payload.grid) : [],
      teamId: activeTeamId.value ?? undefined,
    }
    structures.value.push(s)
    await db.structures.add(plain(s))
    selectStructure(s.id)
    return s
  }
  async function updateStructure(id: string, patch: Partial<Structure>) {
    const s = structures.value.find((x) => x.id === id)
    if (!s) return
    Object.assign(s, patch)
    await db.structures.put(plain(s))
  }
  /** Asigna los inspectores de una estructura (solo admin). Lista vacía = la
   *  estructura queda abierta a todos los inspectores del equipo. */
  async function assignInspectors(structureId: string, userIds: string[]) {
    if (!can('manage_projects')) throw new Error('Solo un administrador asigna inspectores.')
    const s = structures.value.find((x) => x.id === structureId)
    if (!s) return
    s.inspectorIds = [...userIds]
    await db.structures.put(plain(s))
  }

  async function removeStructure(id: string) {
    if (!can('manage_projects')) throw new Error('Tu rol no permite eliminar estructuras.')
    const inspIds = inspections.value.filter((i) => i.structureId === id).map((i) => i.id)
    findings.value = findings.value.filter((f) => !inspIds.includes(f.inspectionId))
    tests.value = tests.value.filter((t) => !inspIds.includes(t.inspectionId))
    inspections.value = inspections.value.filter((i) => i.structureId !== id)
    structures.value = structures.value.filter((s) => s.id !== id)
    if (inspIds.length) {
      await db.findings.where('inspectionId').anyOf(inspIds).delete()
      await db.tests.where('inspectionId').anyOf(inspIds).delete()
    }
    await db.inspections.where('structureId').equals(id).delete()
    await db.structures.delete(id)
    if (selectedStructureId.value === id) {
      selectedStructureId.value = structures.value[0]?.id ?? null
      selectedElementId.value = null
      inspectionIndex.value = Math.max(0, structureInspections.value.length - 1)
    }
  }

  async function addInspection(payload: {
    inspector: string
    inspectorId?: string
    date: string
    summary?: string
    weather?: string
  }) {
    if (!selectedStructureId.value) return
    if (!canWorkOnStructure(selectedStructureId.value)) {
      throw new Error('No estás asignado a esta estructura.')
    }
    const insp: Inspection = {
      id: uid(),
      structureId: selectedStructureId.value,
      ...stamp(),
      ...payload,
    }
    inspections.value.push(insp)
    await db.inspections.add(plain(insp))
    inspectionIndex.value = structureInspections.value.length - 1
    return insp
  }

  // ── Ensayos ────────────────────────────────────────────
  async function addTest(payload: {
    testType: string
    method?: string
    standard?: string
    executedAt: string
    laboratory?: string
    sampleLocation?: string
    resultSummary: string
  }) {
    if (!activeInspection.value) return
    if (!canWorkOnStructure(structureOfInspection(activeInspection.value.id))) {
      throw new Error('No estás asignado a esta estructura.')
    }
    const t: Test = {
      id: uid(),
      inspectionId: activeInspection.value.id,
      createdAt: new Date().toISOString(),
      ...stamp(),
      ...payload,
    }
    tests.value.push(t)
    await db.tests.add(plain(t))
    return t
  }
  async function removeTest(id: string) {
    const t = tests.value.find((x) => x.id === id)
    if (t && !canWorkOnStructure(structureOfInspection(t.inspectionId))) {
      throw new Error('No estás asignado a esta estructura.')
    }
    tests.value = tests.value.filter((t) => t.id !== id)
    await db.tests.delete(id)
  }

  return {
    // estado
    projects,
    structures,
    inspections,
    findings,
    tests,
    ready,
    activeView,
    selectedStructureId,
    selectedElementId,
    inspectionIndex,
    placingPin,
    pendingPin,
    damageFormOpen,
    damageFormElementId,
    sidebarOpen,
    authUser,
    syncing,
    lastSyncAt,
    syncMessage,
    teams,
    activeTeamId,
    teamMessage,
    tourOpen,
    tourStep,
    // getters
    activeStructure,
    activeProject,
    activeHasModel,
    structureInspections,
    activeInspection,
    asOfDate,
    findingsAsOf,
    severityByElement,
    currentFindings,
    selectedElement,
    selectedElementFindings,
    structureCondition,
    structureConditionKey,
    structureIrregularities,
    structureHazard,
    structureRisk,
    nonStructuralCount,
    conditionByCampaign,
    severityCounts,
    currentTests,
    activeTeam,
    myRole,
    teamMembers,
    canManageTeam,
    canManageProjects,
    canWorkHere,
    hasDemoData,
    // acciones
    startTour,
    closeTour,
    tourNext,
    tourPrev,
    removeDemoData,
    can,
    canWorkOnStructure,
    assignInspectors,
    loadTeams,
    selectTeam,
    createTeam,
    inviteMember,
    setMemberRole,
    removeMember,
    setIrregularity,
    setSite,
    addProject,
    updateProject,
    removeProject,
    addStructure,
    updateStructure,
    removeStructure,
    init,
    reload,
    selectStructure,
    selectElement,
    setView,
    toggleSidebar,
    closeSidebar,
    openDamageForm,
    closeDamageForm,
    login,
    logout,
    syncNow,
    startPinPlacement,
    setPendingPin,
    cancelPinPlacement,
    selectInspectionByIndex,
    addFinding,
    updateFinding,
    removeFinding,
    addInspection,
    addTest,
    removeTest,
  }
})
