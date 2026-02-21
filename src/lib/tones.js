/**
 * Checks a word and its corresponding pinyin array for standard Mandarin tone sandhi rules.
 * 
 * @param {string} word - The simplified Chinese word (e.g. "你好", "一个")
 * @param {string[]} pinyinArray - The array of pinyin strings with numbers (e.g. ["ni3", "hao3"])
 * @returns {string|null} The name of the rule triggered, or null.
 */
export const checkToneSandhi = (word, pinyinArray) => {
    if (!word || !pinyinArray || word.length < 2 || pinyinArray.length < 2) return null;

    // RULE 1: Third-Tone Sandhi (3rd + 3rd -> 2nd + 3rd)
    for (let i = 0; i < pinyinArray.length - 1; i++) {
        const curr = pinyinArray[i];
        const next = pinyinArray[i + 1];
        if (curr.includes('3') && next.includes('3')) {
            return "3rd Tone Sandhi";
        }
    }

    // RULE 2: The rule of 一 (yī)
    // When "一" is followed by a 4th tone, it becomes 2nd tone.
    // When "一" is followed by a 1st, 2nd, or 3rd tone, it becomes 4th tone.
    for (let i = 0; i < word.length - 1; i++) {
        if (word[i] === '一') {
            const next = pinyinArray[i + 1];
            if (next.includes('4')) {
                return "Rule of 一 (yí)";
            } else if (next.includes('1') || next.includes('2') || next.includes('3')) {
                return "Rule of 一 (yì)";
            }
        }
    }

    // RULE 3: The rule of 不 (bù)
    // When "不" is followed by a 4th tone, it becomes 2nd tone.
    for (let i = 0; i < word.length - 1; i++) {
        if (word[i] === '不') {
            const next = pinyinArray[i + 1];
            if (next.includes('4')) {
                return "Rule of 不 (bú)";
            }
        }
    }

    return null;
};
