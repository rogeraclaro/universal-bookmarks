# Pla 008: Unificar els tres clients d'API en un sol mòdul compartit

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- src/services/ extension/shared/ mobile/src/`
> Els plans 003, 004 i 005 hauran canviat aquests fitxers — és esperat i és
> precisament la forma final que aquest pla consolida. Llegeix les versions
> actuals senceres abans de moure res.

## Estat

- **Prioritat**: P2
- **Esforç**: M
- **Risc**: MED (toca tres builds; es mitiga fent-ho per consumidor amb
  verificació a cada pas)
- **Depèn de**: plans/005-api-incremental-anti-perdua.md (forma final de
  l'API) i plans/004-rotar-secret-i-auth-real.md (forma final de l'auth)
- **Categoria**: tech-debt
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

Hi ha tres implementacions paral·leles del mateix client d'API REST:

1. `src/services/storage.ts` (web) — el seu `apiRequest` propi.
2. `extension/shared/api.ts` (extensió) — un altre `apiRequest` quasi idèntic.
3. `mobile/src/api.ts` (mòbil) — re-exporta funcions de
   `../../extension/shared/api` (un projecte important fitxers de DINS d'un
   altre projecte per camí relatiu) i a més duplica `callAICategorize`, que
   és línia per línia el mateix que `callClaudeProxy` de l'extensió.

Cada canvi de protocol (com els dels plans 003–005) s'ha de fer tres
vegades i és fàcil que les còpies diverteixin (ja ha passat: gestió d'errors
i timeouts diferents entre còpies). Un sol mòdul font de veritat elimina la
classe sencera de bug.

## Estat actual

- `src/services/storage.ts:17-51` — `apiRequest` de la web (URL relativa o
  d'entorn, gestió pròpia d'errors amb `console.error` + rethrow).
- `extension/shared/api.ts:5-24` — `apiRequest` de l'extensió (URL de
  `API_CONFIG.BASE_URL`, sense try/catch intern).
- `extension/shared/api.ts:102-120` (`callClaudeProxy`) i
  `mobile/src/api.ts:4-22` (`callAICategorize`) — duplicats exactes en tot
  menys el nom.
- `mobile/src/api.ts:1-2`:

```ts
export { getBookmarks, getCategories, saveBookmark, isDuplicate } from '../../extension/shared/api';
import { API_CONFIG } from '../../extension/shared/config';
```

- Les diferències legítimes entre entorns que el mòdul unificat ha de
  parametritzar: **base URL** (web: relativa o `VITE_STORAGE_API_URL`;
  extensió/mòbil: absoluta) i **obtenció de credencials** (web:
  sessionStorage — pla 004; extensió: chrome.storage — pla 004; mòbil:
  pendent del pla 014).
- Builds: tres projectes Vite independents (`vite.config.ts` a l'arrel, a
  `extension/` i a `mobile/`), sense workspace ni monorepo tooling. La
  manera més simple de compartir codi sense introduir tooling nou és un
  directori arrel `shared/` importat per camí relatiu + alias de Vite, que
  és el mateix mecanisme (millorat) que `mobile/` ja fa servir.

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Typecheck + tests web | `npx tsc -b && npm test` | exit 0 |
| Tests + build extensió | `cd extension && npm test && npm run build` | exit 0 |
| Build mòbil | `cd mobile && npm run build` | exit 0 |

## Abast

**Dins de l'abast**:
- `shared/api-client/` (crear, a l'arrel del repo) — client únic + tipus
- `src/services/storage.ts` — esdevé un embolcall prim del client compartit
  (manté el fallback localStorage, que és específic de la web)
- `extension/shared/api.ts` — re-exporta del client compartit
- `mobile/src/api.ts` — re-exporta del client compartit
- `tsconfig.app.json`, `extension/tsconfig.json`, `mobile/tsconfig.json` i
  els tres `vite.config.ts` — `include`/alias per resoldre `shared/`
- Tests existents que mockegin els mòduls moguts
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- Canviar el comportament de cap funció (això és moure i deduplicar, no
  redissenyar). El comportament de referència és el de l'extensió després
  del pla 005.
- Introduir npm workspaces / turborepo / paquet publicat — sobreeines per a
  aquesta mida de projecte.
- `extension/shared/types.ts` — mou només els tipus que el client necessiti;
  la resta es queda.

## Flux de git

- Branca recomanada: `advisor/008-client-api-unic`; un commit per consumidor
  migrat (pas 2, 3 i 4 separats) per poder fer bisect.
- NO facis push si l'operador no t'ho ha demanat.

## Passos

### Pas 1: Crea shared/api-client a partir de la versió de l'extensió

Copia (encara sense esborrar res) `extension/shared/api.ts` +
`extension/shared/config.ts` + els tipus que usen
(`Bookmark`, respostes API de `extension/shared/types.ts`) a
`shared/api-client/`. Parametritza el que és d'entorn amb una funció
d'inicialització:

```ts
export function createApiClient(opts: {
  baseUrl: string;
  getSecret: () => Promise<string | null>;
}) { ... retorna { getBookmarks, saveBookmark, isDuplicate, saveCategory, callClaudeProxy, ... } }
```

Sense cap `import.meta.env` ni `chrome.*` dins de `shared/` (els passa el
consumidor via `opts`). Comprova-ho amb el grep del criteri de finalització.

**Verifica**: `npx tsc --noEmit shared/api-client/*.ts` (o afegint el
directori a un tsconfig) → exit 0.

### Pas 2: Migra l'extensió

`extension/shared/api.ts` passa a instanciar el client
(`createApiClient({ baseUrl: API_CONFIG.BASE_URL, getSecret })`) i
re-exportar les mateixes funcions amb els mateixos noms — els consumidors
(`popup.tsx`, `service-worker.ts`) no haurien de canviar ni una línia.
Configura l'alias/`include` que calgui a `extension/tsconfig.json` i
`extension/vite.config.ts` perquè `shared/` (a l'arrel del repo) compili.

**Verifica**: `cd extension && npm test && npm run build` → exit 0.

### Pas 3: Migra el mòbil

`mobile/src/api.ts` instancia el client compartit directament (elimina les
importacions de `../../extension/`). `callAICategorize` desapareix com a
còpia: re-exporta `callClaudeProxy` amb l'àlies si cal mantenir el nom.

**Verifica**: `cd mobile && npm run build` → exit 0;
`grep -rn "extension/shared" mobile/src/` → cap resultat.

### Pas 4: Migra la web

`src/services/storage.ts` conserva la seva interfície pública (`storage.*`)
i el fallback a localStorage, però totes les branques `USE_API` criden el
client compartit en lloc del seu `apiRequest` propi, que s'esborra.

**Verifica**: `npx tsc -b && npm test` → exit 0.

### Pas 5: Esborra els duplicats morts

Elimina de `extension/shared/api.ts` i `extension/shared/config.ts` tot el
que ha quedat sense ús després dels passos 2–4 (enumera-ho al missatge de
commit). `grep -rn 'callAICategorize' mobile/ src/ extension/` per confirmar
que ja no queda cap còpia.

**Verifica**: els tres builds/tests de la taula de comandes → exit 0.

## Pla de tests

- No escriguis tests nous de comportament: la xarxa de seguretat són els
  tests existents (web: `npm test`; extensió: `extension/tests/*`) i els
  tres builds. Si algun test mockeja `../shared/api` per ruta, actualitza
  la ruta del mock, no el test.

## Criteris de finalització

- [ ] `grep -rn 'extension/shared' mobile/src/` → cap resultat
- [ ] Un sol `apiRequest` al repo: `grep -rln 'async function apiRequest' src/ extension/ mobile/ shared/` → només `shared/api-client/...`
- [ ] `grep -rn 'import.meta.env\|chrome\.' shared/api-client/` → cap resultat
- [ ] `npx tsc -b && npm test` → exit 0
- [ ] `cd extension && npm test && npm run build` → exit 0
- [ ] `cd mobile && npm run build` → exit 0
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- Els plans 004 o 005 no són DONE — faries la consolidació sobre una API que
  canviarà; atura't i digues-ho.
- L'alias de Vite/tsconfig per a `shared/` no funciona en algun dels tres
  builds després de dos intents — informa amb l'error exacte (pot caler
  decisió d'estructura: moure `shared/` o introduir workspaces, i això és
  de l'operador).
- El pla 014 ha decidit eliminar `mobile/` — salta el pas 3 i anota-ho.

## Notes de manteniment

- Regla de review a partir d'ara: cap `fetch` a l'API de bookmarks fora de
  `shared/api-client/`.
- Si s'acaba migrant a npm workspaces, `shared/api-client` és el primer
  candidat a paquet.
