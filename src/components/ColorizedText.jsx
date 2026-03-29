import React, { useMemo } from 'react';
import { getCharacterTone } from '../lib/tones';
import { tokenizeText } from '../lib/tokenizer';
import { getFrequencyRank } from '../lib/frequency';

const ColorizedText = ({ text, enabled = true, lookedUpWords = new Set(), properNames = new Set(), overrideToneColors = null, activeIndex = null, starAnimationIndex = null }) => {
    if ((!enabled && overrideToneColors !== false) || !text) {
        return <>{text}</>;
    }

    const elements = useMemo(() => {
        const tokens = tokenizeText(text);
        const spans = [];

        tokens.forEach((token) => {
            if (token.type === 'dict') {
                const isLookedUp = lookedUpWords.has(token.word);
                const lookedUpClass = isLookedUp ? ' word-looked-up' : '';
                const isHighlighted = activeIndex !== null && activeIndex >= token.startIndex && activeIndex <= token.endIndex;
                const highlightClass = isHighlighted ? ' word-active-highlight' : '';
                const isStarAnimating = starAnimationIndex !== null && starAnimationIndex >= token.startIndex && starAnimationIndex <= token.endIndex;
                const starAnimClass = isStarAnimating ? ' word-star-anim' : '';

                const freqRank = getFrequencyRank(token.word);
                const freqClass = (freqRank !== null && freqRank <= 6000) ? ' high-freq-word' : '';
                const properNameClass = properNames.has(token.word) ? ' proper-name-highlight' : '';

                token.chars.forEach((c, index) => {
                    let toneClass = '';
                    if (overrideToneColors === false) {
                        toneClass = '';
                    } else if (c.tone && c.tone >= 1 && c.tone <= 4) {
                        toneClass = ` tone-${c.tone}`;
                    } else if (c.tone === 5) {
                        toneClass = ` tone-neutral`;
                    }

                    spans.push(
                        <span
                            key={`${token.startIndex + index}`}
                            className={`char-with-tone${toneClass}${lookedUpClass}${highlightClass}${starAnimClass}${freqClass}${properNameClass}`}
                            data-word={token.word}
                            data-index={token.startIndex + index}
                            data-pinyin={isHighlighted ? c.pinyin : undefined}
                        >
                            {c.char}
                        </span>
                    );
                });
            } else {
                // Single char / punctuation
                const isHighlighted = activeIndex !== null && activeIndex === token.startIndex;
                const highlightClass = isHighlighted ? ' word-active-highlight' : '';

                let toneClass = '';
                if (overrideToneColors !== false && token.chars[0].tone) {
                    toneClass = ` tone-${token.chars[0].tone}`;
                }

                spans.push(
                    <span
                        key={`${token.startIndex}`}
                        className={`char-with-tone${toneClass}${highlightClass}`}
                        data-index={token.startIndex}
                    >
                        {token.chars[0].char}
                    </span>
                );
            }
        });

        return spans;
    }, [text, lookedUpWords, overrideToneColors, activeIndex]);

    return <>{elements}</>;
};

export default ColorizedText;
