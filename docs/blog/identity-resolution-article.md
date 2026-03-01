# How We Stopped Confusing Politicians: Building an Identity Resolution Engine for French Civic Data

_Building entity resolution for a small-scale civic tech project — practical lessons from the messy middle ground between academic ER and enterprise MDM._

---

## The Bug That Started It All

Thierry Cousin is the mayor of Saint-Pryvé-Saint-Mesmin, a small town in the Loiret department. He was convicted in a financial misconduct case, and Poligraph — our civic observatory of French politicians — correctly tracks this affair.

Thierry Cousin is also the mayor of Betoncourt-Saint-Pancras, a village in Haute-Saône. He has no judicial record.

For months, our system thought they were the same person.

The RNE (Répertoire National des Élus) sync had matched the second Thierry Cousin's mayoral mandate to the first one's profile, because it found exactly one "Thierry Cousin" in our database and returned it without checking the birthdate. The convicted politician's profile now showed a mandate for a town 400km away.

This isn't just a data quality bug — it's a credibility problem. When civic tech platforms attribute criminal convictions to the wrong person, the consequences go beyond technical debt. A wrongly attributed affair can damage someone's reputation. A missing affair can undermine accountability.

We needed to fix this properly, not with another band-aid.

## What We Tried First

Our initial architecture was simple: each sync service (deputies, senators, mayors, declarations, court records) had its own matching function. The pattern was always the same:

```
1. Normalize the name
2. Query the database for matching names
3. If one result: return it
4. If multiple: try birthdate, then department
5. If still ambiguous: pick the first one (or give up)
```

When the Thierry Cousin bug surfaced, we added a birthdate check for single candidates. Problem solved?

Not really. The fix addressed one symptom, but the underlying architecture remained fragile:

- **10 sync services, 10 matching implementations** — Each one slightly different, each one a potential source of homonym bugs.
- **No shared memory** — If we flagged "Thierry Cousin from Haute-Saône is NOT the same person as Thierry Cousin from Loiret," that decision lived in a developer's head, not in the system.
- **No audit trail** — When a match happened, it was invisible. No confidence score, no method attribution, no way to review or undo.
- **No negative decisions** — The system could say "these are the same person" but had no way to say "these are definitely NOT the same person." This meant every sync run could potentially re-create the same wrong match.

## What the State of the Art Says

Before designing our solution, we researched how others solve entity resolution (ER):

**Fellegi-Sunter (1969)** — The foundational probabilistic record linkage model. Compares fields independently, accumulates match/non-match weights, makes decisions based on composite scores. Our ad-hoc matching was an informal, unstructured version of this.

**OpenSanctions / nomenklatura** — The most relevant reference for our use case. OpenSanctions maintains 130K+ entity profiles across sanctions lists, PEP databases, and corporate registries. Their `nomenklatura` library uses a judgement graph: pairs of records are connected by SAME, NOT_SAME, or UNDECIDED edges. A connected components algorithm computes entity clusters. Key insight: they needed 34,600 manual decisions over 8 weeks to bootstrap the system. The negative decisions (NOT_SAME) are as important as the positive ones.

**EveryPolitician (mySociety)** — A project that tried to maintain comprehensive data on every politician worldwide. They used UUIDs + Popolo `identifiers[]` arrays + Wikidata as a linking hub. The project was archived after 4 years — the maintenance burden of multi-source reconciliation was unsustainable without proper tooling. A cautionary tale.

**W3C Reconciliation API v0.2** — A standard specification for entity matching services. Wikidata implements it. Enables interop with tools like OpenRefine for batch reconciliation.

**Splink / Dedupe** — Production ER libraries in Python. Powerful for large-scale probabilistic matching, but complete overkill for our 2,000 politicians. Different language stack, too.

**Key insight:** At our scale, deterministic matching (shared institutional IDs) covers 80%+ of cases. The critical missing piece wasn't a more sophisticated matching algorithm — it was **audit trail + negative decisions**.

## The Design: Three Building Blocks

### 1. The Resolver — One Pipeline to Rule Them All

Instead of 10 sync services each implementing their own matching, we built a single `IdentityResolver` with a 7-step pipeline:

```
Prior decisions → ExternalId match → Birthdate → Department → Name-only → Threshold → Log
```

Each step either produces a result or hands off to the next. The scoring is graduated:

