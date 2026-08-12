# FarmCompass

**Design and Development of an AI-Assisted Personalised Agricultural Decision Support Web Application for Smallholder Farmers in Nigeria**

FarmCompass is a Next.js Progressive Web Application that turns an administrator-verified farm profile into ranked crop recommendations and grounded agricultural guidance. The included seed dataset contains 34 crop profiles extracted from the supplied `CROPS DATABASE.pdf` compilation based on NEEP / Federal Ministry of Agriculture and Food Security material.

## Implemented MVP features

- Farmer registration and secure email/password login.
- Administrator role and separate admin workspace.
- **Administrator-managed farm profiles**: State, LGA, farm size, soil type, pH if known, irrigation context, farming goal and planting month; optional rainfall/temperature context.
- Read-only verified farm profile for farmers.
- 34-crop MongoDB knowledge base with pH, climate, states, soil, planting, fertiliser, pest/disease, variety, irrigation, harvest/storage and source text.
- Transparent weighted crop suitability scoring that renormalises when optional farm parameters are unknown.
- Recommendation history stored with a farm-profile snapshot.
- Public crop library and detailed crop guidance pages.
- OpenAI Responses API integration for grounded text answers and optional crop-image input.
- AI guardrails: retrieved crop/farm context, uncertainty for visual interpretation, and no unsourced agrochemical prescriptions.
- PWA manifest and service worker with basic shell caching/offline page.
- Role-based admin APIs and audit logging.
- Seed script with local demo accounts.

## 1. Prerequisites

- Node.js 22+
- npm
- MongoDB locally or MongoDB Atlas
- OpenAI API key for the AI assistant

## 2. Start local MongoDB

```bash
docker compose up -d
```

Or point `MONGODB_URI` at MongoDB Atlas.

## 3. Configure environment

```bash
cp .env.example .env.local
```

Change `JWT_SECRET` before use. Add `OPENAI_API_KEY` to enable AI chat and image-assisted questions.

## 4. Install and seed

```bash
npm install
npm run seed
```

The development seed creates:

- Admin: `admin@farmcompass.ng` / `Admin123!`
- Farmer: `farmer@farmcompass.ng` / `Farmer123!`

**These are local demo credentials only. Change them before any deployment.**

## 5. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## 6. Test the recommendation engine

```bash
npm run validate:recommendations
npm run typecheck
```

## Main workflow

1. Farmer creates an account.
2. Administrator opens `/admin` and records/verifies the technical farm profile.
3. Farmer opens `/dashboard` and selects **Get recommendation**.
4. FarmCompass scores all active crop records and saves the top ranked crops.
5. Farmer opens a crop guide or asks the FarmCompass assistant a follow-up question.
6. Optional crop images are sent server-side with retrieved crop/farm context; the API key is never exposed to the browser.

## Project structure

- `app/` — Next.js App Router pages and route handlers
- `components/` — farmer/admin/auth/PWA UI components
- `lib/` — MongoDB, auth, crop retrieval and recommendation scoring
- `data/crops.seed.json` — structured 34-crop seed dataset derived from the supplied crop PDF
- `scripts/seed.ts` — MongoDB indexes, crop data and demo accounts
- `scripts/validate-recommendations.ts` — deterministic recommendation checks

## Production checklist

Before public deployment: replace demo credentials; use a strong `JWT_SECRET`; configure MongoDB Atlas network/database access; add rate limiting backed by a shared store; add CSRF protections if introducing state-changing browser forms outside same-site JSON APIs; establish image retention/deletion rules; perform agricultural-expert review; verify current NAFDAC registration/product labels for crop-protection guidance; run real farmer usability evaluation; and add deployment monitoring/error reporting.
