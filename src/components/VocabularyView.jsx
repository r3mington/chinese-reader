import React, { useState, useEffect } from 'react';
import { getVocabularyList, toggleStarred } from '../lib/vocabulary';
import { convertPinyin } from '../lib/pinyin';
import { lookupAt } from '../lib/dictionary';
import { Link } from 'react-router-dom';
import '../styles/oled.css';

const VocabularyView = () => {
    const [vocabList, setVocabList] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchVocab = async () => {
        const list = await getVocabularyList();

        // Enrich list with pinyin/definitions
        const enriched = list.map(item => {
            const details = lookupAt(item.word, 0);
            return {
                ...item,
                details: details ? details.entries[0] : null
            };
        });

        setVocabList(enriched);
        setLoading(false);
    };

    useEffect(() => {
        fetchVocab();
    }, []);

    const handleToggleStar = async (word) => {
        await toggleStarred(word);
        // Refresh the list to reflect new sort order
        await fetchVocab();
    };

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
                        <div key={idx} className="vocab-card">
                            <div className="vocab-card-header">
                                <button
                                    className={`star-button ${item.starred ? 'starred' : ''}`}
                                    onClick={() => handleToggleStar(item.word)}
                                    aria-label={item.starred ? 'Unstar word' : 'Star word'}
                                >
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill={item.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                                        <polygon points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8" />
                                    </svg>
                                </button>
                                <div className="vocab-word-header">
                                    <span className="vocab-word">{item.word}</span>
                                    {item.details && (
                                        <span className="vocab-pinyin">{convertPinyin(item.details.pinyin)}</span>
                                    )}
                                </div>
                                <span className="vocab-count-badge">{item.clickCount}</span>
                            </div>
                            <div className="vocab-card-body">
                                {item.details ? (
                                    <ol className="vocab-definitions">
                                        {item.details.definitions.map((def, i) => (
                                            <li key={i}>{def}</li>
                                        ))}
                                    </ol>
                                ) : (
                                    <span className="vocab-def text-muted">Definition not found</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VocabularyView;
