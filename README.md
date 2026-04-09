# Worthly

**Financial Independence Planner** — Track your assets, liabilities, income, SIPs, and goals; project when you'll reach FI; and simulate "what if" scenarios. Your data never leaves your browser.

## Why Worthly?

Most personal-finance tools ask you to hand over sensitive account data to someone else's servers. Worthly takes the opposite approach: every rupee of data you enter is stored locally in IndexedDB, on your device, in your browser. There is no backend, no analytics, no account, and nothing to sign up for. You can export a full backup any time and carry it with you.

## Features

### Tracking
- **Dashboard** — FI progress (Lean / Regular / Fat FI), net worth overview, asset allocation, key financial ratios
- **Net Worth** — Manage investments across equity, debt, fixed income, and real estate; per-asset P&L
- **SIPs** — Active/paused SIP register with monthly contribution totals by goal and asset class
- **Goals** — Tag investments to goals (retirement, house, education, etc.), track progress against a target corpus and target year, and see the **required annual return (CAGR)** needed to hit each goal given current holdings plus ongoing SIPs
- **Income** — Annual income history with YoY growth trends and tax tracking
- **Liabilities** — Loans (home, personal, vehicle, education) and property details including outstanding principal vs market value
- **Timeline** — Chronological view of your financial journey

### Projections & Simulation
- **FI Projections** — Year-by-year portfolio projection with SIP step-ups, expense inflation, and a configurable FI multiplier. Shows FI year, age, and corpus needed
- **Scenario Comparison** — Side-by-side Pessimistic / Base / Optimistic return scenarios on a single chart
- **Coast FI & Barista FI** — Inflation-adjusted Coast FI target (using real return rate) and Barista FI target assuming part-time income covers part of your expenses
- **What-If Simulator** — Drag sliders to tweak current assets, SIP, returns, inflation, expenses, FI multiplier, and projection horizon. See live delta in years-to-FI, final portfolio, and FI corpus against your base case. Includes:
  - Scenario templates (+₹5K SIP, prepay lump sum, market downturn, etc.)
  - "What changed" summary chips
  - Inflation-adjusted "today's rupees" final portfolio
  - Base-value markers on every slider
- **Goal-Seek** — Pick a target FI year and back-solve for the required monthly SIP or required annual return, holding everything else constant. One click applies the solved value back to the sliders.

### Privacy & Data
- **Local-first** — All data lives in IndexedDB via Dexie. No server, no account, no telemetry.
- **Passkey lock screen** — Optional SHA-256 hashed passkey to gate access to the app
- **Amount masking** — One-click toggle to hide sensitive numbers when sharing your screen
- **Export / Import** — Full JSON backup/restore, or export to XLSX for analysis in Excel/Google Sheets
- **Dark mode** — First-class light and dark themes

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** with custom UI components (shadcn/ui style)
- **Dexie.js** (IndexedDB) for local-first data storage
- **Recharts** for data visualization
- **React Hook Form** + **Zod** for form validation
- **SheetJS** for XLSX export
- **Lucide** icons

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### First Steps

1. Go to **Settings** and set up your profile (name, birth year, monthly expenses, target ratios, optional passkey)
2. Create **Goals** you want to track (retirement, emergency fund, house, etc.)
3. Add your holdings in **Net Worth**, tagging each to a goal
4. Register your active **SIPs** so projections reflect ongoing contributions
5. Add your **Income** history and **Liabilities** (loans, properties)
6. Open the **Dashboard** to see your FI progress, and **Projections** to see when you'll reach FI
7. Use the **What-If Simulator** to explore trade-offs and back-solve for your target retirement year

## Data Storage

All data is stored in IndexedDB in your browser. It is not backed up automatically — if you clear browser data or switch devices, it's gone. To keep copies:

- **Export as JSON** — Full lossless backup. Can be re-imported later.
- **Export as XLSX** — Human-readable spreadsheet format for analysis in Excel / Google Sheets.

For the privacy-conscious, Worthly also supports an optional SHA-256 hashed passkey that locks the app behind a lock screen on each visit.

## Deploy

```bash
npm run build
npm run start
```

Deploy to Vercel, Netlify, Cloudflare Pages, or any platform that supports Next.js. Because there is no backend, a fully static export works too.

## Contributing

Found a bug or have an idea? Issues and PRs welcome on the [GitHub repo](https://github.com/saiprasadpotdar/worthly).

## License

MIT
