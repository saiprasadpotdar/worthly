import type { Investment } from '@/types'

/**
 * Parse a CAMS / KFintech Consolidated Account Statement (CAS) PDF.
 * Loads pdf.js from CDN (with fallback URLs) for PDF text extraction.
 *
 * Supports both "Summary" and "Detailed" CAS formats.
 */

interface ParsedHolding {
  scheme: string
  amc: string
  nav: number
  units: number
  currentValue: number
  costValue: number
}

export interface CamsParseResult {
  holdings: Omit<Investment, 'id'>[]
  extractedText: string
  debugInfo: string[]
}

// CDN URLs with fallbacks
const PDFJS_CDNS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
]
const WORKER_CDNS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
]

async function loadPdfJs(): Promise<any> {
  const existing = (window as any).pdfjsLib
  if (existing) return existing

  for (let idx = 0; idx < PDFJS_CDNS.length; idx++) {
    try {
      await loadScript(PDFJS_CDNS[idx])
      const lib = (window as any).pdfjsLib
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = WORKER_CDNS[idx]
        return lib
      }
    } catch {
      continue
    }
  }

  throw new Error('Could not load PDF library. Please check your internet connection and try again.')
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { resolve(); return }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => { script.remove(); reject(new Error(`Failed to load: ${src}`)) }
    document.head.appendChild(script)
  })
}

async function extractTextFromPdf(data: ArrayBuffer, password: string, debug: string[]): Promise<string> {
  debug.push('Loading pdf.js library...')
  const pdfjsLib = await loadPdfJs()
  debug.push('pdf.js loaded successfully.')

  debug.push('Opening PDF document...')
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(data),
    password: password || undefined,
  })

  const pdf = await loadingTask.promise
  debug.push(`PDF opened: ${pdf.numPages} pages`)
  const allLines: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()

    const lineMap = new Map<number, { x: number; str: string; width: number }[]>()
    for (const item of textContent.items as any[]) {
      if (!item.str || item.str.trim() === '') continue
      const y = Math.round(item.transform[5])
      const x = item.transform[4]
      const width = item.width || item.str.length * 5
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push({ x, str: item.str, width })
    }

    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      const items = lineMap.get(y)!.sort((a, b) => a.x - b.x)
      let line = ''
      for (let j = 0; j < items.length; j++) {
        if (j > 0) {
          const prevEnd = items[j - 1].x + items[j - 1].width
          const gap = items[j].x - prevEnd
          line += gap > 20 ? '\t' : ' '
        }
        line += items[j].str
      }
      line = line.trim()
      if (line) allLines.push(line)
    }

    allLines.push('---PAGE_BREAK---')
  }

  debug.push(`Extracted ${allLines.length} lines of text.`)
  return allLines.join('\n')
}

function parseNumber(str: string): number {
  if (!str) return 0
  const cleaned = str.replace(/[₹,\s()INR]/gi, '').trim()
  const isNeg = (str.includes('(') && str.includes(')')) || cleaned.startsWith('-')
  const num = parseFloat(cleaned.replace('-', ''))
  if (isNaN(num)) return 0
  return isNeg ? -num : num
}

/**
 * Check if a line looks like a mutual fund scheme name.
 * Must contain fund-related keywords but NOT be a data/summary line.
 */
