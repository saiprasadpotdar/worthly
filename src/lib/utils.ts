import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    const sign = value < 0 ? '-' : ''
    const abs = Math.abs(value)
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
}

export const MASKED_AMOUNT = '₹•••••'

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function getChartColors(isDark: boolean) {
  return {
    grid: isDark ? '#333333' : '#f0f0f0',
    axis: isDark ? '#a3a3a3' : '#525252',
    portfolio: isDark ? '#e5e5e5' : '#171717',
    portfolioFill: isDark ? '#333333' : '#e5e5e5',
    invested: isDark ? '#737373' : '#a3a3a3',
    investedFill: isDark ? '#262626' : '#f5f5f5',
    fiTarget: '#ef4444',
    fiLine: '#22c55e',
    netWorth: isDark ? '#e5e5e5' : '#171717',
    netWorthFill: isDark ? '#262626' : '#171717',
    assets: isDark ? '#525252' : '#d4d4d4',
    assetsFill: isDark ? '#333333' : '#e5e5e5',
    liabilities: '#ef4444',
    liabilitiesFill: isDark ? '#451a1a' : '#fecaca',
    bar1: isDark ? '#e5e5e5' : '#171717',
    bar2: isDark ? '#525252' : '#d4d4d4',
    tooltip: isDark ? '#1a1a1a' : '#ffffff',
    tooltipBorder: isDark ? '#333333' : '#e5e5e5',
    // Scenario colors
    pessimistic: '#ef4444',
    base: isDark ? '#e5e5e5' : '#171717',
    optimistic: '#22c55e',
    // Pie chart colors
    pie: isDark ? ['#e5e5e5', '#737373', '#a3a3a3', '#525252'] : ['#171717', '#525252', '#a3a3a3', '#d4d4d4'],
  }
}
