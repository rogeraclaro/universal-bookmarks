

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Upload, X, ExternalLink, Edit2, Trash2, Plus, Settings, Github, Twitter, Link as LinkIcon, Download, Play, FileDown, Square, RefreshCcw, Hash, Terminal } from 'lucide-react';
import { Bookmark, Category, TweetRaw, LogEntry } from './types';
import { processBookmarksWithGemini } from './services/geminiService';
import { storage } from './services/storage';
import { Button, Card, Input, Label, TextArea, Select, Badge, Modal } from './components/UI';
import { strings } from './translations';

// --- Helper Components ---

const BookmarkCard: React.FC<{ 
  bookmark: Bookmark; 
  onEdit: (b: Bookmark) => void; 
  onDelete: (id: string, originalId: string) => void;
}> = ({ bookmark, onEdit, onDelete }) => {
    // Extract original ID for blacklist purposes
    const originalId = bookmark.originalLink.split('/').pop() || "";

    return (
      <div className="bg-white border-2 border-black p-5 h-full flex flex-col shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all duration-200">
        <div className="flex justify-between items-start mb-3">
          <Badge color="bg-cyan-300">{bookmark.category}</Badge>
          <div className="flex gap-2">
            <button 
                onClick={(e) => { e.stopPropagation(); onEdit(bookmark); }} 
                className="p-1.5 hover:bg-yellow-300 border border-transparent hover:border-black transition-colors" 
                title={strings.modal.editTitle}
            >
              <Edit2 size={16} />
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(bookmark.id, originalId); }} 
                className="p-1.5 hover:bg-red-500 hover:text-white border border-transparent hover:border-black transition-colors" 
                title={strings.modal.deleteTitle}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        
        <h3 className="font-bold text-xl leading-tight mb-3">{bookmark.title}</h3>
        <p className="text-gray-700 font-mono mb-6 flex-grow leading-relaxed text-sm">{bookmark.description}</p>
        
        <div className="mt-auto pt-4 border-t-2 border-black/10 flex flex-col gap-3">
          <a 
            href={bookmark.originalLink} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs font-bold uppercase flex items-center gap-2 hover:bg-black hover:text-white w-fit px-2 py-1 transition-colors border border-black"
          >
            <Twitter size={14} /> {strings.app.viewOriginal}
          </a>
          
          {bookmark.externalLinks.length > 0 && (
            <div className="flex flex-col gap-1.5">
               {bookmark.externalLinks.map((link, idx) => (
                 <a 
                  key={idx}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-700 truncate flex items-center gap-2 hover:underline decoration-2"
                 >
                  <LinkIcon size={12} /> {new URL(link).hostname}
                 </a>
               ))}
            </div>
          )}
        </div>
      </div>
    );
};

// --- Main App ---

