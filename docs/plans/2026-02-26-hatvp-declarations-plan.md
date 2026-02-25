# HATVP Declarations Enrichment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Parse HATVP XML declarations to display rich financial data (participations, revenues, mandates, directorships) on politician profiles with editorial transparency UX.

**Architecture:** Add a `details` JSON field to the existing `Declaration` Prisma model. During HATVP sync, fetch DIA XML files (using the `open_data` CSV column), parse with `fast-xml-parser`, store structured data. Frontend displays a new `DeclarationCard` component in the main content area with summary metrics, financial participation bars, and collapsible detail sections. API enriched with `details`. SEO metadata updated.

**Tech Stack:** Next.js 16, Prisma 7, fast-xml-parser 5, Tailwind, shadcn/ui, Vitest

---

### Task 1: Schema Migration — Add `details` field

**Files:**
- Modify: `prisma/schema.prisma` (Declaration model, ~line 578)

**Step 1: Add the field**

In `prisma/schema.prisma`, add `details Json?` to the `Declaration` model after `pdfUrl`:

```prisma
  pdfUrl   String? // Direct PDF link
  details  Json?   // Structured data parsed from HATVP XML (DIA)
```

**Step 2: Generate migration and Prisma client**

```bash
npx prisma migrate dev --name add-declaration-details
npm run db:generate
```

Expected: Migration file created, client regenerated.

**Step 3: Commit**

```bash
git add prisma/
git commit -m "chore(db): add details JSON field to Declaration model (#145)"
```

---

### Task 2: TypeScript types for declaration details

**Files:**
- Create: `src/types/hatvp.ts`

**Step 1: Create the types file**

```typescript
/**
 * Structured data extracted from HATVP DIA XML declarations.
 * Stored as JSON in Declaration.details.
 */

export interface FinancialParticipation {
  company: string;
  evaluation: number | null;
  shares: number | null;
  capitalPercent: number | null;
  dividends: string | null;
  isBoardMember: boolean;
}

export interface AnnualRevenue {
  year: number;
  amount: number;
}

export interface ProfessionalActivity {
  description: string;
  employer: string;
  startDate: string | null;
  endDate: string | null;
  annualRevenues: AnnualRevenue[];
}

export interface ElectoralMandate {
  mandate: string;
  startDate: string | null;
  endDate: string | null;
  annualRevenues: AnnualRevenue[];
}

export interface Directorship {
  company: string;
  role: string;
  startDate: string | null;
  endDate: string | null;
  annualRevenues: AnnualRevenue[];
}

export interface Collaborator {
  name: string;
  employer: string;
}

export interface DeclarationDetails {
  financialParticipations: FinancialParticipation[];
  professionalActivities: ProfessionalActivity[];
  electoralMandates: ElectoralMandate[];
  directorships: Directorship[];
  spouseActivity: string | null;
  collaborators: Collaborator[];
  // Computed summaries
  totalPortfolioValue: number | null;
  totalCompanies: number;
  latestAnnualIncome: number | null;
  totalDirectorships: number;
}
```

**Step 2: Format and commit**

```bash
npx prettier --write src/types/hatvp.ts
git add src/types/hatvp.ts
git commit -m "feat(types): add DeclarationDetails types for HATVP XML data (#145)"
```

---

### Task 3: XML parser — Write tests first

**Files:**
- Create: `src/services/sync/hatvp-xml.test.ts`
- Create: `src/services/sync/hatvp-xml.ts`

**Step 1: Write the test file**

Create `src/services/sync/hatvp-xml.test.ts` with tests covering:
- Parsing financial participations (company, evaluation, shares)
- Parsing professional activities with annual revenues
- Parsing electoral mandates with compensation
- Parsing directorships
- Parsing spouse activity and collaborators
- Computing summary totals (portfolio value, income, counts)
- Handling `[Données non publiées]` fields (should be null/ignored)
- Handling `neant: true` sections (empty arrays)
- Parsing amounts with French formatting (`"62 389"` → `62389`)

Use a minimal XML fixture string (based on the real XML structure discovered during research).

Key XML structure to test against:
```xml
<declaration>
  <participationFinanciereDto>
    <neant>false</neant>
    <items><items>
      <nomSociete>AXA</nomSociete>
      <evaluation>13520</evaluation>
      <nombreParts>400</nombreParts>
      <capitalDetenu>0</capitalDetenu>
      <remuneration>572 dividendes 2021</remuneration>
      <actiConseil>Non</actiConseil>
    </items></items>
  </participationFinanciereDto>
  <activProfCinqDerniereDto>
    <neant>false</neant>
    <items><items>
      <description>PHARMACIEN</description>
      <employeur>PHARMACIE JENNER</employeur>
      <remuneration>
        <brutNet>Net</brutNet>
        <montant><montant><annee>2023</annee><montant>80000</montant></montant></montant>
      </remuneration>
      <dateDebut>06/2017</dateDebut>
      <dateFin>06/2022</dateFin>
    </items></items>
  </activProfCinqDerniereDto>
  <!-- Similar structure for mandatElectifDto, participationDirigeantDto, etc. -->
</declaration>
```

