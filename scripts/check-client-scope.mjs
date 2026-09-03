// El cliente solo ve SUS proyectos, y no escribe nada.
//
// Comprueba contra un PocketBase de verdad (no un mock) las reglas de
// pb_migrations/1788400100_client_project_scope.js y el hook keep_team.pb.js:
// un cliente ve únicamente los proyectos donde está asignado —con todo lo que
// cuelga de ellos— y no puede crear, modificar ni borrar nada.
//
// Necesita un PocketBase vacío con las migraciones del repo:
//
//   docker run -d --name inspecta-qa -p 127.0.0.1:8097:8090 \
//     -v "$PWD/pocketbase/pb_migrations:/pb/pb_migrations" \
//     -v "$PWD/pocketbase/pb_hooks:/pb/pb_hooks" inspecta/pocketbase:latest
//   docker exec inspecta-qa pocketbase superuser upsert \
//     admin@inspecta.cl AdminPass12345 --dir=/pb/pb_data
//   node scripts/check-client-scope.mjs
//
// PB_URL / PB_SUPERUSER / PB_SUPERUSER_PASS lo sobrescriben.
import PocketBase from 'pocketbase'

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8097'
const SU = process.env.PB_SUPERUSER ?? 'admin@inspecta.cl'
const SU_PASS = process.env.PB_SUPERUSER_PASS ?? 'AdminPass12345'
const PASS = 'password123'

let fallos = 0
const ok = (m) => console.log('  ✓', m)
const fail = (m) => {
  fallos++
  console.log('  ✗', m)
}
const esperar = (cond, m) => (cond ? ok(m) : fail(m))

/** Corre algo que DEBE ser rechazado por el servidor. */
async function rechazado(m, fn) {
  try {
    await fn()
    fail(`${m} — el servidor lo permitió`)
  } catch (e) {
    const s = e?.status ?? 0
    if (s === 400 || s === 403 || s === 404) ok(`${m} (${s})`)
    else fail(`${m} — falló por otra razón: ${e?.message ?? e}`)
  }
}

const su = new PocketBase(URL)
await su.collection('_superusers').authWithPassword(SU, SU_PASS)

// ── fixtures ─────────────────────────────────────────────
const sufijo = Date.now().toString(36)
const crearUsuario = async (nombre) =>
  su.collection('users').create({
    email: `${nombre}.${sufijo}@qa.cl`,
    password: PASS,
    passwordConfirm: PASS,
    name: nombre,
  })

const admin = await crearUsuario('admin')
const inspector = await crearUsuario('inspector')
const cliente = await crearUsuario('cliente')
const otroCliente = await crearUsuario('otrocliente')

const equipo = await su.collection('teams').create({
  name: `QA ${sufijo}`,
  admins: [admin.id],
  inspectors: [inspector.id],
  reviewers: [],
  clients: [cliente.id, otroCliente.id],
})

/** Un proyecto completo: proyecto → estructura → campaña → hallazgo + ensayo. */
async function arbol(nombre, clientes) {
  const project = await su.collection('projects').create({
    name: nombre,
    team: equipo.id,
    owner: admin.id,
    clients: clientes,
  })
  const structure = await su.collection('structures').create({
    project: project.id,
    name: nombre,
    stype: 'edificio',
    elements: [],
    team: equipo.id,
    owner: admin.id,
  })
  const inspection = await su.collection('inspections').create({
    structure: structure.id,
    date: '2026-09-01 12:00:00.000Z',
    inspector: 'QA',
    team: equipo.id,
    owner: admin.id,
  })
  const finding = await su.collection('findings').create({
    inspection: inspection.id,
    element: 'Viga',
    damage_type: 'Fisura',
    severity: 2,
    team: equipo.id,
    owner: admin.id,
  })
  const test = await su.collection('tests').create({
    inspection: inspection.id,
    test_type: 'Esclerometría',
    executed_at: '2026-09-01 12:00:00.000Z',
    result_summary: 'QA',
    team: equipo.id,
    owner: admin.id,
  })
  return { project, structure, inspection, finding, test }
}

const mio = await arbol(`Proyecto del cliente ${sufijo}`, [cliente.id])
const ajeno = await arbol(`Proyecto de otro mandante ${sufijo}`, [otroCliente.id])

const como = async (usuario) => {
  const pb = new PocketBase(URL)
  await pb.collection('users').authWithPassword(usuario.email, PASS)
  return pb
}
const ids = async (pb, col) => (await pb.collection(col).getFullList()).map((r) => r.id)

// ── 1. alcance de lectura ────────────────────────────────
console.log('\n1) El cliente ve su proyecto y NO el del otro mandante')
const pbCliente = await como(cliente)
for (const [col, mia, suya] of [
  ['projects', mio.project.id, ajeno.project.id],
  ['structures', mio.structure.id, ajeno.structure.id],
  ['inspections', mio.inspection.id, ajeno.inspection.id],
  ['findings', mio.finding.id, ajeno.finding.id],
  ['tests', mio.test.id, ajeno.test.id],
]) {
  const vistos = await ids(pbCliente, col)
  esperar(vistos.includes(mia) && !vistos.includes(suya), `${col}: ve el suyo, no el ajeno`)
  await rechazado(`${col}: no puede abrir el registro ajeno`, () =>
    pbCliente.collection(col).getOne(suya),
  )
}

