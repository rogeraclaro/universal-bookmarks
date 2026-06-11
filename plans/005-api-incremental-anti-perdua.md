# Pla 005: API incremental — eliminar la pèrdua de dades del protocol replace-all

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- backend/ src/ extension/`
> Els canvis dels plans 001–004 són esperats. Confirma que `saveBookmark` a
> `extension/shared/api.ts` encara fa GET de tot + POST de tot, i que
> `src/App.tsx` encara desa l'array sencer en un `useEffect` sobre
> `bookmarks`, abans de continuar.

## Estat

- **Prioritat**: P1
- **Esforç**: L
- **Risc**: MED (toca el protocol de dades de tots els clients; es mitiga
  mantenint els endpoints antics durant la transició)
- **Depèn de**: plans/001-backend-sota-git.md, plans/002-escriptura-atomica-dbjson.md
  (recomanat també després de 004 per no refer la capa d'auth dues vegades)
- **Categoria**: bug (pèrdua de dades) + perf
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

Tot el protocol de persistència és "llegeix-ho tot, reescriu-ho tot":

1. **Pèrdua silenciosa de dades**: la web carrega tots els bookmarks en
   memòria en obrir-se i, a cada canvi, POSTa l'array sencer. Si deixes una
   pestanya oberta dilluns i divendres hi edites un bookmark, **sobreescrius
   tot el que l'extensió hagi desat durant la setmana**. Dos clients
   concurrents = l'últim a desar esborra els canvis de l'altre.
2. **Rendiment**: desar N pestanyes des de l'extensió fa N × (GET de tota la
   BD + POST de tota la BD), seqüencialment. Amb una BD gran això es nota
   (el backend admet bodies de 50 MB, símptoma del problema).

La solució: endpoints per operació (afegir, actualitzar, esborrar) on el
servidor fa la fusió, i clients que mai reescriuen allò que no han tocat.

## Estat actual

- `backend/server.js` — endpoints replace-all (la versió del VPS després del
  pla 001; el patró al commit `23d9adf` és):

```js
// backend/server.js:49-53
app.post('/bookmarks', (req, res) => {
    const { data } = req.body;
    writeDB({ bookmarks: data });   // substitueix TOT l'array
    res.json({ success: true });
});
```

- `extension/shared/api.ts:49-63` — `saveBookmark` fa el GET-all + POST-all:

```ts
export async function saveBookmark(bookmark: Bookmark): Promise<void> {
  ...
    const existingBookmarks = await getBookmarks();
    const allBookmarks = [...existingBookmarks, bookmark];
    await apiRequest<APISaveResponse>('bookmarks', 'POST', { data: allBookmarks });
  ...
}
```

  i `saveCategory` (línies 78-99) fa el mateix amb categories. El bucle de
  desat massiu és a `extension/popup/popup.tsx:405-448` (`handleBulkSave`),
  que crida `SAVE_BOOKMARK` per pestanya via `chrome.runtime.sendMessage`
  (gestor a `extension/background/service-worker.ts:44-55`).

- `src/App.tsx:372-382` — la web persisteix l'estat sencer a cada canvi:

```tsx
useEffect(() => {
    if (bookmarks.length > 0) storage.saveBookmarks(bookmarks)
}, [bookmarks])

useEffect(() => {
    if (categories.length > 0) storage.saveCategories(categories)
}, [categories])

