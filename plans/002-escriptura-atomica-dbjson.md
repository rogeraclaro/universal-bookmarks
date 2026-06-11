# Pla 002: Escriptura atòmica i còpies de seguretat de db.json

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- backend/`
> El pla 001 haurà substituït `backend/server.js` per la versió del VPS:
> això és esperat. El que importa és que hi continuïn existint les funcions
> `readDB`/`writeDB` (o equivalents) amb `writeFileSync` directe. Si la
> persistència ja és atòmica, tracta-ho com a condició de STOP.

## Estat

- **Prioritat**: P1
- **Esforç**: S
- **Risc**: BAIX
- **Depèn de**: plans/001-backend-sota-git.md (DONE abans de començar)
- **Categoria**: bug
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

Tota la base de dades del producte és un únic fitxer JSON que s'escriu amb
`fs.writeFileSync` directament sobre el fitxer destí. Si el procés mor o el
disc s'omple a mig escriure, `db.json` queda truncat; aleshores
`JSON.parse` a `readDB` llança una excepció i **tots els endpoints retornen
500** fins que algú repara el fitxer a mà. No hi ha cap còpia de seguretat
automàtica. Per a una app les dades de la qual són anys de bookmarks
acumulats, això és el mode de fallada més car possible.

## Estat actual

- `backend/server.js` — servidor Express; helpers de persistència (la versió
  del commit `23d9adf`; després del pla 001 les línies poden variar, però el
  patró ha de ser el mateix):

```js
// backend/server.js:29-40
const readDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        return { bookmarks: [], categories: [], deletedIds: [] };
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
};

const writeDB = (data) => {
    const current = readDB();
    const newData = { ...current, ...data };
    fs.writeFileSync(DB_FILE, JSON.stringify(newData, null, 2));
};
```

- `DB_FILE` és `path.join(__dirname, 'db.json')` (`backend/server.js:8`).
- El backend no té cap test ni devDependencies (`backend/package.json`).
- Convenció del repo: CommonJS al backend (`require`), ESM a la resta.
  Mantén CommonJS.

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Sintaxi | `node --check backend/server.js` | exit 0 |
| Tests backend (nous) | `cd backend && npm test` | tots passen |
| Arrencada manual | `cd backend && node server.js` | `Server running on port <PORT>` |

## Abast

**Dins de l'abast**:
- `backend/db.js` (crear) — mòdul de persistència extret
- `backend/db.test.js` (crear) — tests amb `node:test`
- `backend/server.js` — substituir els helpers per imports de `db.js`
- `backend/package.json` — afegir script `test`
- `backend/.gitignore` — afegir el patró dels backups si cal
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- Els endpoints i la seva semàntica (replace-all) — els canvia el pla 005.
- L'autenticació — la canvia el pla 004.
- Migrar a una base de dades real (sqlite, etc.) — decisió de producte, no
  d'aquest pla.

## Flux de git

- Branca opcional `advisor/002-escriptura-atomica`; missatge suggerit:
  `atomic db writes with rotating backups`.
- NO facis push si l'operador no t'ho ha demanat.

## Passos

### Pas 1: Crea backend/db.js amb escriptura atòmica

Mou-hi `readDB`/`writeDB` amb aquest comportament:

- `writeDB`: serialitza a un fitxer temporal al MATEIX directori
  (`db.json.tmp`) amb `fs.writeFileSync`, i després `fs.renameSync` sobre
  `db.json` (el rename al mateix sistema de fitxers és atòmic).
- Abans de sobreescriure, si `db.json` existeix, copia'l a
  `db.json.backup-<YYYYMMDD>` (un backup per dia com a màxim: si el fitxer
  del dia ja existeix, no el sobreescriguis). Conserva només els 7 backups
  més recents (esborra els més antics).
- `readDB`: embolcalla el `JSON.parse` en try/catch. Si el parse falla:
  reanomena el fitxer corrupte a `db.json.corrupt-<timestamp>`, intenta
  llegir el backup més recent; si tampoc n'hi ha cap de vàlid, retorna
  l'estructura buida i escriu un `console.error` ben visible.

El mòdul exporta `{ readDB, writeDB }` amb les mateixes signatures que ara,
parametritzat amb la ruta del fitxer per poder testar-lo
(`createDb(filePath)` que retorna `{ readDB, writeDB }` és un patró vàlid).

**Verifica**: `node --check backend/db.js` → exit 0.

### Pas 2: Fes servir db.js des de server.js

Substitueix les definicions locals de `readDB`/`writeDB` per
`require('./db')`. No canviïs cap endpoint.

**Verifica**: `node --check backend/server.js` → exit 0, i arrencant el
servidor (`node server.js`) un `curl -s -H 'x-api-secret: <secret de .env o config>' http://localhost:<PORT>/bookmarks`
retorna `{"data":[...]}`. Atura el servidor després.

### Pas 3: Tests

Crea `backend/db.test.js` amb `node:test` (sense dependències noves) i un
directori temporal (`fs.mkdtempSync`). Casos mínims:

1. `writeDB` + `readDB` ida-i-tornada conserva les dades.
2. Després d'un `writeDB`, no queda cap `db.json.tmp` penjat.
3. Amb un `db.json` corrupte (escriu-hi `{trunca` a mà) i un backup vàlid,
   `readDB` retorna les dades del backup i el corrupte queda reanomenat.
4. Amb un `db.json` corrupte i sense backups, `readDB` retorna l'estructura
   buida sense llançar.
5. Dos `writeDB` el mateix dia generen UN sol backup d'aquell dia.

Afegeix a `backend/package.json`: `"test": "node --test"`.

**Verifica**: `cd backend && npm test` → tots els tests passen.

## Pla de tests

El del pas 3. No hi ha cap test previ al backend que serveixi de patró;
fes servir `node:test` estàndard (describe/it o test pla).

## Criteris de finalització

- [ ] `cd backend && npm test` → exit 0, ≥ 5 tests
- [ ] `grep -n 'writeFileSync(DB_FILE' backend/server.js` → cap resultat
      (tota escriptura passa per db.js)
- [ ] `grep -n 'renameSync' backend/db.js` → almenys 1 resultat
- [ ] `node --check backend/server.js` → exit 0
- [ ] Cap fitxer fora de l'abast modificat (`git status`)
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- El `backend/server.js` posterior al pla 001 ja fa escriptures atòmiques o
  usa una base de dades real (el problema ja no existeix).
- El backend recuperat al pla 001 té una estructura radicalment diferent
  (p. ex. múltiples fitxers de dades) que invalida el disseny de `db.js`.
- L'endpoint `/reset` o el flux de dades no quadra amb els extractes d'aquí.

## Notes de manteniment

- El pla 005 (API incremental) modificarà els endpoints però ha de continuar
  passant per `writeDB` — reviseu que no introdueixi cap `writeFileSync` nou.
- Els backups creixen a `backend/`; el patró `db.json.backup*` ja està al
  `.gitignore` del backend (pla 001). Verifiqueu-ho al desplegar.
- En desplegar al VPS, recordeu que el rename atòmic requereix que `tmp` i
  `db.json` siguin al mateix sistema de fitxers (ho són: mateix directori).
