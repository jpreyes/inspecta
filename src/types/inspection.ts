// ─────────────────────────────────────────────────────────────
// Modelo de dominio · Inspecciones estructurales
// Jerarquía:  Proyecto ▸ Estructura ▸ Elemento ▸ (Inspección ▸ Hallazgo)
// ─────────────────────────────────────────────────────────────
import { CATALOG, type CatalogElement, type StructureCatalog } from '../data/catalog'

export { CATALOG, MATERIALS } from '../data/catalog'
export type { CatalogElement, CatalogComponent, CatalogDamage, StructureCatalog } from '../data/catalog'

/** Severidad 0–4, alineada con el gauge de estado de ReWind (wind-shm). */
export type Severity = 0 | 1 | 2 | 3 | 4

export interface SeverityMeta {
  level: Severity
  label: string
  /** color hex usado tanto en UI como en el gemelo 3D */
  color: string
}

export const SEVERITY: Record<Severity, SeverityMeta> = {
  0: { level: 0, label: 'Sin daño', color: '#22c55e' },
  1: { level: 1, label: 'Leve', color: '#84cc16' },
  2: { level: 2, label: 'Moderado', color: '#eab308' },
  3: { level: 3, label: 'Severo', color: '#f97316' },
  4: { level: 4, label: 'Crítico', color: '#ef4444' },
}

// ── Consulta del catálogo (por tipo de estructura) ──────────
// El catálogo (componentes → elementos → materiales/zonas, deterioros, causas)
// vive en src/data/catalog.ts. "Otro" en cada campo permite texto libre.

/** Catálogo aplicable al tipo de estructura (fallback: edificio). */
export function catalogFor(type?: string): StructureCatalog {
  return (type && CATALOG[type]) || CATALOG.edificio
}
/** Info (materiales + zonas) de un elemento del catálogo. */
export function elementInfo(cat: StructureCatalog, element: string): CatalogElement | undefined {
  for (const c of cat.components) {
    const e = c.elements.find((x) => x.element === element)
    if (e) return e
  }
  return undefined
}
/** Deterioros aplicables a un material (o todos si no se indica). */
export function damagesForMaterial(cat: StructureCatalog, material?: string) {
  if (!material) return cat.damages
  return cat.damages.filter(
    (d) => d.materials.includes('todos') || d.materials.some((m) => material.includes(m) || m.includes(material)),
  )
}
/** Causas probables de un deterioro. */
export function causesForDamage(cat: StructureCatalog, damage: string): string[] {
  return cat.causesByDamage[damage] ?? []
}

export type ElementType = 'columna' | 'viga' | 'losa' | 'muro' | 'nudo' | 'fundacion'

export type StructureType = 'edificio' | 'puente' | 'nave' | 'torre'

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Un elemento estructural discreto dentro de una estructura.
 *  `position`/`size` solo existen si la estructura tiene modelo 3D; sin modelo,
 *  el elemento vive igual en la jerarquía (tag + tipo + nivel). */
export interface Element {
  id: string
  tag: string // ej. "C-A1-N2" (columna, eje A1, nivel 2)
  type: ElementType
  /** centro del elemento en coordenadas locales (m) — solo con modelo 3D */
  position?: Vec3
  /** dimensiones de la caja en el gemelo 3D (m) — solo con modelo 3D */
  size?: Vec3
  story?: number
}

export interface Structure {
  id: string
  projectId: string
  name: string
  type: StructureType
  /** parámetros del generador paramétrico del gemelo 3D. Opcional: si no hay,
   *  la estructura no tiene modelo 3D y se trabaja solo por lista/jerarquía. */
  grid?: {
    baysX: number
    baysZ: number
    stories: number
    bayX: number // ancho de vano en X (m)
    bayZ: number // ancho de vano en Z (m)
    storyH: number // altura de piso (m)
  }
  elements: Element[]
}

/** ¿La estructura tiene modelo 3D (geometría) para el gemelo digital? */
export function hasModel(s: Structure | null | undefined): boolean {
  return !!s?.grid && s.elements.some((e) => e.position && e.size)
}

export interface Project {
  id: string
  name: string
  client?: string
  location?: { lat: number; lng: number; address?: string }
  createdAt: string
}

/** Foto asociada a un hallazgo. Offline: `dataUrl` (base64). Tras sincronizar:
 *  `remoteName` (nombre del archivo en PocketBase) y `url` (para mostrar online). */
export interface Photo {
  id: string
  dataUrl?: string
  url?: string
  remoteName?: string
  caption?: string
  takenAt: string
}

