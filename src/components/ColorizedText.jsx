import React, { useMemo } from 'react';
import { getCharacterTone } from '../lib/tones';
import { tokenizeText } from '../lib/tokenizer';
import { getFrequencyRank } from '../lib/frequency';

const ColorizedText = ({ text, enabled = true, lookedUpWords = new Set(), properNames = new Set(), overrideToneColors = null, activeIndex = null, starAnimationIndex = null }) => {
    if ((!enabled && overrideToneColors !== false) || !text) {
        return <>{text}</>;
    }

    // Pre-calculate which absolute character indices belong to a proper name
    const nameIndices = useMemo(() => {
        const indices = new Set();
        if (!text || properNames.size === 0) return indices;
        
        properNames.forEach(name => {
            if (!name) return;
            let pos = text.indexOf(name);
            while (pos !== -1) {
                for (let i = 0; i < name.length; i++) {
                    indices.add(pos + i);
                }
                pos = text.indexOf(name, pos + 1);
            }
        });
        return indices;
    }, [text, properNames]);

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

                token.chars.forEach((c, index) => {
                    const charAbsIdx = token.startIndex + index;
                    const isProperNameChar = nameIndices.has(charAbsIdx) || properNames.has(token.word);
                    const properNameClass = isProperNameChar ? ' proper-name-highlight' : '';

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

                let quoteClass = '';
                const c = token.chars[0].char;
                if (c === '“' || c === '”' || c === '"') {
                    quoteClass = ' quote-mark-highlight';
                }

                spans.push(
                    <span
                        key={`${token.startIndex}`}
                        className={`char-with-tone${toneClass}${highlightClass}${quoteClass}`}
                        data-index={token.startIndex}
                    >
                        {c}
                    </span>
                );
            }
        });

        return spans;
    }, [text, lookedUpWords, overrideToneColors, activeIndex]);

    return <>{elements}</>;
};

export default ColorizedText;
