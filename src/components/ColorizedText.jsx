import React from 'react';
import { getCharacterTone } from '../lib/tones';

const ColorizedText = ({ text, theme = 'vibrant', enabled = true }) => {
    if (!enabled || !text) {
        return <>{text}</>;
    }

    const colorizeText = (text) => {
        return text.split('').map((char, index) => {
            const tone = getCharacterTone(char);

            if (tone) {
                const className = `tone-${tone}-${theme}`;
                return (
                    <span key={index} className={className}>
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
