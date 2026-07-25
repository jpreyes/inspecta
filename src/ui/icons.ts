import type { Component } from 'vue'
import {
  Zap,
  Layers2,
  Anvil,
  Grid3x3,
  Snowflake,
  TrendingDown,
  Bone,
  Droplet,
  CircleHelp,
  Wrench,
  Sprout,
} from 'lucide-vue-next'

/** Ícono (Lucide) para un deterioro, por palabras clave de su nombre.
 *  Los deterioros vienen del catálogo (texto), así que se resuelve por patrón. */
const RULES: [RegExp, Component][] = [
  [/mapa|ret[íi]cula/i, Grid3x3],
  [/fisura|grieta/i, Zap],
  [/armadura/i, Bone],
  [/corros|[óo]xido/i, Anvil],
  [/humed|filtr/i, Droplet],
  [/eflorescen/i, Snowflake],
  [/deform|flecha|pandeo|abolladura|desplome|alineac|desplaz/i, TrendingDown],
  [/soldadura|conexi[óo]n|perno|anclaje|tornillo|robl[óo]n/i, Wrench],
  [/pudrici|xil[óo]fag|vegetaci|biol[óo]gic/i, Sprout],
  [/descascar|desconch|disgreg|lajaci|coquera|nido|mortero|junta|aplastam|rotura|p[ée]rdida de pieza/i, Layers2],
]

export function iconForDamage(name?: string): Component {
  if (name) for (const [re, ic] of RULES) if (re.test(name)) return ic
  return CircleHelp
}
