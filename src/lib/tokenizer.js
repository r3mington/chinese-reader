import { lookupStartingAt } from './dictionary';
import { getCharacterTone, getTonesFromPinyin } from './tones';
import { convertPinyin } from './pinyin';

/**
 * Parses a string of Chinese text into an array of tokens (either dictionary words or single characters).
 * @param {string} text - The raw paragraph string
 * @returns {Array} An array of token objects containing metadata about each chunk.
 */
export const tokenizeText = (text) => {
    if (!text) return [];

    const tokens = [];
    let i = 0;

    while (i < text.length) {
        // Try to find a dictionary word starting at current position
        const result = lookupStartingAt(text, i);

        if (result) {
            // Found a multi-character (or single-character) dictionary word
            const wordLength = result.word.length;
            const pinyin = result.entries[0].pinyin;
            const pinyinSyllables = pinyin.split(' ');
            const tones = getTonesFromPinyin(pinyin);

            // Create sub-tokens for each character in the word to preserve individual pinyin/tones
            const chars = [];
            for (let j = 0; j < wordLength; j++) {
                const char = text[i + j];
                const tone = tones[j];
                const charPinyinRaw = pinyinSyllables[j];
                const charPinyin = charPinyinRaw ? convertPinyin(charPinyinRaw.toLowerCase()) : '';
                chars.push({ char, tone, pinyin: charPinyin });
            }

            tokens.push({
                type: 'dict',
                word: result.word,
                length: wordLength,
                startIndex: i,
                endIndex: i + wordLength - 1,
                result: result,
                chars: chars
            });

            i += wordLength;
        } else {
            // No word found, fall back to single character (e.g., punctuation or unknown char)
            const char = text[i];
            const tone = getCharacterTone(char);

            tokens.push({
                type: 'char',
                word: char,
                length: 1,
                startIndex: i,
                endIndex: i,
                result: null,
                chars: [{ char, tone, pinyin: '' }]
            });

            i++;
        }
    }

    return tokens;
};
