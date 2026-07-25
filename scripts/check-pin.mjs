// Prueba E2E del flujo de pin por raycast (selección determinística vía sidebar).
import puppeteer from 'puppeteer'

const url = process.argv[2] || 'http://localhost:5173/'
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => {
  window.__errs = []
  addEventListener('error', (e) => window.__errs.push(String(e.message)))
  addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason?.message ?? e.reason)))
})
await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
await new Promise((r) => setTimeout(r, 2000))

const clickByText = (needle) =>
  page.evaluate((n) => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(n))
    if (el) { el.click(); return true }
    return false
  }, needle)

// 1) seleccionar un elemento vía sidebar (determinístico)
const sel = await clickByText('C A1 · N3')
await new Promise((r) => setTimeout(r, 400))
const hasBtn = await page.evaluate(() =>
  [...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Registrar hallazgo')),
)
console.log('elemento seleccionado vía sidebar:', sel, '| boton hallazgo visible:', hasBtn)

// 2) abrir formulario → activa modo colocación
await clickByText('Registrar hallazgo')
await new Promise((r) => setTimeout(r, 400))
const s2 = await page.evaluate(() => ({
  formOpen: document.body.innerText.includes('Tipo de daño'),
  hintPlace: document.body.innerText.includes('Haz click sobre el daño'),
}))
console.log('form abierto:', s2.formOpen, '| hint de colocación:', s2.hintPlace)

// 3) clavar el pin: probar varios puntos hasta acertar una malla
let clavado = false
const pts = [[690, 470], [640, 520], [740, 500], [560, 560], [820, 480], [670, 430]]
for (const [x, y] of pts) {
  await page.mouse.click(x, y)
  await new Promise((r) => setTimeout(r, 250))
  clavado = await page.evaluate(() => document.body.innerText.includes('Pin clavado'))
  if (clavado) break
}
console.log('pin clavado (pendingPin set):', clavado)

const errs = await page.evaluate(() => window.__errs || [])
console.log('errores:', errs.length ? errs.slice(0, 3) : '(ninguno)')
await page.screenshot({ path: 'scripts/check-pin.png' })
await browser.close()
