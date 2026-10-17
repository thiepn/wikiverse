# THIEPN WikiVerse — Product-wide completeness inventory

Source audit updated: October 17, 2026. Intended scope: Play, Explore, Learn, My Universe, and eventual private multiplayer. **This is a feature inventory, not a readiness percentage.** Source identities and the existing local progress engine remain authoritative for guest usage.

| Product capability | Audited state | Source implementation |
| --- | --- | --- |
| Source-backed WikiRace and WikiMystery | Implemented: original Wikipedia links; Wikidata claims and alias grading | `src/domain/game.mjs`, `src/services/wikimedia.mjs`, `src/main.tsx` |
| Link Lab educational games | Implemented: outgoing-link and shared-link recognition using **two actual pinned source revisions**, with source-verifiable distractors | `src/domain/linklab.mjs`, `src/features/linklab.tsx` |
| Source-pinned challenge sharing | Implemented: locally repeatable daily Trail Arena; portable `WV1` routes and `WVROOM1` invitations with expiry and explicit **NOT CONNECTED** status | `src/features/arena.tsx`, `src/domain/rooms.mjs` |
| Knowledge Galaxy, GeoWiki and Chronicle | Implemented: factual source identifiers from Wikidata; relationships, positions, time ordering, graded statement identity | `src/features/exploration.tsx`, `src/domain/exploration.mjs` |
| WikiPolyglot and Source Detective | Implemented: canonical QID revalidation of both loaded editions, switchable exact-source cloze in English or the chosen supported language, bilingual original-source excerpts; additionally QID-linked language articles, original cloze/vocabulary, citation identity and human-ungraded evidence journal | `src/features/learning.tsx` |
| WikiPulse and Time Capsule | Implemented: Wikimedia pageviews, pinned historical revision differences, bounded date scopes and pagination | `src/features/history.tsx`, `src/services/history.mjs` |
| Discovery reading and local bookmarks | Implemented: sanitized original article reading, article hyperlinks and canonical saved pages | `src/main.tsx`, `src/components/reader.ts` |
| Portable original-source excerpt collection | **Implemented**: manually highlighted 12–360-character passages, preserving original Wikipedia edition/page/revision and attribution links; independent of source mastery, compact user-only local storage and backed up through original v1 progress. Offline *small excerpts* only—not full offline articles | `src/domain/study.mjs`, `src/features/study.tsx`, `src/main.tsx`, `src/features/learning.tsx` |
| Personalized study continuity | Implemented: reading events, page-source trails, editable notes, due reviews and pinned replay; now **five-step source-specific guided journey and cross-mode review queue (Polyglot, Detective, Galaxy, Pulse and Capsule)** across Discover, bookmarks, original-source Link Lab and private notes using existing evidence, not a new scoring engine | `src/domain/study.mjs`, `src/features/study.tsx` |
| Daily missions and local achievements | Implemented: participation-only source record evaluation; no artificial mastery or competitive grade | `src/domain/missions.mjs` |
| Data ownership and portable recovery | Implemented: private file export, SHA-256 integrity, per-mode original-source grade/rights validation, preview, merge/replace against the most recent device state, conflict precedence and atomic localStorage write; no remote upload or new store | `src/domain/backup.mjs`, `src/features/backup.tsx`, `src/services/storage.mjs` |
| Source/API resilience | Bounded retries, canonical oldid checks, v1/v2 Wikibase mapping, six successful live Node responses plus three real Chromium CORS checks; one English-label field remained unverified | `src/services/wikimedia.mjs`, `scripts/live-source-probe.mjs` |
| Multiplayer backend | **NOT IMPLEMENTED**. Only invitation codes and protocol validators exist; no transport/auth/server-owned membership | `src/domain/room-protocol.mjs` |
| Authoritative leaderboards, secure competitive scoring and global daily challenge authority | **NOT IMPLEMENTED**. Results and manifests are locally editable and unranked | `src/domain/arena.mjs`, `src/services/storage.mjs` |
| Local export/import and recovery | **IMPLEMENTED** for manual device-to-device JSON file transfer. Cloud sync, identity authentication, automatic cross-device merging and durable server backups remain **NOT IMPLEMENTED** | `src/domain/backup.mjs`, `src/features/backup.tsx` |
| Offline Wiki reading and durable source cache | **PARTIALLY IMPLEMENTED**. Owner-selected bounded text-only original-revision reading copies with offline accessible reader and ungraded reveal/self-recall; no automatic full-page offline archive or remote cache | `src/services/wikimedia.mjs` |
| Full production source reliability and accessibility | **NOT QUALIFIED**. Limited live Node **and Chromium CORS** APIs passed; full live gameplay, real-device/assistive-tech tests, rate limits, multiple editions, licensing and security remain open | `.github/workflows/validate.yml` |

