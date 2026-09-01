// ─────────────────────────────────────────────────────────────
// Catálogo de elementos NO ESTRUCTURALES.
//
// Son parte del edificio y de la inspección —se registran, se fotografían y
// salen en el informe— pero NO entran en la calificación estructural: un cielo
// desprendido o un cristal trizado no dicen nada de la capacidad resistente.
// La norma con la que se trabaja acá (ATC-20, EMS-98) separa exactamente eso:
// daño estructural vs. daño no estructural, y solo el primero gobierna la
// condición. Ver `inspectionScore` en src/types/inspection.ts.
//
// Ojo con la excepción clásica: un TABIQUE de albañilería dentro de un pórtico
// sí modifica la respuesta sísmica (pórtico-tabique, columna corta). Eso no se
// resuelve acá sino en el registro de vulnerabilidad por configuración
// (src/data/vulnerability.ts), que es donde vive ese mecanismo.
//
// El catálogo es UNO SOLO para todo tipo de estructura: los cielos, cristales,
// barandas e instalaciones de un edificio son los mismos de una nave o del
// paso bajo nivel de un puente.
import type { StructureCatalog } from './catalog'

/** Componentes → elementos no estructurales, con sus materiales y zonas. */
export const NONSTRUCTURAL_CATALOG: StructureCatalog = {
  components: [
    {
      component: 'Tabiquería y cielos',
      elements: [
        {
          element: 'Tabique divisorio',
          materials: ['Albañilería', 'Tabique de yeso-cartón', 'Tabique de madera', 'Panel liviano'],
          zones: ['Paño central', 'Encuentro con losa', 'Encuentro con pilar', 'Borde / perímetro', 'Vano de puerta', 'Otro'],
        },
        {
          element: 'Cielo falso',
          materials: ['Yeso-cartón', 'Placa mineral', 'Metálico', 'Madera'],
          zones: ['Paño central', 'Perímetro', 'Colgadores / suspensión', 'Otro'],
        },
        {
          element: 'Cielo aplicado',
          materials: ['Yeso', 'Estuco', 'Madera'],
          zones: ['Paño central', 'Perímetro', 'Otro'],
        },
      ],
    },
    {
      component: 'Revestimientos y fachada',
      elements: [
        {
          element: 'Revestimiento de fachada',
          materials: ['Estuco', 'Cerámica / porcelanato', 'Piedra', 'Panel metálico', 'Fibrocemento', 'Madera'],
          zones: ['Paño central', 'Borde / perímetro', 'Junta', 'Encuentro / esquina', 'Antepecho', 'Otro'],
        },
        {
          element: 'Muro cortina',
          materials: ['Aluminio y vidrio', 'Panel compuesto'],
          zones: ['Montante', 'Travesaño', 'Sello perimetral', 'Anclaje a losa', 'Otro'],
        },
        {
          element: 'Estuco / enlucido',
          materials: ['Mortero de cemento', 'Yeso'],
          zones: ['Paño central', 'Encuentro / esquina', 'Borde / perímetro', 'Otro'],
        },
        {
          element: 'Sello de junta',
          materials: ['Elastomérico', 'Mortero'],
          zones: ['Junta de dilatación', 'Junta constructiva', 'Perímetro de vano', 'Otro'],
        },
      ],
    },
    {
      component: 'Cubierta y aguas lluvias',
      elements: [
        {
          element: 'Cubierta / techumbre',
          materials: ['Zinc / acero galvanizado', 'Teja', 'Fibrocemento', 'Membrana asfáltica', 'Policarbonato'],
          zones: ['Faldón', 'Cumbrera', 'Alero', 'Encuentro con muro', 'Fijaciones', 'Otro'],
        },
        {
          element: 'Hojalatería',
          materials: ['Zinc / acero galvanizado', 'Aluminio', 'Cobre'],
          zones: ['Caballete', 'Forro de encuentro', 'Gotera', 'Otro'],
        },
        {
          element: 'Canaleta y bajada de aguas lluvias',
          materials: ['PVC', 'Zinc / acero galvanizado', 'Aluminio'],
          zones: ['Canaleta', 'Bajada', 'Descarga', 'Soportes', 'Otro'],
        },
        {
          element: 'Impermeabilización de losa',
          materials: ['Membrana asfáltica', 'Membrana líquida', 'Lámina sintética'],
          zones: ['Paño central', 'Perímetro / zócalo', 'Sumidero', 'Junta', 'Otro'],
        },
      ],
    },
    {
      component: 'Puertas, ventanas y cristales',
      elements: [
        {
          element: 'Ventana',
          materials: ['Aluminio', 'PVC', 'Madera', 'Acero'],
          zones: ['Marco', 'Hoja', 'Sello perimetral', 'Antepecho', 'Otro'],
        },
        {
          element: 'Cristal',
          materials: ['Vidrio monolítico', 'Vidrio laminado', 'Termopanel'],
          zones: ['Paño', 'Borde / perímetro', 'Otro'],
        },
        {
          element: 'Puerta',
          materials: ['Madera', 'Metálica', 'Vidrio', 'PVC'],
          zones: ['Marco', 'Hoja', 'Herrajes', 'Otro'],
        },
      ],
    },
    {
      component: 'Terminaciones y seguridad',
      elements: [
        {
          element: 'Baranda / pasamanos',
          materials: ['Acero', 'Aluminio', 'Madera', 'Vidrio', 'Hormigón'],
          zones: ['Anclaje a piso', 'Anclaje a muro', 'Pasamanos', 'Montante', 'Otro'],
        },
        {
          element: 'Antepecho / parapeto',
          materials: ['Albañilería', 'Hormigón', 'Panel liviano'],
          zones: ['Coronación', 'Encuentro con losa', 'Paño central', 'Otro'],
        },
        {
          element: 'Cornisa / elemento ornamental',
          materials: ['Hormigón', 'Estuco', 'Piedra', 'Madera'],
          zones: ['Anclaje', 'Cuerpo', 'Otro'],
        },
        {
          element: 'Pavimento interior',
          materials: ['Cerámica / porcelanato', 'Vinílico', 'Madera', 'Hormigón afinado', 'Alfombra'],
          zones: ['Paño central', 'Junta', 'Encuentro con muro', 'Otro'],
        },
        {
          element: 'Peldaño / revestimiento de escalera',
          materials: ['Cerámica / porcelanato', 'Madera', 'Metálico', 'Hormigón'],
          zones: ['Huella', 'Contrahuella', 'Nariz', 'Otro'],
        },
      ],
    },
    {
      component: 'Instalaciones y equipos',
      elements: [
        {
          element: 'Ducto de climatización',
          materials: ['Acero galvanizado', 'Fibra', 'Flexible'],
          zones: ['Tramo', 'Soporte / colgador', 'Unión', 'Otro'],
        },
        {
          element: 'Cañería / instalación sanitaria',
          materials: ['PVC', 'Cobre', 'Acero', 'PPR'],
          zones: ['Tramo', 'Unión', 'Soporte', 'Pasada por muro/losa', 'Otro'],
        },
        {
          element: 'Bandeja / canalización eléctrica',
          materials: ['Acero galvanizado', 'PVC'],
          zones: ['Tramo', 'Soporte / colgador', 'Otro'],
        },
        {
          element: 'Luminaria',
          materials: ['Metálico', 'Plástico'],
          zones: ['Anclaje / suspensión', 'Cuerpo', 'Otro'],
        },
        {
          element: 'Equipo anclado (estanque, máquina, rack)',
          materials: ['Acero', 'Plástico', 'Hormigón'],
          zones: ['Anclaje / pernos', 'Base / apoyo', 'Cuerpo', 'Conexiones flexibles', 'Otro'],
        },
      ],
    },
    {
      component: 'Exterior y entorno',
      elements: [
        {
          element: 'Muro no estructural / cierre perimetral',
          materials: ['Albañilería', 'Hormigón', 'Panel metálico', 'Reja'],
          zones: ['Paño central', 'Coronación', 'Base', 'Pilarete', 'Otro'],
        },
        {
          element: 'Pavimento exterior',
          materials: ['Hormigón', 'Asfalto', 'Adoquín', 'Baldosa'],
          zones: ['Paño central', 'Junta', 'Borde / solera', 'Otro'],
        },
        {
          element: 'Escala / pasarela metálica de servicio',
          materials: ['Acero', 'Aluminio', 'Rejilla'],
          zones: ['Anclaje', 'Peldaño', 'Baranda', 'Otro'],
        },
      ],
    },
  ],

  // Deterioros típicos de lo no estructural. Las bandas de gravedad son las
  // mismas 0–4 de la app; acá describen el criterio que usa el inspector.
  damages: [
    {
      name: 'Fisuras / grietas',
      materials: ['todos'],
      severity: [
          'Fisura fina, sin desprendimiento',
          'Fisura visible y continua',
          'Grieta abierta, con desprendimiento incipiente',
          'Grieta pasante, elemento inestable',
        ],
    },
    {
      name: 'Desprendimiento / caída de revestimiento',
      materials: ['todos'],
      severity: [
          'Abombamiento sin caída',
          'Piezas sueltas puntuales',
          'Caída de piezas en superficie apreciable',
          'Caída generalizada con riesgo de caída sobre personas',
        ],
    },
    {
      name: 'Filtración / humedad',
      materials: ['todos'],
      severity: [
          'Mancha de humedad',
          'Humedad recurrente con eflorescencia',
          'Goteo activo',
          'Filtración permanente que daña otros elementos',
        ],
    },
    {
      name: 'Rotura / quiebre',
      materials: ['todos'],
      severity: [
          'Astilladura o trizadura menor',
          'Pieza quebrada sin desprender',
          'Pieza quebrada y suelta',
          'Rotura con riesgo inmediato (cristal, pieza en altura)',
        ],
    },
    {
      name: 'Pérdida / falla de anclaje o fijación',
      materials: ['todos'],
      severity: [
          'Fijación holgada',
          'Fijaciones faltantes puntuales',
          'Anclaje corroído o suelto, elemento con juego',
          'Elemento sin anclaje efectivo, riesgo de desprendimiento',
        ],
    },
    {
      name: 'Corrosión',
      materials: ['Acero', 'Zinc / acero galvanizado', 'Aluminio', 'Metálico', 'Acero galvanizado', 'Cobre'],
      severity: [
          'Oxidación superficial',
          'Corrosión con pérdida de recubrimiento',
          'Corrosión con pérdida de sección',
          'Perforación / pérdida de la pieza',
        ],
    },
    {
      name: 'Deformación / desaplome',
      materials: ['todos'],
      severity: [
          'Deformación apenas perceptible',
          'Deformación visible sin afectar el uso',
          'Deformación que impide el uso normal',
          'Deformación con riesgo de colapso del elemento',
        ],
    },
    {
      name: 'Pérdida de estanqueidad / sello',
      materials: ['todos'],
      severity: [
          'Sello envejecido',
          'Sello agrietado',
          'Sello faltante en tramos',
          'Sin sello, con paso franco de agua',
        ],
    },
    {
      name: 'Pudrición / xilófagos',
      materials: ['Madera'],
      severity: [
          'Mancha superficial',
          'Ablandamiento localizado',
          'Pérdida de material',
          'Pieza destruida',
        ],
    },
    {
      name: 'Alteración superficial / manchas',
      materials: ['todos'],
      severity: [
          'Suciedad o decoloración',
          'Mancha extendida',
          'Pérdida de terminación',
          'Superficie completamente deteriorada',
        ],
    },
    {
      name: 'Vegetación / biológico',
      materials: ['todos'],
      severity: [
          'Musgo o mancha biológica',
          'Vegetación menor arraigada',
          'Vegetación que abre juntas',
          'Raíces que desplazan el elemento',
        ],
    },
    {
      name: 'Obstrucción',
      materials: ['todos'],
      severity: [
          'Acumulación menor de material',
          'Obstrucción parcial',
          'Obstrucción que provoca rebalse',
          'Obstrucción total con daño a otros elementos',
        ],
    },
  ],

  causesByDamage: {
    'Fisuras / grietas': ['asiento diferencial', 'acción sísmica', 'retracción', 'dilatación térmica', 'deficiente ejecución', 'causa desconocida'],
    'Desprendimiento / caída de revestimiento': ['humedad/filtración', 'deficiente ejecución', 'acción sísmica', 'envejecimiento', 'dilatación térmica', 'causa desconocida'],
    'Filtración / humedad': ['impermeabilización defectuosa', 'pérdida de sello', 'obstrucción de evacuación', 'condensación', 'rotura de instalación', 'causa desconocida'],
    'Rotura / quiebre': ['impacto', 'acción sísmica', 'vandalismo', 'dilatación térmica', 'causa desconocida'],
    'Pérdida / falla de anclaje o fijación': ['acción sísmica', 'corrosión', 'vibración', 'deficiente ejecución', 'envejecimiento', 'causa desconocida'],
    Corrosión: ['acción climática', 'humedad/filtración', 'pérdida de tratamiento protector', 'ambiente marino', 'causa desconocida'],
    'Deformación / desaplome': ['sobrecarga', 'acción sísmica', 'humedad/filtración', 'deficiente ejecución', 'causa desconocida'],
    'Pérdida de estanqueidad / sello': ['envejecimiento', 'acción climática', 'deficiente ejecución', 'causa desconocida'],
    'Pudrición / xilófagos': ['humedad/filtración', 'falta de mantención', 'causa desconocida'],
    'Alteración superficial / manchas': ['acción climática', 'envejecimiento', 'falta de mantención', 'vandalismo', 'causa desconocida'],
    'Vegetación / biológico': ['falta de mantención', 'humedad/filtración', 'causa desconocida'],
    Obstrucción: ['falta de mantención', 'sedimentación orgánica', 'causa desconocida'],
  },
}
