# Universal Bookmarks

## What This Is

Gestor personal de bookmarks basat en AI, compost per una web app (React SPA) i una extensió de Chrome. Permet importar tweets de Twitter/X i guardar pàgines web i pestanyes Chrome com a bookmarks, processant-los amb Claude AI via un proxy local per categoritzar-los, titular-los i resumir-los automàticament. Ús estrictament personal, accessible des de múltiples dispositius via VPS.

## Core Value

L'usuari pot capturar qualsevol contingut web (pàgines, tabs obertes, tweets) i trobar-lo més tard organitzat per categories, sense gestió manual.

## Requirements

### Validated

- ✓ Importació de tweets des d'arxius JSON de Twitter/X — existent
- ✓ Processament batch de tweets amb AI (categorització, títol, descripció) — existent
- ✓ Extensió Chrome per guardar pàgina actual com a bookmark — existent
- ✓ Gestió de categories (crear, eliminar) — existent
- ✓ Web app per navegar i filtrar bookmarks — existent
- ✓ Emmagatzematge via API REST al VPS (fitxer JSON) — existent
- ✓ Fallback a localStorage si no hi ha API configurada — existent
- ✓ Detecció de duplicats — existent
- ✓ Suport multilingüe (català/anglès) — existent
- ✓ Servidor local proxy Claude (LaunchAgent macOS) substitueix Gemini — v1.0
- ✓ Feature pestanyes Chrome: filtre, multi-select, bulk save amb revisió AI — v1.0
- ✓ Categorització Claude al single-save (AI-03) — v1.0

### Active

- [ ] **V2-01**: Indicador visual a la UI quan el proxy local no és accessible
- [ ] **V2-02**: Re-categorització manual d'un bookmark existent via Claude
- [ ] **V2-03**: Suport per a models Claude configurables (Haiku / Sonnet) des de la UI

### Out of Scope

- Base de dades externa (Supabase, PostgreSQL, etc.) — JSON al VPS és suficient per ús personal
- Accés públic / multi-usuari — ús personal exclusivament
- AI des del VPS — AI sempre s'executa localment des del Mac
- OAuth / sistema d'autenticació — no necessari per ús personal
- App mòbil nativa — web responsive és suficient per consulta

## Context

**Estat actual (post-v1.0):**
- Web app React (SPA) servida pel VPS — TypeScript/TSX amb Vite + Tailwind (~3.878 LOC)
- Extensió Chrome MV3 amb popup, content script i service worker
- API REST al VPS que llegeix/escriu a fitxers JSON
- AI: Claude via proxy local Node.js (port 3839) + LaunchAgent auto-start
- `@google/genai` eliminat; `geminiService.ts` i `TrialCountdown.tsx` eliminats

**Entorn de l'usuari:**
- Mac mini + MacBook Air, ambdós amb Claude Code CLI autenticat via Pro subscription
- Cap dels dos Macs és sempre encès — AI disponible quan el Mac és encès (sempre és el cas quan s'usa el browser)
- VPS serveix la UI, accessible des de qualsevol dispositiu

**Deute tècnic pendent (v1.0):**
- Port 3839 vs spec 3838 (consistent però no coincideix amb spec)
- Camp `isAI` retornat pel proxy però no consumit per la UI

## Constraints

- **Tech stack**: React + Vite + TypeScript + Tailwind — sense canvis
- **Storage**: JSON al VPS via API REST existent — sense canvis
- **AI provider**: Claude (Anthropic) via CLI session local — proxy en port 3839
- **Desplegament AI**: Sempre local (Mac) — mai al VPS
- **Plataforma**: macOS (LaunchAgent per auto-start del servidor local)
- **Chrome Extension**: MV3 — restriccions de permisos de la plataforma

## Key Decisions

| Decisió | Raonament | Outcome |
|---------|-----------|---------|
| Servidor local proxy per Claude | El CLI session no és accessible des del browser directament; el proxy llegeix el token localment | ✓ Provat a ai-bookmarks |
| execFile → spawn per claude CLI | execFile penjava indefinidament; spawn amb stdio configurat resol el problema | ✓ Fix crític conegut |
| callClaudeProxy en popup (no service worker) | Evita doble crida a Claude; SAVE_BOOKMARK rep bookmark ja categoritzat | ✓ Provat a ai-bookmarks |
| Sequential for..of per bulk save | Evita GET-modify-POST race condition en storage compartit | ✓ Provat a ai-bookmarks |
| 3-tier category fallback (single-save) | Claude → user selection → Altres — paritat amb handleBulkSave | ✓ Provat a ai-bookmarks |
| Port 3839 (no 3838) | Conflicte amb servei `aibookmarks` existent al Mac de dev | ✓ Consistent a tota la base de codi |
| Vista de revisió AI pre-guardat (tabs) | Permet a l'usuari editar categories abans de confirmar; millor UX que guardat cec | ✓ Implementat a Phase 2 |
| Parallel Promise.all per categories + duplicate check | Redueix temps de càrrega del popup; Claude es crida seqüencialment després | ✓ Implementat a Phase 3 |
| callClaudeProxy rep resolvedCats (no React state) | State batch updates poden no haver-se aplicat quan es fa la crida | ✓ Fix crític descobert en Phase 3 |

---
*Last updated: 2026-03-15 after v1.0 milestone*
