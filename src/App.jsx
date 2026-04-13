import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import LibraryModal from './components/LibraryModal';
import Reader from './components/Reader';
import VocabularyView from './components/VocabularyView';
import StoryStatsPage from './components/StoryStatsPage';
import GlobalStatsPage from './components/GlobalStatsPage';
import SettingsPage from './components/SettingsPage';
import { initDictionary } from './lib/dictionary';
import { getStories } from './lib/storage';
import { endReadingSession, startReadingSession } from './lib/stats';
import { loadFrequencyDb } from './lib/frequency';
import ReloadPrompt from './components/ReloadPrompt';
import './styles/oled.css';

function App() {
  const [currentStory, setCurrentStory] = useState(null);
  const [isLoadingDict, setIsLoadingDict] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [statsStory, setStatsStory] = useState(null);
  const [globalStatsOpen, setGlobalStatsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // Initialize dictionary on load
    const loadDict = async () => {
      setIsLoadingDict(true);
      try {
        setLoadingStatus('Loading dictionary...');
        await initDictionary((status) => setLoadingStatus(status));
        setLoadingStatus('Loading word frequencies...');
        await loadFrequencyDb();
      } catch (err) {
        console.error('Dictionary load failed', err);
        setLoadingStatus('Failed to load dictionary. Please check connection and refresh.');
      } finally {
        setIsLoadingDict(false);
      }
    };

    // Listen for cross-component jump requests from the Stats table
    const handleJump = async (e) => {
        const { storyId, position } = e.detail;
        const stories = await getStories();
        const selected = stories.find(s => s.id === storyId);
        if (selected) {
            handleStorySelect(selected);
            setGlobalStatsOpen(false);
            setStatsStory(null);
            
            // Allow time for the Reader to mount the new story before emitting jump
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('readerJumpAbsolute', { detail: { position } }));
            }, 300);
        }
    };
    window.addEventListener('loadStoryAndSeek', handleJump);

    loadDict();

    return () => window.removeEventListener('loadStoryAndSeek', handleJump);
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
    <>
      <Routes>
        <Route path="/" element={
          <>
            <LibraryModal
              isOpen={libraryOpen}
              onClose={() => {
                setLibraryOpen(false);
                // Resume session when library closes (if page is visible)
                if (!document.hidden) startReadingSession();
              }}
              onSelectStory={handleStorySelect}
              currentStoryId={currentStory?.id}
              onViewStats={(story) => setStatsStory(story)}
              onViewGlobalStats={() => setGlobalStatsOpen(true)}
            />
            <button
              className="floating-library-button"
              onClick={() => {
                endReadingSession();
                setLibraryOpen(true);
              }}
              aria-label="Open library"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </button>
            <button
              className="floating-settings-button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open Settings"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
            <Reader story={currentStory} />
          </>
        } />
        <Route path="/vocabulary" element={<VocabularyView />} />
      </Routes>
      {settingsOpen && (
        <SettingsPage onClose={() => setSettingsOpen(false)} />
      )}
      {statsStory && (
        <StoryStatsPage
          story={statsStory}
          onClose={() => setStatsStory(null)}
        />
      )}
      {globalStatsOpen && (
        <GlobalStatsPage onClose={() => setGlobalStatsOpen(false)} />
      )}
      <ReloadPrompt />
    </>
  );
}

export default App;
