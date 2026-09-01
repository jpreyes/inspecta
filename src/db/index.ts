import Dexie, { type EntityTable } from 'dexie'
import type { Finding, Inspection, Project, Structure, Test } from '../types/inspection'

import {
  seedFindings,
  seedInspections,
  seedProjects,
  seedStructures,
  seedTests,
} from '../data/seed'

/** El archivo del gemelo 3D (IFC o glTF), cacheado en el dispositivo.
 *  Va en su propia tabla y no dentro de `structures` porque son megabytes:
 *  metido en el registro de la estructura, cada lectura del árbol lateral
 *  arrastraría el modelo entero desde IndexedDB. */
export interface StoredModel {
  /** id de la estructura dueña */
  structureId: string
  blob: Blob
  fileName: string
  kind: 'ifc' | 'gltf'
  updatedAt: string
}

// Base offline-first: todo vive en IndexedDB para trabajo en terreno sin señal.
export const db = new Dexie('inspecta') as Dexie & {
  projects: EntityTable<Project, 'id'>
  structures: EntityTable<Structure, 'id'>
  inspections: EntityTable<Inspection, 'id'>
  findings: EntityTable<Finding, 'id'>
  tests: EntityTable<Test, 'id'>
  models: EntityTable<StoredModel, 'structureId'>
}

db.version(1).stores({
  projects: 'id, name',
  structures: 'id, projectId',
  inspections: 'id, structureId, date',
  findings: 'id, inspectionId, elementId',
})

// v2: agrega ensayos (tests)
db.version(2).stores({
  tests: 'id, inspectionId',
})

// v3: equipos. Se indexa `teamId` para poder filtrar por equipo sin recorrer
// toda la tabla. Los registros previos quedan sin teamId (personales), que es
// exactamente el modo local — no requieren migración de datos.
db.version(3).stores({
  projects: 'id, name, teamId',
  structures: 'id, projectId, teamId',
  inspections: 'id, structureId, date, teamId',
  findings: 'id, inspectionId, elementId, teamId',
  tests: 'id, inspectionId, teamId',
})

// v4: archivos de modelo 3D importado (IFC/glTF). Solo la clave: el blob no se
// indexa (no tendría sentido y ocuparía el doble).
db.version(4).stores({
  models: 'structureId',
})

/** Siembra cada tabla que esté vacía (robusto ante bases ya creadas). */
export async function seedIfEmpty() {
  if ((await db.projects.count()) === 0) await db.projects.bulkAdd(seedProjects)
  if ((await db.structures.count()) === 0) await db.structures.bulkAdd(seedStructures)
  if ((await db.inspections.count()) === 0) await db.inspections.bulkAdd(seedInspections)
  if ((await db.findings.count()) === 0) await db.findings.bulkAdd(seedFindings)
  if ((await db.tests.count()) === 0) await db.tests.bulkAdd(seedTests)
}
