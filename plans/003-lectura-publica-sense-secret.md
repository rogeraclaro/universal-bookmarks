# Pla 003: Lectura pública sense secret (GET sense autenticació)

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- backend/ src/services/storage.ts`
> Els canvis dels plans 001 i 002 al backend són esperats. Verifica que el
> middleware d'autenticació encara s'aplica globalment (`app.use(checkAuth)`
> o equivalent) abans de continuar; si ja hi ha rutes públiques, STOP.

## Estat

- **Prioritat**: P1
- **Esforç**: S
- **Risc**: MED (canvia la visibilitat de les dades — decisió de producte ja
  presa per l'operador en aprovar aquest pla)
- **Depèn de**: plans/001-backend-sota-git.md
- **Categoria**: seguretat / direcció
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

La web pública (links.masellas.info) és de només lectura per a visitants
anònims, però per llegir els bookmarks necessita el secret d'API, que per
això viatja **dins del bundle JavaScript públic** — qualsevol visitant pot
extreure'l i amb ell també pot ESCRIURE i ESBORRAR (el mateix secret autoritza
tot). Fer públics els GET de lectura elimina la necessitat d'embeure el secret
al client web, i deixa el camí lliure perquè el pla 004 roti el secret i el
reservi només per a operacions d'escriptura. Nota: això fa les dades llegibles
per URL sense cap secret, cosa que **ja passa avui de facto** (el secret és al
bundle públic).

## Estat actual

- `backend/server.js` — el middleware s'aplica a TOTES les rutes:

```js
// backend/server.js:18-26 (commit 23d9adf; després del pla 001 pot variar de línia)
const checkAuth = (req, res, next) => {
    const secret = req.headers['x-api-secret'];
    if (secret !== API_SECRET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
};

app.use(checkAuth);
```

- Endpoints de lectura: `GET /bookmarks`, `GET /categories`, `GET /deleted`.
- Endpoints d'escriptura: `POST /bookmarks`, `POST /categories`,
  `POST /deleted`, `POST /reset` (i els que hagi afegit el backend del VPS:
  `POST /categorize`, `POST /process-tweet` — aquests criden l'API de Groq i
  costen diners: HAN DE QUEDAR PROTEGITS).
- `src/services/storage.ts:10-14` — el client web decideix si usa l'API en
  funció de si té secret:

```ts
const API_URL = import.meta.env.VITE_STORAGE_API_URL;
const API_SECRET = import.meta.env.VITE_STORAGE_SECRET;

// Strategy: Use API if Secret is configured, otherwise LocalStorage
const USE_API = !!API_SECRET;
```

i envia el secret a TOTES les peticions (`storage.ts:28-34`).

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Sintaxi backend | `node --check backend/server.js` | exit 0 |
| Tests backend | `cd backend && npm test` | tots passen |
| Typecheck web | `npx tsc -b` | exit 0 |
| Tests web | `npm test` | tots passen |
| Prova manual | `curl -s http://localhost:<PORT>/bookmarks` | `{"data":[...]}` sense capçalera de secret |
| Prova negativa | `curl -s -X POST http://localhost:<PORT>/reset` | 403 |

## Abast

**Dins de l'abast**:
- `backend/server.js` — aplicar `checkAuth` per ruta en lloc de globalment
- `backend/server.test.js` (crear, opcional si el temps ho permet) — tests
  d'integració de rutes amb `node:test` + `fetch`
- `src/services/storage.ts` — GET sense capçalera de secret; `USE_API` deixa
  de dependre del secret per a la lectura
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- Rotar o moure el secret (pla 004).
- L'extensió i el mòbil (continuen enviant el secret a tot; és innocu en GET).
- Qualsevol canvi a la semàntica replace-all (pla 005).

## Flux de git

- Missatge suggerit: `public read-only GET endpoints; web app reads without secret`.
- NO facis push si l'operador no t'ho ha demanat.

## Passos

### Pas 1: Auth per ruta al backend

Elimina `app.use(checkAuth)` i aplica `checkAuth` com a middleware només a
les rutes d'escriptura:

```js
app.get('/bookmarks', handler)                  // públic
app.post('/bookmarks', checkAuth, handler)      // protegit
```

Regla: **tots els GET de dades públics** (`/bookmarks`, `/categories`,
`/deleted`); **tots els POST protegits**, inclosos `/categorize` i
`/process-tweet` si existeixen (gasten quota d'IA).

**Verifica**: arrenca el servidor i:
- `curl -s http://localhost:<PORT>/bookmarks` → JSON amb dades (sense secret).
- `curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:<PORT>/reset` → `403`.

### Pas 2: El client web llegeix sense secret

A `src/services/storage.ts`:
- `apiRequest` accepta un paràmetre o deriva del mètode: en GET no enviï la
  capçalera `x-api-secret` i no exigeixi `API_SECRET` (elimina el
  `if (!API_SECRET) return null` per al cas GET).
- `USE_API` per a operacions de lectura ha de ser cert si hi ha `API_URL`
  definida O si l'app es serveix des del mateix origen que l'API (el cas
  actual de producció usa ruta relativa). Conserva el fallback a
  localStorage quan no hi ha cap API configurada (mode dev sense backend).
- Les operacions d'escriptura (`saveBookmarks`, `saveCategories`,
  `saveDeletedIds`, `clearData`, `clearBookmarks`) continuen exactament igual
  (amb secret) — el pla 004 les reformarà.

**Verifica**: `npx tsc -b` → exit 0; `npm test` → tots passen.

## Pla de tests

- Si crees `backend/server.test.js`: arrenca l'app en un port efímer i prova
  GET sense secret → 200, POST sense secret → 403, POST amb secret → 200.
  Patró: `node:test` com a `backend/db.test.js` (pla 002).
- Al frontend no hi ha tests de `storage.ts` (mancança coneguda); no n'hi
  afegeixis aquí — mantén el pla petit.

## Criteris de finalització

- [ ] `grep -n 'app.use(checkAuth)' backend/server.js` → cap resultat
- [ ] Cada `app.post(` a `backend/server.js` té `checkAuth` (revisió amb
      `grep -n 'app.post' backend/server.js`)
- [ ] `curl` GET sense secret → 200; `curl` POST sense secret → 403
- [ ] `npx tsc -b` → exit 0 i `npm test` → exit 0
- [ ] Cap fitxer fora de l'abast modificat (`git status`)
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- El backend recuperat al pla 001 ja té rutes públiques o un esquema d'auth
  diferent de la capçalera `x-api-secret`.
- Trobes endpoints addicionals no llistats aquí i no és obvi si són de
  lectura o d'escriptura — informa en lloc de decidir tu.
- Les dades de `db.json` contenen res que sembli privat més enllà de
  bookmarks (correus, tokens...) — la decisió "lectura pública" l'hauria de
  reconfirmar l'operador.

## Notes de manteniment

- El pla 004 (rotació del secret + login real) assumeix que la lectura ja és
  pública: després d'aquest pla, el secret només protegeix escriptures.
- Si mai s'afegeixen dades privades al model, caldrà reintroduir auth de
  lectura — anoteu-ho a la PR.
