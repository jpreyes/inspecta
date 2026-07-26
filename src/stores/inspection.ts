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
import { conditionFromScore, hasModel, inspectionScore } from '../types/inspection'
import { generateFrame } from '../data/generate'
import { vulnerabilityIndex, riskLevel } from '../data/vulnerability'
import { hazardIndex, type SiteConfig } from '../data/hazard'
import { db, seedIfEmpty } from '../db'
import { backend, type RemoteUser } from '../sync/backend'
import { syncNow as runSync } from '../sync/engine'

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
    await seedIfEmpty()
    await reload()
    selectedStructureId.value = structures.value[0]?.id ?? null
    inspectionIndex.value = Math.max(0, structureInspections.value.length - 1)
    ready.value = true
  }

  // ── Getters ────────────────────────────────────────────
  const activeStructure = computed<Structure | null>(
    () => structures.value.find((s) => s.id === selectedStructureId.value) ?? null,
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

  /** Índice de vulnerabilidad por configuración (0 regular → 100 muy vulnerable). */
  const structureVulnerability = computed(() =>
    vulnerabilityIndex(activeStructure.value?.vulnerability),
  )

  /** Índice de amenaza/exposición sísmica del sitio (0 sin datos → 100). */
  const structureHazard = computed(() => hazardIndex(activeStructure.value?.site))

  /** Riesgo/prioridad = f(condición, vulnerabilidad, amenaza) de la campaña activa. */
  const structureRisk = computed(() =>
    riskLevel(structureCondition.value, structureVulnerability.value, structureHazard.value),
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
    return authUser.value
  }
  function logout() {
    backend.logout()
    authUser.value = null
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
      syncMessage.value = `Enviados ${res.pushed} · Fotos ${res.photos} · Recibidos ${res.pulled}`
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
    const f: Finding = {
      id: uid(),
      inspectionId: activeInspection.value.id,
      photos: [],
      createdAt: new Date().toISOString(),
      ...payload,
    }
    findings.value.push(f)
    await db.findings.add(plain(f))
    return f
  }

  async function updateFinding(id: string, patch: Partial<Finding>) {
    const f = findings.value.find((x) => x.id === id)
    if (!f) return
    Object.assign(f, patch)
    await db.findings.put(plain(f))
  }

  async function removeFinding(id: string) {
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

  // ── CRUD de proyectos ──────────────────────────────────
  async function addProject(payload: { name: string; client?: string }) {
    const p: Project = {
      id: uid(),
      name: payload.name.trim(),
      client: payload.client?.trim() || undefined,
      createdAt: new Date().toISOString(),
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
    const s: Structure = {
      id: uid(),
      projectId: payload.projectId,
      name: payload.name.trim(),
      type: payload.type,
      grid: payload.grid,
      elements: payload.grid ? generateFrame(payload.grid) : [],
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
  async function removeStructure(id: string) {
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

  async function addInspection(payload: { inspector: string; date: string; summary?: string }) {
    if (!selectedStructureId.value) return
    const insp: Inspection = {
      id: uid(),
      structureId: selectedStructureId.value,
      ...payload,
    }
    inspections.value.push(insp)
    await db.inspections.add(plain(insp))
    inspectionIndex.value = structureInspections.value.length - 1
    return insp
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
    authUser,
    syncing,
    lastSyncAt,
    syncMessage,
    // getters
    activeStructure,
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
    structureVulnerability,
    structureHazard,
    structureRisk,
    conditionByCampaign,
    severityCounts,
    currentTests,
    // acciones
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
  }
})
