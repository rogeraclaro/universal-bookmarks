# Plans d'implementació

Generats per l'skill `improve` el 2026-06-11 sobre el commit `23d9adf`.
Executeu-los en l'ordre de sota tret que les dependències diguin el contrari.
Cada executor: llegeix el pla sencer abans de començar, respecta les seves
condicions de STOP, i actualitza la teva fila en acabar.

El document complet de l'auditoria (taula de troballes, ordre d'execució
raonat i prompts per llançar cada pla) és a [`AUDITORIA.md`](AUDITORIA.md).

## Ordre d'execució i estat

| Pla | Títol | Prioritat | Esforç | Depèn de | Estat |
|-----|-------|-----------|--------|----------|-------|
| 001 | [Backend sota git (recuperat del VPS)](001-backend-sota-git.md) | P1 | S | — | TODO |
| 002 | [Escriptura atòmica i backups de db.json](002-escriptura-atomica-dbjson.md) | P1 | S | 001 | TODO |
| 003 | [Lectura pública sense secret](003-lectura-publica-sense-secret.md) | P1 | S | 001 | TODO |
| 004 | [Rotar secret + auth real](004-rotar-secret-i-auth-real.md) | P1 | M | 001, 003 | TODO |
| 005 | [API incremental anti-pèrdua de dades](005-api-incremental-anti-perdua.md) | P1 | L | 001, 002 (recomanat: 004) | TODO |
| 006 | [Persistir l'esborrat de l'últim bookmark](006-persistir-esborrat-ultim-bookmark.md) | P2 | S | — (obsolet si 005 DONE) | TODO |
| 007 | [URLs invàlides + error boundary](007-urls-invalides-i-error-boundary.md) | P2 | S | — | TODO |
| 010 | [Lint net, CI mínima i .env.example](010-lint-net-ci-envexample.md) | P2 | S | — (ideal després de 005–009) | TODO |
| 008 | [Unificar el client API (×3 → 1)](008-unificar-client-api.md) | P2 | M | 004, 005 | TODO |
| 009 | [Codi mort d'App.tsx](009-codi-mort-apptsx.md) | P3 | S | — (després de 005/006/007) | TODO |
| 011 | [Vulnerabilitats npm](011-vulnerabilitats-npm.md) | P3 | S | — | TODO |
| 012 | [Content script <all_urls>: decidir i implementar](012-decisio-content-script-allurls.md) | P3 | S–M | — | TODO |
| 013 | [Spike: importació universal](013-spike-importacio-universal.md) | P3 | M | — (millor després de 005) | TODO |
| 014 | [Anàlisi: futur del frontend mòbil](014-decisio-consolidar-mobil.md) | P3 | M | — (llegir estat de 004/008) | TODO |

Valors d'estat: TODO | IN PROGRESS | DONE | BLOCKED (amb motiu d'una línia) |
REJECTED (amb justificació d'una línia — troballa resolta per una altra via o
enfocament abandonat).

## Notes de dependències

- **001 és el prerequisit de tot el que toca backend** (002, 003, 004, 005):
  recupera el codi real desplegat al VPS; sense ell, els altres plans
  operarien sobre un `server.js` local desfasat que no té els endpoints d'IA.
- **003 abans de 004**: treure el secret del bundle web només és possible si
  la lectura pública ja no necessita secret.
- **005 després de 004 (recomanat)**: així la capa d'auth no es refà dues
  vegades en els mateixos fitxers.
- **006 queda obsolet si 005 és DONE** (el 005 elimina els `useEffect`
  causants); el 006 té la instrucció de marcar-se REJECTED en aquest cas.
- **008 després de 004 i 005**: consolida la forma FINAL de l'API; fer-ho
  abans obligaria a refer-ho.
- **009 després dels plans que toquen App.tsx** (005, 006, 007) per evitar
  conflictes de merge en un fitxer de 1.800 línies.
- **010 com més tard millor** dins de la tanda: cada pla anterior redueix
  errors de lint vius; però és independent i es pot avançar si es vol CI aviat.
- **014 interactua amb 008**: si es decideix arxivar `mobile/`, el pas de
  migració del mòbil del 008 se salta.

## Troballes considerades i rebutjades

- **«Eliminar el content script estàtic `<all_urls>` directament»**: rebutjat
  com a fix directe — l'auditoria va confirmar que `handleBulkCategorize`
  (extension/popup/popup.tsx:373) depèn del script estàtic per llegir
  pestanyes en segon pla (activeTab no cobreix la injecció en pestanyes no
  actives amb els host_permissions actuals). Convertit en pla de decisió (012).
- **CRDT / optimistic locking per a la concurrència**: sobredisseny per a una
  app d'un sol usuari amb 3 clients; el pla 005 (fusió al servidor per
  operació) cobreix el cas real.
- **Migrar db.json a sqlite/Postgres**: no és necessari per a la mida i l'ús
  actuals; l'escriptura atòmica (002) elimina el risc real. Reconsiderar si
  mai hi ha multiusuari.
- **Reescriure l'historial de git per purgar el secret**: innecessari — la
  rotació (004) deixa el secret antic inservible; reescriure main publicat
  costa més que el benefici.
- **Partir App.tsx en components**: no demanat i risc alt de regressió sense
  tests de components; anotat com a candidat futur a les notes del pla 009.
