// Ensayos frecuentes en inspección de estructuras de hormigón y albañilería.
//
// Son atajos para el formulario de ensayos: rellenan tipo, método y norma —lo
// que siempre se escribe igual y siempre se escribe mal— y dejan al inspector
// solo el laboratorio, la ubicación de la muestra y el resultado. No son un
// catálogo cerrado: el tipo sigue siendo texto libre.

export interface TestPreset {
  testType: string
  method: string
  standard: string
  /** Ejemplo de cómo se escribe el resultado (va de placeholder). */
  resultHint: string
}

export const TEST_PRESETS: TestPreset[] = [
  {
    testType: 'Esclerometría',
    method: 'Índice de rebote (martillo Schmidt)',
    standard: 'NCh1565 / ASTM C805',
    resultHint: "f'c estimado 24 MPa (rebote medio 38, 10 impactos)",
  },
  {
    testType: 'Carbonatación',
    method: 'Aspersión de fenolftaleína',
    standard: 'UNE-EN 14630',
    resultHint: 'Frente de carbonatación 18 mm — supera el recubrimiento',
  },
  {
    testType: 'Extracción de testigos',
    method: 'Testigo diamantino ensayado a compresión',
    standard: 'NCh1171 / ASTM C42',
    resultHint: "f'c 21 MPa (testigo Ø75 mm, esbeltez 2)",
  },
  {
    testType: 'Pacometría',
    method: 'Detección electromagnética de armaduras',
    standard: 'BS 1881-204',
    resultHint: 'Recubrimiento 15–20 mm; estribos Ø8 @ 20 cm',
  },
  {
    testType: 'Ultrasonido',
    method: 'Velocidad de pulso ultrasónico, transmisión directa',
    standard: 'NCh1443 / ASTM C597',
    resultHint: 'Vp 3.600 m/s — hormigón de calidad media',
  },
  {
    testType: 'Potencial de corrosión',
    method: 'Media celda Cu/CuSO₄',
    standard: 'ASTM C876',
    resultHint: 'Potenciales de −180 a −340 mV — corrosión probable en zona húmeda',
  },
  {
    testType: 'Resistividad eléctrica',
    method: 'Wenner de cuatro puntas',
    standard: 'UNE 83988',
    resultHint: 'ρ 12 kΩ·cm — riesgo de corrosión moderado',
  },
  {
    testType: 'Humedad',
    method: 'Higrómetro de contacto',
    standard: '—',
    resultHint: 'Humedad superficial 6,5 % en muro sur',
  },
]
