/// <reference path="../pb_data/types.d.ts" />
// Las listas de rol del equipo —y la de inspectores asignados a una estructura—
// tienen que ser relaciones MULTI-VALOR. Las migraciones anteriores las
// declararon con `maxSelect: 0` creyendo que 0 significaba "sin límite".
//
// En PocketBase es al revés: una relación es múltiple solo si `maxSelect > 1`.
// Con 0 quedaron como relación de UN registro, y el efecto era silencioso:
//   · `teams.admins` guardaba un id suelto (`"abc"`), no un arreglo;
//   · el segundo inspector del equipo pisaba al primero;
//   · el cliente lee las listas con `Array.isArray(v) ? v : []`, así que sobre
//     un string veía las cuatro listas vacías → nadie tenía rol y la app caía
//     en "modo local" (permiso total en la interfaz) contra un servidor que sí
//     restringía. Las reglas con `?=` funcionaban igual, que es por lo que el
//     equipo de dos personas parecía andar bien.
//
// Al pasar de simple a múltiple, PocketBase convierte solo los valores ya
// guardados (los envuelve en un arreglo), así que no hay que rescribir filas.
const CAP = 100 // tope alto: es un límite de tamaño de lista, no de diseño

function setMaxSelect(app, collection, fields, value) {
  const col = app.findCollectionByNameOrId(collection)
  for (const name of fields) {
    const f = col.fields.getByName(name)
    if (f) f.maxSelect = value
  }
  app.save(col)
}

migrate(
  (app) => {
    setMaxSelect(app, 'teams', ['admins', 'inspectors', 'reviewers', 'clients'], CAP)
    setMaxSelect(app, 'structures', ['inspectors'], CAP)
  },
  (app) => {
    setMaxSelect(app, 'teams', ['admins', 'inspectors', 'reviewers', 'clients'], 0)
    setMaxSelect(app, 'structures', ['inspectors'], 0)
  },
)
