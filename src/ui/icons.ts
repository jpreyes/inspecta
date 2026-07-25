import type { Component } from 'vue'
import {
  Spline,
  Zap,
  Layers2,
  Anvil,
  Grid3x3,
  Snowflake,
  TrendingDown,
  Bone,
  Droplet,
  Waves,
  CircleHelp,
} from 'lucide-vue-next'
import type { DamageType } from '../types/inspection'

/** Ícono (Lucide) para cada tipo de daño estructural. */
export const damageIcon: Record<DamageType, Component> = {
  fisura: Spline, // línea sinuosa fina
  grieta: Zap, // quiebre diagonal
  descascaramiento: Layers2, // capas desprendiéndose
  corrosion: Anvil, // metal / armadura
  nido_piedra: Grid3x3, // huecos / segregación
  eflorescencia: Snowflake, // sales blancas
  deflexion: TrendingDown, // flecha / descenso
  armadura_expuesta: Bone, // barras a la vista
  humedad: Droplet, // filtración
  pandeo: Waves, // inestabilidad
  otro: CircleHelp,
}
