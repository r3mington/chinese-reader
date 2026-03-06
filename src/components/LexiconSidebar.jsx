import React, { useEffect, useState } from 'react';
import { getHskLevel } from '../lib/hsk';
import { checkToneSandhi } from '../lib/tones';
import { getFrequencyRank } from '../lib/frequency';
import { loadSentencesDb, getExampleSentences } from '../lib/sentences';
import { toggleStarred, getWordStats } from '../lib/vocabulary';
import { getEtymology } from '../lib/etymology';
import { lookupAt, getWordFamilies } from '../lib/dictionary';
import { loadLinguisticDatasets, getRadical, getMnemonic, getSynonyms } from '../lib/linguistics';
import { convertPinyin } from '../lib/pinyin';
import { getCurrentSessionDuration } from '../lib/stats';
import '../styles/oled.css';

const LexiconSidebar = ({ data }) => {
    const [stats, setStats] = useState(null);
    const [viewMode, setViewMode] = useState('detail'); // 'detail' or 'starred'
    const [starredWordsList, setStarredWordsList] = useState([]);
    const [sessionData, setSessionData] = useState({ chars: 0, cpm: '--' });
    const [linguisticsLoaded, setLinguisticsLoaded] = useState(false);
    const starred = stats?.starred || false;

    // Ensure sentences DB is loaded
    useEffect(() => {
        loadSentencesDb();
        loadLinguisticDatasets().then(() => {
            setLinguisticsLoaded(true);
        });
    }, []);

    useEffect(() => {
        if (data && data.word) {
            getWordStats(data.word).then(s => {
                setStats(s || { starred: false, clickCount: 0 });
            });
            setViewMode('detail'); // Auto-switch to detail when a new word is clicked
        }
    }, [data]);

    useEffect(() => {
        if (viewMode === 'starred') {
            import('../lib/vocabulary').then(({ getVocabularyList }) => {
                getVocabularyList().then(list => {
                    setStarredWordsList(list.filter(w => w.starred));
                });
            });
        }
    }, [viewMode, stats?.starred]); // Re-fetch if they star/unstar something

    useEffect(() => {
        const handleProgress = (e) => {
            const chars = e.detail.charsRead;
            const minutes = getCurrentSessionDuration();
            const cpm = minutes > 0 ? Math.round(chars / minutes) : '--';
            setSessionData({ chars, cpm });
        };
        window.addEventListener('readingProgressUpdated', handleProgress);
        return () => window.removeEventListener('readingProgressUpdated', handleProgress);
    }, []);

    // Use convertPinyin from our lib to render tone marks instead of numbers
    const renderPinyin = (pinyin) => {
        return pinyin ? convertPinyin(pinyin.toLowerCase()) : '';
    };

    if (!data || (!data.word && data.type !== 'sentence')) {
        return (
            <div className="lexicon-sidebar empty">
                <div className="lexicon-header">
                    <span className="lexicon-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        LEXICON_ENGINE_v2.1
                        {starredWordsList.length > 0 && (
                            <button
                                onClick={() => setViewMode(viewMode === 'starred' ? 'detail' : 'starred')}
                                style={{ padding: '2px 6px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.2)', marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                Bank ({starredWordsList.length || '0'})
                            </button>
                        )}
                    </span>
                    <span className="lexicon-icon">✧</span>
                </div>
                {viewMode === 'starred' ? (
                    <div className="lexicon-scroll-area">
                        <div style={{ padding: '0 20px 20px 20px' }}>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: 16, marginTop: 16 }}>
                                STARRED VOCABULARY
                            </div>
                            {starredWordsList.map((sw, i) => (
                                <div key={i} className="vocab-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', marginBottom: '8px', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontFamily: 'var(--font-chinese)', fontSize: '20px', color: 'var(--accent-blue)', fontWeight: 'bold' }}>
                                            {sw.word}
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            Seen {sw.clickCount}x
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                        <button className="lex-action-btn" onClick={() => {
                                            window.open(`https://translate.google.com/?sl=zh-CN&tl=en&text=${encodeURIComponent(sw.word)}&op=translate`, '_blank');
                                        }} style={{ padding: '4px 8px', fontSize: '11px' }}>Translate</button>
                                        <button className="lex-action-btn" onClick={() => {
                                            window.location.href = `plecoapi://x-callback-url/s?q=${encodeURIComponent(sw.word)}`;
                                        }} style={{ padding: '4px 8px', fontSize: '11px' }}>Pleco</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="lexicon-idle">
                        <div style={{ color: 'rgba(255, 255, 255, 0.4)', marginBottom: 16 }}>[ SYSTEM IDLE ]</div>

                        <div style={{ opacity: 0.6, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>SESSION STATUS</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ opacity: 0.5 }}>Speed:</span>
                                <span style={{ color: 'white' }}>{sessionData.cpm} cpm</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ opacity: 0.5 }}>Characters:</span>
                                <span style={{ color: 'white' }}>{sessionData.chars}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (data.type === 'sentence') {
        return (
            <div className="lexicon-sidebar">
                <div className="lexicon-header">
                    <span className="lexicon-title" style={{ color: 'var(--accent-blue)' }}>CONTEXT_MODE</span>
                    <span className="lexicon-icon">✧</span>
                </div>

                <div className="lexicon-scroll-area" style={{ padding: '24px 20px' }}>
                    <div style={{ marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16 }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: 12 }}>
                            ACTIVE PARAGRAPH
                        </div>
                        <p style={{
                            fontFamily: 'var(--font-chinese)',
                            fontSize: '20px',
                            lineHeight: 1.6,
                            color: 'var(--text-primary)',
                            margin: 0
                        }}>
                            {data.text}
                        </p>
                    </div>

                    <div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: 12, marginTop: 16 }}>
                            TRANSLATION
                        </div>
                        {data.isLoading ? (
                            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>Translating...</p>
                        ) : (
                            <p style={{
                                fontFamily: 'var(--font-main)',
                                fontSize: '15.5px',
                                lineHeight: 1.6,
                                color: 'var(--text-primary)',
                                margin: 0
                            }}>
                                {data.translation}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const word = data.word;
    const mainEntry = data.entries?.[0] || {};
    const traditional = mainEntry.traditional || word;
    const pinyin = mainEntry.pinyin || '';
    const definitions = mainEntry.definitions || [];

    // Extract Measure Words (CL)
    const measureWords = [];
    const cleanDefinitions = [];
    definitions.forEach(def => {
        if (def.startsWith('CL:')) {
            measureWords.push(def.replace('CL:', ''));
        } else {
            cleanDefinitions.push(def);
        }
    });

    const hskLevel = getHskLevel(word);
    const freqRank = getFrequencyRank(word);
    const wordFamilies = getWordFamilies(word);
    const synonymsList = getSynonyms(word);

    const pinyinArr = pinyin.split(/\s+/).filter(Boolean);
    const toneSandhiRule = checkToneSandhi(word, pinyinArr);

    const examples = getExampleSentences(word) || [];

    const handleCopy = () => {
        navigator.clipboard.writeText(word);
    };

    const handleToggleStar = async () => {
        const newStatus = await toggleStarred(word);
        setStats(prev => ({ ...prev, starred: newStatus }));
    };

    // Character Breakdown Logic
    const getBreakdown = () => {
        try {
            if (!word || word.length <= 1) return null;

            return word.split('').map((char) => {
                const result = lookupAt(char, 0);
                const entry = result?.entries?.[0];
                const etymology = getEtymology(char);
                const radical = getRadical(char);
                const mnemonic = getMnemonic(char);
                return {
                    char,
                    pinyin: entry?.pinyin || '',
                    definition: entry?.definitions?.[0] || 'No definition',
                    etymology,
                    radical,
                    mnemonic
                };
            });
        } catch (e) {
            console.error('Error generating breakdown:', e);
            return null;
        }
    };

    const breakdown = getBreakdown();

    return (
        <div className="lexicon-sidebar">
            {word && viewMode === 'detail' && (
                <div className="lexicon-bg-character">
                    {word.length > 2 ? word.substring(0, 2) : word}
                </div>
            )}
            <div className="lexicon-header">
                <span className="lexicon-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    LEXICON_ENGINE_v2.1
                    <button
                        onClick={() => setViewMode(viewMode === 'starred' ? 'detail' : 'starred')}
                        style={{ padding: '2px 6px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.2)', marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '4px', background: viewMode === 'starred' ? 'rgba(255,255,255,0.1)' : 'transparent' }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        Bank
                    </button>
                </span>
                <span className="lexicon-icon">✧</span>
            </div>

            <div className="lexicon-scroll-area">
                {viewMode === 'starred' ? (
                    <div style={{ padding: '0 20px 20px 20px' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: 16, marginTop: 16 }}>
                            STARRED VOCABULARY
                        </div>
                        {starredWordsList.length === 0 && (
                            <div style={{ opacity: 0.5, fontSize: '13px', fontStyle: 'italic' }}>No words saved yet. Press 'l' to star a word.</div>
                        )}
                        {starredWordsList.map((sw, i) => {
                            const result = lookupAt(sw.word, 0);
                            const entry = result?.entries?.[0];
                            const pinyinStr = entry?.pinyin ? convertPinyin(entry.pinyin.toLowerCase()) : '';
                            let defStr = entry?.definitions?.[0] || '';
                            if (defStr.startsWith('CL:')) {
                                defStr = entry?.definitions?.[1] || defStr;
                            }

                            return (
                                <div key={i} className="vocab-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', marginBottom: '8px', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1, paddingRight: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                <div style={{ fontFamily: 'var(--font-chinese)', fontSize: '20px', color: 'var(--accent-blue)', fontWeight: 'bold' }}>
                                                    {sw.word}
                                                </div>
                                                {pinyinStr && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{pinyinStr}</div>}
                                            </div>
                                            {defStr && <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '4px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{defStr}</div>}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    await toggleStarred(sw.word);
                                                    setStarredWordsList(prev => prev.filter(w => w.word !== sw.word));
                                                    if (stats && data?.word === sw.word) {
                                                        setStats(prev => ({ ...prev, starred: false }));
                                                    }
                                                }}
                                                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '0 4px', fontSize: '14px', lineHeight: 1 }}
                                                title="Remove from Bank"
                                            >
                                                ✕
                                            </button>
                                            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.3)', marginTop: '4px' }}>
                                                {sw.clickCount}x
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                        <button className="lex-action-btn" onClick={() => {
                                            window.open(`https://translate.google.com/?sl=zh-CN&tl=en&text=${encodeURIComponent(sw.word)}&op=translate`, '_blank');
                                        }} style={{ padding: '4px 8px', fontSize: '11px' }}>Translate</button>
                                        <button className="lex-action-btn" onClick={() => {
                                            window.location.href = `plecoapi://x-callback-url/s?q=${encodeURIComponent(sw.word)}`;
                                        }} style={{ padding: '4px 8px', fontSize: '11px' }}>Pleco</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="lexicon-entry">
                        <div className="lexicon-analyzing">
                            <span className="analyzing-label">ANALYZING:</span>
                            <span className="analyzing-word">{word}</span>
                            {traditional && traditional !== word && (
                                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)', marginLeft: '-8px' }}>({traditional})</span>
                            )}
                        </div>

                        <div className="lexicon-scroll-area">
                            {data.entries?.map((entry, idx) => {
                                const pinyin = entry.pinyin || '';

                                // Extract Measure Words (CL) and clean definitions
                                const measureWords = [];
                                const cleanDefinitions = [];
                                (entry.definitions || []).forEach(def => {
                                    if (def.startsWith('CL:')) {
                                        measureWords.push(def.replace('CL:', ''));
                                    } else {
                                        cleanDefinitions.push(def);
                                    }
                                });

                                return (
                                    <div key={idx} style={{ marginBottom: idx < data.entries.length - 1 ? '24px' : '32px', paddingBottom: idx < data.entries.length - 1 ? '24px' : '0', borderBottom: idx < data.entries.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                        <div className="lexicon-tags">
                                            {pinyin && (
                                                <div className="lex-tag pinyin">
                                                    <span style={{ opacity: 0.5, fontSize: 9, marginRight: 4 }}>PY</span>
                                                    {renderPinyin(pinyin)}
                                                </div>
                                            )}
                                            {idx === 0 && hskLevel && (
                                                <div className="lex-tag hsk">HSK {hskLevel}</div>
                                            )}
                                            {idx === 0 && freqRank && (
                                                <div className="lex-tag freq">🏆 #{freqRank}</div>
                                            )}
                                        </div>

                                        <div className="lexicon-definitions">
                                            {cleanDefinitions.map((def, i) => (
                                                <div key={i} className="definition-item">
                                                    <span className="def-bullet">▪</span>
                                                    <span className="def-text">{def}</span>
                                                </div>
                                            ))}
                                            {measureWords.length > 0 && (
                                                <div className="measure-words">
                                                    <span className="mw-label">Measure words:</span> {measureWords.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {breakdown && breakdown.length > 1 && (
                                <div className="lexicon-breakdown" style={{ marginBottom: 24, padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.3)', letterSpacing: '1px', marginBottom: '12px' }}>CHARACTER BREAKDOWN</div>
                                    {breakdown.map((item, i) => (
                                        <div key={i} className="breakdown-item" style={{ display: 'flex', gap: '12px', marginBottom: i < breakdown.length - 1 ? '16px' : 0 }}>
                                            <div style={{ fontSize: '24px', fontFamily: 'var(--font-chinese)', color: 'var(--text-primary)', lineHeight: 1 }}>
                                                {item.char}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                                                    <span style={{ color: 'var(--accent-blue)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>{renderPinyin(item.pinyin)}</span>
                                                    {item.radical && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Radical: {item.radical}</span>}
                                                </div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.4 }}>
                                                    {item.definition}
                                                </div>
                                                {item.mnemonic && (
                                                    <div className="breakdown-mnemonic" style={{ marginTop: 6, fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.6)', fontStyle: 'italic', borderLeft: '2px solid rgba(255, 255, 255, 0.1)', paddingLeft: '8px' }}>
                                                        {item.mnemonic}
                                                    </div>
                                                )}
                                                {item.etymology && (
                                                    <div className="breakdown-etym" style={{ marginTop: 6 }}>
                                                        <span style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Origin:</span> {item.etymology}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {wordFamilies.length > 0 && (
                                <div className="lexicon-families" style={{ marginBottom: 24, fontSize: '13px' }}>
                                    <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.3)', letterSpacing: '1px', marginBottom: '8px' }}>WORD FAMILY</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {wordFamilies.map((fam, i) => (
                                            <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <span style={{ color: 'var(--text-primary)', marginRight: '6px' }}>{fam.word}</span>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{convertPinyin(fam.pinyin.toLowerCase())}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {synonymsList && synonymsList.length > 0 && (
                                <div className="lexicon-families" style={{ marginBottom: 24, fontSize: '13px' }}>
                                    <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.3)', letterSpacing: '1px', marginBottom: '8px' }}>SYNONYMS (TEST DATA)</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {synonymsList.map((syn, i) => (
                                            <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>
                                                {syn}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Bar */}
                            <div className="lexicon-actions">
                                <button className="lex-action-btn" onClick={() => {
                                    const utterance = new SpeechSynthesisUtterance(word);
                                    utterance.lang = 'zh-CN';
                                    window.speechSynthesis.speak(utterance);
                                }} title="Listen">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                    </svg>
                                </button>
                                <button className="lex-action-btn" onClick={() => {
                                    window.location.href = `plecoapi://x-callback-url/s?q=${encodeURIComponent(word)}`;
                                }} title="Open in Pleco">
                                    <span style={{ fontWeight: 'bold', fontSize: '12px' }}>Pleco</span>
                                </button>
                                <button className="lex-action-btn" onClick={() => {
                                    window.open(`https://translate.google.com/?sl=zh-CN&tl=en&text=${encodeURIComponent(word)}&op=translate`, '_blank');
                                }} title="Google Translate">
                                    <span style={{ fontWeight: 'bold', fontSize: '12px' }}>GTranslate</span>
                                </button>
                                <button className="lex-action-btn" onClick={handleCopy} title="Copy">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </button>
                                <button className={`lex-action-btn ${starred ? 'starred' : ''}`} onClick={handleToggleStar} title="Star">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                    </svg>
                                </button>
                            </div>

                            {examples.length > 0 && (
                                <div className="lexicon-scholar-note">
                                    <div className="scholar-label">SCHOLAR'S NOTES</div>
                                    {examples.slice(0, 3).map((ex, i) => {
                                        const parts = ex.zh.split(word);
                                        return (
                                            <div key={i} className="scholar-content mb-3">
                                                <div className="scholar-zh">
                                                    {parts.map((part, pIdx) => (
                                                        <React.Fragment key={pIdx}>
                                                            {part}
                                                            {pIdx < parts.length - 1 && <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 'bold' }}>{word}</span>}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                                <div className="scholar-en">"{ex.en}"</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}


                            {/* Tone Sandhi warnings could go here too */}
                            {toneSandhiRule && (
                                <div className="lexicon-sandhi" style={{ marginBottom: 16 }}>
                                    <span className="sandhi-label">TONE MUTATION DETECTED</span>
                                    <div className="sandhi-rule-text">⚠️ {toneSandhiRule}</div>
                                </div>
                            )}

                            {stats?.firstSeen && (
                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', marginTop: 32, paddingBottom: 16 }}>
                                    First encountered on {new Date(stats.firstSeen).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LexiconSidebar;
