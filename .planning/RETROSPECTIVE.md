# Retrospective: Universal Bookmarks

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-15
**Phases:** 4 | **Plans:** 9

### What Was Built

1. **Phase 1 — Claude Proxy:** Proxy local Node.js amb tests hermétics, LaunchAgent auto-start, i substitució completa de `geminiService.ts` per `claudeService.ts`
2. **Phase 2 — Chrome Tabs Feature:** UI de selecció de pestanyes amb filtre per grup, bulk save amb categorització AI, i vista de revisió pre-guardat
3. **Phase 3 — Fix Single-Save:** `loadData` wired a Claude amb pre-selecció de categories validada i detecció de duplicats en paral·lel
4. **Phase 4 — Tech Debt Cleanup:** Eliminació de `geminiService.ts`, `TrialCountdown.tsx`, `@google/genai`, i totes les refs Gemini residuals

### What Worked

- **Referència provada:** Tenir `ai-bookmarks` v1.0 com a referència va eliminar incertesa de disseny. Cada decisió ja estava presa.
- **TDD per al proxy:** Tests hermétics (Phase 1) van detectar problemes reals (port conflicts, spawn vs execFile) sense necessitat d'integració manual.
- **Fases curtes i atòmiques:** Cap fase va superar 1h. Execution ràpida i fàcil de revisar.
- **Auto-fix disciplinat:** Desviar per afegir duplicate check (Phase 3) va ser la decisió correcta sense scope creep.

### What Was Inefficient

- **ROADMAP.md no actualitzat durant l'execució:** Les phases 3 i 4 van quedar marcades com `[ ]` al Progress table tot i estar completades. Va requerir correcció manual al tancar el milestone.
- **gsd-tools no va extreure accomplishments automàticament:** Els one_liners no estaven en el format esperat, calen accomplishments manuals.
- **7 ítems de deute tècnic acumulats:** Port mismatch i `isAI` dead field podrien haver-se resolt en el propi milestone en lloc de diferir-los.

### Patterns Established

- `callClaudeProxy` sempre en el popup, no al service-worker — evita doble crida
- `filter(c => resolvedCats.includes(c))` per validar categories AI contra llista coneguda
- `Promise.all([getCategories, checkDuplicate])` → Claude seqüencial — pattern de càrrega paral·lela
- Green-400 com a color primari accent de l'extensió (en lloc de yellow-400)
- `spawn` (no `execFile`) per invocar el CLI de Claude des de Node.js

### Key Lessons

1. Tenir un projecte de referència transforma implementació en port — redueix el risc gairebé a zero
2. El proxy local és l'arquitectura correcta per integrar AI amb sessió CLI; no intentar accedir al token des del browser
3. La vista de revisió AI (tabs) és essencial per bulk operations — guardat cec sense confirmació seria una regressió UX
4. El port del proxy hauria d'estar en una constant centralitzada per evitar el mismatch actual

### Cost Observations

- Model: claude-sonnet-4-6 (principal)
- Sessions: ~6-8 sessions el 2026-03-15
- Notable: Tot el milestone executat en 1 dia gràcies a la referència provada

---

## Cross-Milestone Trends

| Milestone | Fases | Plans | Dies | Plans/Dia |
|-----------|-------|-------|------|-----------|
| v1.0 MVP  | 4     | 9     | 1    | 9         |
