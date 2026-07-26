/// <reference path="../pb_data/types.d.ts" />
// Colecciones de Inspecta. PocketBase aplica esta migración al arrancar.
// Copiar esta carpeta `pb_migrations/` junto al binario en el VPS.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    const owner = () => ({
      name: 'owner',
      type: 'relation',
      required: true,
      maxSelect: 1,
      cascadeDelete: true,
      collectionId: users.id,
    })
    // Timestamps de sistema (PocketBase 0.23+ ya no los agrega solo).
    const stamps = () => [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]
    // Reglas: cada usuario ve/edita solo lo suyo.
    const rules = {
      listRule: '@request.auth.id != "" && owner = @request.auth.id',
      viewRule: '@request.auth.id != "" && owner = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && owner = @request.auth.id',
      deleteRule: '@request.auth.id != "" && owner = @request.auth.id',
    }

    const projects = new Collection({
      type: 'base',
      name: 'projects',
      ...rules,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'client', type: 'text' },
        { name: 'lat', type: 'number' },
        { name: 'lng', type: 'number' },
        { name: 'address', type: 'text' },
        owner(),
        ...stamps(),
      ],
    })
    app.save(projects)

    const structures = new Collection({
      type: 'base',
      name: 'structures',
      ...rules,
      fields: [
        { name: 'project', type: 'relation', required: true, maxSelect: 1, cascadeDelete: true, collectionId: projects.id },
        { name: 'name', type: 'text', required: true },
        { name: 'stype', type: 'text' },
        { name: 'grid', type: 'json' },
        { name: 'elements', type: 'json' },
        { name: 'vulnerability', type: 'json' },
        { name: 'site', type: 'json' },
        owner(),
        ...stamps(),
      ],
    })
    app.save(structures)

    const inspections = new Collection({
      type: 'base',
      name: 'inspections',
      ...rules,
      fields: [
        { name: 'structure', type: 'relation', required: true, maxSelect: 1, cascadeDelete: true, collectionId: structures.id },
        { name: 'date', type: 'text', required: true },
        { name: 'inspector', type: 'text', required: true },
        { name: 'weather', type: 'text' },
        { name: 'summary', type: 'text' },
        { name: 'condition_score', type: 'number' },
        owner(),
        ...stamps(),
      ],
    })
    app.save(inspections)

    const findings = new Collection({
      type: 'base',
      name: 'findings',
      ...rules,
      fields: [
        { name: 'inspection', type: 'relation', required: true, maxSelect: 1, cascadeDelete: true, collectionId: inspections.id },
        { name: 'component', type: 'text' },
        { name: 'element', type: 'text', required: true },
        { name: 'material', type: 'text' },
        { name: 'zone', type: 'text' },
        { name: 'element_id', type: 'text' },
        { name: 'cause', type: 'text' },
        { name: 'damage_type', type: 'text', required: true },
        { name: 'severity', type: 'number', required: true },
        { name: 'extension', type: 'number' },
        { name: 'pin', type: 'json' },
        { name: 'gps_lat', type: 'number' },
        { name: 'gps_lng', type: 'number' },
        { name: 'notes', type: 'text' },
        {
          name: 'photos',
          type: 'file',
          maxSelect: 20,
          maxSize: 5242880, // 5 MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          thumbs: ['100x100', '600x0'], // miniatura + versión mediana
        },
        owner(),
        ...stamps(),
      ],
    })
    app.save(findings)

    const tests = new Collection({
      type: 'base',
      name: 'tests',
      ...rules,
      fields: [
        { name: 'inspection', type: 'relation', required: true, maxSelect: 1, cascadeDelete: true, collectionId: inspections.id },
        { name: 'test_type', type: 'text', required: true },
        { name: 'method', type: 'text' },
        { name: 'standard', type: 'text' },
        { name: 'executed_at', type: 'text' },
        { name: 'laboratory', type: 'text' },
        { name: 'sample_location', type: 'text' },
        { name: 'result_summary', type: 'text' },
        owner(),
        ...stamps(),
      ],
    })
    app.save(tests)
  },
  (app) => {
    for (const n of ['tests', 'findings', 'inspections', 'structures', 'projects']) {
      try {
        app.delete(app.findCollectionByNameOrId(n))
      } catch (e) {
        /* noop */
      }
    }
  },
)