**Important XML quirk:** The items are double-nested: `<items><items>...</items></items>`. Handle both single item and array cases (XML parser may return object for single item, array for multiple).

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/services/sync/hatvp-xml.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement the parser**

Create `src/services/sync/hatvp-xml.ts`:

- `parseHATVPXml(xmlString: string): DeclarationDetails` — main entry point
- `parseAmount(raw: string): number | null` — parse French-formatted amounts (`"62 389"` → `62389`)
- `parseAnnualRevenues(remunerationNode: any): AnnualRevenue[]` — extract year/amount pairs
- `parseItems(node: any): any[]` — handle the double-nested `<items><items>` + single vs array
- `isRedacted(value: string): boolean` — detect `[Données non publiées]`

Use `fast-xml-parser` (`XMLParser` from v5):

```typescript
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
});
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/sync/hatvp-xml.test.ts
```

Expected: ALL PASS.

**Step 5: Format and commit**

```bash
npx prettier --write src/services/sync/hatvp-xml.ts src/services/sync/hatvp-xml.test.ts
git add src/services/sync/hatvp-xml.ts src/services/sync/hatvp-xml.test.ts
git commit -m "feat(sync): add HATVP XML parser with tests (#145)"
```

---

### Task 4: Integrate XML parsing into HATVP sync

**Files:**
- Modify: `src/services/sync/hatvp.ts`

**Step 1: Add XML fetch and parse logic**

In `src/services/sync/hatvp.ts`:

1. Import the parser: `import { parseHATVPXml } from "./hatvp-xml";`
2. Add a function `fetchAndParseXml(openDataFilename: string)` that:
   - Builds URL: `https://www.hatvp.fr/livraison/dossiers/${openDataFilename}`
   - Fetches via `client.getText()`
   - Parses with `parseHATVPXml()`
   - Returns `DeclarationDetails | null` (null on error/404)
3. In `syncDeclaration()`, check if `decl.open_data` is non-empty AND the type is DIA/DIM/DIAM:
   - If yes, call `fetchAndParseXml(decl.open_data)`
   - Include `details` in the upsert data
4. Update `HATVPSyncResult` to track `xmlParsed: number` and `xmlErrors: number`

**Key logic for checking DIA types:**

```typescript
const DIA_TYPES = new Set(["di", "dim", "dia", "diam"]);

// In syncDeclaration:
let details = null;
if (decl.open_data && DIA_TYPES.has(decl.type_document)) {
  details = await fetchAndParseXml(decl.open_data);
}
```

**Step 2: Run build to verify**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/services/sync/hatvp.ts
git commit -m "feat(sync): integrate XML parsing into HATVP sync (#145)"
```

---

### Task 5: Frontend — DeclarationMetrics component

**Files:**
- Create: `src/components/declarations/DeclarationMetrics.tsx`

**Step 1: Build the metrics bar**

A grid of 4 metric cards (2×2 mobile, 4 cols desktop):
- Total portfolio value (€) — formatted with `Intl.NumberFormat`
- Number of companies
- Latest annual income (€)
- Total directorships + mandates

```typescript
interface DeclarationMetricsProps {
  totalPortfolioValue: number | null;
  totalCompanies: number;
  latestAnnualIncome: number | null;
  totalDirectorships: number;
}
```

Design:
- `bg-muted/50 rounded-lg p-3`
- Large number: `text-2xl font-bold font-mono`
- Label: `text-xs text-muted-foreground`
- Values formatted: `350 k€` for thousands, `1.2 M€` for millions

**Step 2: Format and commit**

```bash
npx prettier --write src/components/declarations/DeclarationMetrics.tsx
git add src/components/declarations/DeclarationMetrics.tsx
git commit -m "feat(ui): add DeclarationMetrics component (#145)"
```

---

### Task 6: Frontend — DeclarationCard component

**Files:**
- Create: `src/components/declarations/DeclarationCard.tsx`

**Step 1: Build the main card**

Structure following the design doc:

```
Card
├── CardHeader: "Déclarations d'intérêts et d'activités"
│   └── Source badge: lien HATVP + date dernière déclaration
├── CardContent:
│   ├── DeclarationMetrics (4 chiffres clés)
│   ├── Participations financières (HorizontalBars, top 5 visible)
│   │   └── <details> for remaining
│   ├── <details> Revenus et activités professionnelles
│   │   └── Compact table: activity × year × amount
│   ├── <details> Mandats électifs et indemnités
│   │   └── List with annual compensation
│   ├── <details> Postes de direction
│   │   └── Company + role + dates
│   ├── <details> Conjoint & collaborateurs
│   │   └── Minimal info
│   └── Toutes les déclarations (Badge links to HATVP/PDF)
```

Props:
```typescript
interface DeclarationCardProps {
  declarations: Array<{
    id: string;
    type: string;
    year: number;
    hatvpUrl: string;
    pdfUrl: string | null;
    details: DeclarationDetails | null;
  }>;
  politicianHatvpUrl: string | null;
}
```

Key patterns:
- Use existing `HorizontalBars` for financial participations
- Use native `<details>` for collapsible sections (matches affairs pattern)
- Source link "Haute Autorité pour la Transparence de la Vie Publique ↗" at top
- Each section footer: "Source: HATVP"
- Badge links at bottom for each declaration (type + year → hatvpUrl)
- Amounts in `font-mono` for readability
- `[Données non publiées]` never displayed

**Step 2: Format and commit**

```bash
npx prettier --write src/components/declarations/DeclarationCard.tsx
git add src/components/declarations/DeclarationCard.tsx
git commit -m "feat(ui): add DeclarationCard component with transparency UX (#145)"
```

---

### Task 7: Integrate into politician page + update query

**Files:**
- Modify: `src/app/politiques/[slug]/page.tsx`

**Step 1: Update the Prisma query**

In `getPolitician()`, add `details` to the declarations select:

```typescript
declarations: {
  orderBy: { year: "desc" },
  select: {
    id: true,
    type: true,
    year: true,
    hatvpUrl: true,
    pdfUrl: true,
    details: true, // NEW
  },
},
```

**Step 2: Move HATVP from sidebar to main content**

Remove the old HATVP card from the sidebar (lines ~1171-1194).

Add `DeclarationCard` in the main content area, after mandates/career and before votes:

```tsx
import { DeclarationCard } from "@/components/declarations/DeclarationCard";

