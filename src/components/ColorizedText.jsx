import React from 'react';
import { getCharacterTone, getTonesFromPinyin } from '../lib/tones';
import { lookupStartingAt } from '../lib/dictionary';
import { convertPinyin } from '../lib/pinyin';

const ColorizedText = ({ text, enabled = true, lookedUpWords = new Set(), overrideToneColors = null, activeIndex = null }) => {
    if ((!enabled && overrideToneColors !== false) || !text) {
        return <>{text}</>;
    }

    const colorizeText = (text) => {
        const elements = [];
        let i = 0;

        while (i < text.length) {
            // Try to find a word at current position
            const result = lookupStartingAt(text, i);

            if (result) {
                // We found a word! Use its tones.
                const wordLength = result.word.length;
                const pinyin = result.entries[0].pinyin;
                const pinyinSyllables = pinyin.split(' ');
                const tones = getTonesFromPinyin(pinyin);
                const isLookedUp = lookedUpWords.has(result.word);
                const lookedUpClass = isLookedUp ? ' word-looked-up' : '';
                const isHighlighted = activeIndex !== null && activeIndex >= i && activeIndex < i + wordLength;
                const highlightClass = isHighlighted ? ' word-active-highlight' : '';

                // Render each character of the word with its specific tone
                for (let j = 0; j < wordLength; j++) {
                    const char = text[i + j];
                    const tone = tones[j]; // Tone corresponding to this char position
                    let toneClass = '';

                    if (overrideToneColors === false) {
                        toneClass = '';
                    } else if (tone && tone >= 1 && tone <= 4) {
                        toneClass = ` tone-${tone}`;
                    } else if (tone === 5) {
                        toneClass = ` tone-neutral`;
                    }

                    const charPinyinRaw = pinyinSyllables[j];
                    const charPinyin = charPinyinRaw ? convertPinyin(charPinyinRaw.toLowerCase()) : '';

                    elements.push(
                        <span
                            key={`${i + j}`}
                            className={`char-with-tone${toneClass}${lookedUpClass}${highlightClass}`}
                            data-word={result.word}
                            data-index={i + j}
                            data-pinyin={isHighlighted ? charPinyin : undefined}
                        >
                            {char}
                        </span>
                    );
                }

                i += wordLength;
            } else {
                // No word found, render single char (try single char lookup fallback)
                const char = text[i];
                const tone = getCharacterTone(char);
                let toneClass = '';
                const isHighlighted = activeIndex !== null && activeIndex === i;
                const highlightClass = isHighlighted ? ' word-active-highlight' : '';

                if (overrideToneColors !== false && tone) {
                    toneClass = ` tone-${tone}`;
                }

                elements.push(
                    <span key={i} className={`char-with-tone${toneClass}${highlightClass}`} data-index={i}>
                        {char}
                    </span>
                );
                i++;
            }
        }
        return elements;
    };

    return <>{colorizeText(text)}</>;
};

export default ColorizedText;
