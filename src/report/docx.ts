// Generación del informe de inspección en Word (.docx), en el cliente (offline).
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
} from 'docx'
import type { Finding, Inspection, Project, Structure, Test } from '../types/inspection'
import { SEVERITY, findingIndex, findingPriority, CONDITION, type ConditionKey } from '../types/inspection'
import { RISK_META, type RiskLevel, type RegisteredIrreg } from '../data/vulnerability'
import { HAZARD_META, hazardClass, SEISMIC_ZONES, SOIL_TYPES, OCCUPANCY_CATS } from '../data/hazard'

export interface ReportData {
  project: Project | null
  structure: Structure
  inspection: Inspection
  findings: Finding[] // ya priorizados
  tests: Test[]
  conditionScore: number
  conditionKey: ConditionKey
  hazardScore: number
  risk: RiskLevel
  irregularities: RegisteredIrreg[]
  nonStructuralCount: number
  generatedAt: string // ISO (se inyecta desde el navegador)
}

const INK = '334155'
const MUTED = '64748b'
const hex = (c: string) => c.replace('#', '')
const IRR_LEVEL = ['—', 'Moderada', 'Severa/extrema']
const TYPE_LABEL: Record<string, string> = {
  edificio: 'Edificio',
  puente: 'Puente',
  nave: 'Nave industrial',
  torre: 'Torre',
}

function fmtDate(d?: string) {
  if (!d) return '—'
  const iso = d.length <= 10 ? d + 'T00:00:00' : d
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ── helpers de tabla ──
function cell(text: string | Paragraph[], opts: { bold?: boolean; color?: string; width?: number; fill?: string; size?: number } = {}) {
  const children = Array.isArray(text)
    ? text
    : [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: opts.size ?? 18 })] })]
  return new TableCell({
    children,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.fill ? { fill: opts.fill } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
  })
}
function headerRow(labels: string[], widths: number[]) {
  return new TableRow({
    tableHeader: true,
    children: labels.map((l, i) => cell(l, { bold: true, color: 'ffffff', fill: '1e293b', width: widths[i], size: 16 })),
  })
}
function table(rows: TableRow[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'cbd5e1' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'cbd5e1' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'cbd5e1' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'cbd5e1' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
    },
  })
}
function h(text: string) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 } })
}
function kv(k: string, v: string) {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: k + ': ', bold: true, size: 20, color: INK }), new TextRun({ text: v, size: 20 })],
  })
}

function dataUrlToImage(dataUrl: string): { data: Uint8Array; type: 'jpg' | 'png' | 'gif' } | null {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return null
  const mime = /data:(.*?);/.exec(dataUrl)?.[1] ?? 'image/jpeg'
  if (mime.includes('webp')) return null // docx no soporta webp
  try {
    const bin = atob(dataUrl.slice(comma + 1))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return { data: bytes, type: mime.includes('png') ? 'png' : 'jpg' }
  } catch {
    return null
  }
}

