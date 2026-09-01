import type { Finding, Inspection, Project, Structure, Test, Vec3 } from '../types/inspection'
import { isNonStructural } from '../types/inspection'
import { generateFrame } from '../data/generate'
import { backend } from './backend'

// Mapeo entre el modelo local (Dexie) y los registros de PocketBase.
// Diferencias: nombres de campos (snake_case), relaciones por id, y en las
// estructuras NO se guardan los elementos (se regeneran desde la grilla).

type Remote = Record<string, unknown>

/**
 * PocketBase espera '' (no null/undefined) para una relación vacía.
 *
 * OJO con `team` y `author`: al CREAR hay que mandarlos aunque estén vacíos
 * (la regla de creación compara `@request.body.team = ""`), pero al ACTUALIZAR
 * no — un dispositivo cuya copia local no conoce el equipo le borraría el
 * equipo al registro del servidor. Eso no se resuelve acá sino en
 * `backend.push`, que es quien sabe si está creando o actualizando.
 */
const rel = (id?: string) => id ?? ''

// ── local → remoto (para push) ──────────────────────────────

export function projectToRemote(p: Project, owner: string): Remote {
  return {
    id: p.id,
    name: p.name,
    client: p.client ?? '',
    lat: p.location?.lat ?? null,
    lng: p.location?.lng ?? null,
    address: p.location?.address ?? '',
    team: rel(p.teamId),
    owner,
  }
}

export function structureToRemote(s: Structure, owner: string): Remote {
  return {
    id: s.id,
    project: s.projectId,
    name: s.name,
    stype: s.type,
    grid: s.grid ?? null,
    elements: s.elements, // persistimos la lista (necesario para estructuras sin modelo 3D)
    vulnerability: s.vulnerability ?? {},
    site: s.site ?? {},
    // Metadato del gemelo importado. El ARCHIVO no va acá: se sube aparte con
    // `uploadModel`, igual que las fotos de los hallazgos.
    model_meta: s.model ? { ...s.model, remoteName: undefined } : null,
    team: rel(s.teamId),
    inspectors: s.inspectorIds ?? [],
    owner,
  }
}

export function inspectionToRemote(i: Inspection, owner: string, conditionScore?: number): Remote {
  return {
    id: i.id,
    structure: i.structureId,
    date: i.date,
    inspector: i.inspector,
    weather: i.weather ?? '',
    summary: i.summary ?? '',
    condition_score: conditionScore ?? null,
    team: rel(i.teamId),
    author: rel(i.authorId),
    owner,
  }
}

/** OJO: no incluye `photos` (archivos) — se suben aparte con uploadPhoto. */
export function findingToRemote(f: Finding, owner: string): Remote {
  return {
    id: f.id,
    inspection: f.inspectionId,
    component: f.component ?? '',
    element: f.element,
    material: f.material ?? '',
    zone: f.zone ?? '',
    element_id: f.elementId ?? '',
    damage_type: f.damageType,
    cause: f.cause ?? '',
    severity: f.severity,
    extension: f.extension,
    pin: f.pin ?? null,
    non_structural: isNonStructural(f),
    notes: f.notes ?? '',
    team: rel(f.teamId),
    author: rel(f.authorId),
    owner,
  }
}

export function testToRemote(t: Test, owner: string): Remote {
  return {
    id: t.id,
    inspection: t.inspectionId,
    test_type: t.testType,
    method: t.method ?? '',
    standard: t.standard ?? '',
    executed_at: t.executedAt,
    laboratory: t.laboratory ?? '',
    sample_location: t.sampleLocation ?? '',
    result_summary: t.resultSummary,
    team: rel(t.teamId),
    author: rel(t.authorId),
    owner,
  }
}

// ── remoto → local (para pull) ──────────────────────────────

/** Nombre visible del autor expandido (`expand.author`). PocketBase oculta el
 *  email de otros usuarios, así que se prefiere `name`. */
function authorName(r: any): string | undefined {
  const a = r?.expand?.author
  if (!a) return undefined
  return a.name || a.email || undefined
}

