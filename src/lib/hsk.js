import hskData from './hsk_words.json';

/**
 * Returns the HSK level (1-6) for a given simplified Chinese word.
 * Returns null if the word is not in the HSK curriculum.
 * 
 * @param {string} word - The simplified Chinese word to look up
 * @returns {number|null} The HSK level or null
 */
export const getHskLevel = (word) => {
    if (!word) return null;
    return hskData[word] || null;
};