{/* After career/mandates section, before votes */}
{politician.declarations.length > 0 && (
  <DeclarationCard
    declarations={politician.declarations}
    politicianHatvpUrl={politician.externalIds.find(
      (e) => e.source === "HATVP"
    )?.url ?? null}
  />
)}
```

**Step 3: Update sidebar stats**

Keep the count in sidebar stats but remove the card:
```tsx
<span className="text-muted-foreground">Déclarations HATVP</span>
<span className="font-semibold">{politician.declarations.length}</span>
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/app/politiques/[slug]/page.tsx
git commit -m "feat(page): move HATVP to main content with rich display (#145)"
```

---

### Task 8: API — Include details in response

**Files:**
- Modify: `src/app/api/politiques/[slug]/route.ts`

**Step 1: Update the API response**

Add `hatvpUrl` and `details` to the declarations mapping:

```typescript
declarations: politician.declarations.map((d) => ({
  id: d.id,
  type: d.type,
  year: d.year,
  url: d.pdfUrl,
  hatvpUrl: d.hatvpUrl,
  details: d.details,
})),
```

Also ensure the Prisma query in the API route includes `details` in its select.

**Step 2: Verify MCP compatibility**

No fields removed — only additions. Backward compatible.

**Step 3: Commit**

```bash
git add src/app/api/politiques/[slug]/route.ts
git commit -m "feat(api): include HATVP declaration details in response (#145)"
```

---

### Task 9: SEO — Enriched metadata

**Files:**
- Modify: `src/app/politiques/[slug]/page.tsx` (generateMetadata function, ~line 164)

**Step 1: Enrich meta description**

In `generateMetadata()`, check if politician has DIA declarations with details:

```typescript
// Find the latest DIA with details
const latestDIA = politician.declarations.find(
  (d) => d.type === "INTERETS" && d.details
);
const details = latestDIA?.details as DeclarationDetails | null;

let hatvpDescription = "";
if (details) {
  const parts: string[] = [];
  if (details.totalPortfolioValue) {
    parts.push(`${formatCurrency(details.totalPortfolioValue)} de participations financières`);
  }
  if (details.totalCompanies > 0) {
    parts.push(`${details.totalCompanies} sociétés déclarées`);
  }
  if (parts.length > 0) {
    hatvpDescription = ` ${parts.join(", ")}.`;
  }
}

const description = `${role} ${partyLabel} - Consultez ses mandats, déclarations d'intérêts et affaires judiciaires.${hatvpDescription}`;
```

**Step 2: Add JSON-LD structured data**

Add a `<script type="application/ld+json">` in the page component with `Person` schema:

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Agnès Firmin Le Bodo",
  "jobTitle": "Députée",
  "memberOf": [
    { "@type": "Organization", "name": "AXA" },
    { "@type": "Organization", "name": "BNP Paribas" }
  ]
}
```

**Step 3: Commit**

```bash
git add src/app/politiques/[slug]/page.tsx
git commit -m "feat(seo): enrich metadata with HATVP declaration data (#145)"
```

---

### Task 10: Build verification and final tests

**Step 1: Run all tests**

```bash
npx vitest run
```

Expected: ALL PASS (including new hatvp-xml tests).

**Step 2: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Manual verification checklist**

- [ ] Politician page loads with declaration data
- [ ] Metrics bar shows 4 key numbers
- [ ] Financial participations display as horizontal bars
- [ ] Collapsible sections work (revenues, mandates, directorships)
- [ ] Source links to HATVP are visible
- [ ] Badge links at bottom open correct HATVP/PDF pages
- [ ] API response includes `details` field
- [ ] Meta description includes HATVP data when available
- [ ] `npm run sync:hatvp` parses XML declarations

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(hatvp): complete declaration enrichment with XML parsing and UX (#145)"
```
