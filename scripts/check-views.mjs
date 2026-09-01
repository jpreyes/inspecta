// QA: humo end-to-end de las vistas contra la app compilada.
//
// Comprueba lo que un typecheck no ve: que se vean los daños que subió OTRA
// persona del equipo, que el indicador de tiempo real esté activo, que la vista
// de Ensayos exista en la barra superior con sus atajos, y que el formulario de
// daños cambie de catálogo al pasar a "No estructural".
//
//   APP=http://127.0.0.1:8099/ CREDS=deploy/credentials.env node scripts/check-views.mjs
import fs from 'node:fs'
import puppeteer from 'puppeteer'

const APP = process.env.APP ?? 'http://127.0.0.1:8099/'
const env = {}
for (const l of fs.readFileSync(process.env.CREDS ?? 'deploy/credentials.env', 'utf8').split('\n')) {
  if (l.includes('=') && !l.trim().startsWith('#')) {
    const i = l.indexOf('='); env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
}

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

const step = async (label, fn) => {
  try { await fn(); console.log('  ✓', label) }
  catch (e) { console.log('  ✗', label, '→', String(e.message ?? e).split('\n')[0]); throw e }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const clickText = async (t) => {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim().includes(t))
    if (!b) return false
    b.click(); return true
  }, t)
  if (!ok) throw new Error(`no encontré el botón «${t}»`)
  await sleep(700)
}

await step('carga la SPA', async () => {
  await page.goto(APP, { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForSelector('#login-email', { timeout: 15000 })
})

await step('inicia sesión como administrador', async () => {
  await page.type('#login-email', env.APP_USER)
  await page.type('#login-pass', env.APP_USER_PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !document.querySelector('#login-email'), { timeout: 30000 })
  await sleep(2500)
})

// cerrar la guía si se abrió sola
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /saltar|cerrar|entendido|listo/i.test(x.textContent ?? ''))
  b?.click()
}).catch(() => {})
await sleep(500)

await step('ve los daños del equipo (los subió la inspectora)', async () => {
  const t = await text()
  for (const needle of ['Humedades / filtraciones', 'Fisuras', 'Paloma']) {
    if (!t.includes(needle)) throw new Error(`no aparece «${needle}» en la lista`)
  }
})

await step('indicador de tiempo real activo', async () => {
  const t = await text()
  if (!t.includes('En vivo')) throw new Error('no muestra «En vivo»')
})

await step('vista Ensayos accesible desde la barra superior', async () => {
  await clickText('Ensayos')
  const t = await text()
  if (!t.includes('Ensayos')) throw new Error('no cargó la vista')
  if (!t.includes('Nuevo ensayo') && !t.includes('Registrar primer ensayo'))
    throw new Error('no ofrece crear un ensayo')
})

await step('atajos de ensayos frecuentes', async () => {
  await clickText('Nuevo ensayo').catch(() => clickText('Registrar primer ensayo'))
  const t = await text()
  if (!t.includes('Esclerometría') || !t.includes('Carbonatación'))
    throw new Error('no muestra los atajos')
})

await step('vista Resultados', async () => {
  await clickText('Resultados')
  const t = await text()
  if (!t.includes('Ensayos')) throw new Error('no muestra el resumen de ensayos')
})

await step('formulario de daño: ámbito estructural / no estructural', async () => {
  await clickText('Lista')
  await clickText('Nuevo daño')
  await sleep(600)
  const estructural = await page.evaluate(() =>
    [...document.querySelectorAll('select')][0]?.innerText ?? '')
  await clickText('No estructural')
  const noEstructural = await page.evaluate(() =>
    [...document.querySelectorAll('select')][0]?.innerText ?? '')
  if (estructural === noEstructural) throw new Error('el catálogo no cambió al cambiar de ámbito')
  if (!noEstructural.includes('cielos') && !noEstructural.includes('Cubierta') && !noEstructural.includes('Revestimientos'))
    throw new Error('el catálogo no estructural no trae sus componentes: ' + noEstructural.slice(0, 120))
  console.log('      componentes no estructurales:', noEstructural.replace(/\n/g, ' | ').slice(0, 140))
})

await page.screenshot({ path: 'scripts/check-views.png', fullPage: false })
await browser.close()

console.log(errors.length ? '\nERRORES DE CONSOLA:' : '\nSin errores de consola.')
for (const e of [...new Set(errors)]) console.log('  ·', e)
process.exit(errors.some((e) => !/favicon|manifest|404/i.test(e)) ? 1 : 0)
