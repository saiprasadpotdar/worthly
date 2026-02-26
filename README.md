# Worthly

**Financial Independence Planner** — Track your assets, liabilities, income, and FI journey. Your data stays local.

## Why Worthly?

Most financial tracking tools require you to hand over sensitive data to third-party servers. Worthly takes a different approach: all your financial data is stored locally in your browser using IndexedDB. Nothing ever leaves your device.

## Features

- **Dashboard** — FI progress (Lean/Regular/Fat FI), net worth overview, asset allocation, financial ratios
- **Net Worth Tracker** — Manage retirement and emergency investments across equity, debt, and fixed income
- **Income Tracker** — Annual income history with YoY growth trends and tax tracking
- **Liabilities** — Track loans (home, personal, vehicle, education) and property details
- **Export/Import** — Back up your data as JSON or export to XLSX. Import from JSON backups.
- **Privacy First** — Zero server-side storage. Your data, your control.

## Tech Stack

- **Next.js 16** + TypeScript + Tailwind CSS v4
- **Dexie.js** (IndexedDB) for local-first data storage
- **Recharts** for data visualization
- **SheetJS** for XLSX export
- Custom UI components (inspired by shadcn/ui)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### First Steps

1. Go to **Settings** and set up your profile (name, monthly expenses, target ratios)
2. Add your investments in **Net Worth**
3. Add income history in **Income**
4. Add loans and properties in **Liabilities**
5. View your FI progress on the **Dashboard**

## Data Storage

All data is stored in IndexedDB in your browser. To keep backups:

- **Export as JSON** — Full backup, can be re-imported later
- **Export as XLSX** — Spreadsheet format for analysis in Excel/Google Sheets

## Deploy

```bash
npm run build
npm run start
```

Deploy to Vercel, Netlify, or any platform that supports Next.js.

## License

MIT