useEffect(() => {
    storage.saveDeletedIds(deletedIds)
}, [deletedIds])
```

- `src/services/storage.ts` — embolcall de l'API per a la web
  (`saveBookmarks(bookmarks: Bookmark[])` POSTa l'array sencer).
- Identificadors: cada bookmark té un camp `id` únic generat al client
  (p. ex. `ext_<timestamp>_<aleatori>` a `popup.tsx:311`). Les categories són
  strings simples; `deletedIds` és un array de strings.
- Mutacions a la web (App.tsx): afegir/editar (`saveBookmark`, línia 689),
  esborrar (`confirmDelete`, línia 659), destacar (`handleToggleHighlight`,
  línia 1026), migració al carregar (línia 335-353), importació massiva
  (`processTweetsData`, línia 447), restauració de backup
  (`handleFileUpload`, línia 588-626), reset (`handleResetData`, línia 431),
  i CRUD de categories (línies 925-994).

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Tests backend | `cd backend && npm test` | tots passen |
| Typecheck web | `npx tsc -b` | exit 0 |
| Tests web | `npm test` | tots passen |
| Tests + build extensió | `cd extension && npm test && npm run build` | exit 0 |

## Abast

**Dins de l'abast**:
- `backend/server.js` (+ `backend/server.test.js`) — endpoints nous
- `extension/shared/api.ts` — `saveBookmark`/`saveCategory` incrementals
- `extension/shared/types.ts` — tipus de resposta nous si calen
- `src/services/storage.ts` — mètodes per operació
- `src/App.tsx` — substituir els `useEffect` de desat global per crides per operació
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- Unificar els clients API en un sol mòdul (pla 008 — fes els canvis en
  paral·lel als dos clients existents).
- L'arrel del bug "esborrar l'últim bookmark" (pla 006) — aquest pla el
  resol de retruc en eliminar els useEffect, però NO l'implementis si el
  pla 006 ja està DONE d'una altra manera; coordina-ho amb l'índex.
- Resolució de conflictes camp a camp (CRDT, versions) — sobredisseny per a
  un sol usuari amb 3 clients.
- `mobile/` (pla 014).

## Flux de git

- Branca recomanada: `advisor/005-api-incremental` (canvi gran; commits per pas).
- NO facis push si l'operador no t'ho ha demanat.

## Passos

### Pas 1: Endpoints incrementals al backend (additius, sense trencar res)

Afegeix, mantenint els existents:

- `POST /bookmarks/add` — body `{ data: Bookmark | Bookmark[] }`; afegeix
  els que no existeixin (per `id`); retorna `{ success, added, skipped }`.
- `PUT /bookmarks/:id` — body `{ data: Bookmark }`; substitueix el bookmark
  amb aquell `id`; 404 si no existeix.
- `DELETE /bookmarks/:id` — esborra'l; accepta query `?blacklist=<originalId>`
  per afegir alhora l'id original a `deletedIds`; 404 si no existeix.
- `POST /categories/add` — body `{ data: string }`; afegeix si no existeix
  (case-insensitive, com fa avui `saveCategory` al client); retorna la llista
  completa.
- `DELETE /categories/:name` — esborra la categoria (el reassignament de
  bookmarks el continua fent el client com fins ara via PUT per bookmark; si
  això genera massa crides, vegeu STOP).

Tots protegits amb la mateixa auth que la resta d'escriptures (després del
pla 004, `checkAuth`). Tota escriptura passa per `writeDB` (pla 002).
El replace-all `POST /bookmarks` es manté NOMÉS per a importació/restauració.

**Verifica**: `cd backend && npm test` → passen els tests nous (vegeu pla de
tests) i els antics.

### Pas 2: Extensió — desar sense reescriure

- `extension/shared/api.ts`: `saveBookmark` passa a una única crida
  `POST /bookmarks/add`; elimina el GET previ. `saveCategory` passa a
  `POST /categories/add` (el servidor ja fa la comprovació case-insensitive;
  elimina-la del client o deixa-la com a curtcircuit local, però la font de
  veritat és el servidor).
- `isDuplicate` pot continuar com està (GET + cerca local) — és lectura.

**Verifica**: `cd extension && npm test && npm run build` → exit 0. Revisa
que `grep -n 'getBookmarks()' extension/shared/api.ts` ja no aparegui dins
de `saveBookmark`.

### Pas 3: Web — operacions explícites en lloc de sincronització total

1. A `src/services/storage.ts` afegeix: `addBookmarks(items)`,
   `updateBookmark(item)`, `deleteBookmark(id, blacklistId?)`,
   `addCategory(name)`, `deleteCategory(name)` mapejats als endpoints nous.
   Conserva `saveBookmarks` (array sencer) NOMÉS per a la restauració de
   backups i la migració, i el fallback localStorage de cada mètode nou.
2. A `src/App.tsx`:
   - **Elimina els tres `useEffect` de desat** (línies 372-382).
   - `saveBookmark` (línia 689): si `newBookmarkMode` → `storage.addBookmarks`;
     si edició → `storage.updateBookmark`.
   - `confirmDelete` (línia 659): `storage.deleteBookmark(id, originalId)`.
   - `handleToggleHighlight` (línia 1026): `storage.updateBookmark` del
     bookmark canviat.
   - `processTweetsData` (línia 546-548): substitueix el `saveBookmarks`
     de l'array complet per `storage.addBookmarks(newItems)`.
   - Restauració de backup (línia 588-626): pot continuar usant el
     replace-all (és l'únic cas legítim de "reescriu-ho tot"), però fes la
     fusió com ara i deixa-hi un comentari dient que és intencionat.
   - CRUD de categories (línies 925-957) i el reordenament per drag&drop
     (línies 969-989): afegir → `addCategory`; esborrar → `deleteCategory` +
     `updateBookmark` per cada bookmark reassignat; el reordenament és
     l'únic cas que encara necessita `saveCategories` (array sencer) — el
     backend el manté.
   - Gestiona errors: cada operació que falli ha de mostrar el modal de
     resultat amb el missatge d'error (patró existent: `setResultModal`).

**Verifica**: `npx tsc -b` → exit 0; `npm test` → tots passen;
`grep -n 'useEffect' src/App.tsx | head -20` no mostra cap efecte que
cridi `storage.saveBookmarks`.

### Pas 4: Prova d'integració manual del escenari de pèrdua

Amb el backend local arrencat i la web en dev (`npm run dev`):
1. Obre la web, fes login.
2. Amb `curl`, afegeix un bookmark via `POST /bookmarks/add` (simula l'extensió).
3. A la web (SENSE recarregar), destaca un bookmark qualsevol.
4. `curl GET /bookmarks` → **el bookmark del pas 2 encara hi és**.

**Verifica**: el pas 4. Abans d'aquest pla, el pas 3 l'hauria esborrat.

## Pla de tests

- `backend/server.test.js` (patró: `backend/db.test.js` del pla 002, aixecant
  l'app en port efímer): add (nou / duplicat), put (existent / 404), delete
  (existent / 404 / amb blacklist), categories add case-insensitive, i el
  test de regressió clau: **add concurrent amb un replace antic no es perd
  si el replace va abans**; documenta amb un test que el replace-all DESPRÉS
  d'un add sí que el sobreescriu (comportament conegut, reservat a backups).
- Extensió: adapta els mocks dels tests existents si fingien `saveBookmark`
  (vegeu `extension/tests/tabs-save.test.ts` com a patró d'estructura).

## Criteris de finalització

- [ ] `cd backend && npm test` → exit 0 amb els casos nous
- [ ] `npx tsc -b` i `npm test` → exit 0
- [ ] `cd extension && npm test && npm run build` → exit 0
- [ ] A `src/App.tsx` no queda cap `useEffect` que persisteixi `bookmarks`,
      `categories` o `deletedIds` sencers
- [ ] `saveBookmark` de l'extensió fa exactament 1 petició HTTP
- [ ] L'escenari del pas 4 passa
- [ ] Cap fitxer fora de l'abast modificat (`git status`)
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- El backend del VPS (pla 001) té una forma molt diferent de l'extracte
  (p. ex. ja té endpoints per ítem) — informa i replanteja.
- L'esborrat de categoria implica actualitzar molts bookmarks i fer-ho amb
  PUTs individuals resulta inacceptablement lent — informa proposant un
  endpoint batch en lloc d'implementar-lo pel teu compte.
- Els tests de l'extensió depenen del comportament GET-all+POST-all de
  manera que no pots adaptar sense reescriure'ls sencers.
- El pla 006 figura DONE a l'índex amb una solució que xoca amb eliminar els
  `useEffect` — coordina-ho abans de tocar App.tsx.

## Notes de manteniment

- El replace-all queda viu només per a backups: qualsevol crida nova a
  `POST /bookmarks` (sense `/add`) en codi de client és sospitosa en review.
- El pla 008 (client API unificat) ha de partir de la forma d'API d'aquest pla.
- Si mai hi ha multiusuari real, caldrà optimistic locking (camp `version`);
  el disseny actual assumeix un únic escriptor humà.
