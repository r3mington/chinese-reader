import React, { useEffect, useRef } from 'react';
import { convertPinyin } from '../lib/pinyin';
import { toggleStarred, getWordStats } from '../lib/vocabulary';
import { lookupAt } from '../lib/dictionary';
import '../styles/oled.css';

const MobileBottomSheet = ({ data, onClose }) => {
    const [starred, setStarred] = React.useState(false);

    // Check starred status when data changes
    useEffect(() => {
        if (data && data.entries && data.entries.length > 0) {
            const word = data.entries[0].simplified;
            getWordStats(word).then(stats => {
                setStarred(stats?.starred || false);
            });
        }
    }, [data]);

    useEffect(() => {
        if (data) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [data]);

    if (!data) return null;

    const mainEntry = data.entries[0];
    const word = mainEntry.simplified;

    const handleCopy = () => {
        navigator.clipboard.writeText(word);
        // Could show a toast here
    };

    const handleToggleStar = async () => {
        const newStatus = await toggleStarred(word);
        setStarred(newStatus);
    };

    // Character Breakdown Logic
    const getBreakdown = () => {
        if (word.length <= 1) return null;

        return word.split('').map((char, index) => {
            const result = lookupAt(char, 0);
            return {
                char,
                pinyin: result?.entries[0]?.pinyin || '',
                definition: result?.entries[0]?.definitions[0] || 'No definition'
            };
        });
    };

    const breakdown = getBreakdown();

    return (
        <>
            <div className="bottom-sheet-backdrop" onClick={onClose} />
            <div className="bottom-sheet" ref={sheetRef}>
                <div className="bottom-sheet-handle" />
                <button className="bottom-sheet-close" onClick={onClose}>✕</button>

                <div className="bottom-sheet-content">
                    <div className="bottom-sheet-header-section">
                        <div className="sheet-main-row">
                            <span className="bottom-sheet-word">{word}</span>
                            <div className="sheet-actions">
                                <button className="sheet-action-btn" onClick={handleCopy} title="Copy">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </button>
                                <button className={`sheet-action-btn ${starred ? 'starred' : ''}`} onClick={handleToggleStar} title="Star">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <span className="bottom-sheet-pinyin">{convertPinyin(mainEntry.pinyin)}</span>
                    </div>

                    <div className="bottom-sheet-definitions">
                        {mainEntry.definitions.map((def, i) => (
                            <div key={i} className="bottom-sheet-def-item">
                                {i + 1}. {def}
                            </div>
                        ))}
                    </div>

                    {breakdown && (
                        <div className="sheet-breakdown-section">
                            <div className="sheet-section-title">Character Breakdown</div>
                            <div className="sheet-breakdown-list">
                                {breakdown.map((item, idx) => (
                                    <div key={idx} className="breakdown-item">
                                        <span className="breakdown-char">{item.char}</span>
                                        <div className="breakdown-info">
                                            <span className="breakdown-pinyin">{convertPinyin(item.pinyin)}</span>
                                            <span className="breakdown-def">{item.definition}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default MobileBottomSheet;
