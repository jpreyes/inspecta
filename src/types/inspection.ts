// ─────────────────────────────────────────────────────────────
// Modelo de dominio · Inspecciones estructurales
// Jerarquía:  Proyecto ▸ Estructura ▸ Elemento ▸ (Inspección ▸ Hallazgo)
// ─────────────────────────────────────────────────────────────
import { CATALOG, type CatalogElement, type StructureCatalog } from '../data/catalog'
import type { SiteConfig } from '../data/hazard'

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
  /** Vulnerabilidad por configuración: irregularidad(id del catálogo) → clase
   *  0 ausente · 1 moderada · 2 severa/extrema. Ver src/data/vulnerability.ts. */
  vulnerability?: Record<string, number>
  /** Amenaza/exposición sísmica del sitio (NCh433). Ver src/data/hazard.ts. */
  site?: SiteConfig
  /** Equipo dueño. Vacío = registro personal (modo local, sin servidor). */
  teamId?: string
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
  /** Equipo dueño. Vacío = registro personal (modo local, sin servidor). */
  teamId?: string
}

/** Quién registró algo. `authorName` se guarda denormalizado para que el
 *  informe muestre el autor aunque se genere sin conexión. */
export interface Authored {
  authorId?: string
  authorName?: string
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
  /** Equipo dueño. Vacío = registro personal (modo local, sin servidor). */
  teamId?: string
  /** Quién registró el hallazgo. */
  authorId?: string
  authorName?: string
}

/** Una campaña de inspección periódica (una visita a terreno con su fecha). */
export interface Inspection {
  id: string
  structureId: string
  date: string // ISO — fecha de la visita
  /** Nombre del inspector a cargo (texto; con equipo se elige de los miembros). */
  inspector: string
  /** Usuario miembro del equipo que figura como inspector, si aplica. */
  inspectorId?: string
  weather?: string
  summary?: string
  teamId?: string
  authorId?: string
  authorName?: string
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
  teamId?: string
  authorId?: string
  authorName?: string
}

export const CONDITION = {
  operativa: { label: 'Operativa', color: '#22c55e' },
  observacion: { label: 'Con observaciones', color: '#eab308' },
  critica: { label: 'Crítica', color: '#ef4444' },
} as const
export type ConditionKey = keyof typeof CONDITION

/** Deriva la condición global (semáforo) desde el índice de SALUD 0–100
 *  (100 = sano). <40 crítica · 40–75 con observaciones · ≥75 operativa. */
export function conditionFromScore(health: number): ConditionKey {
  if (health < 40) return 'critica'
  if (health < 75) return 'observacion'
  return 'operativa'
}

// ── Scoring determinístico ponderado (índice de SALUD 0–100) ──
// Modelo jerárquico: hallazgo → elemento → estructura, con agregadores distintos
// para puente (serie/peor-caso) y edificio (redundante/ponderado + override).
// Fuentes: España (G·K1·K2), AASHTO/BCI, PCI deduct, ATC-20/EMS-98 (estructural
// vs no estructural). La CAUSA no entra en la condición: alimenta el riesgo.
// Pesos calibrables; entradas "Otro"/desconocidas usan DEFAULT_WEIGHT.

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
 * Índice de DAÑO de un hallazgo, 0 (sano) → 100 (crítico). Combina
 * severidad × extensión × criticidad del tipo de daño y de la zona.
 * La causa NO entra aquí (alimenta el módulo de riesgo/pronóstico).
 */
export function findingIndex(
  f: Pick<Finding, 'severity' | 'extension' | 'damageType' | 'zone'>,
): number {
  return Math.round(100 * findingDamage(f))
}

// Curva severidad→daño (convexa): solo el nivel CRÍTICO (4) hunde la condición;
// los niveles 1–3 penalizan de forma gradual, de modo que un daño moderado aislado
// no lleve la estructura a crítica. Calibrable.
const SEV_DAMAGE = [0, 0.1, 0.24, 0.38, 0.85] as const

