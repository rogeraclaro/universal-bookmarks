# Pla 011: Resoldre les vulnerabilitats de npm audit als tres paquets

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **Comprovació de deriva (executa-ho primer)**:
> `npm audit` a l'arrel, `extension/` i `mobile/` — les xifres de "Estat
> actual" són del 2026-06-11 i hauran canviat; la font de veritat és la
> sortida d'avui.

## Estat

- **Prioritat**: P3
- **Esforç**: S
- **Risc**: BAIX–MED (les actualitzacions de tooling poden trencar el build;
  per això cada paquet es verifica amb build + tests)
- **Depèn de**: cap
- **Categoria**: dependències
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

`npm audit` reporta 9 vulnerabilitats a l'arrel (4 moderades, 5 altes),
5 a `extension/` (2 moderades, 3 altes) i 4 a `mobile/` (3 moderades, 1 alta).
Pel que s'ha vist a l'auditoria, es concentren en tooling de desenvolupament
(vite, yaml, etc.), no en dependències de runtime (les úniques de runtime són
react, react-dom, lucide-react al front i express/cors al backend) — per això
és P3 i no P1. Tot i així, valen una passada: l'extensió i la web es
construeixen amb aquest tooling, i mantenir el soroll d'audit a zero és el
que permet veure una vulnerabilitat real quan arribi.

## Estat actual

- Tres arbres npm independents: `package.json` + `package-lock.json` a
  l'arrel, a `extension/` i a `mobile/`. El backend (`backend/`) només té
  express i cors — inclou-lo a la passada (`cd backend && npm audit`).
- Versions majors del tooling: arrel amb vite 7 / vitest 4 / eslint 9;
  `extension/` i `mobile/` amb vite 5 — més antics, és on és més probable
  que el fix demani salt de versió major.

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Auditoria | `npm audit` (a cada paquet) | per llegir, no per assumir |
| Fix segur | `npm audit fix` (a cada paquet) | sense `--force` |
| Verificació arrel | `npm run lint && npx tsc -b && npm test && npm run build` | exit 0 |
| Verificació extensió | `cd extension && npm test && npm run build` | exit 0 |
| Verificació mòbil | `cd mobile && npm run build` | exit 0 |
| Verificació backend | `cd backend && npm test` (si el pla 002 és DONE) | exit 0 |

Nota: `npm run build` a l'arrel escriu a `dist/` (ignorat per git) — és segur.

## Abast

**Dins de l'abast**:
- `package.json` / `package-lock.json` dels quatre paquets
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- `npm audit fix --force` — MAI sense informar primer (instal·la majors).
- Migracions de versió major del tooling (vite 5 → 7 a extension/mobile):
  si el fix les requereix, documenta-ho i deixa-ho per a un pla a part.
- Qualsevol fitxer de codi font.

## Flux de git

- Un commit per paquet: `npm audit fix (root)`, etc.
- NO facis push si l'operador no t'ho ha demanat.

## Passos

### Pas 1: Audita i classifica

Per a cada paquet (arrel, extension, mobile, backend): `npm audit` i apunta
quines vulnerabilitats són de runtime (dependencies) i quines de tooling
(devDependencies). Si n'hi ha cap de runtime amb severitat alta o crítica,
informa-ho immediatament al resum (passa de P3 a urgent).

### Pas 2: Fix sense --force, paquet a paquet

A cada paquet: `npm audit fix`, després la verificació completa d'aquell
paquet (taula de comandes). Si la verificació falla, `git checkout -- package.json package-lock.json` d'aquell paquet, anota la vulnerabilitat
com a no-resoluble-sense-major i continua amb el següent.

**Verifica**: per paquet, build + tests → exit 0.

### Pas 3: Informe del que queda

Al resum final i a la fila de l'índex: quantes vulnerabilitats s'han resolt
i quines queden (id de l'advisory, paquet afectat, per què no s'ha resolt —
normalment "requereix vite X major").

## Pla de tests

Cap test nou; la verificació són les suites i builds existents per paquet.

## Criteris de finalització

- [ ] `npm audit fix` executat als 4 paquets (o anotat per què no)
- [ ] Totes les verificacions per paquet → exit 0
- [ ] Cap `--force` executat
- [ ] El resum llista les vulnerabilitats restants amb motiu
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- Apareix una vulnerabilitat de RUNTIME alta/crítica (no de tooling) —
  informa abans de seguir, pot caler una decisió.
- `npm audit fix` modifica versions de `dependencies` de runtime (react,
  express...) — verifica amb molta més cura i menciona-ho al resum.

## Notes de manteniment

- Les que requereixin vite major a `extension/` i `mobile/` es poden
  resoldre de franc si el pla 014 consolida el mòbil o si algú unifica les
  versions de tooling dels tres paquets (candidat de pla futur).
- Amb la CI del pla 010, considereu afegir-hi `npm audit --audit-level=high`
  com a pas informatiu.
