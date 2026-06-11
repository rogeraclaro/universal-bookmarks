# Pla 001: Posar el backend real (VPS) sota control de versions

> **Instruccions per a l'executor**: Segueix aquest pla pas a pas. Executa cada
> comanda de verificació i confirma el resultat esperat abans de continuar. Si
> es dona qualsevol condició de la secció "Condicions de STOP", atura't i
> informa — no improvisis. En acabar, actualitza la fila d'aquest pla a
> `plans/README.md`.
>
> **Comprovació de deriva (executa-ho primer)**:
> `git diff --stat 23d9adf..HEAD -- .gitignore backend/`
> Si algun fitxer dins de l'abast ha canviat des que es va escriure el pla,
> compara els extractes de "Estat actual" amb el codi viu; si no coincideixen,
> tracta-ho com a condició de STOP.

## Estat

- **Prioritat**: P1
- **Esforç**: S
- **Risc**: BAIX
- **Depèn de**: cap (és el prerequisit de 002, 003, 004 i 005)
- **Categoria**: arquitectura
- **Planificat a**: commit `23d9adf`, 2026-06-11

## Per què importa

Tot el backend del projecte (`backend/`) està ignorat pel `.gitignore` arrel i
**no existeix a cap repositori git**. A més, el backend desplegat al VPS ha
divergit del `backend/server.js` local: els clients criden els endpoints
`/categorize` (vegeu `extension/shared/api.ts:109`) i `/process-tweet`
(vegeu `src/services/claudeService.ts:55`) que **no existeixen** al fitxer
local, i la configuració nginx (`nginx-config.conf:33`) fa proxy al port 3002
mentre el `server.js` local escolta el 3003. Això vol dir que el backend d'IA
(integració amb Groq) viu únicament al VPS: si el servidor es perd o es
corromp, es perd codi irrecuperable. Aquest pla recupera el codi desplegat,
el posa sota git i deixa documentat com es desplega.

## Estat actual

- `.gitignore` (arrel) — conté una línia `backend` que ignora tota la carpeta:

```gitignore
# .gitignore (línies 10-14)
node_modules
backend
dist
dist-ssr
*.local
```

- `backend/server.js` — versió local desfasada: API Express de 84 línies amb
  endpoints `/bookmarks`, `/categories`, `/deleted`, `/reset`. **No té** els
  endpoints d'IA `/categorize` ni `/process-tweet`. Escolta el port 3003
  (`backend/server.js:7`).
- `backend/db.json` i `backend/_db.json` — **dades d'usuari** (bookmarks).
  No s'han de commitejar mai.
- `backend/.gitignore` — existeix però amb indentació estranya i no ignora
  `db.json`:

```gitignore
node_modules/
  db.json.backup*
  *.log
```

- Desplegament: el VPS és `62.169.25.188`, usuari `root` (vegeu
  `deploy-to-vps.sh:15-16`). El frontend viu a
  `/home/masellas-links/htdocs/links.masellas.info`. El backend que serveix
  `https://links.masellas.info/api` escolta en un port local del VPS (el
  nginx d'exemple del repo apunta al 3002, però cal verificar la configuració
  real del VPS).
- `backend/package.json` — només `express` i `cors`; script `start`.

## Comandes que necessitaràs

| Propòsit | Comanda | Resultat esperat |
|---|---|---|
| Comprovar fitxers trackejats | `git ls-files backend/` | (abans) buit; (després) llista de fitxers |
| Sintaxi del backend | `node --check backend/server.js` | exit 0 |
| Accés al VPS | `ssh root@62.169.25.188 'echo ok'` | `ok` |
| Trobar el backend real al VPS | `ssh root@62.169.25.188 'ps aux \| grep -i node \| grep -v grep'` | processos node amb la ruta del servidor |

## Abast

**Dins de l'abast** (els únics fitxers que pots modificar):
- `.gitignore` (arrel) — treure la línia `backend`
- `backend/.gitignore` — afegir `db.json`, `_db.json`, `.env`
- `backend/**` — substituir/afegir el codi recuperat del VPS
- `backend/README.md` (crear) — documentació de desplegament
- `plans/README.md` — fila d'estat

**Fora de l'abast** (NO ho toquis encara que sembli relacionat):
- Qualsevol canvi funcional al codi del backend (els arreglen els plans 002–005).
- `nginx-config.conf` — és un exemple antic; documenta la discrepància, no l'"arreglis".
- La configuració del VPS (nginx, systemd/pm2) — només lectura.
- El secret d'API ni cap fitxer `.env` — mai a git.

## Flux de git

- Pots treballar directament a `main` (és la convenció observada del repo) o a
  una branca `advisor/001-backend-sota-git`.
- Missatges de commit curts i imperatius, com els existents
  (p. ex. `Corrected extension bug`). Suggerit: `track backend in git (recovered from VPS)`.
- NO facis push si l'operador no t'ho ha demanat.

## Passos

### Pas 1: Verifica l'accés SSH al VPS

`ssh root@62.169.25.188 'echo ok'`

**Verifica**: surt `ok`. Si demana contrasenya i no la tens, o falla la
connexió → condició de STOP.

