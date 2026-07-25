// Captura la vista de Resultados.
import puppeteer from 'puppeteer'

const url = process.argv[2] || 'http://localhost:5173/'
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
await page.evaluateOnNewDocument(() => {
  window.__errs = []
  addEventListener('error', (e) => window.__errs.push(String(e.message)))
  addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason?.message ?? e.reason)))
})
await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
await new Promise((r) => setTimeout(r, 2000))

const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Resultados'))
  if (b) { b.click(); return true }
  return false
})
await new Promise((r) => setTimeout(r, 1200))

const info = await page.evaluate(() => ({
  hasKpis: document.body.innerText.includes('Condición'),
  hasEnsayos: document.body.innerText.includes('Esclerometría'),
  hasFindings: document.body.innerText.includes('Hallazgos priorizados'),
  errs: window.__errs || [],
}))
console.log('toggle Resultados:', clicked)
console.log('KPIs / ensayos / hallazgos:', info.hasKpis, info.hasEnsayos, info.hasFindings)
console.log('errores:', info.errs.length ? info.errs.slice(0, 3) : '(ninguno)')
await page.screenshot({ path: 'scripts/check-results.png', fullPage: true })
await browser.close()