function looksLikeScheme(line: string): boolean {
  if (line.length < 15) return false

  // Exclude lines that are clearly NOT scheme names
  // These are data lines that happen to contain keywords like "value", "tax", "income"
  if (/^(Cost|Total|Avg|Average|Net|Gross|Stamp|Exit|Entry|Amount|Opening|Closing|Invested|Market|Current|Mkt)\b/i.test(line)) return false
  if (/^[\d₹(,.\-\s]+$/.test(line)) return false // Pure numbers
  if (/^(Date|Trans|STT|Load|Dividend|Payout|Reinvest|Purchase|Redemption|Switch)\s/i.test(line)) return false
  if (/Valuation\s*(?:on|:)/i.test(line)) return false
  if (/NAV\s*(?:on|:)/i.test(line)) return false
  if (/^\d{2}-\w{3}-\d{4}/.test(line)) return false // Transaction date lines

  // Must contain a fund-related keyword
  return /fund|growth|dividend|idcw|direct\s*plan|regular\s*plan|flexi\s*cap|nifty|sensex|midcap|smallcap|large\s*cap|multi\s*cap|hybrid|balanced|index\s*fund|etf|gilt|liquid|overnight|arbitrage|elss|bluechip|focused|contra|thematic/i.test(line)
}

function isNonScheme(line: string): boolean {
  return /^(Registrar|Advisor|PAN|KYC|ISIN|Nominee|Date\s+Trans|Opening\s+Unit|Trans\.?\s+NAV|Stamp\s+Duty|STT|Total\s+Tax|Load|Amount\s+\(|Cost\s+Value|Total\s+Cost|Closing\s+Unit|Net\s+Asset)/i.test(line)
}

/**
 * Parse CAS text into holdings.
 *
 * Approach: find all "Valuation" lines first, then work backwards to find scheme names
 * and forwards to find cost values. This is more reliable than stateful forward parsing
 * because it anchors on the valuation (which has a very distinctive format).
 */
function parseCASText(text: string, debug: string[]): ParsedHolding[] {
  const lines = text.split('\n')

  debug.push(`Total lines: ${lines.length}`)
  debug.push('--- First 30 lines ---')
  lines.slice(0, 30).forEach((l, i) => debug.push(`  [${i}] ${l.substring(0, 150)}`))
  debug.push('---')

  // ============ Primary Strategy: Anchor on Valuation lines ============
  debug.push('=== Primary: Anchor on Valuation lines ===')

  // Step 1: Find all valuation line indices
  interface ValuationAnchor {
    lineIdx: number
    value: number
    nav: number
    units: number
  }
  const anchors: ValuationAnchor[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Match "Valuation on DD-Mon-YYYY: ₹XX,XXX.XX" or "Valuation : XX,XXX.XX"
    const valMatch = /Valuation\s*(?:on\s*[\w\-,\s]+?)?\s*[:.]?\s*₹?\s*([\d,]+\.?\d*)/i.exec(line)
    if (valMatch) {
      const value = parseNumber(valMatch[1])
      if (value > 0) {
        // Also try to get NAV and units from the same line or the line before
        let nav = 0, units = 0
        const combined = (lines[i - 1]?.trim() || '') + ' ' + line
        const navM = /NAV\s*(?:on\s*[\w\-,\s]+?)?\s*[:.]?\s*₹?\s*([\d,]+\.\d{2,})/i.exec(combined)
        if (navM) nav = parseNumber(navM[1])
        const unitM = /(?:Closing\s*(?:Unit\s*)?Balance|Bal\.?\s*Units?)\s*[:.]?\s*([\d,]+\.\d+)/i.exec(combined)
        if (unitM) units = parseNumber(unitM[1])

        debug.push(`Valuation anchor at line ${i}: value=${value}, nav=${nav}, units=${units}`)
        anchors.push({ lineIdx: i, value, nav, units })
      }
    }
  }

  debug.push(`Found ${anchors.length} valuation anchors`)

  if (anchors.length === 0) {
    // Try alternate: look for "Bal. Units : X.XXX NAV : X.XXXX Value : X,XXX.XX" pattern
    debug.push('No "Valuation" keyword found. Trying alternate patterns...')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      // "Market Value" or just "Value" at end of a summary line
      const altVal = /(?:Market\s+)?Value\s*[:.]?\s*₹?\s*([\d,]+\.?\d+)/i.exec(line)
      if (altVal) {
        const value = parseNumber(altVal[1])
        if (value > 100) { // filter out tiny noise matches
          let nav = 0, units = 0
          const navM = /NAV\s*[:.]?\s*₹?\s*([\d,]+\.\d{2,})/i.exec(line)
          if (navM) nav = parseNumber(navM[1])
          const unitM = /(?:Units?|Bal\.?\s*Units?)\s*[:.]?\s*([\d,]+\.\d+)/i.exec(line)
          if (unitM) units = parseNumber(unitM[1])

          if (nav > 0 || units > 0) {
            debug.push(`Alt valuation at line ${i}: value=${value}, nav=${nav}, units=${units}`)
            anchors.push({ lineIdx: i, value, nav, units })
          }
        }
      }
    }
    debug.push(`After alt scan: ${anchors.length} anchors`)
  }

  // Step 2: For each valuation anchor, search BACKWARDS for scheme name and FORWARDS for cost
  const holdings: ParsedHolding[] = []

  for (const anchor of anchors) {
    const { lineIdx, value, nav, units } = anchor

    // Search backwards (up to 50 lines) for the nearest scheme name
    let scheme = ''
    let amc = ''
    for (let j = lineIdx - 1; j >= Math.max(0, lineIdx - 50); j--) {
      const bLine = lines[j].trim()
      if (!bLine || bLine === '---PAGE_BREAK---') continue

      // If we hit another valuation line, stop searching backwards
      if (/Valuation\s*(?:on|:)/i.test(bLine)) break

      // Pick up AMC name while searching
      const amcM = /^(.+?)\s+(?:Mutual\s+Fund|Asset\s+Management)/i.exec(bLine)
      if (amcM && !amc) {
        amc = amcM[1].trim()
      }

      // Check if this is a scheme name
      if (!scheme && looksLikeScheme(bLine)) {
        scheme = bLine.replace(/\s+/g, ' ').trim()
        debug.push(`  Scheme for val@${lineIdx}: "${scheme.substring(0, 80)}" (line ${j})`)
      }

      // If we found both scheme and AMC, stop
      if (scheme && amc) break
    }

    if (!scheme) {
      debug.push(`  No scheme found for valuation at line ${lineIdx}, skipping`)
      continue
    }

    // Search FORWARD (up to 5 lines) for cost value — it comes right after valuation
    let costValue = 0
    for (let j = lineIdx; j <= Math.min(lineIdx + 5, lines.length - 1); j++) {
      const fLine = lines[j].trim()
      const costM = /Cost\s*(?:Value)?\s*[:.]?\s*₹?\s*([\d,]+\.?\d*)/i.exec(fLine)
      if (costM) {
        costValue = parseNumber(costM[1])
        debug.push(`  Cost for "${scheme.substring(0, 40)}": ${costValue} (line ${j})`)
        break
      }
      // Also check "Total Cost"
      const tcM = /Total\s*Cost\s*[:.]?\s*₹?\s*([\d,]+\.?\d*)/i.exec(fLine)
      if (tcM) {
        costValue = parseNumber(tcM[1])
        debug.push(`  Total Cost for "${scheme.substring(0, 40)}": ${costValue} (line ${j})`)
        break
      }
    }

    holdings.push({
      scheme,
      amc,
      nav,
      units,
      currentValue: value,
      costValue: costValue || value, // fallback to current value if no cost found
    })
  }

  debug.push(`Primary strategy found: ${holdings.length} holdings`)

  // ============ Fallback: Table pattern scan ============
  if (holdings.length === 0) {
    debug.push('=== Fallback: Table pattern scan ===')
    let currentAmc = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line === '---PAGE_BREAK---') continue

      const amcM = /^(.+?)\s+(?:Mutual\s+Fund|Asset\s+Management)/i.exec(line)
      if (amcM) { currentAmc = amcM[1].trim(); continue }

      const parts = line.split(/\t+|\s{3,}/)
      if (parts.length >= 3) {
        const namePart = parts[0]?.trim()
        if (namePart && looksLikeScheme(namePart)) {
          const numbers = parts.slice(1).map(p => parseNumber(p.trim())).filter(n => n > 0)
          if (numbers.length >= 1) {
            const value = numbers[numbers.length - 1]
            const cost = numbers.length >= 2 ? numbers[numbers.length - 2] : value
            debug.push(`  Table: "${namePart.substring(0, 60)}" = ${value}`)
            holdings.push({
              scheme: namePart, amc: currentAmc,
              nav: 0, units: 0, currentValue: value, costValue: cost,
            })
          }
        }
      }
    }
    debug.push(`Fallback found: ${holdings.length} holdings`)
  }

  // Deduplicate by scheme name (keep entry with more data)
  const seen = new Map<string, ParsedHolding>()
  for (const h of holdings) {
    const key = h.scheme.toLowerCase().replace(/\s+/g, ' ').trim()
    const existing = seen.get(key)
    if (!existing || h.currentValue > existing.currentValue) {
      seen.set(key, h)
    }
  }

  const result = [...seen.values()]
  debug.push(`After dedup: ${result.length} unique holdings`)
  return result
}

