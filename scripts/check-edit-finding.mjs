// QA de la edición de hallazgos, del botón de ensayo en la lista de daños y del
// elemento no estructural genérico.
//
// Corre contra el dev server (vite) con sesión real, pero SOLO toca los datos de
// ejemplo (`fnddemo…`), que nunca se sincronizan (ver src/data/seed.ts):
// editar un hallazgo del equipo desde una prueba sí llegaría al servidor.
//
//   APP_USER=… APP_USER_PASS=… node scripts/check-edit-finding.mjs
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

const clickText = (t, sel = 'button') =>
  page.evaluate(
    (t, sel) => {
      const b = [...document.querySelectorAll(sel)].find((x) => x.textContent?.includes(t))
      if (!b) return false
      b.click()
      return true
    },
    t,
    sel,
  )
const clickTitle = (t) =>
  page.evaluate((t) => {
    const b = document.querySelector(`button[title="${t}"]`)
    if (!b) return false
    b.click()
    return true
  }, t)
/** Lee un hallazgo desde Dexie (IndexedDB) — la verdad de lo guardado. */
const finding = (id) =>
  page.evaluate(
    (id) =>
      new Promise((res) => {
        const rq = indexedDB.open('inspecta')
        rq.onsuccess = () => {
          const get = rq.result.transaction('findings', 'readonly').objectStore('findings').get(id)
          get.onsuccess = () => res(get.result ?? null)
          get.onerror = () => res(null)
        }
        rq.onerror = () => res(null)
      }),
    id,
  )
const countFindings = () =>
  page.evaluate(
    () =>
      new Promise((res) => {
        const rq = indexedDB.open('inspecta')
        rq.onsuccess = () => {
          const all = rq.result.transaction('findings', 'readonly').objectStore('findings').getAll()
          all.onsuccess = () => res(all.result.length)
        }
      }),
  )

// ── 1. Sesión ────────────────────────────────────────────────
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
await wait(1500)
if (await page.$('input[type="email"]')) {
  await page.type('input[type="email"]', EMAIL)
  await page.type('input[type="password"]', PASS)
  await clickText('Entrar')
  await wait(6000)
}
check(!(await page.$('input[type="password"]')), 'sesión iniciada')
// La guía de primer ingreso tapa la interfaz.
await clickTitle('Cerrar la guía')
await wait(500)

// ── 2. Abrir la estructura de EJEMPLO (sus datos no se sincronizan) ──
// La app abre la estructura real, no la de ejemplo. El nombre se busca por
// trozo: la siembra local dice "(ejemplo)" y la copia que quedó en el servidor
// no, y el árbol muestra la que haya ganado el sync.
let estructura = await clickText('Bloque A · Pórtico principal')
if (!estructura) {
  // El proyecto puede venir plegado: se abre y se reintenta.
  await clickText('Edificio Aulario UACh')
  await wait(500)
  estructura = await clickText('Bloque A · Pórtico principal')
}
check(estructura, 'se abre la estructura de ejemplo')
await wait(900)
await clickText('Lista')
await wait(600)

// La campaña abierta manda: se edita la primera fila que muestre la lista, sea
// cual sea (todas son de la estructura de ejemplo).
const filas = await page.$$eval('tr[data-finding]', (t) => t.map((x) => x.dataset.finding))
check(filas.length > 0, 'la lista muestra hallazgos', `${filas.length} filas`)
// Se edita SOLO un hallazgo de ejemplo. `isDemoRecord` los deja fuera del push
// (src/sync/engine.ts), así que la prueba no puede tocar el trabajo del equipo;
// si no hay ninguno a la vista, se aborta antes de escribir nada.
const DEMO = filas.find((id) => id.startsWith('fnddemo'))
if (!DEMO) {
  check(false, 'hay hallazgos de ejemplo en la lista', filas.join(' | '))
  await browser.close()
  process.exit(1)
}
const antes = await finding(DEMO)
check(!!antes, 'hallazgo presente en Dexie', antes?.damageType)

// ── 3. Editar: el formulario llega con los datos puestos ─────
const editables = await page.$$eval('button[title="Editar"]', (b) => b.length)
check(editables > 0, 'la lista ofrece editar', `${editables} filas`)
await page.evaluate((id) => {
  document.querySelector(`tr[data-finding="${id}"] button[title="Editar"]`).click()
}, DEMO)
await wait(700)
const modal = await page.evaluate(() => {
  const vals = [...document.querySelectorAll('select')].map((s) => s.value)
  return { texto: document.body.innerText.includes('Editar daño'), vals }
})
check(modal.texto, 'el formulario dice «Editar daño»')
check(
  modal.vals.includes(antes.element) && modal.vals.includes(antes.damageType),
  'campos precargados con lo guardado',
  modal.vals.filter(Boolean).join(' | '),
)

// Cambiar severidad y observaciones, y guardar.
await page.evaluate(() => {
  const ta = document.querySelector('textarea')
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  set.call(ta, 'QA edición ' + Date.now())
  ta.dispatchEvent(new Event('input', { bubbles: true }))
})
await clickText('Severo')
const nFindings = await countFindings()
await clickText('Guardar cambios')
await wait(1200)

