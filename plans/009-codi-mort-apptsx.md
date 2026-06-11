# Pla 009: Eliminar el codi mort comentat d'App.tsx

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- src/App.tsx`
> Si App.tsx ha canviat (plans 005/006/007 hi toquen), localitza els blocs
> amb `grep -n 'REMOVED' src/App.tsx` — les línies hauran ballat però els
> marcadors "REMOVED" identifiquen els blocs exactes.

## Estat

- **Prioritat**: P3
- **Esforç**: S
- **Risc**: BAIX (esborra només comentaris — cap canvi de comportament)
- **Depèn de**: cap (però fes-lo DESPRÉS de 005/006/007 per no generar
  conflictes de merge a App.tsx)
- **Categoria**: tech-debt
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

`src/App.tsx` té 1.813 línies, de les quals ~230 són codi comentat marcat
"REMOVED for Universal Bookmarks" — restes de la migració des de l'app
original de tweets (modals de revisió i carrusel que ja no existeixen). És
un 13% del fitxer més gran del repo que confon qualsevol lector (humà o
agent) i infla cada cerca. El codi és recuperable des de git si mai calgués
(hi és, viu, als commits anteriors a la migració).

## Estat actual

Blocs a esborrar a `src/App.tsx` (línies del commit `23d9adf`; verifica amb
els greps perquè altres plans les mouen):

1. **Línies 221-234** — estats comentats dels modals de revisió i carrusel
   (blocs que comencen amb `// Review Modal States - REMOVED...`,
   `// Carousel Modal State (new flow) - REMOVED...` i
   `// Pending review state (persisted) - REMOVED...`).
2. **Línies 704-923** — el bloc gran: comença a
   `// Review Modal Handlers - REMOVED for Universal Bookmarks` seguit d'un
   comentari de bloc `/* ... */` de ~215 línies amb tots els handlers
   antics, i acaba a `// END OF REMOVED REVIEW MODAL CODE`.
3. **Línies 1751-1755** — tres comentaris de placeholder al JSX:
   `{/* Review Rejected Tweets Modal - REMOVED ... */}`,
   `{/* Carousel Modal ... - REMOVED */}` i
   `{/* Trial Countdown Widget removed ... */}`.

NO és codi mort (no ho toquis): la resta de comentaris descriptius del
fitxer (capçaleres de secció com `// --- Main App ---`, `{/* Main Header
(Static) */}`, etc.) — són documentació viva, no codi desactivat.

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Typecheck | `npx tsc -b` | exit 0 |
| Tests | `npm test` | tots passen |
| Recompte | `wc -l src/App.tsx` | ~230 línies menys que abans |

## Abast

**Dins de l'abast**:
- `src/App.tsx` — només esborrar els tres blocs llistats
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- Partir App.tsx en components (refactor real — no demanat; anota'l com a
  candidat futur si vols, però no el facis).
- Qualsevol línia de codi viu, imports inclosos. Comprova després d'esborrar
  que cap import ha quedat orfe — si `npx tsc -b` o el lint es queixen d'un
  import sense ús que NOMÉS usava el codi esborrat, elimina aquell import i
  documenta-ho al commit.

## Flux de git

- Missatge suggerit: `remove commented-out review/carousel dead code from App.tsx`.
- NO facis push si l'operador no t'ho ha demanat.

## Passos

### Pas 1: Esborra els tres blocs

Usa els marcadors, no els números de línia: tot el que hi ha entre
`// Review Modal Handlers - REMOVED` i `// END OF REMOVED REVIEW MODAL CODE`
(ambdós marcadors inclosos), els estats comentats del bloc 1 i els tres
placeholders del bloc 3.

**Verifica**: `grep -cn 'REMOVED' src/App.tsx` → 0.

### Pas 2: Verificació completa

**Verifica**: `npx tsc -b` → exit 0; `npm test` → tots passen;
`git diff --stat` mostra només `src/App.tsx` amb ~0 insercions i ~230
esborrats (alguna inserció petita si has netejat un import orfe).

## Pla de tests

Cap test nou: el canvi és estrictament l'eliminació de comentaris. La suite
existent i el typecheck són la verificació.

## Criteris de finalització

- [ ] `grep -c 'REMOVED' src/App.tsx` → 0
- [ ] `npx tsc -b` → exit 0; `npm test` → exit 0
- [ ] El diff no conté cap línia esborrada que no fos comentari (revisa
      `git diff src/App.tsx` línia a línia abans de commitejar)
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- Algun dels blocs marcats conté línies que NO estan comentades (codi viu
  barrejat) — no esborris res d'aquell bloc i informa.
- El diff acaba tocant més de ~240 línies — t'has menjat alguna cosa de més.

## Notes de manteniment

- Candidat de seguiment (fora d'abast aquí): App.tsx continua sent un
  monòlit de ~1.580 línies; si es parteix mai, `BookmarkCard` (línies 48-183)
  i els modals són els talls naturals.
