# Auditoria del codi — Universal Bookmarks

- **Data**: 2026-06-11
- **Commit de referència**: `23d9adf`
- **Mètode**: auditoria completa (skill `improve`, nivell standard) de les 9
  categories sobre tot el codi font: web app (`src/`), extensió Chrome
  (`extension/`), backend (`backend/`), PWA mòbil (`mobile/`) i configs de
  desplegament. Verificacions executades: `npx tsc -b` (OK), `npm test`
  (22 tests OK), `cd extension && npm test` (17 tests OK), `npm run lint`
  (18 errors), `npm audit` (9/5/4 vulnerabilitats).
- **No auditat**: el codi del backend desplegat al VPS (no és al repo — vegeu
  troballa #3); la configuració real de nginx/process manager del VPS.

---

## Taula de troballes

### Problemes

| # | Troballa | Categoria | Impacte | Esforç | Risc del fix | Confiança | Evidència | Pla |
|---|----------|-----------|---------|--------|--------------|-----------|-----------|-----|
| 1 | **Secret d'API compromès**: hardcodejat al codi commitejat (GitHub) i embegut als bundles de web pública, extensió i mòbil. Qui el tregui del bundle pot llegir, sobreescriure o esborrar tota la BD (`/reset`). Cal rotar-lo i deixar d'embeure'l al client | Seguretat | CRÍTIC | M | MED | ALTA | `extension/shared/config.ts:4-7`, `src/services/claudeService.ts:59`, `backend/server.js:11` | [004](004-rotar-secret-i-auth-real.md) |
| 2 | **Pèrdua de dades per «replace-all»**: cada desat fa GET de tot + POST de tot. Una pestanya web amb dades antigues que desi un canvi sobreescriu silenciosament tot el que l'extensió hagi guardat des de llavors | Correctesa | ALT | M–L | MED | ALTA | `extension/shared/api.ts:49-63`, `src/App.tsx:372-374`, `backend/server.js:49-53` | [005](005-api-incremental-anti-perdua.md) |
| 3 | **Backend fora de git**: el `.gitignore` ignora `backend/` sencer, i el desplegat al VPS ha divergit (els endpoints `/categorize` i `/process-tweet` que criden els clients no existeixen al `server.js` local; nginx apunta al 3002, el local escolta al 3003). Si el VPS cau, es perd el backend d'IA | Arquitectura | ALT | S | BAIX | ALTA | `.gitignore:12`, `extension/shared/api.ts:109`, `nginx-config.conf:33`, `backend/server.js:7` | [001](001-backend-sota-git.md) |
| 4 | **Esborrar l'últim bookmark no es persisteix**: la condició `length > 0` impedeix desar la llista buida; el bookmark reapareix en recarregar | Correctesa | MED | S | BAIX | ALTA | `src/App.tsx:372-378` | [006](006-persistir-esborrat-ultim-bookmark.md) |
| 5 | **Escriptura no atòmica de db.json**: un tall a mig `writeFileSync` corromp el fitxer i tota l'API peta fins a reparació manual; no hi ha còpies de seguretat automàtiques | Correctesa | MED | S | BAIX | ALTA | `backend/server.js:29-40` | [002](002-escriptura-atomica-dbjson.md) |
| 6 | **Login decoratiu**: hash comparat al client + cookie `session=valid` creable des de DevTools. La solució real va lligada al #1 (auth al servidor) | Seguretat | MED | M | MED | ALTA | `src/App.tsx:20,197,297-313` | [004](004-rotar-secret-i-auth-real.md) |
| 7 | **`new URL()` pot tombar l'app**: `externalLinks` és editable sense validació; un valor no-URL fa petar el render sencer (no hi ha error boundary) | Correctesa | MED | S | BAIX | ALTA | `src/App.tsx:175,1614-1627` | [007](007-urls-invalides-i-error-boundary.md) |
| 8 | **Client API triplicat**: tres implementacions paral·leles (web/extensió/mòbil), amb `mobile/` important fitxers de dins d'`extension/` per camí relatiu i funcions quasi idèntiques duplicades | Deute tècnic | MED | M | MED | ALTA | `src/services/storage.ts`, `extension/shared/api.ts:102-120`, `mobile/src/api.ts:1-22` | [008](008-unificar-client-api.md) |
| 9 | **Codi mort**: ~230 línies comentades («REMOVED») dins d'un App.tsx de 1.813 línies | Deute tècnic | BAIX | S | BAIX | ALTA | `src/App.tsx:705-923` | [009](009-codi-mort-apptsx.md) |
| 10 | **Lint trencat (18 errors) i sense CI**: `npm run lint` falla; no hi ha `.env.example` ni cap comprovació automàtica abans de desplegar | DX | BAIX | S | BAIX | ALTA | sortida `npm run lint` | [010](010-lint-net-ci-envexample.md) |
| 11 | **Vulnerabilitats npm**: 9 root / 5 extensió / 4 mòbil (algunes high), concentrades en tooling de dev (vite, yaml), no en codi de runtime | Dependències | BAIX | S | BAIX | MED | sortida `npm audit` | [011](011-vulnerabilitats-npm.md) |

### Menors

| # | Troballa | Nota de l'auditoria | Pla |
|---|----------|---------------------|-----|
| 12 | Content script estàtic a `<all_urls>` | La verificació en profunditat va revelar que NO és simplement redundant: `handleBulkCategorize` en depèn per llegir pestanyes en segon pla. Convertit en pla de decisió amb les dues opcions vàlides | [012](012-decisio-content-script-allurls.md) |
| 13 | Desat massiu: N pestanyes = N × (GET+POST de tota la BD) | El fix és el mateix protocol incremental del #2; absorbit pel pla 005 | [005](005-api-incremental-anti-perdua.md) |

### Direcció (opcions de producte, no errors)

| # | Proposta | Evidència al codi | Trade-off | Pla |
|---|----------|-------------------|-----------|-----|
| 14 | **Importació realment «universal»**: HTML de bookmarks del navegador, CSV de Pocket/Raindrop — ara només JSON de Twitter, amb `originalLink` forçat a `twitter.com/i/web/status/` | `src/App.tsx:541,628-637` | Esforç M–L; primer un spike de disseny | [013](013-spike-importacio-universal.md) |
| 15 | **Consolidar el frontend mòbil**: `mobile/` duplica el flux de desat de l'app principal, que ja és responsive | `mobile/src/App.tsx` (281 línies); duplicació del #8 | Perds la PWA instal·lable si no la substitueixes per un manifest a l'app principal | [014](014-decisio-consolidar-mobil.md) |
| 16 | **Lectura pública sense secret**: la vista pública és només-lectura; GETs sense auth eliminen el secret del bundle web i simplifiquen el #1 | `backend/server.js:26`, `src/services/storage.ts:10-14` | Dades llegibles per URL (ja ho són de facto via bundle) | [003](003-lectura-publica-sense-secret.md) |

---

## Ordre d'execució

L'ordre recomanat, amb el perquè (l'estat viu és a [`README.md`](README.md)):

