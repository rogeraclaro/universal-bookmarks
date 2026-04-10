import { useState, useEffect } from 'react';

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)
const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)
import type { Bookmark } from '../../extension/shared/types';
import { getCategories, saveBookmark, isDuplicate } from './api';
import { parseShareParams, resolveAuthorFromUrl } from './utils';

const ERRORS = {
  NO_TITLE: "El títol no pot estar buit",
  TITLE_TOO_LONG: "El títol no pot superar els 80 caràcters",
  DUPLICATE: "Aquest enllaç ja està guardat",
  API_ERROR: "Error de connexió amb el servidor",
  UNKNOWN: "Error desconegut. Torna-ho a intentar.",
  CATEGORY_EXISTS: "Aquesta categoria ja existeix",
  CATEGORY_EMPTY: "El nom de la categoria no pot estar buit",
};

const UI = {
  TITLE: "Universal Bookmarks",
  LOADING: "Carregant enllaços...",
  SAVE: "Afegir Bookmark",
  CANCEL: "Cancel·lar",
  CLOSE: "Tancar",
  RETRY: "Reintentar",
  SUCCESS: "Bookmark afegit correctament!",
  DUPLICATE_WARNING: "Aquest enllaç ja existeix!",
  DUPLICATE_MESSAGE: "Aquesta pàgina ja està guardada a la teva col·lecció.",
  NEW_CATEGORY_PLACEHOLDER: "Nova categoria...",
  ADD_CATEGORY: "Afegir",
};

type ViewState = 'loading' | 'form' | 'duplicate' | 'success' | 'error';

export default function App() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { url: sharedUrl, title: sharedTitle } = parseShareParams(window.location.search);
    setUrl(sharedUrl);
    setTitle(sharedTitle);

    try {
      const cats = await getCategories();
      setCategories(cats.length > 0 ? cats : ['Altres']);
    } catch {
      setCategories(['Altres']);
    }

    setViewState('form');
  }

  function toggleCategory(category: string) {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  }

  async function handleAddCategory() {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) { setError(ERRORS.CATEGORY_EMPTY); return; }
    if (categories.includes(trimmedName)) { setError(ERRORS.CATEGORY_EXISTS); return; }

    setIsAddingCategory(true);
    setError('');
    setCategories(prev => [...prev, trimmedName]);
    setSelectedCategories(prev => [...prev, trimmedName]);
    setNewCategoryName('');
    setIsAddingCategory(false);
  }

  async function handleSave() {
    if (!title.trim()) { setError(ERRORS.NO_TITLE); return; }
    if (title.length > 80) { setError(ERRORS.TITLE_TOO_LONG); return; }
    if (!url) { setError(ERRORS.UNKNOWN); return; }

    setViewState('loading');

    try {
      const duplicate = await isDuplicate(url);
      if (duplicate) { setViewState('duplicate'); return; }

      const bookmark: Bookmark = {
        id: `mob_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: title.trim(),
        description: description.trim(),
        author: resolveAuthorFromUrl(url),
        originalLink: url,
        externalLinks: [],
        categories: selectedCategories.length > 0 ? selectedCategories : ['Altres'],
        createdAt: Date.now(),
      };

      await saveBookmark(bookmark);
      setViewState('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ERRORS.UNKNOWN;
      setError(msg);
      setViewState('error');
    }
  }

  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
        <p className="font-mono text-sm dark:text-white">{UI.LOADING}</p>
      </div>
    );
  }

  if (viewState === 'duplicate') {
    return (
      <div className="p-6">
        <div className="bg-red-500 border-2 border-black p-4 mb-4 text-white">
          <h1 className="text-xl font-bold uppercase">⚠️ {UI.DUPLICATE_WARNING}</h1>
        </div>
        <p className="font-mono text-sm mb-6">{UI.DUPLICATE_MESSAGE}</p>
        <div className="flex justify-end">
          <button onClick={() => window.close()} className="btn-secondary">{UI.CLOSE}</button>
        </div>
      </div>
    );
  }

  if (viewState === 'success') {
    return (
      <div className="p-6">
        <div className="bg-green-400 border-2 border-black p-4 text-black">
          <h1 className="text-xl font-bold uppercase">✅ {UI.SUCCESS}</h1>
        </div>
      </div>
    );
  }

  if (viewState === 'error') {
    return (
      <div className="p-6">
        <div className="bg-red-500 border-2 border-black p-4 mb-4 text-white">
          <h1 className="text-xl font-bold uppercase">❌ Error al guardar</h1>
        </div>
        <p className="font-mono text-sm mb-6">{error}</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => window.close()} className="btn-secondary">{UI.CLOSE}</button>
          <button onClick={() => { setError(''); setViewState('form'); }} className="btn-primary">{UI.RETRY}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto min-h-screen bg-white dark:bg-gray-900 dark:text-white">
      <div className="bg-green-400 border-b-2 border-black p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold uppercase">🔖 {UI.TITLE}</h1>
        <button onClick={() => setDarkMode(d => !d)} className="p-1 border-2 border-black" title={darkMode ? 'Mode dia' : 'Mode nit'}>{darkMode ? <SunIcon /> : <MoonIcon />}</button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block font-bold text-sm mb-1">📄 Títol:</label>
          <input type="text" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>

        <div>
          <label className="block font-bold text-sm mb-1">📝 Descripció:</label>
          <textarea className="textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label className="block font-bold text-sm mb-1">👤 Autor:</label>
          <p className="text-gray-500 text-sm font-mono">{resolveAuthorFromUrl(url)}</p>
        </div>

        <div>
          <label className="block font-bold text-sm mb-1">🔗 URL:</label>
          <p className="text-gray-500 text-xs font-mono truncate">{url}</p>
        </div>

        <div>
          <label className="block font-bold text-sm mb-2">🏷️ Categories:</label>
          <div className="border-2 border-black p-3 bg-gray-50 max-h-40 overflow-y-auto">
            <div className="grid grid-cols-2 gap-1">
              {categories.map(cat => (
                <label key={cat} className="checkbox-label">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={selectedCategories.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                  />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-2 pt-2 border-t border-gray-300">
              <input
                type="text"
                className="input flex-1 text-sm"
                placeholder={UI.NEW_CATEGORY_PLACEHOLDER}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                disabled={isAddingCategory}
              />
              <button onClick={handleAddCategory} disabled={isAddingCategory} className="btn-secondary text-sm px-3">
                {isAddingCategory ? '...' : UI.ADD_CATEGORY}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border-2 border-red-500 p-2 text-red-700 text-sm font-mono">{error}</div>
        )}

        <div className="flex justify-between gap-3 pt-2 border-t-2 border-black">
          <button onClick={() => window.close()} className="btn-secondary">{UI.CANCEL}</button>
          <button onClick={handleSave} className="btn-primary">✓ {UI.SAVE}</button>
        </div>
      </div>
    </div>
  );
}
