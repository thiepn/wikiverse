# THIEPN WikiVerse

A source-backed, local-first Wikipedia/Wikidata exploration and learning platform. **Independent of the Wikimedia Foundation.** Development remains on draft PR #1; this project is not deployed.

## Experiences

| Mode | Gameplay and learning |
| --- | --- |
| WikiRace | Follow real article links across a validated two-hop route; record guest-only unranked results |
| WikiMystery | Reveal actual Wikidata claim-based clues and solve canonical entity-name puzzles |
| Discover | Search and read sanitized Wikipedia article revisions; save topics |
| Knowledge Galaxy | Expand source-identified Wikidata statements; filter relationships and traverse QIDs |
| GeoWiki | Explore Earth coordinates from Wikidata P625 and solve location-identification challenges |
| WikiChronicle | Inspect Wikidata dated statements and reorder evidenced historical records |
| WikiPolyglot | Read independently written Wikipedia articles side by side via Wikidata sitelinks; save user-authored vocabulary meanings and practice exact-text cloze |
| Source Detective | Trace displayed article references, grade citation-to-passage matching, and keep private, explicitly ungraded evidence assessments |
| **WikiPulse** | Retrieve genuine Wikimedia Analytics daily **pageview** counts; compare articles, inspect plotted observations and a data table, solve date-specific numeric challenges |
| **Time Capsule** | Select two real MediaWiki revision IDs, compare pinned rendered article paragraphs, inspect added/removed text and solve revision-difference puzzles |
| My Universe | Keep guest-only bookmarks, activity, vocabulary and results locally |

## Start locally

```sh
npm install --no-audit --no-fund
npm run dev
npm test
npm run check:syntax
npm run build
```

Node 22 is the version used in CI. No API keys, backend credentials or production writes are required for guest testing. GitHub Actions validates the **literal draft-PR head**, runs Node source tests, TypeScript/Vite and mocked upstream Chromium on desktop (1440×900) and touch-mobile (412×915).

## Wikipedia / Wikimedia API use

- Wikipedia Action API: bounded search, parsed page content, article links, **revision metadata**, rendered historical revision HTML. Article identity is `{ language, pageId, revisionId }`. Never substitute a Wikidata QID for an article page ID.
- Wikidata Action API: canonical entity QIDs, sitelinks, and property statements for Galaxy, Mystery, GeoWiki and Chronicle.
- Wikimedia Analytics: `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{language}.wikipedia.org/all-access/user/{article}/daily/{start}/{end}`, requesting observed daily non-automated user pageviews only. Current day and the immediately preceding UTC day are excluded from requested windows to allow aggregation; absent days are not filled with invented zeros. A browser-side, bounded cache and rate pacing reduce upstream requests. The application never calls the data “search trends.”
- Historical text comparison uses two pinned `oldid` revisions of the same page ID. It reports paragraphs absent/present after whitespace normalization, *not* semantic fact changes, and limits the number of displayed excerpts. Missing or indistinguishable paragraphs do not generate scored puzzles.
- Both new modes save challenge outcomes to the **existing** local progress object. No alternative master store or duplicate account layer is created.

## Source rights and accuracy

Wikipedia article material is attributed with old-revision URLs, contributor/history links and CC BY-SA 4.0 reference; revisions retain original page IDs and revision IDs. Wikidata sources and CC0 provenance are linked. No Commons images or unapproved assets are bundled. Wikipedia and Wikidata are not certified authorities: sourced data can still be inaccurate, out of date or ambiguous. Individual WikiPulse metric values are supplied by Wikimedia Analytics, not generated. Source Detective's subjective evidence assessments receive **no automated truth grade**.

## Qualification and limitations

The qualified feature implementation at commit `8522400850efca0c8be760f5a8d597ee0b9cbd51` passed **55/55** source tests, TypeScript/Vite, and mock-backed end-to-end Chromium desktop and mobile, including all ten knowledge/game modes and My Universe. CI summary: https://github.com/thiepn/wikiverse/actions/runs/38912856043. This README update should be qualified again at its own exact head.

**NOT TESTED:** a live end-to-end Wikimedia Analytics request from an actual client browser; live revision retrieval on representative Wikipedia articles; independent external-reference evidence verification; production load/rate-limit characterization; multi-account security. API response fixtures exercise integration but cannot establish upstream availability, CORS behavior or factual source accuracy.

**Scope boundaries:** no deployment, no merge, no production/data migrations, no authenticated account synchronization, no competitive anti-cheat authority, no global signed daily manifest, and no paid services. Guests use browser localStorage, which is private to that browser context and can be deleted.

Next product-wide gaps: real upstream compatibility qualification, richer date-scoped archive traversal, trends and revision UX improvements, accessible full-article rendering, competitive rooms/leaderboards with server-owned validation, offline resilience, and original-content review.
