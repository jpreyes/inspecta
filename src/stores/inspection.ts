import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  Finding,
  Inspection,
  Photo,
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
import { parseModel, summarize, kindOf } from '../model'
import { isDemoRecord } from '../data/seed'
import { TOUR_STEPS } from '../data/tour'
import { backend, type RemoteUser } from '../sync/backend'
import { syncNow as runSync } from '../sync/engine'
import { watchRemote } from '../sync/realtime'
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

/** Vistas centrales de la app. Vive acá arriba —y no dentro del store— para que
 *  la guía guiada (src/data/tour.ts) declare su `view` con el mismo tipo y no se
 *  puedan desincronizar. */
export type AppView = 'list' | 'twin' | 'tests' | 'results'

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

  /** Vista central: lista de daños (por defecto), gemelo 3D, ensayos o resultados. */
  const activeView = ref<AppView>('list')

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
  // El MISMO formulario crea y edita: `damageFormFindingId` distingue los dos
  // casos (null = alta nueva).
  const damageFormOpen = ref(false)
  const damageFormElementId = ref<string | null>(null)
  const damageFormFindingId = ref<string | null>(null)

  // Formulario de ensayo. Vive en el store —y no dentro de TestsView— porque se
  // abre también desde la lista de daños, que es otra vista: en terreno el
  // ensayo y el daño se registran en la misma pasada.
  const testFormOpen = ref(false)

  // Ficha del hallazgo (solo lectura) y visor de fotos. Los dos son globales:
  // se abren desde la tabla, desde el panel del gemelo y desde el formulario,
  // así que el estado no puede vivir dentro de ninguno de ellos.
  const findingSheetId = ref<string | null>(null)
  const photoViewer = ref<{ photos: Photo[]; index: number; caption?: string } | null>(null)

  // ── Sync / autenticación (PocketBase) ──────────────────
  const authUser = ref<RemoteUser | null>(backend.user)
  const syncing = ref(false)
  const lastSyncAt = ref<string | null>(null)
  const syncMessage = ref('')

  // ── Tiempo real ────────────────────────────────────────
  // El sync es una corrida puntual; entre corrida y corrida, el trabajo que
  // sube otra persona no aparecía. `live` es la suscripción SSE que lo trae
  // solo, y `liveOn` lo que muestra la interfaz ("en vivo" vs "sin conexión").
  let stopLive: (() => void) | null = null
  const liveOn = ref(false)
  /** Marca de que llegó trabajo ajeno desde la última vez que se miró. */
  const remoteChanges = ref(0)

  async function startLive() {
    if (stopLive || !authUser.value) return
    stopLive = await watchRemote(() => {
      remoteChanges.value++
      void reload()
    })
    liveOn.value = true
  }
  function stopLiveUpdates() {
    stopLive?.()
    stopLive = null
    liveOn.value = false
  }

  // ── Sesión obligatoria ─────────────────────────────────
  // Los proyectos son del servidor, no del dispositivo: sin sesión no se
  // muestra ningún dato. La primera entrada necesita internet; después la
  // sesión sirve sin señal hasta GRACE_DAYS desde la última validación
  // exitosa contra el servidor (con conexión se revalida sola al arrancar,
  // así una cuenta revocada deja de entrar).
  const GRACE_DAYS = 14
  const VERIFIED_KEY = 'inspecta.verified' // última validación contra el servidor
  const OWNER_KEY = 'inspecta.owner' // dueño de los datos locales
  /** Por qué se pide iniciar sesión (se muestra en la pantalla de entrada). */
  const sessionMessage = ref('')

  function stampVerified() {
    localStorage.setItem(VERIFIED_KEY, new Date().toISOString())
  }
  /** Días desde la última validación, o null si nunca se validó. */
  function verifiedAgeDays(): number | null {
    const iso = localStorage.getItem(VERIFIED_KEY)
    if (!iso) return null
    const ms = Date.now() - new Date(iso).getTime()
    return Number.isFinite(ms) ? ms / 86_400_000 : null
  }
  function dropSession(reason: string) {
    stopLiveUpdates()
    backend.logout()
    authUser.value = null
    teams.value = []
    userNames.value = {}
    localStorage.removeItem(VERIFIED_KEY)
    sessionMessage.value = reason
  }

  /** ¿Hay sesión utilizable? Revalida contra el servidor si hay conexión. */
  async function validateSession(): Promise<boolean> {
    if (!backend.isAuthenticated) {
      authUser.value = null
      return false
    }
    if (await backend.isReachable()) {
      try {
        authUser.value = await backend.refresh()
        stampVerified()
        return true
      } catch {
        dropSession('Tu sesión ya no es válida. Vuelve a entrar con tu clave.')
        return false
      }
    }
    // Sin conexión: vale la sesión guardada mientras no esté vencida.
    const age = verifiedAgeDays()
    if (age === null || age > GRACE_DAYS) {
      dropSession(
        `Llevas más de ${GRACE_DAYS} días sin validar la sesión. Conéctate a internet para entrar de nuevo.`,
      )
      return false
    }
    authUser.value = backend.user
    return true
  }

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
    const ok = await validateSession()
    ready.value = true
    if (ok) await openWorkspace()
  }

  /**
   * Abre el espacio de trabajo del usuario con sesión: sus datos locales, sus
   * equipos y —la primera vez— la guía. Se llama al arrancar con sesión válida
   * y después de iniciar sesión.
   */
  async function openWorkspace() {
    // Cambio de cuenta en el mismo dispositivo: lo local es del otro usuario.
    const prev = localStorage.getItem(OWNER_KEY)
    if (prev && authUser.value && prev !== authUser.value.id) await wipeLocalData()
    if (authUser.value) localStorage.setItem(OWNER_KEY, authUser.value.id)

    if (!localStorage.getItem(DEMO_KEY)) await seedIfEmpty()
    await reload()
    focusInitialStructure()
    // Primera vez en este dispositivo: se abre la guía.
    if (!localStorage.getItem(TOUR_KEY)) startTour()
    await loadTeams().catch(() => {
      teamMessage.value = 'No se pudieron cargar los equipos (sin conexión).'
    })

    // Traer lo del servidor SIN esperar a que alguien apriete "Sincronizar".
    // Sin esto, quien entra por primera vez en un dispositivo solo ve la
    // siembra de ejemplo —que es local— y sus proyectos de equipo no aparecen
    // nunca: el trabajo real existía en el servidor pero nadie lo iba a buscar.
    // Sin conexión no es un fallo (la app es offline-first), así que el error
    // se traga: queda el botón manual y el aviso de "sin señal".
    if (await backend.isReachable()) {
      await syncNow().catch(() => {})
      focusInitialStructure()
      // Desde acá el trabajo del equipo llega solo, sin apretar nada.
      await startLive().catch(() => {})
    }
    watchForeground()
  }

  // ── Volver a la app = ponerse al día ───────────────────
  // En terreno el teléfono se bloquea, la pestaña queda de fondo y la conexión
  // se cae y vuelve. En todos esos casos el SSE puede haberse perdido eventos,
  // así que al volver al frente se hace una corrida de sync y se reabre la
  // escucha. Con estrangulamiento: volver a la app tres veces seguidas no
  // dispara tres sincronizaciones.
  const FOREGROUND_THROTTLE_MS = 60_000
  let lastForegroundSync = 0
  let foregroundHooked = false

  async function catchUp() {
    if (!authUser.value || syncing.value) return
    if (Date.now() - lastForegroundSync < FOREGROUND_THROTTLE_MS) return
    if (!(await backend.isReachable())) {
      stopLiveUpdates()
      return
    }
    lastForegroundSync = Date.now()
    await syncNow().catch(() => {})
    await startLive().catch(() => {})
  }

  function watchForeground() {
    if (foregroundHooked || typeof document === 'undefined') return
    foregroundHooked = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void catchUp()
    })
    window.addEventListener('online', () => void catchUp())
    window.addEventListener('offline', () => stopLiveUpdates())
  }

  /**
   * Elige qué estructura mostrar al abrir. Prefiere una real —del equipo o
   * creada por el usuario— y deja la de ejemplo solo como último recurso: si
   * hay trabajo de verdad, aterrizar en la demo hace parecer que no llegó.
   */
  function focusInitialStructure() {
    const real = structures.value.find((s) => !isDemoRecord(s.id))
    selectedStructureId.value = real?.id ?? structures.value[0]?.id ?? null
    inspectionIndex.value = Math.max(0, structureInspections.value.length - 1)
  }

  /** Borra los datos locales (al entrar otra cuenta en el mismo dispositivo). */
  async function wipeLocalData() {
    await Promise.all([
      db.findings.clear(),
      db.tests.clear(),
      db.inspections.clear(),
      db.structures.clear(),
      db.projects.clear(),
    ])
    localStorage.removeItem(DEMO_KEY)
    selectTeam(null)
    selectedStructureId.value = null
    selectedElementId.value = null
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

  /** Hallazgos de la campaña separados por ámbito. La condición estructural la
   *  calculan solo los primeros; los segundos se registran, se informan y se
   *  muestran aparte (ver `isNonStructural`). */
  const structuralFindings = computed<Finding[]>(() =>
    currentFindings.value.filter((f) => !isNonStructural(f)),
  )
  const nonStructuralFindings = computed<Finding[]>(() =>
    currentFindings.value.filter((f) => isNonStructural(f)),
  )
  const nonStructuralCount = computed(() => nonStructuralFindings.value.length)

  /** Condición por campaña de inspección — comparación entre visitas periódicas.
   *  Lleva también cuántos hallazgos y ensayos tiene cada una: la app muestra
   *  UNA campaña a la vez, así que sin este conteo el trabajo registrado en otra
   *  campaña es indistinguible de que no exista. */
  const conditionByCampaign = computed(() =>
    structureInspections.value.map((insp) => {
      const fs = findings.value.filter((f) => f.inspectionId === insp.id)
      const score = inspectionScore(fs, activeStructure.value?.type, activeStructure.value?.elements)
      return {
        id: insp.id,
        date: insp.date,
        score,
        key: conditionFromScore(score),
        findings: fs.length,
        tests: tests.value.filter((t) => t.inspectionId === insp.id).length,
      }
    }),
  )

  /** Hallazgos de la estructura activa que están en OTRA campaña que la abierta.
   *  Sirve para avisar "el trabajo está, pero no en la campaña que estás
   *  mirando" — que es como se ve, desde la interfaz, no ver lo de otra persona. */
  const findingsInOtherCampaigns = computed(() => {
    const ids = new Set(structureInspections.value.map((i) => i.id))
    return findings.value.filter(
      (f) => ids.has(f.inspectionId) && f.inspectionId !== activeInspection.value?.id,
    ).length
  })

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

  function setView(v: AppView) {
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
    damageFormFindingId.value = null
    damageFormElementId.value = elementId ?? null
    damageFormOpen.value = true
  }
  /** Abre el formulario sobre un hallazgo ya registrado. El permiso es el mismo
   *  que para borrarlo: quien puede trabajar en la estructura corrige lo que
   *  hay, sea suyo o de otra persona del equipo (el servidor manda igual). */
  function editFinding(id: string) {
    const f = findings.value.find((x) => x.id === id)
    if (!f) return
    damageFormFindingId.value = id
    damageFormElementId.value = f.elementId ?? null
    damageFormOpen.value = true
  }
  function closeDamageForm() {
    damageFormOpen.value = false
    damageFormElementId.value = null
    damageFormFindingId.value = null
  }
  /** Hallazgo en edición (null si el formulario es un alta). */
  const damageFormFinding = computed(
    () => findings.value.find((f) => f.id === damageFormFindingId.value) ?? null,
  )

  /** Abre la ficha de un hallazgo (la tabla es un resumen; acá está entero). */
  function openFindingSheet(id: string) {
    findingSheetId.value = id
  }
  function closeFindingSheet() {
    findingSheetId.value = null
  }
  const findingSheet = computed(
    () => findings.value.find((f) => f.id === findingSheetId.value) ?? null,
  )

  function openPhotoViewer(photos: Photo[], index = 0, caption?: string) {
    if (!photos.length) return
    photoViewer.value = { photos, index, caption }
  }
  function closePhotoViewer() {
    photoViewer.value = null
  }

  /** Abre el formulario de ensayo, cambiando de vista si hace falta. */
  function openTestForm() {
    activeView.value = 'tests'
    testFormOpen.value = true
  }
  function closeTestForm() {
    testFormOpen.value = false
  }

  // ── Auth + sync ────────────────────────────────────────
  async function login(email: string, password: string) {
    authUser.value = await backend.login(email, password)
    stampVerified()
    sessionMessage.value = ''
    await openWorkspace()
    return authUser.value
  }
  /** Cierra sesión. Los datos locales quedan, pero no se ven sin sesión; para
   *  volver a entrar hace falta conexión (la clave la valida el servidor). */
  function logout() {
    dropSession('')
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
    nonStructural?: boolean
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

  // ── Gemelo 3D: pórtico paramétrico o modelo importado ──
  // Las dos cosas producen lo mismo (`elements` con posición y tamaño); cambia
  // de dónde salen. Y las dos se pueden hacer DESPUÉS de crear la estructura,
  // que era justamente lo que faltaba: una estructura dada de alta sin marcar
  // la casilla se quedaba sin gemelo para siempre.

  /** Estado del importador, para que la interfaz muestre en qué va. */
  const modelBusy = ref(false)
  const modelMessage = ref('')

  /** Genera (o regenera) el pórtico paramétrico de una estructura. */
  async function setStructureGrid(structureId: string, grid: Structure['grid']) {
    if (!can('manage_projects')) throw new Error('Tu rol no permite editar estructuras.')
    const st = structures.value.find((x) => x.id === structureId)
    if (!st) return
    st.grid = grid
    st.elements = grid ? generateFrame(grid) : []
    st.model = undefined
    await db.structures.put(plain(st))
    await db.models.delete(structureId)
  }

  /**
   * Importa un modelo IFC o glTF/GLB como gemelo de la estructura.
   *
   * El archivo se guarda en IndexedDB (para trabajar sin señal) y sube a
   * PocketBase en la siguiente sincronización. De él se extrae además la capa
   * semántica —`elements` con su tag, tipo, piso y caja envolvente—, que es
   * contra la que se cuelgan los hallazgos.
   */
  async function importStructureModel(structureId: string, file: File) {
    if (!can('manage_projects')) throw new Error('Tu rol no permite editar estructuras.')
    const st = structures.value.find((x) => x.id === structureId)
    if (!st) return
    const kind = kindOf(file.name)
    if (!kind) throw new Error('Formato no reconocido. Usa un archivo .ifc, .glb o .gltf.')

    modelBusy.value = true
    modelMessage.value = 'Leyendo el modelo…'
    try {
      const parsed = await parseModel(file, file.name)

      st.model = {
        kind: parsed.kind,
        fileName: file.name,
        importedAt: new Date().toISOString(),
        elementCount: parsed.elements.length,
      }
      // El modelo importado manda: reemplaza al pórtico paramétrico, no convive
      // con él (dos geometrías para la misma estructura no significan nada).
      st.grid = undefined
      st.elements = plain(parsed.elements)
      await db.structures.put(plain(st))
      await db.models.put({
        structureId,
        blob: file,
        fileName: file.name,
        kind: parsed.kind,
        updatedAt: new Date().toISOString(),
      })

      // Llevar al gemelo solo si es la estructura que se está mirando: se puede
      // editar una estructura del árbol sin ser la activa.
      if (selectedStructureId.value === structureId) {
        selectedElementId.value = null
        activeView.value = 'twin'
      }
      modelMessage.value = [summarize(parsed), ...parsed.notes].join(' · ')
      return parsed
    } finally {
      modelBusy.value = false
    }
  }

  /**
   * Asegura que el archivo del gemelo esté en este dispositivo, bajándolo del
   * servidor si hace falta.
   *
   * La descarga es BAJO DEMANDA y no parte del sync: un IFC son megabytes y en
   * terreno se pagan con datos móviles, así que solo se baja cuando alguien
   * abre de verdad la vista 3D. Después queda en IndexedDB y funciona sin señal.
   */
  async function ensureModelFile(structureId: string): Promise<Blob | null> {
    const st = structures.value.find((x) => x.id === structureId)
    if (!st?.model) return null
    const cached = await db.models.get(structureId)
    if (cached) return cached.blob
    if (!st.model.remoteName) return null // aún no ha subido: no hay de dónde

    modelBusy.value = true
    modelMessage.value = 'Bajando el modelo 3D…'
    try {
      const blob = await backend.downloadModel(structureId, st.model.remoteName)
      await db.models.put({
        structureId,
        blob,
        fileName: st.model.fileName,
        kind: st.model.kind,
        updatedAt: new Date().toISOString(),
      })
      modelMessage.value = ''
      return blob
    } catch (e) {
      modelMessage.value =
        'No se pudo bajar el modelo 3D: ' + ((e as Error)?.message ?? String(e))
      return null
    } finally {
      modelBusy.value = false
    }
  }

  /** Quita el gemelo (el archivo y la geometría). Los hallazgos NO se borran:
   *  quedan sin elemento 3D asociado, que es como viven en una estructura que
   *  nunca tuvo modelo. */
  async function removeStructureModel(structureId: string) {
    if (!can('manage_projects')) throw new Error('Tu rol no permite editar estructuras.')
    const st = structures.value.find((x) => x.id === structureId)
    if (!st) return
    st.model = undefined
    st.grid = undefined
    st.elements = []
    await db.structures.put(plain(st))
    await db.models.delete(structureId)
    if (activeView.value === 'twin') activeView.value = 'list'
    modelMessage.value = ''
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
    await db.models.delete(id)
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
    damageFormFindingId,
    damageFormFinding,
    testFormOpen,
    findingSheetId,
    findingSheet,
    photoViewer,
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
    sessionMessage,
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
    structuralFindings,
    nonStructuralFindings,
    liveOn,
    remoteChanges,
    findingsInOtherCampaigns,
    modelBusy,
    modelMessage,
    setStructureGrid,
    importStructureModel,
    removeStructureModel,
    ensureModelFile,
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
    validateSession,
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
    editFinding,
    closeDamageForm,
    openTestForm,
    closeTestForm,
    openFindingSheet,
    closeFindingSheet,
    openPhotoViewer,
    closePhotoViewer,
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
