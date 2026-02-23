import React from 'react';
import '../styles/oled.css';

const LexiconSidebar = ({ history = [] }) => {
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
                    return (
                        <div key={data.word + index} className={`lexicon-entry ${!isLatest ? 'historical' : ''}`}>
                            <div className="lexicon-analyzing">
                                <span className="analyzing-label">ANALYZING:</span>
                                <span className="analyzing-word">{data.word}</span>
                            </div>

                            <div className="lexicon-phonetics">
                                <span className="lexicon-badge pinyin-badge">PY</span>
                                <span className="lexicon-pinyin">{renderPinyin(data.pinyin)}</span>
                                {data.hsk && (
                                    <span className="lexicon-badge hsk-badge ml-auto">HSK {data.hsk}</span>
                                )}
                                {data.freqRank && (
                                    <span className="lexicon-badge freq-badge">🏆 #{data.freqRank}</span>
                                )}
                            </div>

                            <div className="lexicon-definitions">
                                {data.definitions && data.definitions.length > 0 ? (
                                    <ul className="lexicon-def-list">
                                        {data.definitions.map((def, i) => (
                                            <li key={i}>{def}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="no-def">No definition found.</p>
                                )}
                            </div>

                            {data.example && (
                                <div className="lexicon-scholar-note">
                                    <div className="scholar-label">SCHOLAR'S NOTE</div>
                                    <div className="scholar-content">
                                        <div className="scholar-zh">{data.example.zh}</div>
                                        <div className="scholar-en">"{data.example.en}"</div>
                                    </div>
                                </div>
                            )}

                            {/* Tone Sandhi warnings could go here too */}
                            {data.sandhiRules && data.sandhiRules.length > 0 && (
                                <div className="lexicon-sandhi">
                                    <span className="sandhi-label">TONE MUTATION DETECTED</span>
                                    {data.sandhiRules.map((rule, idx) => (
                                        <div key={idx} className="sandhi-rule-text">⚠️ {rule}</div>
                                    ))}
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
