# Pla 013 (spike): Disseny de la importació universal de bookmarks

> **Instruccions per a l'executor**: Aquest és un pla d'ESPIA/DISSENY, no de
> construcció. El lliurable principal és un document de disseny + parsers
> prototip amb tests. NO connectis res a la UI ni modifiquis el flux
> d'importació existent. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- src/App.tsx src/types.ts src/services/`
> Si la pipeline d'importació ha canviat (pla 005 la toca), llegeix la versió
> actual de `processTweetsData` i `handleFileUpload` abans d'escriure res.

## Estat

- **Prioritat**: P3
- **Esforç**: M (com a spike; la construcció posterior serà M–L i tindrà el
  seu propi pla)
- **Risc**: BAIX (no toca codi de producció)
- **Depèn de**: cap (millor després del 005 per dissenyar sobre l'API final)
- **Categoria**: direcció
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

El producte es diu **Universal** Bookmarks, però l'única via d'importació
massiva accepta exclusivament JSON de bookmarks de Twitter: el parser busca
camps de tweet (`id_str`, `full_text`, `entities.urls` — vegeu
`src/types.ts`, tipus `TweetRaw`) i l'enllaç resultant es força a
`https://twitter.com/i/web/status/<id>` (`src/App.tsx:541`). L'evidència de
la intenció no realitzada és per tot el repo: el rename a "Universal", el
desat de pàgines arbitràries via extensió, i els camps genèrics del model
(`Bookmark.originalLink`, `author`, `categories`). Falta el tram
d'importació: HTML d'exportació de bookmarks del navegador, CSV de Pocket,
backup de Raindrop. Aquest spike decideix el disseny abans de gastar
l'esforç de construcció.

## Estat actual (la pipeline d'avui)

- Entrada: `handleFileUpload` (`src/App.tsx:570-653`) llegeix un fitxer JSON
  i decideix: backup propi (camps `backupVersion`+`bookmarks`+`categories` →
  fusiona) o arxiu de tweets (array directe, o `.bookmarks`, o primer valor
  array de l'objecte).
- Processament: `processTweetsData` (`src/App.tsx:447-568`) — deduplica per
  id de tweet contra `existingIds` (derivats de l'últim segment de
  `originalLink`!) i la blacklist `deletedIds`; crida
  `processBookmarksWithClaude` (`src/services/claudeService.ts:23`) que
  envia cada ítem al backend (`/process-tweet`) per categoritzar amb IA, amb
  retry i fallback sense IA; mapeja a `Bookmark` amb `originalLink` forçat a
  twitter.com.
- Model destí: `Bookmark` a `src/types.ts` (id, title, description, author,
  categories[], externalLinks[], originalLink, createdAt, highlighted?).
- Tests existents del processament: `src/services/claudeService.test.ts`
  (vitest) — útil com a patró.

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Tests | `npm test` | tots passen (inclosos els dels parsers nous) |
| Typecheck | `npx tsc -b` | exit 0 |

## Abast

**Dins de l'abast**:
- `plans/spike-importacio-universal/DISSENY.md` (crear) — el document de disseny
- `src/services/importers/` (crear) — parsers prototip + tests (codi nou
  aïllat, no referenciat per cap codi existent)
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- Tocar `App.tsx`, `claudeService.ts` o qualsevol fitxer existent.
- UI de selecció de format.
- El pla de construcció (sortirà del disseny; el redactarà l'operador o un
  advisor amb aquest spike a la mà).

## Flux de git

- Missatge suggerit: `spike: universal import design + prototype parsers`.
- NO facis push si l'operador no t'ho ha demanat.

## Passos

### Pas 1: Investiga els formats font

Documenta a DISSENY.md l'estructura real de:
1. **HTML d'exportació de bookmarks** (Netscape Bookmark File Format — el
   que exporten Chrome/Firefox/Safari): `<DT><A HREF ADD_DATE TAGS>`,
   carpetes `<H3>` anidades (les carpetes són candidates a categories).
2. **CSV de Pocket** (export oficial: title, url, time_added, tags, status).
3. **JSON/CSV de Raindrop** (backup: title, note, excerpt, url, folder, tags,
   created).

Per a cadascun: camps disponibles → mapatge proposat a `Bookmark`, què es
perd, com es dedupliquen (la dedup actual per id de tweet no serveix: cal
deduplicar per URL normalitzada — defineix la normalització: treure
trailing slash, utm_*, fragment?).

### Pas 2: Decisions de disseny (el cor del document)

Respon explícitament, amb una recomanació i el seu perquè:
1. **Detecció de format**: per extensió + sniffing de contingut? On viu la
   taula de formats?
2. **Interfície comuna**: proposa el contracte, p. ex.
   `Importer = { detect(file): boolean; parse(file): Promise<ImportedItem[]> }`
   amb `ImportedItem` = forma intermèdia neutra (url, title, description?,
   tags?, folder?, createdAt?).
3. **Relació amb la IA**: les carpetes/tags de la font ja són categories —
   quan cal cridar `/categorize` i quan no? (proposta: només per a ítems
   sense carpeta/tag mapejable; estalvia quota i temps).
4. **Volum**: una exportació de navegador pot tenir milers d'ítems i el
   processament IA actual és seqüencial amb retry — quin límit/batching/avís
   a l'usuari?
5. **Dedup i re-importació**: com s'evita duplicar en re-importar el mateix
   fitxer (avui ho fa la blacklist d'ids de tweet)?
6. **On talla la primera versió**: recomana UN format per a la v1 (suggerit:
   HTML de navegador, el més universal) i deixa els altres per a després.

### Pas 3: Parsers prototip amb tests

Implementa a `src/services/importers/` el parser del format recomanat per a
v1 (+ un segon si surt barat) retornant `ImportedItem[]`, amb tests vitest
(patró: `src/services/claudeService.test.ts`) sobre fixtures petites
incloses al costat dels tests: cas feliç, carpetes anidades, camps que
falten, fitxer no del format (detect → false).

**Verifica**: `npm test` → passen; `npx tsc -b` → exit 0; `grep -rn
'importers' src/App.tsx src/services/claudeService.ts` → cap resultat (res
de producció els referencia).

### Pas 4: Llista de preguntes obertes

Tanca DISSENY.md amb les decisions que NOMÉS pot prendre l'operador
(p. ex. "les carpetes del navegador creen categories noves automàticament o
es mapegen a les existents?") i una estimació d'esforç del pla de construcció.

## Pla de tests

Els dels parsers del pas 3 (≥ 4 casos per parser).

## Criteris de finalització

- [ ] `plans/spike-importacio-universal/DISSENY.md` existeix i cobreix els
      6 punts del pas 2 amb recomanació cadascun
- [ ] Parser(s) prototip amb tests verds a `src/services/importers/`
- [ ] Cap fitxer de producció existent modificat (`git status`)
- [ ] `npm test` i `npx tsc -b` → exit 0
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- Necessites canviar el tipus `Bookmark` per fer quadrar el disseny — no ho
  facis; anota la proposta de canvi al document i deixa-la com a pregunta oberta.

## Notes de manteniment

- El pla de construcció que surti d'aquest spike ha de citar DISSENY.md i
  reutilitzar els parsers prototip — no es comença de zero.