/** Daño de un hallazgo en 0–1 (0 sano … 1 destruido). */
function findingDamage(f: Pick<Finding, 'severity' | 'extension' | 'damageType' | 'zone'>): number {
  if (!f.severity) return 0
  const base = SEV_DAMAGE[f.severity] ?? 0
  const ext = Math.min(Math.max(f.extension, 0), 100) / 100
  const extMod = 0.6 + 0.4 * ext // la extensión modula (0.6 … 1.0)
  const typeF = weightOf(DAMAGE_TYPE_WEIGHT, f.damageType) // criticidad del deterioro
  const zoneF = weightOf(ZONE_WEIGHT, f.zone) // zona crítica vs cosmética
  const critMod = 0.7 + 0.3 * (0.5 * typeF + 0.5 * zoneF) // modulación suave por tipo/zona
  return Math.min(1, base * extMod * critMod)
}

/** Factor de riesgo/pronóstico por causa (NO entra en la condición actual,
 *  siguiendo la separación difettosità/vulnerabilità). Mayor = más agravante. */
export function causeRiskFactor(cause?: string): number {
  return weightOf(CAUSE_WEIGHT, cause)
}

/**
 * Prioridad de intervención de un hallazgo (0–100): combina el DAÑO actual con
 * el factor de riesgo de su CAUSA (probabilidad/velocidad de agravamiento). Es un
 * pronóstico para ordenar la intervención, distinto de la condición observada.
 */
export function findingPriority(
  f: Pick<Finding, 'severity' | 'extension' | 'damageType' | 'zone' | 'cause'>,
): number {
  return Math.round(100 * Math.min(1, findingDamage(f) * causeRiskFactor(f.cause)))
}

// ── Agregación jerárquica (España G·K1·K2 + peor-caso amortiguado + override) ──
const ZONE_MAX = 1.6 // tope al multiplicador por repetir el mismo daño en varias zonas
const ZONE_GAIN = 0.2
const ELEM_AMORT = 0.3 // atenuación de los daños adicionales dentro de un elemento
const GOV_EDIF = 0.85 // cuánto puede un elemento primario dañado gobernar el índice
const GOV_PUENTE = 0.95 // en puente (sistema en serie) el peor-caso pesa más
const GOV_STORY = 0.9 // peor-piso: concentración de daño en un piso (tipo piso blando) gobierna

/** Multiplicador por nº de zonas del mismo daño, con rendimientos decrecientes y
 *  tope: 1→1.0, 2→1.2, 4→1.4, 8→1.6, ≥16→1.6 (no satura sin límite). */
function zoneMult(nZones: number): number {
  return Math.min(ZONE_MAX, 1 + ZONE_GAIN * Math.log2(Math.max(1, nZones)))
}

/** Combina varios daños (0–1): el peor domina, el resto atenuado. Nunca > 1. */
function combineAmortiguado(damages: number[], amort: number): number {
  if (!damages.length) return 0
  const sorted = [...damages].sort((a, b) => b - a)
  let d = sorted[0]
  for (let i = 1; i < sorted.length; i++) d += amort * sorted[i]
  return Math.min(1, d)
}

/** Daño (0–1) de un elemento a partir de sus hallazgos: colapsa repeticiones del
 *  mismo deterioro (varias zonas suman con tope) y combina deterioros distintos. */
function elementDamage(findings: Finding[]): number {
  const byDamage = new Map<string, { worst: number; zones: Set<string> }>()
  for (const f of findings) {
    const d = findingDamage(f)
    const g = byDamage.get(f.damageType)
    if (!g) byDamage.set(f.damageType, { worst: d, zones: new Set([f.zone ?? '—']) })
    else {
      g.worst = Math.max(g.worst, d)
      g.zones.add(f.zone ?? '—')
    }
  }
  const perDamage = [...byDamage.values()].map((g) => Math.min(1, g.worst * zoneMult(g.zones.size)))
  return combineAmortiguado(perDamage, ELEM_AMORT)
}

// Elementos primarios (trayectoria de carga) y no estructurales, por tipo de estructura.
const PRIMARY_EDIF = new Set([
  'Columna / Pilar', 'Muro estructural / de corte', 'Viga de acople (dintel de acople)',
  'Muro de albañilería confinada', 'Muro de albañilería armada', 'Machón', 'Muro de contención',
  'Viga', 'Dintel', 'Nudo viga-columna', 'Voladizo / balcón',
  'Zapata aislada', 'Zapata corrida', 'Viga de fundación', 'Losa de fundación (radier)',
  'Pilote', 'Cabezal de pilotes', 'Sobrecimiento', 'Muro de subterráneo',
  'Anclaje', 'Conexión soldada', 'Conexión apernada', 'Empalme de armadura',
])
const NONSTRUCT_EDIF = new Set(['Tabique', 'Antepecho / parapeto'])

