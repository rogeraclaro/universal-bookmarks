# Pla 006: Persistir l'esborrat de l'últim bookmark (i el buidatge de la llista)

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **ABANS DE RES**: mira l'estat del pla 005 a `plans/README.md`. Si el 005 és
> DONE, els `useEffect` d'aquest pla ja no existeixen i el bug ja està resolt
> per disseny → marca aquest pla com a REJECTED amb la nota "resolt pel 005"
> i atura't.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- src/App.tsx`
> Si `src/App.tsx` ha canviat, confirma que l'extracte de "Estat actual"
> encara hi és abans de continuar.

## Estat

- **Prioritat**: P2
- **Esforç**: S
- **Risc**: BAIX (però amb una trampa documentada a sota — llegeix-la)
- **Depèn de**: cap (però queda obsolet si el 005 ja és DONE)
- **Categoria**: bug
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

Quan l'usuari esborra l'últim bookmark que queda (o fa servir el RESET amb
fallada parcial), el canvi **no es persisteix mai**: en recarregar la pàgina
el bookmark reapareix. La causa és la condició `bookmarks.length > 0` a
l'efecte de desat. El mateix passa amb `categories`.

## Estat actual

- `src/App.tsx:372-378`:

```tsx
// Save Data when changed
useEffect(() => {
    if (bookmarks.length > 0) storage.saveBookmarks(bookmarks)
}, [bookmarks])

useEffect(() => {
    if (categories.length > 0) storage.saveCategories(categories)
}, [categories])
```

- **LA TRAMPA**: aquesta condició NO és un descuit gratuït — protegeix contra
  un desastre. L'efecte també s'executa al primer render, quan `bookmarks`
  encara és `[]` perquè les dades són a mig carregar (la càrrega és async a
  l'efecte de `loadData`, `src/App.tsx:326-369`). Si treus la condició sense
  res més, **cada càrrega de pàgina escriuria un array buit al servidor i
  esborraria toda la BD**. La solució ha de distingir "buit perquè encara no
  he carregat" de "buit perquè l'usuari ho ha esborrat tot".
- Hi ha un flag que ja marca el final de la càrrega: `setIsDataLoading(false)`
  al `finally` de `loadData` (`src/App.tsx:365`).

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Typecheck | `npx tsc -b` | exit 0 |
| Tests | `npm test` | tots passen |
| Dev server (prova manual) | `npm run dev` | app a localhost |

## Abast

**Dins de l'abast**:
- `src/App.tsx` — només els dos `useEffect` de desat i un ref nou
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- L'efecte de `deletedIds` (línia 380-382) — no té la condició i ja funciona.
- Qualsevol altre canvi a App.tsx (codi mort, refactors — plans 009 i 005).
- `storage.ts` i el backend.

## Flux de git

- Missatge suggerit: `persist deletion of last bookmark (guard initial load, not emptiness)`.
- NO facis push si l'operador no t'ho ha demanat.

## Passos

### Pas 1: Substitueix la condició de longitud per una de càrrega completada

Afegeix un ref al costat dels altres refs (vora `src/App.tsx:266`):

```tsx
const hasLoadedRef = useRef(false)
```

Posa'l a `true` al `finally` de `loadData` (al costat de
`setIsDataLoading(false)`, línia 365). Canvia els dos efectes:

```tsx
useEffect(() => {
    if (hasLoadedRef.current) storage.saveBookmarks(bookmarks)
}, [bookmarks])

useEffect(() => {
    if (hasLoadedRef.current) storage.saveCategories(categories)
}, [categories])
```

(`isDataLoading` no serveix directament com a dependència perquè el seu
canvi re-executaria els efectes; el ref evita el re-tret i no dispara res.)

**Verifica**: `npx tsc -b` → exit 0; `npm test` → tots passen.

### Pas 2: Prova manual del bug i de la trampa

Amb backend local i `npm run dev` (o amb localStorage si no hi ha API):
1. **Trampa**: carrega la pàgina amb dades existents i, SENSE tocar res,
   recarrega-la → les dades segueixen sent-hi (cap escriptura d'array buit).
2. **Bug**: deixa només un bookmark, esborra'l, recarrega → NO reapareix.

**Verifica**: tots dos escenaris es comporten com s'indica. Si fas la prova
contra el backend real amb dades de l'usuari, fes primer una còpia de
`backend/db.json`.

## Pla de tests

No hi ha infraestructura de tests per a App.tsx (cap test de components al
repo) i muntar-la queda fora d'aquest pla. La verificació és el typecheck,
la suite existent i la prova manual del pas 2 — el pas 2 no és opcional.

## Criteris de finalització

- [ ] `grep -n 'bookmarks.length > 0' src/App.tsx` → cap resultat
- [ ] `grep -n 'hasLoadedRef' src/App.tsx` → ≥ 3 resultats (declaració,
      assignació, ús als efectes)
- [ ] `npx tsc -b` → exit 0; `npm test` → exit 0
- [ ] Prova manual del pas 2 feta i superada (informa-ho al resum final)
- [ ] Només `src/App.tsx` i `plans/README.md` modificats (`git status`)
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- El pla 005 és DONE (vegeu capçalera).
- Els `useEffect` ja no coincideixen amb l'extracte (App.tsx ha canviat).
- A la prova manual de la trampa (pas 2.1) es produeix una escriptura buida —
  el fix és incorrecte; NO commitegis i informa.

## Notes de manteniment

- Si el pla 005 s'executa després d'aquest, eliminarà aquests `useEffect`
  del tot (passa a operacions explícites); aquest fix és el pont fins llavors.
- En review: vigileu qualsevol futur `useEffect` que persisteixi estat
  derivat — el patró "desa-ho tot quan canviï" és la font dels dos bugs
  més cars d'aquesta app (aquest i el del pla 005).