/** Un hallazgo puntual sobre un elemento, en una inspección dada. */
export interface Finding {
  id: string
  inspectionId: string
  /** Componente estructural (catálogo). Ej. "Vigas y cadenas". */
  component?: string
  /** Elemento (catálogo, o texto libre si "Otro"). Ej. "Viga". */
  element: string
  /** Material del elemento (catálogo). Ej. "Hormigón armado". */
  material?: string
  /** Zona/ubicación dentro del elemento (catálogo, o libre). Ej. "Fondo de viga". */
  zone?: string
  /** Elemento del modelo 3D vinculado (opcional; para colorear el gemelo). */
  elementId?: string
  /** Tipo de daño / deterioro (catálogo). */
  damageType: string
  /** Causa del daño (opcional). */
  cause?: string
  severity: Severity
  /** extensión afectada del elemento, 0–100 % */
  extension: number
  /** posición del pin sobre la superficie del elemento (coords mundo) — solo con 3D */
  pin?: Vec3
  notes?: string
  photos: Photo[]
  createdAt: string
}

/** Una campaña de inspección periódica (una visita a terreno con su fecha). */
export interface Inspection {
  id: string
  structureId: string
  date: string // ISO — fecha de la visita
  inspector: string
  weather?: string
  summary?: string
}

/** Ensayo de material / campo asociado a una campaña (esclerometría, testigos…). */
export interface Test {
  id: string
  inspectionId: string
  testType: string // ej. "Esclerometría"
  method?: string // ej. "Índice de rebote"
  standard?: string // norma, ej. "NCh1565 / ASTM C805"
  executedAt: string // ISO date
  laboratory?: string
  sampleLocation?: string // elementId o descripción
  resultSummary: string // ej. "f'c estimado 24 MPa"
  createdAt: string
}

export const CONDITION = {
  operativa: { label: 'Operativa', color: '#22c55e' },
  observacion: { label: 'Con observaciones', color: '#eab308' },
  critica: { label: 'Crítica', color: '#ef4444' },
} as const
export type ConditionKey = keyof typeof CONDITION

/** Deriva la condición global (semáforo) desde el índice de condición 0–100. */
export function conditionFromScore(score: number): ConditionKey {
  if (score >= 60) return 'critica'
  if (score >= 25) return 'observacion'
  return 'operativa'
}

// ── Scoring determinístico ponderado ─────────────────────────
// La calificación depende de: severidad, extensión, tipo de daño, elemento,
// zona en el elemento, causa y cantidad de deterioros. Cada dimensión aporta
// un peso; entradas "Otro"/desconocidas usan el peso neutro DEFAULT_WEIGHT.
// Los pesos son calibrables (mayor = más crítico).

const DEFAULT_WEIGHT = 1.0

/** Peso por tipo de daño/deterioro (mayor = más grave). Claves = nombres del
 *  catálogo; desconocidos usan DEFAULT_WEIGHT. */
export const DAMAGE_TYPE_WEIGHT: Record<string, number> = {
  Fisuras: 0.95,
  Grietas: 1.3,
  'Grietas 5mm': 1.35,
  'Fisuras en mapa o retícula': 1.0,
  'Descascaramiento sin armadura a la vista': 1.1,
  'Descascaramiento con armadura a la vista': 1.35,
  'Armadura a la vista': 1.3,
  'Corrosión de armaduras/acero': 1.25,
  Corrosión: 1.2,
  'Mancha de óxido': 1.0,
  'Coqueras / nidos de grava': 1.1,
  'Humedades / filtraciones': 1.0,
  Humedades: 1.0,
  Eflorescencias: 0.85,
  'Deformación / flecha excesiva': 1.25,
  Deformación: 1.25,
  'Falta de alineación / desplome': 1.15,
  'Falta de alineación': 1.15,
  'Disgregación / pulverización': 1.15,
  'Aplastamiento (albañilería)': 1.35,
  'Pandeo local': 1.3,
  Abolladura: 1.1,
  'Pérdida de mortero de junta': 1.05,
  'Pérdida de tratamiento protector': 0.9,
  'Pudrición / xilófagos': 1.3,
  'Deterioro de soldadura / conexión': 1.35,
  'Pérdida / aflojamiento de pernos y anclajes': 1.3,
  'Pérdida de tornillos roblones anclajes': 1.3,
  Rotura: 1.35,
  Desplazamiento: 1.2,
  Descalce: 1.3,
  Carcavas: 1.0,
  Lajación: 1.0,
  Aterramiento: 0.9,
  'Alteración superficial': 0.85,
  'Vegetación / biológico': 0.8,
  Vegetación: 0.8,
  Pintadas: 0.7,
}