export async function buildReport(d: ReportData): Promise<Blob> {
  const cond = CONDITION[d.conditionKey]
  const haz = HAZARD_META[hazardClass(d.hazardScore)]
  const risk = RISK_META[d.risk]
  const site = d.structure.site ?? {}
  const body: (Paragraph | Table)[] = []

  // Título
  body.push(
    new Paragraph({ text: 'Informe de Inspección Estructural', heading: HeadingLevel.TITLE, spacing: { after: 60 } }),
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: `${d.structure.name}${d.project ? ' · ' + d.project.name : ''}`, size: 24, color: MUTED })],
    }),
  )

  // 1. Datos generales
  body.push(h('1. Datos generales'))
  if (d.project) body.push(kv('Proyecto', d.project.name))
  if (d.project?.client) body.push(kv('Cliente', d.project.client))
  body.push(kv('Estructura', `${d.structure.name} (${TYPE_LABEL[d.structure.type] ?? d.structure.type})`))
  const loc = d.project?.location
  if (loc) body.push(kv('Ubicación', `${loc.address ? loc.address + ' · ' : ''}${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`))
  body.push(kv('Campaña de inspección', fmtDate(d.inspection.date)))
  body.push(kv('Inspector', d.inspection.inspector))
  if (d.inspection.weather) body.push(kv('Clima', d.inspection.weather))
  if (d.inspection.summary) body.push(kv('Resumen', d.inspection.summary))

  // 2. Evaluación
  body.push(h('2. Evaluación'))
  body.push(
    table([
      new TableRow({
        children: [
          cell('Condición (daño)', { bold: true, width: 34, fill: 'f1f5f9' }),
          cell('Amenaza sísmica', { bold: true, width: 33, fill: 'f1f5f9' }),
          cell('Riesgo', { bold: true, width: 33, fill: 'f1f5f9' }),
        ],
      }),
      new TableRow({
        children: [
          cell([
            new Paragraph({ children: [new TextRun({ text: `${d.conditionScore}/100`, bold: true, size: 28, color: hex(cond.color) })] }),
            new Paragraph({ children: [new TextRun({ text: cond.label, size: 18, color: hex(cond.color) })] }),
          ]),
          cell([
            new Paragraph({ children: [new TextRun({ text: `${d.hazardScore}/100`, bold: true, size: 28, color: hex(haz.color) })] }),
            new Paragraph({ children: [new TextRun({ text: haz.label, size: 18, color: hex(haz.color) })] }),
          ]),
          cell([
            new Paragraph({ children: [new TextRun({ text: risk.label, bold: true, size: 28, color: hex(risk.color) })] }),
            new Paragraph({ children: [new TextRun({ text: 'condición × amenaza', size: 16, color: MUTED })] }),
          ]),
        ],
      }),
    ]),
  )
  body.push(new Paragraph({ spacing: { before: 80 }, children: [] }))
  const siteParts: string[] = []
  if (site.zone) siteParts.push(SEISMIC_ZONES[site.zone].label)
  if (site.soil) siteParts.push('Suelo ' + SOIL_TYPES[site.soil].label)
  if (site.importance) siteParts.push(OCCUPANCY_CATS[site.importance].label)
  body.push(kv('Sitio (NCh433)', siteParts.length ? siteParts.join(' · ') : 'sin definir'))
  body.push(kv('Índice de salud', `${d.conditionScore}/100 (100 = sano)`))
  if (d.nonStructuralCount)
    body.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `Nota: ${d.nonStructuralCount} hallazgo(s) en elementos no estructurales, registrados pero excluidos de la condición estructural.`, italics: true, size: 18, color: MUTED }),
        ],
      }),
    )

  // 3. Vulnerabilidad por configuración (registro)
  body.push(h('3. Vulnerabilidad por configuración'))
  if (!d.irregularities.length) {
    body.push(new Paragraph({ children: [new TextRun({ text: 'Sin irregularidades registradas.', size: 20, color: MUTED })] }))
  } else {
    body.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: 'Registro cualitativo (no se agrega en un índice; su peligrosidad depende del análisis y del sismo).', italics: true, size: 18, color: MUTED })],
      }),
      table([
        headerRow(['Irregularidad', 'Grupo', 'Nivel', 'Referencia'], [40, 22, 18, 20]),
        ...d.irregularities.map(
          (irr) =>
            new TableRow({
              children: [
                cell(irr.name, { size: 18 }),
                cell(irr.group, { size: 18, color: MUTED }),
                cell(IRR_LEVEL[irr.cls] ?? '—', { size: 18, bold: true, color: irr.cls >= 2 ? hex('#ef4444') : hex('#eab308') }),
                cell(irr.code ?? '', { size: 16, color: MUTED }),
              ],
            }),
        ),
      ]),
    )
  }

  // 4. Hallazgos
  body.push(h(`4. Hallazgos (${d.findings.length})`))
  if (!d.findings.length) {
    body.push(new Paragraph({ children: [new TextRun({ text: 'Sin hallazgos registrados en esta campaña.', size: 20, color: MUTED })] }))
  } else {
    const rows = [headerRow(['Elemento / zona', 'Material', 'Daño · causa · notas', 'Sev.', 'Ext.', 'Índ.', 'Prior.'], [20, 13, 39, 9, 7, 6, 6])]
    for (const f of d.findings) {
      rows.push(
        new TableRow({
          children: [
            cell([
              new Paragraph({ children: [new TextRun({ text: f.element, bold: true, size: 18 })] }),
              ...(f.component ? [new Paragraph({ children: [new TextRun({ text: f.component, size: 15, color: MUTED })] })] : []),
              ...(f.zone ? [new Paragraph({ children: [new TextRun({ text: f.zone, size: 16, color: INK })] })] : []),
            ]),
            cell(f.material ?? '—', { size: 16 }),
            cell([
              new Paragraph({ children: [new TextRun({ text: f.damageType, bold: true, size: 18 })] }),
              ...(f.cause ? [new Paragraph({ children: [new TextRun({ text: 'Causa: ' + f.cause, size: 16, color: MUTED })] })] : []),
              ...(f.notes ? [new Paragraph({ children: [new TextRun({ text: f.notes, size: 16, italics: true })] })] : []),
            ]),
            cell(SEVERITY[f.severity].label, { size: 16, bold: true, color: hex(SEVERITY[f.severity].color) }),
            cell(`${f.extension}%`, { size: 16 }),
            cell(String(findingIndex(f)), { size: 16 }),
            cell(String(findingPriority(f)), { size: 16, bold: true }),
          ],
        }),
      )
    }
    body.push(table(rows))
  }

  // 5. Fotografías
  const withPhotos = d.findings.filter((f) => f.photos.some((p) => p.dataUrl))
  if (withPhotos.length) {
    body.push(h('5. Registro fotográfico'))
    for (const f of withPhotos) {
      body.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: `${f.element}${f.zone ? ' · ' + f.zone : ''} — ${f.damageType}`, bold: true, size: 18 })] }))
      const imgs: ImageRun[] = []
      for (const p of f.photos) {
        if (!p.dataUrl) continue
        const im = dataUrlToImage(p.dataUrl)
        if (im) imgs.push(new ImageRun({ data: im.data, type: im.type, transformation: { width: 200, height: 150 } }))
      }
      if (imgs.length) body.push(new Paragraph({ children: imgs.map((im) => im), spacing: { after: 80 } }))
    }
  }

  // 6. Ensayos
  if (d.tests.length) {
    body.push(h(`${withPhotos.length ? '6' : '5'}. Ensayos`))
    const rows = [headerRow(['Ensayo', 'Método / norma', 'Fecha', 'Ubicación', 'Resultado'], [18, 24, 12, 18, 28])]
    for (const t of d.tests) {
      rows.push(
        new TableRow({
          children: [
            cell(t.testType, { size: 18, bold: true }),
            cell([t.method, t.standard].filter(Boolean).join(' · ') || '—', { size: 16 }),
            cell(fmtDate(t.executedAt), { size: 16 }),
            cell(t.sampleLocation ?? '—', { size: 16 }),
            cell(t.resultSummary, { size: 16 }),
          ],
        }),
      )
    }
    body.push(table(rows))
  }

  // Pie
  body.push(
    new Paragraph({
      spacing: { before: 360 },
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `Generado con Inspecta · ${fmtDate(d.generatedAt)}`, size: 16, color: MUTED })],
    }),
  )

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{ properties: {}, children: body }],
  })
  return Packer.toBlob(doc)
}

/** Genera y descarga el informe .docx. */
export async function downloadReport(data: ReportData) {
  const blob = await buildReport(data)
  const slug = `${data.structure.name}_${data.inspection.date}`.replace(/[^\w\-]+/g, '_')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Informe_${slug}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
