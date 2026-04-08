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
                // First pass: collect all defs per pinyin
                const rawByPinyin = {};
                entry.pinyin.forEach(py => {
                    const defBlock = entry.definitions[py];
                    rawByPinyin[py] = defBlock ? defBlock.split(';').map(d => d.trim()).filter(Boolean) : [];
                });

                // Second pass: deduplicate — for each pinyin, remove defs that appear in another pinyin
                // that has MORE unique defs (the "broader" entry). This keeps 露 lu4 as just the
                // dew/nectar meanings and lets 露 lou4 own the "to reveal" meanings cleanly.
                entry.pinyin.forEach(py => {
                    let defs = rawByPinyin[py];
                    const otherPinyins = entry.pinyin.filter(p => p !== py);
                    const otherDefs = new Set(otherPinyins.flatMap(p => rawByPinyin[p]));
                    // Only strip a def if EVERY other block that contains it has MORE total defs.
                    // Simple heuristic: strip defs shared with lou4/variant entries if this entry has extra unique ones.
                    const uniqueHere = defs.filter(d => !otherDefs.has(d));
                    if (uniqueHere.length > 0) {
                        // This entry has its own distinct content — remove the shared defs (they'll show under other pinyin)
                        defs = uniqueHere;
                    }
                    // If ALL defs are shared (e.g. surname Lu where nothing else shares its defs), keep as-is
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

// Strictly look for a word starting AT the given index (for sequential text tokenization)
export const lookupStartingAt = (text, index) => {
    if (!dictionaryMap) return null;

    if (!/[\u4E00-\u9FFF]/.test(text[index])) return null;

    for (let len = maxWordLength; len > 0; len--) {
        if (index + len > text.length) continue;

        const substring = text.substring(index, index + len);
        if (dictionaryMap.has(substring)) {
            return {
                word: substring,
                entries: sortDictionaryEntries(dictionaryMap.get(substring)),
                start: index,
                end: index + len
            };
        }
    }

    return null;
};

// Smart segmentation / text lookup
// Returns the longest matching word containing the `index` in `text`
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
                    entries: sortDictionaryEntries(dictionaryMap.get(substring)),
                    start: start,
                    end: start + len
                };
            }
        }
    }

    return null;
}

export const getWordFamilies = (char, limit = 5) => {
    if (!dictionaryMap || !char) return [];

    const families = [];
    for (const [key, entries] of dictionaryMap.entries()) {
        // Find words longer than 1 character that contain the given character
        if (key.length > 1 && key.includes(char)) {
            families.push({
                word: key,
                pinyin: entries[0]?.pinyin || '',
                definition: entries[0]?.definitions?.[0] || ''
            });
            if (families.length >= limit) break;
        }
    }
    return families;
};

// --- Heuristic Sorting Engine ---
const sortDictionaryEntries = (entries) => {
    if (!entries || entries.length <= 1) return entries;
    
    return [...entries].sort((a, b) => {
        return calculateEntryScore(a) - calculateEntryScore(b);
    });
};

const calculateEntryScore = (entry) => {
    let score = 0;
    const joinedDefs = (entry.definitions || []).join(' ').toLowerCase();
    
    // Heavy penalties for definitions that are almost certainly useless as primary meanings
    const heavyKeywords = ['surname', 'dynasty', 'archaic', 'old state'];
    for (const kw of heavyKeywords) {
        if (joinedDefs.includes(kw)) {
            score += 10000;
        }
    }

    // Mild penalties for secondary historical/linguistic notes (like variants)
    const mildKeywords = ['ancient', 'variant of', 'abbr. for'];
    for (const kw of mildKeywords) {
        if (joinedDefs.includes(kw)) {
            score += 500;
        }
    }
    
    // Brevity & Cross-References
    // - Only measure the length of the FIRST definition so highly common multi-meaning words don't accumulate massive penalties
    // - Sink CEDICT cross-references (e.g. "see [lao4]")
    // - Penalize Proper Nouns (which are Capitalized in CEDICT) to push common lower-case verbs/nouns up.
    if (entry.definitions && entry.definitions.length > 0) {
        const originalFirstDef = entry.definitions[0];
        const firstDef = originalFirstDef.toLowerCase();
        
        const firstChar = originalFirstDef.charAt(0);
        if (firstChar >= 'A' && firstChar <= 'Z') {
            score += 2000;
        }

        if (firstDef.startsWith('see ') && firstDef.includes('[')) {
            score += 500;
        }
        
        score += firstDef.length;
        
        // Boost for grammatical/functional words — CEDICT marks these with parenthetical
        // labels like "(negative prefix for verbs)", "(particle)", "(suffix)", etc.
        // These are almost always the primary meaning in context.
        const grammaticalMarkers = ['(negative', '(particle', '(prefix for', '(suffix', '(measure word', '(modal', '(conjunction', '(preposition', '(pronoun'];
        for (const gm of grammaticalMarkers) {
            if (firstDef.includes(gm)) {
                score -= 3000; // Very strong priority boost
                break;
            }
        }

        // Bonus for having more definitions (highly common usages have many nuances in CEDICT)
        // Subtract 15 points for every definition to give an edge to comprehensive entries over obscure single-meaning ones.
        score -= (entry.definitions.length * 15);
    }

    return score;
};;
