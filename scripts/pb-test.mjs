// Prueba end-to-end contra PocketBase local: colecciones, auth, CRUD y FOTO+thumbnail.
import PocketBase from 'pocketbase'

const URL = 'http://127.0.0.1:8097'
const ok = (m) => console.log('  ✓', m)

// PNG 1x1 válido (para probar subida + generación de thumbnail)
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const pngBytes = Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0))

const pb = new PocketBase(URL)

// 1) superuser + verificar colecciones
await pb.collection('_superusers').authWithPassword('admin@inspecta.cl', 'AdminPass12345')
const cols = (await pb.collections.getFullList()).map((c) => c.name)
const need = ['projects', 'structures', 'inspections', 'findings', 'tests']
const missing = need.filter((n) => !cols.includes(n))
if (missing.length) throw new Error('Faltan colecciones: ' + missing.join(', '))
ok('colecciones creadas por la migración: ' + need.join(', '))

// 2) crear usuario inspector (superuser bypassa reglas)
const email = 'inspector@test.cl'
try {
  await pb.collection('users').create({
    email,
    password: 'password123',
    passwordConfirm: 'password123',
    name: 'Inspector Test',
  })
  ok('usuario inspector creado')
} catch (e) {
  ok('usuario inspector ya existía')
}

// 3) auth como usuario normal (como haría la app)
const app = new PocketBase(URL)
await app.collection('users').authWithPassword(email, 'password123')
const uid = app.authStore.record.id
ok('login como inspector · uid=' + uid)

// 4) crear jerarquía proyecto → estructura → inspección
const project = await app.collection('projects').create({ name: 'Aulario UACh', owner: uid })
const structure = await app.collection('structures').create({
  project: project.id,
  name: 'Bloque A',
  stype: 'edificio',
  grid: { baysX: 3, baysZ: 2, stories: 3, bayX: 6, bayZ: 5, storyH: 3.2 },
  owner: uid,
})
const inspection = await app.collection('inspections').create({
  structure: structure.id,
  date: '2026-07-24',
  inspector: 'Inspector Test',
  owner: uid,
})
ok('proyecto/estructura/inspección creados')

// 5) crear hallazgo CON FOTO (multipart, como subiría la app)
const fd = new FormData()
fd.append('inspection', inspection.id)
fd.append('element_id', 'C-A1-N1')
fd.append('damage_type', 'grieta')
fd.append('severity', '3')
fd.append('extension', '35')
fd.append('pin', JSON.stringify({ x: -9, y: 1.2, z: -5 }))
fd.append('notes', 'Grieta diagonal de prueba')
fd.append('owner', uid)
fd.append('photos', new File([pngBytes], 'foto.png', { type: 'image/png' }))
const finding = await app.collection('findings').create(fd)
ok('hallazgo creado con foto · ' + finding.photos.length + ' archivo(s)')

// 6) traer el THUMBNAIL que genera PocketBase y verificar que es imagen
const filename = finding.photos[0]
const thumbUrl = app.files.getURL(finding, filename, { thumb: '100x100' })
const res = await fetch(thumbUrl)
const buf = new Uint8Array(await res.arrayBuffer())
const ct = res.headers.get('content-type')
console.log('\nThumbnail:', thumbUrl)
console.log('  status', res.status, '· content-type', ct, '· bytes', buf.length)
if (res.status !== 200 || !ct?.startsWith('image/')) throw new Error('El thumbnail no es una imagen')
ok('PocketBase generó y sirvió el thumbnail (image/*)')

console.log('\n✅ TODO OK — el flujo de fotos con PocketBase funciona.')