const despues = await finding(DEMO)
check(!(await page.$('textarea')), 'el formulario se cerró al guardar')
check((await countFindings()) === nFindings, 'edita, no duplica', `${nFindings} hallazgos`)
check(despues?.notes?.startsWith('QA edición'), 'observación guardada', despues?.notes)
check(despues?.severity !== antes.severity, 'severidad cambiada', `${antes.severity} → ${despues?.severity}`)
check(despues?.element === antes.element, 'el resto del hallazgo intacto', despues?.element)
check(despues?.id === antes.id && despues?.inspectionId === antes.inspectionId, 'mismo registro')

// ── 4. Elemento no estructural genérico ──────────────────────
await clickText('Nuevo daño')
await wait(600)
await clickText('No estructural')
await wait(400)
// Los <select> se buscan DENTRO del formulario de daño: la vista de atrás
// también tiene selectores (campaña, estructura) y se cuelan por índice.
const generico = await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find((f) =>
    f.textContent.includes('Tipo de daño'),
  )
  const sel = form.querySelectorAll('select')[0]
  const opciones = [...sel.options].map((o) => o.value)
  const objetivo = opciones.find((o) => o.startsWith('Otro elemento'))
  if (!objetivo) return { opciones, ok: false }
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
  set.call(sel, objetivo)
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return { opciones, ok: true, objetivo }
})
check(generico.ok, 'existe el componente genérico no estructural', generico.objetivo)
await wait(400)
const elementos = await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find((f) =>
    f.textContent.includes('Tipo de daño'),
  )
  return [...form.querySelectorAll('select')[1].options].map((o) => o.value)
})
check(
  elementos.some((e) => e.includes('genérico')),
  'y su elemento genérico se puede elegir',
  elementos.join(' | '),
)
// Se registra de verdad y se vuelve a abrir: es la única forma de comprobar que
// el ámbito «no estructural» sobrevive al guardado y vuelve puesto al editar.
// El hallazgo cuelga de una campaña de ejemplo, así que tampoco se sincroniza.
const elegirDano = await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find((f) =>
    f.textContent.includes('Tipo de daño'),
  )
  const dano = [...form.querySelectorAll('select')][4]
  const opcion = [...dano.options].map((o) => o.value).find((v) => v && v !== 'Otro')
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
  set.call(dano, opcion)
  dano.dispatchEvent(new Event('change', { bubbles: true }))
  return { opcion }
})
check(!!elegirDano.opcion, 'el genérico ofrece deterioros', elegirDano.opcion)
await wait(300)
await clickText('Guardar daño')
await wait(1200)

const nuevo = await page.evaluate(
  () =>
    new Promise((res) => {
      const rq = indexedDB.open('inspecta')
      rq.onsuccess = () => {
        const all = rq.result.transaction('findings', 'readonly').objectStore('findings').getAll()
        all.onsuccess = () =>
          res(all.result.find((f) => f.element?.includes('genérico')) ?? null)
      }
    }),
)
check(!!nuevo, 'el daño no estructural genérico se guarda', nuevo?.damageType)
check(nuevo?.nonStructural === true, 'y queda marcado como no estructural')

// Reabrirlo: el ámbito y el elemento tienen que volver puestos.
await wait(400)
await page.evaluate((id) => {
  document.querySelector(`tr[data-finding="${id}"] button[title="Editar"]`)?.click()
}, nuevo.id)
await wait(700)
const reabierto = await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find((f) =>
    f.textContent.includes('Tipo de daño'),
  )
  const activo = [...form.querySelectorAll('button')].find((b) =>
    b.className.includes('bg-brand-600'),
  )
  return {
    ambito: activo?.textContent.trim(),
    vals: [...form.querySelectorAll('select')].map((s) => s.value),
  }
})
check(reabierto.ambito === 'No estructural', 'reabre en el ámbito no estructural', reabierto.ambito)
check(
  reabierto.vals.some((v) => v.includes('genérico')),
  'con el elemento genérico puesto',
  reabierto.vals.filter(Boolean).join(' | '),
)
await clickText('Cancelar')
await wait(400)
// Limpieza: el hallazgo de prueba no se queda en el dispositivo.
await page.evaluate((id) => {
  document.querySelector(`tr[data-finding="${id}"] button[title="Eliminar"]`)?.click()
}, nuevo.id)
await wait(600)

// ── 5. «Nuevo ensayo» desde la lista de daños ────────────────
const hayBoton = await clickText('Nuevo ensayo')
check(hayBoton, 'la lista de daños ofrece «Nuevo ensayo»')
await wait(800)
const enEnsayos = await page.evaluate(() => ({
  titulo: document.body.innerText.includes('Ensayos'),
  formulario: !!document.querySelector('input[placeholder^="Tipo"]'),
}))
check(enEnsayos.titulo && enEnsayos.formulario, 'abre la vista de ensayos con el formulario listo')

const errs = await page.evaluate(() => window.__errs)
check(errs.length === 0, 'sin errores en consola', errs.join(' / '))

await browser.close()
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodo ok')
process.exit(fallos ? 1 : 0)
