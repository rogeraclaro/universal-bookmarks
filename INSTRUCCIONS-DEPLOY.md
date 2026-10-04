# 🚀 Instruccions de Deploy al VPS

## Informació del Servidor

- **IP:** 62.169.25.188
- **Usuari:** root
- **Directori:** `/home/masellas-ailinksdb/htdocs/ailinksdb.masellas.info`
- **Domini:** ailinksdb.masellas.info
- **Port API Backend:** 3002

---

## 📋 Requisits Previs (JA COMPLETAT ✅)

- [x] Build del frontend (`npm run build`) → Fitxers a `dist/`
- [x] Backend funcionant al port 3002
- [x] Variables d'entorn correctes al `.env`

---

## PART 1: PUJAR FITXERS AL VPS 📤

### Pas 1.1: Executar Script de Deploy

Des del teu Mac, a la carpeta del projecte, executa:

```bash
chmod +x deploy-to-vps.sh
./deploy-to-vps.sh
```

**Què fa aquest script?**
- Crea un backup automàtic dels fitxers antics
- Crea el directori si no existeix
- Puja tots els fitxers del directori `dist/` al VPS
- Verifica que tot s'ha pujat correctament

**⚠️ IMPORTANT:** El script et demanarà la contrasenya SSH **3 vegades**:
1. Per crear el backup
2. Per crear el directori
3. Per pujar els fitxers amb rsync

### Pas 1.2: Verificar que els fitxers s'han pujat

Connecta't al VPS per SSH:

```bash
ssh root@62.169.25.188
```

Un cop dins, comprova els fitxers:

```bash
ls -lah /home/masellas-ailinksdb/htdocs/ailinksdb.masellas.info
```

**Hauries de veure:**
```
total 16K
drwxr-xr-x 3 root root 4.0K Dec  4 23:00 .
drwxr-xr-x 3 root root 4.0K Dec  4 23:00 ..
drwxr-xr-x 2 root root 4.0K Dec  4 23:00 assets
-rw-r--r-- 1 root root  459 Dec  4 23:00 index.html
-rw-r--r-- 1 root root 1.5K Dec  4 23:00 vite.svg
```

✅ Si veus aquests fitxers, **tot està correcte!**

---

## PART 2: CONFIGURAR NGINX 🌐

### Pas 2.1: Crear Fitxer de Configuració Nginx

Encara connectat al VPS via SSH, crea el fitxer de configuració:

```bash
nano /etc/nginx/sites-available/ailinksdb.masellas.info
```

### Pas 2.2: Copiar la Configuració

Copia **tot** el contingut del fitxer `nginx-config.conf` que tens al teu Mac.

Per veure'l fàcilment, des d'una **altra terminal al teu Mac** executa:

```bash
cat /Users/rogermasellas/AI/AI\ Bookmark\ Manager/ai-bookmarks/nginx-config.conf
```

**Enganxa tot el contingut** dins del nano que has obert al VPS.

### Pas 2.3: Guardar i Tancar

- Prem `Ctrl + O` per guardar
- Prem `Enter` per confirmar
- Prem `Ctrl + X` per sortir

### Pas 2.4: Activar el Site (Crear Symlink)

```bash
ln -sf /etc/nginx/sites-available/ailinksdb.masellas.info /etc/nginx/sites-enabled/
```

### Pas 2.5: Verificar la Configuració

```bash
nginx -t
```

**Sortida esperada:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

✅ Si veus això, **la configuració és correcta!**

❌ Si hi ha errors, revisa que has copiat bé la configuració.

### Pas 2.6: Reiniciar Nginx

```bash
systemctl restart nginx
```

Comprova que està funcionant:

```bash
systemctl status nginx
```

**Hauries de veure:** `active (running)` en verd.

---

## PART 3: CONFIGURAR DNS 🌍

### Pas 3.1: Afegir Registre DNS

Al teu proveïdor de DNS (on tens el domini `masellas.info`), afegeix un registre:

**Tipus:** A Record
**Nom:** ailinksdb
**Valor:** 62.169.25.188
**TTL:** 3600 (o automàtic)

**Exemple visual:**
```
Tipus    Nom         Valor            TTL
A        ailinksdb   62.169.25.188    3600
```

### Pas 3.2: Esperar Propagació

La propagació DNS pot trigar entre **5 minuts i 48 hores** (normalment 15-30 minuts).

Per comprovar si ja està propagat:

```bash
nslookup ailinksdb.masellas.info
```

o

```bash
ping ailinksdb.masellas.info
```

Hauries de veure la IP `62.169.25.188`.

---

## PART 4: ACTUALITZAR VARIABLES D'ENTORN (OPCIONAL) 🔧

Si vols que l'app utilitzi el domini en lloc de la IP, actualitza el `.env`:

### Al teu Mac:

```bash
nano /Users/rogermasellas/AI/AI\ Bookmark\ Manager/ai-bookmarks/.env
```

Canvia:
```env
VITE_STORAGE_API_URL=http://62.169.25.188:3002
```

Per:
```env
VITE_STORAGE_API_URL=http://ailinksdb.masellas.info/api
```

Després:
```bash
npm run build
./deploy-to-vps.sh
```

**Nota:** Això és opcional. L'app funcionarà igualment amb la IP directa.

---

## PART 5: VERIFICAR QUE TOT FUNCIONA ✅

