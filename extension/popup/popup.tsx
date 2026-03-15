import { useState, useEffect } from 'react';
import type { ExtractedMetadata, Bookmark, TabItem, TabSaveStatus, TabGroupInfo } from '../shared/types';
import { UI_STRINGS, ERRORS } from '../shared/config';
import { getBookmarks, getCategories } from '../shared/api';
import {
  filterTabsByGroup,
  hasGroups,
  toggleTabSelection,
  selectAllVisible,
  deselectAllVisible,
  getSelectionCount,
  getFaviconUrl,
  GROUP_COLOR_MAP,
} from './tabsUtils';

type ViewState = 'loading' | 'form' | 'duplicate' | 'success' | 'error' | 'tabs' | 'tabs-saving' | 'tabs-summary';

export default function Popup() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  // Tabs feature state
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [groupFilter, setGroupFilter] = useState<'all' | 'ungrouped' | number>('all');
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());
  const [tabStatuses, setTabStatuses] = useState<Map<number, TabSaveStatus>>(new Map());
  const [tabSaveResults, setTabSaveResults] = useState<Map<number, { title: string; categories: string[] }>>(new Map());
  const [showConfirm, setShowConfirm] = useState(false);

  // Load tabs on mount (tabs view is default)
  useEffect(() => {
    loadTabsData();
  }, []);

  async function loadTabsData() {
    try {
      const allChromeTabs = await chrome.tabs.query({ currentWindow: true });
      const allGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      const groupMap = new Map(allGroups.map(g => [g.id, g]));
      const savedBookmarks = await getBookmarks();
      const savedUrls = new Set(savedBookmarks.map(b => b.originalLink));

      const tabItems: TabItem[] = allChromeTabs
        .filter(t => t.id != null && t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
        .map(t => {
          const group = t.groupId !== -1 ? groupMap.get(t.groupId) : undefined;
          return {
            id: t.id!,
            title: t.title || t.url!,
            url: t.url!,
            favIconUrl: t.favIconUrl || '',
            groupId: t.groupId ?? -1,
            groupColor: group?.color as TabItem['groupColor'],
            groupTitle: group?.title,
            alreadySaved: savedUrls.has(t.url!),
          };
        });

      setTabs(tabItems);

      // Load categories so handleBulkSave can pass them to the proxy (non-fatal)
      try {
        const cats = await getCategories();
        if (cats.length > 0) setCategories(cats);
      } catch {
        // Non-fatal — proxy will do best-effort without category list
      }

      setViewState('tabs');
    } catch (err) {
      console.error('Error loading tabs:', err);
      setError(ERRORS.UNKNOWN);
      setViewState('error');
    }
  }

  async function loadData() {
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.id) {
        throw new Error('No active tab');
      }

      // Try to get metadata from content script
      let metadataResponse;
      try {
        metadataResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_METADATA' });
      } catch {
        // Content script not loaded - inject it first
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
        // Wait a bit for script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        // Try again
        metadataResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_METADATA' });
      }

      if (!metadataResponse || !metadataResponse.success) {
        throw new Error('Failed to extract metadata');
      }

      const extractedMetadata: ExtractedMetadata = metadataResponse.data;
      setMetadata(extractedMetadata);
      setTitle(extractedMetadata.title);
      setDescription(extractedMetadata.description);

      // Get categories from background
      const categoriesResponse = await chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' });

      if (categoriesResponse.success) {
        setCategories(categoriesResponse.data);
      } else {
        setCategories(['Altres']);
      }

      setViewState('form');
    } catch (err) {
      console.error('Error loading data:', err);
      setError(ERRORS.UNKNOWN);
      setViewState('error');
    }
  }

  function toggleCategory(category: string) {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  }

  async function handleAddCategory() {
    const trimmedCategory = newCategory.trim();
    if (!trimmedCategory) return;

    // Check if already exists (case-insensitive)
    if (categories.some(c => c.toLowerCase() === trimmedCategory.toLowerCase())) {
      setNewCategory('');
      return;
    }

    setAddingCategory(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_CATEGORY',
        data: { category: trimmedCategory }
      });

      if (response.success) {
        setCategories(response.data);
        setSelectedCategories(prev => [...prev, trimmedCategory]);
        setNewCategory('');
      }
    } catch (err) {
      console.error('Error adding category:', err);
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleSave() {
    // Validation
    if (!title.trim()) {
      setError(ERRORS.NO_TITLE);
      return;
    }

    if (title.length > 80) {
      setError(ERRORS.TITLE_TOO_LONG);
      return;
    }

    if (selectedCategories.length === 0) {
      setError(ERRORS.NO_CATEGORY);
      return;
    }

    if (!metadata) {
      setError(ERRORS.UNKNOWN);
      return;
    }

    setViewState('loading');

    try {
      // Check for duplicate
      const duplicateResponse = await chrome.runtime.sendMessage({
        type: 'CHECK_DUPLICATE',
        data: { url: metadata.url }
      });

      if (duplicateResponse.success && duplicateResponse.data.isDuplicate) {
        setViewState('duplicate');
        return;
      }

      // Create bookmark object
      const bookmark: Bookmark = {
        id: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: title.trim(),
        description: description.trim(),
        author: metadata.author || 'Extension',
        originalLink: metadata.url,
        externalLinks: [],
        categories: selectedCategories,
        createdAt: Date.now()
      };

      // Save via background
      const saveResponse = await chrome.runtime.sendMessage({
        type: 'SAVE_BOOKMARK',
        data: bookmark
      });

      if (!saveResponse.success) {
        throw new Error(saveResponse.error || ERRORS.API_ERROR);
      }

      setViewState('success');

      // Auto-close after 1 second
      setTimeout(() => {
        window.close();
      }, 1000);

    } catch (err: any) {
      console.error('Error saving bookmark:', err);
      setError(err.message || ERRORS.API_ERROR);
      setViewState('error');
    }
  }

  function handleCancel() {
    window.close();
  }

  function handleRetry() {
    setError('');
    setViewState('form');
  }

  // Stub — bulk save logic implemented in Plan 03
  // State setters referenced here to satisfy noUnusedLocals until Plan 03 implementation
  async function handleBulkSave(_tabIdsToSave?: Set<number>) {
    void tabStatuses; void setTabStatuses;
    void tabSaveResults; void setTabSaveResults;
  }

  // Loading state
  if (viewState === 'loading') {
    return (
      <div className="p-6 text-center">
        <div className="bg-yellow-400 border-2 border-black p-4 mb-4">
          <h1 className="text-xl font-bold uppercase">{UI_STRINGS.TITLE}</h1>
        </div>
        <p className="font-mono text-sm">{UI_STRINGS.LOADING}</p>
      </div>
    );
  }

  // Duplicate warning
  if (viewState === 'duplicate') {
    return (
      <div className="p-6">
        <div className="bg-red-500 border-2 border-black p-4 mb-4 text-white">
          <h1 className="text-xl font-bold uppercase">⚠️ {UI_STRINGS.DUPLICATE_WARNING}</h1>
        </div>
        <p className="font-mono text-sm mb-6">{UI_STRINGS.DUPLICATE_MESSAGE}</p>
        <div className="flex justify-end">
          <button onClick={handleCancel} className="btn-secondary">
            {UI_STRINGS.CLOSE}
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (viewState === 'success') {
    return (
      <div className="p-6">
        <div className="bg-green-400 border-2 border-black p-4 text-black">
          <h1 className="text-xl font-bold uppercase">✅ {UI_STRINGS.SUCCESS}</h1>
        </div>
      </div>
    );
  }

  // Error state
  if (viewState === 'error') {
    return (
      <div className="p-6">
        <div className="bg-red-500 border-2 border-black p-4 mb-4 text-white">
          <h1 className="text-xl font-bold uppercase">❌ Error al guardar</h1>
        </div>
        <p className="font-mono text-sm mb-6">{error}</p>
        <div className="flex justify-end gap-3">
          <button onClick={handleCancel} className="btn-secondary">
            {UI_STRINGS.CLOSE}
          </button>
          <button onClick={handleRetry} className="btn-primary">
            {UI_STRINGS.RETRY}
          </button>
        </div>
      </div>
    );
  }

  // Tabs view
  if (viewState === 'tabs') {
    const visibleTabs = filterTabsByGroup(tabs, groupFilter);
    const selectableTabs = visibleTabs.filter(t => !t.alreadySaved);
    const visibleSelectableIds = selectableTabs.map(t => t.id);
    const allVisibleSelected = visibleSelectableIds.length > 0 &&
      visibleSelectableIds.every(id => selectedTabIds.has(id));
    const groups: TabGroupInfo[] = [...new Map(
      tabs.filter(t => t.groupId !== -1 && t.groupTitle)
        .map(t => [t.groupId, { id: t.groupId, title: t.groupTitle!, color: t.groupColor! }])
    ).values()];
    const totalSelected = getSelectionCount(selectedTabIds);

    return (
      <div className="w-[400px] flex flex-col max-h-[580px]">
        {/* Header */}
        <div className="bg-yellow-400 border-b-2 border-black p-3 flex items-center justify-between flex-shrink-0">
          <h1 className="text-lg font-bold uppercase">🔖 {UI_STRINGS.TABS_HEADING}</h1>
          <button
            className="text-xs underline font-mono hover:no-underline"
            onClick={() => { loadData(); setViewState('loading'); }}
          >
            {UI_STRINGS.TABS_SAVE_THIS_PAGE}
          </button>
        </div>

        {/* Group filter bar — hidden when no groups */}
        {hasGroups(tabs) && (
          <div className="border-b-2 border-black p-2 flex gap-1 flex-wrap flex-shrink-0 bg-white">
            {(['all', 'ungrouped'] as const).map(f => (
              <button
                key={f}
                onClick={() => setGroupFilter(f)}
                className={`text-xs px-2 py-1 border-2 border-black font-bold ${
                  groupFilter === f ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
                }`}
              >
                {f === 'all' ? UI_STRINGS.TABS_FILTER_ALL : UI_STRINGS.TABS_FILTER_UNGROUPED}
              </button>
            ))}
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setGroupFilter(g.id)}
                className={`text-xs px-2 py-1 border-2 border-black font-bold ${
                  groupFilter === g.id ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
                }`}
              >
                {g.title}
              </button>
            ))}
          </div>
        )}

        {/* Select-all header */}
        <div className="border-b border-gray-300 px-3 py-1 flex items-center gap-2 flex-shrink-0 bg-gray-50">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={allVisibleSelected}
            onChange={() => {
              if (allVisibleSelected) {
                setSelectedTabIds(prev => deselectAllVisible(visibleSelectableIds, prev));
              } else {
                setSelectedTabIds(prev => selectAllVisible(visibleSelectableIds, prev));
              }
            }}
          />
          <span className="text-xs font-bold">
            {allVisibleSelected ? UI_STRINGS.TABS_DESELECT_ALL : UI_STRINGS.TABS_SELECT_ALL}
          </span>
        </div>

        {/* Tab list */}
        <div className="flex-1 overflow-y-auto">
          {visibleTabs.length === 0 ? (
            <p className="p-4 text-center text-sm font-mono text-gray-500">{UI_STRINGS.TABS_EMPTY}</p>
          ) : (
            visibleTabs.map(tab => {
              const borderClass = tab.groupColor ? `border-l-4 ${GROUP_COLOR_MAP[tab.groupColor]}` : '';
              return (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-3 py-2 border-b border-gray-200 ${
                    tab.alreadySaved ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                  } ${borderClass}`}
                >
                  <input
                    type="checkbox"
                    className="checkbox-input flex-shrink-0"
                    checked={selectedTabIds.has(tab.id)}
                    disabled={tab.alreadySaved}
                    onChange={() => {
                      if (!tab.alreadySaved) {
                        setSelectedTabIds(prev => toggleTabSelection(prev, tab.id));
                      }
                    }}
                  />
                  <img
                    src={getFaviconUrl(tab.url)}
                    width={16}
                    height={16}
                    alt=""
                    className="flex-shrink-0"
                    onError={(e) => {
                      // Fallback: letter avatar
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      const sibling = target.nextSibling as HTMLElement | null;
                      if (sibling) sibling.style.display = 'flex';
                    }}
                  />
                  <span
                    style={{ display: 'none' }}
                    className="w-4 h-4 flex-shrink-0 bg-gray-300 text-xs flex items-center justify-center font-bold"
                  >
                    {(tab.title || '?')[0].toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs truncate">{tab.title}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{tab.url}</p>
                  </div>
                  {tab.alreadySaved && (
                    <span className="text-xs text-green-700 font-bold flex-shrink-0">
                      {UI_STRINGS.TABS_ALREADY_SAVED_BADGE}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: save button */}
        <div className="border-t-2 border-black p-3 flex-shrink-0 bg-white">
          {showConfirm ? (
            <div className="space-y-2">
              <p className="text-sm font-bold">{UI_STRINGS.TABS_CONFIRM_TITLE}</p>
              <p className="text-xs font-mono">{UI_STRINGS.TABS_CONFIRM_MESSAGE(totalSelected)}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowConfirm(false)} className="btn-secondary text-sm">
                  {UI_STRINGS.TABS_CONFIRM_CANCEL}
                </button>
                <button
                  onClick={() => { setShowConfirm(false); handleBulkSave(); }}
                  className="btn-primary text-sm"
                >
                  {UI_STRINGS.TABS_CONFIRM_YES}
                </button>
              </div>
            </div>
          ) : (
            <button
              disabled={totalSelected === 0}
              onClick={() => setShowConfirm(true)}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {UI_STRINGS.TABS_SAVE_BUTTON(totalSelected)}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div className="w-[400px]">
      {/* Header */}
      <div className="bg-yellow-400 border-b-2 border-black p-4">
        <h1 className="text-xl font-bold uppercase">🔖 {UI_STRINGS.TITLE}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="block font-bold text-sm mb-1">📄 {UI_STRINGS.LABEL_TITLE}</label>
          <input
            type="text"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block font-bold text-sm mb-1">📝 {UI_STRINGS.LABEL_DESCRIPTION}</label>
          <textarea
            className="textarea"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Author (read-only) */}
        <div>
          <label className="block font-bold text-sm mb-1">👤 {UI_STRINGS.LABEL_AUTHOR}</label>
          <p className="text-gray-500 text-sm font-mono">{metadata?.author || 'Extension'}</p>
        </div>

        {/* URL (read-only, truncated) */}
        <div>
          <label className="block font-bold text-sm mb-1">🔗 {UI_STRINGS.LABEL_URL}</label>
          <p className="text-gray-500 text-xs font-mono truncate">{metadata?.url}</p>
        </div>

        {/* Categories */}
        <div>
          <label className="block font-bold text-sm mb-2">🏷️ {UI_STRINGS.LABEL_CATEGORIES}</label>
          <div className="border-2 border-black p-3 bg-gray-50">
            <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-1 mb-3">
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
            <div className="flex gap-2 pt-2 border-t border-gray-300">
              <input
                type="text"
                className="input flex-1 text-sm"
                placeholder={UI_STRINGS.NEW_CATEGORY_PLACEHOLDER}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                disabled={addingCategory}
              />
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={addingCategory || !newCategory.trim()}
                className="btn-secondary text-sm px-3 disabled:opacity-50"
              >
                {addingCategory ? '...' : UI_STRINGS.ADD_CATEGORY}
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border-2 border-red-500 p-2 text-red-700 text-sm font-mono">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between gap-3 pt-2 border-t-2 border-black">
          <button onClick={handleCancel} className="btn-secondary">
            {UI_STRINGS.CANCEL}
          </button>
          <button onClick={handleSave} className="btn-primary">
            ✓ {UI_STRINGS.SAVE}
          </button>
        </div>
      </div>
    </div>
  );
}
