# AI Complaint Register Dashboard

An AI-powered analytics dashboard for a telecom operator's customer complaint register. It ingests a large CSV of raw complaint records into Postgres, runs two LLM-powered "engines" over the data (per-complaint triage and cross-complaint pattern detection), and presents everything in a dark-themed dashboard with live stats, a searchable/paginated complaint table, AI-generated insight cards, and charts.

---

## What this project actually does

1. **Import** — A ~3M-row CSV of telecom complaints (`datadump.csv`) is parsed and bulk-loaded into a `Complaint` table in Postgres (via a CLI script or a web upload form).
2. **Engine 1 — per-complaint AI triage** (`src/lib/engine1.ts`)
   For a single complaint, calls an LLM (Groq, `llama-3.1-8b-instant`) with the complaint's remarks, category, location, and dates, and asks it to return:
   - `severity`: `LOW | MEDIUM | HIGH | CRITICAL`
   - `sentiment`: `NEUTRAL | FRUSTRATED | ANGRY | SATISFIED`
   - `summary`: one-sentence summary
   - `rootCause`: one-sentence likely root cause
   - `escalationRisk`: 0–1 risk score

   The result is written back onto the `Complaint` row (`aiSeverity`, `aiSentiment`, `aiSummary`, `aiRootCause`, `aiEscalationRisk`, `aiProcessed`, `aiProcessedAt`).

3. **Engine 2 — cross-complaint pattern detection** (`src/lib/engine2.ts`)
   Runs a set of aggregate Prisma queries over the whole `Complaint` table (volume spikes by circle/sub-category vs. the previous week, officers with zero closures in 5 days, week-over-week sentiment drift, complaints past `dueDate` still open) and asks the LLM to turn those numbers into a list of human-readable **insights**, each with a `type` (`SPIKE | ANOMALY | OFFICER | SENTIMENT_DRIFT | SLA_RISK`), a `severity`, a `title`/`description`, and optional affected zone/category/officer. These are saved to a `PatternInsight` table.

4. **Dashboard** (`src/app/page.tsx`) — a single-page dark UI showing:
   - Live stat cards (total / open / closed / AI-processed complaints)
   - A searchable, paginated table of complaints with per-row "Analyze" buttons (runs Engine 1 on that one complaint)
   - "Run Batch Analysis" (runs Engine 1 over the next 50 unprocessed complaints) and "Run Pattern Detection" (runs Engine 2) buttons
   - A live insight feed (Pattern Insights panel)
   - A bar chart of complaints by circle and a pie chart of sentiment distribution
   - Toast notifications for success/failure of every async action

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4, framer-motion, lucide-react, recharts |
| Database | PostgreSQL (local, via Homebrew) |
| ORM | Prisma 7 with `@prisma/adapter-pg` (node-postgres driver adapter) |
| AI | Groq API (`llama-3.1-8b-instant`) via the OpenAI SDK |
| CSV parsing | PapaParse |

> **Note for contributors / AI agents:** This repo pins **Next.js 16**, which has breaking changes vs. older Next docs you may know from training data. See `AGENTS.md` — read `node_modules/next/dist/docs/` before changing routing/layout conventions.

