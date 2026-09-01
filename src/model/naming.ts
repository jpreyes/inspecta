// Deducción del tipo de elemento a partir de su nombre.
//
// Un IFC declara el tipo (IfcColumn, IfcBeam…) y no hace falta adivinar. Un
// glTF exportado de Blender o SketchUp no: ahí lo único que queda es el nombre
// del objeto, así que se busca por palabra clave en español e inglés. Es una
// heurística declarada, no un parser: lo que no calza queda como 'otro' y el
// inspector igual puede registrarle daños.
import type { ElementType } from '../types/inspection'

const RULES: { type: ElementType; words: string[] }[] = [
  { type: 'nudo', words: ['nudo', 'joint', 'node'] },
  { type: 'columna', words: ['columna', 'column', 'pilar', 'pillar', 'poste', 'col_', 'col-'] },
  { type: 'viga', words: ['viga', 'beam', 'girder', 'cadena', 'dintel', 'lintel', 'cercha', 'truss', 'vig_', 'vig-'] },
  { type: 'losa', words: ['losa', 'slab', 'floor', 'piso', 'placa', 'deck', 'techo', 'roof'] },
  { type: 'muro', words: ['muro', 'wall', 'tabique', 'panel', 'mur_', 'mur-'] },
  { type: 'fundacion', words: ['fundacion', 'fundación', 'footing', 'foundation', 'zapata', 'pilote', 'pile', 'cimiento', 'radier'] },
]

/** Tipo deducido del nombre, o 'otro' si ninguna palabra calza. */
export function elementTypeFromName(name: string): ElementType {
  const n = name.toLowerCase()
  for (const r of RULES) if (r.words.some((w) => n.includes(w))) return r.type
  return 'otro'
}

/**
 * Hace únicos los tags repetidos añadiendo un sufijo. Blender numera las copias
 * ("Muro.001") pero un IFC bien puede traer veinte "Pilar" a secas, y dos
 * elementos con el mismo tag son indistinguibles en el árbol y en el informe.
 */
export function uniqueTag(tag: string, taken: Set<string>): string {
  if (!taken.has(tag)) {
    taken.add(tag)
    return tag
  }
  for (let i = 2; ; i++) {
    const candidate = `${tag} (${i})`
    if (!taken.has(candidate)) {
      taken.add(candidate)
      return candidate
    }
  }
}
