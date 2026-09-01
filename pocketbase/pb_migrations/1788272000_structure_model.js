/// <reference path="../pb_data/types.d.ts" />
// Modelo 3D importado (gemelo digital) por estructura.
//
// Hasta acá el gemelo solo existía si se generaba el pórtico paramétrico AL
// CREAR la estructura: después no había forma de agregarle uno, y una estructura
// dada de alta sin marcar la casilla se quedaba sin 3D para siempre. Ahora el
// modelo puede llegar como archivo IFC o glTF/GLB en cualquier momento.
//
// El archivo va en PocketBase y no en el registro de la estructura porque son
// megabytes: `structures.elements` (la capa semántica) sigue siendo JSON y viaja
// en cada sync, mientras que la geometría se baja UNA vez por dispositivo y se
// cachea en IndexedDB.
//
// `model` es campo de archivo con maxSelect 1 — cambiar el modelo reemplaza el
// anterior, no acumula versiones. 64 MB de tope: el cliente ya rechaza sobre 60,
// y el margen deja pasar el overhead del multipart.
//
// Nota de permisos: la escritura de `structures` es solo del administrador
// (migración 1721000402), así que quién puede cargar el modelo ya está resuelto
// y no hay reglas nuevas que escribir.
migrate(
  (app) => {
    const structures = app.findCollectionByNameOrId('structures')
    structures.fields.add(
      new Field({
        name: 'model',
        type: 'file',
        required: false,
        maxSelect: 1,
        maxSize: 67108864, // 64 MB
        // Sin mimeTypes: un .ifc es texto plano y los navegadores lo mandan como
        // application/octet-stream, text/plain o vacío según el sistema. Filtrar
        // por mime rechazaría archivos válidos; la extensión la valida el cliente.
      }),
    )
    // Metadato del modelo: formato, nombre original, cuándo se importó y cuántos
    // elementos trajo. Va separado del archivo porque el cliente lo necesita
    // para DECIDIR si baja la geometría —en terreno, con datos móviles, saber
    // "hay un IFC de 8 MB con 1.240 elementos" antes de descargarlo es la
    // diferencia entre una app usable y una que se cuelga sola.
    structures.fields.add(
      new Field({
        name: 'model_meta',
        type: 'json',
        required: false,
        maxSize: 2000,
      }),
    )
    app.save(structures)
  },
  (app) => {
    const structures = app.findCollectionByNameOrId('structures')
    structures.fields.removeByName('model')
    structures.fields.removeByName('model_meta')
    app.save(structures)
  },
)
