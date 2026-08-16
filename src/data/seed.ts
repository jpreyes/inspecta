import type { Element, Finding, Inspection, Project, Structure, Test } from '../types/inspection'
import { generateFrame } from './generate'

// IDs de 15 caracteres [a-z0-9] → compatibles con los record ids de PocketBase,
// para que el mismo id sirva local (Dexie) y remoto (sync) sin remapear.
const PRJ = 'prjdemoaulario1'
const STR = 'strdemobloquea1'
const INSP1 = 'inspdemomarzo01'
const INSP2 = 'inspdemojunio02'
// Estructura SIN modelo 3D (puente) — solo lista/jerarquía de elementos.
const STR2 = 'strdemopuente01'
const INSP3 = 'inspdemopuen001'

// Proyecto demo — edificio de HA de 3 pisos en Valdivia
export const seedProjects: Project[] = [
  {
    id: PRJ,
    name: 'Edificio Aulario UACh',
    client: 'Universidad Austral de Chile',
    location: { lat: -39.8142, lng: -73.2459, address: 'Isla Teja, Valdivia' },
    createdAt: '2025-01-15T12:00:00Z',
  },
]

const grid = { baysX: 3, baysZ: 2, stories: 3, bayX: 6, bayZ: 5, storyH: 3.2 }

// Elementos de un puente definidos a mano (sin geometría 3D).
const bridgeElements: Element[] = [
  { id: 'P1', tag: 'Pila P1', type: 'fundacion', story: 1 },
  { id: 'P2', tag: 'Pila P2', type: 'fundacion', story: 1 },
  { id: 'E1', tag: 'Estribo E1', type: 'fundacion', story: 1 },
  { id: 'E2', tag: 'Estribo E2', type: 'fundacion', story: 1 },
  { id: 'V1', tag: 'Tablero · Vano 1', type: 'losa', story: 2 },
  { id: 'V2', tag: 'Tablero · Vano 2', type: 'losa', story: 2 },
]

export const seedStructures: Structure[] = [
  {
    id: STR,
    projectId: PRJ,
    name: 'Bloque A · Pórtico principal',
    type: 'edificio',
    grid,
    elements: generateFrame(grid),
  },
  {
    // Sin `grid` → sin modelo 3D. Se inspecciona por lista/jerarquía.
    id: STR2,
    projectId: PRJ,
    name: 'Puente Río Cruces (sin modelo 3D)',
    type: 'puente',
    elements: bridgeElements,
  },
]

// Dos campañas de inspección periódicas → permiten comparar la evolución entre visitas
export const seedInspections: Inspection[] = [
  {
    id: INSP1,
    structureId: STR,
    date: '2025-03-10',
    inspector: 'J. Reyes',
    weather: 'Nublado, 12°C',
    summary: 'Inspección inicial post-sismo Mw 5.4.',
  },
  {
    id: INSP2,
    structureId: STR,
    date: '2025-06-22',
    inspector: 'J. Reyes',
    weather: 'Lluvia leve',
    summary: 'Seguimiento a 3 meses. Progresión de fisuras en nivel 1.',
  },
  {
    id: INSP3,
    structureId: STR2,
    date: '2025-05-05',
    inspector: 'J. Reyes',
    weather: 'Despejado',
    summary: 'Inspección de puente sin modelo 3D — registro por lista de elementos.',
  },
]

export const seedTests: Test[] = [
  {
    id: 'tstdemoesclerm1',
    inspectionId: INSP2,
    testType: 'Esclerometría',
    method: 'Índice de rebote (martillo Schmidt)',
    standard: 'NCh1565 / ASTM C805',
    executedAt: '2025-06-22',
    laboratory: 'LEMCO UACh',
    sampleLocation: 'C-A1-N1',
    resultSummary: "f'c estimado 24 MPa (rebote medio 38)",
    createdAt: '2025-06-22T11:00:00Z',
  },
  {
    id: 'tstdemocarbon02',
    inspectionId: INSP2,
    testType: 'Carbonatación',
    method: 'Fenolftaleína',
    standard: 'UNE-EN 14630',
    executedAt: '2025-06-22',
    laboratory: 'LEMCO UACh',
    sampleLocation: 'C-B2-N1',
    resultSummary: 'Frente de carbonatación 18 mm — supera recubrimiento en zona dañada',
    createdAt: '2025-06-22T11:30:00Z',
  },
]

const now = '2025-06-22T10:00:00Z'

