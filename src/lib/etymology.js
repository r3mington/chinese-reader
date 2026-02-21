import etymData from './etymology_data.json';

/**
 * Returns a short hint about a character's origin/components (if available).
 * @param {string} char - A single hanzi character
 * @returns {string|null} Etymology hint (e.g. "from water 氵 and phonetic 青") or null
 */
export const getEtymology = (char) => {
    if (!char || char.length !== 1) return null;

    const data = etymData[char];
    if (!data || !data.hint) return null;

    // Formatting the hint to be concise
    let text = data.hint;

    // Capitalize first letter
    text = text.charAt(0).toUpperCase() + text.slice(1);

    return text;
};
