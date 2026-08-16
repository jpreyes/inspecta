/// <reference path="../pb_data/types.d.ts" />
// Reglas corregidas para relaciones MÚLTIPLES.
//
// Sobre una relación de un solo registro, `admins ?= @request.auth.id` compara
// el id guardado y funciona. Sobre una relación múltiple no: el campo resuelve
// a los registros relacionados, así que hay que decir contra qué se compara —
// `admins.id ?= @request.auth.id`. Comprobado en PocketBase 0.39.10:
//
//     admins ?= 'yfje…'        → 0 registros   ← lo que había
//     admins.id ?= 'yfje…'     → 1 registro    ← lo que corresponde
//     admins:each = 'yfje…'    → 1 registro
//
// Como las migraciones 1721000100 y 1721000300 escribieron las reglas con la
// forma corta, al pasar los campos a múltiples (1721000400) el equipo dejó de
// ser visible para sus propios miembros: nadie tenía rol y nadie veía nada.
// Acá se reescriben todas las reglas afectadas, en su estado final.
migrate(
  (app) => {
    // `p` es el prefijo hasta el equipo: '' sobre el propio equipo, 'team.'
    // desde una colección de datos, '@request.body.team.' al crear.
    const isMember = (p) =>
      `${p}admins.id ?= @request.auth.id || ${p}inspectors.id ?= @request.auth.id || ` +
      `${p}reviewers.id ?= @request.auth.id || ${p}clients.id ?= @request.auth.id`
    const isAdmin = (p) => `${p}admins.id ?= @request.auth.id`
    // Inspector del equipo Y habilitado en esa estructura (`s` = ruta hasta la
    // estructura). Estructura sin asignados = abierta a todo el equipo.
    const assignedInspector = (s, t) =>
      `(${t}inspectors.id ?= @request.auth.id && ` +
      `(${s}inspectors:length = 0 || ${s}inspectors.id ?= @request.auth.id))`
    const canWork = (s, t) => `${isAdmin(t)} || ${assignedInspector(s, t)}`

    // ── teams ────────────────────────────────────────────────
    const teams = app.findCollectionByNameOrId('teams')
    teams.listRule = isMember('')
    teams.viewRule = isMember('')
    teams.createRule = '@request.auth.id != ""'
    teams.updateRule = isAdmin('')
    teams.deleteRule = isAdmin('')
    app.save(teams)

    // ── proyectos y estructuras: los administra el admin ──────
    for (const name of ['projects', 'structures']) {
      const col = app.findCollectionByNameOrId(name)
      const read = `owner = @request.auth.id || (${isMember('team.')})`
      col.listRule = read
      col.viewRule = read
      col.createRule =
        `@request.auth.id != "" && (@request.body.team = "" || ` +
        `${isAdmin('@request.body.team.')})`
      col.updateRule = `owner = @request.auth.id || (${isAdmin('team.')})`
      col.deleteRule = col.updateRule
      app.save(col)
    }

    // ── trabajo de terreno: admin o inspector asignado ────────
    const fieldWork = [
      { name: 'inspections', path: 'structure.', body: '@request.body.structure.' },
      { name: 'findings', path: 'inspection.structure.', body: '@request.body.inspection.structure.' },
      { name: 'tests', path: 'inspection.structure.', body: '@request.body.inspection.structure.' },
    ]
    for (const c of fieldWork) {
      const col = app.findCollectionByNameOrId(c.name)
      const read = `owner = @request.auth.id || (${isMember('team.')})`
      col.listRule = read
      col.viewRule = read
      col.createRule =
        `@request.auth.id != "" && (@request.body.team = "" || ` +
        `${canWork(c.body, '@request.body.team.')})`
      col.updateRule = `owner = @request.auth.id || (${canWork(c.path, 'team.')})`
      col.deleteRule = col.updateRule
      app.save(col)
    }
  },
  (app) => {
    // Volver a la forma corta solo tendría sentido con relaciones simples,
    // que es justamente el estado roto: no se revierte.
  },
)
