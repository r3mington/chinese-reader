export const convertPinyin = (pinyin) => {
    if (!pinyin) return '';
    return pinyin.split(' ').map(convertWord).join(' ');
};

const tones = {
    a: ['ā', 'á', 'ǎ', 'à', 'a'],
    e: ['ē', 'é', 'ě', 'è', 'e'],
    i: ['ī', 'í', 'ǐ', 'ì', 'i'],
    o: ['ō', 'ó', 'ǒ', 'ò', 'o'],
    u: ['ū', 'ú', 'ǔ', 'ù', 'u'],
    v: ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
    ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
};

const convertWord = (word) => {
    // Extract tone number
    const match = word.match(/(\d)$/);
    if (!match) return word; // No number found

    const tone = parseInt(match[1], 10);
    let base = word.slice(0, -1);

    // Tone 5 is neutral, no mark, but we might want to just strip the 5
    // However, the map above has 'a' as 5th index, so index 0 = tone 1, etc.
    // Index = tone - 1. If tone is 5 (neutral), index 4.

    const idx = tone % 5 === 0 ? 4 : tone - 1;

    // Find the vowel to place the mark on
    // Priority: a, o, e 
    // If not found, look for i, u, v, ü.
    // Exception: iu -> place on u, ui -> place on i. (Trailing vowel)

    // Simple logic:
    // 1. Check for 'a', 'o', 'e'. If found, that's the one.
    // 2. If 'iu', mark 'u'.
    // 3. If 'ui', mark 'i'.
    // 4. Otherwise mark 'i', 'u', 'v', 'ü'.

    let chartToReplace = '';
    let replaceIdx = -1;

    if (base.includes('a')) {
        chartToReplace = 'a';
        replaceIdx = base.indexOf('a');
    } else if (base.includes('o')) {
        chartToReplace = 'o';
        replaceIdx = base.indexOf('o');
    } else if (base.includes('e')) {
        chartToReplace = 'e';
        replaceIdx = base.indexOf('e');
    } else if (base.includes('iu')) {
        chartToReplace = 'u';
        replaceIdx = base.indexOf('u', base.indexOf('iu')); // correct index in 'iu'
    } else if (base.includes('ui')) {
        chartToReplace = 'i';
        replaceIdx = base.indexOf('i', base.indexOf('ui'));
    } else {
        // Find first i, u, v, or ü
        for (let i = 0; i < base.length; i++) {
            if (['i', 'u', 'v', 'ü'].includes(base[i])) {
                chartToReplace = base[i];
                replaceIdx = i;
                break;
            }
        }
    }

    if (replaceIdx >= 0 && chartToReplace) {
        const replacement = tones[chartToReplace.toLowerCase()]?.[idx] || chartToReplace;
        // Handle case case sensitivity? Usually pinyin is lowercase but let's be safe
        // Assuming lowercase for now as standard dictionary key is lowercase
        return base.substring(0, replaceIdx) + replacement + base.substring(replaceIdx + 1);
    }

    return base;
};
