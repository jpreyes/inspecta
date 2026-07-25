import type { Element, Structure } from '../types/inspection'

const COL = 0.4 // lado de columna (m)
const BEAM_W = 0.3
const BEAM_H = 0.5

const axisLabel = (i: number) => String.fromCharCode(65 + i) // 0->A, 1->B ...

/**
 * Genera columnas y vigas de un pórtico de momento a partir de la grilla.
 * Convención Three.js: Y es vertical, X y Z horizontales, origen centrado.
 */
export function generateFrame(grid: NonNullable<Structure['grid']>): Element[] {
  const { baysX, baysZ, stories, bayX, bayZ, storyH } = grid
  const nx = baysX + 1
  const nz = baysZ + 1
  const spanX = baysX * bayX
  const spanZ = baysZ * bayZ
  const x0 = -spanX / 2
  const z0 = -spanZ / 2
  const els: Element[] = []

  // Columnas: una por eje (X,Z) por piso
  for (let s = 0; s < stories; s++) {
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const x = x0 + ix * bayX
        const z = z0 + iz * bayZ
        els.push({
          id: `C-${axisLabel(ix)}${iz + 1}-N${s + 1}`,
          tag: `C ${axisLabel(ix)}${iz + 1} · N${s + 1}`,
          type: 'columna',
          story: s + 1,
          position: { x, y: s * storyH + storyH / 2, z },
          size: { x: COL, y: storyH, z: COL },
        })
      }
    }
  }

  // Vigas en cada nivel de losa (tope de cada piso)
  for (let s = 0; s < stories; s++) {
    const y = (s + 1) * storyH
    // vigas en dirección X
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < baysX; ix++) {
        const x = x0 + ix * bayX + bayX / 2
        const z = z0 + iz * bayZ
        els.push({
          id: `VX-${axisLabel(ix)}${iz + 1}-N${s + 1}`,
          tag: `Viga X ${axisLabel(ix)}${iz + 1} · N${s + 1}`,
          type: 'viga',
          story: s + 1,
          position: { x, y, z },
          size: { x: bayX - COL, y: BEAM_H, z: BEAM_W },
        })
      }
    }
    // vigas en dirección Z
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < baysZ; iz++) {
        const x = x0 + ix * bayX
        const z = z0 + iz * bayZ + bayZ / 2
        els.push({
          id: `VZ-${axisLabel(ix)}${iz + 1}-N${s + 1}`,
          tag: `Viga Z ${axisLabel(ix)}${iz + 1} · N${s + 1}`,
          type: 'viga',
          story: s + 1,
          position: { x, y, z },
          size: { x: BEAM_W, y: BEAM_H, z: bayZ - COL },
        })
      }
    }
  }

  return els
}
