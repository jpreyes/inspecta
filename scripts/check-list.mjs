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

// Vista lista del edificio (por defecto)
await page.screenshot({ path: 'scripts/check-list.png' })
console.log('errores (edificio lista):', (await page.evaluate(() => window.__errs)).slice(0, 2))

// Seleccionar el puente (sin modelo 3D)
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('Puente'))
  if (b) { b.click(); return true }
  return false
})
await new Promise((r) => setTimeout(r, 1000))
const info = await page.evaluate(() => ({
  has3D: [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Gemelo 3D' || b.textContent?.includes('Gemelo 3D')),
  hasPila: document.body.innerText.includes('Pila P1'),
  hasEstribo: document.body.innerText.includes('Estribo E1'),
}))
console.log('puente seleccionado:', clicked)
console.log('toggle Gemelo 3D visible:', info.has3D, '(debe ser false)')
console.log('muestra daños del puente (Pila P1 / Estribo E1):', info.hasPila, '/', info.hasEstribo)
console.log('errores (puente):', (await page.evaluate(() => window.__errs)).slice(0, 2))
await page.screenshot({ path: 'scripts/check-bridge.png' })
await browser.close()
