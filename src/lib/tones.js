import { lookupAt } from './dictionary';

// Extract tone number from pinyin string (e.g., "ni3" -> 3, "hao3" -> 3)
const extractTone = (pinyin) => {
    if (!pinyin) return null;

    // Remove spaces and get the last character's tone
    const match = pinyin.match(/\d$/);
    if (match) {
        const tone = parseInt(match[0], 10);
        return tone >= 1 && tone <= 4 ? tone : null;
    }
    return null;
};

// Get tone number for a single character
export const getCharacterTone = (char) => {
    // Check if it's a Chinese character
    if (!/[\u4E00-\u9FFF]/.test(char)) {
        return null;
    }

    // Look up in dictionary
    const result = lookupAt(char, 0);

    if (result && result.entries && result.entries.length > 0) {
        // Use the first entry's pinyin
        const pinyin = result.entries[0].pinyin;
        return extractTone(pinyin);
    }

    return null;
};
