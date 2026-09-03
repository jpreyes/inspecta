/// <reference path="../pb_data/types.d.ts" />
// Un registro no puede quedarse sin equipo por accidente.
//
// Las reglas de lectura de esta base son
//   `owner = @request.auth.id || (es miembro del equipo DEL REGISTRO)`,
// así que borrarle el `team` a un proyecto no es un detalle: lo hace
// desaparecer para todo el equipo mientras su dueño lo sigue viendo igual —el
// peor síntoma posible, porque quien lo administra no nota nada—. Eso fue
// exactamente lo que pasó con el proyecto CIC Máfil: sus hallazgos tenían
// equipo y el proyecto no, así que la inspectora y el cliente veían el equipo
// pero ni un solo proyecto.
//
// La causa estaba en el cliente (mandaba el registro entero en cada
// sincronización, con `team: ''` si ese dispositivo nunca supo del equipo) y ya
// está corregida ahí. Este hook es la red de abajo: la app es una PWA con
// `autoUpdate`, así que un navegador con el bundle viejo sigue funcionando
// —y sigue mandando el `team` vacío— hasta que alguien lo recarga. Con esto,
// ninguna versión del cliente puede volver a vaciar el campo.
//
// Quitar de verdad un registro de su equipo se hace desde el panel `/_/`, que
// no pasa por acá.
onRecordUpdateRequest(
  (e) => {
    // Ojo con el JSVM: cada handler corre en su propia VM y no ve el ámbito del
    // archivo, así que todo lo que use tiene que estar acá adentro.
    const previo = e.record.original()
    for (const campo of ['team', 'author']) {
      const antes = previo.getString(campo)
      if (antes && !e.record.getString(campo)) e.record.set(campo, antes)
    }
    e.next()
  },
  'projects',
  'structures',
  'inspections',
  'findings',
  'tests',
)

// …y tampoco puede NACER sin equipo colgado del trabajo de otro.
//
// El campo `team` viene del cliente, y la regla de creación tiene una rama para
// el registro personal (`@request.body.team = ""`). Combinadas dejaban una
// grieta: cualquier cuenta autenticada —un cliente, por ejemplo— podía crear un
// hallazgo o un ensayo con `team: ''` apuntando a la campaña de un equipo en el
// que no puede escribir. El registro no lo veía nadie más (la regla de lectura
// lo deja en manos de su dueño), pero en la app de quien lo creó aparecía
// dentro de la campaña ajena, como un daño más del informe.
//
// Acá el equipo NO se hereda: se rechaza. Heredarlo se probó y hace lo
// contrario de lo que parece — la regla de creación se evalúa contra
// `@request.body`, o sea contra lo que MANDÓ el cliente, así que lo que el hook
// cambie después no se somete a ninguna regla: el hallazgo del cliente se
// guardaba con el equipo puesto y pasaba a verlo el equipo entero. Por eso la
// comprobación se hace acá, con los mismos filtros que las reglas (admin del
// equipo, o inspector asignado a la estructura).
//
// Un registro verdaderamente personal —modo local, sin servidor de por medio—
// cuelga de un padre sin equipo y no pasa por nada de esto.
onRecordCreateRequest(
  (e) => {
    // Cada handler corre en su propia VM: todo lo que use va acá adentro.
    const PADRE = {
      structures: { campo: 'project', coleccion: 'projects' },
      inspections: { campo: 'structure', coleccion: 'structures' },
      findings: { campo: 'inspection', coleccion: 'inspections' },
      tests: { campo: 'inspection', coleccion: 'inspections' },
    }
    // El superusuario administra desde el panel y no pasa por las reglas.
    if (e.hasSuperuserAuth()) return e.next()

    const nombre = e.record.collection().name
    const padre = PADRE[nombre]
    const padreId = padre ? e.record.getString(padre.campo) : ''
    if (!padreId) return e.next()

    let registroPadre
    try {
      registroPadre = e.app.findRecordById(padre.coleccion, padreId)
    } catch (err) {
      return e.next() // padre inexistente: que lo rechace la validación
    }
    const equipo = registroPadre.getString('team')
    if (!equipo) return e.next() // padre personal: nada que proteger

    const usuario = e.auth ? e.auth.id : ''
    // Se consulta con filtros en vez de comparar listas en JS: es el mismo
    // motor que evalúa las reglas, incluido el `?=` de las relaciones múltiples.
    const hay = (coleccion, filtro, params) => {
      try {
        e.app.findFirstRecordByFilter(coleccion, filtro, params)
        return true
      } catch (err) {
        return false
      }
    }
    const esAdmin = hay('teams', 'id = {:t} && admins.id ?= {:u}', { t: equipo, u: usuario })
    let puede = esAdmin
    if (!puede && hay('teams', 'id = {:t} && inspectors.id ?= {:u}', { t: equipo, u: usuario })) {
      // Inspector: además tiene que estar asignado a la estructura (o la
      // estructura estar abierta a todo el equipo).
      const estructuraId =
        nombre === 'inspections' ? padreId : registroPadre.getString('structure')
      puede =
        !estructuraId ||
        hay('structures', 'id = {:s} && (inspectors:length = 0 || inspectors.id ?= {:u})', {
          s: estructuraId,
          u: usuario,
        })
    }
    if (!puede) {
      throw new ForbiddenError('Tu rol no permite crear registros en este equipo.')
    }
    // Permiso confirmado: además se le pone el equipo del padre, para que no
    // nazca huérfano (es el mismo problema que persigue el hook de arriba).
    if (!e.record.getString('team')) e.record.set('team', equipo)
    e.next()
  },
  'structures',
  'inspections',
  'findings',
  'tests',
)
