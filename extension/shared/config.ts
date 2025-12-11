// API Configuration
export const API_CONFIG = {
  BASE_URL: 'https://links.masellas.info/api',
  SECRET: '4eb6fd03128af657e3b37c1467d00823',
  HEADERS: {
    'Content-Type': 'application/json',
    'x-api-secret': '4eb6fd03128af657e3b37c1467d00823'
  }
};

// Error messages in Catalan
export const ERRORS = {
  NO_TITLE: "El títol no pot estar buit",
  TITLE_TOO_LONG: "El títol no pot superar els 80 caràcters",
  NO_CATEGORY: "Selecciona almenys una categoria",
  DUPLICATE: "Aquest enllaç ja està guardat",
  API_ERROR: "Error de connexió amb el servidor",
  UNKNOWN: "Error desconegut. Torna-ho a intentar."
};

// UI strings in Catalan
export const UI_STRINGS = {
  TITLE: "Universal Bookmark Manager",
  LOADING: "Carregant informació...",
  SAVE: "Afegir Bookmark",
  CANCEL: "Cancel·lar",
  CLOSE: "Tancar",
  RETRY: "Reintentar",
  LABEL_TITLE: "Títol:",
  LABEL_DESCRIPTION: "Descripció:",
  LABEL_AUTHOR: "Autor:",
  LABEL_URL: "URL:",
  LABEL_CATEGORIES: "Categories:",
  SUCCESS: "Bookmark afegit correctament!",
  DUPLICATE_WARNING: "Aquest enllaç ja existeix!",
  DUPLICATE_MESSAGE: "Aquesta pàgina ja està guardada a la teva col·lecció."
};
