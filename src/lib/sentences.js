import { get, set } from 'idb-keyval';

const SENTENCES_CACHE_KEY = 'sentences_db_v1';
const SENTENCES_URL = '/sentences.json';

let sentencesMap = null;
let isFetching = false;
let fetchPromise = null;

export const loadSentencesDb = async () => {
    if (sentencesMap) return;

    if (isFetching) {
        await fetchPromise;
        return;
    }

    isFetching = true;
    fetchPromise = (async () => {
        try {
            // Check cache
            const cached = await get(SENTENCES_CACHE_KEY);
            if (cached) {
                console.log('Loaded example sentences from cache');
                sentencesMap = cached;
                return;
            }

            // Fetch from network
            console.log('Fetching example sentences...');
            const res = await fetch(SENTENCES_URL);
            if (!res.ok) throw new Error('Failed to fetch sentences DB');

            const data = await res.json();
            sentencesMap = data;

            // Save to cache
            await set(SENTENCES_CACHE_KEY, data);
            console.log('Saved example sentences to cache');

        } catch (e) {
            console.warn('Error loading sentences:', e);
            sentencesMap = {}; // Fallback so we don't constantly retry and fail
        } finally {
            isFetching = false;
        }
    })();

    await fetchPromise;
};

// Returns an array of example sentence objects: [ { zh: "...", en: "..." } ]
export const getExampleSentences = (word) => {
    if (!sentencesMap || !word) return null;
    return sentencesMap[word] || null;
};
