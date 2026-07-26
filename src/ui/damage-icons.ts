// Íconos SVG propios para los deterioros: dibujados para representar el daño real
// (una fisura, barras de acero, descascaramiento, deflexión, pandeo, etc.), en el
// mismo estilo de trazo que Lucide (24×24, sin relleno, currentColor, width 2).
import { h, type FunctionalComponent } from 'vue'

type IconProps = { size?: number | string; color?: string }
type Child = string | [string, Record<string, string | number>]

function makeIcon(children: Child[]): FunctionalComponent<IconProps> {
  const comp: FunctionalComponent<IconProps> = (props) => {
    const s = props.size ?? 24
    return h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        width: s,
        height: s,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: props.color ?? 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      children.map((c) => (typeof c === 'string' ? h('path', { d: c }) : h(c[0], c[1]))),
    )
  }
  comp.props = { size: [Number, String], color: String }
  return comp
}

/** Fisura / grieta: línea quebrada vertical. */
export const IconCrack = makeIcon([['polyline', { points: '12,2 10,7 13,11 10,15 12,19 11,22' }]])

/** Fisuras en mapa / retícula: red de grietas ramificadas. */
export const IconMapCrack = makeIcon([
  ['polyline', { points: '3,8 9,11 14,7' }],
  ['polyline', { points: '9,11 8,17 12,21' }],
  ['polyline', { points: '9,11 16,13 21,10' }],
  ['line', { x1: 14, y1: 7, x2: 15, y2: 3 }],
])

/** Armadura a la vista: barras de acero sobresaliendo de la superficie. */
export const IconRebar = makeIcon([
  'M3 15 q9 3 18 0',
  ['line', { x1: 8, y1: 15, x2: 8, y2: 4 }],
  ['line', { x1: 12, y1: 15, x2: 12, y2: 4 }],
  ['line', { x1: 16, y1: 15, x2: 16, y2: 4 }],
])

/** Corrosión: barra con borde escamado/picado. */
export const IconCorrosion = makeIcon([
  ['line', { x1: 3, y1: 16, x2: 21, y2: 16 }],
  ['polyline', { points: '3,16 5,12 7,14 9,11 12,14 14,11 17,14 19,12 21,16' }],
])

/** Mancha de óxido: gota con escurrimiento. */
export const IconRustStain = makeIcon([
  'M12 4 c-3 4 -4 6 -4 8 a4 4 0 0 0 8 0 c0 -2 -1 -4 -4 -8 Z',
  ['line', { x1: 12, y1: 17, x2: 12, y2: 21 }],
])

/** Coqueras / nidos de grava: cúmulo de vacíos. */
export const IconHoneycomb = makeIcon([
  ['circle', { cx: 9, cy: 9, r: 2 }],
  ['circle', { cx: 15, cy: 8, r: 1.6 }],
  ['circle', { cx: 11, cy: 14, r: 2.2 }],
  ['circle', { cx: 16, cy: 14, r: 1.6 }],
  ['circle', { cx: 7, cy: 15, r: 1.3 }],
])

/** Eflorescencia: cristales de sal sobre la superficie. */
export const IconEfflorescence = makeIcon([
  ['line', { x1: 3, y1: 18, x2: 21, y2: 18 }],
  ['line', { x1: 8, y1: 9, x2: 8, y2: 15 }],
  ['line', { x1: 5, y1: 12, x2: 11, y2: 12 }],
  ['line', { x1: 6, y1: 10, x2: 10, y2: 14 }],
  ['line', { x1: 10, y1: 10, x2: 6, y2: 14 }],
  ['line', { x1: 16, y1: 11, x2: 16, y2: 16 }],
  ['line', { x1: 14, y1: 13.5, x2: 18, y2: 13.5 }],
])

/** Deformación / flecha: viga flectada entre apoyos. */
export const IconDeflection = makeIcon([
  'M3 8 q9 9 18 0',
  ['line', { x1: 3, y1: 8, x2: 3, y2: 12 }],
  ['line', { x1: 21, y1: 8, x2: 21, y2: 12 }],
])

/** Pandeo local: barra arqueada bajo compresión. */
export const IconBuckling = makeIcon([
  'M9 3 q9 9 0 18',
  ['polyline', { points: '6,5 9,2 12,5' }],
  ['polyline', { points: '6,19 9,22 12,19' }],
])

/** Desplome / falta de alineación: elemento inclinado vs. la plomada. */
export const IconTilt = makeIcon([
  ['line', { x1: 3, y1: 21, x2: 21, y2: 21 }],
  ['line', { x1: 7, y1: 21, x2: 7, y2: 5, 'stroke-dasharray': '2 2' }],
  ['polyline', { points: '10,21 12,5 17,6 15,21' }],
])

