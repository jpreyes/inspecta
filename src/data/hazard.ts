// ─────────────────────────────────────────────────────────────
// Amenaza / exposición sísmica del sitio (NCh433 Of.1996 Mod.2009 + DS61).
// Tercer eje del riesgo, junto a condición (daño) y vulnerabilidad (config.).
// No mide daño ni configuración: mide cuán severa es la demanda sísmica del
// emplazamiento y la exposición/consecuencia del uso.
// ─────────────────────────────────────────────────────────────

export type SeismicZone = 1 | 2 | 3
export type SoilType = 'A' | 'B' | 'C' | 'D' | 'E'
export type OccupancyCat = 1 | 2 | 3 | 4

/** Configuración de sitio de una estructura (NCh433). */
export interface SiteConfig {
  zone?: SeismicZone
  soil?: SoilType
  importance?: OccupancyCat
}

/** Zona sísmica → aceleración efectiva A0 (g) y peso relativo. */
export const SEISMIC_ZONES: Record<SeismicZone, { label: string; a0: number; frac: number }> = {
  1: { label: 'Zona 1 (A0 = 0,20 g)', a0: 0.2, frac: 0.5 },
  2: { label: 'Zona 2 (A0 = 0,30 g)', a0: 0.3, frac: 0.75 },
  3: { label: 'Zona 3 (A0 = 0,40 g)', a0: 0.4, frac: 1.0 },
}

/** Tipo de suelo DS61 → severidad de amplificación relativa. */
export const SOIL_TYPES: Record<SoilType, { label: string; frac: number }> = {
  A: { label: 'A · Roca, suelo cementado', frac: 0.6 },
  B: { label: 'B · Roca blanda / grava densa', frac: 0.7 },
  C: { label: 'C · Grava/arena densa', frac: 0.8 },
  D: { label: 'D · Suelo firme / arena media', frac: 0.9 },
  E: { label: 'E · Suelo blando / cohesivo', frac: 1.0 },
}

/** Categoría de ocupación NCh433 (Tabla 4.1) → exposición/consecuencia. */
export const OCCUPANCY_CATS: Record<OccupancyCat, { label: string; frac: number }> = {
  1: { label: 'I · Menor (aislado, bajo riesgo)', frac: 0.6 },
  2: { label: 'II · Normal (habitacional/oficinas)', frac: 0.85 },
  3: { label: 'III · Aglomeración / servicio público', frac: 1.0 },
  4: { label: 'IV · Crítico (hospitales, emergencia)', frac: 1.0 },
}

/**
 * Índice de amenaza/exposición 0–100. La sismicidad (zona) domina; el suelo y la
 * categoría de ocupación modulan (raíz → efecto atenuado). 0 = sin datos de sitio.
 */
export function hazardIndex(site?: SiteConfig): number {
  if (!site || (!site.zone && !site.soil && !site.importance)) return 0
  const z = site.zone ? SEISMIC_ZONES[site.zone].frac : 0.75 // supone zona 2 si falta
  const s = site.soil ? SOIL_TYPES[site.soil].frac : 0.8
  const i = site.importance ? OCCUPANCY_CATS[site.importance].frac : 0.85
  const hz = z * Math.sqrt(s) * Math.sqrt(i)
  return Math.round(100 * hz)
}

export type HazardClass = 'baja' | 'media' | 'alta'
export const HAZARD_META: Record<HazardClass, { label: string; color: string }> = {
  baja: { label: 'Baja', color: '#22c55e' },
  media: { label: 'Media', color: '#eab308' },
  alta: { label: 'Alta', color: '#ef4444' },
}
export function hazardClass(idx: number): HazardClass {
  if (idx >= 65) return 'alta'
  if (idx >= 35) return 'media'
  return 'baja'
}
