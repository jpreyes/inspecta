/// <reference path="../pb_data/types.d.ts" />
// Daños en elementos NO ESTRUCTURALES.
//
// Un cielo desprendido, un cristal trizado o una baranda suelta son parte de la
// inspección —hay que registrarlos, fotografiarlos e informarlos— pero no dicen
// nada de la capacidad resistente, así que no entran en la calificación
// estructural (es la separación de ATC-20 / EMS-98). El cliente lo decide con
// `Finding.nonStructural`; acá se agrega la columna para que viaje en el sync.
//
// Se guarda EXPLÍCITO y no se deduce del nombre del elemento porque el nombre
// admite texto libre ("Otro…"): un "Cielo americano del hall" escrito a mano no
// calzaría con ninguna lista. Para los hallazgos anteriores a este campo el
// cliente resuelve por nombre (`NONSTRUCT_BY_NAME` en types/inspection.ts), así
// que no hay que rellenar filas viejas: `false` es el valor correcto para todo
// lo ya registrado, que se hizo con el catálogo estructural.
migrate(
  (app) => {
    const findings = app.findCollectionByNameOrId('findings')
    findings.fields.add(
      new Field({
        name: 'non_structural',
        type: 'bool',
        required: false,
      }),
    )
    app.save(findings)
  },
  (app) => {
    const findings = app.findCollectionByNameOrId('findings')
    findings.fields.removeByName('non_structural')
    app.save(findings)
  },
)
