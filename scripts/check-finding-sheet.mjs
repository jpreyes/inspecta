// QA de la ficha del hallazgo, el visor de fotos, el ancho del selector de
// campañas y el reescalado de las fotos a tamaño estándar (HD).
//
// Como check-edit-finding.mjs: corre contra el dev server con sesión real pero
// solo toca la estructura de EJEMPLO. El hallazgo de prueba que crea cuelga de
// una campaña de ejemplo, así que `isDemoRecord` lo deja fuera del push (ver
// src/sync/engine.ts) y nunca llega al servidor; igual se borra al final.
//
//   APP_USER=… APP_USER_PASS=… node scripts/check-finding-sheet.mjs
import puppeteer from 'puppeteer'

const EMAIL = process.env.APP_USER
const PASS = process.env.APP_USER_PASS
const URL = process.env.APP_URL ?? 'http://localhost:5173/'
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
  addEventListener('error', (e) => window.__errs.push(String(e.message)))
})

const clickText = (t) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes(t))
    if (!b) return false
    b.click()
    return true
  }, t)

// ── 1. Sesión y estructura de ejemplo ────────────────────────
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
await wait(1500)
if (await page.$('input[type="email"]')) {
  await page.type('input[type="email"]', EMAIL)
  await page.type('input[type="password"]', PASS)
  await clickText('Entrar')
  await wait(6000)
}
check(!(await page.$('input[type="password"]')), 'sesión iniciada')
await page.evaluate(() => document.querySelector('button[title="Cerrar la guía"]')?.click())
await wait(400)
let abierta = await clickText('Bloque A · Pórtico principal')
if (!abierta) {
  await clickText('Edificio Aulario UACh')
  await wait(500)
  abierta = await clickText('Bloque A · Pórtico principal')
}
check(abierta, 'se abre la estructura de ejemplo')
await wait(900)
await clickText('Lista')
await wait(700)

// ── 2. El selector de campañas mide lo mismo que la tabla ────
const anchos = await page.evaluate(() => {
  const campanas = document.querySelector('[data-tour="campaigns"]')
  const tabla = document.querySelector('[data-tour="damage-table"]')
  return campanas && tabla
    ? { campanas: Math.round(campanas.getBoundingClientRect().width), tabla: Math.round(tabla.getBoundingClientRect().width) }
    : null
})
check(!!anchos, 'están a la vista el selector y la tabla')
check(
  anchos && Math.abs(anchos.campanas - anchos.tabla) <= 1,
  'inspecciones periódicas mide lo mismo que los daños',
  anchos && `${anchos.campanas}px vs ${anchos.tabla}px`,
)

// ── 3. Foto de 12 MP → se guarda a tamaño estándar (HD) ──────
await clickText('Nuevo daño')
await wait(700)
const subida = await page.evaluate(async () => {
  // Una foto de cámara de teléfono: 4000×3000.
  const c = document.createElement('canvas')
  c.width = 4000
  c.height = 3000
  const ctx = c.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 4000, 3000)
  grad.addColorStop(0, '#8a5a2b')
  grad.addColorStop(1, '#d9c7a3')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 4000, 3000)
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95))
  const input = document.querySelector('input[type="file"]')
  const dt = new DataTransfer()
  dt.items.add(new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return { origen: blob.size }
})
await wait(2500)
const miniatura = await page.evaluate(async () => {
  const form = [...document.querySelectorAll('form')].find((f) =>
    f.textContent.includes('Tipo de daño'),
  )
  const img = form?.querySelector('img')
  if (!img?.src) return null
  const bmp = await createImageBitmap(await (await fetch(img.src)).blob())
  return {
    w: bmp.width,
    h: bmp.height,
    jpeg: img.src.startsWith('data:image/jpeg'),
    bytes: Math.round((img.src.length * 3) / 4),
  }
})
check(!!miniatura, 'la foto entra al formulario')
check(
  miniatura && Math.max(miniatura.w, miniatura.h) === 1920,
  'reescalada al lado mayor 1920 (HD)',
  miniatura && `${miniatura.w}×${miniatura.h}`,
)
check(miniatura?.jpeg, 'guardada como JPEG')
check(
  miniatura && miniatura.bytes < subida.origen,
  'y ocupa menos que el original',
  miniatura && `${Math.round(miniatura.bytes / 1024)} KB vs ${Math.round(subida.origen / 1024)} KB`,
)

