import React from 'react';
import { getCharacterTone } from '../lib/tones';

const ColorizedText = ({ text, enabled = true }) => {
    if (!enabled || !text) {
        return <>{text}</>;
    }

    const colorizeText = (text) => {
        return text.split('').map((char, index) => {
            const tone = getCharacterTone(char);

            if (tone) {
                // Use char-with-tone class and tone-{number} for dots above
                return (
                    <span key={index} className={`char-with-tone tone-${tone}`}>
                        {char}
                    </span>
                );
            }

            return <span key={index}>{char}</span>;
        });
    };

    return <>{colorizeText(text)}</>;
};

export default ColorizedText;
