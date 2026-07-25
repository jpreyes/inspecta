import Dexie, { type EntityTable } from 'dexie'
import type { Finding, Inspection, Project, Structure, Test } from '../types/inspection'
import {
  seedFindings,
  seedInspections,
  seedProjects,
  seedStructures,
  seedTests,
} from '../data/seed'

// Base offline-first: todo vive en IndexedDB para trabajo en terreno sin señal.
export const db = new Dexie('inspecta') as Dexie & {
  projects: EntityTable<Project, 'id'>
  structures: EntityTable<Structure, 'id'>
  inspections: EntityTable<Inspection, 'id'>
  findings: EntityTable<Finding, 'id'>
  tests: EntityTable<Test, 'id'>
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

/** Siembra cada tabla que esté vacía (robusto ante bases ya creadas). */
export async function seedIfEmpty() {
  if ((await db.projects.count()) === 0) await db.projects.bulkAdd(seedProjects)
  if ((await db.structures.count()) === 0) await db.structures.bulkAdd(seedStructures)
  if ((await db.inspections.count()) === 0) await db.inspections.bulkAdd(seedInspections)
  if ((await db.findings.count()) === 0) await db.findings.bulkAdd(seedFindings)
  if ((await db.tests.count()) === 0) await db.tests.bulkAdd(seedTests)
}
