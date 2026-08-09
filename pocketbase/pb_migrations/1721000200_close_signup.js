/// <reference path="../pb_data/types.d.ts" />
// Cierra el auto-registro de usuarios.
//
// PocketBase deja `users.createRule = ""` por defecto, o sea que CUALQUIERA
// puede crearse una cuenta contra la API pública. Como la migración de equipos
// abrió `users.listRule` a usuarios autenticados (necesario para invitar por
// email y para mostrar los miembros del equipo), dejar el registro abierto
// convertiría el directorio de usuarios en algo enumerable por cualquiera que
// se registre.
//
// Con `createRule = null` las cuentas solo las crea un superusuario desde el
// panel (`/_/`) o por CLI, que es el flujo de invitación que usa la app.
// Si en algún momento quieres auto-registro, vuelve a poner "" en el panel.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.createRule = null
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.createRule = ''
    app.save(users)
  },
)
