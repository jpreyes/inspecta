// Harness de calibración: corre escenarios representativos por las funciones
// reales de scoring y muestra el resultado, para ajustar pesos/umbrales con criterio.
// Correr:  npx tsx scripts/calibrate.ts
import {
  inspectionScore,
  conditionFromScore,
  findingIndex,
  findingPriority,
  type Finding,
  type Element,
} from '../src/types/inspection'
import { registeredIrregularities, riskLevel } from '../src/data/vulnerability'
import { hazardIndex, hazardClass } from '../src/data/hazard'

let n = 0
function f(p: Partial<Finding>): Finding {
  return {
    id: 'f' + n++,
    inspectionId: 'i',
    element: 'Columna / Pilar',
    damageType: 'Fisuras',
    severity: 1,
    extension: 10,
    photos: [],
    createdAt: '',
    ...p,
  } as Finding
}

const COND: { t: string; type: string; fs: Finding[]; els?: Element[] }[] = [
  { t: 'Fisura leve en columna (sev1, 15%)', type: 'edificio', fs: [f({ damageType: 'Fisuras', severity: 1, extension: 15, zone: 'Base' })] },
  { t: 'Grieta sev3 35% en columna base', type: 'edificio', fs: [f({ damageType: 'Grietas', severity: 3, extension: 35, zone: 'Base' })] },
  { t: 'Descascar. c/armadura sev4 20% en columna', type: 'edificio', fs: [f({ damageType: 'Descascaramiento con armadura a la vista', severity: 4, extension: 20, zone: 'Base' })] },
  { t: 'Deformación viga sev2 45%', type: 'edificio', fs: [f({ element: 'Viga', damageType: 'Deformación / flecha excesiva', severity: 2, extension: 45, zone: 'Centro de vano' })] },
  {
    t: 'Mismo daño leve (tratamiento sev1 10%) en 8 zonas de una viga',
    type: 'edificio',
    fs: Array.from({ length: 8 }, (_, i) => f({ element: 'Viga', damageType: 'Pérdida de tratamiento protector', severity: 1, extension: 10, zone: 'z' + i })),
  },
  { t: 'Tabique NO estructural sev4 80%', type: 'edificio', fs: [f({ element: 'Tabique', damageType: 'Fisuras', severity: 4, extension: 80, zone: 'Paño central' })] },
  {
    t: '3 daños severos CONCENTRADOS en el piso 1',
    type: 'edificio',
    els: [
      { id: 'a', tag: 'C1', type: 'columna', story: 1 },
      { id: 'b', tag: 'C2', type: 'columna', story: 1 },
      { id: 'c', tag: 'V1', type: 'viga', story: 1 },
    ],
    fs: [
      f({ elementId: 'a', element: 'Columna / Pilar', damageType: 'Grietas', severity: 3, extension: 40, zone: 'Base' }),
      f({ elementId: 'b', element: 'Columna / Pilar', damageType: 'Descascaramiento con armadura a la vista', severity: 4, extension: 30, zone: 'Base' }),
      f({ elementId: 'c', element: 'Viga', damageType: 'Grietas', severity: 3, extension: 30, zone: 'Apoyo/extremo' }),
    ],
  },
  {
    t: 'Los MISMOS 3 daños REPARTIDOS en 3 pisos',
    type: 'edificio',
    els: [
      { id: 'a', tag: 'C1', type: 'columna', story: 1 },
      { id: 'b', tag: 'C2', type: 'columna', story: 2 },
      { id: 'c', tag: 'V1', type: 'viga', story: 3 },
    ],
    fs: [
      f({ elementId: 'a', element: 'Columna / Pilar', damageType: 'Grietas', severity: 3, extension: 40, zone: 'Base' }),
      f({ elementId: 'b', element: 'Columna / Pilar', damageType: 'Descascaramiento con armadura a la vista', severity: 4, extension: 30, zone: 'Base' }),
      f({ elementId: 'c', element: 'Viga', damageType: 'Grietas', severity: 3, extension: 30, zone: 'Apoyo/extremo' }),
    ],
  },
  { t: 'PUENTE: fisura sev3 cepa + humedad sev2 estribo', type: 'puente', fs: [f({ element: 'Columnas', damageType: 'Fisuras', severity: 3, extension: 30, zone: 'Fuste/tercio central' }), f({ element: 'Fundación', damageType: 'Humedades', severity: 2, extension: 50, zone: 'Cara lateral' })] },
  { t: 'PUENTE: aparato de apoyo sev4 40%', type: 'puente', fs: [f({ element: 'Aparato de apoyo', damageType: 'Rotura', severity: 4, extension: 40, zone: 'Cuerpo' })] },
]

