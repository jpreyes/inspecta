/// <reference path="../pb_data/types.d.ts" />
// Equipos, roles y trazabilidad.
//
// · `teams`: agrupa proyectos y miembros. Los roles son CUATRO listas de
//   usuarios en el propio equipo (admins/inspectors/reviewers/clients).
//   Se hace así, y no con una colección `memberships`, porque en PocketBase las
//   condiciones sobre una relación multi-valor se evalúan de forma independiente
//   entre filas: "la misma membresía tiene este usuario Y este rol" no es
//   expresable de forma confiable. Con listas por rol cada regla mira un campo.
//
// · Se agrega `team` a las 5 colecciones de datos y `author` a las que registran
//   trabajo de terreno (inspections/findings/tests) para trazabilidad.
//
// · Las reglas mantienen `owner = @request.auth.id` como alternativa, para que
//   los registros personales anteriores a los equipos sigan siendo accesibles.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // ── teams ────────────────────────────────────────────────
    const roleField = (name) => ({
      name,
      type: 'relation',
      required: false,
      maxSelect: 0, // 0 = sin límite (multi)
      cascadeDelete: false,
      collectionId: users.id,
    })

    // Fragmentos de regla. `p` es el prefijo: '' sobre el propio equipo,
    // 'team.' desde una colección de datos, '@request.body.team.' al crear.
    const isMember = (p) =>
      `${p}admins ?= @request.auth.id || ${p}inspectors ?= @request.auth.id || ` +
      `${p}reviewers ?= @request.auth.id || ${p}clients ?= @request.auth.id`
    const canEdit = (p) => `${p}admins ?= @request.auth.id || ${p}inspectors ?= @request.auth.id`
    const canManage = (p) => `${p}admins ?= @request.auth.id`

    const teams = new Collection({
      type: 'base',
      name: 'teams',
      listRule: isMember(''),
      viewRule: isMember(''),
      // Cualquier usuario autenticado puede crear su equipo (queda como admin).
      createRule: '@request.auth.id != ""',
      updateRule: canManage(''),
      deleteRule: canManage(''),
      fields: [
        { name: 'name', type: 'text', required: true },
        roleField('admins'),
        roleField('inspectors'),
        roleField('reviewers'),
        roleField('clients'),
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(teams)

    // ── campos nuevos en las colecciones de datos ────────────
    const teamField = () => ({
      name: 'team',
      type: 'relation',
      required: false, // opcional: permite seguir usando la app en modo personal
      maxSelect: 1,
      cascadeDelete: false,
      collectionId: teams.id,
    })
    const authorField = () => ({
      name: 'author',
      type: 'relation',
      required: false,
      maxSelect: 1,
      cascadeDelete: false,
      collectionId: users.id,
    })

    // Nivel de permiso de escritura por colección:
    //  · projects/structures → solo admin (estructura del trabajo)
    //  · inspections/findings/tests → admin e inspector (trabajo de terreno)
    const config = [
      { name: 'projects', write: canManage, author: false },
      { name: 'structures', write: canManage, author: false },
      { name: 'inspections', write: canEdit, author: true },
      { name: 'findings', write: canEdit, author: true },
      { name: 'tests', write: canEdit, author: true },
    ]

    for (const c of config) {
      const col = app.findCollectionByNameOrId(c.name)
      col.fields.add(new Field(teamField()))
      if (c.author) col.fields.add(new Field(authorField()))

      const read = `owner = @request.auth.id || (${isMember('team.')})`
      const write = `owner = @request.auth.id || (${c.write('team.')})`

      col.listRule = read
      col.viewRule = read
      // Al crear: o es un registro personal (sin equipo), o el usuario tiene
      // permiso de escritura en el equipo al que lo está asignando.
      col.createRule =
        `@request.auth.id != "" && (@request.body.team = "" || ` +
        `${c.write('@request.body.team.')})`
      col.updateRule = write
      col.deleteRule = write
      app.save(col)
    }

    // ── users: visibles entre usuarios autenticados ──────────
    // Necesario para resolver a quién se invita y para listar los miembros del
    // equipo. OJO: PocketBase sigue ocultando el email de cada usuario salvo que
    // ese usuario active `emailVisibility` — se muestra el nombre.
    users.listRule = '@request.auth.id != ""'
    users.viewRule = '@request.auth.id != ""'
    app.save(users)
  },
  (app) => {
    // ── revertir ─────────────────────────────────────────────
    const personal = {
      listRule: '@request.auth.id != "" && owner = @request.auth.id',
      viewRule: '@request.auth.id != "" && owner = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && owner = @request.auth.id',
      deleteRule: '@request.auth.id != "" && owner = @request.auth.id',
    }
    for (const name of ['projects', 'structures', 'inspections', 'findings', 'tests']) {
      try {
        const col = app.findCollectionByNameOrId(name)
        for (const f of ['team', 'author']) {
          const field = col.fields.getByName(f)
          if (field) col.fields.removeByName(f)
        }
        Object.assign(col, personal)
        app.save(col)
      } catch (e) {
        /* noop */
      }
    }
    try {
      const users = app.findCollectionByNameOrId('users')
      users.listRule = null
      users.viewRule = null
      app.save(users)
    } catch (e) {
      /* noop */
    }
    try {
      app.delete(app.findCollectionByNameOrId('teams'))
    } catch (e) {
      /* noop */
    }
  },
)
