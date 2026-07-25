// E2E: crear una nueva inspección periódica desde el selector.
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

// cuenta campañas desde el header "Inspecciones periódicas · N"
const countPills = () =>
  page.evaluate(() => {
    const m = document.body.innerText.match(/Inspecciones peri[oó]dicas\s*·\s*(\d+)/i)
    return m ? Number(m[1]) : 0
  })

const before = await countPills()

// abrir "Nueva"
await page.evaluate(() => {
  ;[...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Nueva' || b.textContent?.includes('Nueva'))?.click()
})
await new Promise((r) => setTimeout(r, 300))

// completar inspector (la fecha ya viene por defecto) y crear
await page.evaluate(() => {
  const inp = document.querySelector('input[type="text"][placeholder="Nombre"]')
  if (inp) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, 'M. Test')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await new Promise((r) => setTimeout(r, 200))
await page.evaluate(() => {
  ;[...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Crear')?.click()
})
await new Promise((r) => setTimeout(r, 500))

const after = await countPills()
const errs = await page.evaluate(() => window.__errs || [])
console.log('campañas antes/después:', before, '→', after, after > before ? 'OK (+1)' : 'SIN CAMBIO')
console.log('errores:', errs.length ? errs.slice(0, 3) : '(ninguno)')
await page.screenshot({ path: 'scripts/check-crud.png' })
await browser.close()
