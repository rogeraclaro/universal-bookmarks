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
  UNKNOWN: "Error desconegut. Torna-ho a intentar.",
  CATEGORY_EXISTS: "Aquesta categoria ja existeix",
  CATEGORY_EMPTY: "El nom de la categoria no pot estar buit"
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
  DUPLICATE_MESSAGE: "Aquesta pàgina ja està guardada a la teva col·lecció.",
  NEW_CATEGORY_PLACEHOLDER: "Nova categoria...",
  ADD_CATEGORY: "Afegir",

  // Tabs feature strings (Catalan)
  TABS_HEADING: "Pestanyes Obertes",
  TABS_SAVE_THIS_PAGE: "Guardar aquesta pàgina",
  TABS_FILTER_ALL: "Totes",
  TABS_FILTER_UNGROUPED: "Sense grup",
  TABS_SELECT_ALL: "Seleccionar-ho tot",
  TABS_DESELECT_ALL: "Desseleccionar tot",
  TABS_SAVE_BUTTON: (n: number) => `Guardar ${n} pestanyes`,
  TABS_CONFIRM_TITLE: "Confirmar guardat",
  TABS_CONFIRM_MESSAGE: (n: number) => `Segur que vols guardar ${n} pestanyes?`,
  TABS_CONFIRM_YES: "Guardar",
  TABS_CONFIRM_CANCEL: "Cancel·lar",
  TABS_SAVING_HEADING: "Guardant pestanyes...",
  TABS_SUMMARY_HEADING: "Guardat completat",
  TABS_SUMMARY_SAVED: (n: number) => `${n} guardats \u2713`,
  TABS_SUMMARY_FAILED: (n: number) => `${n} fallits \u2717`,
  TABS_RETRY_FAILED: (n: number) => `Reintentar ${n} fallits`,
  TABS_CLOSE: "Tancar",
  TABS_ALREADY_SAVED_BADGE: "\u2713 guardat",
  TABS_LOADING: "Carregant pestanyes...",
  TABS_EMPTY: "No hi ha pestanyes obertes",
  TABS_CATEGORIZING_HEADING: "Categoritzant amb IA...",
  TABS_REVIEW_HEADING: "Revisa les categories",
  TABS_REVIEW_ADD_PLACEHOLDER: "Afegir categoria...",
  TABS_REVIEW_SAVE_BUTTON: (n: number) => `Guardar ${n} pestanyes`,
  TABS_REVIEW_NO_CATEGORIES: "Sense categoria",
  TABS_REVIEW_OPEN_TAB: "Obrir pestanya"
};

// Claude proxy — local server that uses claude -p CLI subprocess
export const CLAUDE_PROXY_URL = 'http://localhost:3839';
