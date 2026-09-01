// QA del mantenimiento de fotos:
//   · borrar en el formulario de edición una foto YA SUBIDA (y que el servidor
//     se entere, que es lo que antes no pasaba),
//   · reducir a tamaño estándar las fotos que ya estaban guardadas.
//
// A diferencia de los otros check-*, este SÍ escribe en el servidor: no hay otra
// forma de comprobar que el archivo se borra de PocketBase. Trabaja sobre un
// hallazgo PROPIO que crea al empezar y borra al terminar.
//
// OJO: el paso de «Reducir fotos ya guardadas» aprieta un botón que es GLOBAL
// por diseño —recorre todas las fotos que la cuenta puede editar—, así que si
// se corre con una cuenta de administrador también reducirá las fotos reales
// del equipo. Es la operación que el botón promete y no rompe nada (baja la
// foto, la reescala y reemplaza el archivo), pero conviene saberlo antes de
// correrlo contra un servidor con trabajo de verdad.
//
//   APP_USER=… APP_USER_PASS=… node scripts/check-photo-maintenance.mjs
import puppeteer from 'puppeteer'

const EMAIL = process.env.APP_USER
const PASS = process.env.APP_USER_PASS
const URL = process.env.APP_URL ?? 'http://localhost:5173/'
const PB = process.env.PB_URL ?? 'http://127.0.0.1:8094'
if (!EMAIL || !PASS) {
  console.error('faltan APP_USER / APP_USER_PASS')
  process.exit(1)
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let fallos = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '  ok  ' : ' FALLA'} · ${label}${extra ? ' · ' + extra : ''}`)
  if (!ok) fallos++
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => {
  window.__errs = []
  addEventListener('unhandledrejection', (e) =>
    window.__errs.push(String(e.reason?.message ?? e.reason)),
  )
})

const clickText = (t) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes(t))
    if (!b) return false
    b.click()
    return true
  }, t)
// ── Sesión ───────────────────────────────────────────────────
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
await wait(1500)
if (await page.$('input[type="email"]')) {
  await page.type('input[type="email"]', EMAIL)
  await page.type('input[type="password"]', PASS)
  await clickText('Entrar')
  await wait(7000)
}
check(!(await page.$('input[type="password"]')), 'sesión iniciada')
await page.evaluate(() => document.querySelector('button[title="Cerrar la guía"]')?.click())
await wait(400)
await clickText('Lista')
await wait(800)

// ── 1. Hallazgo propio con una foto de 12 MP ─────────────────
await clickText('Nuevo daño')
await wait(700)
const subida = await page.evaluate(async () => {
  const c = document.createElement('canvas')
  c.width = 4000
  c.height = 3000
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#7a6a55'
  ctx.fillRect(0, 0, 4000, 3000)
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `hsl(${(i * 7) % 360} 40% ${30 + (i % 40)}%)`
    ctx.fillRect((i * 97) % 4000, (i * 53) % 3000, 120, 90)
  }
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95))
  const input = document.querySelector('input[type="file"]')
  const dt = new DataTransfer()
  dt.items.add(new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return blob.size
})
await wait(2500)
await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find((f) =>
    f.textContent.includes('Tipo de daño'),
  )
  const dano = form.querySelectorAll('select')[4]
  const opcion = [...dano.options].map((o) => o.value).find((v) => v && v !== 'Otro')
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
  set.call(dano, opcion)
  dano.dispatchEvent(new Event('change', { bubbles: true }))
  const ta = form.querySelector('textarea')
  const setTa = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  setTa.call(ta, 'QA fotos ' + Date.now())
  ta.dispatchEvent(new Event('input', { bubbles: true }))
})
await wait(300)
await clickText('Guardar daño')
await wait(1500)
console.log(`  ··· foto original de ${Math.round(subida / 1024)} KB`)

const leer = (id) =>
  page.evaluate(
    (id) =>
      new Promise((res) => {
        const rq = indexedDB.open('inspecta')
        rq.onsuccess = () => {
          const g = rq.result.transaction('findings', 'readonly').objectStore('findings').get(id)
          g.onsuccess = () => res(g.result ?? null)
        }
      }),
    id,
  )
const buscar = () =>
  page.evaluate(
    () =>
      new Promise((res) => {
        const rq = indexedDB.open('inspecta')
        rq.onsuccess = () => {
          const all = rq.result.transaction('findings', 'readonly').objectStore('findings').getAll()
          all.onsuccess = () => res(all.result.find((f) => f.notes?.startsWith('QA fotos'))?.id ?? null)
        }
      }),
  )
const ID = await buscar()
check(!!ID, 'hallazgo de prueba creado', ID)

// ── 2. Sincronizar: la foto sube al servidor ─────────────────
await clickText('Sincronización')
await wait(400)
await clickText('Sincronizar ahora')
await wait(6000)
let f = await leer(ID)
const remoto = f?.photos?.[0]?.remoteName
check(!!remoto, 'la foto quedó subida al servidor', remoto)

const enServidor = async () => {
  const r = await fetch(`${PB}/api/collections/findings/records/${ID}`, {
    headers: { Authorization: TOKEN },
  })
  if (!r.ok) return null
  return (await r.json()).photos ?? []
}
// Token de superusuario para mirar el servidor desde afuera de la app.
const TOKEN = await (async () => {
  const r = await fetch(`${PB}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: process.env.PB_SUPERUSER,
      password: process.env.PB_SUPERUSER_PASS,
    }),
  })
  return (await r.json()).token
})()
check(!!TOKEN, 'se puede consultar el servidor para verificar')
const antes = await enServidor()
check(antes?.length === 1, 'el servidor tiene la foto', JSON.stringify(antes))

