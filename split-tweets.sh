#!/bin/bash

# Script per dividir un JSON de tweets en lots de 10
# Ús: ./split-tweets.sh input.json

set -e

# Colors per l'output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar que s'ha passat un fitxer
if [ -z "$1" ]; then
    echo -e "${YELLOW}Ús: ./split-tweets.sh <fitxer-tweets.json>${NC}"
    echo "Exemple: ./split-tweets.sh bookmarks.json"
    exit 1
fi

INPUT_FILE="$1"

# Verificar que el fitxer existeix
if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${YELLOW}Error: El fitxer '$INPUT_FILE' no existeix${NC}"
    exit 1
fi

# Obtenir el nom del fitxer sense extensió
BASENAME=$(basename "$INPUT_FILE" .json)

# Crear directori de sortida
OUTPUT_DIR="${BASENAME}-split"
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}🔄 Processant tweets...${NC}"

# Usar Python per processar el JSON
python3 - "$INPUT_FILE" "$OUTPUT_DIR" << 'END_PYTHON'
import json
import sys
from datetime import datetime

# Llegir arguments
input_file = sys.argv[1]
output_dir = sys.argv[2]

# Carregar el JSON
with open(input_file, 'r', encoding='utf-8') as f:
    tweets = json.load(f)

print(f"📊 Total de tweets: {len(tweets)}")

# Funció per obtenir la data d'un tweet
def get_tweet_date(tweet):
    # Provar amb 'timestamp' primer (format numèric Unix timestamp)
    if 'timestamp' in tweet:
        try:
            return datetime.fromtimestamp(int(tweet['timestamp']))
        except:
            pass

    # Provar amb 'created_at' (format string)
    date_str = tweet.get('created_at', '')
    if date_str:
        try:
            # Format de data de Twitter: "Wed Oct 10 20:19:24 +0000 2018"
            return datetime.strptime(date_str, "%a %b %d %H:%M:%S %z %Y")
        except:
            pass

    return datetime.min

# Comprovar si els tweets tenen dates
has_dates = any(get_tweet_date(t) != datetime.min for t in tweets[:5])

if has_dates:
    # Ordenar per data (més antic primer)
    tweets_sorted = sorted(tweets, key=get_tweet_date, reverse=False)
else:
    # Si no hi ha dates, invertir l'ordre del JSON
    # (Twitter exporta amb més recents primer, volem més antics primer)
    tweets_sorted = list(reversed(tweets))
    print("⚠️  Tweets sense dates 'created_at', invertint ordre del JSON...")

# Mostrar dates del primer i últim tweet per verificar
if tweets_sorted:
    first_date = get_tweet_date(tweets_sorted[0])
    last_date = get_tweet_date(tweets_sorted[-1])
    print(f"📅 Tweet més antic (001): {first_date.strftime('%Y-%m-%d %H:%M:%S') if first_date != datetime.min else 'Data desconeguda'}")
    print(f"📅 Tweet més recent (últim fitxer): {last_date.strftime('%Y-%m-%d %H:%M:%S') if last_date != datetime.min else 'Data desconeguda'}")

print(f"🔄 Tweets ordenats: més antics (001) → més recents (últim)")

# Dividir en lots de 10
batch_size = 10
total_batches = (len(tweets_sorted) + batch_size - 1) // batch_size

for i in range(0, len(tweets_sorted), batch_size):
    batch = tweets_sorted[i:i + batch_size]
    batch_num = (i // batch_size) + 1

    # Mostrar data del primer tweet del batch
    first_tweet_date = get_tweet_date(batch[0])
    date_str = first_tweet_date.strftime('%Y-%m-%d') if first_tweet_date != datetime.min else 'sense data'

    output_file = f"{output_dir}/tweets-{batch_num:03d}.json"

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(batch, f, ensure_ascii=False, indent=2)

    print(f"✅ Creat: tweets-{batch_num:03d}.json ({len(batch)} tweets - des de {date_str})")

print(f"\n🎉 Procés completat! S'han creat {total_batches} fitxers")
print(f"📁 Fitxers guardats a: {output_dir}/")
END_PYTHON

echo ""
echo -e "${GREEN}✨ Tots els fitxers JSON han estat creats correctament!${NC}"
echo -e "${BLUE}📁 Directori de sortida: $OUTPUT_DIR/${NC}"
echo ""
echo -e "${YELLOW}💡 Consell: Importa els fitxers un per un a l'app per evitar límits de l'API${NC}"