console.log('\n2) El resto del equipo sigue viendo los dos proyectos')
for (const [quien, usuario] of [
  ['admin', admin],
  ['inspector', inspector],
]) {
  const pb = await como(usuario)
  const vistos = await ids(pb, 'projects')
  esperar(
    vistos.includes(mio.project.id) && vistos.includes(ajeno.project.id),
    `${quien}: ve los dos proyectos`,
  )
  const hallazgos = await ids(pb, 'findings')
  esperar(
    hallazgos.includes(mio.finding.id) && hallazgos.includes(ajeno.finding.id),
    `${quien}: ve los hallazgos de los dos`,
  )
}

console.log('\n3) Quitarle la asignación le quita TODO el árbol')
await su.collection('projects').update(mio.project.id, { clients: [] })
for (const col of ['projects', 'structures', 'inspections', 'findings', 'tests']) {
  esperar((await ids(pbCliente, col)).length === 0, `${col}: sin asignación no ve nada`)
}
await su.collection('projects').update(mio.project.id, { clients: [cliente.id] })
esperar((await ids(pbCliente, 'findings')).length === 1, 'al reasignarlo vuelve a ver su hallazgo')

// ── 4. el cliente no escribe ─────────────────────────────
console.log('\n4) El cliente no crea, no modifica y no borra')
await rechazado('no edita un hallazgo', () =>
  pbCliente.collection('findings').update(mio.finding.id, { notes: 'editado' }),
)
await rechazado('no borra un hallazgo', () =>
  pbCliente.collection('findings').delete(mio.finding.id),
)
await rechazado('no edita un ensayo', () =>
  pbCliente.collection('tests').update(mio.test.id, { result_summary: 'editado' }),
)
await rechazado('no borra un ensayo', () => pbCliente.collection('tests').delete(mio.test.id))
await rechazado('no crea un hallazgo en la campaña del equipo', () =>
  pbCliente.collection('findings').create({
    inspection: mio.inspection.id,
    element: 'Viga',
    damage_type: 'Fisura',
    severity: 2,
    team: equipo.id,
    owner: cliente.id,
  }),
)
// La grieta que cerró el hook: crear con `team: ''` colgado de la campaña del
// equipo. La regla de creación tiene una rama para el registro personal y se
// evalúa contra @request.body, así que sin el hook esto pasaba.
await rechazado('no crea un hallazgo "personal" colgado de la campaña del equipo', () =>
  pbCliente.collection('findings').create({
    inspection: mio.inspection.id,
    element: 'Viga',
    damage_type: 'Fisura',
    severity: 2,
    team: '',
    owner: cliente.id,
  }),
)
await rechazado('no crea un ensayo "personal" colgado de la campaña del equipo', () =>
  pbCliente.collection('tests').create({
    inspection: mio.inspection.id,
    test_type: 'QA',
    executed_at: '2026-09-01 12:00:00.000Z',
    result_summary: 'x',
    team: '',
    owner: cliente.id,
  }),
)
await rechazado('no edita el proyecto', () =>
  pbCliente.collection('projects').update(mio.project.id, { name: 'renombrado' }),
)
await rechazado('no se asigna a sí mismo al proyecto ajeno', () =>
  pbCliente.collection('projects').update(ajeno.project.id, { clients: [cliente.id] }),
)
await rechazado('no edita la estructura (sitio y vulnerabilidad)', () =>
  pbCliente.collection('structures').update(mio.structure.id, { site: { zone: 3 } }),
)
await rechazado('no edita el equipo', () =>
  pbCliente.collection('teams').update(equipo.id, { name: 'renombrado' }),
)

// ── 5. el trabajo de terreno sigue funcionando ───────────
console.log('\n5) La inspectora sigue pudiendo trabajar')
const pbInspector = await como(inspector)
const nuevo = await pbInspector.collection('findings').create({
  inspection: mio.inspection.id,
  element: 'Pilar',
  damage_type: 'Fisura',
  severity: 1,
  team: '', // dispositivo que no conoce el equipo: el hook se lo pone
  owner: inspector.id,
})
esperar(nuevo.team === equipo.id, 'crea un hallazgo y hereda el equipo aunque mande team vacío')
esperar(
  (await ids(pbCliente, 'findings')).includes(nuevo.id),
  'el cliente ve el hallazgo nuevo (lectura al día)',
)

// ── limpieza ─────────────────────────────────────────────
for (const col of ['findings', 'tests', 'inspections', 'structures', 'projects']) {
  for (const r of await su.collection(col).getFullList({ filter: `team = "${equipo.id}"` })) {
    await su.collection(col).delete(r.id)
  }
}
await su.collection('teams').delete(equipo.id)
for (const u of [admin, inspector, cliente, otroCliente]) await su.collection('users').delete(u.id)

console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodo en orden')
process.exit(fallos ? 1 : 0)
