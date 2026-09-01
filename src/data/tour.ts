// ─────────────────────────────────────────────────────────────
// Guía de la plataforma (tour guiado).
//
// Cada paso ilumina un elemento real de la interfaz (`target`, un selector
// `[data-tour="…"]`) y, si hace falta, deja la app en la vista donde ese
// elemento existe. El orden sigue el trabajo real de una inspección:
// conectarse → elegir la estructura → abrir la campaña → registrar daños →
// ensayos → resultados e informe → volver a sincronizar.
//
// Si un paso apunta a algo que no está en pantalla (por ejemplo el botón de
// registrar daño cuando el rol es de solo lectura), la tarjeta se muestra
// centrada: el texto sigue sirviendo aunque no haya nada que iluminar.
// ─────────────────────────────────────────────────────────────

import type { AppView } from '../stores/inspection'

export interface TourStep {
  id: string
  title: string
  body: string
  /** Viñetas opcionales para los pasos con varios campos que explicar. */
  bullets?: string[]
  /** Elemento a iluminar. Sin `target`, la tarjeta va centrada. */
  target?: string
  /** Vista que debe estar activa para que el paso tenga sentido. */
  view?: AppView
  /** Abre el menú lateral (en móvil es un cajón deslizante). */
  openSidebar?: boolean
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'bienvenida',
    title: 'Inspecta en tres minutos',
    body:
      'Inspecta registra inspecciones estructurales periódicas: cada visita a terreno es una campaña con su fecha, sus daños, sus ensayos y su informe. No es monitoreo continuo — es la foto del estado de la estructura en cada visita, para poder comparar cómo evoluciona.',
    bullets: [
      'Todo se guarda primero en este dispositivo: la app funciona completa sin señal.',
      'Al volver a tener conexión, sincronizas y tu trabajo sube al servidor.',
      'Los proyectos son del equipo, no del teléfono: por eso hay que entrar con tu cuenta para verlos.',
    ],
  },
  {
    id: 'conectar',
    title: 'Sincronizar',
    body:
      '“Sincronizar ahora” hace las dos direcciones: baja los encargos que te asignaron y sube los daños, fotos y ensayos que registraste en terreno. La primera sincronización es la que trae tu estructura al dispositivo.',
    bullets: [
      'Sin conexión el botón no hace falta: sigue trabajando y sincroniza después.',
      'Tu sesión se revalida sola cada vez que hay internet, y aguanta hasta 14 días sin validar.',
      'Cerrar sesión oculta todos los datos y exige conexión para volver a entrar: sincroniza antes.',
    ],
    target: '[data-tour="sync"]',
  },
  {
    id: 'equipo',
    title: 'Tu equipo y tu rol',
    body:
      'Un equipo agrupa los proyectos, las estructuras y las personas. Tu rol decide qué puedes hacer, y el servidor lo impone (no es solo la interfaz).',
    bullets: [
      'Administrador: crea proyectos y estructuras, y asigna inspectores.',
      'Inspector: registra campañas, daños, fotos y ensayos en las estructuras que tiene asignadas.',
      'Revisor y Cliente: solo consultan e informan.',
    ],
    target: '[data-tour="team"]',
  },
  {
    id: 'estructuras',
    title: 'Proyectos y estructuras',
    body:
      'El menú lateral ordena el trabajo: proyecto ▸ estructura. Haz clic en una estructura para dejarla activa; todo lo demás (campañas, daños, resultados) se refiere a ella.',
    bullets: [
      'CIC Máfil es el encargo real y llega desde el servidor.',
      'Lo que dice “ejemplo” en el nombre es material de práctica de este dispositivo: no se sube a ninguna parte y se puede borrar desde el último paso de esta guía.',
    ],
    target: '[data-tour="sidebar"]',
    openSidebar: true,
  },
  {
    id: 'vistas',
    title: 'Las vistas',
    body:
      'Lista es la tabla de daños de la campaña y el lugar donde se trabaja. Ensayos registra los ensayos de la visita. Resultados resume la condición, el riesgo y el informe. Gemelo 3D aparece solo en estructuras que tienen modelo tridimensional.',
    target: '[data-tour="views"]',
  },
  {
    id: 'campanas',
    title: 'Campañas: una por visita',
    body:
      'Cada visita a terreno es una campaña con su fecha, su inspector y su clima. Los daños se registran siempre dentro de la campaña que esté seleccionada, así que revisa la fecha antes de empezar.',
    bullets: [
      '“Nueva” crea la campaña de hoy cuando vuelvas a visitar la estructura.',
      'Al cambiar de campaña, la app muestra el estado tal como estaba en esa fecha.',
    ],
    target: '[data-tour="campaigns"]',
    view: 'list',
  },
  {
    id: 'nuevo-dano',
    title: 'Registrar un daño',
    body:
      'Este es el botón que más vas a usar. El formulario va en cascada, de lo general a lo particular, y cada campo tiene la opción “Otro…” para escribir libremente cuando el catálogo no alcanza.',
    bullets: [
      'Componente → Elemento → Material → Zona → Tipo de daño → Causa probable.',
      'Severidad de 0 a 4 y extensión en % del elemento afectado.',
      'Fotos: el botón abre la cámara del teléfono; quedan guardadas aunque no haya señal.',
      'La causa no baja la condición: alimenta la prioridad de intervención.',
    ],
    target: '[data-tour="new-damage"]',
    view: 'list',
  },
  {
    id: 'tabla',
    title: 'La tabla de daños',
    body:
      'Cada fila es un hallazgo de la campaña activa, con su índice de daño, sus fotos y quién lo registró. Desde acá se revisa lo levantado en el día y se elimina lo que haya quedado mal.',
    target: '[data-tour="damage-table"]',
    view: 'list',
  },
  {
    id: 'resultados',
    title: 'Condición y prioridades',
    body:
      'La condición es un índice de salud de 0 a 100 (100 = sana) calculado desde los daños de la campaña: severidad, extensión, criticidad del deterioro y de la zona, y la importancia del elemento.',
    bullets: [
      'El semáforo: bajo 40 crítica, 40–75 con observaciones, sobre 75 operativa.',
      'Los hallazgos priorizados ordenan la intervención combinando el daño con el riesgo de su causa.',
    ],
    target: '[data-tour="kpis"]',
    view: 'results',
  },
  {
    id: 'sitio',
    title: 'Vulnerabilidad y sitio',
    body:
      'Acá se registran las irregularidades de configuración (NCh433 / ASCE 7) y los datos del sitio: zona sísmica, tipo de suelo y categoría de ocupación. Con eso la app calcula la amenaza y cruza condición × amenaza para estimar el riesgo.',
    target: '[data-tour="vuln"]',
    view: 'results',
  },
  {
    id: 'ensayos',
    title: 'Ensayos de la campaña',
    body:
      '“Nuevo ensayo” registra los ensayos de la visita: esclerometría, carbonatación, extracción de testigos, pacometría y los que hagan falta. Los atajos de arriba rellenan método y norma; tú completas laboratorio, ubicación de la muestra y el resultado.',
    bullets: [
      'El resultado es texto libre: escribe la cifra y su unidad (por ejemplo “f’c estimado 24 MPa”).',
      'Los ensayos quedan en el informe Word junto a los daños.',
    ],
    target: '[data-tour="tests"]',
    view: 'tests',
  },
  {
    id: 'informe',
    title: 'Informe',
    body:
      'El informe Word se arma en el dispositivo con la campaña activa: condición, riesgo, hallazgos priorizados con sus fotos y los ensayos. El botón de impresora entrega la misma vista en PDF.',
    target: '[data-tour="report"]',
    view: 'results',
  },
  {
    id: 'terreno',
    title: 'En terreno',
    body:
      'Sal a terreno sin preocuparte de la señal: la app abre, registra y guarda igual sin conexión mientras tu sesión siga vigente. Al volver a cobertura, entra acá y sincroniza para que tu trabajo quede en el servidor y el resto del equipo lo vea.',
    bullets: [
      'Puedes volver a abrir esta guía cuando quieras, con el botón “Guía”.',
      'Si pasan más de 14 días sin conectarte, la app te va a pedir internet para validar la sesión.',
    ],
    target: '[data-tour="sync"]',
    // Termina donde empieza el trabajo: la lista de daños de la campaña.
    view: 'list',
  },
]
