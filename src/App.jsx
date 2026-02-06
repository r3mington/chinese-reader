import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import SidebarDrawer from './components/SidebarDrawer';
import Reader from './components/Reader';
import StatsToolbar from './components/StatsToolbar';
import VocabularyView from './components/VocabularyView';
import { initDictionary } from './lib/dictionary';
import { useIsMobile } from './lib/useIsMobile';
import './styles/index.css';

function App() {
  const [currentStory, setCurrentStory] = useState(null);
  const [isLoadingDict, setIsLoadingDict] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

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
          <div className="flex">
            {isMobile ? (
              <>
                <SidebarDrawer
                  isOpen={drawerOpen}
                  onClose={() => setDrawerOpen(false)}
                  onSelectStory={setCurrentStory}
                  currentStoryId={currentStory?.id}
                />
                <button
                  className="floating-sidebar-button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open library"
                >
                  📚
                </button>
              </>
            ) : (
              <Sidebar
                onSelectStory={setCurrentStory}
                currentStoryId={currentStory?.id}
              />
            )}
            <Reader story={currentStory} />
          </div>
        } />
        <Route path="/vocabulary" element={<VocabularyView />} />
      </Routes>
    </Router>
  );
}

export default App;
