import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  Finding,
  Inspection,
  Project,
  Severity,
  Structure,
  Test,
  Vec3,
} from '../types/inspection'
import { conditionFromScore, worstSeverity } from '../types/inspection'
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

  /** Vista central: gemelo 3D o panel de resultados. */
  const activeView = ref<'twin' | 'results'>('twin')

  const selectedStructureId = ref<string | null>(null)
  const selectedElementId = ref<string | null>(null)
  /** Índice de la campaña de inspección seleccionada (visita periódica activa). */
  const inspectionIndex = ref(0)

  // Colocación de pin por raycast: al registrar un hallazgo, el usuario clava
  // el pin sobre la superficie 3D del elemento.
  const placingPin = ref(false)
  const pendingPin = ref<Vec3 | null>(null)

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
  /** Peor hallazgo por elemento acumulado hasta `cutoff` (reutilizable). */
  function worstPerElementUpTo(cutoff: string): Finding[] {
    if (!cutoff) return []
    const inspById = new Map(inspections.value.map((i) => [i.id, i]))
    const visible = findings.value.filter((f) => {
      const insp = inspById.get(f.inspectionId)
      return insp && insp.structureId === selectedStructureId.value && insp.date <= cutoff
    })
    const latest = new Map<string, Finding>()
    for (const f of visible) {
      const prev = latest.get(f.elementId)
      if (!prev) {
        latest.set(f.elementId, f)
        continue
      }
      const fDate = inspById.get(f.inspectionId)!.date
      const pDate = inspById.get(prev.inspectionId)!.date
      if (fDate > pDate || (fDate === pDate && f.createdAt > prev.createdAt)) {
        latest.set(f.elementId, f)
      }
    }
    return [...latest.values()]
  }

  const findingsAsOf = computed<Finding[]>(() => worstPerElementUpTo(asOfDate.value))

  /** Índice de condición 0–100 a partir de un set de hallazgos y total de elementos. */
  function scoreFrom(fs: Finding[], nEls: number): number {
    if (!nEls) return 0
    const worst = worstSeverity(fs)
    const affected = fs.length / nEls
    return Math.round(((worst / 4) * 0.75 + affected * 0.25) * 100)
  }

  /** Mapa elementId → severidad vigente a la fecha de corte (para colorear el 3D). */
  const severityByElement = computed<Record<string, Severity>>(() => {
    const map: Record<string, Severity> = {}
    for (const f of findingsAsOf.value) {
      map[f.elementId] = f.severity > (map[f.elementId] ?? 0) ? f.severity : map[f.elementId] ?? f.severity
    }
    return map
  })

  /** Todos los hallazgos de la campaña seleccionada (para el listado del panel). */
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

  /** Índice de condición global de la estructura (0 sano → 100 crítico). */
  const structureCondition = computed(() =>
    scoreFrom(findingsAsOf.value, activeStructure.value?.elements.length ?? 0),
  )

  /** Condición semáforo (operativa/observación/crítica) derivada del índice. */
  const structureConditionKey = computed(() => conditionFromScore(structureCondition.value))

  /** Condición por campaña de inspección — comparación entre visitas periódicas. */
  const conditionByCampaign = computed(() => {
    const nEls = activeStructure.value?.elements.length ?? 0
    return structureInspections.value.map((insp) => {
      const score = scoreFrom(worstPerElementUpTo(insp.date), nEls)
      return { id: insp.id, date: insp.date, score, key: conditionFromScore(score) }
    })
  })

  /** Conteo de elementos afectados por severidad (1–4), a la fecha del timeline. */
  const severityCounts = computed<Record<Severity, number>>(() => {
    const c: Record<Severity, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const [, sev] of Object.entries(severityByElement.value)) c[sev as Severity]++
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
  }

  function selectElement(id: string | null) {
    selectedElementId.value = id
  }

  function setView(v: 'twin' | 'results') {
    activeView.value = v
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
    elementId: string
    damageType: Finding['damageType']
    severity: Severity
    extension: number
    pin: Vec3
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
    authUser,
    syncing,
    lastSyncAt,
    syncMessage,
    // getters
    activeStructure,
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
    conditionByCampaign,
    severityCounts,
    currentTests,
    // acciones
    init,
    reload,
    selectStructure,
    selectElement,
    setView,
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