export default function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newBookmarkMode, setNewBookmarkMode] = useState(false);
  const [rejectedTweets, setRejectedTweets] = useState<TweetRaw[]>([]);
  
  // Custom Delete Modal State
  const [deleteModalState, setDeleteModalState] = useState<{isOpen: boolean, id: string | null, originalId: string | null}>({
    isOpen: false, id: null, originalId: null
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Load Data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedBookmarks, loadedCategories, loadedDeletedIds] = await Promise.all([
          storage.getBookmarks(),
          storage.getCategories(),
          storage.getDeletedIds()
        ]);
        setBookmarks(loadedBookmarks);
        setCategories(loadedCategories);
        setDeletedIds(loadedDeletedIds);
      } catch (error) {
        console.error("Failed to load data", error);
        setCategories(strings.defaults.categories);
      }
    };
    loadData();
  }, []);

  // Save Data when changed
  useEffect(() => {
    if (bookmarks.length > 0) storage.saveBookmarks(bookmarks);
  }, [bookmarks]);

  useEffect(() => {
    if (categories.length > 0) storage.saveCategories(categories);
  }, [categories]);

  useEffect(() => {
    storage.saveDeletedIds(deletedIds);
  }, [deletedIds]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  };

  const handleExport = () => {
    const backup = {
      backupVersion: 1,
      timestamp: Date.now(),
      categories,
      bookmarks,
      deletedIds // Include blacklist in backup
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-bookmarks-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadRejected = () => {
    if (rejectedTweets.length === 0) return;
    
    const blob = new Blob([JSON.stringify(rejectedTweets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `non-ai-tweets-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    addLog(strings.logs.stopped, 'error');
  };

  const handleResetData = async () => {
    if (confirm(strings.alerts.confirmReset)) {
        await storage.clearData();
        setBookmarks([]);
        setCategories(strings.defaults.categories);
        setRejectedTweets([]);
        setDeletedIds([]);
        window.location.reload(); 
    }
  };

  const processTweetsData = async (tweets: TweetRaw[], signal: AbortSignal) => {
      if (tweets.length === 0) {
          alert(strings.alerts.noValidTweets);
          setIsLoading(false);
          return;
      }

      addLog(strings.logs.start, 'info');

      // --- DEDUPLICATION & BLACKLIST LOGIC ---
      
      const existingIds = new Set(bookmarks.map(b => {
          const parts = b.originalLink.split('/');
          return parts[parts.length - 1]; 
      }));

      const blacklistIds = new Set(deletedIds);

      const uniqueTweets = tweets.filter(t => {
          const id = t.id_str || t.id;
          if (!id) return false;
          return !existingIds.has(String(id)) && !blacklistIds.has(String(id));
      });
      
      const skippedCount = tweets.length - uniqueTweets.length;

      if (uniqueTweets.length === 0) {
          addLog(strings.alerts.importResult.replace("{0}", "0").replace("{1}", String(skippedCount)).replace("{2}", "0"), 'warning');
          alert(strings.alerts.importResult.replace("{0}", "0").replace("{1}", String(skippedCount)).replace("{2}", "0"));
          setIsLoading(false);
          return;
      }

      try {
        const processed = await processBookmarksWithGemini(
            uniqueTweets, 
            categories, 
            (c, t) => setProgress({ current: c, total: t }),
            addLog,
            signal
        );

        const aiResults = processed.filter(p => p.isAI);
        const nonAiIds = new Set(processed.filter(p => !p.isAI).map(p => p.originalId));
        
        const newRejectedTweets = uniqueTweets.filter(t => {
            const id = t.id_str || t.id;
            return id && nonAiIds.has(String(id));
        });

        setRejectedTweets(prev => [...prev, ...newRejectedTweets]);

        const newItems: Bookmark[] = aiResults.map(p => ({
            id: p.originalId + Math.random().toString(36).substr(2, 9),
            title: p.title || strings.defaults.untitled,
            description: p.description || strings.defaults.noDescription,
            category: categories.includes(p.category) ? p.category : strings.defaults.uncategorized,
            externalLinks: p.externalLinks || [],
            originalLink: `https://twitter.com/i/web/status/${p.originalId}`,
            createdAt: Date.now()
        })); 
        
        const updatedBookmarks = [...bookmarks, ...newItems];
        setBookmarks(updatedBookmarks);
        storage.saveBookmarks(updatedBookmarks);
        
        addLog(strings.logs.finished, 'success');
        setIsLoading(false);
        
        alert(strings.alerts.importResult
          .replace("{0}", String(newItems.length))
          .replace("{1}", String(skippedCount))
          .replace("{2}", String(newRejectedTweets.length))
        );
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log("Processing aborted by user");
        } else {
          console.error("Processing error", error);
          addLog(strings.alerts.genericError + ": " + error.message, 'error');
          setIsLoading(false);
        }
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setLogs([]);
    setProgress({ current: 0, total: 0 });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let rawData: any = JSON.parse(text);

        // --- CHECK IF IT IS A BACKUP ---
        if (rawData.backupVersion && rawData.bookmarks && rawData.categories) {
            addLog("Fitxer de còpia de seguretat detectat.", 'info');
            const newCats = Array.from(new Set([...categories, ...rawData.categories]));
            setCategories(newCats);
            storage.saveCategories(newCats);
            
            if (rawData.deletedIds) {
                const newDeleted = Array.from(new Set([...deletedIds, ...rawData.deletedIds]));
                setDeletedIds(newDeleted);
            }

            const bookmarkMap = new Map(bookmarks.map(b => [b.id, b]));
            let addedCount = 0;
            let skippedCount = 0;

            rawData.bookmarks.forEach((b: Bookmark) => {
                if (bookmarkMap.has(b.id)) {
                    skippedCount++;
                } else {
                    bookmarkMap.set(b.id, b);
                    addedCount++;
                }
            });

            const newBookmarks = Array.from(bookmarkMap.values());
            setBookmarks(newBookmarks);
            storage.saveBookmarks(newBookmarks);

            addLog(strings.alerts.backupMerge.replace("{0}", String(addedCount)).replace("{1}", String(skippedCount)), 'success');
            alert(strings.alerts.backupMerge.replace("{0}", String(addedCount)).replace("{1}", String(skippedCount)));
            setIsLoading(false);
            return;
        }
        
        // --- TREAT AS TWITTER ARCHIVE ---
        let tweets: TweetRaw[] = [];
        if (Array.isArray(rawData)) {
            tweets = rawData;
        } else if (rawData.bookmarks && Array.isArray(rawData.bookmarks)) {
             tweets = rawData.bookmarks;
        } else {
            const possibleArray = Object.values(rawData).find(val => Array.isArray(val));
            if (possibleArray) tweets = possibleArray as TweetRaw[];
        }

        await processTweetsData(tweets, controller.signal);

      } catch (error) {
        console.error("Error parsing file:", error);
        alert(strings.alerts.importError);
        setIsLoading(false);
      } finally {
        e.target.value = '';
        abortControllerRef.current = null;
      }
    };
    reader.readAsText(file);
  };

  const requestDelete = (id: string, originalId: string) => {
    setDeleteModalState({ isOpen: true, id, originalId });
  };

  const confirmDelete = () => {
    if (!deleteModalState.id) return;
    setBookmarks(prev => prev.filter(b => b.id !== deleteModalState.id));
    if (deleteModalState.originalId) {
      setDeletedIds(prev => [...prev, deleteModalState.originalId!]);
    }
    setDeleteModalState({ isOpen: false, id: null, originalId: null });
  };

  const openEditModal = (bookmark: Bookmark) => {
    setEditingBookmark({ ...bookmark });
    setNewBookmarkMode(false);
    setIsEditModalOpen(true);
  };

  const openNewBookmarkModal = () => {
      setEditingBookmark({
          id: Math.random().toString(36).substr(2, 9),
          title: "",
          description: "",
          category: categories[0] || strings.defaults.uncategorized,
          externalLinks: [],
          originalLink: "",
          createdAt: Date.now()
      });
      setNewBookmarkMode(true);
      setIsEditModalOpen(true);
  };

  const saveBookmark = () => {
    if (!editingBookmark) return;
    setBookmarks(prev => {
      let next;
      if (newBookmarkMode) {
          next = [editingBookmark, ...prev];
      } else {
          next = prev.map(b => b.id === editingBookmark.id ? editingBookmark : b);
      }
      return next;
    });
    setIsEditModalOpen(false);
    setEditingBookmark(null);
  };

  const handleCategoryAdd = () => {
      if (newCategoryName && !categories.includes(newCategoryName)) {
          const next = [...categories, newCategoryName];
          setCategories(next);
          setNewCategoryName("");
      }
  };

  const handleCategoryDelete = (cat: string) => {
      if (confirm(strings.alerts.confirmDeleteCategory.replace("{0}", cat))) {
          const nextCats = categories.filter(c => c !== cat);
          setCategories(nextCats);
          setBookmarks(prev => {
            const nextBooks = prev.map(b => b.category === cat ? { ...b, category: strings.defaults.uncategorized } : b);
            return nextBooks;
          });
      }
  };

  const groupedBookmarks = useMemo(() => {
    const groups: Record<string, Bookmark[]> = {};
    categories.forEach(c => groups[c] = []);
    if (!groups[strings.defaults.uncategorized]) groups[strings.defaults.uncategorized] = [];

    bookmarks.forEach(b => {
      if (groups[b.category]) {
        groups[b.category].push(b);
      } else {
        const uncategorized = strings.defaults.uncategorized;
        if (!groups[uncategorized]) groups[uncategorized] = [];
        groups[uncategorized].push(b);
      }
    });
    return groups;
  }, [bookmarks, categories]);

  const scrollToCategory = (cat: string) => {
      const element = document.getElementById(`category-${cat}`);
      if (element) {
          const offset = 180; 
          const bodyRect = document.body.getBoundingClientRect().top;
          const elementRect = element.getBoundingClientRect().top;
          const elementPosition = elementRect - bodyRect;
          const offsetPosition = elementPosition - offset;
          window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
          });
      }
  };

  return (
    <div className="min-h-screen bg-[#f0f0f0] text-black pb-20">
      
      {/* Main Header */}
      <header className="bg-white border-b-4 border-black p-6 sticky top-0 z-50 shadow-md">
        <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
              <h1 className="text-4xl font-black uppercase tracking-tighter bg-black text-white px-3 py-1 inline-block transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                {strings.app.title}
              </h1>
              <div className="hidden md:block h-8 w-0.5 bg-black/20"></div>
              <p className="hidden md:block font-mono text-sm text-gray-600 font-bold">
                {strings.app.total}: {bookmarks.length} | {strings.app.catLabel}: {categories.length}
              </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center justify-center">
             <label className="cursor-pointer">
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" disabled={isLoading} />
                <div className={`font-mono font-bold text-sm px-5 py-2.5 border-2 border-black flex items-center gap-2 transition-all bg-yellow-400 shadow-[4px_4px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}>
                   <Upload size={18} /> {strings.app.importJson}
                </div>
             </label>

             {rejectedTweets.length > 0 && !isLoading && (
               <Button onClick={handleDownloadRejected} variant="secondary" className="py-2.5 px-4" icon={<FileDown size={18}/>}>
                  {strings.app.downloadRejected.replace("{0}", String(rejectedTweets.length))}
               </Button>
             )}

             <div className="h-8 w-px bg-gray-300 mx-1"></div>

             <Button onClick={handleExport} variant="secondary" className="py-2.5 px-4" icon={<Download size={18}/>}>
                {strings.app.exportData}
             </Button>

             <Button onClick={openNewBookmarkModal} variant="secondary" className="py-2.5 px-4" icon={<Plus size={18}/>}>
                {strings.app.addManual}
             </Button>

             <Button onClick={() => setIsCategoryModalOpen(true)} variant="secondary" className="py-2.5 px-4" icon={<Settings size={18}/>}>
                {strings.app.categories}
             </Button>

             <Button onClick={handleResetData} variant="danger" className="py-2.5 px-4" icon={<Trash2 size={18}/>}>
                RESET
             </Button>
          </div>
        </div>
      </header>

      {/* Sticky Category Nav */}
      {bookmarks.length > 0 && (
          <div className="sticky top-[110px] xl:top-[98px] z-40 bg-[#f0f0f0]/95 backdrop-blur border-b-2 border-black py-3 px-6 overflow-x-auto shadow-sm">
            <div className="max-w-[1600px] mx-auto flex items-center gap-4">
                <span className="font-mono font-bold uppercase text-xs text-gray-500 whitespace-nowrap">{strings.app.jumpTo}</span>
                <div className="flex gap-2">
                    {categories.map(cat => {
                        const count = groupedBookmarks[cat]?.length || 0;
                        if (count === 0) return null;
                        return (
                            <button 
                                key={cat}
                                onClick={() => scrollToCategory(cat)}
                                className="px-3 py-1 bg-white border border-black text-xs font-bold uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap shadow-[2px_2px_0px_0px_#ccc]"
                            >
                                {cat}
                                <span className="bg-yellow-400 text-black px-1.5 py-0.5 text-[10px] border border-black">{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
          </div>
      )}

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto p-6 flex flex-col gap-12 mt-4">
        
        {bookmarks.length === 0 && !isLoading && (
            <div className="text-center py-32 border-4 border-dashed border-gray-300 m-8 bg-gray-50 rounded-lg">
                <div className="flex justify-center mb-6 text-gray-300">
                    <Hash size={64} />
                </div>
                <h2 className="text-3xl font-bold text-gray-400 mb-4 font-mono">{strings.app.noDataTitle}</h2>
                <p className="text-gray-500 max-w-md mx-auto font-mono">{strings.app.noDataDesc}</p>
            </div>
        )}

        {categories.map(category => {
            const items = groupedBookmarks[category];
            if (!items || items.length === 0) return null;

            return (
                <div key={category} id={`category-${category}`} className="scroll-mt-48">
                    <div className="flex items-center gap-4 mb-6">
                        <h2 className="text-3xl font-black uppercase bg-black text-white px-4 py-2 inline-block shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                            {category}
                        </h2>
                        <span className="font-mono font-bold text-xl text-gray-500">
                            {items.length}
                        </span>
                        <div className="h-1 flex-grow bg-black"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {items.map(bookmark => (
                            <BookmarkCard 
                                key={bookmark.id} 
                                bookmark={bookmark} 
                                onEdit={openEditModal} 
                                onDelete={requestDelete} 
                            />
                        ))}
                    </div>
                </div>
            );
        })}
      </main>

      {/* Log Console Modal (Only visible when loading or explicitly open) */}
      <Modal
        isOpen={isLoading || (logs.length > 0 && !isLoading && logs[logs.length-1]?.type !== 'success')} 
        onClose={() => { if(!isLoading) setLogs([]); }} 
        title={strings.logs.title}
      >
        <div className="flex flex-col gap-4">
            {isLoading && (
                <div className="bg-yellow-50 border-2 border-black p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full"></div>
                        <span className="font-bold font-mono text-sm">
                            {strings.app.processingProgress.replace("{0}", String(Math.round((progress.current / (progress.total || 1)) * 100)))}
                        </span>
                    </div>
                    <button onClick={handleStop} className="bg-red-500 text-white px-3 py-1 border-2 border-black font-bold text-xs hover:bg-red-600 shadow-[2px_2px_0px_0px_#000] active:translate-y-[1px] active:shadow-none">
                        {strings.app.stop}
                    </button>
                </div>
            )}

            <div className="bg-black border-2 border-gray-700 h-64 overflow-y-auto p-4 font-mono text-xs flex flex-col gap-1 shadow-inner">
                {logs.map((log, i) => (
                    <div key={i} className={`flex gap-2 ${
                        log.type === 'error' ? 'text-red-500' :
                        log.type === 'success' ? 'text-green-400' :
                        log.type === 'warning' ? 'text-yellow-400' :
                        'text-gray-300'
                    }`}>
                        <span className="opacity-50">[{log.timestamp}]</span>
                        <span>{log.message}</span>
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>

            {!isLoading && (
                <div className="flex justify-end">
                    <Button onClick={() => setLogs([])}>{strings.modal.btnCloseConsole}</Button>
                </div>
            )}
        </div>
      </Modal>

      {/* Edit/Create Modal */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        title={newBookmarkMode ? strings.modal.createTitle : strings.modal.editTitle}
      >
        {editingBookmark && (
            <div className="space-y-4">
                <div>
                    <Label>{strings.modal.labelTitle}</Label>
                    <Input 
                        value={editingBookmark.title} 
                        onChange={e => setEditingBookmark({...editingBookmark, title: e.target.value})} 
                    />
                </div>
                
                <div>
                    <Label>{strings.modal.labelCategory}</Label>
                    <Select 
                        value={editingBookmark.category}
                        onChange={e => setEditingBookmark({...editingBookmark, category: e.target.value})}
                    >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                </div>

                <div>
                    <Label>{strings.modal.labelDescription}</Label>
                    <TextArea 
                        rows={4}
                        value={editingBookmark.description} 
                        onChange={e => setEditingBookmark({...editingBookmark, description: e.target.value})} 
                    />
                </div>

                <div>
                    <Label>{strings.modal.labelOriginalLink}</Label>
                    <Input 
                        value={editingBookmark.originalLink} 
                        onChange={e => setEditingBookmark({...editingBookmark, originalLink: e.target.value})} 
                    />
                </div>

                <div>
                    <Label>{strings.modal.labelExternalLinks}</Label>
                    <Input 
                        value={editingBookmark.externalLinks.join(", ")} 
                        onChange={e => setEditingBookmark({...editingBookmark, externalLinks: e.target.value.split(",").map(s => s.trim()).filter(s => s)})} 
                        placeholder={strings.modal.placeholderExternalLinks}
                    />
                </div>

                <div className="pt-4 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>{strings.modal.btnCancel}</Button>
                    <Button onClick={saveBookmark}>{strings.modal.btnSave}</Button>
                </div>
            </div>
        )}
      </Modal>

      {/* Categories Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={strings.modal.manageCategories}
      >
        <div className="mb-6 flex gap-2">
            <Input 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder={strings.modal.placeholderNewCategory} 
            />
            <Button onClick={handleCategoryAdd} icon={<Plus size={16} />}>{strings.modal.btnAdd}</Button>
        </div>
        
        <div className="flex flex-col gap-2">
            {categories.map(cat => (
                <div key={cat} className="flex justify-between items-center bg-gray-50 p-3 border-2 border-black">
                    <span className="font-mono font-bold">{cat}</span>
                    <button 
                        onClick={() => handleCategoryDelete(cat)} 
                        className="text-red-500 hover:bg-red-100 p-2 border border-transparent hover:border-red-500 transition-all"
                        disabled={cat === strings.defaults.uncategorized}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ))}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}
        title={strings.modal.deleteTitle}
      >
        <div className="mb-8">
            <p className="font-mono text-lg">{strings.alerts.confirmDelete}</p>
        </div>
        
        <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}>
                {strings.modal.btnCancel}
            </Button>
            <Button variant="danger" onClick={confirmDelete} icon={<Trash2 size={18} />}>
                {strings.modal.btnDelete}
            </Button>
        </div>
      </Modal>

    </div>
  );
}