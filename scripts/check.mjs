// Verificador headless: carga la app, captura errores de consola y
// rechazos de promesa con stack completo. Uso: node scripts/check.mjs [url]
import puppeteer from 'puppeteer'

const url = process.argv[2] || 'http://localhost:5173/'
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

const logs = []

// Captura window.onerror y unhandledrejection con stack, antes de cargar la app
await page.evaluateOnNewDocument(() => {
  window.__errs = []
  window.addEventListener('error', (e) => {
    window.__errs.push({ kind: 'error', msg: String(e.message), stack: e.error?.stack || '' })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    window.__errs.push({
      kind: 'unhandledrejection',
      msg: String(r?.message ?? r),
      stack: r?.stack || '',
    })
  })
})

page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) logs.push(`[console.${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`))

try {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
} catch (e) {
  logs.push(`[goto] ${e.message}`)
}
await new Promise((r) => setTimeout(r, 2500))

// Simula interacción: click en el centro del canvas (debería seleccionar un elemento)
// y arrastre corto (orbitar) para ejercitar el raycaster + damping.
const box = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  if (!c) return null
  const r = c.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})
if (box) {
  await page.mouse.click(box.x, box.y)
  await page.mouse.move(box.x, box.y)
  await page.mouse.down()
  await page.mouse.move(box.x + 40, box.y + 20)
  await page.mouse.up()
  await new Promise((r) => setTimeout(r, 1500))
}

const errs = await page.evaluate(() => window.__errs || [])

// ¿Se renderizó el canvas 3D y cuántos elementos hay?
const canvasInfo = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  return c ? { present: true, w: c.width, h: c.height } : { present: false }
})

console.log('=== CONSOLE (error/warn) ===')
console.log(logs.length ? logs.slice(0, 20).join('\n---\n') : '(ninguno)')
console.log('\n=== window errors / rejections (con stack) ===')
if (!errs.length) console.log('(ninguno)')
for (const e of errs.slice(0, 5)) {
  console.log(`\n[${e.kind}] ${e.msg}`)
  console.log((e.stack || '').split('\n').slice(0, 18).join('\n'))
}
console.log('\n=== canvas ===')
console.log(JSON.stringify(canvasInfo))

await page.screenshot({ path: 'scripts/check.png' }).catch(() => {})
await browser.close()
