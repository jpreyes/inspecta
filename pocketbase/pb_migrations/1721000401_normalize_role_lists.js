/// <reference path="../pb_data/types.d.ts" />
// Red de seguridad: deja como ARREGLO el valor de las listas de rol y de
// inspectores asignados, por si algún registro quedó con un id suelto.
//
// Comprobado en PocketBase 0.39.10 sobre una colección de prueba: al ampliar
// una relación de simple a múltiple, PocketBase **sí** reescribe lo guardado
// (`'abc'` → `'["abc"]'`). O sea que después de 1721000400 no había nada que
// arreglar acá, y esta migración normalmente no toca ninguna fila. Se mantiene
// porque sale barata y cubre el caso de un registro escrito por fuera de la
// API —un script contra la base, una restauración parcial—, donde un valor
// suelto rompe en silencio toda regla que use `?=` (json_each no encuentra
// nada sobre un texto que no es JSON).
//
// Lo que sí había que arreglar eran las REGLAS: ver 1721000402.
const TARGETS = [
  { collection: 'teams', fields: ['admins', 'inspectors', 'reviewers', 'clients'] },
  { collection: 'structures', fields: ['inspectors'] },
]

migrate(
  (app) => {
    for (const t of TARGETS) {
      let records = []
      try {
        records = app.findAllRecords(t.collection)
      } catch (e) {
        continue // la colección no existe (base a medio construir)
      }
      for (const rec of records) {
        let changed = false
        for (const name of t.fields) {
          const raw = rec.get(name)
          if (Array.isArray(raw)) continue
          rec.set(name, raw ? [String(raw)] : [])
          changed = true
        }
        if (changed) app.save(rec)
      }
    }
  },
  (app) => {
    // Sin vuelta atrás: el arreglo es la forma correcta del dato.
  },
)
