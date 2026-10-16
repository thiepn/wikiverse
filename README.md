# THIEPN WikiVerse

A source-backed, local-first Wikipedia/Wikidata exploration and learning platform. **Independent of the Wikimedia Foundation.** Development remains on draft PR #1; this project is not deployed.

## Experiences

| Mode | Gameplay and learning |
| --- | --- |
| **Backup & Recovery** | Download complete user-owned JSON progress, inspect SHA-256 integrity and canonical source IDs, preview merge/replacement, and explicitly commit local restoration without accounts or remote storage |
| **Study Desk** | Preserve source-revision reading history, linked journeys, private editable research notes, a review queue for missed source exercises, optional revisit scheduling, and pinned-revision replay from previous attempts |
| **Link Lab** | Two source-generated link-recognition exercises from pinned Wikipedia revisions, now supporting source-topic practice from the Study Desk |
| **Daily Missions** | Rotating local source-event activities, seven-day activity records, and retrospective unranked achievements |
| **Trail Arena** | Verified article-link trails with locally repeatable daily manifest, private portable challenge codes, and explicit offline room invitations |
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

The current draft PR includes source/domain Node tests, TypeScript/Vite and automated Chromium desktop/mobile user journeys. The exact commit and PASS/FAIL evidence for the most recent run are recorded in [draft PR #1](https://github.com/thiepn/wikiverse/pull/1) and its GitHub Actions. **Do not assume a commit is qualified merely because it belongs to the PR.**

GitHub Actions also performs a small, bounded, read-only Node HTTP probe of Wikipedia revision history, a pinned article revision, Wikidata Q42, and Wikimedia pageviews. In this workstream the original Wikipedia and pageview APIs responded successfully; Wikidata Q42 identity and an explicit fallback-language label query responded. The default English-label query returned an empty map. Wikibase's legacy format 1 is therefore used for entity queries while the adapter accepts both map and array multilingual representations. **Client-browser CORS, many other Wikipedia language editions, external reference truth, production rate limits and accessibility remain unqualified.** Mock-backed Chromium tests do not establish real upstream behavior.

All browsing and user notes remain local to the device. There is no hosted room authority, real-time multiplayer presence, synchronized remote leaderboard, anti-cheat score server or globally signed daily challenge. Untrusted room messages cannot create trusted membership without a future authenticated backend.

**Strict boundaries:** no deployment, no merge, no production/data migrations, no authenticated account synchronization, no paid services, no credentials. Clearing browser storage removes progress; cross-device backup/import is not yet included.

See [Product-wide completion inventory](docs/product-completeness.md) for sourced major gaps and planned feature-first priorities.

## Local backup, recovery and guided study journeys

Open **Backup & Recovery** to download a private \`wikiverse-local-backup\` JSON file. The file may contain private notes, reading history, source-linked activity and review intentions. Keep it secure and choose **Import** to preview every category before confirming either:
- **Merge**: preserve local notes, bookmarks and review decisions on identity collisions; union distinct source events without exceeding bounded history limits. The operation refuses capacity overflow instead of silently discarding data.
- **Replace**: explicitly replace this browser's entire local WikiVerse progress with the validated backup. Export current progress first.

The file uses SHA-256 **integrity checking only**. This is not cryptographic authentication or authoritative scoring: a person in possession of a file may modify it and recompute the checksum. Invalid schemas, source identities, forbidden properties, local ranks and oversized content are rejected before any write. Backup import does **not** confer accounts, official credentials, hosted multiplayer access, or authoritative leaderboard points. Persistent storage remains the existing \`wikiverse:progress:v1\` record, with no migration or parallel data store.

Study Desk now derives a five-step **source-specific** reading journey from actual existing records: open the original article, follow a displayed Wikipedia link, save the canonical article, correctly answer a source-backed Link Lab question, and save a private study note. These are local research actions, **not a learning mastery score**. Each step links directly into the existing feature engine.

Read-only GitHub CI separately probes limited real Wikimedia Action/Wikidata/Analytics responses. Full live client-browser behavior and cross-edition reliability are not qualified by Node-side API probes.
