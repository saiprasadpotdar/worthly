/**
 * Kuvera CSV Import Parser
 *
 * Kuvera exports portfolio as CSV with columns like:
 * Scheme Name, ISIN, Folio Number, Units, Avg. NAV, Current NAV,
 * Invested Value, Current Value, Returns, XIRR, Asset Class, etc.
 *
 * This parser handles common Kuvera CSV formats.
 */

import type { Investment } from '@/types'

export interface KuveraParseResult {
  holdings: Omit<Investment, 'id'>[]
  errors: string[]
}

function detectAssetClass(row: Record<string, string>): Investment['assetClass'] {
  const assetClass = (row['Asset Class'] || row['asset_class'] || row['Category'] || row['category'] || '').toLowerCase()
  const schemeName = (row['Scheme Name'] || row['scheme_name'] || row['Fund Name'] || '').toLowerCase()

  if (assetClass.includes('equity') || schemeName.includes('equity') || schemeName.includes('nifty') || schemeName.includes('sensex') || schemeName.includes('midcap') || schemeName.includes('smallcap') || schemeName.includes('flexicap') || schemeName.includes('multicap')) {
    return 'equity'
  }
  if (assetClass.includes('debt') || assetClass.includes('liquid') || schemeName.includes('liquid') || schemeName.includes('overnight') || schemeName.includes('money market') || schemeName.includes('gilt') || schemeName.includes('bond')) {
    return 'debt'
  }
  if (assetClass.includes('hybrid') || schemeName.includes('hybrid') || schemeName.includes('balanced')) {
    return 'equity' // hybrid classified under equity for simplicity
  }
  if (schemeName.includes('gold') || schemeName.includes('silver')) {
    return 'fixed'
  }
  return 'equity' // default
}

function parseAmount(val: string | undefined): number {
  if (!val) return 0
  // Remove currency symbols, commas, whitespace
  const cleaned = val.replace(/[₹,\s]/g, '').trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function getField(row: Record<string, string>, ...candidates: string[]): string {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== '') return row[key]
  }
  // Try case-insensitive match
  const rowKeys = Object.keys(row)
  for (const candidate of candidates) {
    const match = rowKeys.find(k => k.toLowerCase().trim() === candidate.toLowerCase().trim())
    if (match && row[match] !== undefined && row[match] !== '') return row[match]
  }
  return ''
}

export function parseKuveraCSV(csvText: string): KuveraParseResult {
  const holdings: Omit<Investment, 'id'>[] = []
  const errors: string[] = []

  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) {
    errors.push('CSV file is empty or has no data rows.')
    return { holdings, errors }
  }

  // Parse header
  const headerLine = lines[0]
  const headers = parseCSVLine(headerLine)

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i])
      if (values.length < headers.length * 0.5) continue // skip malformed rows

      const row: Record<string, string> = {}
      headers.forEach((h, idx) => {
        row[h.trim()] = (values[idx] || '').trim()
      })

      const schemeName = getField(row, 'Scheme Name', 'scheme_name', 'Fund Name', 'fund_name', 'Name')
      if (!schemeName) continue

      const investedValue = parseAmount(getField(row, 'Invested Value', 'invested_value', 'Invested Amount', 'Cost Value', 'Amount Invested'))
      const currentValue = parseAmount(getField(row, 'Current Value', 'current_value', 'Market Value', 'Present Value'))
      const platform = getField(row, 'Platform', 'platform') || 'Kuvera'

      if (currentValue === 0 && investedValue === 0) continue // skip empty rows

      holdings.push({
        goal: 'Retirement',
        assetClass: detectAssetClass(row),
        instrument: schemeName,
        investedValue,
        currentValue: currentValue || investedValue,
        startDate: new Date().toISOString().split('T')[0],
        platform,
      })
    } catch (err) {
      errors.push(`Row ${i + 1}: Failed to parse - ${err}`)
    }
  }

  if (holdings.length === 0 && errors.length === 0) {
    errors.push('No valid holdings found in the CSV. Please check the format.')
  }

  return { holdings, errors }
}

/** Parse a single CSV line handling quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}
