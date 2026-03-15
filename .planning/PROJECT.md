# Universal Bookmarks

## What This Is

Gestor personal de bookmarks basat en AI, compost per una web app (React SPA) i una extensió de Chrome. Permet importar tweets de Twitter/X i guardar pàgines web com a bookmarks, processant-los amb AI per categoritzar-los, titular-los i resumir-los automàticament. Ús estrictament personal, accessible des de múltiples dispositius via VPS.

## Core Value

L'usuari pot capturar qualsevol contingut web (pàgines, tabs obertes, tweets) i trobar-lo més tard organitzat per categories, sense gestió manual.

## Requirements

### Validated

<!-- Funcionalitats existents i en producció. -->

- ✓ Importació de tweets des d'arxius JSON de Twitter/X — existent
- ✓ Processament batch de tweets amb AI (categorització, títol, descripció) — existent
- ✓ Extensió Chrome per guardar pàgina actual com a bookmark — existent
- ✓ Categorització automàtica al guardar des de l'extensió — existent
- ✓ Gestió de categories (crear, eliminar) — existent
- ✓ Web app per navegar i filtrar bookmarks — existent
- ✓ Emmagatzematge via API REST al VPS (fitxer JSON) — existent
- ✓ Fallback a localStorage si no hi ha API configurada — existent
- ✓ Detecció de duplicats — existent
- ✓ Suport multilingüe (català/anglès) — existent

### Active

<!-- Scope del proper milestone (v1.0). -->

- [ ] Servidor local proxy Claude (LaunchAgent macOS) substitueix Gemini (PROXY-01..04, AI-01..04)
- [ ] Feature pestanyes Chrome: filtre, multi-select, bulk save amb status inline (TABS-01..04)
- [ ] Fix single-save: categorització Claude wired al save individual (AI-03)

### Out of Scope

- Base de dades externa (Supabase, PostgreSQL, etc.) — JSON al VPS és suficient per ús personal
- Accés públic / multi-usuari — ús personal exclusivament
- AI des del VPS — AI sempre s'executa localment des del Mac
- OAuth / sistema d'autenticació — no necessari per ús personal

## Context

**Estat actual (pre-v1.0):**
- Web app React (SPA) servida pel VPS — TypeScript/TSX amb Vite + Tailwind
- Extensió Chrome MV3 amb popup, content script i service worker
- API REST al VPS que llegeix/escriu a fitxers JSON
- AI actual: Google Gemini (`geminiService.ts`, `@google/genai`) — a substituir per Claude

**Entorn de l'usuari:**
- Mac mini + MacBook Air, ambdós amb Claude Code CLI autenticat via Pro subscription
- Cap dels dos Macs és sempre encès — AI disponible quan el Mac és encès (sempre és el cas quan s'usa el browser)
- VPS serveix la UI, accessible des de qualsevol dispositiu

**Referència:** Mateix projecte ja completat com `ai-bookmarks` (v1.0 shipped 2026-03-14). Tota la implementació és coneguda i provada.

## Constraints

- **Tech stack**: React + Vite + TypeScript + Tailwind — sense canvis
- **Storage**: JSON al VPS via API REST existent — sense canvis
- **AI provider**: Claude (Anthropic) via CLI session local — substituir Gemini
- **Desplegament AI**: Sempre local (Mac) — mai al VPS
- **Plataforma**: macOS (LaunchAgent per auto-start del servidor local)
- **Chrome Extension**: MV3 — restriccions de permisos de la plataforma

## Key Decisions

<!-- Decisions apreses de la implementació ai-bookmarks v1.0 -->

| Decisió | Raonament | Outcome |
|---------|-----------|---------|
| Servidor local proxy per Claude | El CLI session no és accessible des del browser directament; el proxy llegeix el token localment | ✓ Provat a ai-bookmarks |
| execFile → spawn per claude CLI | execFile penjava indefinidament; spawn amb stdio configurat resol el problema | ✓ Fix crític conegut |
| callClaudeProxy en popup (no service worker) | Evita doble crida a Claude; SAVE_BOOKMARK rep bookmark ja categoritzat | ✓ Provat a ai-bookmarks |
| Sequential for..of per bulk save | Evita GET-modify-POST race condition en storage compartit | ✓ Provat a ai-bookmarks |
| 3-tier category fallback (single-save) | Claude → user selection → Altres — paritat amb handleBulkSave | ✓ Provat a ai-bookmarks |

---
*Last updated: 2026-03-15 after initialization*
