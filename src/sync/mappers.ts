import type { Finding, Inspection, Project, Structure, Test, Vec3 } from '../types/inspection'
import { generateFrame } from '../data/generate'
import { backend } from './backend'

// Mapeo entre el modelo local (Dexie) y los registros de PocketBase.
// Diferencias: nombres de campos (snake_case), relaciones por id, y en las
// estructuras NO se guardan los elementos (se regeneran desde la grilla).

type Remote = Record<string, unknown>

// ── local → remoto (para push) ──────────────────────────────

export function projectToRemote(p: Project, owner: string): Remote {
  return {
    id: p.id,
    name: p.name,
    client: p.client ?? '',
    lat: p.location?.lat ?? null,
    lng: p.location?.lng ?? null,
    address: p.location?.address ?? '',
    owner,
  }
}

export function structureToRemote(s: Structure, owner: string): Remote {
  return { id: s.id, project: s.projectId, name: s.name, stype: s.type, grid: s.grid, owner }
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
    owner,
  }
}

/** OJO: no incluye `photos` (archivos) — se suben aparte con uploadPhoto. */
export function findingToRemote(f: Finding, owner: string): Remote {
  return {
    id: f.id,
    inspection: f.inspectionId,
    element_id: f.elementId,
    damage_type: f.damageType,
    severity: f.severity,
    extension: f.extension,
    pin: f.pin,
    notes: f.notes ?? '',
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
    owner,
  }
}

// ── remoto → local (para pull) ──────────────────────────────

export function projectFromRemote(r: any): Project {
  const hasLoc = r.lat != null || r.lng != null || r.address
  return {
    id: r.id,
    name: r.name,
    client: r.client || undefined,
    location: hasLoc ? { lat: r.lat ?? 0, lng: r.lng ?? 0, address: r.address || undefined } : undefined,
    createdAt: r.created,
  }
}

export function structureFromRemote(r: any): Structure {
  const grid = r.grid as Structure['grid']
  return {
    id: r.id,
    projectId: r.project,
    name: r.name,
    type: r.stype,
    grid,
    elements: generateFrame(grid), // regenerados desde la grilla
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
  }
}

export function findingFromRemote(r: any): Finding {
  const filenames: string[] = Array.isArray(r.photos) ? r.photos : []
  return {
    id: r.id,
    inspectionId: r.inspection,
    elementId: r.element_id,
    damageType: r.damage_type,
    severity: r.severity,
    extension: r.extension,
    pin: r.pin as Vec3,
    notes: r.notes || undefined,
    photos: filenames.map((fn) => ({
      id: fn,
      remoteName: fn,
      url: backend.fileUrl(r, fn),
      takenAt: r.created,
    })),
    createdAt: r.created,
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
  }
}
