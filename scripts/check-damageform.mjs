import puppeteer from 'puppeteer'
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => {
  window.__errs = []
  addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason?.message ?? e.reason)))
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 20000 })
await new Promise((r) => setTimeout(r, 2000))

const clickText = (t) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes(t))
    if (b) { b.click(); return true }
    return false
  }, t)
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

const before = await countFindings()

// abrir el modal "daño primero" desde el TopBar
await clickText('Registrar daño')
await new Promise((r) => setTimeout(r, 500))
const modal = await page.evaluate(() => ({
  hasHeading: document.body.innerText.includes('Registrar daño'),
  hasElementSelect: !!document.querySelector('select optgroup'),
  nOptions: document.querySelectorAll('select option').length,
}))
console.log('modal abierto · selector de elemento:', modal.hasElementSelect, '· opciones:', modal.nOptions)
await page.screenshot({ path: 'scripts/check-damageform.png' })

// elegir un elemento (una opción cualquiera), severidad y guardar
const optVal = await page.evaluate(() => {
  const s = document.querySelector('select')
  return s?.options[5]?.value ?? s?.options[0]?.value
})
await page.select('select', optVal)
await clickText('Severo')
await clickText('Guardar daño')
await new Promise((r) => setTimeout(r, 800))

const after = await countFindings()
console.log('elemento elegido:', optVal)
console.log('hallazgos antes/después:', before, '→', after, after > before ? 'OK (+1)' : 'SIN CAMBIO')
console.log('errores:', (await page.evaluate(() => window.__errs)).slice(0, 2))
await browser.close()