console.log('\n== CONDICIÓN (salud 0–100; ≥75 operativa · 40–75 observación · <40 crítica) ==')
for (const s of COND) {
  const h = inspectionScore(s.fs, s.type, s.els)
  console.log(`  ${String(h).padStart(3)}  ${conditionFromScore(h).padEnd(12)} | ${s.t}`)
}

console.log('\n== ÍNDICE y PRIORIDAD por hallazgo (0–100) ==')
const single = [
  { t: 'Fisura sev1 15% base', f: f({ damageType: 'Fisuras', severity: 1, extension: 15, zone: 'Base', cause: 'retracción del hormigón' }) },
  { t: 'Descascar+armadura sev4 20% (causa corrosión)', f: f({ damageType: 'Descascaramiento con armadura a la vista', severity: 4, extension: 20, zone: 'Base', cause: 'corrosión de armaduras' }) },
  { t: 'Grieta sev3 35% (causa sísmica)', f: f({ damageType: 'Grietas', severity: 3, extension: 35, zone: 'Base', cause: 'acción sísmica' }) },
]
for (const s of single) console.log(`  índice ${String(findingIndex(s.f)).padStart(3)} · prioridad ${String(findingPriority(s.f)).padStart(3)} | ${s.t}`)

console.log('\n== VULNERABILIDAD (registro cualitativo, sin índice) ==')
const VULN = [
  { t: 'Piso blando severo + torsión moderada', v: { piso_blando: 2, torsion: 1 } },
]
for (const s of VULN) {
  const reg = registeredIrregularities(s.v)
  console.log(`  ${reg.length} registrada(s): ` + reg.map((r) => `${r.name} [${['-', 'moderada', 'severa'][r.cls]}]`).join(', '))
}

console.log('\n== AMENAZA sísmica (0–100; <35 baja · 35–65 media · ≥65 alta) ==')
const HAZ = [
  { t: 'Zona 1 / suelo A / ocup. I', s: { zone: 1 as const, soil: 'A' as const, importance: 1 as const } },
  { t: 'Zona 2 / suelo C / ocup. II', s: { zone: 2 as const, soil: 'C' as const, importance: 2 as const } },
  { t: 'Zona 3 / suelo E / ocup. IV', s: { zone: 3 as const, soil: 'E' as const, importance: 4 as const } },
]
for (const s of HAZ) {
  const hz = hazardIndex(s.s)
  console.log(`  ${String(hz).padStart(3)}  ${hazardClass(hz).padEnd(6)} | ${s.t}`)
}

console.log('\n== RIESGO (condición × amenaza) ==')
const RISK = [
  { t: 'Sano (h85) + amenaza baja', h: 85, hz: 20 },
  { t: 'Regular (h60) + amenaza baja', h: 60, hz: 20 },
  { t: 'Crítico (h30) + amenaza baja', h: 30, hz: 20 },
  { t: 'Regular (h60) + amenaza ALTA', h: 60, hz: 80 },
  { t: 'Crítico (h25) + amenaza ALTA', h: 25, hz: 80 },
]
for (const s of RISK) console.log(`  ${riskLevel(s.h, s.hz).padEnd(9)} | ${s.t}`)
console.log('')
