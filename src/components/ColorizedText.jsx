import React from 'react';
import { getCharacterTone, getTonesFromPinyin } from '../lib/tones';
import { lookupAt } from '../lib/dictionary';

const ColorizedText = ({ text, enabled = true }) => {
    if (!enabled || !text) {
        return <>{text}</>;
    }

    const colorizeText = (text) => {
        const elements = [];
        let i = 0;

        while (i < text.length) {
            // Try to find a word at current position
            const result = lookupAt(text, i);

            if (result) {
                // We found a word! Use its tones.
                const wordLength = result.word.length;
                const pinyin = result.entries[0].pinyin;
                const tones = getTonesFromPinyin(pinyin);

                // Render each character of the word with its specific tone
                for (let j = 0; j < wordLength; j++) {
                    const char = text[i + j];
                    const tone = tones[j]; // Tone corresponding to this char position

                    if (tone && tone >= 1 && tone <= 4) {
                        elements.push(
                            <span key={`${i + j}`} className={`char-with-tone tone-${tone}`}>
                                {char}
                            </span>
                        );
                    } else if (tone === 5) {
                        elements.push(
                            <span key={`${i + j}`} className={`char-with-tone tone-neutral`}>
                                {char}
                            </span>
                        );
                    } else {
                        elements.push(<span key={`${i + j}`}>{char}</span>);
                    }
                }

                i += wordLength;
            } else {
                // No word found, render single char (try single char lookup fallback)
                const char = text[i];
                const tone = getCharacterTone(char);

                if (tone) {
                    elements.push(
                        <span key={i} className={`char-with-tone tone-${tone}`}>
                            {char}
                        </span>
                    );
                } else {
                    elements.push(<span key={i}>{char}</span>);
                }
                i++;
            }
        }
        return elements;
    };

    return <>{colorizeText(text)}</>;
};

export default ColorizedText;