const HA = 'Hormigón armado'
export const seedFindings: Finding[] = [
  // Campaña 1
  {
    id: 'fnddemofisura01',
    inspectionId: INSP1,
    component: 'Pilares y columnas',
    element: 'Columna / Pilar',
    material: HA,
    zone: 'Base',
    elementId: 'C-A1-N1',
    damageType: 'Fisuras',
    cause: 'retracción del hormigón',
    severity: 1,
    extension: 15,
    pin: { x: -9, y: 1.6, z: -5 },
    notes: 'Fisura vertical fina en base de columna, ~0.2 mm.',
    photos: [],
    createdAt: '2025-03-10T09:30:00Z',
  },
  {
    id: 'fnddemodeflex02',
    inspectionId: INSP1,
    component: 'Vigas y cadenas',
    element: 'Viga',
    material: HA,
    zone: 'Centro de vano',
    elementId: 'VX-A1-N1',
    damageType: 'Deformación / flecha excesiva',
    cause: 'sobrecarga',
    severity: 2,
    extension: 40,
    pin: { x: -6, y: 3.2, z: -5 },
    notes: 'Deflexión perceptible a media luz.',
    photos: [],
    createdAt: '2025-03-10T09:45:00Z',
  },
  // Campaña 2 — progresión
  {
    id: 'fnddemogrieta03',
    inspectionId: INSP2,
    component: 'Pilares y columnas',
    element: 'Columna / Pilar',
    material: HA,
    zone: 'Base',
    elementId: 'C-A1-N1',
    damageType: 'Grietas',
    cause: 'acción sísmica',
    severity: 3,
    extension: 35,
    pin: { x: -9, y: 1.2, z: -5 },
    notes: 'La fisura evolucionó a grieta diagonal, ~1.5 mm. Requiere seguimiento.',
    photos: [],
    createdAt: now,
  },
  {
    id: 'fnddemoarmad004',
    inspectionId: INSP2,
    component: 'Pilares y columnas',
    element: 'Columna / Pilar',
    material: HA,
    zone: 'Base',
    elementId: 'C-B2-N1',
    damageType: 'Descascaramiento con armadura a la vista',
    cause: 'corrosión de armaduras',
    severity: 4,
    extension: 20,
    pin: { x: -3, y: 1.0, z: 0 },
    notes: 'Descascaramiento con armadura expuesta y corrosión incipiente.',
    photos: [],
    createdAt: now,
  },
  {
    id: 'fnddemodeflex05',
    inspectionId: INSP2,
    component: 'Vigas y cadenas',
    element: 'Viga',
    material: HA,
    zone: 'Centro de vano',
    elementId: 'VX-A1-N1',
    damageType: 'Deformación / flecha excesiva',
    cause: 'sobrecarga',
    severity: 2,
    extension: 45,
    pin: { x: -6, y: 3.2, z: -5 },
    notes: 'Deflexión estable respecto a campaña anterior.',
    photos: [],
    createdAt: now,
  },
  // Puente (sin 3D)
  {
    id: 'fnddemopila0001',
    inspectionId: INSP3,
    component: 'Cepa',
    element: 'Columnas',
    material: HA,
    zone: 'Fuste/tercio central',
    damageType: 'Fisuras',
    cause: 'acción sísmica',
    severity: 3,
    extension: 30,
    notes: 'Grieta vertical en fuste de pila, ~2 mm, con eflorescencia.',
    photos: [],
    createdAt: '2025-05-05T10:00:00Z',
  },
  {
    id: 'fnddemoestrib02',
    inspectionId: INSP3,
    component: 'Estribo',
    element: 'Fundación',
    material: HA,
    zone: 'Cara lateral',
    damageType: 'Humedades',
    cause: 'impermeabilización defectuosa',
    severity: 2,
    extension: 50,
    notes: 'Filtración y humedad en estribo, arrastre de finos.',
    photos: [],
    createdAt: '2025-05-05T10:20:00Z',
  },
]

// ── Marca de "dato de demostración" ──────────────────────────
// Los ids de arriba son fijos, así que son los MISMOS en el dispositivo de cada
// usuario. Subirlos al servidor no solo lo ensucia: el segundo usuario que
// sincronizara chocaría contra un id ya tomado por el primero. El motor de sync
// los reconoce por esta lista y no los envía nunca (ver src/sync/engine.ts).
export const DEMO_IDS: ReadonlySet<string> = new Set<string>([
  ...seedProjects.map((p) => p.id),
  ...seedStructures.map((s) => s.id),
  ...seedInspections.map((i) => i.id),
  ...seedFindings.map((f) => f.id),
  ...seedTests.map((t) => t.id),
])

/** ¿Este registro viene de la siembra demo (y por lo tanto es solo local)? */
export function isDemoRecord(id: string): boolean {
  return DEMO_IDS.has(id)
}
