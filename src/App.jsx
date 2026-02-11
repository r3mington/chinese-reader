import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LibraryModal from './components/LibraryModal';
import Reader from './components/Reader';
import StatsToolbar from './components/StatsToolbar';
import VocabularyView from './components/VocabularyView';
import { initDictionary } from './lib/dictionary';
import { getStories } from './lib/storage';
import './styles/oled.css';

function App() {
  const [currentStory, setCurrentStory] = useState(null);
  const [isLoadingDict, setIsLoadingDict] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    // Initialize dictionary on load
    const loadDict = async () => {
      setIsLoadingDict(true);
      try {
        await initDictionary((status) => setLoadingStatus(status));
      } catch (err) {
        console.error('Dictionary load failed', err);
        setLoadingStatus('Failed to load dictionary. Please check connection and refresh.');
      } finally {
        setIsLoadingDict(false);
      }
    };
    loadDict();
  }, []);

  // Restore last read story on mount
  useEffect(() => {
    const restoreLastStory = async () => {
      const lastStoryId = localStorage.getItem('lastStoryId');
      if (lastStoryId) {
        const stories = await getStories();
        const story = stories.find(s => s.id === lastStoryId);
        if (story) {
          setCurrentStory(story);
        }
      }
    };
    restoreLastStory();
  }, []);

  // Save current story ID when it changes
  const handleStorySelect = (story) => {
    setCurrentStory(story);
    if (story) {
      localStorage.setItem('lastStoryId', story.id);
    } else {
      localStorage.removeItem('lastStoryId');
    }
  };

  if (isLoadingDict) {
    return (
      <div className="reader-empty flex-col" style={{ height: '100vh', justifyContent: 'center' }}>
        <p>Initializing Dictionary...</p>
        <p style={{ fontSize: '14px', color: '#666' }}>{loadingStatus}</p>
      </div>
    );
  }

  return (
    <Router>
      <StatsToolbar />
      <Routes>
        <Route path="/" element={
          <>
            <LibraryModal
              isOpen={libraryOpen}
              onClose={() => setLibraryOpen(false)}
              onSelectStory={handleStorySelect}
              currentStoryId={currentStory?.id}
            />
            <button
              className="floating-library-button"
              onClick={() => setLibraryOpen(true)}
              aria-label="Open library"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </button>
            <Reader story={currentStory} />
          </>
        } />
        <Route path="/vocabulary" element={<VocabularyView />} />
      </Routes>
    </Router>
  );
}

export default App;