/** Peso por causa. Claves = nombres del catálogo; desconocidas = DEFAULT_WEIGHT. */
export const CAUSE_WEIGHT: Record<string, number> = {
  'acción sísmica': 1.3,
  'asiento diferencial': 1.2,
  'sobrecarga gravitacional': 1.2,
  sobrecarga: 1.15,
  'sobrecarga (compresión)': 1.2,
  'esfuerzos (corte)': 1.2,
  'esfuerzos (flexión)': 1.15,
  esfuerzos: 1.15,
  'esfuerzos (compresión)': 1.15,
  'corrosión de armaduras': 1.2,
  corrosión: 1.15,
  carbonatación: 1.15,
  'ataque de cloruros': 1.15,
  'ataque químico': 1.1,
  'empuje de terreno': 1.15,
  'deficiente diseño': 1.2,
  infradimensionamiento: 1.2,
  'infradimensionamiento del elemento': 1.2,
  'deficiente ejecución': 1.05,
  'escasez de recubrimiento': 1.1,
  fatiga: 1.15,
  'esfuerzos cíclicos': 1.1,
  'humedad/filtración': 1.0,
  humedad: 1.0,
  'impermeabilización defectuosa': 1.0,
  envejecimiento: 0.9,
  'acción climática': 0.9,
  abrasión: 0.9,
  vandalismo: 0.7,
  'sedimentación orgánica': 0.8,
  'causa desconocida': 1.0,
}

/** Peso por elemento (importancia estructural). Claves del catálogo. */
export const ELEMENT_WEIGHT: Record<string, number> = {
  // edificación
  'Columna / Pilar': 1.3,
  'Muro estructural / de corte': 1.2,
  'Muro de albañilería confinada': 1.15,
  'Muro de albañilería armada': 1.15,
  Machón: 1.15,
  Viga: 1.2,
  Cadena: 1.05,
  Dintel: 1.1,
  Losa: 1.1,
  'Losa colaborante': 1.1,
  Vigueta: 1.05,
  'Voladizo / balcón': 1.2,
  'Nudo viga-columna': 1.3,
  Anclaje: 1.25,
  'Conexión soldada': 1.2,
  'Conexión apernada': 1.2,
  'Empalme de armadura': 1.15,
  'Zapata aislada': 1.3,
  'Zapata corrida': 1.25,
  'Viga de fundación': 1.25,
  'Losa de fundación (radier)': 1.15,
  Pilote: 1.3,
  'Cabezal de pilotes': 1.25,
  Sobrecimiento: 1.1,
  'Muro de subterráneo': 1.2,
  Cercha: 1.2,
  'Viga de techo': 1.1,
  'Losa de escalera': 1.1,
  'Zanca / viga de escalera': 1.1,
  Tabique: 0.9,
  'Antepecho / parapeto': 0.9,
  // puentes
  Columnas: 1.3,
  Fundación: 1.3,
  Vigas: 1.2,
  Longuerina: 1.2,
  'Aparato de apoyo': 1.2,
  'Cabezal superior': 1.2,
  'Cabezal inferior': 1.2,
  Diagonal: 1.1,
  Montante: 1.1,
  Voladizo: 1.2,
  Contraventación: 1.1,
  'Muro frontal portante': 1.2,
  Alas: 1.0,
  Guardalastres: 0.95,
  'Anclaje de pretensado': 1.25,
  'Anclaje / placa base': 1.2,
}

/** Peso por zona/ubicación dentro del elemento (zonas críticas > cosméticas). */
export const ZONE_WEIGHT: Record<string, number> = {
  'Unión / nudo': 1.2,
  Nudo: 1.2,
  'Nudo viga-columna': 1.25,
  'Núcleo del nudo': 1.25,
  'Apoyo / extremo': 1.15,
  'Apoyo/extremo': 1.15,
  Apoyo: 1.15,
  Base: 1.15,
  Empalme: 1.15,
  'Anclaje / placa base': 1.2,
  'Anclaje de pretensado': 1.2,
  'Anclaje de conexión': 1.15,
  'Placa base': 1.2,
  'Perno de anclaje': 1.15,
  'Cordón de soldadura': 1.2,
  'Conexión metálica': 1.2,
  'Conexión de corte': 1.15,
  'Cabeza/capitel': 1.15,
  'Cabeza / capitel': 1.15,
  'Fondo de viga': 1.1,
  Empotramiento: 1.2,
  Zapata: 1.2,
  'Viga de fundación': 1.2,
  'Encuentro / esquina': 1.15,
  'Encuentro/esquina': 1.15,
  Junta: 1.1,
  'Junta de dilatación': 1.1,
  'Borde / perímetro': 1.05,
  'Borde/perímetro': 1.05,
  Coronación: 1.05,
  Descalce: 1.2,
  'Cara lateral': 0.95,
  'Cara superior': 0.95,
}

