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
    const [sessionData, setSessionData] = useState({ chars: 0, cpm: '--' });
    const starred = stats?.starred || false;

    // Ensure sentences DB is loaded
    useEffect(() => {
        loadSentencesDb();
        loadLinguisticDatasets();
    }, []);

    useEffect(() => {
        if (data && data.word) {
            getWordStats(data.word).then(s => {
                setStats(s || { starred: false, clickCount: 0 });
            });
        }
    }, [data]);

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

    if (!data || !data.word) {
        return (
            <div className="lexicon-sidebar empty">
                <div className="lexicon-header">
                    <span className="lexicon-title">LEXICON_ENGINE_v2.1</span>
                    <span className="lexicon-icon">✧</span>
                </div>
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

                    <div style={{ marginTop: 40, opacity: 0.4 }}>
                        Awaiting input...<br />
                        Click any highlighted word in the text to begin analysis.
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
            {word && (
                <div className="lexicon-bg-character">
                    {word.length > 2 ? word.substring(0, 2) : word}
                </div>
            )}
            <div className="lexicon-header">
                <span className="lexicon-title">LEXICON_ENGINE_v2.1</span>
                <span className="lexicon-icon">✧</span>
            </div>

            <div className="lexicon-scroll-area">
                <div className="lexicon-entry">
                    <div className="lexicon-analyzing">
                        <span className="analyzing-label">ANALYZING:</span>
                        <span className="analyzing-word">{word}</span>
                        {traditional && traditional !== word && (
                            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)', marginLeft: '-8px' }}>({traditional})</span>
                        )}
                    </div>

                    <div className="lexicon-phonetics">
                        <span className="lexicon-badge pinyin-badge">PY</span>
                        <span className="lexicon-pinyin">{renderPinyin(pinyin)}</span>
                        {hskLevel && (
                            <span className="lexicon-badge hsk-badge ml-auto">HSK {hskLevel}</span>
                        )}
                        {freqRank && (
                            <span className="lexicon-badge freq-badge">🏆 #{freqRank}</span>
                        )}
                        {measureWords.length > 0 && (
                            <span className="lexicon-badge mw-badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' }}>CL: {measureWords.join(', ')}</span>
                        )}
                    </div>

                    <div className="lexicon-definitions" style={{ marginBottom: 24 }}>
                        {cleanDefinitions && cleanDefinitions.length > 0 ? (
                            <ul className="lexicon-def-list">
                                {cleanDefinitions.map((def, i) => (
                                    <li key={i}>{def}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="no-def">No definition found.</p>
                        )}
                    </div>

                    {breakdown && breakdown.length > 0 && (
                        <div className="lexicon-breakdown mt-4" style={{ marginBottom: 24 }}>
                            <div className="breakdown-label">COMPONENT BREAKDOWN</div>
                            {breakdown.map((item, idx) => (
                                <div key={idx} className="breakdown-item">
                                    <div className="breakdown-char">{item.char}</div>
                                    <div className="breakdown-details">
                                        <div className="breakdown-pinyin">{renderPinyin(item.pinyin)}</div>
                                        <div className="breakdown-def">{item.definition}</div>
                                        {item.radical && (
                                            <div className="breakdown-etym" style={{ marginTop: 6 }}>
                                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Radical:</span> {item.radical}
                                            </div>
                                        )}
                                        {item.mnemonic && (
                                            <div className="breakdown-etym" style={{ marginTop: 6 }}>
                                                <span style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Mnemonic:</span> {item.mnemonic}
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
        </div>
    );
};

export default LexiconSidebar;