---

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 17 running locally (e.g. `brew install postgresql@17 && brew services start postgresql@17`)
- A free [Groq API key](https://console.groq.com) (used for both AI engines)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

```bash
createdb aicomplaintregisterdashboard
```

### 3. Configure environment variables

Create/edit `.env` in the project root:

```bash
DATABASE_URL=postgresql://<your-mac-username>@localhost:5432/aicomplaintregisterdashboard
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- `DATABASE_URL` — standard Postgres connection string. No cloud account needed; this points at your local Postgres instance.
- `GROQ_API_KEY` — required for both Engine 1 and Engine 2 (Groq's free tier is generous but rate-limited — see [Rate limits](#groq-rate-limits) below).

### 4. Sync the database schema

```bash
npx prisma db push
```

This creates the `Complaint` and `PatternInsight` tables (and all indexes) defined in `prisma/schema.prisma`.

---

## Importing complaint data

The dashboard is useless without data in the `Complaint` table. There are two ways to load a CSV:

### Option A — CLI script (recommended for large files)

```bash
npm run import:csv -- /path/to/datadump.csv
```

This streams the file, parses it with PapaParse, maps each row via `src/lib/csvImport.ts`, and bulk-inserts in batches of 500 with `skipDuplicates: true` (deduping on the unique `complaintId`). For a ~3M-row file this takes roughly 15–20 minutes against local Postgres.

For very large imports you'll likely want to run it detached so it survives the session:

```bash
nohup npx tsx scripts/import.ts datadump.csv > /tmp/import.log 2>&1 &
disown
```

### Option B — Web upload

Visit **`/import`** in the browser, choose a CSV file, and submit. This posts to `POST /api/import`, which parses and bulk-inserts the same way. Better for smaller/incremental files (entire file is read into memory).

### Expected CSV shape

Each row must have **34 columns** (see `EXPECTED_COLUMNS` in `src/lib/csvImport.ts`). Key columns (0-indexed):

| Index | Field | Index | Field |
|---|---|---|---|
| 0 | phoneNumber | 12 | circle |
| 1 | status | 13 | lsa |
| 2 | userRemark | 14 | channel |
| 3 | complaintId (unique) | 15 | complaintType |
| 4 | resolutionStatus | 16 | technology |
| 5 | createdAt (date) | 17 | planType |
| 6 | dueDate (date) | 18 | service |
| 7 | closedAt (date) | 19 | subCategory |
| 8 | state | 20 | officerId |
| 9 | district | 21 | officerName |
| 10 | city | 28 | nodalRemark |
| 11 | direction | 29 | extraInfo |

Rows with the wrong column count, or missing `phoneNumber` / `status` / `complaintId` / a valid `createdAt`, are skipped (counted separately from imports).

---

## Running the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the dashboard, or [http://localhost:3000/import](http://localhost:3000/import) to upload more data.

Other scripts:

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```

---

## Dashboard guide

### Top bar
- **Refresh** — re-fetches stats, the current page of complaints, and insights.
- **Run Batch Analysis** — calls `POST /api/engine1/batch`, which runs Engine 1 on up to 50 complaints where `aiProcessed = false`. Shows a toast with `processed` / `failed` / `total` counts when done.
- **Run Pattern Detection** — calls `POST /api/engine2`, which regenerates `PatternInsight` rows and refreshes the insights panel. Shows a toast with how many insights were generated.

### Stat cards
Total Complaints, Open (`closedAt IS NULL`), Closed (`closedAt IS NOT NULL`), AI Processed (`aiProcessed = true`) — from `GET /api/stats`.

### Complaint table (left, ~60% width)
- Search box filters by **state, circle, or sub-category** (case-insensitive `OR` match), debounced 300ms.
- 20 rows per page with Prev/Next pagination.
- Each row shows a color-coded severity badge (CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=green) and an **Analyze** button that runs Engine 1 on just that complaint (`POST /api/engine1`).

### Pattern Insights panel (right, ~40% width)
Latest 10 `PatternInsight` rows as cards, each with a type badge (SPIKE/ANOMALY/OFFICER/SENTIMENT_DRIFT/SLA_RISK) and severity badge.

### Charts (bottom)
- Bar chart: complaint count per `circle`.
- Pie chart: distribution of `aiSentiment` across AI-processed complaints.

### Loading & error states
Every section has a skeleton placeholder while its data is loading, and every async action (analyze, batch run, pattern detection, refresh) reports success or failure via a toast in the bottom-right corner.

---

## API reference

All routes live under `src/app/api/` and return JSON. Every route is wrapped in try/catch and returns `{ error: "<message>" }` (or `{ success: false, error }` for action endpoints) with a `500` status on failure.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/stats` | `{ total, open, closed, aiProcessed, bySeverity, bySentiment, byCircle }` |
| `GET` | `/api/complaints?page=&limit=&search=` | Paginated complaints. `limit` capped at 100 (default 20). `search` matches `state`/`circle`/`subCategory`. Returns `{ complaints, total, pages }` |
| `POST` | `/api/engine1` | Body `{ complaintId }`. Runs Engine 1 on one complaint, persists the result, returns the `AnalysisResult` |
| `POST` | `/api/engine1/batch` | Runs Engine 1 on up to 50 unprocessed complaints (200ms delay between calls). Returns `{ processed, failed, total }` |
| `POST` | `/api/engine2` | Runs Engine 2 pattern detection, persists `PatternInsight` rows, returns `{ success, insights }` |
| `GET` | `/api/insights` | Latest 10 `PatternInsight` rows, newest first |
| `POST` | `/api/import` | Multipart form upload (`file` field), bulk-imports a CSV the same way as `scripts/import.ts` |

---

## Database schema (`prisma/schema.prisma`)

### `Complaint`
Raw fields imported from the CSV (identifiers, timestamps, geography, complaint details, officer info) plus AI-generated fields written by Engine 1: `aiSeverity`, `aiSentiment`, `aiSummary`, `aiRootCause`, `aiEscalationRisk`, `aiProcessed`, `aiProcessedAt`. Indexed on `status`, `circle`, `state`, `subCategory`, `officerId`, `createdAt`, `aiSeverity`.

### `PatternInsight`
AI-generated cross-complaint insights from Engine 2: `type`, `severity`, `title`, `description`, optional `affectedZone`/`affectedCategory`/`affectedOfficer`, `dataWindow`, and a raw `metaJson` blob of the numbers behind the insight. Indexed on `type`, `generatedAt`, `severity`.

---

## Groq rate limits

Both engines call Groq's free tier, which is capped at **14,400 requests/day** and **6,000 tokens/minute**. In practice this means:

- A single "Analyze" click or "Run Pattern Detection" is fine.
- "Run Batch Analysis" (50 calls) can hit `429 rate_limit_exceeded` on some items — these are counted in the `failed` total and reported in the toast, the batch doesn't stop.
- Processing the **entire** ~3M-row dataset with Engine 1 is not feasible on the free tier (~14,400/day ≈ 208 days for 3M rows). If you need to bulk-process a sample, see `scripts/engine1batch.ts` (configurable sample size, retries with exponential backoff on 429).

If you see a `429` error in a toast, the message includes Groq's own "try again in Xs" hint — just wait and retry.

---

## Project structure

```
src/
  app/
    page.tsx                 # main dashboard
    layout.tsx                # root layout (required by Next App Router)
    globals.css                # Tailwind v4 entrypoint
    import/page.tsx            # CSV upload page
    api/
      stats/route.ts           # GET dashboard stats
      complaints/route.ts       # GET paginated/searchable complaints
      insights/route.ts         # GET latest pattern insights
      engine1/route.ts           # POST analyze one complaint
      engine1/batch/route.ts     # POST analyze a batch of complaints
      engine2/route.ts           # POST run pattern detection
      import/route.ts            # POST CSV upload
  lib/
    prisma.ts                  # Prisma client (adapter-pg, local Postgres)
    groq.ts                    # Groq client (OpenAI SDK, custom baseURL)
    engine1.ts                  # per-complaint AI triage
    engine2.ts                  # cross-complaint pattern detection
    csvImport.ts                # CSV row -> Prisma input mapping
scripts/
  import.ts                    # CLI bulk CSV importer
  engine1batch.ts                # CLI sample-based Engine 1 batch runner
prisma/
  schema.prisma                 # Complaint + PatternInsight models
```
