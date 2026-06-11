# Pla 007: Evitar que una URL invàlida tombi tota l'app (validació + error boundary)

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- src/`
> Si `src/App.tsx` ha canviat (plans 005/006/009 hi toquen), localitza els
> punts equivalents amb `grep -n 'new URL' src/App.tsx` i
> `grep -n 'externalLinks' src/App.tsx` abans de continuar.

## Estat

- **Prioritat**: P2
- **Esforç**: S
- **Risc**: BAIX
- **Depèn de**: cap
- **Categoria**: bug
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

La targeta de bookmark renderitza `new URL(link).hostname` per a cada enllaç
extern. El camp `externalLinks` és editable per l'usuari al modal d'edició
com a text separat per comes, **sense cap validació**: si s'hi escriu
"pendent de mirar" (o qualsevol cosa que no sigui una URL absoluta),
`new URL()` llança, i com que no hi ha cap error boundary, **tota l'app
queda en blanc** — no només aquella targeta. El bookmark corrupte queda
persistit, així que l'app peta a cada càrrega fins a editar el JSON a mà.

## Estat actual

- `src/App.tsx:164-179` — render dels enllaços externs dins de `BookmarkCard`:

```tsx
{bookmark.externalLinks.map((link, idx) => (
    <a key={idx} href={link} ...>
        <LinkIcon size={12} /> {new URL(link).hostname}
    </a>
))}
```

- `src/App.tsx:1613-1628` — entrada sense validar al modal d'edició:

```tsx
<Input
    value={editingBookmark.externalLinks.join(', ')}
    onChange={(e) =>
        setEditingBookmark({
            ...editingBookmark,
            externalLinks: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s),
        })
    }
/>
```

- No existeix cap error boundary al projecte (`grep -rn 'ErrorBoundary' src/`
  → buit). El punt d'entrada és `src/main.tsx` (15 línies, renderitza
  `<App />`).
- Convencions: components funcionals amb tipus explícits; vegeu
  `src/components/ScrollToTop.tsx` com a exemplar de component petit.
  Excepció: l'error boundary ha de ser de classe (React no en té de
  funcional) — és l'únic lloc del repo on una classe és correcta.

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Typecheck | `npx tsc -b` | exit 0 |
| Tests | `npm test` | tots passen (inclou els nous) |
| Dev server | `npm run dev` | app a localhost |

## Abast

**Dins de l'abast**:
- `src/utils/url.ts` (crear) — helpers `safeHostname` i `isValidHttpUrl`
- `src/utils/url.test.ts` (crear)
- `src/components/ErrorBoundary.tsx` (crear)
- `src/App.tsx` — usar `safeHostname` al render i validar al desar
- `src/main.tsx` — embolcallar `<App />` amb l'error boundary
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- Validar `originalLink` o altres camps (mateix patró, però decisió d'abast:
  només el camp que crasheja; anota-ho com a seguiment).
- L'extensió i el mòbil (construeixen `externalLinks: []` sempre, no editables).
- Sanejar dades ja corruptes al servidor (el render segur les tolera).

## Flux de git

- Missatge suggerit: `safe hostname rendering + error boundary; validate externalLinks input`.
- NO facis push si l'operador no t'ho ha demanat.

## Passos

### Pas 1: Helpers d'URL amb tests

`src/utils/url.ts`:

```ts
export function safeHostname(link: string): string {
  try {
    return new URL(link).hostname
  } catch {
    return link.length > 40 ? link.slice(0, 37) + '...' : link
  }
}

export function isValidHttpUrl(link: string): boolean {
  try {
    const u = new URL(link)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
```

Tests a `src/utils/url.test.ts` (patró estructural:
`src/services/claudeService.test.ts` — vitest, `describe`/`it`/`expect`):
URL https vàlida → hostname; text pla → retornat truncat; `javascript:` i
`ftp:` → `isValidHttpUrl` false; cadena buida → false.

**Verifica**: `npm test` → passen, inclosos els nous.

### Pas 2: Render segur a BookmarkCard

A `src/App.tsx:175` substitueix `{new URL(link).hostname}` per
`{safeHostname(link)}` (importa des de `./utils/url`).

**Verifica**: `npx tsc -b` → exit 0.

### Pas 3: Validació al modal d'edició

Al `saveBookmark` de App.tsx (línia 689, el del modal — no confondre amb el
de l'extensió): abans de desar, filtra
`editingBookmark.externalLinks.filter(isValidHttpUrl)`; si algun enllaç
s'ha descartat, mostra-ho amb el patró existent
`setResultModal({ title, message })` informant quins s'han descartat, i desa
igualment els vàlids. (Filtrar al `onChange` no funciona: impediria escriure
text a mig fer.)

**Verifica**: `npx tsc -b` → exit 0; manualment al dev server: edita un
bookmark, posa `abc, https://example.com` a enllaços externs, desa →
es desa només `https://example.com` i apareix l'avís.

### Pas 4: Error boundary global

`src/components/ErrorBoundary.tsx`: component de classe estàndard amb
`getDerivedStateFromError` + `componentDidCatch` (console.error). El
fallback ha de seguir l'estètica del repo (vegeu el bloc "no data" a
`src/App.tsx:1324-1331` com a referència d'estil: fons clar, vores negres,
font mono): missatge d'error en català i un botó "Recarregar" que faci
`window.location.reload()`. A `src/main.tsx`, embolcalla `<App />`.

**Verifica**: `npx tsc -b` → exit 0; `npm test` → tots passen.

## Pla de tests

- `src/utils/url.test.ts` — els casos del pas 1.
- L'error boundary no es testeja automàticament (sense infraestructura de
  tests de components); verificació per typecheck + revisió.

## Criteris de finalització

- [ ] `grep -n 'new URL(link)' src/App.tsx` → cap resultat
- [ ] `grep -n 'ErrorBoundary' src/main.tsx` → 1+ resultats
- [ ] `npm test` → exit 0 amb ≥ 4 tests nous d'URL
- [ ] `npx tsc -b` → exit 0
- [ ] Prova manual del pas 3 feta (informa-ho al resum)
- [ ] Cap fitxer fora de l'abast modificat (`git status`)
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- `src/App.tsx` ha canviat tant (plans 005/009) que no trobes els punts amb
  els greps de la capçalera.
- Hi ha més usos de `new URL(` sobre dades d'usuari a `src/` que no siguin
  el de la línia 175 (`grep -rn 'new URL(' src/`) — llista'ls i informa
  abans d'ampliar l'abast pel teu compte.

## Notes de manteniment

- Seguiment deferit: validar també `originalLink` al mateix modal (mateix
  helper, mateixa tècnica).
- Si s'afegeix routing o code-splitting, mantingueu l'ErrorBoundary al nivell
  més alt; els errors de càrrega de chunks també hi cauran.
