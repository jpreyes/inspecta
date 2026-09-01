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
