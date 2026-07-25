// E2E: crear hallazgo CON FOTO en la app → sincronizar → verificar que la foto llegó a PocketBase.
import puppeteer from 'puppeteer'
import PocketBase from 'pocketbase'
import { writeFileSync } from 'node:fs'

const APP = 'http://localhost:5173/'
const PB = 'http://127.0.0.1:8097'
const EMAIL = 'inspector@test.cl'
const PASS = 'password123'

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const imgPath = 'scripts/_testphoto.png'
writeFileSync(imgPath, Buffer.from(PNG_B64, 'base64'))

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto(APP, { waitUntil: 'networkidle2', timeout: 20000 })
await new Promise((r) => setTimeout(r, 2000))

const clickText = (t) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes(t))
    if (b) { b.click(); return true }
    return false
  }, t)

// login
await clickText('Conectar')
await new Promise((r) => setTimeout(r, 300))
await page.evaluate(({ EMAIL, PASS }) => {
  const set = (s, v) => {
    const el = document.querySelector(s)
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  set('input[placeholder="Email"]', EMAIL)
  set('input[placeholder="Clave"]', PASS)
}, { EMAIL, PASS })
await clickText('Entrar')
await new Promise((r) => setTimeout(r, 1200))
await clickText('Sincronización') // cerrar panel
await new Promise((r) => setTimeout(r, 300))

// seleccionar elemento + abrir formulario de hallazgo
await clickText('C A1 · N3')
await new Promise((r) => setTimeout(r, 400))
await clickText('Registrar hallazgo')
await new Promise((r) => setTimeout(r, 400))

// adjuntar la foto en el input file
const fileInput = await page.$('input[type=file]')
console.log('input file encontrado:', !!fileInput)
await fileInput.uploadFile(imgPath)
await new Promise((r) => setTimeout(r, 800))
const dbg = await page.evaluate(() => ({
  formOpen: document.body.innerText.includes('Tipo de daño'),
  fileInputs: document.querySelectorAll('input[type=file]').length,
  formImgs: document.querySelectorAll('aside img').length,
  filesOnInput: document.querySelector('input[type=file]')?.files?.length ?? -1,
}))
console.log('debug tras upload:', JSON.stringify(dbg))
await clickText('Guardar')
await new Promise((r) => setTimeout(r, 1000))

// inspeccionar Dexie: ¿el hallazgo quedó con foto (dataUrl, sin remoteName)?
const dexie = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const req = indexedDB.open('inspecta')
      req.onsuccess = () => {
        const tx = req.result.transaction('findings', 'readonly')
        const all = tx.objectStore('findings').getAll()
        all.onsuccess = () => {
          const fs = all.result
          const dump = fs.map((f) => ({
            el: f.elementId,
            idLen: (f.id || '').length,
            photos: (f.photos || []).map((p) => ({ data: !!p.dataUrl, remote: p.remoteName || null })),
          }))
          resolve({ total: fs.length, findings: dump })
        }
      }
      req.onerror = () => resolve({ error: true })
    }),
)
console.log('Dexie findings:', JSON.stringify(dexie))

// sincronizar
await clickText('Sincronización')
await new Promise((r) => setTimeout(r, 300))
await clickText('Sincronizar ahora')
await new Promise((r) => setTimeout(r, 4000))

const msg = await page.evaluate(() => {
  const m = document.body.innerText.match(/Enviados \d+ · Fotos \d+ · Recibidos \d+/)
  const e = document.body.innerText.match(/Error: .*/)
  return m?.[0] ?? e?.[0] ?? '(none)'
})
console.log('mensaje de sync:', msg)
await page.screenshot({ path: 'scripts/check-photo-sync.png' })
await browser.close()

// verificar en PocketBase
const pb = new PocketBase(PB)
await pb.collection('users').authWithPassword(EMAIL, PASS)
const findings = await pb.collection('findings').getFullList()
const withPhoto = findings.filter((f) => Array.isArray(f.photos) && f.photos.length > 0)
console.log('hallazgos con foto en PocketBase:', withPhoto.length)
if (withPhoto[0]) {
  const f = withPhoto[0]
  const url = pb.files.getURL(f, f.photos[0], { thumb: '100x100' })
  const res = await fetch(url)
  console.log('thumbnail del hallazgo sincronizado:', res.status, res.headers.get('content-type'))
}
console.log(withPhoto.length ? '✅ la foto se subió a PocketBase vía el sync de la app' : '❌ la foto NO se subió')
