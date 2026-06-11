# Pla 012: Decidir i documentar el content script a <all_urls>

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- extension/`
> Confirma que `extension/manifest.json` encara té el bloc `content_scripts`
> amb `"matches": ["<all_urls>"]` abans de continuar.

## Estat

- **Prioritat**: P3
- **Esforç**: S–M (depèn de l'opció triada)
- **Risc**: MED (és fàcil "arreglar-ho" i trencar silenciosament la
  categorització massiva — llegeix "Per què és delicat")
- **Depèn de**: cap
- **Categoria**: seguretat (superfície/privadesa) + tech-debt
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

L'extensió injecta `content/content.js` a **totes les pàgines que l'usuari
visita** (`matches: ["<all_urls>"]`, `run_at: document_end`). El script només
extreu metadades quan se li demana, però córrer a cada pàgina és superfície
de privadesa i una mica de cost per pàgina. La intuïció diu "treu-lo, que el
popup ja injecta sota demanda" — però això trencaria una funcionalitat real.
Aquest pla pren la decisió amb les restriccions ben posades i la implementa.

## Per què és delicat (el descobriment de l'auditoria)

Hi ha DOS consumidors del content script:

1. **Desat d'una sola pàgina** (`loadData` a `extension/popup/popup.tsx:163-231`):
   funciona sobre la pestanya ACTIVA. Si el missatge falla, **ja injecta sota
   demanda** amb `chrome.scripting.executeScript` (línies 174-186). El permís
   `activeTab` cobreix aquesta injecció. → No necessita el script estàtic.
2. **Categorització massiva de pestanyes** (`handleBulkCategorize`,
   `extension/popup/popup.tsx:356-403`): envia `GET_METADATA` a pestanyes en
   SEGON PLA (línia 373) per extreure'n descripcions per a la IA. Aquí
   `activeTab` NO cobreix la injecció (no són la pestanya activa) i els
   `host_permissions` del manifest només inclouen `links.masellas.info` i
   localhost — **sense el content script estàtic, la injecció sota demanda en
   pestanyes de fons fallaria** i la categorització perdria les descripcions
   (degradació silenciosa: el catch de la línia 377 s'ho empassa).

## Estat actual

- `extension/manifest.json` — permisos i content script:

```json
"permissions": ["activeTab", "storage", "scripting", "tabs", "tabGroups", "favicon"],
"host_permissions": ["https://links.masellas.info/*", "http://localhost:3839/*"],
"content_scripts": [{ "matches": ["<all_urls>"], "js": ["content/content.js"], "run_at": "document_end" }]
```

- `extension/content/content.ts` — 52 línies; defineix `extractMetadata()` i
  un listener de missatges `GET_METADATA`. No fa res proactivament.
- L'extensió és d'ús personal (no publicada a la Web Store, instal·lada
  desempaquetada), cosa que canvia el pes del trade-off de permisos.

## Opcions (tria segons la regla de decisió)

- **Opció A — Mantenir-ho i documentar-ho**: el script estàtic es queda;
  s'afegeix un comentari-justificació. Cost: superfície actual. Benefici:
  zero risc de regressió. Esforç S.
- **Opció B — `<all_urls>` a host_permissions + injecció sota demanda**:
  elimina el `content_scripts` estàtic, afegeix `"<all_urls>"` a
  `host_permissions`, i `handleBulkCategorize` injecta amb
  `chrome.scripting.executeScript` abans de demanar metadades (replicant el
  patró de `loadData`). El script només corre quan es categoritza. Permisos
  declarats equivalents, però execució molt més continguda. Esforç M.

**Regla de decisió**: si l'operador no ha dit el contrari a l'índex, fes
l'**Opció B** (mateix permís declarat, footprint d'execució mínim).

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Tests extensió | `cd extension && npm test` | tots passen |
| Build extensió | `cd extension && npm run build` | exit 0; `dist/` conté el manifest |
| Validar manifest | `node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json'))"` | exit 0 |

## Abast

**Dins de l'abast**:
- `extension/manifest.json`
- `extension/popup/popup.tsx` — només `handleBulkCategorize` (opció B)
- `extension/popup/tabsUtils.ts` — només si hi extreus un helper d'injecció
- `plans/README.md` — fila d'estat

**Fora de l'abast**:
- `extension/content/content.ts` — el contingut del script no canvia.
- `loadData` (el flux de pàgina única) — ja funciona; no el toquis.
- Qualsevol altra part del popup.

## Flux de git

- Missatge suggerit (opció B): `inject content script on demand instead of statically on all_urls`.
- NO facis push si l'operador no t'ho ha demanat.

## Passos (per a l'opció B)

### Pas 1: Manifest

Elimina el bloc `content_scripts` i afegeix `"<all_urls>"` a
`host_permissions` (mantén-hi els dos existents).

**Verifica**: el JSON parseja; `cd extension && npm run build` → exit 0.

### Pas 2: Injecció sota demanda a handleBulkCategorize

Abans del `chrome.tabs.sendMessage(tab.id, { type: 'GET_METADATA' })`
(popup.tsx:373), replica el patró de fallback de `loadData` (línies 174-186):
intenta el missatge; si llança, `chrome.scripting.executeScript({ target:
{ tabId: tab.id }, files: ['content/content.js'] })`, espera ~100 ms i
reintenta. Mantén el try/catch exterior (algunes pàgines — chrome://, Web
Store — no admeten injecció i han de seguir degradant amb descripció buida).

**Verifica**: `cd extension && npm test` → passen; `npm run build` → exit 0.

### Pas 3: Prova manual (imprescindible — els tests no cobreixen chrome.*)

Carrega `extension/dist` com a extensió desempaquetada a Chrome:
1. Desat de pàgina única: obre qualsevol article, popup → "Guardar aquesta
   pàgina" → el formulari mostra títol i descripció extrets.
2. Categorització massiva: obre 3 pestanyes d'articles diferents,
   selecciona-les al popup i llança el desat → a la vista de revisió, les
   categories suggerides arriben i (verifica-ho amb el backend local o
   mirant la petició a la pestanya Network del service worker) les
   peticions a `/categorize` porten `description` no buida per a pàgines
   amb meta description.

**Verifica**: els dos fluxos funcionen; informa el resultat al resum.

## Pla de tests

Els tests existents (`extension/tests/`) no toquen `chrome.scripting`;
no muntis mocks nous per a això — la prova manual del pas 3 és la
verificació real i és obligatòria.

## Criteris de finalització

- [ ] `grep -n 'content_scripts' extension/manifest.json` → cap resultat (opció B)
- [ ] `grep -n 'executeScript' extension/popup/popup.tsx` → ≥ 2 resultats
      (el de loadData i el nou)
- [ ] `cd extension && npm test && npm run build` → exit 0
- [ ] Prova manual del pas 3 superada i reportada
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

- No pots fer la prova manual (no tens Chrome amb l'extensió carregable) —
  NO commitegis el canvi sense la prova; deixa-ho preparat i informa.
- A la prova, les descripcions arriben buides per a pàgines que sí que tenen
  meta description — la injecció sota demanda no funciona com s'esperava;
  reverteix al manifest original i informa (l'opció A passa a ser el resultat,
  amb la justificació documentada).

## Notes de manteniment

- Si l'extensió es publica mai a la Chrome Web Store, `<all_urls>` a
  host_permissions requereix justificació a la fitxa; l'opció B la té
  ("extracció de metadades de les pestanyes que l'usuari tria desar").
- Si s'afegeixen funcions que llegeixin pàgines en segon pla, reutilitzeu el
  helper d'injecció d'aquest pla, no un content script estàtic nou.
