import React, { useState, useEffect, useRef } from 'react';
import { lookupAt } from '../lib/dictionary';
import { saveBookmark, getBookmark } from '../lib/storage';
import { startReadingSession, endReadingSession, initStoryTracking, trackScrollProgress, trackSessionLookup, pauseStats, resumeStats, getIsPaused } from '../lib/stats';
import { trackWordClick, getVocabularyList } from '../lib/vocabulary';
import { useIsMobile } from '../lib/useIsMobile';
import { lookupStartingAt } from '../lib/dictionary';
import WordPopup from './WordPopup';
import MobileBottomSheet from './MobileBottomSheet';
import ColorizedText from './ColorizedText';
import FloatingActionMenu from './FloatingActionMenu';
import RecentLookups from './RecentLookups';
import LexiconSidebar from './LexiconSidebar';
import StatsToolbar from './StatsToolbar';
import '../styles/oled.css';

const Reader = ({ story }) => {
    const [fontSize, setFontSize] = useState(() => {
        return parseInt(localStorage.getItem('fontSize')) || 20;
    });
    const [popupData, setPopupData] = useState(null);
    const [toneColorsEnabled, setToneColorsEnabled] = useState(() => {
        return localStorage.getItem('toneColorsEnabled') === 'true';
    });
    const [lookedUpWords, setLookedUpWords] = useState(new Set());
    const [recentWordsList, setRecentWordsList] = useState([]); // Track recent words for watermark animation
    const [readingProgress, setReadingProgress] = useState(0);
    const [activeHighlight, setActiveHighlight] = useState(null);
    const contentRef = useRef(null);
    const hoverTimer = useRef(null);
    const isMobile = useIsMobile();

    useEffect(() => {
        const loadWords = async () => {
            const list = await getVocabularyList();
            setLookedUpWords(new Set(list.map(w => w.word)));
        };
        loadWords();
    }, []);

    // Clear active word highlight 1 second after popup closes to allow CSS fade
    useEffect(() => {
        if (!popupData && activeHighlight !== null) {
            const timer = setTimeout(() => setActiveHighlight(null), 1000);
            return () => clearTimeout(timer);
        }
    }, [popupData, activeHighlight]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only trigger if user is not typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (getIsPaused()) {
                    resumeStats();
                } else {
                    pauseStats();
                }
            } else if (e.key === 'n' && !isMobile && story) {
                // Find next "unknown" word
                e.preventDefault();

                const paras = story.content.split('\n');
                let startPara = 0;
                let startChar = -1; // -1 to start searching from 0 in the first paragraph if none active
                let currentWordLength = 0;

                if (activeHighlight) {
                    startPara = activeHighlight.paraIdx;
                    startChar = activeHighlight.charIdx;
                    if (popupData && popupData.word) {
                        currentWordLength = popupData.word.length;
                    }
                }

                let found = false;

                // Resume searching from the exact end of the currently highlighted word
                for (let pIdx = startPara; pIdx < paras.length; pIdx++) {
                    const paraText = paras[pIdx];
                    let cIdx = (pIdx === startPara) ? Math.max(0, startChar + currentWordLength) : 0;

                    while (cIdx < paraText.length) {
                        const result = lookupStartingAt(paraText, cIdx);
                        if (result) {
                            if (!lookedUpWords.has(result.word)) {
                                // Found the next unknown word!
                                trackSessionLookup();
                                setPopupData(result);

                                setActiveHighlight({
                                    paraIdx: pIdx,
                                    charIdx: cIdx
                                });

                                // Scroll smoothly to the paragraph
                                const paraEl = contentRef.current?.querySelector(`[data-para-index="${pIdx}"]`);
                                if (paraEl) {
                                    paraEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }

                                // Update history
                                setLookedUpWords(prev => new Set(prev).add(result.word));
                                setRecentWordsList(prev => {
                                    const filtered = prev.filter(w => w !== result.word);
                                    return [...filtered, result.word].slice(-5);
                                });
                                trackWordClick(result.word, story.id);

                                found = true;
                                break;
                            } else {
                                // Skip known word length
                                cIdx += result.word.length;
                            }
                        } else {
                            // Single character, not a dictionary word
                            cIdx++;
                        }
                    }
                    if (found) break;
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeHighlight, popupData, lookedUpWords, story, isMobile]);

    useEffect(() => {
        localStorage.setItem('toneColorsEnabled', toneColorsEnabled);
    }, [toneColorsEnabled]);

    // Theme state
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    const [toneColorTheme, setToneColorTheme] = useState(() => localStorage.getItem('toneColorTheme') || 'vibrant');

    useEffect(() => {
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('toneColorTheme', toneColorTheme);
        document.documentElement.setAttribute('data-tone-theme', toneColorTheme);
    }, [toneColorTheme]);

    const toggleTheme = () => {
        setTheme(prev => {
            if (prev === 'dark') return 'light';
            if (prev === 'light') return 'sepia';
            return 'dark';
        });
    };

    const cycleToneTheme = () => {
        setToneColorTheme(prev => {
            if (prev === 'vibrant') return 'pastel';
            if (prev === 'pastel') return 'standard';
            return 'vibrant';
        });
    };

    // Managing reading session
    useEffect(() => {
        if (!story) return;

        // Start session immediately if page is visible
        if (!document.hidden) {
            startReadingSession();
        }

        const handleVisibilityChange = () => {
            if (document.hidden) {
                endReadingSession();
            } else {
                startReadingSession();
            }
        };

        // pagehide is the most reliable signal for mobile PWA close / background
        const handlePageHide = () => {
            endReadingSession();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            // Story changed or component unmounted — save current session
            endReadingSession();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [story]);

    // Restore bookmark when story changes
    useEffect(() => {
        if (!story || !contentRef.current) return;

        contentRef.current.scrollTop = 0;

        // Initialize CPM tracking for this story
        initStoryTracking(story.id, !!story.isRead);

        const restorePos = async () => {
            const bookmark = await getBookmark(story.id);
            if (bookmark && contentRef.current) {
                contentRef.current.scrollTop = bookmark.scrollPosition;
            }
        };

        setTimeout(restorePos, 100);
    }, [story]);

    // Save bookmark and update progress on scroll
    const handleScroll = (e) => {
        if (story) {
            const target = e.target;
            const scrollTop = target.scrollTop;
            const scrollHeight = target.scrollHeight;
            const clientHeight = target.clientHeight;

            // Save bookmark
            saveBookmark(story.id, scrollTop);

            // Calculate progress
            // We use a safe division to avoid NaN
            const progressRatio = scrollHeight > 0 ? (scrollTop + clientHeight) / scrollHeight : 0;
            const percentage = Math.min(100, Math.max(0, Math.round(progressRatio * 100)));

            // Update progress bar state
            setReadingProgress(percentage);

            // Calculate approximate chars read
            // Accurate count: Match only Chinese characters (CJK Unified Ideographs)
            // This excludes punctuation, spaces, HTML tags, and latin text/pinyin
            const chineseChars = story.content
                ? (story.content.match(/[\u4e00-\u9fff]/g) || []).length
                : 0;
            const charsRead = Math.round(chineseChars * progressRatio);

            // Track CPM
            trackScrollProgress(charsRead);

            // Dispatch event for StatsToolbar
            window.dispatchEvent(new CustomEvent('readingProgressUpdated', {
                detail: {
                    percentage,
                    charsRead
                }
            }));
        }
    };

    const handleTextClick = (e) => {
        if (!isMobile) return; // Desktop uses hover instead of click

        setPopupData(null);

        // Check if the clicked element (or parent) has a data-word attribute
        const target = e.target.closest('[data-word], [data-index]');

        if (target) {
            const indexStr = target.getAttribute('data-index');
            const paraEl = target.closest('[data-para-index]');
            if (indexStr !== null && paraEl) {
                setActiveHighlight({
                    charIdx: parseInt(indexStr, 10),
                    paraIdx: parseInt(paraEl.getAttribute('data-para-index'), 10)
                });
            }

            const word = target.getAttribute('data-word');
            // Look up the word directly
            let result = word ? lookupAt(word, 0) : null;

            // If no word attribute, use the exact index from the span itself
            if (!result && indexStr !== null && paraEl) {
                const exactIndex = parseInt(indexStr, 10);
                result = lookupAt(paraEl.textContent, exactIndex);
            }

            if (result) {
                trackSessionLookup(); // Track stats
                setPopupData(result);

                // Update Background watermark history
                setLookedUpWords(prev => new Set(prev).add(result.word));
                setRecentWordsList(prev => {
                    // Remove if already exists so it moves to front, keep max 5
                    const filtered = prev.filter(w => w !== result.word);
                    return [...filtered, result.word].slice(-5);
                });

                if (story && story.id) {
                    trackWordClick(result.word, story.id);
                }
                return;
            }
        }

        // Fallback for non-word clicks (e.g. single chars not part of a word)
        // This handles cases where ColorizedText rendered a single char without data-word
        // OR standard paragraph text if tone colors are disabled
        const paragraph = e.target.closest('.reader-para');
        if (!paragraph) return;

        let range;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.setEnd(pos.offsetNode, pos.offset);
        }

        if (!range) return;

        // Calculate global offset relative to the paragraph
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(paragraph);
        preCaretRange.setEnd(range.endContainer, range.endOffset);

        const globalOffset = preCaretRange.toString().length;
        const text = paragraph.textContent;

        // Try lookup at current position
        let result = lookupAt(text, globalOffset);

        // If no result (e.g. clicked at end of char), try previous char
        if (!result && globalOffset > 0) {
            result = lookupAt(text, globalOffset - 1);
        }

        if (result) {
            trackSessionLookup(); // Track stats
            setPopupData(result);

            // Update Background watermark history
            setLookedUpWords(prev => new Set(prev).add(result.word));
            setRecentWordsList(prev => {
                const filtered = prev.filter(w => w !== result.word);
                return [...filtered, result.word].slice(-5);
            });

            if (story && story.id) {
                trackWordClick(result.word, story.id);
            }
        }
    };

    const handleTextHover = (e) => {
        if (isMobile) return;

        const target = e.target.closest('[data-word], [data-index]');
        if (!target) return;

        if (hoverTimer.current) {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }

        const indexStr = target.getAttribute('data-index');
        const paraEl = target.closest('[data-para-index]');

        let word = target.getAttribute('data-word');
        let result = word ? lookupAt(word, 0) : null;

        if (!result && indexStr !== null && paraEl) {
            const exactIndex = parseInt(indexStr, 10);
            result = lookupAt(paraEl.textContent, exactIndex);
        }

        if (result) {
            // Prevent flicker if hovering the same word
            if (popupData && popupData.word === result.word) return;

            trackSessionLookup();
            setPopupData(result);

            // Update background watermark history
            setLookedUpWords(prev => new Set(prev).add(result.word));
            setRecentWordsList(prev => {
                const filtered = prev.filter(w => w !== result.word);
                return [...filtered, result.word].slice(-5);
            });

            if (indexStr !== null && paraEl) {
                setActiveHighlight({
                    charIdx: parseInt(indexStr, 10),
                    paraIdx: parseInt(paraEl.getAttribute('data-para-index'), 10)
                });
            }

            if (story && story.id) {
                trackWordClick(result.word, story.id);
            }
        }
    };

    const handleTextOut = (e) => {
        if (isMobile) return;

        const target = e.target.closest('[data-word], [data-index]');
        if (!target) return;

        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => {
            // We NO LONGER clear popupData on mouse out for desktop,
            // because the Lexicon Sidebar is persistent!
            // However, we DO clear the active highlight from the text.
            setActiveHighlight(null);
        }, 300); // Give user time to move mouse before clearing highlight
    };

    const toggleToneColors = () => {
        setToneColorsEnabled(!toneColorsEnabled);
    };

    const handleFontSizeChange = (delta) => {
        const newSize = Math.max(12, Math.min(48, fontSize + delta));
        setFontSize(newSize);
        localStorage.setItem('fontSize', newSize);
    };

    if (!story) return <div className="reader-empty">Select a story to start reading</div>;

    return (
        <div className="reader-container">
            {/* Reading Progress Bar */}
            <div className="reading-progress-bar">
                <div
                    className="reading-progress-fill"
                    style={{ width: `${readingProgress}%` }}
                />
            </div>

            <div className="reader-main">
                {!isMobile && (
                    <div className="reader-toolbar">
                        <div className="toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <RecentLookups words={recentWordsList} />
                            <h3 style={{ fontSize: '14px', opacity: 0.5, margin: 0 }}>{story?.title}</h3>
                        </div>

                        <div className="toolbar-center">
                            <StatsToolbar currentStoryId={story ? story.id : null} />
                        </div>

                        <div className="toolbar-right">
                            <button onClick={() => handleFontSizeChange(-2)}>A-</button>
                            <span style={{ margin: '0 8px' }}>{fontSize}px</span>
                            <button onClick={() => handleFontSizeChange(2)}>A+</button>
                            <button
                                onClick={toggleToneColors}
                                className={toneColorsEnabled ? 'active' : ''}
                                style={{ marginLeft: '8px' }}
                                title="Toggle tone dots"
                            >
                                •
                            </button>
                        </div>
                    </div>
                )}

                <div
                    className="reader-content"
                    style={{ fontSize: `${fontSize}px` }}
                    onClick={handleTextClick}
                    onMouseOver={!isMobile ? handleTextHover : undefined}
                    onMouseOut={!isMobile ? handleTextOut : undefined}
                    onScroll={handleScroll}
                    ref={contentRef}
                >
                    {isMobile && story.title && (
                        <h2 className="mobile-story-title">{story.title}</h2>
                    )}
                    {story.content.split('\n').map((para, idx) => (
                        <p key={idx} className="reader-para" data-para-index={idx}>
                            <ColorizedText
                                text={para}
                                enabled={true}
                                lookedUpWords={lookedUpWords}
                                overrideToneColors={toneColorsEnabled ? null : false}
                                activeIndex={activeHighlight?.paraIdx === idx ? activeHighlight.charIdx : null}
                            />
                        </p>
                    ))}
                </div>
            </div>

            {isMobile ? (
                <>
                    <StatsToolbar currentStoryId={story ? story.id : null} />
                    <MobileBottomSheet
                        data={popupData}
                        onClose={() => setPopupData(null)}
                    />
                    <FloatingActionMenu
                        fontSize={fontSize}
                        onFontSizeChange={handleFontSizeChange}
                        theme={theme}
                        onThemeToggle={toggleTheme}
                        toneColorsEnabled={toneColorsEnabled}
                        onToneColorsToggle={toggleToneColors}
                        toneColorTheme={toneColorTheme}
                        onToneThemeCycle={cycleToneTheme}
                    />
                </>
            ) : (
                <LexiconSidebar data={popupData} />
            )}
        </div>
    );
};

export default Reader;
