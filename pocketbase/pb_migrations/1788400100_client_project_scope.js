/// <reference path="../pb_data/types.d.ts" />
// El cliente ve SOLO sus proyectos, y no escribe nada.
//
// Hasta acá el rol `cliente` era "miembro del equipo con permiso de lectura":
// veía TODOS los proyectos del equipo, no solo aquellos en los que participa.
// Con un equipo que atiende a varios mandantes eso es una filtración — el
// cliente A leía los hallazgos del cliente B.
//
// Dos cambios:
//
// 1. `projects.clients` — lista de clientes asignados A ESE PROYECTO. Es el
//    equivalente para clientes de `structures.inspectors`, pero con la
//    convención al revés: una lista vacía NO abre el proyecto a todos los
//    clientes del equipo, lo cierra. Un permiso de lectura que se hereda del
//    equipo es justamente lo que se está corrigiendo, así que falla cerrado:
//    sin asignación explícita, el cliente no ve el proyecto.
//
//    El resto del equipo (admins, inspectores, revisores) sigue viendo todo:
//    la asignación solo filtra a los clientes.
//
// 2. La salida `owner = @request.auth.id` de las reglas queda acotada a los
//    registros SIN equipo. Existía para que los registros personales
//    anteriores a los equipos siguieran siendo accesibles, y esos tienen
//    `team = ''`; sobre un registro de equipo era un agujero: quien creó algo
//    y después bajó a cliente seguía pudiendo editarlo y borrarlo.
//
// Escritura: sin cambios de fondo — proyectos y estructuras solo el admin;
// campañas, hallazgos y ensayos el admin o el inspector asignado. El cliente
// no aparece en ninguna regla de escritura, así que no puede crear, modificar
// ni borrar daños ni ensayos.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // ── campo de asignación en projects ──────────────────────
    const projects = app.findCollectionByNameOrId('projects')
    if (!projects.fields.getByName('clients')) {
      projects.fields.add(
        new Field({
          name: 'clients',
          type: 'relation',
          required: false,
          maxSelect: 0, // multi (0 NO es "sin límite" si se deja el default: hay que declararlo)
          cascadeDelete: false,
          collectionId: users.id,
        }),
      )
      app.save(projects)
    }

    // ── fragmentos de regla ──────────────────────────────────
    // OJO: sobre relaciones MÚLTIPLES hay que comparar `campo.id ?= …`; la
    // forma corta `campo ?= …` devuelve cero (ver 1721000402).
    //
    // `t` = ruta hasta el equipo · `p` = ruta hasta el proyecto
    // `s` = ruta hasta la estructura
    const personal = 'team = "" && owner = @request.auth.id'
    const staff = (t) =>
      `${t}admins.id ?= @request.auth.id || ${t}inspectors.id ?= @request.auth.id || ` +
      `${t}reviewers.id ?= @request.auth.id`
    // Cliente del equipo Y asignado a este proyecto. Las dos condiciones: la
    // primera es la pertenencia, la segunda el alcance.
    const assignedClient = (t, p) =>
      `(${t}clients.id ?= @request.auth.id && ${p}clients.id ?= @request.auth.id)`
    const canRead = (t, p) => `(${personal}) || (${staff(t)}) || ${assignedClient(t, p)}`

    const isAdmin = (t) => `${t}admins.id ?= @request.auth.id`
    const assignedInspector = (s, t) =>
      `(${t}inspectors.id ?= @request.auth.id && ` +
      `(${s}inspectors:length = 0 || ${s}inspectors.id ?= @request.auth.id))`
    const canWork = (s, t) => `${isAdmin(t)} || ${assignedInspector(s, t)}`

    // ── proyectos y estructuras ──────────────────────────────
    // Lectura acotada al cliente asignado; escritura solo del admin.
    for (const c of [
      { name: 'projects', project: '' },
      { name: 'structures', project: 'project.' },
    ]) {
      const col = app.findCollectionByNameOrId(c.name)
      const read = canRead('team.', c.project)
      col.listRule = read
      col.viewRule = read
      col.updateRule = `(${personal}) || ${isAdmin('team.')}`
      col.deleteRule = col.updateRule
      app.save(col)
    }

    // ── trabajo de terreno ───────────────────────────────────
    const fieldWork = [
      { name: 'inspections', structure: 'structure.', project: 'structure.project.' },
      {
        name: 'findings',
        structure: 'inspection.structure.',
        project: 'inspection.structure.project.',
      },
      {
        name: 'tests',
        structure: 'inspection.structure.',
        project: 'inspection.structure.project.',
      },
    ]
    for (const c of fieldWork) {
      const col = app.findCollectionByNameOrId(c.name)
      const read = canRead('team.', c.project)
      col.listRule = read
      col.viewRule = read
      col.updateRule = `(${personal}) || (${canWork(c.structure, 'team.')})`
      col.deleteRule = col.updateRule
      app.save(col)
    }

    // ── traspaso: conservar lo que cada cliente ve HOY ────────
    // Sin esto la migración le quitaría el proyecto al cliente que ya tenía
    // acceso (la regla nueva falla cerrado). Cada proyecto de equipo hereda,
    // una sola vez, la lista de clientes de su equipo; de ahí en adelante la
    // asignación se administra por proyecto.
    for (const p of app.findAllRecords('projects')) {
      const teamId = p.getString('team')
      if (!teamId) continue
      if ((p.get('clients') || []).length) continue
      let team
      try {
        team = app.findRecordById('teams', teamId)
      } catch (e) {
        continue // el equipo ya no existe
      }
      const clients = team.get('clients') || []
      if (!clients.length) continue
      p.set('clients', clients)
      app.save(p)
    }
  },
  (app) => {
    // ── revertir: lectura para todo el equipo, sin alcance por proyecto ──
    const isMember = (t) =>
      `${t}admins.id ?= @request.auth.id || ${t}inspectors.id ?= @request.auth.id || ` +
      `${t}reviewers.id ?= @request.auth.id || ${t}clients.id ?= @request.auth.id`
    const isAdmin = (t) => `${t}admins.id ?= @request.auth.id`
    const assignedInspector = (s, t) =>
      `(${t}inspectors.id ?= @request.auth.id && ` +
      `(${s}inspectors:length = 0 || ${s}inspectors.id ?= @request.auth.id))`
    const canWork = (s, t) => `${isAdmin(t)} || ${assignedInspector(s, t)}`

    for (const name of ['projects', 'structures']) {
      const col = app.findCollectionByNameOrId(name)
      const read = `owner = @request.auth.id || (${isMember('team.')})`
      col.listRule = read
      col.viewRule = read
      col.updateRule = `owner = @request.auth.id || (${isAdmin('team.')})`
      col.deleteRule = col.updateRule
      app.save(col)
    }
    for (const c of [
      { name: 'inspections', structure: 'structure.' },
      { name: 'findings', structure: 'inspection.structure.' },
      { name: 'tests', structure: 'inspection.structure.' },
    ]) {
      const col = app.findCollectionByNameOrId(c.name)
      const read = `owner = @request.auth.id || (${isMember('team.')})`
      col.listRule = read
      col.viewRule = read
      col.updateRule = `owner = @request.auth.id || (${canWork(c.structure, 'team.')})`
      col.deleteRule = col.updateRule
      app.save(col)
    }
    try {
      const projects = app.findCollectionByNameOrId('projects')
      projects.fields.removeByName('clients')
      app.save(projects)
    } catch (e) {
      /* noop */
    }
  },
)
