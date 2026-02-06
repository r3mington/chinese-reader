import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Reader from './components/Reader';
import StatsToolbar from './components/StatsToolbar';
import VocabularyView from './components/VocabularyView';
import { initDictionary } from './lib/dictionary';
import './styles/index.css';

function App() {
  const [currentStory, setCurrentStory] = useState(null);
  const [isLoadingDict, setIsLoadingDict] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');

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
            <Sidebar
              onSelectStory={setCurrentStory}
              currentStoryId={currentStory?.id}
            />
            <Reader story={currentStory} />
          </div>
        } />
        <Route path="/vocabulary" element={<VocabularyView />} />
      </Routes>
    </Router>
  );
}

export default App;
