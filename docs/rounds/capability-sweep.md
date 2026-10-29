# The external capability sweep (2026-07-28)

> Moved from Claude's working memory on 2026-10-29. A dated record: it describes things as they were when written, so check the code and `.claude/rules/` before relying on it.

✅ **DONE 2026-07-28** (commits `5f84dd2` machinery → `0ee731d` energy taxonomy → `05e07c2` triage application). The closing data task before launch: derived capabilities cross-checked against (1) Fandom wiki capability categories and (2) Genshin's IT roles (`docs/curation/capability-sweep.md` — roles flex to capabilities, never vice versa).

**Machinery** (permanent, offline re-runnable):

- `scripts/fetch-wiki-capabilities.mjs` — ONLY network entry point; MediaWiki API (WebFetch is 402-blocked; curl works). Snapshot: `docs/library/wiki/capability-categories.json`. Title→ability resolution ladder resolved 375/375 automatically.
- `scripts/audit-capability-sweep.mjs [--write]` → `docs/curation/capability-sweep.md`; `--mutate id:kind` = seeded-negative self-test.
- `scripts/wiki-capability-config.mjs` — category→kind map + `WIKI_KNOWN_WRONG` (17 evidence-backed suppressions; RE-VERIFY on refetch after a major patch).
- `capMatchesFacet`/`FUNCTION_FACETS`/`FacetKey` moved INTO `deriveCapabilities.ts` (route lib re-exports) so audit + UI share one predicate.

**Outcome:** 0 actionable findings. 20 effect fixes (Shenhe/Xilonen/Lauma/Mona-Omen/Eula shreds, Candace team infusion, ~7 heals incl. iansan/traveler variants), 15 style-guide caveats where the Tier-2 freeze blocks modeling, Itto's wrong-direction burst shred DELETED, traveler_hydro stale-beta stub re-ingested. Fixture audit 11→10 (traveler_hydro heal gap resolved; rest = documented gaps + 6 stubs).

**Wiki traps discovered (encoded in config):** flat energy lives in plain `Energy Talents/Constellations`, NOT `Energy Generation *`; Stygian Onslaught `|buffType=Revelation` fields pollute utility categories; Vacuum Field shared "activation pushing vacuum" rows and shard-collection rows never imply grouping; wiki lags new characters and undercategorizes constellation shreds.

**Open, for Nate's roles editorial pass:** jahoda (healer, add survivability), kokomi (support = element application, not a facet), mika (support real but needs an `atkSpd` Stat key post-launch — noted in `WIKI_KNOWN_WRONG`).
