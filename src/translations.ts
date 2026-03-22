

export const strings = {
  app: {
    title: "Universal Bookmarks",
    importJson: "Importar JSON",
    exportData: "Exportar Còpia",
    downloadRejected: "Descarregar Rebutjats ({0})",
    resetData: "RESET APP",
    processing: "Processant",
    stop: "Aturar",
    addManual: "Afegir Manual",
    categories: "Categories",
    noDataTitle: "NO HI HA DADES",
    noDataDesc: "Puja un fitxer JSON dels teus marcadors de Twitter per començar, o restaura una còpia de seguretat.",
    viewOriginal: "Veure Original",
    emptyCategory: "Buit",
    total: "Total",
    catLabel: "Categories",
    processingProgress: "Processant {0}%...",
    jumpTo: "Dreceres:",
    highlight: "Destacar",
    unhighlight: "No destacar",
    highlightedCategory: "DESTACAT",
  },
  logs: {
    title: "Registre d'Importació",
    start: "Iniciant procés d'importació...",
    batchStart: "Processant enllaç {0} de {1}...",
    batchSuccess: "✓ Enllaç processat correctament",
    ratelimitHit: "⚠️ Límit API assolit (429). Pausant {0} segons per refredar...",
    retrying: "🔄 Reintentant processar l'enllaç...",
    error: "❌ Error processant el paquet: {0}",
    finished: "Procés finalitzat.",
    stopped: "Procés aturat per l'usuari.",
    analyzing: "Analitzant contingut amb Claude...",
    cooldown: "⏳ Pausa de seguretat entre peticions..."
  },
  modal: {
    createTitle: "Crear Nou Bookmark",
    editTitle: "Editar Bookmark",
    deleteTitle: "Esborrar Bookmark",
    manageCategories: "Gestionar Categories",
    successTitle: "Importació Finalitzada",
    attentionTitle: "Atenció",
    errorTitle: "Error",
    labelTitle: "Títol",
    labelCategory: "Categoria",
    labelDescription: "Descripció",
    labelAuthor: "Autor",
    labelOriginalLink: "Enllaç Original",
    labelExternalLinks: "Enllaços Externs (separats per coma)",
    placeholderExternalLinks: "https://example.com, https://github.com...",
    placeholderNewCategory: "Nova Categoria...",
    btnCancel: "Cancel·lar",
    btnSave: "Desar Canvis",
    btnAdd: "Afegir",
    btnDelete: "Esborrar Definitivament",
    btnCloseConsole: "Tancar Consola",
    btnOk: "D'acord"
  },
  alerts: {
    confirmDelete: "Estàs segur que vols esborrar aquest bookmark? No es tornarà a importar en el futur.",
    confirmDeleteCategory: "Esborrar categoria \"{0}\"? Els bookmarks passaran a 'Altres'.",
    confirmReset: "⚠️ PERILL: Això esborrarà TOTS els bookmarks, categories i la llista d'ignorats permanentment. Estàs segur?",
    noValidTweets: "No s'han trobat enllaços vàlids al fitxer JSON.",
    importError: "Error en processar el fitxer. Assegura't que és un JSON vàlid.",
    genericError: "Hi ha hagut un error inesperat.",
    apiKeyMissing: "No s'ha trobat la API Key",
    backupRestored: "Còpia de seguretat restaurada correctament.",
    backupMerge: "S'han fusionat les dades. {0} nous afegits, {1} duplicats ignorats.",
    importResult: "Procés completat. {0} nous bookmarks afegits. {1} duplicats o prèviament esborrats ignorats.",
    processAborted: "Procés aturat per l'usuari."
  },
  defaults: {
    categories: [
      "Tecnologia",
      "Programació",
      "Disseny",
      "Notícies",
      "Articles",
      "Tutorials",
      "Recursos",
      "Altres"
    ],
    uncategorized: "Altres",
    untitled: "Sense títol",
    noDescription: "Sense descripció",
    unknownAuthor: "Unknown"
  },
  prompts: {
    systemInstruction: (categoriesString: string) => `
    Actua com un expert curador de contingut web.
    La teva tasca és analitzar i categoritzar una llista d'enllaços i continguts.

    Per a cada element:
    1. Genera un 'title' MOLT CURT (màxim 10 paraules, 80 caràcters) i descriptiu en CATALÀ.
    2. Assigna una o més 'categories' de la següent llista: [${categoriesString}]. Un element pot pertànyer a múltiples categories si tracta diversos temes. Si no encaixa bé, fes servir 'Altres'.
    3. Extreu enllaços externs rellevants ('externalLinks') que apareguin al text o metadades, excloent enllaços a twitter.com o x.com.

    NOTA: NO generis un resum ni descripció. Farem servir el text original.
    IMPORTANT: El títol ha de ser CONCÍS i NO pot excedir els 80 caràcters. NO incloguis el teu procés de pensament ni explicacions. Només el títol final.
  `
  }
};