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

export type ElementType = 'columna' | 'viga' | 'losa' | 'muro' | 'nudo' | 'fundacion'

export type StructureType = 'edificio' | 'puente' | 'nave' | 'torre'

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Un elemento estructural discreto dentro de una estructura. */
export interface Element {
  id: string
  tag: string // ej. "C-A1-N2" (columna, eje A1, nivel 2)
  type: ElementType
  /** centro del elemento en coordenadas locales de la estructura (m) */
  position: Vec3
  /** dimensiones de la caja que lo representa en el gemelo 3D (m) */
  size: Vec3
  story?: number
}

export interface Structure {
  id: string
  projectId: string
  name: string
  type: StructureType
  /** parámetros del generador paramétrico del gemelo 3D */
  grid: {
    baysX: number
    baysZ: number
    stories: number
    bayX: number // ancho de vano en X (m)
    bayZ: number // ancho de vano en Z (m)
    storyH: number // altura de piso (m)
  }
  elements: Element[]
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
  elementId: string
  damageType: DamageType
  severity: Severity
  /** extensión afectada del elemento, 0–100 % */
  extension: number
  /** posición del pin sobre la superficie del elemento (coords mundo) */
  pin: Vec3
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

// ── Scoring determinístico ───────────────────────────────────

/**
 * Índice de condición de un hallazgo (0 sano → 100 crítico),
 * combinando severidad y extensión. Base para el rating por elemento.
 */
export function findingIndex(f: Pick<Finding, 'severity' | 'extension'>): number {
  const sev = f.severity / 4 // 0–1
  const ext = Math.min(Math.max(f.extension, 0), 100) / 100 // 0–1
  // severidad domina; la extensión modula. Peso 70/30.
  return Math.round((0.7 * sev + 0.3 * sev * ext) * 100)
}

/** Peor severidad activa de un conjunto de hallazgos. */
export function worstSeverity(findings: Finding[]): Severity {
  return findings.reduce<Severity>((m, f) => (f.severity > m ? f.severity : m), 0)
}

export function severityColor(sev: Severity): string {
  return SEVERITY[sev].color
}
