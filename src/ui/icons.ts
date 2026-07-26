import type { Component } from 'vue'
import { Droplet, Sprout, CircleHelp } from 'lucide-vue-next'
import {
  IconCrack,
  IconMapCrack,
  IconRebar,
  IconCorrosion,
  IconRustStain,
  IconHoneycomb,
  IconEfflorescence,
  IconDeflection,
  IconBuckling,
  IconTilt,
  IconCrumbling,
  IconSpalling,
  IconCrushing,
  IconMortar,
  IconCoating,
  IconRot,
  IconWeld,
  IconBolt,
  IconSurface,
  IconScour,
} from './damage-icons'

/** Ícono para un deterioro, resuelto por palabras clave de su nombre (catálogo).
 *  Casi todos son SVG propios que dibujan el daño real (ver damage-icons.ts);
 *  Droplet (humedad) y Sprout (vegetación) de Lucide sí lo representan bien.
 *  El ORDEN importa: reglas más específicas primero. */
const RULES: [RegExp, Component][] = [
  [/mapa|ret[íi]cul/i, IconMapCrack],
  [/sin armadura/i, IconSpalling], // "descascaramiento sin armadura a la vista"
  [/mancha de [óo]xido/i, IconRustStain],
  [/corros|[óo]xido/i, IconCorrosion],
  [/armadura/i, IconRebar], // "armadura a la vista" / "con armadura a la vista"
  [/fisura|grieta/i, IconCrack],
  [/coquera|nido/i, IconHoneycomb],
  [/eflorescen/i, IconEfflorescence],
  [/humed|filtr/i, Droplet],
  [/deform|flecha/i, IconDeflection],
  [/pandeo|abolladura|abombamiento/i, IconBuckling],
  [/desplome|alineac|desplaz|inclinac/i, IconTilt],
  [/disgreg|pulveri|lajaci/i, IconCrumbling],
  [/descascar|desconch|desprend|rotura|p[ée]rdida de pieza/i, IconSpalling],
  [/aplastam/i, IconCrushing],
  [/mortero|junta/i, IconMortar],
  [/tratamiento protector|pintura|galvaniz|recubrimiento protector/i, IconCoating],
  [/pudrici|xil[óo]fag|hongo/i, IconRot],
  [/soldadura|cord[óo]n/i, IconWeld],
  [/perno|anclaje|tornillo|robl[óo]n|conexi[óo]n/i, IconBolt],
  [/descalce|socavaci|c[áa]rcava|aterram/i, IconScour],
  [/vegetaci|biol[óo]gic|musgo|liquen/i, Sprout],
  [/alteraci[óo]n superficial|meteorizaci|erosi|abrasi/i, IconSurface],
]

export function iconForDamage(name?: string): Component {
  if (name) for (const [re, ic] of RULES) if (re.test(name)) return ic
  return CircleHelp
}
