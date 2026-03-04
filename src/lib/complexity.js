import { tokenizeText } from './tokenizer';
import { getFrequencyRank } from './frequency';

// Simple memory cache to avoid re-tokenizing the same paragraphs on every render
const complexityCache = new Map();

/**
 * Calculates a complexity score (0-100) for a given paragraph based on word frequency.
 * @param {string} text - The raw Chinese text
 * @returns {number|null} 0 is easiest (most common words), 100 is hardest. Null if no words.
 */
export const getParagraphComplexity = (text) => {
    if (!text) return null;
    if (complexityCache.has(text)) return complexityCache.get(text);

    const tokens = tokenizeText(text);
    let totalRank = 0;
    let wordCount = 0;

    tokens.forEach(token => {
        // Only measure actual dictionary words to avoid punctuation skewing the rank
        if (token.type === 'dict' && token.word.length > 0) {
            let rank = getFrequencyRank(token.word);

            // If the word isn't in the top 10k list, penalize it heavily.
            // We assume a cap rank of 10000 to push the average up for obscure words.
            if (rank === null) {
                rank = 10000;
            }

            totalRank += rank;
            wordCount++;
        }
    });

    if (wordCount === 0) {
        complexityCache.set(text, null);
        return null;
    }

    const avgRank = totalRank / wordCount;

    // Map the average rank to a 0-100 score. 
    // Rank 1 = Score 0. Rank 10000 = Score 100.
    const score = Math.min(100, Math.max(0, (avgRank / 10000) * 100));

    complexityCache.set(text, score);
    return score;
};

/**
 * Converts a 0-100 complexity score into an HSL color string.
 * @param {number} score - 0 (easiest) to 100 (hardest)
 * @returns {string} HSL color ranging from bright green (easy) to deep red (hard)
 */
export const getComplexityColor = (score) => {
    if (score === null || isNaN(score)) return 'transparent';

    // Hue: 120 is green, 0 is red.
    // Score 0 -> Hue 120
    // Score 100 -> Hue 0
    const hue = Math.max(0, 120 - (score * 1.2));

    return `hsl(${hue}, 80%, 40%)`;
};
