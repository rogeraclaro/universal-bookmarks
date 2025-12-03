

export const strings = {
  app: {
    title: "AI Bookmarks",
    importJson: "Importar JSON",
    exportData: "Exportar Còpia",
    downloadRejected: "Descarregar No-IA ({0})",
    resetData: "RESET APP",
    processing: "Processant",
    stop: "Aturar",
    addManual: "Afegir Manual",
    categories: "Categories",
    noDataTitle: "NO HI HA DADES",
    noDataDesc: "Puja un fitxer JSON dels teus marcadors de Twitter per començar, o restaura una còpia de seguretat.",
    viewOriginal: "Veure Tuit Original",
    emptyCategory: "Buit",
    total: "Total",
    catLabel: "Categories",
    processingProgress: "Processant {0}%...",
    jumpTo: "Dreceres:",
  },
  logs: {
    title: "Registre d'Importació",
    start: "Iniciant procés d'importació...",
    batchStart: "Processant tuit {0} de {1}...",
    batchSuccess: "✓ Tuit processat correctament",
    ratelimitHit: "⚠️ Límit API assolit (429). Pausant {0} segons per refredar...",
    retrying: "🔄 Reintentant processar el tuit...",
    error: "❌ Error processant el paquet: {0}",
    finished: "Procés finalitzat.",
    stopped: "Procés aturat per l'usuari.",
    analyzing: "Analitzant contingut amb Gemini...",
    cooldown: "⏳ Pausa de seguretat entre peticions..."
  },
  modal: {
    createTitle: "Crear Nou Bookmark",
    editTitle: "Editar Bookmark",
    deleteTitle: "Esborrar Bookmark",
    manageCategories: "Gestionar Categories",
    labelTitle: "Títol",
    labelCategory: "Categoria",
    labelDescription: "Descripció",
    labelOriginalLink: "Enllaç Original (Twitter)",
    labelExternalLinks: "Enllaços Externs (separats per coma)",
    placeholderExternalLinks: "https://example.com, https://github.com...",
    placeholderNewCategory: "Nova Categoria...",
    btnCancel: "Cancel·lar",
    btnSave: "Desar Canvis",
    btnAdd: "Afegir",
    btnDelete: "Esborrar Definitivament",
    btnCloseConsole: "Tancar Consola"
  },
  alerts: {
    confirmDelete: "Estàs segur que vols esborrar aquest bookmark? No es tornarà a importar en el futur.",
    confirmDeleteCategory: "Esborrar categoria \"{0}\"? Els bookmarks passaran a 'Altres'.",
    confirmReset: "⚠️ PERILL: Això esborrarà TOTS els bookmarks, categories i la llista d'ignorats permanentment. Estàs segur?",
    noValidTweets: "No s'han trobat tuits vàlids al fitxer JSON.",
    importError: "Error en processar el fitxer. Assegura't que és un JSON vàlid.",
    genericError: "Hi ha hagut un error inesperat.",
    apiKeyMissing: "No s'ha trobat la API Key",
    backupRestored: "Còpia de seguretat restaurada correctament.",
    backupMerge: "S'han fusionat les dades. {0} nous afegits, {1} duplicats ignorats.",
    importResult: "Procés completat. {0} nous bookmarks IA afegits. {1} duplicats o prèviament esborrats ignorats. {2} descartats (No IA).",
    processAborted: "Procés aturat per l'usuari."
  },
  defaults: {
    categories: [
      "Divulgació",
      "Agents",
      "Skills",
      "RAG",
      "Cursos",
      "Notícies",
      "Eines",
      "Altres"
    ],
    uncategorized: "Altres",
    untitled: "Sense títol",
    noDescription: "Sense descripció"
  },
  prompts: {
    systemInstruction: (categoriesString: string) => `
    Actua com un expert curador de contingut d'Intel·ligència Artificial (IA).
    La teva tasca és analitzar una llista de tuits.
    
    Per a cada tuit:
    1. Determina si el contingut està relacionat estrictament amb la Intel·ligència Artificial (IA), Machine Learning, LLMs, Data Science, etc.
    2. Si NO és relacionat amb IA, marca 'isAI' com a false.
    3. Si ÉS relacionat amb IA:
       - Marca 'isAI' com a true.
       - Genera un 'title' curt i descriptiu en CATALÀ.
       - Genera una 'description' (resum) d'1 o 2 frases en CATALÀ explicant el valor del recurs o notícia.
       - Assigna una 'category' de la següent llista: [${categoriesString}]. Si no encaixa bé, fes servir 'Altres'.
       - Extreu enllaços externs rellevants ('externalLinks') que apareguin al text o metadades, excloent enllaços a twitter.com o x.com.
  `
  }
};