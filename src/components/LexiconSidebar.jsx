import React, { useEffect } from 'react';
import { getHskLevel } from '../lib/hsk';
import { checkToneSandhi } from '../lib/tones';
import { getFrequencyRank } from '../lib/frequency';
import { loadSentencesDb, getExampleSentences } from '../lib/sentences';
import '../styles/oled.css';

const LexiconSidebar = ({ history = [] }) => {
    // Ensure sentences DB is loaded
    useEffect(() => {
        loadSentencesDb();
    }, []);

    // history is an array of word data objects, ordered [newest, older, oldest]

    // Convert numbered pinyin to marks if needed, but our database usually has marks
    // Or just display it as is.
    const renderPinyin = (pinyin) => {
        return pinyin ? pinyin.toLowerCase() : '';
    };

    if (history.length === 0) {
        return (
            <div className="lexicon-sidebar empty">
                <div className="lexicon-header">
                    <span className="lexicon-title">LEXICON_ENGINE_v2.1</span>
                    <span className="lexicon-icon">✧</span>
                </div>
                <div className="lexicon-idle">
                    [ SYSTEM IDLE ]<br /><br />
                    Awaiting input...<br />
                    Click any highlighted word in the text to begin analysis.
                </div>
            </div>
        );
    }

    return (
        <div className="lexicon-sidebar">
            <div className="lexicon-header">
                <span className="lexicon-title">LEXICON_ENGINE_v2.1</span>
                <span className="lexicon-icon">✧</span>
            </div>

            <div className="lexicon-scroll-area">
                {history.map((data, index) => {
                    const isLatest = index === 0;
                    const word = data.word;
                    const mainEntry = data.entries?.[0] || {};
                    const pinyin = mainEntry.pinyin || '';
                    const definitions = mainEntry.definitions || [];

                    const hskLevel = getHskLevel(word);
                    const freqRank = getFrequencyRank(word);

                    const pinyinArr = pinyin.split(/\s+/).filter(Boolean);
                    const toneSandhiRule = checkToneSandhi(word, pinyinArr);

                    const examples = getExampleSentences(word);
                    const example = examples && examples.length > 0 ? examples[0] : null;

                    return (
                        <div key={word + index} className={`lexicon-entry ${!isLatest ? 'historical' : ''}`}>
                            <div className="lexicon-analyzing">
                                <span className="analyzing-label">ANALYZING:</span>
                                <span className="analyzing-word">{word}</span>
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
                            </div>

                            <div className="lexicon-definitions">
                                {definitions && definitions.length > 0 ? (
                                    <ul className="lexicon-def-list">
                                        {definitions.map((def, i) => (
                                            <li key={i}>{def}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="no-def">No definition found.</p>
                                )}
                            </div>

                            {example && (
                                <div className="lexicon-scholar-note">
                                    <div className="scholar-label">SCHOLAR'S NOTE</div>
                                    <div className="scholar-content">
                                        <div className="scholar-zh">{example.zh}</div>
                                        <div className="scholar-en">"{example.en}"</div>
                                    </div>
                                </div>
                            )}

                            {/* Tone Sandhi warnings could go here too */}
                            {toneSandhiRule && (
                                <div className="lexicon-sandhi">
                                    <span className="sandhi-label">TONE MUTATION DETECTED</span>
                                    <div className="sandhi-rule-text">⚠️ {toneSandhiRule}</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LexiconSidebar;
