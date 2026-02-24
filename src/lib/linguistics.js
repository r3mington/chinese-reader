let radicalsData = null;
let mnemonicsData = null;
let synonymsData = null;

let isLoading = false;

export const loadLinguisticDatasets = async () => {
    if (radicalsData && mnemonicsData && synonymsData) return;
    if (isLoading) return;
    isLoading = true;

    try {
        const [radRes, mneRes, synRes] = await Promise.all([
            fetch('/data/radicals.json').catch(() => ({ ok: false })),
            fetch('/data/mnemonics.json').catch(() => ({ ok: false })),
            fetch('/data/synonyms.json').catch(() => ({ ok: false }))
        ]);

        if (radRes.ok) radicalsData = await radRes.json();
        if (mneRes.ok) mnemonicsData = await mneRes.json();
        if (synRes.ok) synonymsData = await synRes.json();

    } catch (e) {
        console.warn('Failed to load local linguistic datasets', e);
    } finally {
        isLoading = false;
    }
};

export const getRadical = (char) => radicalsData?.[char] || null;
export const getMnemonic = (char) => mnemonicsData?.[char] || null;
export const getSynonyms = (word) => synonymsData?.[word] || [];
