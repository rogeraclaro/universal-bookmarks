# Requirements: Universal Bookmarks

**Defined:** 2026-03-15
**Core Value:** L'usuari pot capturar qualsevol contingut web i trobar-lo més tard organitzat per categories, sense gestió manual.

## v1 Requirements

### Servidor Local Proxy

- [x] **PROXY-01**: El servidor local llegeix el token de sessió del Claude Code CLI (keychain / config file macOS)
- [x] **PROXY-02**: El servidor exposa un endpoint HTTP local (`localhost:3838`) que accepta peticions d'AI i les envia a l'Anthropic API
- [x] **PROXY-03**: LaunchAgent macOS configurat per auto-start al login en ambdós Macs
- [x] **PROXY-04**: La web app i l'extensió criden el proxy local en lloc de Gemini directament

### Substitució Gemini → Claude

- [x] **AI-01**: `claudeService.ts` substitueix `geminiService.ts` amb la mateixa interfície pública (`processBookmarksWithClaude`)
- [x] **AI-02**: El processament de tweets (categorització, títol en català, descripció, `isAI`) funciona via Claude
- [ ] **AI-03**: La categorització de pàgines web al guardar des de l'extensió funciona via Claude
- [x] **AI-04**: Gestió d'errors i fallback (bookmark sense AI si el proxy no és accessible) equivalent a l'actual

### Feature Pestanyes Chrome

- [ ] **TABS-01**: Nou botó o secció al popup de l'extensió per accedir a les tabs obertes
- [ ] **TABS-02**: L'usuari pot filtrar tabs per grup de Chrome o veure només les tabs sense grup
- [ ] **TABS-03**: L'usuari pot seleccionar múltiples tabs de la llista
- [ ] **TABS-04**: Claude categoritza cada tab seleccionada i les guarda totes com a bookmarks (bulk)

## v2 Requirements

### Millores futures possibles

- **V2-01**: Indicador visual a la UI quan el proxy local no és accessible
- **V2-02**: Re-categorització manual d'un bookmark existent via Claude
- **V2-03**: Suport per a models Claude configurables (Haiku / Sonnet) des de la UI

## Out of Scope

| Feature | Reason |
|---------|--------|
| Base de dades (Supabase, PostgreSQL) | JSON al VPS és suficient per ús personal |
| AI des del VPS | VPS no té CLI session; arquitectura local és suficient |
| Multi-usuari / accés públic | Ús personal exclusivament |
| Autenticació web | No necessari per ús personal |
| App mòbil nativa | Web responsive és suficient per consulta |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROXY-01 | Phase 1 | Complete (01-01) |
| PROXY-02 | Phase 1 | Complete (01-01) |
| PROXY-03 | Phase 1 | Complete |
| PROXY-04 | Phase 1 | Complete (01-01) |
| AI-01 | Phase 1 | Complete |
| AI-02 | Phase 1 | Complete |
| AI-03 | Phase 3 | Pending |
| AI-04 | Phase 1 | Complete (01-01) |
| TABS-01 | Phase 2 | Pending |
| TABS-02 | Phase 2 | Pending |
| TABS-03 | Phase 2 | Pending |
| TABS-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after plan 01-01 completion*
