import { get, set } from 'idb-keyval';

const VOCAB_KEY = 'vocabulary_stats';

let vocabStats = null;

const loadVocab = async () => {
    if (vocabStats) return vocabStats;
    try {
        vocabStats = await get(VOCAB_KEY) || {};
    } catch (e) {
        console.warn('Failed to load vocabulary stats', e);
        vocabStats = {};
    }
    return vocabStats;
};

export const trackWordClick = async (word, storyId) => {
    await loadVocab();

    if (!vocabStats[word]) {
        vocabStats[word] = {
            clickCount: 0,
            firstSeen: Date.now(),
            lastClicked: Date.now(),
            contexts: []
        };
    }

    vocabStats[word].clickCount++;
    vocabStats[word].lastClicked = Date.now();

    // Store simple context
    vocabStats[word].contexts.push({
        storyId,
        timestamp: Date.now()
    });

    try {
        await set(VOCAB_KEY, vocabStats);
    } catch (e) {
        console.warn('Failed to save vocabulary stats', e);
    }
};

export const getVocabularyList = async () => {
    await loadVocab();

    // Convert object to array and sort by click count descending
    return Object.entries(vocabStats)
        .map(([word, stats]) => ({
            word,
            ...stats
        }))
        .sort((a, b) => b.clickCount - a.clickCount);
};
