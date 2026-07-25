// ─────────────────────────────────────────────────────────────
// Modelo de dominio · Inspecciones estructurales
// Jerarquía:  Proyecto ▸ Estructura ▸ Elemento ▸ (Inspección ▸ Hallazgo)
// ─────────────────────────────────────────────────────────────

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

/** Tipos de daño típicos en hormigón armado / acero. */
export type DamageType =
  | 'fisura'
  | 'grieta'
  | 'descascaramiento'
  | 'corrosion'
  | 'nido_piedra'
  | 'eflorescencia'
  | 'deflexion'
  | 'armadura_expuesta'
  | 'humedad'
  | 'pandeo'
  | 'otro'

export const DAMAGE_TYPES: Record<DamageType, { label: string }> = {
  fisura: { label: 'Fisura' },
  grieta: { label: 'Grieta' },
  descascaramiento: { label: 'Descascaramiento' },
  corrosion: { label: 'Corrosión' },
  nido_piedra: { label: 'Nido de piedra' },
  eflorescencia: { label: 'Eflorescencia' },
  deflexion: { label: 'Deflexión' },
  armadura_expuesta: { label: 'Armadura expuesta' },
  humedad: { label: 'Humedad / filtración' },
  pandeo: { label: 'Pandeo' },
  otro: { label: 'Otro' },
}

/** Causa del daño (catálogo, como structapp-base). */
export type DamageCause =
  | 'estructural'
  | 'deformacion'
  | 'corrosion'
  | 'filtracion'
  | 'electrico'
  | 'estetico'
  | 'mantenimiento'
  | 'otro'

export const DAMAGE_CAUSES: Record<DamageCause, string> = {
  estructural: 'Estructural',
  deformacion: 'Deformación',
  corrosion: 'Corrosión',
  filtracion: 'Filtración',
  electrico: 'Eléctrico',
  estetico: 'Estético',
  mantenimiento: 'Mantenimiento',
  otro: 'Otra',
}

// ── Catálogo de elementos y zonas (el "dónde" del daño) ──────
// Elemento = tipo típico (dropdown). Zona = ubicación dentro del elemento,
// dependiente del elemento. Ambos con "Otro" para escribir uno que no existe.

export const ELEMENT_TYPES: string[] = [
  'Viga',
  'Columna',
  'Losa',
  'Muro',
  'Tabique',
  'Estribo',
  'Tablero',
  'Pila',
  'Fundación',
  'Nudo / Unión',
  'Escalera',
  'Cadena',
  'Sobrecimiento',
  'Otro',
]

/** Zonas típicas por elemento. La última opción siempre es "Otro" (texto libre). */
export const ZONES_BY_ELEMENT: Record<string, string[]> = {
  Viga: ['Centro de vano', 'Apoyo / extremo', 'Unión / nudo', 'Fondo de viga', 'Cara lateral', 'Otro'],
  Columna: ['Base', 'Cabeza / capitel', 'Fuste / tercio central', 'Unión / nudo', 'Otro'],
  Pila: ['Base', 'Fuste', 'Coronación', 'Otro'],
  Losa: ['Centro de paño', 'Borde / perímetro', 'Cara inferior', 'Cara superior', 'Junta', 'Otro'],
  Tablero: ['Centro de vano', 'Junta de dilatación', 'Cara inferior', 'Borde', 'Otro'],
  Muro: ['Muro frontal', 'Muro lateral', 'Base', 'Coronación', 'Encuentro / esquina', 'Otro'],
  Tabique: ['Paño central', 'Encuentro', 'Base', 'Otro'],
  Estribo: ['Cuerpo', 'Coronación', 'Ala', 'Fundación', 'Otro'],
  Fundación: ['Zapata', 'Viga de fundación', 'Sobrecimiento', 'Otro'],
  'Nudo / Unión': ['Nudo viga-columna', 'Empalme', 'Conexión metálica', 'Otro'],
  Escalera: ['Tramo', 'Descanso', 'Apoyo', 'Otro'],
}

/** Zonas para un elemento dado (fallback = solo "Otro"). */
export function zonesFor(element: string): string[] {
  return ZONES_BY_ELEMENT[element] ?? ['Otro']
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
  /** Tipo de elemento (catálogo, o texto libre si "Otro"). Ej. "Viga". */
  element: string
  /** Zona/ubicación dentro del elemento (catálogo por elemento, o libre). Ej. "Fondo de viga". */
  zone?: string
  /** Elemento del modelo 3D vinculado (opcional; para colorear el gemelo). */
  elementId?: string
  damageType: DamageType
  /** Causa del daño (opcional). */
  cause?: DamageCause
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

/** Peso por tipo de daño (mayor = más grave estructuralmente). */
export const DAMAGE_TYPE_WEIGHT: Record<DamageType, number> = {
  fisura: 0.95,
  grieta: 1.25,
  descascaramiento: 1.1,
  corrosion: 1.2,
  nido_piedra: 1.1,
  eflorescencia: 0.85,
  deflexion: 1.2,
  armadura_expuesta: 1.35,
  humedad: 1.0,
  pandeo: 1.3,
  otro: 1.0,
}

/** Peso por causa. */
export const CAUSE_WEIGHT: Record<DamageCause, number> = {
  estructural: 1.3,
  deformacion: 1.15,
  corrosion: 1.2,
  filtracion: 1.05,
  electrico: 1.0,
  estetico: 0.85,
  mantenimiento: 0.95,
  otro: 1.0,
}

/** Peso por elemento (importancia estructural). */
export const ELEMENT_WEIGHT: Record<string, number> = {
  Columna: 1.3,
  Pila: 1.3,
  Fundación: 1.3,
  Estribo: 1.25,
  'Nudo / Unión': 1.25,
  Muro: 1.15,
  Viga: 1.15,
  Tablero: 1.15,
  Losa: 1.1,
  Sobrecimiento: 1.1,
  Cadena: 1.05,
  Escalera: 1.0,
  Tabique: 0.9,
}

/** Peso por zona/ubicación dentro del elemento (zonas críticas > cosméticas). */
export const ZONE_WEIGHT: Record<string, number> = {
  'Unión / nudo': 1.2,
  'Nudo viga-columna': 1.25,
  'Apoyo / extremo': 1.15,
  Apoyo: 1.15,
  Base: 1.15,
  Empalme: 1.15,
  'Conexión metálica': 1.2,
  'Cabeza / capitel': 1.15,
  'Fondo de viga': 1.1,
  Zapata: 1.2,
  'Viga de fundación': 1.2,
  'Encuentro / esquina': 1.15,
  Junta: 1.1,
  'Junta de dilatación': 1.1,
  'Borde / perímetro': 1.05,
  Coronación: 1.05,
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
    (DAMAGE_TYPE_WEIGHT[f.damageType] +
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