// Asset class heuristics
function guessAssetClass(scheme: string): 'equity' | 'debt' | 'fixed' {
  const s = scheme.toLowerCase()
  if (s.includes('liquid') || s.includes('overnight') || s.includes('money market')) return 'debt'
  if (s.includes('gilt') || s.includes('bond') || s.includes('debt') || s.includes('income fund') ||
      s.includes('credit risk') || s.includes('banking & psu') || s.includes('corporate bond') ||
      s.includes('short duration') || s.includes('medium duration') || s.includes('long duration') ||
      s.includes('floater') || s.includes('dynamic bond') || s.includes('low duration') ||
      s.includes('ultra short') || s.includes('conservative')) return 'debt'
  if (s.includes('fixed deposit') || s.includes(' fd ') || s.includes('deposit')) return 'fixed'
  return 'equity'
}

function cleanSchemeName(name: string): string {
  return name
    .replace(/\s*-\s*Regular\s*Plan/i, '')
    .replace(/\s*-\s*Direct\s*Plan/i, ' (Direct)')
    .replace(/\s*-\s*Growth\s*Option/i, '')
    .replace(/\s*-?\s*Growth$/i, '')
    .replace(/\s*-\s*Payout\s*of\s*Income\s*Distribution.*/i, '')
    .replace(/Registrar\s*:.*/i, '')
    .replace(/Advisor\s*:.*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Main entry: parse CAMS CAS PDF and return Investment objects + debug info.
 */
export async function parseCAMSPdf(
  pdfData: ArrayBuffer,
  password: string
): Promise<CamsParseResult> {
  const debug: string[] = []

  let text: string
  try {
    text = await extractTextFromPdf(pdfData, password, debug)
  } catch (err: any) {
    const msg = err?.message || String(err)
    debug.push(`PDF load failed: ${msg}`)

    if (msg.includes('password') || msg.includes('Password') || msg.includes('incorrect')) {
      throw new Error('Incorrect password. CAMS CAS PDFs are usually protected with your PAN number (e.g., ABCDE1234F).')
    }
    if (msg.includes('Invalid PDF') || msg.includes('invalid')) {
      throw new Error('This does not appear to be a valid PDF file.')
    }
    throw new Error(`Failed to read PDF: ${msg}`)
  }

  const holdings = parseCASText(text, debug)

  const investments = holdings.map(h => ({
    goal: 'Retirement',
    assetClass: guessAssetClass(h.scheme),
    instrument: cleanSchemeName(h.scheme),
    investedValue: h.costValue,
    currentValue: h.currentValue,
    startDate: new Date().toISOString().split('T')[0],
    platform: h.amc || 'CAMS Import',
  }))

  debug.push(`Final: ${investments.length} investments to import.`)

  return { holdings: investments, extractedText: text, debugInfo: debug }
}
