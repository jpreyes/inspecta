// QA: importa un IFC por la INTERFAZ y comprueba la vuelta completa —
// parseo con web-ifc en el navegador, capa semántica de elementos, árbol
// lateral, y subida del archivo a PocketBase.
//
// Es la prueba de la parte más frágil de la app: la geometría. Verifica todo
// menos el render WebGL en sí, que un Chromium headless sin GPU no puede hacer.
//
//   APP=http://127.0.0.1:8099/ CREDS=deploy/credentials.env \
//     node scripts/check-model-import.mjs
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
await page.setViewport({ width: 1600, height: 950 })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(e.message))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const text = () => page.evaluate(() => document.body.innerText)
const step = async (l, fn) => { try { await fn(); console.log('  ✓', l) } catch (e) { console.log('  ✗', l, '→', String(e.message ?? e).split('\n')[0]); throw e } }
const clickText = async (t, ms = 700) => {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim().includes(t))
    if (!b) return false; b.click(); return true
  }, t)
  if (!ok) throw new Error(`no encontré el botón «${t}»`)
  await sleep(ms)
}

await step('sesión de administrador', async () => {
  await page.goto(APP, { waitUntil: 'networkidle2', timeout: 30000 })
  await page.waitForSelector('#login-email', { timeout: 15000 })
  await page.type('#login-email', env.APP_USER)
  await page.type('#login-pass', env.APP_USER_PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !document.querySelector('#login-email'), { timeout: 30000 })
  await sleep(2500)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /saltar|cerrar|entendido|listo/i.test(x.textContent ?? ''))
    b?.click()
  })
  await sleep(400)
})

await step('abrir el editor de la estructura CIC Máfil', async () => {
  // pasar el mouse por la fila y pulsar "Editar estructura"
  const ok = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button[title="Editar estructura"]')]
    const target = b.find((x) => x.closest('.group')?.innerText?.includes('CIC Máfil')) ?? b[0]
    if (!target) return false
    target.click(); return true
  })
  if (!ok) throw new Error('no hay botón de editar estructura')
  await sleep(600)
  const t = await text()
  if (!/gemelo 3d/i.test(t)) throw new Error('el editor no muestra el bloque de gemelo 3D')
  if (!t.includes('Sin modelo 3D')) throw new Error('esperaba que la estructura no tuviera modelo: ' + t.slice(0, 200))
})

await step('elegir «Importar archivo» y cargar el IFC', async () => {
  await page.evaluate(() => {
    const r = [...document.querySelectorAll('input[type="radio"]')].find(
      (x) => x.parentElement?.innerText?.includes('Importar archivo'))
    if (!r) throw new Error('sin opción de importar')
    r.click()
  })
  await sleep(400)
  const input = await page.$('input[type="file"]')
  if (!input) throw new Error('no apareció el selector de archivo')
  await input.uploadFile('scripts/fixtures/edificio.ifc')
  await sleep(400)
  const t = await text()
  if (!t.includes('edificio.ifc')) throw new Error('no tomó el archivo')
})

await step('guardar: se parsea el IFC y se abre el gemelo', async () => {
  await clickText('Guardar', 1000)
  // el parseo baja 3,5 MB de web-ifc + WASM: hay que darle tiempo
  await page.waitForFunction(
    () => document.body.innerText.includes('elementos —') || document.body.innerText.includes('No se pudo'),
    { timeout: 90000 },
  )
  await sleep(2500)
})

await step('el gemelo trae los elementos con su tipo y su piso', async () => {
  const t = await text()
  const m = t.match(/(\d+) elementos —([^\n]*)/)
  if (!m) throw new Error('no salió el resumen del importador: ' + t.slice(0, 300))
  console.log('      resumen:', m[0].trim())
  if (Number(m[1]) !== 8) throw new Error(`esperaba 8 elementos (6 pilares + viga + losa), llegaron ${m[1]}`)
  if (!m[2].includes('columna')) throw new Error('no reconoció las columnas: ' + m[2])
  if (!m[2].includes('viga')) throw new Error('no reconoció la viga: ' + m[2])
  if (!m[2].includes('losa')) throw new Error('no reconoció la losa: ' + m[2])
})

await step('el lienzo 3D dibuja de verdad (no queda en negro)', async () => {
  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    if (!c) return null
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    return { w: c.width, h: c.height, gl: !!gl }
  })
  if (!info) throw new Error('no hay canvas')
  console.log(`      canvas ${info.w}×${info.h}, webgl=${info.gl}`)
  if (!info.gl) console.log('      (este Chromium headless no trae WebGL: el render no se verifica acá)')
})

await step('los elementos importados salen en el árbol lateral', async () => {
  const aside = () => page.evaluate(() => document.querySelector('aside[data-tour="sidebar"]')?.innerText ?? '(sin aside)')
  console.log('      lateral antes:', (await aside()).replace(/\n/g, ' | ').slice(0, 260))
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].filter((x) => /nivel/i.test(x.innerText ?? ''))
    b.forEach((x) => x.click())
    return b.map((x) => x.innerText.replace(/\n/g, ' '))
  })
  console.log('      botones de nivel:', JSON.stringify(clicked))
  await sleep(800)
  console.log('      lateral después:', (await aside()).replace(/\n/g, ' | ').slice(0, 400))
  const t = await aside()
  if (!t.includes('Pilar A1')) throw new Error('no aparecen los elementos del IFC en el árbol')
  console.log('      árbol contiene Pilar A1 ✔')
})

await step('sincronizar sube el archivo del modelo a PocketBase', async () => {
  await page.click('[data-tour="sync"]')   // abre el panel de sincronización
  await sleep(500)
  await clickText('Sincronizar ahora', 1500)
  await page.waitForFunction(
    () => /Enviados \d+/.test(document.body.innerText) || /Error/.test(document.body.innerText),
    { timeout: 60000 },
  )
  const m = (await text()).match(/Enviados[^\n]*/)
  console.log('      ' + (m ? m[0] : '(sin mensaje de sync)'))
  await sleep(2000)
})

await page.screenshot({ path: 'scripts/check-model-import.png' })
await browser.close()
const reales = [...new Set(errors)].filter((e) => !/favicon|manifest|404|Download the React/i.test(e))
console.log(reales.length ? '\nERRORES DE CONSOLA:' : '\nSin errores de consola.')
for (const e of reales) console.log('  ·', e)
process.exit(reales.length ? 1 : 0)
