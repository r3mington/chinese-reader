import React, { useEffect, useRef } from 'react';
import { convertPinyin } from '../lib/pinyin';
import { toggleStarred, getWordStats } from '../lib/vocabulary';
import { lookupAt } from '../lib/dictionary';
import { getHskLevel } from '../lib/hsk';
import { getEtymology } from '../lib/etymology';
import { checkToneSandhi } from '../lib/tones';
import { getFrequencyRank } from '../lib/frequency';
import { loadSentencesDb, getExampleSentences } from '../lib/sentences';
import '../styles/oled.css';

const MobileBottomSheet = ({ data, onClose }) => {
    const sheetRef = useRef(null);
    const [stats, setStats] = React.useState(null);
    const [isProperName, setIsProperName] = React.useState(false);
    const starred = stats?.starred || false;

    // Check stats when data changes
    useEffect(() => {
        loadSentencesDb(); // Make sure DB is loaded

        if (data && data.entries && data.entries.length > 0) {
            const word = data.entries[0].simplified;
            getWordStats(word).then(s => {
                setStats(s || { starred: false, clickCount: 0 }); // Default empty stats
            });
            import('../lib/names').then(({ isProperNameLocked }) => {
                isProperNameLocked(word).then(setIsProperName);
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

    if (!data || !data.entries || data.entries.length === 0) return null;

    const mainEntry = data.entries[0];
    if (!mainEntry || !mainEntry.simplified) return null;

    const word = mainEntry.simplified;
    const trad = mainEntry.traditional;
    const showTrad = trad && trad !== word;
    const hskLevel = getHskLevel(word);
    const freqRank = getFrequencyRank(word);

    // Tone Sandhi Check
    // Get pinyin array for the word. If multi-character, try to split.
    const pinyinStr = mainEntry.pinyin || '';
    // Typically pinyin in dictionary looks like "ni3 hao3". Standardize to array:
    const pinyinArr = pinyinStr.split(/\s+/).filter(Boolean);
    const toneSandhiRule = checkToneSandhi(word, pinyinArr);

    const handleCopy = () => {
        navigator.clipboard.writeText(word);
        // Could show a toast here
    };

    const handleToggleStar = async () => {
        const newStatus = await toggleStarred(word);
        setStats(prev => ({ ...prev, starred: newStatus }));
    };

    const handleToggleName = async () => {
        const { toggleProperName } = await import('../lib/names');
        const newStatus = await toggleProperName(word);
        setIsProperName(newStatus);
    };

    // Character Breakdown Logic
    const getBreakdown = () => {
        try {
            if (!word || word.length <= 1) return null;

            return word.split('').map((char, index) => {
                const result = lookupAt(char, 0);
                const entry = result?.entries?.[0];
                const etymology = getEtymology(char);
                return {
                    char,
                    pinyin: entry?.pinyin || '',
                    definition: entry?.definitions?.[0] || 'No definition',
                    etymology
                };
            });
        } catch (e) {
            console.error('Error generating breakdown:', e);
            return null;
        }
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
                            <div className="sheet-word-group">
                                <span className="bottom-sheet-word">{word}</span>
                                {showTrad && <span className="bottom-sheet-trad">{trad}</span>}
                                <span className="bottom-sheet-pinyin">{convertPinyin(mainEntry.pinyin)}</span>
                                {hskLevel && <span className="sheet-badge hsk-badge">HSK {hskLevel}</span>}
                                {freqRank && freqRank <= 20000 && <span className="sheet-badge freq-badge">🏆 #{freqRank}</span>}
                                {toneSandhiRule && (
                                    <span className="sheet-badge sandhi-badge" title={toneSandhiRule}>
                                        ⚠️ Sandhi
                                    </span>
                                )}
                            </div>
                            <div className="sheet-actions">
                                <button className="sheet-action-btn" onClick={() => {
                                    const utterance = new SpeechSynthesisUtterance(word);
                                    utterance.lang = 'zh-CN';
                                    window.speechSynthesis.speak(utterance);
                                }} title="Listen">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                    </svg>
                                </button>
                                <button className="sheet-action-btn" onClick={() => {
                                    window.location.href = `plecoapi://x-callback-url/s?q=${encodeURIComponent(word)}`;
                                }} title="Open in Pleco">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                        <path d="M12 6v6"></path>
                                        <path d="M9 9h6"></path>
                                    </svg>
                                </button>
                                <button className="sheet-action-btn" onClick={() => {
                                    window.open(`https://translate.google.com/?sl=zh-CN&tl=en&text=${encodeURIComponent(word)}&op=translate`, '_blank');
                                }} title="Google Translate">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 8l6 6"></path>
                                        <path d="M4 14l6-6 2-3"></path>
                                        <path d="M2 5h12"></path>
                                        <path d="M7 2h1"></path>
                                        <path d="M22 22l-5-10-5 10"></path>
                                        <path d="M14 18h6"></path>
                                    </svg>
                                </button>
                                <div className="sheet-divider" style={{ width: 1, height: 16, background: 'var(--border-color)', margin: '0 2px' }}></div>
                                <button className="sheet-action-btn" onClick={handleCopy} title="Copy">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </button>
                                <button className={`sheet-action-btn ${isProperName ? 'starred' : ''}`} style={{ color: isProperName ? '#bb86fc' : undefined }} onClick={handleToggleName} title="Mark as Name">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill={isProperName ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>
                                </button>
                                <button className={`sheet-action-btn ${starred ? 'starred' : ''}`} onClick={handleToggleStar} title="Star">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bottom-sheet-definitions">
                        {mainEntry.definitions.join(' ◆ ')}
                    </div>

                    <div className="sheet-stats-inline">
                        <span>👀 Seen: <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{stats?.clickCount || 1}</span> times</span>
                        {stats?.firstSeen && (
                            <span> · 📅 Since: {new Date(stats.firstSeen).toLocaleDateString()}</span>
                        )}
                    </div>

                    {(() => {
                        const examples = getExampleSentences(word);
                        if (!examples || examples.length === 0) return null;
                        const mainExample = examples[0];

                        // Highlight the target word in the sentence
                        const parts = mainExample.zh.split(word);
                        return (
                            <div className="sheet-example-card">
                                <div className="example-header">
                                    <span style={{ fontSize: 11, fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Example</span>
                                    <button className="sheet-action-btn" style={{ padding: 4 }} onClick={() => {
                                        const utterance = new SpeechSynthesisUtterance(mainExample.zh);
                                        utterance.lang = 'zh-CN';
                                        window.speechSynthesis.speak(utterance);
                                    }} title="Listen to example">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                        </svg>
                                    </button>
                                </div>
                                <div className="example-zh">
                                    {parts.map((part, i) => (
                                        <React.Fragment key={i}>
                                            {part}
                                            {i < parts.length - 1 && <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{word}</span>}
                                        </React.Fragment>
                                    ))}
                                </div>
                                <div className="example-en">{mainExample.en}</div>
                            </div>
                        );
                    })()}

                    {breakdown && breakdown.length > 1 && (
                        <div className="sheet-breakdown-section">
                            <div className="sheet-breakdown-list-inline">
                                {breakdown.map((item, idx) => (
                                    <div key={idx} className="breakdown-chip" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                            <span className="breakdown-chip-char">{item.char}</span>
                                            <span className="breakdown-chip-pinyin">{convertPinyin(item.pinyin)}</span>
                                            <span className="breakdown-chip-def">
                                                {item.definition.split(' ').slice(0, 4).join(' ')}
                                            </span>
                                        </div>
                                        {item.etymology && (
                                            <div className="breakdown-etymology">
                                                ⚛️ {item.etymology}
                                            </div>
                                        )}
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
