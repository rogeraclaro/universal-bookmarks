# Pla 010: Lint net, CI mínima i .env.example

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **REGLA**: a `.env.example` només hi van NOMS de variables, mai valors.
>
> **Comprovació de deriva (executa-ho primer)**:
> `npm run lint 2>&1 | tail -5` — si ja surt net (0 errors), la meitat del
> pla està feta; revisa quins passos queden. Els errors concrets llistats a
> "Estat actual" poden haver canviat si els plans 004–009 han tocat els
> mateixos fitxers: la font de veritat és la sortida del lint, no la llista.

## Estat

- **Prioritat**: P2
- **Esforç**: S
- **Risc**: BAIX
- **Depèn de**: cap (però com més tard s'executi, menys errors de lint
  quedaran vius; ideal després de 005–009)
- **Categoria**: dx
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

`npm run lint` falla amb 18 errors i 2 avisos: el lint no serveix de res si
sempre està vermell, perquè ningú nota els errors nous. No hi ha cap CI, així
que res verifica que el projecte compili i passi tests abans de desplegar
(el desplegament és un `rsync` manual). I el fitxer `.env` necessari per al
build no està documentat enlloc: qualsevol que cloni el repo (o qualsevol
agent executor d'aquests plans) ha d'endevinar quines variables calen.

## Estat actual

- Sortida de `npm run lint` al commit `23d9adf` (resum): 18 errors, 2 avisos.
  Distribució: `src/App.tsx` (5: 4 `no-explicit-any` a les línies 335, 351,
  559, 585 i 1 `prefer-const` a la 585), `src/services/claudeService.test.ts`
  (3: 2 unused vars, 1 any), `src/services/claudeService.ts` (2:
  `no-control-regex` a la línia 17, unused var a la 77),
  `src/services/storage.ts` (1 any), `src/types.ts` (1 any), més errors
  `react-hooks/immutability` reportats a `extension/popup/popup.tsx` (el
  lint de l'arrel també escaneja `extension/`).
- `eslint.config.js` — flat config existent a l'arrel.
- Variables d'entorn usades (cerca `import.meta.env` a `src/`):
  `VITE_STORAGE_API_URL`, `VITE_STORAGE_SECRET` (desapareix amb el pla 004),
  i al `.env` local també hi ha `VITE_API_KEY` i `VITE_CLAUDE_PROXY_URL` —
  comprova amb `grep -rn 'VITE_' src/ vite.config.ts` quines es fan servir
  REALMENT; les que no s'usin enlloc, documenta-les com a obsoletes a
  `.env.example` o omet-les.
- No hi ha cap workflow: `ls .github/workflows/` → no existeix.
- El remot és GitHub (`github.com/rogeraclaro/universal-bookmarks`), per
  tant GitHub Actions és la CI natural.

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Lint | `npm run lint` | exit 0, 0 errors |
| Typecheck | `npx tsc -b` | exit 0 |
| Tests web | `npm test` | tots passen |
| Tests extensió | `cd extension && npm test` | tots passen |
| Validar workflow | `cat .github/workflows/ci.yml` | YAML ben format |

## Abast

**Dins de l'abast**:
- Els fitxers de `src/` i `extension/` amb errors de lint — **només les
  línies que el lint assenyala**
- `eslint.config.js` — únicament si cal excloure dirs generats o afegir
  un `ignores`
- `.env.example` (crear, a l'arrel)
- `.github/workflows/ci.yml` (crear)
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- Refactors més enllà de l'error de lint concret (p. ex. un `any` es
  tipa amb el tipus real mínim, no es redissenya la funció).
- Desactivar regles globalment per fer callar errors: cada `eslint-disable`
  puntual ha de portar un motiu d'una línia. Màxim 3 disables en tot el pla;
  si en necessites més, STOP.
- CD/desplegament automàtic — només verificació.

## Flux de git

- Missatges suggerits: `fix lint errors`, `add .env.example`, `add CI workflow` (3 commits).
- NO facis push si l'operador no t'ho ha demanat (el workflow s'activarà sol
  quan l'operador pushgi).

## Passos

### Pas 1: Arregla els errors de lint

Executa `npm run lint`, arregla cada error al seu lloc. Guia per als casos
del commit `23d9adf`:

- `no-explicit-any` a les migracions d'App.tsx (335, 351): el tipus real és
  "Bookmark antic amb camp `category: string` opcional" — declara un tipus
  local `LegacyBookmark = Bookmark & { category?: string }`.
- `no-explicit-any` a `catch (error: any)` (559): usa `unknown` + narrow
  (`error instanceof Error`).
- `prefer-const` (585): `let rawData` → `const`.
- `no-control-regex` a `claudeService.ts:17`: la regex de control chars és
  intencionada — `// eslint-disable-next-line no-control-regex` amb motiu.
- Unused vars als tests i a `claudeService.ts:77`: elimina o reanomena `_`.
- `react-hooks/immutability` a popup.tsx: llegeix el missatge concret i
  segueix-lo; si el fix no és obvi, disable puntual amb motiu.

**Verifica**: `npm run lint` → exit 0; `npx tsc -b` → exit 0;
`npm test` i `cd extension && npm test` → tots passen.

### Pas 2: Crea .env.example

A l'arrel, amb cada variable VITE_ que realment s'usi (vegeu "Estat actual"),
un comentari d'una línia per a cadascuna i CAP valor real:

```bash
# URL base de l'API d'emmagatzematge (buit = mateixa procedència, VPS)
VITE_STORAGE_API_URL=
```

**Verifica**: `grep -E '=[^ ]+' .env.example` → cap resultat (cap valor).

### Pas 3: Workflow de CI

`.github/workflows/ci.yml`: un job en `ubuntu-latest`, Node 22, que faci
checkout, `npm ci` + `npm run lint` + `npx tsc -b` + `npm test` a l'arrel, i
`npm ci` + `npm test` + `npm run build` a `extension/`. Cache de npm
(`actions/setup-node` amb `cache: npm` i `cache-dependency-path` per als dos
lockfiles). Trigger: `push` i `pull_request` a `main`.

**Verifica**: el YAML parseja (`node -e "require('js-yaml')"` no està
disponible; fes servir `npx --yes yaml-lint .github/workflows/ci.yml` o
revisió manual acurada) i les comandes del workflow són EXACTAMENT les que
has executat amb èxit als passos anteriors.

## Pla de tests

Cap test nou; el pla és que els existents s'executin sols a partir d'ara.

## Criteris de finalització

- [ ] `npm run lint` → exit 0
- [ ] `npx tsc -b` i `npm test` → exit 0; `cd extension && npm test` → exit 0
- [ ] `.env.example` existeix, sense cap valor
- [ ] `.github/workflows/ci.yml` existeix i replica les comandes verificades
- [ ] ≤ 3 `eslint-disable` nous, tots amb motiu
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- Arreglar un error de lint requereix canviar comportament (no només tipus
  o sintaxi) — deixa aquell error, anota'l i continua; informa al final.
- Necessitaries més de 3 `eslint-disable` — alguna regla està mal
  configurada per a aquest repo; informa en lloc de silenciar.
- El lint de l'arrel falla sobre fitxers de `extension/` que el seu propi
  tsconfig tracta diferent i no pots quadrar-ho — proposa a l'informe
  excloure `extension/` del lint de l'arrel (té el seu propi projecte), però
  no ho facis sense dir-ho.

## Notes de manteniment

- Quan el pla 004 elimini `VITE_STORAGE_SECRET`, actualitzeu `.env.example`.
- Si s'afegeix el backend a la CI (tests del pla 002), afegiu un tercer pas
  al job; ara mateix el backend pot no tenir tests si el 002 no està DONE.
