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
    const [fontSize, setFontSize] = useState(20);
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'light';
    });
    const [popupData, setPopupData] = useState(null);
    const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
    const [toneColorsEnabled, setToneColorsEnabled] = useState(() => {
        return localStorage.getItem('toneColorsEnabled') === 'true';
    });
    const [toneColorTheme, setToneColorTheme] = useState(() => {
        return localStorage.getItem('toneColorTheme') || 'vibrant';
    });
    const contentRef = useRef(null);
    const isMobile = useIsMobile();

    // Initial theme setup and persistence
    useEffect(() => {
        document.body.className = theme === 'light' ? '' : `${theme}-mode`;
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Persist tone color settings
    useEffect(() => {
        localStorage.setItem('toneColorsEnabled', toneColorsEnabled);
    }, [toneColorsEnabled]);

    useEffect(() => {
        localStorage.setItem('toneColorTheme', toneColorTheme);
    }, [toneColorTheme]);

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

        let range, offset, textNode;

        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(e.clientX, e.clientY);
            textNode = range.startContainer;
            offset = range.startOffset;
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            textNode = pos.offsetNode;
            offset = pos.offset;
        }

        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

        const text = textNode.textContent;
        const result = lookupAt(text, offset);

        if (result) {
            setPopupData(result);
            setPopupPos({ x: e.clientX, y: e.clientY });

            if (story && story.id) {
                trackWordClick(result.word, story.id);
            }
        }
    };

    const toggleTheme = () => {
        const modes = ['light', 'sepia', 'dark'];
        const next = modes[(modes.indexOf(theme) + 1) % modes.length];
        setTheme(next);
    };

    const toggleToneColors = () => {
        setToneColorsEnabled(!toneColorsEnabled);
    };

    const cycleToneTheme = () => {
        const themes = ['vibrant', 'pastel', 'neon'];
        const currentIndex = themes.indexOf(toneColorTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        setToneColorTheme(themes[nextIndex]);
    };

    const handleFontSizeChange = (delta) => {
        setFontSize(Math.max(12, Math.min(48, fontSize + delta)));
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
                        <button onClick={() => setFontSize(Math.max(12, fontSize - 2))}>A-</button>
                        <span style={{ margin: '0 8px' }}>{fontSize}px</span>
                        <button onClick={() => setFontSize(Math.min(48, fontSize + 2))}>A+</button>
                        <button onClick={toggleTheme} style={{ marginLeft: '8px' }}>
                            {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '☕'}
                        </button>
                        <button
                            onClick={toggleToneColors}
                            style={{
                                marginLeft: '8px',
                                background: toneColorsEnabled ? 'var(--primary-color)' : 'transparent',
                                border: toneColorsEnabled ? 'none' : '1px solid var(--border-color)',
                                color: toneColorsEnabled ? 'white' : 'var(--text-color)'
                            }}
                            title="Toggle tone colors"
                        >
                            🎨
                        </button>
                        {toneColorsEnabled && (
                            <button
                                onClick={cycleToneTheme}
                                style={{ marginLeft: '4px', fontSize: '12px' }}
                                title={`Theme: ${toneColorTheme}`}
                            >
                                {toneColorTheme === 'vibrant' ? '💥' : toneColorTheme === 'pastel' ? '🌸' : '✨'}
                            </button>
                        )}
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
                            <ColorizedText text={para} theme={toneColorTheme} enabled={true} />
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
