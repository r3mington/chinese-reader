import { get, set } from 'idb-keyval';

const RECAP_CACHE_KEY = 'recap_translations_v1';
const RECAP_GAP_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Returns true if enough time has passed since lastRead to show the recap card.
 */
export const shouldShowRecap = (lastRead) => {
    if (!lastRead) return false;
    return (Date.now() - lastRead) > RECAP_GAP_MS;
};

/**
 * Extracts up to maxParagraphs complete paragraphs ending just before bookmarkCharIndex.
 * Splits on newline sequences and takes the last N non-empty chunks.
 */
export const getPreviousContext = (content, bookmarkCharIndex, maxParagraphs = 3) => {
    if (!content || bookmarkCharIndex <= 0) return [];

    // Slice to just before the bookmark
    const before = content.slice(0, bookmarkCharIndex);

    // Split into paragraphs on one or more newlines
    const paragraphs = before
        .split(/\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 10); // skip very short/empty lines

    // Return the last N paragraphs
    return paragraphs.slice(-maxParagraphs);
};

/**
 * Looks up a cached recap translation from IDB.
 * Key: storyId + bookmarkCharIndex
 */
export const getCachedRecapTranslation = async (storyId, bookmarkCharIndex) => {
    try {
        const cache = (await get(RECAP_CACHE_KEY)) || {};
        return cache[`${storyId}_${bookmarkCharIndex}`] || null;
    } catch {
        return null;
    }
};

/**
 * Saves a recap translation to IDB.
 */
export const saveRecapTranslation = async (storyId, bookmarkCharIndex, translation) => {
    try {
        const cache = (await get(RECAP_CACHE_KEY)) || {};
        cache[`${storyId}_${bookmarkCharIndex}`] = translation;
        await set(RECAP_CACHE_KEY, cache);
    } catch (e) {
        console.warn('Failed to cache recap translation', e);
    }
};
