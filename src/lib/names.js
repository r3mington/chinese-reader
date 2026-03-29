import { get, set } from 'idb-keyval';

const PROPER_NAMES_KEY = 'proper_names_db';

/**
 * Loads the user's list of custom proper names.
 * @returns {Promise<string[]>} Array of proper name strings.
 */
export const getProperNames = async () => {
    try {
        const stored = await get(PROPER_NAMES_KEY);
        return stored || [];
    } catch (e) {
        console.error('Error loading proper names:', e);
        return [];
    }
};

/**
 * Toggles a word in the user's proper names list.
 * @param {string} word - The word to toggle.
 * @returns {Promise<boolean>} True if it is now a proper name, false otherwise.
 */
export const toggleProperName = async (word) => {
    try {
        const names = await getProperNames();
        const nameSet = new Set(names);
        let isName = false;
        
        if (nameSet.has(word)) {
            nameSet.delete(word);
        } else {
            nameSet.add(word);
            isName = true;
        }

        await set(PROPER_NAMES_KEY, Array.from(nameSet));
        
        // Dispatch an event so Reader.jsx and other components can update instantly
        window.dispatchEvent(new CustomEvent('properNamesChanged', { detail: { word, isName } }));
        
        return isName;
    } catch (e) {
        console.error('Error toggling proper name:', e);
        return false;
    }
};

export const addProperName = async (word) => {
    const names = await getProperNames();
    const nameSet = new Set(names);
    if (!nameSet.has(word)) {
        nameSet.add(word);
        await set(PROPER_NAMES_KEY, Array.from(nameSet));
        window.dispatchEvent(new CustomEvent('properNamesChanged', { detail: { word, isName: true } }));
    }
};

export const removeProperName = async (word) => {
    const names = await getProperNames();
    const nameSet = new Set(names);
    if (nameSet.has(word)) {
        nameSet.delete(word);
        await set(PROPER_NAMES_KEY, Array.from(nameSet));
        window.dispatchEvent(new CustomEvent('properNamesChanged', { detail: { word, isName: false } }));
    }
};

/**
 * Checks if a word is currently marked as a proper name.
 * @param {string} word 
 * @returns {Promise<boolean>}
 */
export const isProperNameLocked = async (word) => {
    const names = await getProperNames();
    return names.includes(word);
};
