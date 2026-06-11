# Pla 004: Rotar el secret d'API i substituir el login decoratiu per auth real

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **REGLA ABSOLUTA**: cap valor de secret (ni l'antic ni el nou) pot aparèixer
> en cap fitxer trackejat per git, ni en aquest pla, ni en missatges de commit.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- backend/ src/ extension/shared/`
> Els canvis dels plans 001–003 són esperats. Confirma que el secret encara és
> hardcodejat a `extension/shared/config.ts` i que `src/App.tsx` encara té la
> constant `ADMIN_HASH` abans de continuar.

## Estat

- **Prioritat**: P1
- **Esforç**: M
- **Risc**: MED (toca auth de 3 clients i el desplegament; un error deixa
  l'usuari sense poder escriure fins a corregir-ho)
- **Depèn de**: plans/001-backend-sota-git.md, plans/003-lectura-publica-sense-secret.md
- **Categoria**: seguretat
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

El secret d'API que autoritza **tota** escriptura (incloent-hi esborrar la BD
sencera via `POST /reset`) està: (a) commitejat en text pla al repo i pujat a
GitHub, (b) embegut al bundle de la web pública, (c) embegut a l'extensió i
al mòbil. Aquest secret està **cremat**: és a l'historial de git i a bundles
distribuïts; cap neteja de codi el recupera — cal rotar-lo. A més, el "login"
de la web és decoratiu: compara un hash al client (`ADMIN_HASH` a
`src/App.tsx:20`) i posa una cookie `session=valid` que qualsevol pot crear
des de DevTools. Aquest pla rota el secret, el treu de tot codi font, i fa que
el login de la web sigui una verificació real al servidor.

## Estat actual

- `extension/shared/config.ts:1-9` — secret hardcodejat (compartit per
  extensió i mòbil, que importa aquest mateix fitxer):

```ts
export const API_CONFIG = {
  BASE_URL: 'https://links.masellas.info/api',
  SECRET: '<REDACTAT — valor hex de 32 caràcters>',
  HEADERS: {
    'Content-Type': 'application/json',
    'x-api-secret': '<REDACTAT — el mateix valor>'
  }
};
```

- `src/services/claudeService.ts:59` — el mateix secret hardcodejat en una
  capçalera `'x-api-secret'` dins de `processBookmarksWithClaude`.
- `src/services/storage.ts:11` — la web l'obté de `VITE_STORAGE_SECRET`
  (fitxer `.env`, no commitejat) però Vite **l'incrusta al bundle públic** en
  fer build.
- `src/App.tsx:20` — `const ADMIN_HASH = '<REDACTAT — hex de 64 caràcters>'`;
  `handleLogin` (`src/App.tsx:297-313`) calcula SHA-256 de `usuari:password`
  al client i posa `setCookie('session', 'valid', 120)`. `isLoggedIn` només
  controla quins botons es renderitzen.
- `backend/server.js:11` — `const API_SECRET = '<REDACTAT>'` (després del
  pla 001 pot ser que ja vingui del VPS amb una altra forma).
- Després del pla 003, els GET són públics: el secret només cal per escriure.

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Generar secret nou | `openssl rand -hex 32` | cadena nova (NO la guardis a git) |
| Typecheck web | `npx tsc -b` | exit 0 |
| Tests web | `npm test` | tots passen |
| Tests backend | `cd backend && npm test` | tots passen |
| Build extensió | `cd extension && npm run build` | exit 0 |
| Cerca de secrets | `git grep -E '[a-f0-9]{32}' -- ':!package-lock.json' ':!*/package-lock.json' ':!plans'` | cap secret real |

## Abast

**Dins de l'abast**:
- `backend/server.js` — secret des de `process.env.API_SECRET`; endpoint nou
  `POST /login`
- `backend/.env.example` (crear) — només NOMS de variables
- `src/App.tsx` — eliminar `ADMIN_HASH` i el hash client; login contra el servidor
- `src/services/storage.ts` — escriptures amb el token de sessió, no el secret de build
- `src/services/claudeService.ts` — eliminar el secret hardcodejat
- `extension/shared/config.ts` i `extension/shared/api.ts` — secret des de
  `chrome.storage` (pàgina d'opcions) en lloc de hardcodejat
- `extension/options/` (crear) + `extension/manifest.json` — pàgina d'opcions
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- Reescriure l'historial de git per purgar el secret antic (la rotació el deixa inservible).
- `mobile/` — quedarà temporalment sense poder escriure si llegia el secret
  de `config.ts`; anota-ho com a deute al README del pla. El pla 014 decideix
  el futur del mòbil.
- Multiusuari, registre, recuperació de contrasenya — això és una app d'un sol usuari.

## Flux de git

- Missatge suggerit: `rotate API secret; server-side login; secret out of source`.
- NO facis push si l'operador no t'ho ha demanat.

## Passos

### Pas 1: Backend — secret per entorn i POST /login

1. `API_SECRET` passa a `process.env.API_SECRET` (sense valor per defecte;
   si falta, el servidor surt amb un error clar a l'arrencada).
2. Afegeix `ADMIN_USER` i `ADMIN_PASS_HASH` (SHA-256 hex de la contrasenya)
   també per entorn.
3. Endpoint nou `POST /login` (públic): rep `{ user, pass }`, calcula el
   SHA-256 de `pass` (mòdul `crypto` natiu), compara amb
   `ADMIN_PASS_HASH` i el `user` amb `ADMIN_USER`; si encaixa retorna
   `{ token: API_SECRET }`; si no, 401. (Disseny mínim per a un sol usuari:
   el "token" és el mateix secret d'escriptura, que així ja no s'ha
   d'embeure en cap bundle.)
4. Crea `backend/.env.example` amb els tres noms de variable i comentaris,
   sense cap valor real.

**Verifica**: `node --check backend/server.js` → exit 0;
`API_SECRET=test ADMIN_USER=a ADMIN_PASS_HASH=<sha256 de "b">` + arrencar i
`curl -s -X POST localhost:<PORT>/login -H 'Content-Type: application/json' -d '{"user":"a","pass":"b"}'`
→ `{"token":"test"}`; amb pass incorrecte → 401.

### Pas 2: Web — login real i secret fora del bundle

A `src/App.tsx`:
1. Elimina `ADMIN_HASH` (línia 20) i el càlcul de hash de `handleLogin`
   (línies 297-313). `handleLogin` ara fa `POST /login` i, si rep token,
   el desa amb `sessionStorage.setItem('writeToken', token)` i manté la
   cookie `session=valid` només com a indicador d'UI (renovació d'activitat
   ja existent, línies 276-295 — no la toquis).
2. `handleLogout` esborra també el `writeToken`.

A `src/services/storage.ts`:
3. Les peticions d'escriptura llegeixen el token de
   `sessionStorage.getItem('writeToken')` i l'envien com a `x-api-secret`.
   Elimina l'ús de `VITE_STORAGE_SECRET` (i la línia 11). `USE_API` per a
   escriptures = hi ha token.

A `src/services/claudeService.ts`:
4. Substitueix el literal de la capçalera (línia 59) pel mateix token de
   sessió. Si no hi ha token, la funció ha de fallar amb un missatge clar
   (només s'usa des de la importació, que és funció d'admin).

**Verifica**: `npx tsc -b` → exit 0; `npm test` → tots passen;
`grep -rn 'VITE_STORAGE_SECRET\|ADMIN_HASH' src/` → cap resultat.

### Pas 3: Extensió — secret configurable, no compilat

1. `extension/shared/config.ts`: elimina `SECRET` i la capçalera amb el
   valor; exporta `BASE_URL` i una funció `getSecret(): Promise<string>` que
   llegeix `chrome.storage.local.get('apiSecret')`.
2. `extension/shared/api.ts`: `apiRequest` i `callClaudeProxy` construeixen
   les capçaleres amb `await getSecret()`. Si no hi ha secret configurat,
   llança un error amb el text "Configura el secret a les opcions de
   l'extensió".
3. Pàgina d'opcions mínima (`extension/options/index.html` + `options.ts`):
   un input + botó que desa a `chrome.storage.local`. Registra-la al
   manifest amb `"options_page": "options/index.html"` i afegeix l'entrada
   corresponent al build de Vite (mira com `popup/index.html` és una entrada
   a `extension/vite.config.ts` i replica-ho).

**Verifica**: `cd extension && npm test` → passen; `npm run build` → exit 0;
`grep -rEn '[a-f0-9]{32}' extension/shared/ extension/options/` → cap resultat.

### Pas 4: Rotació operativa (coordinada amb l'operador)

1. Genera el secret nou: `openssl rand -hex 32` (no el guardis enlloc del repo).
2. Informa l'operador que cal: posar `API_SECRET`, `ADMIN_USER` i
   `ADMIN_PASS_HASH` a l'entorn del backend al VPS, reiniciar-lo, configurar
   el secret nou a la pàgina d'opcions de l'extensió recarregada, i fer
   login de nou a la web. **Aquest pas el fa l'operador**; tu deixa les
   instruccions exactes a `backend/README.md`.

**Verifica**: `git grep -E '[a-f0-9]{32}' -- ':!package-lock.json' ':!*/package-lock.json' ':!plans'`
→ cap coincidència que sigui un secret (poden quedar hashos legítims
d'altres coses; revisa cada resultat).

## Pla de tests

- Backend: afegeix a `backend/server.test.js` (o crea'l seguint el patró de
  `backend/db.test.js`): login correcte → token; login incorrecte → 401;
  escriptura amb token → 200; escriptura sense → 403.
- Web: no hi ha infraestructura de tests d'App.tsx; no en muntis aquí.
- Extensió: els tests existents (`extension/tests/*.test.ts`) no toquen
  l'API real; si algun mockeja `API_CONFIG.HEADERS`, adapta el mock.

## Criteris de finalització

- [ ] `git grep -nE '[a-f0-9]{32}'` sense cap secret real en codi font
- [ ] `grep -n 'ADMIN_HASH' src/App.tsx` → cap resultat
- [ ] `npx tsc -b` → exit 0; `npm test` → exit 0
- [ ] `cd extension && npm run build` → exit 0; `npm test` → exit 0
- [ ] `cd backend && npm test` → exit 0
- [ ] `backend/.env.example` existeix amb noms i cap valor
- [ ] Instruccions de rotació escrites a `backend/README.md`
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- El backend recuperat (pla 001) ja té un mecanisme d'auth diferent — informa
  abans de superposar-n'hi un altre.
- El pla 003 no està DONE (sense lectura pública, treure el secret del bundle
  web trenca la vista pública).
- No pots fer funcionar l'entrada d'opcions al build de Vite de l'extensió
  després de dos intents — informa amb l'error exacte.
- Qualsevol dubte sobre on guardar el secret nou: NO el guardis; pregunta.

## Notes de manteniment

- El "token" és estàtic (el secret d'escriptura). Si mai cal caducitat o
  multiusuari, substituïu `/login` per sessions firmades — el client ja està
  preparat perquè només coneix "un token opac".
- El mòbil queda sense escriptura fins que el pla 014 decideixi el seu futur.
- Reviseu en PR: que cap `console.log` ni cap test fixture contingui el
  secret nou.
