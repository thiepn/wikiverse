# THIEPN WikiVerse — Batch 1

An independent, source-backed Wikipedia/Wikidata exploration game. **Not affiliated with the Wikimedia Foundation. Not deployed.**

## Implemented

- **WikiRace:** source-verified two-hop practice/daily race generation, real inline article navigation, proof hints, local race records.
- **WikiMystery:** Wikidata property-backed person clues (occupation, birth, awards), progressive reveals, accepted names/aliases, scoring.
- **Discover:** English Wikipedia search, sanitized source article reading, genuine links, bookmarks.
- **My Universe:** locally stored bookmarks, races, mysteries and daily completion.
- **Core:** Wikipedia language/page/revision identity distinct from Wikidata QIDs, content attribution, official Action API calls, request pacing/caching, responsive UI.

## Run

```sh
npm install
npm run dev
npm run build
npm test
```

Requires Node 20.19+ for Vite 7. No credentials or remote backend required. Generate a lockfile after a verified installation.

## Qualification status

18 local source-domain and mocked-network tests PASS, syntax transpilation PASS. Full Vite build, live API qualification and desktop/mobile browser acceptance remain **NOT TESTED** due to unavailable npm registry dependencies in the authoring environment. No production deployment, account integration, costs, or migrations.

## Privacy, provenance and gameplay limits

Game results are guest-only localStorage records and are not competitive/anti-cheat secure. Daily challenges are local calendar-keyed, not globally published immutable manifests. Mystery clues are taken from Wikidata claims; not all claims are independently fact-checked. Wikipedia content is credited with revision/contributor links and a CC BY-SA license notice; Wikidata's CC0 source is linked. Images are not reused. See source code for constraints and algorithms.

## Product roadmap

Next coherent feature batch: real source-backed Galaxy, GeoWiki and WikiChronicle on the same article/entity models. Subsequent: multilingual reading, evidence games, trends, historical revisions and multiplayer. Preserve source ownership, validation, rights and local-first privacy.
