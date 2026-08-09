/// <reference path="../pb_data/types.d.ts" />
// Asignación de inspectores POR ESTRUCTURA.
//
// Hasta aquí el permiso era por equipo: cualquier inspector del equipo podía
// trabajar en cualquier estructura. Ahora cada estructura tiene su lista de
// inspectores asignados (`structures.inspectors`), y es muchos-a-muchos: Juan
// puede atender el Puente X y el Y, y Carlos el Z y también el Y.
//
// Regla de escritura sobre el trabajo de terreno (campañas, hallazgos, ensayos):
//   · admin del equipo            → siempre
//   · inspector del equipo        → solo si está asignado a la estructura,
//                                   O si la estructura no tiene asignados
//                                   (lista vacía = abierta a todo el equipo,
//                                    que es el comportamiento anterior)
//   · revisor / cliente           → nunca
//
// Asignar es competencia del admin: `structures` solo lo puede actualizar él
// (regla heredada de la migración de equipos), así que la lista está protegida.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // ── campo de asignación en structures ────────────────────
    const structures = app.findCollectionByNameOrId('structures')
    structures.fields.add(
      new Field({
        name: 'inspectors',
        type: 'relation',
        required: false,
        maxSelect: 0, // multi
        cascadeDelete: false,
        collectionId: users.id,
      }),
    )
    app.save(structures)

    // ── fragmentos de regla ──────────────────────────────────
    // `s` = ruta hasta la estructura, `t` = ruta hasta el equipo.
    const admin = (t) => `${t}admins ?= @request.auth.id`
    // Inspector del equipo Y habilitado en esta estructura (o estructura abierta).
    const assignedInspector = (s, t) =>
      `(${t}inspectors ?= @request.auth.id && ` +
      `(${s}inspectors:length = 0 || ${s}inspectors ?= @request.auth.id))`
    const canWork = (s, t) => `${admin(t)} || ${assignedInspector(s, t)}`

    // Colecciones de trabajo de terreno y cómo llegar a su estructura.
    const config = [
      { name: 'inspections', path: 'structure.', bodyPath: '@request.body.structure.' },
      { name: 'findings', path: 'inspection.structure.', bodyPath: '@request.body.inspection.structure.' },
      { name: 'tests', path: 'inspection.structure.', bodyPath: '@request.body.inspection.structure.' },
    ]

    for (const c of config) {
      const col = app.findCollectionByNameOrId(c.name)
      const write = `owner = @request.auth.id || (${canWork(c.path, 'team.')})`
      col.createRule =
        `@request.auth.id != "" && (@request.body.team = "" || ` +
        `${canWork(c.bodyPath, '@request.body.team.')})`
      col.updateRule = write
      col.deleteRule = write
      app.save(col)
    }
  },
  (app) => {
    // ── revertir: vuelve al permiso por equipo, sin asignación ──
    const byTeam = (t) => `${t}admins ?= @request.auth.id || ${t}inspectors ?= @request.auth.id`
    for (const name of ['inspections', 'findings', 'tests']) {
      try {
        const col = app.findCollectionByNameOrId(name)
        col.createRule =
          `@request.auth.id != "" && (@request.body.team = "" || ${byTeam('@request.body.team.')})`
        col.updateRule = `owner = @request.auth.id || (${byTeam('team.')})`
        col.deleteRule = col.updateRule
        app.save(col)
      } catch (e) {
        /* noop */
      }
    }
    try {
      const structures = app.findCollectionByNameOrId('structures')
      structures.fields.removeByName('inspectors')
      app.save(structures)
    } catch (e) {
      /* noop */
    }
  },
)