| Signal                  | Confidence | Rationale                                     |
| ----------------------- | ---------- | --------------------------------------------- |
| Shared institutional ID | 1.0        | Deterministic — same PA code = same deputy    |
| Name + birthdate match  | 0.9        | Strong but not infallible (data entry errors) |
| Name + department match | 0.7        | Medium — multiple politicians per department  |
| Name only               | 0.5        | Unreliable — below auto-match threshold       |

Three decision zones:

- **>= 0.95**: Auto-match. The system is confident enough to proceed.
- **0.70 – 0.94**: Review queue. A human needs to confirm.
- **< 0.70**: Reject. Treat as a new, unmatched person.

### 2. The Decision Log — The System Remembers

Every matching decision is recorded in an `IdentityDecision` table:

```
sourceType: RNE
sourceId: "70069"
politicianId: "cmlrjqfpq..."
judgement: NOT_SAME
confidence: 1.0
method: MANUAL
decidedBy: "admin:ldiaby"
```

This serves three purposes:

1. **Blocking** — A NOT_SAME decision prevents the same wrong match from recurring. The next time the RNE sync encounters "Thierry Cousin" from Haute-Saône, it checks the decision log first and skips the incorrect politician.

2. **Fast path** — A high-confidence SAME decision allows the resolver to return immediately without re-computing the match. This is especially valuable for sources that sync daily.

3. **Auditability** — Every match can be traced back to its evidence. When something looks wrong, we can find exactly when, how, and why the match was made, and supersede it with a corrected decision.

### 3. The Confidence Score — Not All Matches Are Equal

Every ExternalId link now carries metadata:

```
source: RNE
externalId: "45321"
confidence: 0.9
matchedBy: BIRTHDATE
verifiedAt: null
verifiedBy: null
```

This tells us not just _that_ a link exists, but _how reliable_ it is and _how it was established_. An AN deputy matched by institutional ID (confidence 1.0) is qualitatively different from an RNE mayor matched by name + department (confidence 0.7).

## The poligraphId and the Reconciliation API

Each politician receives a stable public identifier: `PG-000001` through `PG-001781` (and growing). Unlike slugs (which can change with name corrections) or database IDs (which are internal), the poligraphId is designed for external use.

We also implemented the W3C Reconciliation Service API, allowing external tools to match their datasets against Poligraph:

```
GET /api/reconcile?queries={"q0":{"query":"Marine Le Pen"}}
```

This enables:

- **OpenRefine integration** — Data journalists can reconcile spreadsheets against our politician database
- **Wikidata interop** — Our Wikibot can use the reconciliation endpoint to discover new links
- **Partner integrations** — Other civic tech projects can verify politician identity against our data

## Lessons Learned

**1. False positives are worse than false negatives in civic data.**

Attributing a conviction to the wrong person has legal and reputational consequences. Not finding a match is merely incomplete data. We designed the system to be conservative: when in doubt, don't match.

**2. Deterministic matching covers 80%+ — invest there first.**

Most of our politicians come from institutional sources with proper IDs (AN, Senate, HATVP). The hard cases (RNE mayors, court records, press articles) are a minority. Building robust handling for the easy 80% before tackling the fuzzy 20% was the right sequence.

**3. Store negative decisions — they're as valuable as positive ones.**

The NOT_SAME decision is arguably the most important feature. Without it, every sync run could re-create the Thierry Cousin bug. With it, a single manual intervention permanently blocks wrong matches.

**4. Don't build EveryPolitician.**

mySociety's EveryPolitician was an ambitious attempt to maintain data on every politician worldwide. It failed because multi-source reconciliation at scale is a maintenance nightmare. We scoped ruthlessly: French politicians only, 10 curated sources, automated pipeline with human review for edge cases.

## What's Next

The Identity Resolution Engine is live for the RNE sync (35,000+ mayors). Next steps:

- **Migrate remaining 9 sync services** to the centralized resolver
- **Build an admin UI** for the review queue (UNDECIDED decisions)
- **LLM-assisted reconciliation** — Using Claude to analyze ambiguous cases with contextual clues from Wikipedia/press
- **Bidirectional Wikidata sync** — Publishing poligraphIds as Wikidata external identifiers, closing the interoperability loop

The goal is a system where every politician in Poligraph has a clear, auditable chain from source data to profile — and where mistakes like Thierry Cousin's are caught before they ever reach production.

---

_Poligraph is an open-source civic observatory tracking French politicians. The code is available on [GitHub](https://github.com/ldiaby/politic-tracker)._
