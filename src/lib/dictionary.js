import { get, set } from 'idb-keyval';

const DICT_KEY = 'cedict_cache_v2';
const DICT_URL = 'https://raw.githubusercontent.com/krmanik/cedict-json/master/all_cedict.json';

// In-memory cache
let dictionary = null;
let trie = null; // We could use a Trie, but a Map with "max word length" logic is simpler for now.
// For Chinese segmentation, we usually need a Map of { word: entry }.
let dictionaryMap = null;
let maxWordLength = 0;

export const initDictionary = async (onProgress) => {
    if (dictionaryMap) return;

    // 1. Try to load from IDB
    try {
        const cached = await get(DICT_KEY);
        if (cached) {
            console.log('Loaded dictionary from cache');
            buildIndex(cached);
            return;
        }
    } catch (e) {
        console.warn('Failed to load from cache', e);
    }

    // 2. Fetch from URL
    console.log('Fetching dictionary...');
    if (onProgress) onProgress('Downloading dictionary...');

    const response = await fetch(DICT_URL);
    if (!response.ok) throw new Error('Failed to fetch dictionary');

    const json = await response.json();

    // 3. Save to IDB
    if (onProgress) onProgress('Saving dictionary...');
    try {
        await set(DICT_KEY, json);
    } catch (e) {
        console.warn('Failed to save to cache', e);
    }

    // 4. Build Index
    if (onProgress) onProgress('Building index...');
    buildIndex(json);
};

const buildIndex = (data) => {
    dictionaryMap = new Map();
    maxWordLength = 0;

    // Data format expected: Object where keys are traditional/simplified or simplified.
    // New format sample:
    // { "word": { "simplified": "...", "traditional": "...", "pinyin": [...], "definitions": {...} } }

    const entries = Array.isArray(data) ? data : Object.values(data);

    entries.forEach(entry => {
        const word = entry.simplified;
        if (!word) return;

        // Flatten the new format to match what our UI expects:
        // { simplified, traditional, pinyin, definitions: [ "def1", "def2" ] }

        let flattenedEntries = [];

        if (entry.definitions && typeof entry.definitions === 'object' && !Array.isArray(entry.definitions)) {
            // New format: definitions is a map { "pinyin": "def1; def2" }
            if (Array.isArray(entry.pinyin)) {
                entry.pinyin.forEach(py => {
                    const defBlock = entry.definitions[py];
                    const defs = defBlock ? defBlock.split(';').map(d => d.trim()).filter(Boolean) : [];
                    flattenedEntries.push({
                        simplified: entry.simplified,
                        traditional: entry.traditional,
                        pinyin: py,
                        definitions: defs
                    });
                });
            }
        } else {
            // Assume old format or strictly simplified/traditional/definitions array structure if any
            // If it's the old array format, entry is { simplified, traditional, pinyin, definitions }
            flattenedEntries.push(entry);
        }

        if (!dictionaryMap.has(word)) {
            dictionaryMap.set(word, []);
        }
        dictionaryMap.get(word).push(...flattenedEntries);

        if (word.length > maxWordLength) {
            maxWordLength = word.length;
        }
    });

    // Cap max length to avoid performance issues on weirdly long entries
    maxWordLength = Math.min(maxWordLength, 8);
    dictionary = data;
};

// Smart segmentation / text lookup
// Returns the longest matching word starting at `index` in `text`
export const lookupAt = (text, index) => {
    if (!dictionaryMap) return null;

    // Basic check: is the clicked character Chinese?
    if (!/[\u4E00-\u9FFF]/.test(text[index])) return null;

    // Try to find the longest match containing the index
    // We check matches of length `maxWordLength` down to 1
    for (let len = maxWordLength; len > 0; len--) {
        // To contain the character at `index`, a word of length `len` 
        // can start at `index - len + 1` up to `index`.
        const minStart = Math.max(0, index - len + 1);
        const maxStart = index;

        for (let start = minStart; start <= maxStart; start++) {
            if (start + len > text.length) continue;

            const substring = text.substring(start, start + len);
            if (dictionaryMap.has(substring)) {
                return {
                    word: substring,
                    entries: dictionaryMap.get(substring),
                    start: start,
                    end: start + len
                };
            }
        }
    }

    return null;
};
