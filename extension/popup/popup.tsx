import { useState, useEffect } from 'react';
import type { ExtractedMetadata, Bookmark } from '../shared/types';
import { UI_STRINGS, ERRORS } from '../shared/config';

type ViewState = 'loading' | 'form' | 'duplicate' | 'success' | 'error';

export default function Popup() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [metadata, setMetadata] = useState<ExtractedMetadata | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Load metadata and categories on mount
  useEffect(() => {
    loadData();
  }, []);

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
          <div className="border-2 border-black p-3 bg-gray-50 max-h-40 overflow-y-auto grid grid-cols-2 gap-1">
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
