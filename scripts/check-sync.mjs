// E2E: login por la UI → sincronizar → verificar que los datos llegaron a PocketBase.
import puppeteer from 'puppeteer'
import PocketBase from 'pocketbase'

const APP = 'http://localhost:5173/'
const PB = 'http://127.0.0.1:8097'
const EMAIL = 'inspector@test.cl'
const PASS = 'password123'

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => {
  window.__errs = []
  addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason?.message ?? e.reason)))
})
await page.goto(APP, { waitUntil: 'networkidle2', timeout: 20000 })
await new Promise((r) => setTimeout(r, 2000))

const clickText = (t) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes(t))
    if (b) { b.click(); return true }
    return false
  }, t)

// 1) abrir panel de sync + login
await clickText('Conectar')
await new Promise((r) => setTimeout(r, 300))
await page.evaluate(({ EMAIL, PASS }) => {
  const set = (sel, val) => {
    const el = document.querySelector(sel)
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  set('input[placeholder="Email"]', EMAIL)
  set('input[placeholder="Clave"]', PASS)
}, { EMAIL, PASS })
await clickText('Entrar')
await new Promise((r) => setTimeout(r, 1500))

const authed = await page.evaluate(() => document.body.innerText.includes('Sincronizar ahora'))
console.log('login OK (panel muestra sincronizar):', authed)

// 2) sincronizar
await clickText('Sincronizar ahora')
await new Promise((r) => setTimeout(r, 3500))

const msg = await page.evaluate(() => {
  const m = document.body.innerText.match(/Enviados \d+ · Fotos \d+ · Recibidos \d+/)
  const err = document.body.innerText.match(/Error: .*/)
  return { sync: m?.[0] ?? null, err: err?.[0] ?? null }
})
console.log('mensaje de sync:', msg.sync ?? msg.err ?? '(ninguno)')
const errs = await page.evaluate(() => window.__errs || [])
console.log('errores JS:', errs.length ? errs.slice(0, 3) : '(ninguno)')
await page.screenshot({ path: 'scripts/check-sync.png' })
await browser.close()

// 3) verificar en PocketBase que los datos del usuario llegaron
const pb = new PocketBase(PB)
await pb.collection('users').authWithPassword(EMAIL, PASS)
const projects = await pb.collection('projects').getFullList()
const findings = await pb.collection('findings').getFullList()
console.log('\nEn PocketBase (usuario inspector):')
console.log('  proyectos:', projects.map((p) => p.name).join(' | '))
console.log('  hallazgos:', findings.length)
const demo = projects.find((p) => p.name.includes('Aulario UACh'))
console.log(demo ? '✅ el proyecto demo se sincronizó a PocketBase' : '❌ no se encontró el proyecto demo')