// ── 3. Borrarla desde el formulario de edición ───────────────
await page.evaluate((id) => {
  document.querySelector(`tr[data-finding="${id}"] button[title="Editar"]`).click()
}, ID)
await wait(800)
const hayQuitar = await page.evaluate(
  () => !!document.querySelector('button[title="Quitar foto"]'),
)
check(hayQuitar, 'la ficha de edición ofrece quitar la foto ya subida')
await page.evaluate(() => document.querySelector('button[title="Quitar foto"]').click())
await wait(300)
await clickText('Guardar cambios')
await wait(7000)

f = await leer(ID)
check(f?.photos?.length === 0, 'la foto ya no está en el hallazgo', `${f?.photos?.length} fotos`)
const despues = await enServidor()
check(despues?.length === 0, 'y tampoco en el servidor', JSON.stringify(despues))

// ── 4. Reducir una foto que YA estaba guardada en el servidor ─
// Se sube a mano un archivo de 12 MP (como los que hay de antes de que la app
// reescalara al entrar) y se comprueba que el botón lo reemplaza por su versión
// HD, tanto el archivo del servidor como lo que ve el dispositivo.
const grande = await page.evaluate(async () => {
  const c = document.createElement('canvas')
  c.width = 4000
  c.height = 3000
  const ctx = c.getContext('2d')
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `hsl(${(i * 11) % 360} 50% ${25 + (i % 50)}%)`
    ctx.fillRect((i * 131) % 4000, (i * 77) % 3000, 160, 120)
  }
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95))
  const buf = new Uint8Array(await blob.arrayBuffer())
  return { size: blob.size, datos: [...buf] }
})
const fd = new FormData()
fd.append('photos+', new Blob([new Uint8Array(grande.datos)], { type: 'image/jpeg' }), 'antigua.jpg')
const alta = await fetch(`${PB}/api/collections/findings/records/${ID}`, {
  method: 'PATCH',
  headers: { Authorization: TOKEN },
  body: fd,
})
const conGrande = await alta.json()
const nombreGrande = (conGrande.photos ?? []).find((n) => n.startsWith('antigua'))
check(
  !!nombreGrande,
  'se dejó en el servidor una foto antigua de 12 MP',
  nombreGrande && `${Math.round(grande.size / 1024)} KB`,
)

// El dispositivo la baja…
await clickText('Sincronización')
await wait(300)
await clickText('Sincronizar ahora')
await wait(6000)
f = await leer(ID)
check(
  (f?.photos ?? []).some((p) => p.remoteName === nombreGrande),
  'el dispositivo la recibe',
  `${f?.photos?.length} foto(s)`,
)

// …y el botón la reduce.
await clickText('Sincronización')
await wait(300)
await clickText('Reducir fotos ya guardadas')
await wait(25000)
const mensaje = await page.evaluate(() => document.body.innerText.match(/Reducidas[^\n]*/)?.[0] ?? '')
console.log('  ···', mensaje || '(sin mensaje)')
const finales = await enServidor()
check(finales?.length === 1, 'en el servidor sigue habiendo una sola foto', JSON.stringify(finales))
const dim = await page.evaluate(async (id, name) => {
  const res = await fetch(`/api/files/findings/${id}/${name}`)
  const bmp = await createImageBitmap(await res.blob())
  const out = { w: bmp.width, h: bmp.height }
  bmp.close?.()
  return out
}, ID, finales?.[0])
check(
  dim && Math.max(dim.w, dim.h) <= 1920,
  'y quedó a tamaño estándar en el servidor',
  dim && `${dim.w}×${dim.h}`,
)

// ── 5. Limpieza ──────────────────────────────────────────────
await page.evaluate((id) => {
  document.querySelector(`tr[data-finding="${id}"] button[title="Eliminar"]`)?.click()
}, ID)
await wait(1000)
await clickText('Sincronización')
await wait(300)
await clickText('Sincronizar ahora')
await wait(5000)
await fetch(`${PB}/api/collections/findings/records/${ID}`, {
  method: 'DELETE',
  headers: { Authorization: TOKEN },
}).catch(() => {})
const quedo = await fetch(`${PB}/api/collections/findings/records/${ID}`, {
  headers: { Authorization: TOKEN },
})
check(quedo.status === 404, 'el hallazgo de prueba se borró del servidor', String(quedo.status))

const errs = await page.evaluate(() => window.__errs)
check(errs.length === 0, 'sin errores en consola', errs.join(' / '))

await browser.close()
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodo ok')
process.exit(fallos ? 1 : 0)