export function projectFromRemote(r: any): Project {
  const hasLoc = r.lat != null || r.lng != null || r.address
  return {
    id: r.id,
    name: r.name,
    client: r.client || undefined,
    location: hasLoc ? { lat: r.lat ?? 0, lng: r.lng ?? 0, address: r.address || undefined } : undefined,
    createdAt: r.created,
    teamId: r.team || undefined,
  }
}

/** Metadato del gemelo importado + el nombre del archivo tal como quedó en
 *  PocketBase. Sin archivo no hay modelo, aunque el metadato haya sobrevivido. */
function modelFromRemote(r: any): Structure['model'] {
  const meta = r.model_meta
  const file = Array.isArray(r.model) ? r.model[0] : r.model
  if (!file || !meta || typeof meta !== 'object') return undefined
  return {
    kind: meta.kind === 'ifc' ? 'ifc' : 'gltf',
    fileName: String(meta.fileName ?? file),
    remoteName: String(file),
    importedAt: String(meta.importedAt ?? r.updated ?? ''),
    elementCount: Number(meta.elementCount) || 0,
  }
}

export function structureFromRemote(r: any): Structure {
  const grid = (r.grid || undefined) as Structure['grid']
  const stored = Array.isArray(r.elements) ? (r.elements as Structure['elements']) : []
  const vuln = r.vulnerability && typeof r.vulnerability === 'object' ? r.vulnerability : undefined
  const site = r.site && typeof r.site === 'object' && Object.keys(r.site).length ? r.site : undefined
  return {
    id: r.id,
    projectId: r.project,
    name: r.name,
    type: r.stype,
    grid,
    // usa la lista guardada; si no hay y sí hay grilla, la regenera
    elements: stored.length ? stored : grid ? generateFrame(grid) : [],
    // El metadato del modelo se combina con el nombre real del archivo en
    // PocketBase (`r.model`), que es lo que permite bajarlo después.
    model: modelFromRemote(r),
    vulnerability: vuln,
    site,
    teamId: r.team || undefined,
    // Igual que las listas de rol del equipo: arreglo normalmente, valor suelto
    // si la relación quedó declarada como simple (ver migración 1721000400).
    inspectorIds: Array.isArray(r.inspectors)
      ? r.inspectors
      : typeof r.inspectors === 'string' && r.inspectors
        ? [r.inspectors]
        : undefined,
  }
}

export function inspectionFromRemote(r: any): Inspection {
  return {
    id: r.id,
    structureId: r.structure,
    date: r.date,
    inspector: r.inspector,
    weather: r.weather || undefined,
    summary: r.summary || undefined,
    teamId: r.team || undefined,
    authorId: r.author || undefined,
    authorName: authorName(r),
  }
}

export function findingFromRemote(r: any): Finding {
  const filenames: string[] = Array.isArray(r.photos) ? r.photos : []
  return {
    id: r.id,
    inspectionId: r.inspection,
    component: r.component || undefined,
    element: r.element || '',
    material: r.material || undefined,
    zone: r.zone || undefined,
    elementId: r.element_id || undefined,
    damageType: r.damage_type,
    cause: r.cause || undefined,
    severity: r.severity,
    extension: r.extension,
    pin: (r.pin as Vec3) || undefined,
    nonStructural: r.non_structural ? true : undefined,
    notes: r.notes || undefined,
    photos: filenames.map((fn) => ({
      id: fn,
      remoteName: fn,
      url: backend.fileUrl(r, fn),
      takenAt: r.created,
    })),
    createdAt: r.created,
    teamId: r.team || undefined,
    authorId: r.author || undefined,
    authorName: authorName(r),
  }
}

export function testFromRemote(r: any): Test {
  return {
    id: r.id,
    inspectionId: r.inspection,
    testType: r.test_type,
    method: r.method || undefined,
    standard: r.standard || undefined,
    executedAt: r.executed_at,
    laboratory: r.laboratory || undefined,
    sampleLocation: r.sample_location || undefined,
    resultSummary: r.result_summary,
    createdAt: r.created,
    teamId: r.team || undefined,
    authorId: r.author || undefined,
    authorName: authorName(r),
  }
}