### Pas 5.1: Accedir a l'Aplicació

Obre el navegador i ves a:

```
http://ailinksdb.masellas.info
```

**Hauries de veure:**
- La interfície de l'aplicació carregant correctament
- El logo i els botons
- Les categories (si ja tens bookmarks)

### Pas 5.2: Testejar la Funcionalitat

1. **Pujar un JSON de Twitter:**
   - Clica el botó de pujada
   - Selecciona un fitxer JSON
   - Hauria de processar els tweets amb DeepSeek (via el backend)

2. **Verificar que es guarda al servidor:**
   - Els bookmarks es guarden al VPS (db.json)
   - Si recarregues la pàgina, els bookmarks segueixen allà

3. **Provar des d'un altre dispositiu:**
   - Obre `http://ailinksdb.masellas.info` des del mòbil
   - Hauries de veure les mateixes dades

### Pas 5.3: Verificar els Logs (Si hi ha errors)

**Al VPS:**

```bash
# Logs del frontend (Nginx)
tail -f /var/log/nginx/ailinksdb-error.log

# Logs del backend (PM2)
pm2 logs ai-bookmarks
```

---

## 🔥 TROUBLESHOOTING - Solució de Problemes

### Error: "502 Bad Gateway"

**Problema:** El backend no està funcionant

**Solució:**
```bash
ssh root@62.169.25.188
pm2 status
pm2 restart ai-bookmarks
```

### Error: "Connection refused" o "API error"

**Problema:** El port 3002 no està accessible

**Solució:**
```bash
# Verifica que el backend està funcionant
curl http://localhost:3002/bookmarks -H "x-api-secret: $API_SECRET"

# Verifica el firewall
ufw status
ufw allow 3002/tcp  # Si està bloquejat
```

### Error: "404 Not Found" en carregar l'app

**Problema:** Nginx no troba els fitxers

**Solució:**
```bash
# Verifica que els fitxers existeixen
ls -lah /home/masellas-ailinksdb/htdocs/ailinksdb.masellas.info

# Verifica els permisos
chmod -R 755 /home/masellas-ailinksdb/htdocs/ailinksdb.masellas.info
```

### La pàgina carrega però no funciona la IA

**Problema:** `DEEPSEEK_API_KEY` o `API_SECRET` no estan configurades al backend

**Solució:**
- La clau de DeepSeek viu NOMÉS al `.env` del servidor (mai en variables `VITE_*`)
- El backend no arrenca sense `API_SECRET`; el frontend ha de tenir `VITE_STORAGE_SECRET` amb el mateix valor (compilat al build)
- Si canvies el `.env` del servidor, reinicia el procés PM2; si canvies `VITE_STORAGE_SECRET`, fes `npm run build` i torna a pujar

### No puc accedir des d'un altre dispositiu

**Problema:** DNS no està propagat o firewall bloqueja

**Solució:**
```bash
# Comprova DNS
nslookup ailinksdb.masellas.info

# Comprova firewall
ufw status
ufw allow 80/tcp
ufw allow 443/tcp
```

---

## 🎯 RESUM DELS COMANDAMENTS

### Des del teu Mac:

```bash
# 1. Pujar fitxers
./deploy-to-vps.sh

# 2. Si canvies codi, tornar a fer build i pujar
npm run build
./deploy-to-vps.sh
```

### Al VPS (via SSH):

```bash
# Comprovar backend
pm2 status
pm2 logs ai-bookmarks

# Reiniciar backend
pm2 restart ai-bookmarks

# Reiniciar Nginx
systemctl restart nginx

# Comprovar logs
tail -f /var/log/nginx/ailinksdb-error.log
```

---

## 📚 FITXERS IMPORTANTS AL VPS

```
/home/masellas-ailinksdb/htdocs/ailinksdb.masellas.info/  → Frontend (React)
/root/ai-bookmarks-backend/server.js                      → Backend (Express)
/root/ai-bookmarks-backend/db.json                        → Base de dades
/etc/nginx/sites-available/ailinksdb.masellas.info        → Config Nginx
/var/log/nginx/ailinksdb-error.log                        → Logs frontend
```

---

## 🔄 FUTURES ACTUALITZACIONS

Cada cop que facis canvis al codi:

1. **Build local:**
   ```bash
   npm run build
   ```

2. **Pujar al VPS:**
   ```bash
   ./deploy-to-vps.sh
   ```

3. **Refrescar navegador** (Ctrl+Shift+R per forçar recàrrega)

**NO cal reiniciar Nginx** si només canvies el frontend.

**SÍ cal reiniciar PM2** si canvies el backend:
```bash
ssh root@62.169.25.188
pm2 restart ai-bookmarks
```

---

## ✅ CHECKLIST FINAL

- [ ] Fitxers pujats al VPS (`deploy-to-vps.sh`)
- [ ] Configuració Nginx creada i activada
- [ ] Nginx reiniciat sense errors (`nginx -t`)
- [ ] Registre DNS creat (A record)
- [ ] Backend funcionant (`pm2 status`)
- [ ] App accessible a `http://ailinksdb.masellas.info`
- [ ] Pots pujar JSON i processar tweets
- [ ] Les dades es guarden correctament
- [ ] Accessible des d'altres dispositius

---

**Si tens qualsevol problema, consulta la secció de TROUBLESHOOTING o comprova els logs!**

🎉 Felicitats! La teva app ja està en producció!