### Pas 2: Localitza el backend desplegat real

Executa al VPS:
- `ps aux | grep -i node | grep -v grep` — anota les rutes dels processos.
- `ss -tlnp | grep -E '300[0-9]'` — anota quin procés escolta el port que
  nginx redirigeix (mira la config real: `grep -r 'proxy_pass' /etc/nginx/`).

**Verifica**: has identificat el directori del servidor que respon a
`https://links.masellas.info/api` i conté un endpoint `/categorize` (fes
`grep -rn 'categorize' <directori>` al VPS per confirmar-ho).

### Pas 3: Copia el codi desplegat en local

Des de la màquina local (substitueix `<DIR_VPS>` pel directori del pas 2):

```bash
rsync -avz --exclude 'node_modules' --exclude 'db.json*' --exclude '_db.json' --exclude '.env' \
  root@62.169.25.188:<DIR_VPS>/ ./backend-vps-snapshot/
```

Compara amb el `backend/` local: `diff -rq backend/ backend-vps-snapshot/`.
Substitueix el contingut de `backend/` pel del snapshot (conservant el
`backend/db.json` local intacte) i esborra `backend-vps-snapshot/`.

**IMPORTANT**: si al codi recuperat hi ha claus d'API (Groq, secret de l'API)
hardcodejades, NO les commitegis: extreu-les a variables d'entorn llegides amb
`process.env` i anota-ho a `backend/README.md`. El valor de cap clau no pot
aparèixer en cap fitxer trackejat.

**Verifica**: `node --check backend/server.js` → exit 0, i
`grep -n 'categorize' backend/server.js` (o el fitxer principal recuperat)
retorna almenys una línia.

### Pas 4: Arregla els .gitignore

1. A `.gitignore` arrel: elimina la línia `backend` (línia 12). No toquis res més.
2. Sobreescriu `backend/.gitignore` amb:

```gitignore
node_modules/
db.json
db.json.backup*
_db.json
.env
*.log
```

**Verifica**: `git check-ignore backend/server.js; echo $?` → exit 1 (ja NO
està ignorat), i `git check-ignore backend/db.json; echo $?` → exit 0 (les
dades SÍ que estan ignorades).

### Pas 5: Escriu backend/README.md

Document breu (20–40 línies) amb: port real d'escolta, com s'arrenca al VPS
(pm2/systemd/nohup — el que hagis trobat al pas 2), variables d'entorn
necessàries (noms, MAI valors), ruta de desplegament al VPS, i la nota que
`nginx-config.conf` de l'arrel és un exemple antic amb el port desfasat.

**Verifica**: el fitxer existeix i no conté cap valor de secret:
`grep -E '[a-f0-9]{32}' backend/README.md` → cap resultat.

### Pas 6: Commiteja

```bash
git add .gitignore backend/
git status   # revisa que db.json/_db.json/.env NO hi apareguin
git commit -m "track backend in git (recovered from VPS)"
```

**Verifica**: `git ls-files backend/ | grep -E 'db\.json|\.env'` → cap resultat.

## Pla de tests

Aquest pla no afegeix tests (el backend no té infraestructura de tests; el
pla 002 la introdueix). La verificació és `node --check` + les comprovacions
de git de cada pas.

## Criteris de finalització

Tots s'han de complir:

- [ ] `git ls-files backend/ | wc -l` ≥ 3 (server, package.json, README)
- [ ] `git ls-files backend/ | grep -E 'db\.json|_db\.json|\.env'` → buit
- [ ] `node --check backend/server.js` → exit 0
- [ ] El codi trackejat conté els endpoints `/categorize` i `/process-tweet`
      (grep retorna línies)
- [ ] `grep -rE '[a-f0-9]{32}' backend/ --include='*.js' --include='*.md' --include='*.json' -l` no retorna cap fitxer trackejat nou (cap secret commitejat)
- [ ] Fila actualitzada a `plans/README.md`

## Condicions de STOP

Atura't i informa (no improvisis) si:

- No tens accés SSH al VPS (pas 1) — el pla no es pot fer sense l'operador.
- Al VPS no trobes cap servidor amb l'endpoint `/categorize` — l'arquitectura
  real difereix del que assumeix aquest pla.
- El codi recuperat conté secrets que no pots extreure a `process.env` sense
  trencar el desplegament en marxa.
- El `diff` entre el backend local i el del VPS mostra que el VPS té MENYS
  funcionalitat que el local (indicaria que has copiat el directori equivocat).

## Notes de manteniment

- A partir d'ara, qualsevol canvi al backend s'ha de fer al repo i desplegar-se
  al VPS, mai editant directament al servidor. Considereu un script
  `deploy-backend.sh` anàleg a `deploy-to-vps.sh` (deixat fora d'abast aquí).
- Els plans 002 (escriptura atòmica), 003 (lectura pública), 004 (rotació del
  secret) i 005 (API incremental) modifiquen aquest backend: tots depenen que
  aquest pla estigui DONE.
- La reescriptura de l'historial de git per purgar el secret antic queda
  explícitament fora d'abast (es gestiona amb la rotació del pla 004).
