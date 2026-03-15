# Milestones

## v1.0 MVP (Shipped: 2026-03-15)

**Phases completed:** 4 phases, 9 plans

**Delivered:** Substitució completa Gemini → Claude via proxy local, feature bulk-save de pestanyes Chrome amb revisió AI, i categorització Claude wired al single-save.

**Stats:**
- Timeline: 1 dia (2026-03-15)
- Commits: ~54
- LOC TypeScript: 3.878
- Files modified: 42 (+6702/-1254 línies)

**Key accomplishments:**
1. Proxy local Node.js llegeix token Claude Code i exposa HTTP API (port 3839) amb LaunchAgent auto-start als dos Macs
2. Substitució completa Gemini → Claude: `claudeService.ts` amb mateixa interfície pública, zero canvis als consumidors
3. Feature Chrome Tabs: selecció múltiple de pestanyes amb filtre per grup i categorització AI en bulk amb vista de revisió pre-guardat
4. Single-save wired a Claude: categories pre-seleccionades en obrir el popup, detecció de duplicats en paral·lel
5. Deute tècnic Gemini eliminat: `@google/genai` desinstal·lat, `geminiService.ts` i `TrialCountdown.tsx` eliminats

**Known Gaps (tech debt):**
- PROXY-02: Port 3839 vs spec 3838 — sistema funcionalment alineat (3839 consistent a tots els components), però no coincideix amb l'spec original
- AI-02: Camp `isAI` retornat pel proxy però no consumit per la UI — dead field pendent de decidir (consumir o eliminar)

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md`

---
