# 📦 Script per dividir tweets en lots

## 🎯 Què fa aquest script?

L'script `split-tweets.sh` agafa un fitxer JSON amb tweets i:

1. ✅ **Reordena** els tweets de **més antic a més modern**
2. ✅ **Divideix** en fitxers de **10 tweets** cada un
3. ✅ **Numera** consecutivament: `tweets-001.json`, `tweets-002.json`, etc.
4. ✅ **Crea** un directori amb tots els fitxers generats

---

## 🚀 Com usar-lo

### Ús bàsic:

```bash
./split-tweets.sh bookmarks.json
```

### Exemple complet:

```bash
cd /Users/rogermasellas/AI/AI\ Bookmark\ Manager/ai-bookmarks
./split-tweets.sh ~/Downloads/bookmarks.json
```

---

## 📂 Què crea?

Si tens un fitxer `bookmarks.json` amb 47 tweets, l'script crearà:

```
bookmarks-split/
├── tweets-001.json  (10 tweets)
├── tweets-002.json  (10 tweets)
├── tweets-003.json  (10 tweets)
├── tweets-004.json  (10 tweets)
└── tweets-005.json  (7 tweets)
```

---

## 📋 Exemples d'ús

### 1. Dividir el fitxer de bookmarks descarregat de Twitter:

```bash
./split-tweets.sh ~/Downloads/bookmarks.json
```

**Output:**
```
🔄 Processant tweets...
📊 Total de tweets: 47
🔄 Tweets reordenats de més antic a més modern
✅ Creat: tweets-001.json (10 tweets)
✅ Creat: tweets-002.json (10 tweets)
✅ Creat: tweets-003.json (10 tweets)
✅ Creat: tweets-004.json (10 tweets)
✅ Creat: tweets-005.json (7 tweets)

🎉 Procés completat! S'han creat 5 fitxers
📁 Fitxers guardats a: bookmarks-split/
```

### 2. Dividir un fitxer que està al directori actual:

```bash
./split-tweets.sh my-tweets.json
```

Crea: `my-tweets-split/tweets-001.json`, `tweets-002.json`, etc.

---

## 🎯 Flux de treball recomanat

### Per evitar límits de l'API de Gemini:

1. **Divideix** el JSON gran:
   ```bash
   ./split-tweets.sh bookmarks.json
   ```

2. **Importa els lots** un per un a l'app:
   - Importa `tweets-001.json`
   - Espera que acabi de processar
   - Importa `tweets-002.json`
   - I així successivament...

3. **Distribueix** les importacions durant el dia:
   - **Matí**: Importa lots 1-2 (20 tweets)
   - **Tarda**: Importa lots 3-4 (20 tweets)
   - **Vespre**: Importa lot 5 (7 tweets)

Això et permet processar **47 tweets sense arribar al límit diari** de Gemini (1.500 requests/dia).

---

## ⚠️ Errors comuns

### Error: "Permission denied"

**Solució:**
```bash
chmod +x split-tweets.sh
```

### Error: "File not found"

**Solució:** Verifica que el fitxer existeix:
```bash
ls -lh bookmarks.json
```

### Error: "python3: command not found"

**Solució:** Instal·la Python 3 (ja hauria d'estar al Mac):
```bash
python3 --version
```

---

## 💡 Consells

### 1. Verificar el contingut abans d'importar:

```bash
# Veure quants tweets té cada fitxer
wc -l bookmarks-split/*.json

# Veure el primer tweet del primer lot
head -20 bookmarks-split/tweets-001.json
```

### 2. Esborrar fitxers anteriors:

```bash
rm -rf bookmarks-split/
```

### 3. Canviar la mida dels lots:

Edita l'script i canvia `batch_size = 10` per el valor que vulguis (línia 67):

```python
batch_size = 20  # Ara crea lots de 20 tweets
```

---

## 🔧 Ubicació de l'script

```
/Users/rogermasellas/AI/AI Bookmark Manager/ai-bookmarks/split-tweets.sh
```

---

## 📞 Ajuda

Si tens problemes, comprova:
- ✅ Que el fitxer JSON és vàlid
- ✅ Que tens Python 3 instal·lat
- ✅ Que l'script té permisos d'execució
- ✅ Que estàs executant l'script des del directori correcte

---

**Creat**: 7 de desembre de 2025
**Versió**: 1.0