| Ordre | Pla | Per què aquí |
|-------|-----|--------------|
| 1 | **001** Backend sota git | Prerequisit de tot el que toca backend (002–005). Sense ell, treballaríeu sobre un `server.js` desfasat. Requereix accés SSH al VPS. |
| 2 | **002** Escriptura atòmica db.json | Petit, elimina el risc de corrupció abans que els plans següents toquin més el backend. |
| 3 | **003** Lectura pública | Desbloqueja el 004 (treure el secret del bundle web exigeix lectura sense secret). |
| 4 | **004** Rotar secret + auth real | La troballa crítica. Inclou un pas operatiu manual (variables d'entorn al VPS). |
| 5 | **005** API incremental | El canvi més gran. Millor amb l'auth ja estabilitzada (004). Resol també #4 i #13 de retruc. |
| 6 | **006** Esborrat últim bookmark | NOMÉS si el 005 encara no s'ha fet (si 005 és DONE, es marca REJECTED — el pla mateix ho comprova). |
| 7 | **007** URLs invàlides + error boundary | Independent; en qualsevol moment a partir d'aquí. |
| 8 | **010** Lint + CI + .env.example | Com més tard, menys errors de lint vius; però si voleu CI des d'ara, es pot avançar. |
| 9 | **008** Unificar client API | Consolida la forma FINAL de l'API (després de 004 i 005). |
| 10 | **009** Codi mort App.tsx | Després de 005/006/007 per no generar conflictes a App.tsx. |
| 11 | **011** Vulnerabilitats npm | Independent, qualsevol moment. |
| 12 | **012** Content script | Independent; requereix prova manual amb Chrome. |
| 13 | **013** Spike importació universal | Direcció; millor amb l'API final (005) com a base de disseny. |
| 14 | **014** Decisió frontend mòbil | Direcció; llegiu primer l'estat de 004/008 (input de la decisió). |

**Camí mínim si només feu una tanda**: 001 → 002 → 003 → 004 → 005 (les
cinc P1: protegeixen les dades i el secret; la resta pot esperar).

---

## Prompts per iniciar cada pla

Copia el prompt al Claude Code (o l'agent executor que sigui) des de l'arrel
del repo. Tots segueixen el mateix patró: el pla és autocontingut, l'executor
no necessita cap altre context.

> **Patró general** (substitueix `NNN-slug`):
> ```
> Llegeix plans/NNN-slug.md sencer i executa'l pas a pas. Respecta les
> condicions de STOP del pla (atura't i informa en lloc d'improvisar),
> executa cada comanda de verificació, i en acabar actualitza la fila del
> pla a plans/README.md i fes-me un resum de què has fet i què queda.
> ```

Prompts concrets, en ordre d'execució:

1. **Pla 001** — *(necessita accés SSH al VPS configurat a la màquina)*
   ```
   Llegeix plans/001-backend-sota-git.md sencer i executa'l pas a pas. Tinc accés SSH al VPS configurat. Respecta les condicions de STOP, verifica cada pas, actualitza plans/README.md en acabar i resumeix-me el resultat. MOLT IMPORTANT: cap secret ni fitxer de dades (db.json, .env) pot acabar commitejat.
   ```

2. **Pla 002**
   ```
   Llegeix plans/002-escriptura-atomica-dbjson.md sencer i executa'l pas a pas. Comprova primer a plans/README.md que el pla 001 és DONE; si no ho és, atura't. Respecta les condicions de STOP, verifica cada pas i actualitza plans/README.md en acabar.
   ```

3. **Pla 003**
   ```
   Llegeix plans/003-lectura-publica-sense-secret.md sencer i executa'l pas a pas. Comprova primer que el pla 001 és DONE a plans/README.md. Respecta les condicions de STOP, verifica cada pas i actualitza plans/README.md en acabar.
   ```

4. **Pla 004** — *(inclou un pas operatiu manual que el pla et demanarà coordinar amb mi)*
   ```
   Llegeix plans/004-rotar-secret-i-auth-real.md sencer i executa'l pas a pas. Comprova primer que els plans 001 i 003 són DONE a plans/README.md. REGLA ABSOLUTA: cap valor de secret (antic o nou) pot aparèixer en cap fitxer trackejat ni missatge de commit. Quan arribis al pas de rotació operativa, dona'm les instruccions i espera'm. Actualitza plans/README.md en acabar.
   ```

5. **Pla 005**
   ```
   Llegeix plans/005-api-incremental-anti-perdua.md sencer i executa'l pas a pas en una branca advisor/005-api-incremental. Comprova primer que 001 i 002 són DONE (i idealment 004) a plans/README.md. És el pla més gran: fes un commit per pas. Respecta les condicions de STOP, executa la prova d'integració del pas 4 i actualitza plans/README.md en acabar.
   ```

6. **Pla 006**
   ```
   Llegeix plans/006-persistir-esborrat-ultim-bookmark.md sencer i executa'l. ATENCIÓ: el pla comença comprovant si el 005 és DONE — si ho és, marca aquest pla com a REJECTED i atura't, tal com indica. La prova manual del pas 2 no és opcional. Actualitza plans/README.md en acabar.
   ```

7. **Pla 007**
   ```
   Llegeix plans/007-urls-invalides-i-error-boundary.md sencer i executa'l pas a pas. Respecta les condicions de STOP, fes la prova manual del pas 3 i actualitza plans/README.md en acabar.
   ```

8. **Pla 010**
   ```
   Llegeix plans/010-lint-net-ci-envexample.md sencer i executa'l pas a pas. Recorda: a .env.example només noms de variables, mai valors; màxim 3 eslint-disable amb motiu. Actualitza plans/README.md en acabar.
   ```

9. **Pla 008**
   ```
   Llegeix plans/008-unificar-client-api.md sencer i executa'l pas a pas en una branca advisor/008-client-api-unic, amb un commit per consumidor migrat. Comprova primer que 004 i 005 són DONE a plans/README.md; si no, atura't. Actualitza plans/README.md en acabar.
   ```

10. **Pla 009**
    ```
    Llegeix plans/009-codi-mort-apptsx.md sencer i executa'l. Només pots esborrar línies comentades: revisa el diff línia a línia abans de commitejar. Actualitza plans/README.md en acabar.
    ```

11. **Pla 011**
    ```
    Llegeix plans/011-vulnerabilitats-npm.md sencer i executa'l: npm audit fix (MAI --force) als quatre paquets, amb la verificació completa de cada paquet després de cada fix, i informe final del que queda. Actualitza plans/README.md en acabar.
    ```

12. **Pla 012** — *(necessita Chrome per a la prova manual)*
    ```
    Llegeix plans/012-decisio-content-script-allurls.md sencer. Llegeix sobretot la secció "Per què és delicat" abans de tocar res. Aplica la regla de decisió del pla (opció B per defecte) i fes la prova manual del pas 3 — sense la prova, no commitegis. Actualitza plans/README.md en acabar.
    ```

13. **Pla 013** — *(spike: només disseny + prototips, res a producció)*
    ```
    Llegeix plans/013-spike-importacio-universal.md sencer i executa'l. És un spike: el lliurable és plans/spike-importacio-universal/DISSENY.md més parsers prototip amb tests a src/services/importers/. NO toquis cap fitxer de producció existent. Actualitza plans/README.md en acabar.
    ```

14. **Pla 014** — *(anàlisi: s'atura abans d'implementar res)*
    ```
    Llegeix plans/014-decisio-consolidar-mobil.md sencer i executa la fase d'anàlisi: inventari funcional real de mobile/ i el document plans/decisio-mobil/RECOMANACIO.md amb les 3 opcions i la teva recomanació. ATURA'T al pas 3 i presenta-m'ho — no implementis cap opció sense que jo triï. Actualitza plans/README.md en acabar.
    ```
