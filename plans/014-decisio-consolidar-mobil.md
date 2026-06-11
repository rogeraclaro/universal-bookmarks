# Pla 014 (anàlisi): Decidir el futur del frontend mòbil (mobile/)

> **Instruccions per a l'executor**: Aquest és un pla d'ANÀLISI I DECISIÓ. El
> lliurable és un document de recomanació; NO esborris `mobile/` ni
> modifiquis cap codi de producció dins d'aquest pla. En acabar, actualitza
> la fila d'aquest pla a `plans/README.md`.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- mobile/ src/`
> Si els plans 004/008 han tocat `mobile/`, llegeix les versions actuals;
> en particular, després del pla 004 el mòbil pot haver quedat sense
> capacitat d'escriptura (és un input clau de la decisió).

## Estat

- **Prioritat**: P3
- **Esforç**: M (anàlisi S + la implementació de l'opció triada, S–M)
- **Risc**: BAIX (la fase d'anàlisi no toca res)
- **Depèn de**: cap (però llegeix l'estat dels plans 004 i 008 a l'índex)
- **Categoria**: direcció
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

El repo manté TRES frontends per a un producte d'un sol usuari: la web
(`src/`), l'extensió (`extension/`) i una PWA mòbil (`mobile/`). La PWA
duplica el flux de desat de bookmarks (281 línies a `mobile/src/App.tsx`)
mentre la web principal ja és responsive (menú mòbil propi, breakpoints per
tot arreu — vegeu `src/App.tsx:1237-1319`). Cada frontend extra paga impost
a cada canvi de protocol (els plans 004, 005 i 008 n'han hagut de tenir
cura explícitament). La pregunta de producte: què aporta la PWA que la web
responsive no pugui aportar amb un manifest i un service worker?

## Estat actual

- `mobile/` — projecte Vite independent: `mobile/src/App.tsx` (281 línies),
  `mobile/src/api.ts` (importa el client de `../../extension/shared/` — o
  del client unificat si el pla 008 és DONE), `mobile/manifest.json` (PWA),
  `mobile/public/sw.js` (service worker), `mobile/deploy.sh` (desplegament
  propi al VPS).
- La web principal (`src/`) NO té manifest PWA ni service worker
  (`ls public/` → només svg; `grep -rn 'serviceWorker' src/ index.html` →
  res). És responsive però no instal·lable.
- Funcionalitat del mòbil que cal inventariar (pas 1): desar la URL
  compartida/enganxada amb categorització IA — el cas d'ús sembla ser
  "compartir des del mòbil cap a l'app". La web principal no té cap flux
  d'entrada ràpida equivalent optimitzat per a mòbil.
- Després del pla 004, l'escriptura requereix login/secret que el mòbil pot
  no tenir implementat — pot estar funcionalment trencat des de llavors.

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Build mòbil | `cd mobile && npm run build` | exit 0 (estat de partida) |
| Inventari d'ús | llegir `mobile/src/App.tsx` sencer | — |
| Build web | `npm run build` | exit 0 |

## Abast

**Dins de l'abast**:
- `plans/decisio-mobil/RECOMANACIO.md` (crear) — el document de decisió
- Després de l'aprovació de l'operador (i NOMÉS llavors): els fitxers que
  l'opció triada indiqui
- `plans/README.md` — fila d'estat

**Fora de l'abast (fase d'anàlisi)**:
- Esborrar o modificar `mobile/`.
- Tocar `src/`.

## Passos

### Pas 1: Inventari funcional del mòbil

Llegeix `mobile/src/App.tsx` i `mobile/src/utils.ts` sencers i llista al
document: cada funcionalitat, si existeix també a la web principal, i si
funciona ARA (prova `cd mobile && npm run build` i, si pots, el flux real
contra el backend; recorda l'efecte del pla 004 sobre l'escriptura).

### Pas 2: Document de recomanació

`plans/decisio-mobil/RECOMANACIO.md` amb les tres opcions i una recomanació
argumentada:

- **Opció A — Consolidar**: afegir manifest PWA + service worker + (si el
  share-target és el cas d'ús real) Web Share Target API a la web principal;
  arxivar `mobile/` (moure a una branca `archive/mobile` o esborrar amb el
  tag de git com a memòria). Estima: quines ~línies i fitxers nous calen a
  `src/`/`public/`/`index.html`, i què es perd (si res).
- **Opció B — Mantenir i posar al dia**: el mòbil es queda; llavors cal
  cablejar-lo a l'auth del pla 004 i al client del pla 008, i afegir-lo a la
  CI del pla 010. Estima el cost recurrent.
- **Opció C — Status quo** (mantenir sense invertir-hi): explicita el risc
  (probablement ja no escriu després del 004; bitrot silenciós).

Inclou la matriu: cas d'ús cobert / cost de manteniment / treball únic.

### Pas 3: STOP — presenta la recomanació

Atura't aquí i presenta el document a l'operador. NOMÉS si l'operador tria
una opció en aquesta mateixa sessió, implementa-la com a continuació
(l'opció A té els passos esbossats al document que has escrit; l'opció B
remet als plans 004/008/010).

## Pla de tests

Fase d'anàlisi: cap. Si s'implementa l'opció A: verificació manual
d'instal·lació PWA (Chrome mòbil o desktop → "Instal·la l'aplicació") i
`npm run build` net; Lighthouse PWA com a comprovació opcional.

## Criteris de finalització (fase d'anàlisi)

- [ ] `plans/decisio-mobil/RECOMANACIO.md` amb inventari + 3 opcions + recomanació
- [ ] L'estat funcional real del mòbil està verificat, no suposat
      (build + prova d'escriptura o constatació que no pot escriure)
- [ ] Cap fitxer de producció modificat (`git status`)
- [ ] Fila actualitzada a `plans/README.md` (DONE per a l'anàlisi; el pas
      d'implementació, si l'operador el demana, com a nota a la fila)

## Condicions de STOP

- El pas 3 ÉS una condició de stop estructural: cap implementació sense
  l'elecció explícita de l'operador.
- Descobreixes que el mòbil té funcionalitat única que cap opció del
  document cobreix bé — documenta-la i deixa la recomanació en obert.

## Notes de manteniment

- Si guanya l'opció A, recordeu esborrar també el `deploy.sh` del mòbil i la
  ruta corresponent del VPS (anoteu-ho al document perquè l'operador ho faci).
- Aquesta decisió interactua amb el pla 008: si encara no s'ha executat i
  guanya l'opció A, el pas de migració del mòbil del 008 se salta (anoteu-ho
  a l'índex).