// Guardar el hallazgo (el elemento y el deterioro vienen por defecto o se eligen).
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
  setTa.call(ta, 'Ficha de prueba QA con foto adjunta.')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
})
await wait(400)
await clickText('Guardar daño')
await wait(1500)

const nuevo = await page.evaluate(
  () =>
    new Promise((res) => {
      const rq = indexedDB.open('inspecta')
      rq.onsuccess = () => {
        const all = rq.result.transaction('findings', 'readonly').objectStore('findings').getAll()
        all.onsuccess = () =>
          res(
            all.result
              .filter((f) => f.notes?.startsWith('Ficha de prueba QA'))
              .map((f) => ({ id: f.id, fotos: f.photos.length, tipo: f.photos[0]?.dataUrl?.slice(0, 22) }))[0] ?? null,
          )
      }
    }),
)
check(!!nuevo, 'el hallazgo con foto queda guardado', nuevo && `${nuevo.fotos} foto(s)`)
check(nuevo?.tipo === 'data:image/jpeg;base64', 'la foto persiste ya reescalada', nuevo?.tipo)

// ── 4. La fila abre la ficha ─────────────────────────────────
await page.evaluate((id) => document.querySelector(`tr[data-finding="${id}"]`).click(), nuevo.id)
await wait(700)
const ficha = await page.evaluate(() => {
  const t = document.body.innerText
  return {
    abierta: t.includes('Observaciones') && t.includes('Ficha de prueba QA'),
    gravedad: t.includes('Gravedad'),
    acciones: [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Editar')),
  }
})
check(ficha.abierta, 'la fila abre la ficha con las observaciones enteras')
check(ficha.gravedad, 'la ficha explica la gravedad')
check(ficha.acciones, 'y ofrece editar desde ahí')

// ── 5. La foto se ve grande ──────────────────────────────────
const abrirFoto = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button[title="Ver la foto completa"]')].pop()
  if (!b) return false
  b.click()
  return true
})
check(abrirFoto, 'la ficha ofrece abrir la foto')
await wait(600)
const visor = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"][aria-label="Foto del hallazgo"]')
  if (!dlg) return null
  const img = dlg.querySelector('img')
  return { ancho: Math.round(img.getBoundingClientRect().width), alto: Math.round(img.getBoundingClientRect().height) }
})
check(!!visor, 'se abre el visor a pantalla completa')
check(visor && visor.ancho > 400, 'y la foto se ve grande', visor && `${visor.ancho}×${visor.alto}px`)
await page.evaluate(() => document.querySelector('button[aria-label="Cerrar la foto"]').click())
await wait(400)
check(
  !(await page.$('[role="dialog"][aria-label="Foto del hallazgo"]')),
  'el visor se cierra y deja la ficha detrás',
)

// ── 6. Limpieza: el hallazgo de prueba no se queda ───────────
await page.evaluate(() =>
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Eliminar'))?.click(),
)
await wait(800)
const quedo = await page.evaluate(
  (id) =>
    new Promise((res) => {
      const rq = indexedDB.open('inspecta')
      rq.onsuccess = () => {
        const g = rq.result.transaction('findings', 'readonly').objectStore('findings').get(id)
        g.onsuccess = () => res(!!g.result)
      }
    }),
  nuevo.id,
)
check(!quedo, 'el hallazgo de prueba se borró')

const errs = await page.evaluate(() => window.__errs)
check(errs.length === 0, 'sin errores en consola', errs.join(' / '))

await browser.close()
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodo ok')
process.exit(fallos ? 1 : 0)
