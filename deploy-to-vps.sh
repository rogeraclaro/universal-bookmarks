#!/bin/bash

# Colors per millor llegibilitat
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Deploy Universal Bookmarks al VPS    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Variables de configuració
VPS_IP="62.169.25.188"
VPS_USER="root"
VPS_DIR="/home/masellas-links/htdocs/links.masellas.info"
LOCAL_DIST="./dist"

# Verificar que existeix el directori dist/
if [ ! -d "$LOCAL_DIST" ]; then
    echo -e "${RED}❌ Error: No existeix el directori dist/${NC}"
    echo -e "${YELLOW}   Executa primer: npm run build${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Preparant fitxers per pujar...${NC}"
echo -e "   📍 Origen: $LOCAL_DIST"
echo -e "   📍 Destí:  $VPS_USER@$VPS_IP:$VPS_DIR"
echo ""

# Crear un backup al VPS abans de sobreescriure
echo -e "${YELLOW}🔄 Creant backup al servidor...${NC}"
ssh $VPS_USER@$VPS_IP "if [ -d '$VPS_DIR' ]; then cp -r $VPS_DIR ${VPS_DIR}.backup-$(date +%Y%m%d-%H%M%S); fi"

# Crear el directori si no existeix
echo -e "${YELLOW}📁 Creant directori al servidor si no existeix...${NC}"
ssh $VPS_USER@$VPS_IP "mkdir -p $VPS_DIR"

# Pujar els fitxers
echo -e "${YELLOW}📤 Pujant fitxers al VPS...${NC}"
echo -e "   ${GREEN}Això pot trigar uns segons...${NC}"
echo ""

rsync -avz --progress --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    $LOCAL_DIST/ $VPS_USER@$VPS_IP:$VPS_DIR/

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Fitxers pujats correctament!${NC}"
    echo ""

    # Verificar els fitxers
    echo -e "${YELLOW}🔍 Verificant fitxers al servidor...${NC}"
    ssh $VPS_USER@$VPS_IP "ls -lah $VPS_DIR"

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ DEPLOY COMPLETAT AMB ÈXIT          ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}📋 Propers passos:${NC}"
    echo -e "   1. Configurar Nginx (segueix les instruccions)"
    echo -e "   2. Reiniciar Nginx"
    echo -e "   3. Accedir a: ${GREEN}https://links.masellas.info${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Error pujant els fitxers${NC}"
    echo -e "${YELLOW}   Comprova la connexió SSH i torna-ho a intentar${NC}"
    exit 1
fi