/** ¿El elemento es no estructural? Sus daños NO afectan la condición estructural
 *  (se registran/muestran aparte). */
export function isNonStructural(element?: string): boolean {
  return !!element && NONSTRUCT_EDIF.has(element)
}
const PRIMARY_PUENTE = new Set([
  'Vigas', 'Longuerina', 'Voladizo', 'Aparato de apoyo', 'Columnas', 'Fundación',
  'Muro frontal portante', 'Cabezal superior', 'Cabezal inferior', 'Losa',
  'Travesaño Apoyo', 'Travesaño intermedia', 'Anclaje de pretensado', 'Anclaje / placa base',
])

/** Roll-up edificio (redundante): promedio ponderado por importancia + override
 *  por elemento primario dañado. Los elementos NO estructurales se excluyen (no
 *  afectan la condición estructural). Devuelve daño 0–1. */
function buildingDamage(elems: { name: string; dmg: number }[]): number {
  const struct = elems.filter((e) => !NONSTRUCT_EDIF.has(e.name))
  if (!struct.length) return 0
  let wsum = 0
  let wdmg = 0
  let primaryWorst = 0
  for (const e of struct) {
    const w = weightOf(ELEMENT_WEIGHT, e.name)
    wsum += w
    wdmg += w * e.dmg
    if (PRIMARY_EDIF.has(e.name)) primaryWorst = Math.max(primaryWorst, e.dmg)
  }
  const avg = wsum ? wdmg / wsum : 0
  return Math.min(1, Math.max(avg, primaryWorst * GOV_EDIF))
}

/** Roll-up puente (serie): igual, pero con peor-caso más fuerte. Devuelve daño 0–1. */
function bridgeDamage(elems: { name: string; dmg: number }[]): number {
  let wsum = 0
  let wdmg = 0
  let primaryWorst = 0
  for (const e of elems) {
    const w = weightOf(ELEMENT_WEIGHT, e.name)
    wsum += w
    wdmg += w * e.dmg
    if (PRIMARY_PUENTE.has(e.name)) primaryWorst = Math.max(primaryWorst, e.dmg)
  }
  const avg = wsum ? wdmg / wsum : 0
  return Math.min(1, Math.max(avg, primaryWorst * GOV_PUENTE))
}

/** Agrupa hallazgos por tipo de elemento y devuelve el daño (0–1) de cada uno. */
function elementDamages(findings: Finding[]): { name: string; dmg: number }[] {
  const byElement = new Map<string, Finding[]>()
  for (const f of findings) {
    const arr = byElement.get(f.element)
    if (arr) arr.push(f)
    else byElement.set(f.element, [f])
  }
  return [...byElement.entries()].map(([name, fs]) => ({ name, dmg: elementDamage(fs) }))
}

/**
 * Índice de SALUD de la campaña, 0 (crítico) → 100 (sano). Agrega los hallazgos
 * por elemento y luego a la estructura con el modelo del tipo correspondiente:
 *  - puente = serie/peor-caso;
 *  - edificio = redundante/ponderado + override, y si se conocen los pisos
 *    (vía `elements`), **agregación por piso con peor-piso gobernante** (la
 *    concentración de daño en un piso, tipo piso blando, pesa más que repartida).
 */
export function inspectionScore(
  findings: Finding[],
  structureType?: string,
  elements?: Element[],
): number {
  if (!findings.length) return 100
  if (structureType === 'puente') {
    return Math.round(100 * (1 - bridgeDamage(elementDamages(findings))))
  }
  // edificio: si hay info de piso, agrega por piso; si no, todo en un grupo.
  const storyOf = new Map((elements ?? []).map((e) => [e.id, e.story ?? 0]))
  const byStory = new Map<number | string, Finding[]>()
  for (const f of findings) {
    const st = f.elementId != null && storyOf.has(f.elementId) ? storyOf.get(f.elementId)! : '—'
    const arr = byStory.get(st)
    if (arr) arr.push(f)
    else byStory.set(st, [f])
  }
  const storyDamages = [...byStory.values()].map((fs) => buildingDamage(elementDamages(fs)))
  const avg = storyDamages.reduce((a, b) => a + b, 0) / storyDamages.length
  const worst = Math.max(...storyDamages)
  const damage = Math.min(1, Math.max(avg, worst * GOV_STORY))
  return Math.round(100 * (1 - damage))
}
