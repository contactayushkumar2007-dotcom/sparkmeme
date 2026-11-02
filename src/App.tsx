import { useState, useCallback } from 'react';
import { Bookmark, Sparkles } from 'lucide-react';
import type { GeneratorType, SavedItem } from './types';
import HomeView from './components/HomeView';
import GeneratorView from './components/GeneratorView';
import SavedView from './components/SavedView';

type View =
  | { name: 'home' }
  | { name: 'generator'; type: GeneratorType }
  | { name: 'saved' };

const STORAGE_KEY = 'sparkmeme:saved';

function loadSaved(): SavedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedItem[];
  } catch {
    // localStorage may be unavailable
  }
  return [];
}

function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const [savedItems, setSavedItems] = useState<SavedItem[]>(loadSaved);

  const persist = useCallback((items: SavedItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, []);

  const handleNavigate = useCallback((type: GeneratorType) => {
    setView({ name: 'generator', type });
  }, []);

  const handleBack = useCallback(() => {
    setView({ name: 'home' });
  }, []);

  const handleSave = useCallback(
    (item: SavedItem) => {
      setSavedItems((prev) => {
        const next = [item, ...prev];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const handleRemove = useCallback(
    (id: string) => {
      setSavedItems((prev) => {
        const next = prev.filter((item) => item.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const goHome = useCallback(() => setView({ name: 'home' }), []);
  const goSaved = useCallback(() => setView({ name: 'saved' }), []);

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <button
            onClick={goHome}
            className="flex items-center gap-2 text-sm font-medium text-black hover:opacity-70 transition-opacity"
          >
            <Sparkles size={16} strokeWidth={1.5} />
            SparkMeme
          </button>

          <button
            onClick={goSaved}
            className={`flex items-center gap-1.5 text-xs transition-colors duration-150 ${
              view.name === 'saved'
                ? 'text-black'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            <Bookmark size={14} strokeWidth={1.5} />
            Saved
            {savedItems.length > 0 && (
              <span className="text-gray-400">{savedItems.length}</span>
            )}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="py-8 sm:py-12">
        {view.name === 'home' && <HomeView onNavigate={handleNavigate} />}
        {view.name === 'generator' && (
          <GeneratorView
            type={view.type}
            onBack={handleBack}
            onSave={handleSave}
          />
        )}
        {view.name === 'saved' && (
          <SavedView items={savedItems} onRemove={handleRemove} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6">
          <p className="text-xs text-gray-400 text-center">
            SparkMeme — AI inspiration for content creators
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
