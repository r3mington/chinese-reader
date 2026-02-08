import React, { useState, useEffect } from 'react';
import { getVocabularyList } from '../lib/vocabulary';
import { convertPinyin } from '../lib/pinyin';
import { lookupAt } from '../lib/dictionary';
import { Link } from 'react-router-dom';
import '../styles/oled.css';

const VocabularyView = () => {
    const [vocabList, setVocabList] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVocab = async () => {
            const list = await getVocabularyList();

            // Enrich list with pinyin/definitions if possible
            // Note: lookupAt expects text and index. Here we just have the word.
            // We can hack lookupAt or rely on the dictionary map if we exposed it. 
            // For now, let's just use lookupAt(word, 0) since `word` is the text.

            const enriched = list.map(item => {
                const details = lookupAt(item.word, 0);
                return {
                    ...item,
                    details: details ? details.entries[0] : null // Just take first entry for summary
                };
            });

            setVocabList(enriched);
            setLoading(false);
        };
        fetchVocab();
    }, []);

    return (
        <div className="vocab-container container">
            <div className="vocab-header">
                <h2>Vocabulary Stats</h2>
                <Link to="/" className="back-link">← Back to Reader</Link>
            </div>

            {loading ? (
                <div>Loading...</div>
            ) : vocabList.length === 0 ? (
                <div className="empty-state">No vocabulary clicked yet. Start reading!</div>
            ) : (
                <div className="vocab-list">
                    {vocabList.map((item, idx) => (
                        <div key={idx} className="vocab-item">
                            <div className="vocab-word-col">
                                <span className="vocab-word">{item.word}</span>
                                {item.details && (
                                    <span className="vocab-pinyin">{convertPinyin(item.details.pinyin)}</span>
                                )}
                            </div>
                            <div className="vocab-def-col">
                                {item.details ? (
                                    <span className="vocab-def">{item.details.definitions.slice(0, 2).join('; ')}...</span>
                                ) : (
                                    <span className="vocab-def text-muted">Def not found</span>
                                )}
                            </div>
                            <div className="vocab-count-col">
                                <span className="vocab-count-badge">{item.clickCount}</span>
                                <span className="vocab-count-label">clicks</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VocabularyView;
