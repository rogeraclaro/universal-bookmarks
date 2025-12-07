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
python3 << 'PYTHON_SCRIPT'
import json
import sys
from datetime import datetime

# Llegir l'argument
input_file = sys.argv[1]
output_dir = sys.argv[2]

# Carregar el JSON
with open(input_file, 'r', encoding='utf-8') as f:
    tweets = json.load(f)

print(f"📊 Total de tweets: {len(tweets)}")

# Funció per obtenir la data d'un tweet
def get_tweet_date(tweet):
    date_str = tweet.get('created_at', '')
    if not date_str:
        return datetime.min
    try:
        # Format de data de Twitter: "Wed Oct 10 20:19:24 +0000 2018"
        return datetime.strptime(date_str, "%a %b %d %H:%M:%S %z %Y")
    except:
        return datetime.min

# Ordenar per data (més antic primer)
tweets_sorted = sorted(tweets, key=get_tweet_date)

print(f"🔄 Tweets reordenats de més antic a més modern")

# Dividir en lots de 10
batch_size = 10
total_batches = (len(tweets_sorted) + batch_size - 1) // batch_size

for i in range(0, len(tweets_sorted), batch_size):
    batch = tweets_sorted[i:i + batch_size]
    batch_num = (i // batch_size) + 1

    output_file = f"{output_dir}/tweets-{batch_num:03d}.json"

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(batch, f, ensure_ascii=False, indent=2)

    print(f"✅ Creat: tweets-{batch_num:03d}.json ({len(batch)} tweets)")

print(f"\n🎉 Procés completat! S'han creat {total_batches} fitxers")
print(f"📁 Fitxers guardats a: {output_dir}/")

PYTHON_SCRIPT python3 - "$INPUT_FILE" "$OUTPUT_DIR"

echo ""
echo -e "${GREEN}✨ Tots els fitxers JSON han estat creats correctament!${NC}"
echo -e "${BLUE}📁 Directori de sortida: $OUTPUT_DIR/${NC}"
echo ""
echo -e "${YELLOW}💡 Consell: Importa els fitxers un per un a l'app per evitar límits de l'API${NC}"
