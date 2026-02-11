import React, { useState, useEffect, useRef } from 'react';
import { lookupAt } from '../lib/dictionary';
import { saveBookmark, getBookmark } from '../lib/storage';
import { startReadingSession, endReadingSession } from '../lib/stats';
import { trackWordClick } from '../lib/vocabulary';
import { useIsMobile } from '../lib/useIsMobile';
import WordPopup from './WordPopup';
import MobileBottomSheet from './MobileBottomSheet';
import ColorizedText from './ColorizedText';
import FloatingActionMenu from './FloatingActionMenu';

const Reader = ({ story }) => {
    const [fontSize, setFontSize] = useState(() => {
        return parseInt(localStorage.getItem('fontSize')) || 20;
    });
    const [popupData, setPopupData] = useState(null);
    const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
    const [toneColorsEnabled, setToneColorsEnabled] = useState(() => {
        return localStorage.getItem('toneColorsEnabled') === 'true';
    });
    const contentRef = useRef(null);
    const isMobile = useIsMobile();

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

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', endReadingSession);
        window.addEventListener('focus', startReadingSession);

        return () => {
            endReadingSession();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', endReadingSession);
            window.removeEventListener('focus', startReadingSession);
        };
    }, [story]);

    // Restore bookmark when story changes
    useEffect(() => {
        if (!story || !contentRef.current) return;

        contentRef.current.scrollTop = 0;

        const restorePos = async () => {
            const bookmark = await getBookmark(story.id);
            if (bookmark && contentRef.current) {
                contentRef.current.scrollTop = bookmark.scrollPosition;
            }
        };

        setTimeout(restorePos, 100);
    }, [story]);

    // Save bookmark on scroll
    const handleScroll = (e) => {
        if (story) {
            saveBookmark(story.id, e.target.scrollTop);
        }
    };

    const handleTextClick = (e) => {
        setPopupData(null);

        // Check if the clicked element (or parent) has a data-word attribute
        const target = e.target.closest('[data-word]');

        if (target) {
            const word = target.getAttribute('data-word');
            // Look up the word directly
            const result = lookupAt(word, 0);

            if (result) {
                setPopupData(result);
                setPopupPos({ x: e.clientX, y: e.clientY });

                if (story && story.id) {
                    trackWordClick(result.word, story.id);
                }
            }
            return;
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
            setPopupData(result);
            setPopupPos({ x: e.clientX, y: e.clientY });

            if (story && story.id) {
                trackWordClick(result.word, story.id);
            }
        }
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
            {!isMobile && (
                <div className="reader-toolbar">
                    <div className="toolbar-left">
                        <h3>{story.title}</h3>
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
                onScroll={handleScroll}
                ref={contentRef}
            >
                {isMobile && story.title && (
                    <h2 className="mobile-story-title">{story.title}</h2>
                )}
                {story.content.split('\n').map((para, idx) => (
                    <p key={idx} className="reader-para">
                        {toneColorsEnabled ? (
                            <ColorizedText text={para} enabled={toneColorsEnabled} />
                        ) : (
                            para
                        )}
                    </p>
                ))}
            </div>

            {isMobile ? (
                <>
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
                <WordPopup
                    data={popupData}
                    position={popupPos}
                    onClose={() => setPopupData(null)}
                />
            )}
        </div>
    );
};

export default Reader;
