import { get, set } from 'idb-keyval';

const FREQUENCY_CACHE_KEY = 'cached_frequency_db';
let memoryCache = null;

/**
 * Loads the frequency mapping from the public JSON file.
 * Caches the result in IndexedDB to avoid repeated network requests.
 */
export const loadFrequencyDb = async () => {
    if (memoryCache) return memoryCache;

    try {
        // 1. Try to load from IndexedDB
        const cached = await get(FREQUENCY_CACHE_KEY);
        if (cached) {
            memoryCache = cached;
            return memoryCache;
        }

        // 2. If not in DB, fetch from public folder
        const response = await fetch('/frequency.json');
        if (!response.ok) {
            throw new Error('Failed to fetch frequency db');
        }

        const data = await response.json();

        // 3. Save to IndexedDB for future offline use
        await set(FREQUENCY_CACHE_KEY, data);
        memoryCache = data;

        return memoryCache;
    } catch (e) {
        console.error('Error loading frequency DB:', e);
        return null; // Fallback to no frequency data if offline without cache
    }
};

/**
 * Retrieves the frequency rank (1-10000) for a given Chinese word.
 * Returns null if the word is not in the top 10k list.
 * 
 * @param {string} word - The simplified Chinese word (e.g. "我")
 * @returns {number|null} The frequency rank, or null.
 */
export const getFrequencyRank = (word) => {
    if (!memoryCache) return null;
    return memoryCache[word] || null;
};