function weightOf(map: Record<string, number>, key?: string): number {
  if (!key) return DEFAULT_WEIGHT
  return map[key] ?? DEFAULT_WEIGHT
}

/**
 * Índice/calificación de un hallazgo (0 sano → 100 crítico), combinando
 * severidad × extensión × pesos (tipo, elemento, zona, causa).
 */
export function findingIndex(
  f: Pick<Finding, 'severity' | 'extension' | 'damageType' | 'element' | 'zone' | 'cause'>,
): number {
  if (!f.severity) return 0
  const factor =
    (weightOf(DAMAGE_TYPE_WEIGHT, f.damageType) +
      weightOf(ELEMENT_WEIGHT, f.element) +
      weightOf(ZONE_WEIGHT, f.zone) +
      weightOf(CAUSE_WEIGHT, f.cause)) /
    4
  const ext = Math.min(Math.max(f.extension, 0), 100) / 100
  const extFactor = 0.6 + 0.4 * ext
  return Math.min(100, Math.round(25 * f.severity * factor * extFactor))
}

// Parámetros de agregación (calibrables). Inspirados en PCI (ASTM D6433) y
// AASHTO element inspection: cantidad por extensión, rendimientos decrecientes
// con tope, y el peor daño como piso.
const CUMULATIVE_TAU = 5 // menor = la cantidad de daños distintos pesa más rápido
const ZONE_MAX = 2 // tope al multiplicador por múltiples zonas del mismo daño
const ZONE_GAIN = 0.25 // cuánto sube por duplicar el nº de zonas

/** "Daño distinto" = mismo tipo de daño en el mismo tipo de elemento (la zona no
 *  crea un daño nuevo; varias zonas suman con tope, ver `inspectionScore`). */
function distinctKey(f: Finding): string {
  return `${f.element}||${f.damageType}`
}

/**
 * Factor por múltiples zonas/registros de un MISMO daño: crece con rendimientos
 * decrecientes y satura en `ZONE_MAX`. 1 zona→1.0, 2→1.25, 4→1.5, 8→1.75, ≥16→2.0.
 */
function zoneFactor(count: number): number {
  return Math.min(ZONE_MAX, 1 + ZONE_GAIN * Math.log2(Math.max(1, count)))
}

/**
 * Calificación de una campaña (0–100). Combina, vía noisy-OR:
 *  - el **peor deterioro** (piso: la condición nunca es mejor que el peor daño), y
 *  - la **carga acumulada** de los daños **distintos** (elemento+tipo). Cada daño
 *    en varias zonas suma más, pero con **rendimientos decrecientes y tope**
 *    (no satura). Registrar el mismo daño 100 veces ≈ el tope, no 100×.
 *
 * condición = 1 − (1 − peor) · exp(−carga / τ)
 */
export function inspectionScore(findings: Finding[]): number {
  if (!findings.length) return 0
  // agrupa por daño distinto: peor índice del grupo + nº de zonas/registros
  const groups = new Map<string, { worst: number; count: number }>()
  for (const f of findings) {
    const k = distinctKey(f)
    const fi = findingIndex(f)
    const g = groups.get(k)
    if (!g) groups.set(k, { worst: fi, count: 1 })
    else {
      g.worst = Math.max(g.worst, fi)
      g.count++
    }
  }
  let worst = 0
  let load = 0
  for (const g of groups.values()) {
    worst = Math.max(worst, g.worst)
    load += (g.worst / 100) * zoneFactor(g.count) // aporte del grupo, con tope
  }
  const combined = 1 - (1 - worst / 100) * Math.exp(-load / CUMULATIVE_TAU)
  return Math.min(100, Math.round(combined * 100))
}

/** Peor severidad activa de un conjunto de hallazgos. */
export function worstSeverity(findings: Finding[]): Severity {
  return findings.reduce<Severity>((m, f) => (f.severity > m ? f.severity : m), 0)
}

export function severityColor(sev: Severity): string {
  return SEVERITY[sev].color
}