## Prioritized subsequent implementation batches

1. **User-owned progress backup and recovery — implemented for manual files**: automatic sync, file encryption at rest, and multi-device identity/permissions are still out of scope and unqualified.
2. **Source resilience & authentic content breadth**: now includes rate-limit advice and stops retryable request cascades; **now probes** French/German/Korean edition identity through Chromium and French/German through read-only Node (individual source results must be inspected); **still needs** complete all-edition live user journeys, missing localized data UX, request budgets, and Wikipedia/Wikidata rights review.
3. **Advanced source-study workflows**: five explicit source-specific actions and user-selected source excerpts implemented, while more diverse interactive original-source exercises, durable offline bookmarks/reading and comprehensive accessible annotations remain for later.
4. **Real multiplayer** only after an authorized, independently secured server, authentication, server-verified source manifest/attempt authority, consent and abuse controls exist. Client protocol validation alone is not an operational backend.
5. **Release qualification near feature completeness**: keyboard and screen-reader audit, true mobile devices, Wikimedia licensing/contributor attribution, privacy/security, high-load resilience and documented production rollout.

## Verification evidence and boundaries

- Exact-head GitHub Actions runs **mock** Wikimedia for reproducible full browser gameplay acceptance; separate bounded **live Node GET** and **real Chromium-origin CORS GET** steps test a small number of genuine upstream responses without credentials.
- Do not call an upstream field failure 'PASS'. In the live probe, the default Q42 English label was empty, while an explicit fallback query returned the expected English label. This remains a content-quality limitation; the learning game must not invent absent Wikidata labels.
- Text comparison finds changed original paragraphs, not historical factual truth. Citation assessments are user-authored, never automatically graded for credibility.
- **All changes remain on draft PR #1, with main, deployment and production unchanged.**

## Most recent acceptance

[GitHub Actions #38972240488](https://github.com/thiepn/wikiverse/actions/runs/38972240488) on literal head `627d312743b3050fec1fb650b28757cda8764d58`: 118/118 tests, TypeScript/Vite, full mocked desktop/mobile Chromium journeys, and three genuinely cross-origin browser GETs PASS. Wikimedia Node API checks: 6 PASS, 1 NOT_TESTED for a missing default English label, zero FAIL. Do not interpret these as global upstream content quality, factual proof, all-edition CORS or release certification. The same draft PR continues with no merge/deployment.

## Original-source offline workbench — October 18, 2026

- Searches, passage navigation and language-aware original-text highlighting operate only on user-selected source copies. No new Wikimedia fetch, account, server or grade store is involved.
- Local quote locator asks learners to identify one uniquely present, exact original passage; repeated/ambiguous source text is not silently treated as a correct answer. A separate three-passage ordering interaction compares saved original paragraph order. Both reveal their source basis, never assign or persist mastery or original-engine grades.
- Original-language source excerpts can be selected from saved text and sent into the **existing** source clip collection (12–360 characters, exact single paragraph), retaining original Wikipedia language/page/revision and portable recovery; open existing topic notes from the same offline workspace.
- Desktop and mobile acceptance exercises search, quote-location, sequence restoration, source selection, source identity and reload, alongside dedicated adversarial, duplicate-source and Unicode domain tests.

## Offline reading completion batch — October 18, 2026

- Explicit user-initiated capture of the currently displayed, sanitized original article text in Discover, WikiRace and either verified WikiPolyglot edition. No crawling or unattended downloads. Up to eight retained original-language articles, 24 sections / 10,000 characters each, with a 78,000-character overall source-text budget. Existing short quotes remain separate.
- Study Desk offline shelf exposes a keyboard-usable reader, size controls and ungraded self-recall reveal. Only the saved text is available without network; links to full upstream articles naturally still require connectivity. Capture stores plain text and original language/page/revision identities, never HTML or grading authority.
- Uses unchanged `wikiverse:progress:v1` local authority and manual backup merge/replace (backward-compatible with backups lacking new collection). Existing source-scored engines cannot use offline text to award credit.
- Validation must reject missing IDs, altered revision URL, unwanted fields, oversized collections, duplicate identities, and keep current local data if capacity/restore validation fails.
