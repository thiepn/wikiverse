# THIEPN WikiVerse — Product-wide completeness inventory

Last source audit: October 16, 2026. Intended scope: Play, Explore, Learn, My Universe, and eventual private multiplayer. **This is a feature inventory, not a readiness percentage.** Source identities and the existing local progress engine remain authoritative for guest usage.

| Product capability | Audited state | Source implementation |
| --- | --- | --- |
| Source-backed WikiRace and WikiMystery | Implemented: original Wikipedia links; Wikidata claims and alias grading | `src/domain/game.mjs`, `src/services/wikimedia.mjs`, `src/main.tsx` |
| Link Lab educational games | Implemented: outgoing-link and shared-link recognition using **two actual pinned source revisions**, with source-verifiable distractors | `src/domain/linklab.mjs`, `src/features/linklab.tsx` |
| Source-pinned challenge sharing | Implemented: locally repeatable daily Trail Arena; portable `WV1` routes and `WVROOM1` invitations with expiry and explicit **NOT CONNECTED** status | `src/features/arena.tsx`, `src/domain/rooms.mjs` |
| Knowledge Galaxy, GeoWiki and Chronicle | Implemented: factual source identifiers from Wikidata; relationships, positions, time ordering, graded statement identity | `src/features/exploration.tsx`, `src/domain/exploration.mjs` |
| WikiPolyglot and Source Detective | Implemented: QID-linked language articles, original cloze/vocabulary, citation identity and human-ungraded evidence journal | `src/features/learning.tsx` |
| WikiPulse and Time Capsule | Implemented: Wikimedia pageviews, pinned historical revision differences, bounded date scopes and pagination | `src/features/history.tsx`, `src/services/history.mjs` |
| Discovery reading and local bookmarks | Implemented: sanitized original article reading, article hyperlinks and canonical saved pages | `src/main.tsx`, `src/components/reader.ts` |
| Personalized study continuity | Implemented in this batch: actual reading events and link-source trail, editable source-revision research notes, due queues from missed Link Lab attempts and user-flagged notes, explicit user-chosen revisit intervals, archived revision replay | `src/domain/study.mjs`, `src/features/study.tsx` |
| Daily missions and local achievements | Implemented: participation-only source record evaluation; no artificial mastery or competitive grade | `src/domain/missions.mjs` |
| Data ownership | Guest progress locally retained. No remote profiling/sync. Local storage has a size guard and clear control | `src/services/storage.mjs` |
| Source/API resilience | Bounded retries and caching; canonical oldid checks; v1/v2 Wikibase language mapping; read-only CI live probes | `src/services/wikimedia.mjs`, `scripts/live-source-probe.mjs` |
| Multiplayer backend | **NOT IMPLEMENTED**. Only invitation codes and protocol validators exist; no transport/auth/server-owned membership | `src/domain/room-protocol.mjs` |
| Authoritative leaderboards, secure competitive scoring and global daily challenge authority | **NOT IMPLEMENTED**. Results and manifests are locally editable and unranked | `src/domain/arena.mjs`, `src/services/storage.mjs` |
| Cloud backup/export/import and cross-device account sync | **NOT IMPLEMENTED**. User-owned personal data can disappear if local browser storage is cleared | `src/services/storage.mjs` |
| Offline Wiki reading and durable source cache | **NOT IMPLEMENTED**. In-memory request cache is bounded and not a full offline archive | `src/services/wikimedia.mjs` |
| Full production source reliability and accessibility | **NOT QUALIFIED**. Live Node API subset tested, but browser CORS, mobile real-device/assistive tech, rate limits, multiple editions, license review and production security remain open | `.github/workflows/validate.yml` |

## Prioritized subsequent implementation batches

1. **User-owned progress backup and recovery**: explicit local export/import with migration-aware shape validation, privacy controls, and conflict handling without discarding existing records.
2. **Source resilience & authentic content breadth**: cross-edition live browser acceptance, missing-label source fallback behavior, request budgeting, status/actionable retry UI; preserve independent Wikidata QID and Wikipedia article/revision identifiers.
3. **Advanced source-study workflows**: more than two game styles using independent article and Wikidata statements, guided personalized topics, reflective review without pretending to know subjective truth, accessible reading/annotations.
4. **Real multiplayer** only after an authorized, independently secured server, authentication, server-verified source manifest/attempt authority, consent and abuse controls exist. Client protocol validation alone is not an operational backend.
5. **Release qualification near feature completeness**: keyboard and screen-reader audit, true mobile devices, Wikimedia licensing/contributor attribution, privacy/security, high-load resilience and documented production rollout.

## Verification evidence and boundaries

- Exact-head GitHub Actions runs **mock** Wikimedia for reproducible browser acceptance; a separate bounded **live Node GET** step tests actual upstream response shapes and has no credentials.
- Do not call an upstream field failure 'PASS'. In the live probe, the default Q42 English label was empty, while an explicit fallback query returned the expected English label. This remains a content-quality limitation; the learning game must not invent absent Wikidata labels.
- Text comparison finds changed original paragraphs, not historical factual truth. Citation assessments are user-authored, never automatically graded for credibility.
- **All changes remain on draft PR #1, with main, deployment and production unchanged.**