/** Disgregación / pulverización: superficie que se deshace en partículas. */
export const IconCrumbling = makeIcon([
  'M3 7 v10 h6',
  ['circle', { cx: 12, cy: 10, r: 0.8 }],
  ['circle', { cx: 14, cy: 14, r: 0.8 }],
  ['circle', { cx: 16, cy: 9, r: 0.8 }],
  ['circle', { cx: 18, cy: 14, r: 0.8 }],
  ['circle', { cx: 20, cy: 11, r: 0.8 }],
  ['circle', { cx: 13, cy: 17, r: 0.8 }],
  ['circle', { cx: 17, cy: 18, r: 0.8 }],
])

/** Descascaramiento / desconchón: bloque con trozo desprendido + escama. */
export const IconSpalling = makeIcon([
  ['polyline', { points: '4,20 4,5 9,5 11,8 14,6 16,8 20,7 20,20 4,20' }],
  ['polyline', { points: '13,3 16,3 15,6 12,5 13,3' }],
])

/** Aplastamiento: bloque comprimido con caras abombadas y flechas de carga. */
export const IconCrushing = makeIcon([
  'M8 8 q-2 4 0 8 h8 q2 -4 0 -8 Z',
  ['line', { x1: 12, y1: 1, x2: 12, y2: 6 }],
  ['polyline', { points: '9,3 12,6 15,3' }],
  ['line', { x1: 12, y1: 22, x2: 12, y2: 17 }],
  ['polyline', { points: '9,20 12,17 15,20' }],
])

/** Pérdida de mortero de junta: patrón de albañilería. */
export const IconMortar = makeIcon([
  ['line', { x1: 3, y1: 9, x2: 21, y2: 9 }],
  ['line', { x1: 3, y1: 15, x2: 21, y2: 15 }],
  ['line', { x1: 12, y1: 3, x2: 12, y2: 9 }],
  ['line', { x1: 8, y1: 9, x2: 8, y2: 15 }],
  ['line', { x1: 16, y1: 9, x2: 16, y2: 15 }],
  ['line', { x1: 12, y1: 15, x2: 12, y2: 21 }],
])

/** Pérdida de tratamiento protector: pintura/recubrimiento que se descama. */
export const IconCoating = makeIcon(['M4 5 h16 v14 h-16 Z', 'M13 5 c3 2 3 6 0 8 c-2 1 -1 4 1 5'])

/** Pudrición / xilófagos: tabla de madera con vetas y galerías. */
export const IconRot = makeIcon([
  'M4 6 h16 v12 h-16 Z',
  'M4 11 q8 -2 16 0',
  'M4 15 q8 2 16 0',
  ['circle', { cx: 9, cy: 12, r: 1 }],
  ['circle', { cx: 15, cy: 13, r: 1 }],
])

/** Deterioro de soldadura: dos planchas unidas por un cordón. */
export const IconWeld = makeIcon([
  'M3 8 h6 v8 h-6',
  'M21 8 h-6 v8 h6',
  ['polyline', { points: '10.5,7 13.5,10 10.5,13 13.5,16 10.5,18' }],
])

/** Pernos / anclajes: perno de cabeza hexagonal con hilo. */
export const IconBolt = makeIcon([
  ['polygon', { points: '8,4 16,4 18,7 16,10 8,10 6,7' }],
  ['line', { x1: 12, y1: 10, x2: 12, y2: 20 }],
  ['line', { x1: 10, y1: 12, x2: 14, y2: 12 }],
  ['line', { x1: 10, y1: 14, x2: 14, y2: 14 }],
  ['line', { x1: 10, y1: 16, x2: 14, y2: 16 }],
  ['line', { x1: 10, y1: 18, x2: 14, y2: 18 }],
])

/** Alteración superficial: textura ondulada / meteorizada. */
export const IconSurface = makeIcon([
  'M4 6 h16 v12 h-16 Z',
  'M6 11 q2 -2 4 0 t4 0 t4 0',
  'M6 15 q2 2 4 0 t4 0 t4 0',
])

/** Descalce / socavación / cárcava: fundación socavada por el agua. */
export const IconScour = makeIcon([
  'M8 4 h8 v8 h-8 Z',
  'M3 12 q4 0 5 3 q1 2 3 2 q3 0 4 -3 q1 -2 6 -2',
  ['line', { x1: 3, y1: 20, x2: 21, y2: 20, 'stroke-dasharray': '3 2' }],
])
